#!/usr/bin/env python3
"""
FastAPI app entry point for Railway.
"""
import sys
import os

print("=== STARTING ===", flush=True)

# Add backend to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print(f"Backend dir: {backend_dir}", flush=True)

# Test config import
print("Importing config...", flush=True)
try:
    from config import Config
    print("  Config imported OK", flush=True)
except Exception as e:
    print(f"  Config import FAILED: {e}", flush=True)
    sys.exit(1)

# Test api.main import
print("Importing api.main...", flush=True)
try:
    from api.main import app
    print("  api.main imported OK", flush=True)
except Exception as e:
    print(f"  api.main import FAILED: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("All imports OK!", flush=True)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
