"""
Cascade Router — Traffic displacement simulation endpoints.
"""

from fastapi import APIRouter
from models import CascadeRequest
from services.cascade_router import simulate_cascade, get_all_corridors
from datetime import datetime

router = APIRouter(prefix="/api", tags=["cascade"])


@router.post("/cascade")
def run_cascade_simulation(req: CascadeRequest):
    """
    Simulate cascading traffic impact when a corridor is blocked.
    """
    hour = req.hour
    if hour is None and req.datetime:
        try:
            dt = datetime.fromisoformat(req.datetime.replace("Z", "+00:00"))
            hour = dt.hour
        except (ValueError, AttributeError):
            pass
    
    result = simulate_cascade(
        blocked_corridor=req.blocked_corridor,
        blocked_percentage=req.blocked_percentage,
        hour=hour,
    )
    
    return result


@router.get("/corridors")
def list_corridors():
    """Get all corridors in the road network graph."""
    corridors = get_all_corridors()
    return {"corridors": corridors}
