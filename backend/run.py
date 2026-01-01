"""
Minimal FastAPI app for Railway deployment debugging.
"""
import sys
import os

print("=== MINIMAL STARTUP ===")
print(f"CWD: {os.getcwd()}")
print(f"Python: {sys.version}")

# List files
print("Files in current directory:")
for f in sorted(os.listdir('.')):
    print(f"  {f}")

# Check for api directory
if os.path.exists('api'):
    print("Files in api/:")
    for f in sorted(os.listdir('api')):
        print(f"  {f}")

# Try basic imports
print("\nChecking imports...")
try:
    import fastapi
    print(f"  fastapi: {fastapi.__version__}")
except Exception as e:
    print(f"  fastapi FAILED: {e}")
    sys.exit(1)

try:
    import uvicorn
    print(f"  uvicorn: OK")
except Exception as e:
    print(f"  uvicorn FAILED: {e}")
    sys.exit(1)

# Create minimal app
print("\nCreating minimal app...")
from fastapi import FastAPI

app = FastAPI(title="Debug API")

@app.get("/")
async def root():
    return {"status": "ok", "message": "Minimal app running!"}

@app.get("/api/v1/health")
async def health():
    return {"status": "healthy"}

print("App created successfully!")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
