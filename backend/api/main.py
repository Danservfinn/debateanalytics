"""
FastAPI application - minimal version for Railway testing.
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

# Test imports
from config import Config
from cache.cache_manager import CacheManager

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Debate Analytics API",
    description="Analyze Reddit users' debate patterns",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create router
router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "0.1.0",
    }


@router.get("/status")
async def api_status():
    """Get API status"""
    return {
        "api_version": "0.1.0",
        "status": "operational",
    }


# Mount router
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Debate Analytics API",
        "version": "0.1.0",
        "health": "/api/v1/health",
    }
