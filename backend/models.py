"""
Pydantic models for API request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class ForecastRequest(BaseModel):
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    event_type: str = "unplanned"
    event_cause: str = "others"
    datetime: str = ""
    expected_crowd_size: Optional[int] = None
    corridor: Optional[str] = None
    requires_road_closure: bool = False


class CascadeRequest(BaseModel):
    blocked_corridor: str
    blocked_percentage: float = Field(ge=0.0, le=1.0, default=0.5)
    datetime: Optional[str] = None
    hour: Optional[int] = None


class RecommendRequest(BaseModel):
    incident_id: Optional[str] = None
    event_type: str = "unplanned"
    cause: str = "others"
    address: str = ""
    datetime: str = ""
    priority: str = "High"
    ecrs_score: float = 5.0
    gravity_score: float = 0.0
    nearby_pois: str = "None"
    calendar_event: Optional[str] = None
    cascade_alerts: str = "None"
    avg_duration: Optional[float] = None
    corridor: Optional[str] = None
    zone: Optional[str] = None


class NewEventRequest(BaseModel):
    name: str
    date: str
    type: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    expected_crowd: Optional[int] = None
    corridor: Optional[str] = None
    zone: Optional[str] = None
