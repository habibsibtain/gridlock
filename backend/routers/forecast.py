"""
Forecast Router — ECRS prediction and resource recommendations.
"""

from fastapi import APIRouter
from models import ForecastRequest
from services.ecrs_engine import compute_full_ecrs, compute_resource_recommendation
from services.gravity_model import compute_gravity_score
from services.calendar_intel import get_calendar_risk
from database import get_historical_stats_for_location
from datetime import datetime, time

router = APIRouter(prefix="/api", tags=["forecast"])


@router.post("/forecast")
def forecast_event(req: ForecastRequest):
    """
    Predict ECRS and resource requirements for a planned or unplanned event.
    """
    # Parse datetime
    hour = None
    incident_time = None
    date_str = None
    
    if req.datetime:
        try:
            dt = datetime.fromisoformat(req.datetime.replace("Z", "+00:00"))
            hour = dt.hour
            incident_time = dt.time()
            date_str = dt.strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            pass
    
    # Compute gravity score if coordinates provided
    gravity_score = 0.0
    nearby_pois = []
    if req.latitude and req.longitude and incident_time:
        gravity_score, nearby_pois = compute_gravity_score(
            req.latitude, req.longitude, incident_time
        )
    
    # Check calendar events
    calendar_multiplier = 1.0
    calendar_info = None
    if date_str:
        cal_risk = get_calendar_risk(date_str)
        if cal_risk["has_events"]:
            calendar_multiplier = cal_risk["combined_multiplier"]
            calendar_info = cal_risk
    
    # Compute ECRS
    ecrs_result = compute_full_ecrs(
        event_cause=req.event_cause,
        corridor=req.corridor,
        hour_of_day=hour,
        requires_road_closure=req.requires_road_closure,
        gravity_score=gravity_score,
        calendar_multiplier=calendar_multiplier,
    )
    
    # Get historical stats
    historical = get_historical_stats_for_location(
        corridor=req.corridor,
        event_cause=req.event_cause,
    )
    
    # Compute resource recommendation
    resources = compute_resource_recommendation(
        ecrs_score=ecrs_result["score"],
        corridor=req.corridor,
        requires_road_closure=req.requires_road_closure,
        gravity_score=gravity_score,
        calendar_multiplier=calendar_multiplier,
    )
    
    return {
        "ecrs": ecrs_result,
        "gravity": {
            "score": gravity_score,
            "nearby_pois": nearby_pois,
        },
        "calendar": calendar_info,
        "historical": historical,
        "resources": resources,
        "input": {
            "event_type": req.event_type,
            "event_cause": req.event_cause,
            "corridor": req.corridor,
            "requires_road_closure": req.requires_road_closure,
        },
    }
