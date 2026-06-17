"""
Incidents Router — CRUD + query endpoints for traffic incidents.
"""

from fastapi import APIRouter, Query
from typing import Optional
from database import query_incidents, get_active_incidents, get_hotspots, get_stats, get_incident_by_id

router = APIRouter(prefix="/api", tags=["incidents"])


@router.get("/incidents")
def list_incidents(
    zone: Optional[str] = Query(None),
    cause: Optional[str] = Query(None),
    corridor: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get filtered list of incidents."""
    incidents = query_incidents(
        zone=zone,
        cause=cause,
        corridor=corridor,
        status=status,
        priority=priority,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return {"count": len(incidents), "incidents": incidents}


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    """Get a single incident by ID."""
    incident = get_incident_by_id(incident_id)
    if incident:
        return incident
    return {"error": "Incident not found"}


@router.get("/active")
def list_active():
    """Get currently active incidents."""
    incidents = get_active_incidents()
    return {"count": len(incidents), "incidents": incidents}


@router.get("/hotspots")
def list_hotspots(limit: int = Query(20, ge=1, le=100)):
    """Get top hotspots by incident frequency."""
    hotspots = get_hotspots(limit=limit)
    return {"count": len(hotspots), "hotspots": hotspots}


@router.get("/stats")
def dashboard_stats():
    """Get pre-computed dashboard statistics."""
    return get_stats()
