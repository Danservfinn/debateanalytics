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

# Now import the app after path is configured
from api.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Debate Analytics API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
