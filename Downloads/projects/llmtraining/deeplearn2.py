import os
import time
import json
from datetime import datetime, timedelta
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig

# Device selection: if DEEPLEARN_USE_CPU is not set to true and MPS is available, use it.
use_cpu = os.getenv("DEEPLEARN_USE_CPU", "false").lower() == "true"
if not use_cpu and torch.backends.mps.is_available():
    device = torch.device("mps")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DEVICE SELECT] Running on Apple Metal (MPS).")
elif not use_cpu and torch.cuda.is_available():
    device = torch.device("cuda")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DEVICE SELECT] Running on CUDA.")
else:
    device = torch.device("cpu")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DEVICE SELECT] Running on CPU.")

# Define paths
KNOWLEDGE_DIR = "/Users/kurultai/Downloads/projects/llmtraining/train"
KNOWLEDGE_BASE_FILE = os.path.join(KNOWLEDGE_DIR, "synthesized_knowledge.txt")
KNOWLEDGE_GRAPH_FILE = os.path.join(KNOWLEDGE_DIR, "knowledge_graph.json")

# Instead of caching the model/tokenizer globally, we always load fresh.
MODEL_NAME = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
HF_TOKEN = "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"

os.environ["TOKENIZERS_PARALLELISM"] = "false"

def patch_quantization_support():
    """
    Patch transformers to allow an additional quantization type ("fp8").
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH] Attempting to patch quantization support...")
    try:
        from transformers.utils import quantization
        original_check = quantization.check_quantization_config

        def patched_check(q_config, supported_types, **kwargs):
            supported_types = list(supported_types) + ["fp8"]
            return original_check(q_config, supported_types, **kwargs)

        quantization.check_quantization_config = patched_check
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH] Patched quantization validation to accept 'fp8'")
    except ImportError as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH WARNING] Could not patch quantization support: {e}")

def initialize_deepseek():
    """
    Loads the Deepseek R1 model and tokenizer freshly.
    Caching is disabled so that the model and tokenizer are always loaded from scratch.
    """
    print("[MODEL INIT] Initializing model and tokenizer (no caching)")
    try:
        config = AutoConfig.from_pretrained(
            MODEL_NAME,
            token=HF_TOKEN,
            trust_remote_code=True
        )
        if hasattr(config, "quantization_config"):
            print("[MODEL INIT] Removing quantization_config from configuration.")
            del config.quantization_config

        # Use FP16 on MPS to reduce memory usage; otherwise use FP32.
        dtype = torch.float16 if device.type == "mps" else torch.float32

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            config=config,
            token=HF_TOKEN,
            trust_remote_code=True,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
        ).to(device)

        # Attempt to compile the model (if supported) for better performance.
        try:
            print("[MODEL INIT] Attempting to compile the model...")
            model = torch.compile(model)
            print("[MODEL INIT] Model compiled successfully.")
        except Exception as compile_e:
            print("[MODEL INIT] torch.compile() failed, continuing without compilation:", compile_e)

        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            token=HF_TOKEN,
            trust_remote_code=True
        )
        # Disable activation caching so that gradient checkpointing works properly.
        if hasattr(model.config, "use_cache") and model.config.use_cache:
            print("[MODEL OPT] Disabling use_cache for gradient checkpointing compatibility.")
            model.config.use_cache = False

        # Enable gradient checkpointing to reduce memory usage.
        if hasattr(model, "gradient_checkpointing_enable"):
            print("[MODEL OPT] Enabling gradient checkpointing.")
            model.gradient_checkpointing_enable()

        print("[MODEL INIT] Deepseek R1 model and tokenizer loaded successfully.")
        return model, tokenizer
    except Exception as e:
        print("[MODEL ERROR] Failed to load Deepseek model:", e)
        raise

def summarize_text(text, model, tokenizer):
    """
    Summarizes the provided text into key bullet points.
    """
    prompt = f"Summarize the following text into key bullet points:\n\n{text}"
    try:
        encoded = tokenizer.encode_plus(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=256
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)
        with torch.no_grad():
            output_ids = model.generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=64,
                temperature=0.5,
                num_return_sequences=1
            )
        summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        print("[SUMMARIZE] Summary generated.")
        return summary
    except Exception as e:
        print("[SUMMARIZE ERROR]", e)
        return ""

def iterative_synthesize_knowledge(texts, max_iterations=3):
    """
    Iteratively generate synthesized knowledge with prompt tuning until the generated output
    meets the required JSON structure or until max_iterations is reached.
    
    The output must be a JSON object with the keys:
      - 'summary'
      - 'key_topics'
      - 'qa_pairs'
      - 'insights'
      - 'paper'
    
    If an iteration fails, a reminder is added to the prompt for a more robust generation.
    """
    # Always load fresh model and tokenizer
    model, tokenizer = initialize_deepseek()

    combined_text = "\n".join(texts)
    base_prompt = (
        "You are a highly advanced AI specialized in scientific and philosophical analysis. "
        "Based on the following text, produce a JSON object with the following keys:\n\n"
        "  - 'summary': Bullet points summarizing the content concisely.\n"
        "  - 'key_topics': A list of the main topics extracted from the content.\n"
        "  - 'qa_pairs': An array of three thoughtful question and answer pairs that reflect "
        "profound scientific and philosophical breakthroughs.\n"
        "  - 'insights': A detailed analysis containing deep scientific and philosophical breakthroughs.\n"
        "  - 'paper': A formally structured scientific paper that includes the following sections: "
        "Title, Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References.\n\n"
        f"Text:\n{combined_text}\n\nEnsure the output is valid JSON."
    )

    new_knowledge = ""
    for i in range(max_iterations):
        current_prompt = base_prompt
        if i > 0:
            current_prompt += (
                f"\n\n[Attempt {i+1}: Make sure that the JSON output includes exactly the keys: "
                "summary, key_topics, qa_pairs, insights, and paper, with no extra keys.]"
            )
        
        try:
            encoded = tokenizer.encode_plus(
                current_prompt,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=1024
            )
            input_ids = encoded["input_ids"].to(device)
            attention_mask = encoded["attention_mask"].to(device)
        except Exception as token_err:
            print(f"[TOKENIZATION ERROR] Iteration {i+1}: {token_err}")
            continue
        
        try:
            output_ids = model.generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=256,
                num_return_sequences=1,
                temperature=0.7,
                pad_token_id=tokenizer.eos_token_id
            )
        except Exception as gen_err:
            print(f"[GENERATION ERROR] Iteration {i+1}: {gen_err}")
            continue

        try:
            new_knowledge = tokenizer.decode(output_ids[0], skip_special_tokens=True)
            
            # Enhanced JSON extraction with validation
            json_str = None
            start_idx = new_knowledge.find('{')
            end_idx = new_knowledge.rfind('}')
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                candidate = new_knowledge[start_idx:end_idx+1]
                # Remove common formatting artifacts
                candidate = candidate.replace('```json', '').replace('```', '').strip()
                
                # Validate basic JSON structure
                if candidate.count('{') == candidate.count('}'):
                    json_str = candidate
                    
            if not json_str:
                print(f"[DEBUG] Raw model output:\n{new_knowledge}")
                json_str = new_knowledge  # Fallback to raw output

        except Exception as dec_err:
            print(f"[DECODING ERROR] Iteration {i+1}: {dec_err}")
            continue

        if not json_str.strip():
            print(f"[EMPTY OUTPUT] Iteration {i+1} produced an empty output. Retrying with enhanced prompt.")
            continue
        
        try:
            parsed_output = json.loads(json_str)
        except json.JSONDecodeError as json_err:  # More specific exception
            print(f"[JSON PARSING ERROR] Iteration {i+1} failed: {json_err}")
            print(f"[DEBUG] Invalid JSON content:\n{json_str}")
            save_raw_output(new_knowledge)
            continue

        valid, missing_keys = validate_synthesized_output(parsed_output)
        if valid:
            print(f"[ITERATIVE PROMPT] Successful output generated at iteration {i+1}.")
            return json.dumps(parsed_output, indent=2)
        else:
            print(f"[SCHEMA ERROR] Attempt {i+1} missing keys: {missing_keys}. Retrying with an enhanced prompt.")
            save_raw_output(new_knowledge)
    
    print("[ITERATIVE PROMPT] Failed to generate valid output after multiple attempts, returning last raw output.")
    return new_knowledge

def save_raw_output(raw_text):
    """
    Saves the raw generated output to a timestamped log file for debugging.
    """
    import os
    from datetime import datetime
    output_directory = os.path.join(KNOWLEDGE_DIR, "raw output")
    if not os.path.exists(output_directory):
        os.makedirs(output_directory, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(output_directory, f"raw_output_{timestamp}.log")
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(raw_text)
        print(f"[DEBUG] Raw output saved to {filename}")
    except Exception as e:
        print(f"[DEBUG] Failed to save raw output to {filename}: {e}")

def validate_synthesized_output(data):
    """
    Validates that the synthesized JSON output contains the required keys.
    Returns (True, None) if valid or (False, missing_keys) otherwise.
    """
    required_keys = ["summary", "key_topics", "qa_pairs", "insights", "paper"]
    missing_keys = [key for key in required_keys if key not in data]
    if missing_keys:
        return False, missing_keys
    return True, None

def main_loop():
    """
    Main processing loop:
      1. Scans KNOWLEDGE_DIR for raw text files (excluding cached or synthesized files).
      2. Uses iterative prompt tuning to synthesize insights from these documents.
      3. Updates the knowledge base with the synthesized output.
      4. Runs every fixed cycle.
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STARTUP] Device: {device} | Working Directory: {os.getcwd()}")
    cycle_length = 60  # seconds per cycle
    while True:
        cycle_start = time.time()
        print("\n" + "="*60)
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [CYCLE START]")
        print("="*60)
        
        # Step 1: Scan for text documents while excluding cached or synthesized files.
        print("[STEP 1] Scanning for text documents (excluding cached/synthesized files)...")
        text_files = []
        for f in os.listdir(KNOWLEDGE_DIR):
            if not f.endswith(".txt"):
                continue
            lower_f = f.lower()
            if (lower_f.startswith("synthesized_") or 
                lower_f.startswith("cached_") or 
                "cache" in lower_f or 
                f == "knowledge_graph.json" or 
                lower_f.startswith("raw output")):
                continue
            full_path = os.path.join(KNOWLEDGE_DIR, f)
            if os.path.isfile(full_path):
                text_files.append(full_path)
                
        texts = []
        for tf in text_files:
            try:
                with open(tf, "r", encoding="utf-8") as f:
                    texts.append(f.read().strip())
            except Exception as e:
                print(f"[FILE ERROR] Could not read file {tf}: {e}")

        if texts:
            print(f"[STEP 2] Synthesizing knowledge from {len(texts)} document(s)...")
            try:
                synthesized_data = iterative_synthesize_knowledge(texts)
                print("[SYNTHESIS] Generated synthesized data:")
                print(synthesized_data)
                # Append the synthesized data to the knowledge base.
                with open(KNOWLEDGE_BASE_FILE, "a", encoding="utf-8") as kb:
                    kb.write(synthesized_data + "\n")
            except Exception as e:
                print("[SYNTHESIS ERROR] Error during synthesis:", e)
        else:
            print("[STEP 1] No eligible text documents found.")
        
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 3] Updating the knowledge base with synthesized data...")
        
        cycle_end = time.time()
        elapsed_time = cycle_end - cycle_start
        remaining = cycle_length - elapsed_time
        if remaining > 0:
            print(f"[STEP 4] Cycle complete. Waiting {remaining:.1f} seconds until next cycle...")
            time.sleep(remaining)
        else:
            print("[STEP 4] Cycle took longer than expected. Starting next cycle immediately.")

        next_cycle = datetime.now() + timedelta(seconds=cycle_length)
        print("="*60)
        print(f"[CYCLE END] Next cycle scheduled at: {next_cycle.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60 + "\n")

if __name__ == "__main__":
    main_loop()