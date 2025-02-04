#!/usr/bin/env python3
"""
A program that reads synthesized insights from "knowledge_graph.json" and
"synthesized_knowledge.txt", then uses a Hugging Face model to generate
a tweet thread of exactly 10 tweets reflecting insights and breakthroughs.
"""

import os
import json
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

# Define the base path for source files
SOURCE_DIR = "/Users/kurultai/Downloads/projects/llmtraining/train"

def load_synthesized_knowledge(knowledge_file="synthesized_knowledge.txt"):
    """Load and return the synthesized knowledge text."""
    file_path = os.path.join(SOURCE_DIR, knowledge_file)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"{file_path} not found.")
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read().strip()

def load_knowledge_graph(kg_file="knowledge_graph.json"):
    """Load and return the knowledge graph as a formatted string."""
    file_path = os.path.join(SOURCE_DIR, kg_file)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"{file_path} not found.")
    with open(file_path, "r", encoding="utf-8") as f:
        kg_data = json.load(f)
    # For simplicity, we convert the JSON into a pretty-printed string.
    # In a more advanced version, you might selectively extract nodes and relationships.
    return json.dumps(kg_data, indent=2)

def build_prompt(knowledge_text, knowledge_graph_text):
    """
    Build a prompt that provides context from the inputs and instructs the model
    to create a thread of exactly 10 tweets.
    """
    prompt = (
        "Based on the following insights, write a thread of exactly 10 tweets "
        "reflecting significant insights and breakthroughs. Each tweet should be "
        "concise (within 280 characters) and begin with the tweet number followed "
        "by a period and a space.\n\n"
        "Synthesized Knowledge:\n"
        f"{knowledge_text}\n\n"
        "Knowledge Graph Insights:\n"
        f"{knowledge_graph_text}\n\n"
        "Write the tweet thread below (exactly 10 tweets):\n"
        "1. "
    )
    return prompt

def generate_tweet_thread(prompt, model_name="omoplatapus/axltol", max_length=1000, temperature=0.8):
    """
    Uses a Hugging Face text-generation pipeline to generate text based on the prompt.
    Using the Axlotl model for better quality outputs.
    """
    print(f"Loading model and tokenizer from {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    # Ensure the tokenizer has the necessary tokens
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device="mps"  # Use Metal Performance Shaders on Mac
    )
    
    print("Generating text...")
    generated = generator(
        prompt,
        max_length=max_length,
        num_return_sequences=1,
        temperature=temperature,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
        no_repeat_ngram_size=3,  # Prevent repetitive text
        top_p=0.95,              # Nucleus sampling
        top_k=50                 # Limit vocabulary diversity
    )
    
    # Extract generated text
    full_text = generated[0]["generated_text"]
    return full_text

def parse_tweets(generated_text):
    """
    Parse the generated text into individual tweet strings. This implementation
    assumes that each tweet starts with a number (1. 2. etc.). Adjust if needed.
    """
    tweets = []
    # Split lines and filter those that look like tweets (start with a tweet number)
    for line in generated_text.splitlines():
        line = line.strip()
        if len(line) == 0:
            continue
        # Check if line begins with a tweet number followed by a period,
        # e.g., "1. " or "10. "
        if any(line.startswith(f"{i}.") for i in range(1, 11)):
            tweets.append(line)
    # In case the model did not insert line breaks, try splitting on " {number}." tokens
    if len(tweets) < 10:
        # Fallback: look for the tweet patterns in the entire text.
        import re
        pattern = re.compile(r"(\d+\.\s+)")
        parts = pattern.split(generated_text)
        # There should be an empty element at the beginning if the text starts with the tweet prompt.
        combined = ""
        for part in parts:
            combined += part
        # Now try to extract 10 tweets with pattern matching.
        tweets = re.findall(r"(\d+\.\s*[^(\d+\.)]+)", combined)
    return tweets[:10]

def main():
    try:
        # Load the synthesized knowledge text and knowledge graph insights.
        knowledge_text = load_synthesized_knowledge()
        knowledge_graph_text = load_knowledge_graph()
    except FileNotFoundError as e:
        print(e)
        return

    # Build the prompt for tweet generation.
    prompt = build_prompt(knowledge_text, knowledge_graph_text)
    
    # Generate a tweet thread using the specified model.
    print("Generating tweet thread using Axlotl model...")
    generated_text = generate_tweet_thread(
        prompt, 
        model_name="omoplatapus/axltol",
        max_length=1000,  # Reduced to avoid memory issues
        temperature=0.8   # Slightly increased for more creative outputs
    )
    
    # Parse the generated output into exactly 10 tweets.
    tweets = parse_tweets(generated_text)
    if len(tweets) < 10:
        print("Warning: Less than 10 tweets were generated. Here is the output:")
        print(generated_text)
    else:
        print("\nGenerated Tweet Thread:")
        for tweet in tweets:
            print(tweet)

if __name__ == "__main__":
    main()