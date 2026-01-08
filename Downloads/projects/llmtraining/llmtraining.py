#!/usr/bin/env python3
import os
import json
import time
from datetime import datetime
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
)

# Disable parallelism in tokenizers to avoid deadlocks/warnings.
os.environ["TOKENIZERS_PARALLELISM"] = "false"

def print_log(tag, message):
    """Print a timestamped log message and flush stdout immediately."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{tag}] {message}", flush=True)

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
    A custom Dataset that reads text files from a folder, tokenizes them,
    and caches the tokenization result.
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
        
        # Try to load from cache if available.
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_content = f.read().strip()
                if cached_content:
                    tokenized = json.loads(cached_content)
                    # Verify that cache is valid by checking for required keys.
                    if isinstance(tokenized, dict) and "input_ids" in tokenized:
                        print_log("CACHE", f"Loaded cache for {os.path.basename(file_path)}")
                        return tokenized
                print_log("CACHE", f"Cache invalid for {os.path.basename(file_path)}. Re-tokenizing.")
                os.remove(cache_file)
            except Exception as e:
                print_log("CACHE", f"Error loading cache for {file_path}: {e}")
                os.remove(cache_file)
        
        # Process raw text file.
        print_log("READ", f"Processing file: {os.path.basename(file_path)}")
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        
        if self.tokenizer is not None:
            tokenized = self.tokenizer(
                text,
                truncation=True,
                padding="max_length",
                max_length=self.max_length
            )
            # If tokenized is a BatchEncoding, convert it to a dict.
            if hasattr(tokenized, "to_dict"):
                tokenized = tokenized.to_dict()
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
            
            tokenized = make_serializable(tokenized)
            try:
                tokenized = json.loads(json.dumps(tokenized))
            except Exception as e:
                print_log("JSON", f"JSON conversion failed for {file_path}: {e}")
                raise e
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(tokenized, f, indent=2)
                print_log("CACHE", f"Saved cache for {os.path.basename(file_path)}")
            except Exception as e:
                print_log("CACHE", f"Failed to save cache for {file_path}: {e}")
            return tokenized
        return {"text": text}

# Force training on CPU
device = torch.device("cpu")
torch.set_num_threads(8)
print_log("DEVICE SELECT", "Running on CPU")

# Define the output directory for training artifacts.
output_dir = "./output"

# Create training arguments with CPU-oriented settings.
training_args = TrainingArguments(
    output_dir=output_dir,
    num_train_epochs=3,
    per_device_train_batch_size=1,           # Minimal batch size for CPU usage.
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=4,
    learning_rate=5e-5,
    warmup_steps=100,
    weight_decay=0.01,
    logging_steps=10,
    save_steps=50,
    eval_steps=50,
    eval_strategy="steps",
    load_best_model_at_end=True,
    no_cuda=True,                          # Force CPU usage
    dataloader_num_workers=1,              # Limit the number of DataLoader workers.
    run_name="llmtraining-run-cpu",
    optim="adamw_torch",
)

# Moved DummyDataset to top level so it can be pickled for multiprocessing.
class DummyDataset(Dataset):
    def __init__(self, tokenizer, length=100):
        self.tokenizer = tokenizer
        self.length = length

    def __len__(self):
        return self.length

    def __getitem__(self, idx):
        sample = "This is a dummy sample for training."
        encoding = self.tokenizer(sample, truncation=True, padding="max_length", max_length=64)
        encoding["labels"] = encoding["input_ids"].copy()
        return encoding

def main():
    model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
    hf_token = "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"  # Replace with your valid token

    print_log("MODEL INIT", f"Loading model and tokenizer for {model_name}")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        token=hf_token,
        trust_remote_code=True,
        low_cpu_mem_usage=True
    ).to(device)
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        token=hf_token,
        trust_remote_code=True
    )

    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    
    train_dataset = DummyDataset(tokenizer)
    eval_dataset = DummyDataset(tokenizer, length=20)
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator
    )
    
    print_log("TRAINING", "Starting training process on CPU")
    trainer.train()
    print_log("TRAINING", f"Training complete. Outputs saved to {output_dir}")

if __name__ == "__main__":
    main()