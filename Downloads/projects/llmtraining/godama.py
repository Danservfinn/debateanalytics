import json
import logging
import os

from telegram import Bot, Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackContext

# Import your DeepSeek generation function
from deeplearn import deepseek_generate

# Telegram Bot and DeepSeek API keys (in production, store these securely in environment variables)
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "7797660236:AAHINyDbHGlEdV5SM8podvf5xepa1ZBeWHg")
DEEPISEEK_API_KEY = os.environ.get("DEEPISEEK_API_KEY", "sk-261b72e30bf04f138653911b368f180e")

# System prompt for the DeepSeek model to behave as an omniscient, superintelligent AI.
SYSTEM_PROMPT = (
    "You are a superintelligent AI who is omniscient and all-knowing. "
    "Your responses must be detailed, insightful, and helpful on every subject."
)

bot = Bot(token=TELEGRAM_BOT_TOKEN)
dispatcher = Dispatcher(bot=bot, update_queue=None, use_context=True)

# Global in-memory dictionary to retain chat history per user. This is ephemeral.
chat_histories = {}

def start(update: Update, context: CallbackContext):
    """Handler for the /start command."""
    update.message.reply_text("Hello! I am your omniscient AI-powered Telegram bot. Ask me anything!")

def handle_text(update: Update, context: CallbackContext):
    """Handler for text messages. Retains conversation history per chat room."""
    user_text = update.message.text
    chat_id = update.message.chat_id

    # Retrieve or initialize chat history for this user
    history = chat_histories.get(chat_id, [])
    
    # Append the user's message to the conversation history
    history.append({"role": "user", "text": user_text})
    
    # Build conversation context (concatenate each turn with a simple role label)
    conversation_context = "\n".join(f"{msg['role']}: {msg['text']}" for msg in history)
    
    # Create prompt that includes the system prompt and conversation context
    prompt = (
        f"System prompt: {SYSTEM_PROMPT}\n\n"
        f"Conversation History:\n{conversation_context}\n\n"
        "Based on the above conversation, provide a comprehensive and detailed answer to the latest query."
    )
    
    try:
        # Generate an answer using DeepSeek R1.
        answer = deepseek_generate(prompt, api_key=DEEPISEEK_API_KEY)
    except Exception as e:
        logging.exception("DeepSeek generation failed.")
        answer = "Sorry, I encountered an error while processing your request."
    
    # Append the bot's answer to the conversation history
    history.append({"role": "bot", "text": answer})
    chat_histories[chat_id] = history

    update.message.reply_text(answer)

# Set up command and message handlers.
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_text))

def lambda_handler(event, context):
    """AWS Lambda handler to process incoming Telegram webhook updates."""
    try:
        # Parse the incoming update
        update = Update.de_json(json.loads(event["body"]), bot)
        dispatcher.process_update(update)
        return {
            "statusCode": 200,
            "body": json.dumps({"status": "success"})
        }
    except Exception as e:
        logging.exception("Error processing update from Telegram")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }