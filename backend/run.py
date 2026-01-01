#!/usr/bin/env python3
"""
Entry point for running the FastAPI application.
"""
import sys
import os

# Unbuffered output
os.environ['PYTHONUNBUFFERED'] = '1'

def main():
    print("=== STARTUP ===", flush=True)
    print(f"CWD: {os.getcwd()}", flush=True)
    print(f"Python: {sys.version}", flush=True)
    sys.stdout.flush()

    # Add backend directory to path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    print(f"Backend dir: {backend_dir}", flush=True)

    # Import step by step
    print("Importing config...", flush=True)
    from config import Config

    print("Importing api.main...", flush=True)
    from api.main import app

    print("Starting server...", flush=True)
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Port: {port}", flush=True)
    sys.stdout.flush()

    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        sys.exit(1)
