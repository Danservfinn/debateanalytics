"""
Entry point for running the FastAPI application.
Ensures proper module resolution for Railway deployment.
"""
import sys
import os
import traceback

print("=== STARTUP DEBUG ===")
print(f"CWD: {os.getcwd()}")
print(f"__file__: {__file__}")

# List directory contents
print("Directory contents:")
for item in os.listdir('.'):
    print(f"  {item}")

# Add the backend directory to Python path BEFORE any imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set PYTHONPATH for subprocess calls
os.environ["PYTHONPATH"] = backend_dir

print(f"Python version: {sys.version}")
print(f"Backend dir: {backend_dir}")
print(f"Sys.path: {sys.path[:3]}")

# Check if key packages are installed
print("Checking packages...")
try:
    import fastapi
    print(f"  fastapi: {fastapi.__version__}")
except ImportError as e:
    print(f"  fastapi: MISSING - {e}")

try:
    import uvicorn
    print(f"  uvicorn: OK")
except ImportError as e:
    print(f"  uvicorn: MISSING - {e}")

try:
    import anthropic
    print(f"  anthropic: OK")
except ImportError as e:
    print(f"  anthropic: MISSING - {e}")

print("=== END DEBUG ===")

try:
    # Now import the app after path is configured
    print("Importing api.main...")
    from api.main import app
    print("Import successful!")
except Exception as e:
    print(f"Import failed: {e}")
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Debate Analytics API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
