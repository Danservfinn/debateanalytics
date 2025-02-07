#!/usr/bin/env python3
import os
import json
from datetime import datetime
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
)
from transformers.tokenization_utils_base import BatchEncoding  # Explicit import

def print_log(tag, message):
    """Print a timestamped log message (time only)."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{tag}] {message}")

def make_serializable(obj):
    """
    Recursively convert objects that are not JSON serializable into serializable types.
    """
    if hasattr(obj, "to_dict"):
        return make_serializable(obj.to_dict())
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_serializable(i) for i in obj]
    if hasattr(obj, "tolist"):
        try:
            return obj.tolist()
        except Exception:
            return str(obj)
    return obj

class TextFilesDataset(Dataset):
    """
    A custom Dataset that reads text files from a folder,
    tokenizes them, and caches the tokenization result.
    """
    def __init__(self, folder, tokenizer=None, max_length=512):
        print_log("DATASET INIT", f"Initializing dataset from folder: {folder}")
        self.folder = folder
        # Create a cache directory inside the folder.
        self.cache_dir = os.path.join(folder, ".cache")
        os.makedirs(self.cache_dir, exist_ok=True)
        self.file_paths = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".txt")]
        if not self.file_paths:
            raise ValueError(f"No .txt files found in folder: {folder}")
        self.tokenizer = tokenizer
        self.max_length = max_length
        print_log("DATASET SCAN", f"Found {len(self.file_paths)} file(s) in folder: {folder}")

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        file_path = self.file_paths[idx]
        cache_file = os.path.join(self.cache_dir, os.path.basename(file_path) + ".cache")
        
        # Try to load from cache if it exists.
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_content = f.read().strip()
                if cached_content:
                    tokenized = json.loads(cached_content)
                    # Check that cached data is in valid format by verifying it has input_ids.
                    if isinstance(tokenized, dict) and "input_ids" in tokenized:
                        print_log("CACHE", f"Loaded cache for {os.path.basename(file_path)}")
                        return tokenized
                print_log("CACHE", f"Cache invalid for {os.path.basename(file_path)}. Re-tokenizing.")
                os.remove(cache_file)
            except Exception as e:
                print_log("CACHE", f"Error loading cache for {file_path}: {e}")
                os.remove(cache_file)
        
        # Read and process the raw text file.
        print_log("READ", f"Processing file: {os.path.basename(file_path)}")
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        
        if self.tokenizer is not None:
            # Tokenize the text.
            tokenized = self.tokenizer(
                text,
                truncation=True,
                padding="max_length",
                max_length=self.max_length
            )
            if hasattr(tokenized, "to_dict"):
            if isinstance(tokenized, BatchEncoding):
                tokenized = tokenized.to_dict()
            # Duplicate input_ids into labels.
            tokenized["labels"] = tokenized["input_ids"].copy()
            
            # --- CLEANING STEP: Ensure tokens are valid indices ---
            vocab_size = self.tokenizer.vocab_size
            unk_id = self.tokenizer.unk_token_id
            tokenized["input_ids"] = [
                token if isinstance(token, int) and 0 <= token < vocab_size else unk_id
                for token in tokenized["input_ids"]
            ]
            tokenized["labels"] = tokenized["input_ids"].copy()
            # --- END CLEANING STEP ---
            
            # Convert recursively into JSON-serializable types.
            tokenized = make_serializable(tokenized)
            try:
                # Force a JSON round-trip so that the object is pure Python.
                tokenized = json.loads(json.dumps(tokenized))
            except Exception as e:
                print_log("JSON", f"JSON conversion failed for {file_path}: {e}")
                raise e
            try:
                # Save tokenized data to cache.
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(tokenized, f, indent=2)
                print_log("CACHE", f"Saved cache for {os.path.basename(file_path)}")
            except Exception as e:
                print_log("CACHE", f"Failed to save cache for {file_path}: {e}")
            return tokenized
        return {"text": text}

def main():
    # Check if we should use CPU (set via LLMTRAINING_USE_CPU environment variable)
    use_cpu = os.getenv("LLMTRAINING_USE_CPU", "false").lower() == "true"
    
    # Use the same model regardless of device.
    model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
    
    # Adjust batch sizes if using CPU to help with memory (optional).
    if use_cpu:
        per_device_train_batch_size = 1
        per_device_eval_batch_size = 1
    else:
        per_device_train_batch_size = 4
        per_device_eval_batch_size = 4

    train_folder = "./train"
    val_folder = "./validation"
    max_length = 128

    print_log("STEP 1", "Starting training process")
    
    # Load the tokenizer.
    print_log("STEP 2", f"Loading tokenizer for model: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        print_log("STEP 2", "Setting pad_token to eos_token")
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load the model with low_cpu_mem_usage enabled to reduce memory usage.
    print_log("STEP 2", f"Loading model: {model_name}")
    model = AutoModelForCausalLM.from_pretrained(model_name, low_cpu_mem_usage=True)
    if model.config.pad_token_id is None:
        model.config.pad_token_id = tokenizer.pad_token_id

    # Define training arguments.
    output_dir = "./output"
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=per_device_train_batch_size,
        per_device_eval_batch_size=per_device_eval_batch_size,
        eval_strategy="steps",
        eval_steps=50,
        save_steps=50,
        logging_steps=10,
        learning_rate=5e-5,
        warmup_steps=100,
        weight_decay=0.01,
        gradient_accumulation_steps=2,
        fp16=not use_cpu,                   # Disable fp16 if using CPU
        dataloader_num_workers=1,           # Lowering workers to reduce resource usage
        load_best_model_at_end=True,
        use_cpu=use_cpu,                    # Use CPU if specified
        run_name="llm-training-run"         # Custom run name to avoid wandb warnings
    )
    
    # Create a data collator for language modeling.
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    
    # Create the Trainer instance.
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=TextFilesDataset(train_folder, tokenizer=tokenizer, max_length=max_length),
        eval_dataset=TextFilesDataset(val_folder, tokenizer=tokenizer, max_length=max_length),
        data_collator=data_collator,
        tokenizer=tokenizer  # Note: Deprecated for future versions.
    )
    
    # Continuous training loop: immediately start a new iteration after finishing one.
    while True:
        print_log("STEP 6", "Starting training iteration")
        trainer.train()  # Runs one training session (3 epochs)
        # Save a checkpoint after each iteration.
        model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)
        print_log("STEP 6", f"Completed training iteration. Checkpoint saved to {output_dir}.")

if __name__ == "__main__":
    main()