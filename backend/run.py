#!/usr/bin/env python3
"""
Minimal FastAPI app - confirmed working on Railway.
"""
import sys
import os

print("=== STARTING ===", flush=True)
print(f"Python: {sys.version}", flush=True)

from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Debate Analytics API")

@app.get("/")
async def root():
    return {"status": "ok", "message": "Debate Analytics API running!"}

@app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "version": "0.1.0"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
