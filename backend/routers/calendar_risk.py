"""
Calendar Risk Router — Festival and event risk scoring endpoints.
"""

from fastapi import APIRouter, Query
from typing import Optional
from services.calendar_intel import get_calendar_risk, get_all_calendar_events, get_monthly_events

router = APIRouter(prefix="/api", tags=["calendar"])


@router.get("/calendar-risk")
def calendar_risk(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    zone: Optional[str] = Query(None, description="Traffic zone"),
):
    """
    Get calendar-based risk assessment for a date and optional zone.
    """
    return get_calendar_risk(date, zone)


@router.get("/calendar-events")
def calendar_events():
    """Get all events in the calendar matrix."""
    events = get_all_calendar_events()
    return {"events": events}


@router.get("/calendar-monthly")
def monthly_events(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
):
    """Get events for a specific month, organized by date."""
    events = get_monthly_events(year, month)
    return {"year": year, "month": month, "events": events}
