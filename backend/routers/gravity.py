"""
Gravity Router — POI gravity score endpoints.
"""

from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, time
from services.gravity_model import compute_gravity_score, get_all_pois_with_status

router = APIRouter(prefix="/api", tags=["gravity"])


@router.get("/gravity")
def get_gravity(
    lat: float = Query(..., description="Incident latitude"),
    lng: float = Query(..., description="Incident longitude"),
    datetime_str: Optional[str] = Query(None, alias="datetime", description="ISO datetime string"),
):
    """
    Compute gravity score for a location at a given time.
    Returns normalized score (0-1) and contributing POIs.
    """
    # Parse time from datetime string
    if datetime_str:
        try:
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            incident_time = dt.time()
        except (ValueError, AttributeError):
            incident_time = datetime.now().time()
    else:
        incident_time = datetime.now().time()
    
    score, pois = compute_gravity_score(lat, lng, incident_time)
    
    return {
        "gravity_score": round(score, 4),
        "location": {"lat": lat, "lng": lng},
        "time": str(incident_time),
        "contributing_pois": pois,
        "poi_count": len(pois),
    }


@router.get("/pois")
def list_pois(
    datetime_str: Optional[str] = Query(None, alias="datetime", description="ISO datetime string"),
):
    """
    Get all POIs with their current activity status.
    Used for map overlay visualization.
    """
    current_time = None
    if datetime_str:
        try:
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            current_time = dt.time()
        except (ValueError, AttributeError):
            pass
    
    pois = get_all_pois_with_status(current_time)
    return {"pois": pois}
