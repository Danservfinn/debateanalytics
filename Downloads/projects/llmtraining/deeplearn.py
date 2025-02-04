import os
import time
import glob
import json
from datetime import datetime, timedelta
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig

# Check for an override to force CPU usage for deeplearn.
use_cpu = os.getenv("DEEPLEARN_USE_CPU", "false").lower() == "true"
if not use_cpu and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = torch.device("mps")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DEVICE SELECT] deeplearn will run on MPS.")
else:
    device = torch.device("cpu")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DEVICE SELECT] deeplearn will run on CPU.")

# Define paths
# Files will be read from and written to this directory.
KNOWLEDGE_DIR = "/Users/kurultai/Downloads/projects/llmtraining/train"
KNOWLEDGE_BASE_FILE = os.path.join(KNOWLEDGE_DIR, "synthesized_knowledge.txt")
KNOWLEDGE_GRAPH_FILE = os.path.join(KNOWLEDGE_DIR, "knowledge_graph.json")

# Global variables to cache the model and tokenizer.
MODEL = None
TOKENIZER = None
MODEL_NAME = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
HF_TOKEN = "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"

# Define a module-level flag for warm-up
MODEL_WARMED_UP = False

def patch_quantization_support():
    """
    Patch transformers to allow an additional quantization type ("fp8").
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH] Attempting to patch quantization support...")
    try:
        from transformers.utils import quantization
        original_check = quantization.check_quantization_config

        def patched_check(q_config, supported_types, **kwargs):
            # Add support for "fp8".
            supported_types = list(supported_types) + ["fp8"]
            return original_check(q_config, supported_types, **kwargs)

        quantization.check_quantization_config = patched_check
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH] Patched quantization validation to accept 'fp8'")
    except ImportError as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [PATCH WARNING] Could not patch quantization support: {e}")

def initialize_deepseek():
    """
    Loads and caches the Deepseek R1 model and tokenizer.
    """
    global MODEL, TOKENIZER
    if MODEL is not None and TOKENIZER is not None:
        print("[MODEL INIT] Model and tokenizer are already initialized.")
        return

    print("[MODEL INIT] Initializing model and tokenizer...")
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

        MODEL = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            config=config,
            token=HF_TOKEN,
            trust_remote_code=True,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
        ).to(device)

        # Attempt to compile the model if supported (PyTorch 2.0+).
        try:
            print("[MODEL INIT] Attempting to compile the model...")
            MODEL = torch.compile(MODEL)
            print("[MODEL INIT] Model compiled successfully.")
        except Exception as compile_e:
            print("[MODEL INIT] torch.compile() failed, continuing without compilation:", compile_e)

        TOKENIZER = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            token=HF_TOKEN,
            trust_remote_code=True
        )
        print("[MODEL INIT] Deepseek R1 model and tokenizer loaded successfully.")
    except Exception as e:
        print("[MODEL ERROR] Failed to load Deepseek model:", e)
        raise

def summarize_text(text):
    """
    Summarizes the provided text into key bullet points.
    """
    prompt = f"Summarize the following text into key bullet points:\n\n{text}"
    try:
        encoded = TOKENIZER.encode_plus(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=256
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)
        with torch.no_grad():
            output_ids = MODEL.generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=64,
                temperature=0.5,
                num_return_sequences=1
            )
        summary = TOKENIZER.decode(output_ids[0], skip_special_tokens=True)
        print("[SUMMARIZE] Summary generated.")
        return summary
    except Exception as e:
        err_msg = "Summary generation failed: " + str(e)
        print("[SUMMARIZE ERROR]", err_msg)
        return err_msg

def generate_tags(text):
    """
    Extracts key topics from the text as a comma-separated list.
    """
    prompt = f"Extract key topics from the following text and separate them with commas:\n\n{text}"
    try:
        encoded = TOKENIZER.encode_plus(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=256
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)
        output_ids = MODEL.generate(
            input_ids,
            attention_mask=attention_mask,
            max_new_tokens=50,
            temperature=0.7,
            num_return_sequences=1
        )
        tags = TOKENIZER.decode(output_ids[0], skip_special_tokens=True)
        print("[GENERATE TAGS] Tags generated.")
        return tags.strip()
    except Exception as e:
        err_msg = "Tag generation failed: " + str(e)
        print("[GENERATE TAGS ERROR]", err_msg)
        return err_msg

def generate_qapairs(text):
    """
    Generates three question and answer pairs based on the provided text.
    """
    prompt = f"Generate three thoughtful question and answer pairs based on the following text:\n\n{text}"
    try:
        encoded = TOKENIZER.encode_plus(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)
        output_ids = MODEL.generate(
            input_ids,
            attention_mask=attention_mask,
            max_new_tokens=200,
            temperature=0.7,
            num_return_sequences=1
        )
        qa_pairs = TOKENIZER.decode(output_ids[0], skip_special_tokens=True)
        print("[GENERATE Q&A] Q&A pairs generated.")
        return qa_pairs.strip()
    except Exception as e:
        err_msg = "Q&A generation failed: " + str(e)
        print("[GENERATE Q&A ERROR]", err_msg)
        return err_msg

def get_next_review_date():
    """
    Calculates the next review date (spaced repetition strategy: 1 day later).
    """
    next_review = datetime.now() + timedelta(days=1)
    print("[REVIEW DATE] Next review date set.")
    return next_review.strftime('%Y-%m-%d %H:%M:%S')

def update_knowledge_graph(entry_id, tags):
    """
    Updates a JSON-formatted knowledge graph mapping entry IDs to their tags.
    """
    print("[KG UPDATE] Updating knowledge graph for entry:", entry_id)
    knowledge_graph = {}
    if os.path.isfile(KNOWLEDGE_GRAPH_FILE):
        try:
            with open(KNOWLEDGE_GRAPH_FILE, "r", encoding="utf-8") as kg_file:
                knowledge_graph = json.load(kg_file)
            print("[KG UPDATE] Loaded existing knowledge graph.")
        except Exception as e:
            print(f"[KG WARNING] Could not load knowledge graph: {e}")

    if isinstance(tags, str):
        tags = [tag.strip() for tag in tags.split(",") if tag.strip()]

    knowledge_graph[entry_id] = {
        "tags": tags,
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    try:
        with open(KNOWLEDGE_GRAPH_FILE, "w", encoding="utf-8") as kg_file:
            json.dump(knowledge_graph, kg_file, indent=2)
        print(f"[KG UPDATE] Knowledge graph updated for entry {entry_id}.")
    except Exception as e:
        print(f"[KG ERROR] Updating knowledge graph failed: {e}")

def update_knowledge_base(knowledge_base_file, new_knowledge, source="Unknown Source", method="Unknown Method"):
    """
    Appends new synthesized knowledge (with metadata) to a Markdown-formatted file.
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    entry_id = f"entry_{int(time.time())}"
    print("[KB UPDATE] Generating Markdown entry for:", entry_id)
    summary = summarize_text(new_knowledge)
    tags = generate_tags(new_knowledge)
    qa_pairs = generate_qapairs(new_knowledge)
    next_review = get_next_review_date()
    md_entry = (
        f"\n\n---\n"
        f"## Synthesized Knowledge Entry ({entry_id})\n\n"
        f"**Timestamp:** {timestamp}\n\n"
        f"**Source:** {source}\n\n"
        f"**Method:** {method}\n\n"
        f"**Next Review Date:** {next_review}\n\n"
        f"### Summary\n\n"
        f"{summary}\n\n"
        f"### Key Topics\n\n"
        f"{tags}\n\n"
        f"### Q&A\n\n"
        f"{qa_pairs}\n\n"
        f"### Detailed Content\n\n"
        f"{new_knowledge}\n"
        f"---\n"
    )
    try:
        with open(knowledge_base_file, "a", encoding="utf-8") as f:
            f.write(md_entry)
        print(f"[KB UPDATE] Knowledge base updated at: {knowledge_base_file}")
        update_knowledge_graph(entry_id, tags)
    except Exception as e:
        print(f"[KB ERROR] Updating knowledge base failed: {e}")

def load_texts_from_transcribed():
    """
    Loads all TXT files from the specified KNOWLEDGE_DIR.
    """
    texts = []
    BUFFER_SIZE = 1024 * 1024  # 1 MB
    READ_TIMEOUT = 300  # seconds per file
    print(f"[FILE SCAN] Scanning for text files in: {KNOWLEDGE_DIR}")
    files = glob.glob(os.path.join(KNOWLEDGE_DIR, "*.txt"))
    if not files:
        print(f"[FILE SCAN] No files found in: {KNOWLEDGE_DIR}")
    else:
        for file_path in files:
            print(f"[FILE LOAD] Processing {os.path.basename(file_path)}")
            try:
                start_time = time.time()
                with open(file_path, "r", encoding="utf-8", buffering=BUFFER_SIZE) as f:
                    text_chunks = []
                    while True:
                        if time.time() - start_time > READ_TIMEOUT:
                            raise TimeoutError(f"Read timeout after {READ_TIMEOUT} seconds")
                        chunk = f.read(BUFFER_SIZE)
                        if not chunk:
                            break
                        text_chunks.append(chunk)
                    full_text = ''.join(text_chunks)
                if full_text.strip():
                    texts.append(full_text)
                    print(f"[FILE LOAD] Loaded {os.path.basename(file_path)}")
                else:
                    print(f"[FILE WARNING] Empty file: {os.path.basename(file_path)}")
            except Exception as e:
                print(f"[FILE ERROR] Failed to load {os.path.basename(file_path)}: {e}")
    print(f"[FILE SCAN] Total files loaded: {len(texts)}")
    return texts

def synthesize_knowledge(texts):
    """
    Synthesizes new insights from a list of text documents using the DeepSeek model.

    The output is a machine-readable, JSON-formatted string with the following keys:
      - "summary": Concise bullet points summarizing the content.
      - "key_topics": A list of main topics extracted from the content.
      - "qa_pairs": An array of three thoughtful question and answer pairs that reflect profound scientific and philosophical breakthroughs.
      - "insights": Detailed analysis that includes notable scientific and philosophical breakthroughs.
      - "paper": A formally structured scientific paper containing sections such as Title, Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References.
      
    This format is designed to be easily parsed by downstream applications such as a Telegram bot or a publication pipeline.
    """
    global MODEL_WARMED_UP

    print("[SYNTHESIS] Combining text from documents...")
    combined_text = "\n".join(texts)

    try:
        initialize_deepseek()
    except Exception as err:
        print(f"[MODEL ERROR] Unable to initialize model: {err}")
        return ""

    if not MODEL_WARMED_UP:
        print("[WARM-UP] Running warm-up generation...")
        dummy_text = "warmup"
        try:
            dummy_encoded = TOKENIZER.encode_plus(
                dummy_text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=32
            )
            dummy_input_ids = dummy_encoded["input_ids"].to(device)
            dummy_attention = dummy_encoded["attention_mask"].to(device)
            _ = MODEL.generate(
                dummy_input_ids,
                attention_mask=dummy_attention,
                max_new_tokens=10
            )
            print("[WARM-UP] Warm-up generation complete.")
        except Exception as e:
            print(f"[WARM-UP ERROR] {e}")
        MODEL_WARMED_UP = True

    # Construct a detailed prompt to generate structured synthesis including a formatted scientific paper.
    prompt = (
        "You are a highly advanced AI specialized in scientific and philosophical analysis. "
        "Based on the following text, produce a JSON object with the following keys:\n\n"
        "  - 'summary': Bullet points summarizing the content concisely.\n"
        "  - 'key_topics': A list of the main topics extracted from the content.\n"
        "  - 'qa_pairs': An array of three thoughtful question and answer pairs that reflect profound scientific and philosophical breakthroughs.\n"
        "  - 'insights': A detailed analysis containing deep scientific and philosophical breakthroughs.\n"
        "  - 'paper': A formally structured scientific paper that includes the following sections: "
        "Title, Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References.\n\n"
        f"Text:\n{combined_text}\n\n"
        "Ensure the output is valid JSON."
    )

    # Profile tokenization.
    start_time = time.time()
    try:
        encoded = TOKENIZER.encode_plus(
            prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=1024
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)
    except Exception as err:
        print(f"[TOKENIZATION ERROR] Tokenization failed: {err}")
        return ""
    tokenization_time = time.time() - start_time
    print(f"[TIMING] Tokenization took {tokenization_time:.2f} seconds.")

    # Profile generation.
    try:
        print("[GENERATION] Generating synthesized knowledge with enhanced insights and a structured paper...")
        gen_start = time.time()
        output_ids = MODEL.generate(
            input_ids,
            attention_mask=attention_mask,
            max_new_tokens=256,
            num_return_sequences=1,
            temperature=0.7,
            pad_token_id=TOKENIZER.eos_token_id
        )
    except Exception as err:
        print(f"[GENERATION ERROR] Generation failed: {err}")
        return ""
    generation_time = time.time() - gen_start
    print(f"[TIMING] Generation took {generation_time:.2f} seconds.")

    # Profile decoding.
    try:
        decode_start = time.time()
        new_knowledge = TOKENIZER.decode(output_ids[0], skip_special_tokens=True)
    except Exception as err:
        print(f"[DECODING ERROR] Decoding failed: {err}")
        return ""
    decoding_time = time.time() - decode_start
    print(f"[TIMING] Decoding took {decoding_time:.2f} seconds.")

    total_time = time.time() - start_time
    print(f"[TIMING] Total synthesis time: {total_time:.2f} seconds.")
    print("[GENERATION] Synthesized knowledge generated.")

    # Attempt to parse the output as JSON.
    try:
        import json
        parsed_output = json.loads(new_knowledge)
        pretty_output = json.dumps(parsed_output, indent=2)
        return pretty_output
    except Exception as e:
        print("[JSON PARSING ERROR] Generated content is not valid JSON. Attempting to extract JSON object.")
        # Attempt to extract a JSON substring using a regular expression.
        import re
        json_match = re.search(r'\{.*\}', new_knowledge, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            try:
                parsed_output = json.loads(json_str)
                pretty_output = json.dumps(parsed_output, indent=2)
                return pretty_output
            except Exception as e:
                print("[JSON EXTRACTION ERROR] Failed to parse extracted JSON: ", e)
        # As a last resort, return the raw output.
        return new_knowledge

def main_loop():
    """
    Main processing loop that:
      1. Scans the KNOWLEDGE_DIR for TXT files.
      2. Synthesizes new insights from these files.
      3. Appends the synthesized content to the knowledge base.
      4. Repeats every fixed cycle (e.g., 60 seconds).
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STARTUP] Device: {device} | Working Directory: {os.getcwd()}")
    cycle_length = 60  # seconds per cycle
    while True:
        cycle_start = time.time()
        print("\n" + "="*60)
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [CYCLE START] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)
        
        # Step 1: Scan for text files
        print("[STEP 1] Scanning for text documents...")
        texts = load_texts_from_transcribed()
        
        if texts:
            # Step 2: Synthesize knowledge
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 2] Synthesizing knowledge from {len(texts)} document(s)...")
            new_knowledge = synthesize_knowledge(texts)
            if new_knowledge:
                # Step 3: Update Knowledge Base
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 3] Updating the knowledge base with synthesized data...")
                update_knowledge_base(KNOWLEDGE_BASE_FILE, new_knowledge, source="Local Files", method="Automated Synthesis")
            else:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 2] Synthesis did not generate any new content.")
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 1] No text documents found.")
        
        # Step 4: Wait for next cycle
        cycle_end = time.time()
        elapsed_time = cycle_end - cycle_start
        remaining = cycle_length - elapsed_time
        if remaining > 0:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 4] Cycle complete. Waiting {remaining:.1f} seconds until next cycle...")
            time.sleep(remaining)
        else:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [STEP 4] Cycle took longer than expected. Starting next cycle immediately.")

        next_cycle = datetime.now() + timedelta(seconds=cycle_length)
        print("="*60)
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [CYCLE END] Next cycle scheduled at: {next_cycle.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60 + "\n")

if __name__ == "__main__":
    main_loop()