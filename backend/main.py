"""
ASTRAM Backend — FastAPI Application Entry Point
CREST — ML-Powered Traffic Intelligence System.
"""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ml_predict
from routers import simulator
from routers import feedback
from routers import events

app = FastAPI(
    title="CREST API",
    description="ML-Powered Traffic Intelligence System for Bengaluru Traffic Police",
    version="2.0.0",
)

# CORS middleware for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(ml_predict.router)
app.include_router(simulator.router)
app.include_router(feedback.router)
app.include_router(events.router)


@app.on_event("startup")
def startup():
    """Initialize ML models on application startup."""
    print("=" * 60)
    print("  CREST — ML-Powered Traffic Intelligence")
    print("  Bengaluru Traffic Police Command Center")
    print("=" * 60)
    # Pre-load ML models
    try:
        ml_predict._load_models()
    except Exception as e:
        print(f"  ML model loading skipped: {e}")
    print("Backend ready. All systems operational.")
    print("=" * 60)


@app.get("/")
def root():
    return {
        "name": "CREST API",
        "version": "2.0.0",
        "status": "operational",
        "description": "ML-Powered Traffic Intelligence System",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
