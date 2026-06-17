"""
LLM Advisor Router — Claude-powered operational recommendation endpoint.
"""

from fastapi import APIRouter
from models import RecommendRequest
from services.llm_service import build_incident_brief, get_llm_recommendation
from services.ecrs_engine import compute_resource_recommendation

router = APIRouter(prefix="/api", tags=["llm"])


@router.post("/recommend")
async def get_recommendation(req: RecommendRequest):
    """
    Generate AI-powered operational recommendations for an incident.
    Uses Claude API if available, falls back to template-based response.
    """
    # Build the incident brief
    brief = build_incident_brief(
        event_type=req.event_type,
        cause=req.cause,
        address=req.address,
        datetime_str=req.datetime,
        priority=req.priority,
        ecrs_score=req.ecrs_score,
        gravity_score=req.gravity_score,
        nearby_pois=req.nearby_pois,
        calendar_event=req.calendar_event,
        cascade_alerts=req.cascade_alerts,
        avg_duration=req.avg_duration,
        corridor=req.corridor,
        zone=req.zone,
    )
    
    # Get LLM recommendation
    llm_result = await get_llm_recommendation(brief)
    
    # Also compute resource recommendation
    resources = compute_resource_recommendation(
        ecrs_score=req.ecrs_score,
        corridor=req.corridor,
        requires_road_closure=False,
        gravity_score=req.gravity_score,
    )
    
    return {
        **llm_result,
        "resources": resources,
        "incident_brief": brief,
    }
