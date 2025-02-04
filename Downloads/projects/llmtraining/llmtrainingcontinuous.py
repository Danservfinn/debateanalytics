import os
import json
from datetime import datetime
import time

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AdamW

# ===================================================================
# Custom Dataset for Reading Text Files with Caching
# ===================================================================
class TextFilesDataset(Dataset):
    """
    A custom Dataset that reads .txt files from a folder and caches their tokenized outputs.
    """
    def __init__(self, folder, tokenizer=None, max_length=512):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [DATASET INIT] Initializing dataset from folder: {folder}")
        self.folder = folder
        # Create cache directory for tokenized files.
        self.cache_dir = os.path.join(folder, ".cache")
        os.makedirs(self.cache_dir, exist_ok=True)
        self.file_paths = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".txt")]
        if not self.file_paths:
            raise ValueError(f"[{datetime.now().strftime('%H:%M:%S')}] [DATASET ERROR] No .txt files found in folder: {folder}")
        self.tokenizer = tokenizer
        self.max_length = max_length
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [DATASET SCAN] Found {len(self.file_paths)} file(s) in folder: {folder}")

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        file_path = self.file_paths[idx]
        cache_file = os.path.join(self.cache_dir, os.path.basename(file_path) + ".cache")

        # Try loading from cache.
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_content = f.read().strip()
                if not cached_content:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Empty cache for {file_path}. Removing.")
                    os.remove(cache_file)
                else:
                    tokenized = json.loads(cached_content)
                    # Verify that the cached output has valid 'input_ids'.
                    if isinstance(tokenized, dict) and "input_ids" in tokenized:
                        if tokenized["input_ids"] and isinstance(tokenized["input_ids"][0], int):
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Loaded: {os.path.basename(file_path)}")
                            return tokenized
                        else:
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Invalid token types in cache for {os.path.basename(file_path)}. Removing.")
                            os.remove(cache_file)
                    else:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Invalid cache format for {os.path.basename(file_path)}. Removing.")
                        os.remove(cache_file)
            except Exception as err:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Error loading cache for {file_path}: {err}")

        # Read the text file.
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [READ] Processing: {os.path.basename(file_path)}")
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read().strip()

        if self.tokenizer is not None:
            tokenized = self.tokenizer(
                text,
                truncation=True,
                padding="max_length",
                max_length=self.max_length
            )
            if hasattr(tokenized, "to_dict") and callable(tokenized.to_dict):
                tokenized = tokenized.to_dict()
            # Ensure keys are lists.
            if "input_ids" in tokenized:
                tokenized["input_ids"] = list(tokenized["input_ids"])
            else:
                raise ValueError(f"Tokenized output for {file_path} is missing 'input_ids'.")
            tokenized["labels"] = list(tokenized["input_ids"])
            if "attention_mask" in tokenized:
                tokenized["attention_mask"] = list(tokenized["attention_mask"])

            # Recursively convert non-serializable types.
            def make_serializable(obj):
                if hasattr(obj, "to_dict"):
                    return make_serializable(obj.to_dict())
                if isinstance(obj, dict):
                    return {k: make_serializable(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [make_serializable(item) for item in obj]
                if hasattr(obj, "tolist"):
                    try:
                        return obj.tolist()
                    except Exception:
                        return str(obj)
                return obj
            tokenized = make_serializable(tokenized)
            try:
                tokenized = json.loads(json.dumps(tokenized))
            except Exception as err:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [JSON] Round-trip conversion failed for {file_path}: {err}")
                raise ValueError(f"Failed JSON conversion for {file_path}") from err

            # Ensure the cache directory exists before saving.
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(tokenized, f, indent=2)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Saved: {os.path.basename(file_path)}")
            except Exception as err:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [CACHE] Save failed for {file_path}: {err}")
            return tokenized

        return {"text": text}

# ===================================================================
# Continuous Fine Tuning Function
# ===================================================================
def continuous_fine_tune(model, tokenizer, dataset_folder, output_dir, 
                           batch_size=8, lr=5e-5, epochs=1, sleep_time=60):
    """
    Continuously fine tunes the model with new data from a folder.
    
    Parameters:
      model (PreTrainedModel): Model to be fine-tuned.
      tokenizer (PreTrainedTokenizer): Tokenizer used for the model.
      dataset_folder (str): Folder path containing .txt files.
      output_dir (str): Directory to save model checkpoints.
      batch_size (int): Batch size for training.
      lr (float): Learning rate for optimizer.
      epochs (int): Number of epochs per training iteration.
      sleep_time (int): Sleep time (in seconds) between iterations.
    """
    os.makedirs(output_dir, exist_ok=True)
    optimizer = AdamW(model.parameters(), lr=lr)
    model.train()  # Set model to training mode.
    
    while True:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TRAINING] Starting new training iteration.")
        
        # Reload dataset to catch any newly added files.
        dataset = TextFilesDataset(folder=dataset_folder, tokenizer=tokenizer)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        for epoch in range(epochs):
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [TRAINING] Epoch {epoch+1}/{epochs}.")
            for batch_idx, batch in enumerate(dataloader):
                optimizer.zero_grad()
                
                # Convert input to tensors and send to model's device.
                input_ids = torch.tensor(batch["input_ids"]).to(model.device)
                labels = torch.tensor(batch["labels"]).to(model.device)
                attention_mask = None
                if "attention_mask" in batch:
                    attention_mask = torch.tensor(batch["attention_mask"]).to(model.device)
                
                outputs = model(input_ids, attention_mask=attention_mask, labels=labels)
                loss = outputs.loss
                loss.backward()
                optimizer.step()
                
                if batch_idx % 10 == 0:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [TRAINING] Epoch {epoch+1} Batch {batch_idx} Loss: {loss.item():.4f}")
        
        # Save a checkpoint of the fine-tuned model and tokenizer.
        model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TRAINING] Checkpoint saved to {output_dir}.")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TRAINING] Sleeping for {sleep_time} seconds before next iteration.")
        time.sleep(sleep_time)

# ===================================================================
# Test Harness (Run one iteration for testing)
# ===================================================================
if __name__ == "__main__":
    # Create a temporary folder with a sample .txt file for testing.
    test_data_folder = "test_data"
    os.makedirs(test_data_folder, exist_ok=True)
    sample_path = os.path.join(test_data_folder, "sample.txt")
    if not os.path.exists(sample_path):
        with open(sample_path, "w", encoding="utf-8") as f:
            f.write("This is a sample text for continuous fine tuning.")

    # For testing, use a lightweight model (GPT-2) and its tokenizer.
    from transformers import AutoModelForCausalLM, AutoTokenizer
    test_model_name = "gpt2"
    tokenizer = AutoTokenizer.from_pretrained(test_model_name)
    model = AutoModelForCausalLM.from_pretrained(test_model_name)
    model.to("cpu")  # Force CPU usage for testing

    # Instead of an infinite loop, run one iteration only.
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [TEST] Starting test fine tuning iteration.")
    dataset = TextFilesDataset(folder=test_data_folder, tokenizer=tokenizer)
    dataloader = DataLoader(dataset, batch_size=1, shuffle=True)
    optimizer = AdamW(model.parameters(), lr=5e-5)
    model.train()
    for epoch in range(1):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TEST] Epoch 1/1.")
        for batch in dataloader:
            optimizer.zero_grad()
            input_ids = torch.tensor(batch["input_ids"]).to(model.device)
            labels = torch.tensor(batch["labels"]).to(model.device)
            attention_mask = None
            if "attention_mask" in batch:
                attention_mask = torch.tensor(batch["attention_mask"]).to(model.device)
            outputs = model(input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [TEST] Loss: {loss.item():.4f}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [TEST] Fine tuning test iteration complete.")