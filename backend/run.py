"""
Entry point for running the FastAPI application.
Ensures proper module resolution for Railway deployment.
"""
import sys
import os

# Add the backend directory to Python path BEFORE any imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set PYTHONPATH for subprocess calls
os.environ["PYTHONPATH"] = backend_dir

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    # Use string path so uvicorn handles the import after path is set
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, reload=False)
