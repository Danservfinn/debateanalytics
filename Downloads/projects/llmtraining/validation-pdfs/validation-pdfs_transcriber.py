#!/usr/bin/env python3
"""
pdf_transcriber.py

A script to transcribe PDFs in a directory to text files.
Saves transcriptions to a 'transcribed' subdirectory.
Also corrects grammar, spacing, spelling, and other errors in the extracted text.
"""

import os
import glob
import pdfplumber  # Primary tool for PDF text extraction
import PyPDF2  # Alternative for PDFs with selectable text
from pdfminer.high_level import extract_text as pdfminer_extract_text  # Robust PDF parsing
from tika import parser, tika
import pytesseract  # For OCR - works on image-based PDFs
from pdf2image import convert_from_path  # To convert PDF pages to images for OCR
import ssl
import requests
import time
import language_tool_python
from tqdm import tqdm   # Progress bar library
from transformers import AutoModelForCausalLM, AutoTokenizer

# At the module level (only once):
language_tool = language_tool_python.LanguageTool('en-US')

PDF_DIR = "/Users/kurultai/Downloads/projects/llmtraining/validation-pdfs"
TRANSCRIBED_DIR = "/Users/kurultai/Downloads/projects/llmtraining/validation"
MODEL_NAME = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B"  # Replace as needed
HF_TOKEN = "your_hf_token"  # Set your token if required

def ensure_tika_server():
    """Ensure Tika server is running before processing"""
    try:
        tika.TikaClientOnly = False
        # Use a dummy buffer to check the Tika server status instead of an empty file path.
        parsed = parser.from_buffer("dummy", serverEndpoint='http://localhost:9998')
        print("[SETUP] Tika server started successfully")
        time.sleep(2)
    except Exception as e:
        print(f"[ERROR] Failed to start Tika server: {str(e)}")
        raise

# Add this at the start of your main processing
ensure_tika_server()

def initialize_tika():
    """Initialize Tika and handle SSL certificate issues."""
    try:
        # Create an SSL context that doesn't verify certificates
        ssl._create_default_https_context = ssl._create_unverified_context
        
        # Download Tika server jar manually if needed
        tika_jar_url = "https://search.maven.org/remotecontent?filepath=org/apache/tika/tika-server-standard/2.6.0/tika-server-standard-2.6.0.jar"
        tika_jar_path = "/tmp/tika-server.jar"
        
        if not os.path.exists(tika_jar_path):
            print("[TIKA] Downloading Tika server...")
            response = requests.get(tika_jar_url, verify=False)
            with open(tika_jar_path, "wb") as f:
                f.write(response.content)
            print("[TIKA] Tika server downloaded successfully")
            
        os.environ['TIKA_SERVER_JAR'] = tika_jar_path
    except Exception as e:
        print(f"[WARNING] Failed to initialize Tika: {e}")

def fix_text_errors(text):
    """
    Fix grammar, spacing, spelling, and other errors using language_tool_python.
    """
    try:
        matches = language_tool.check(text)
        corrected_text = language_tool_python.utils.correct(text, matches)
        return corrected_text
    except Exception as e:
        print(f"[FIXER] Failed to correct text: {e}")
        return text

def extract_text_from_pdf(pdf_path):
    """
    Attempts to extract text from a PDF file using multiple libraries.
    Returns extracted text and the method that successfully extracted it.
    """
    text = ""
    method_used = None
    
    # Primary extraction using pdfplumber
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                except Exception as e:
                    print(f"[PDFPLUMBER] Failed on a page: {e}")
                    continue
            if text.strip():
                method_used = "pdfplumber"
    except Exception as e:
        print(f"[PDFPLUMBER] Extraction failed: {e}")
    
    # Try PyPDF2 if pdfplumber returns no text
    if not text.strip():
        print(f"[FALLBACK] Trying PyPDF2 for {pdf_path}")
        try:
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    except Exception as e:
                        print(f"[PYPDF2] Failed on a page: {e}")
                        continue
                if text.strip():
                    method_used = "PyPDF2"
        except Exception as e:
            print(f"[PYPDF2] Extraction failed: {e}")
    
    # Try pdfminer.six if still no text
    if not text.strip():
        print(f"[FALLBACK] Trying pdfminer.six for {pdf_path}")
        try:
            text = pdfminer_extract_text(pdf_path)
            if text.strip():
                method_used = "pdfminer"
        except Exception as e:
            print(f"[PDFMINER] Extraction failed: {e}")
    
    # Try Tika if still no text
    if not text.strip():
        print(f"[FALLBACK] Trying Tika for {pdf_path}")
        try:
            initialize_tika()
            tika_data = parser.from_file(pdf_path)
            text = tika_data.get("content", "")
            if text.strip():
                method_used = "Tika"
        except Exception as e:
            print(f"[TIKA] Extraction failed: {e}")
    
    # Last resort: Try OCR using Tesseract
    if not text.strip():
        print(f"[FALLBACK] Trying OCR for {pdf_path}")
        try:
            images = convert_from_path(pdf_path, dpi=300, thread_count=8)
            for i, image in enumerate(images):
                try:
                    ocr_text = pytesseract.image_to_string(
                        image,
                        config='--psm 1 --oem 3'
                    )
                    if ocr_text:
                        text += ocr_text + "\n"
                except Exception as e:
                    print(f"[OCR] Failed on page {i+1}: {e}")
                    continue
            if text.strip():
                method_used = "Tesseract OCR"
        except Exception as e:
            print(f"[OCR] Extraction failed: {e}")
    
    return text.strip(), method_used

def transcribe_pdfs():
    if not os.path.exists(TRANSCRIBED_DIR):
        os.makedirs(TRANSCRIBED_DIR)
        print(f"[SETUP] Created output directory: {TRANSCRIBED_DIR}")

    # Get all PDF files from the specified PDF directory
    pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"[FILE SCAN] No PDF files found in: {PDF_DIR}")
        return

    # Initialize counters
    skipped = 0
    failed = 0
    success = 0
    
    # Process each PDF using tqdm for progress indication
    for pdf_path in tqdm(pdf_files, desc="Transcribing PDFs", unit="file"):
        pdf_filename = os.path.basename(pdf_path)
        txt_filename = os.path.splitext(pdf_filename)[0] + ".txt"
        txt_path = os.path.join(TRANSCRIBED_DIR, txt_filename)
        
        # Skip if text file already exists
        if os.path.exists(txt_path):
            print(f"[SKIP] Text file already exists for: {pdf_filename}")
            skipped += 1
            continue
        
        print(f"[PROCESS] Transcribing: {pdf_filename}")
        
        # Extract text from PDF using the provided extraction function
        text, method = extract_text_from_pdf(pdf_path)
        
        if text:
            # Correct extracted text errors before saving
            fixed_text = fix_text_errors(text)
            # Save the corrected text to the fixed output directory
            try:
                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(f"Transcribed from: {pdf_filename}\n")
                    f.write(f"Method used: {method}\n")
                    f.write("="*50 + "\n\n")
                    f.write(fixed_text)
                print(f"[SUCCESS] Transcribed and corrected using {method}: {pdf_filename}")
                success += 1
            except Exception as e:
                print(f"[ERROR] Failed to save text file: {e}")
                failed += 1
        else:
            print(f"[FAIL] Could not extract text from: {pdf_filename}")
            failed += 1
    
    # Print summary
    print("\n" + "="*50)
    print("TRANSCRIPTION SUMMARY")
    print("="*50)
    print(f"Total PDFs found: {len(pdf_files)}")
    print(f"Successfully transcribed: {success}")
    print(f"Skipped (already existed): {skipped}")
    print(f"Failed to transcribe: {failed}")
    print(f"Transcribed files saved to: {TRANSCRIBED_DIR}")
    print("="*50)

def load_texts_from_transcribed():
    """
    Loads all text files from the 'transcribed' folder with increased buffer size
    and timeout handling for large files.
    """
    texts = []
    total_files_detected = 0
    total_files_loaded = 0
    BUFFER_SIZE = 1024 * 1024  # 1MB buffer for large files
    READ_TIMEOUT = 300  # 5 minutes per file

    print(f"\n[FILE SCAN] Scanning transcribed folder for text files...")

    transcribed_files = glob.glob(os.path.join(TRANSCRIBED_DIR, "*.txt"))
    if not transcribed_files:
        print(f"[FILE SCAN] No text files found in: {TRANSCRIBED_DIR}")
    else:
        print(f"[FILE SCAN] Found {len(transcribed_files)} text files in {TRANSCRIBED_DIR}")
        total_files_detected += len(transcribed_files)
        for file_path in transcribed_files:
            print(f"[TEXT LOADING] Processing file: {os.path.basename(file_path)}")
            try:
                start_time = time.time()
                with open(file_path, "r", encoding="utf-8", buffering=BUFFER_SIZE) as f:
                    text = []
                    while True:
                        if time.time() - start_time > READ_TIMEOUT:
                            raise TimeoutError(f"File read timeout after {READ_TIMEOUT} seconds")
                        chunk = f.read(BUFFER_SIZE)
                        if not chunk:
                            break
                        text.append(chunk)
                    full_text = ''.join(text)
                
                if full_text.strip():
                    texts.append(full_text)
                    total_files_loaded += 1
                    print(f"[TEXT LOADING] Successfully loaded: {os.path.basename(file_path)}")
                else:
                    print(f"[WARNING] File is empty: {os.path.basename(file_path)}")
            except Exception as e:
                print(f"[ERROR] Failed to load {os.path.basename(file_path)}: {e}")

    print(f"\n[PROCESSING SUMMARY] Documents detected: {total_files_detected}")
    print(f"[PROCESSING SUMMARY] Documents successfully loaded: {total_files_loaded}")
    print(f"[PROCESSING SUMMARY] Documents failed to load: {total_files_detected - total_files_loaded}")

    return texts

def initialize_deepseek():
    global MODEL, TOKENIZER
    if MODEL is None or TOKENIZER is None:
        try:
            MODEL = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                use_auth_token=HF_TOKEN,
                trust_remote_code=True,
                timeout=300  # Added 5-minute timeout for model download
            ).to(device)
            TOKENIZER = AutoTokenizer.from_pretrained(
                MODEL_NAME,
                use_auth_token=HF_TOKEN,
                trust_remote_code=True,
                timeout=300  # Added 5-minute timeout for tokenizer download
            )
            print("[MODEL INIT] Deepseek r1 model and tokenizer loaded successfully.")
        except Exception as e:
            print(f"[ERROR] Failed to initialize model: {e}")
            raise

if __name__ == "__main__":
    # Use the docs directory path
    DOCS_DIR = "/Users/kurultai/Library/Mobile Documents/com~apple~CloudDocs/simulationbreaker/advanced-rag-app/docs"
    
    print("[START] Beginning PDF transcription process...")
    transcribe_pdfs()
    print("[END] Transcription process complete.")