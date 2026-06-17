"""
ASTRAM Backend — FastAPI Application Entry Point
Event-Driven Congestion Intelligence System for Bengaluru Traffic Police.
"""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_database
from routers import incidents, forecast, gravity, cascade, calendar_risk, llm_advisor

app = FastAPI(
    title="ASTRAM API",
    description="Event-Driven Congestion Intelligence System for Bengaluru Traffic Police",
    version="1.0.0",
)

# CORS middleware for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(incidents.router)
app.include_router(forecast.router)
app.include_router(gravity.router)
app.include_router(cascade.router)
app.include_router(calendar_risk.router)
app.include_router(llm_advisor.router)


@app.on_event("startup")
def startup():
    """Initialize database on application startup."""
    print("=" * 60)
    print("  ASTRAM — Event-Driven Congestion Intelligence System")
    print("  Bengaluru Traffic Police Command Center")
    print("=" * 60)
    init_database()
    print("Backend ready. All systems operational.")
    print("=" * 60)


@app.get("/")
def root():
    return {
        "name": "ASTRAM API",
        "version": "1.0.0",
        "status": "operational",
        "description": "Event-Driven Congestion Intelligence System",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
