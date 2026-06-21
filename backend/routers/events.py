"""
Events Router — Event Calendar & Multi-Event Conflict Detection.
Manages planned events and detects overlapping risk scenarios.
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter
from pydantic import BaseModel

from routers.ml_predict import (
    PredictRequest, predict as run_predict,
    CORRIDOR_ADJACENCY, CORRIDOR_COORDS, CAUSE_WEIGHTS,
)

router = APIRouter(prefix="/api", tags=["events"])

EVENTS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "events_data.json")


def _load_events() -> list:
    if os.path.exists(EVENTS_FILE):
        with open(EVENTS_FILE, "r") as f:
            return json.load(f)
    return []


def _save_events(data: list):
    with open(EVENTS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


class PlannedEvent(BaseModel):
    name: str
    event_cause: str = "public_event"
    corridor: str = "Non-corridor"
    date: str  # YYYY-MM-DD
    start_hour: int = 9
    duration_hours: int = 3
    expected_crowd: Optional[int] = None
    notes: str = ""


class ConflictCheckRequest(BaseModel):
    corridor: str = "Non-corridor"
    date: str  # YYYY-MM-DD
    start_hour: int = 9
    duration_hours: int = 3
    event_cause: str = "public_event"


@router.post("/events")
def create_event(req: PlannedEvent):
    """Register a planned event."""
    events = _load_events()

    # Run prediction for this event
    pred_req = PredictRequest(
        event_cause=req.event_cause,
        corridor=req.corridor,
        hour=req.start_hour,
        event_type="planned",
    )
    prediction = run_predict(pred_req)

    event = {
        "id": str(uuid.uuid4())[:8],
        "name": req.name,
        "event_cause": req.event_cause,
        "corridor": req.corridor,
        "date": req.date,
        "start_hour": req.start_hour,
        "end_hour": req.start_hour + req.duration_hours,
        "duration_hours": req.duration_hours,
        "expected_crowd": req.expected_crowd,
        "notes": req.notes,
        "created_at": datetime.now().isoformat(),
        "predicted_severity": prediction["severity_score"],
        "predicted_resolution": prediction["resolution_minutes"],
        "predicted_closure": prediction["closure_predicted"],
    }

    events.append(event)
    _save_events(events)

    # Check for conflicts with existing events
    conflicts = _find_conflicts(event, events)

    return {"event": event, "conflicts": conflicts}


@router.get("/events")
def list_events(date: Optional[str] = None):
    """List all planned events, optionally filtered by date."""
    events = _load_events()

    if date:
        events = [e for e in events if e["date"] == date]

    # Sort by date then start_hour
    events.sort(key=lambda e: (e["date"], e["start_hour"]))

    return {"events": events, "total": len(events)}


@router.delete("/events/{event_id}")
def delete_event(event_id: str):
    """Delete a planned event."""
    events = _load_events()
    events = [e for e in events if e["id"] != event_id]
    _save_events(events)
    return {"status": "deleted"}


@router.post("/events/check-conflicts")
def check_conflicts(req: ConflictCheckRequest):
    """Check for conflicts with existing events."""
    events = _load_events()

    probe = {
        "corridor": req.corridor,
        "date": req.date,
        "start_hour": req.start_hour,
        "end_hour": req.start_hour + req.duration_hours,
        "event_cause": req.event_cause,
    }

    conflicts = _find_conflicts(probe, events)

    # Run prediction for the proposed event
    pred_req = PredictRequest(
        event_cause=req.event_cause,
        corridor=req.corridor,
        hour=req.start_hour,
        event_type="planned",
    )
    prediction = run_predict(pred_req)

    # Compute compound severity if conflicts exist
    if conflicts:
        combined_severity = prediction["severity_score"]
        for c in conflicts:
            # Compound effect: not additive, uses a scaling factor
            combined_severity += c["conflicting_event"]["predicted_severity"] * 0.6
        combined_severity = min(10.0, round(combined_severity, 1))

        compound_info = {
            "individual_severity": prediction["severity_score"],
            "compound_severity": combined_severity,
            "escalation_factor": round(combined_severity / max(prediction["severity_score"], 0.1), 2),
            "recommendation": _get_compound_recommendation(combined_severity, len(conflicts)),
        }
    else:
        compound_info = None

    # Suggest optimal time slots
    suggested_slots = _find_optimal_slots(req, events)

    return {
        "conflicts": conflicts,
        "prediction": prediction,
        "compound_risk": compound_info,
        "suggested_slots": suggested_slots,
    }


def _find_conflicts(probe: dict, events: list) -> list:
    """Find events that conflict with the probe event."""
    conflicts = []
    probe_start = probe.get("start_hour", 0)
    probe_end = probe.get("end_hour", probe_start + 3)
    probe_date = probe.get("date", "")
    probe_corridor = probe.get("corridor", "Non-corridor")
    probe_id = probe.get("id", "")

    # Get adjacent corridors for cascade check
    adjacent = set(CORRIDOR_ADJACENCY.get(probe_corridor, []))

    for event in events:
        if event.get("id") == probe_id:
            continue  # Skip self

        if event["date"] != probe_date:
            continue

        # Time overlap check
        event_start = event["start_hour"]
        event_end = event.get("end_hour", event_start + event.get("duration_hours", 3))

        time_overlap = event_start < probe_end and event_end > probe_start
        if not time_overlap:
            continue

        # Determine conflict type
        if event["corridor"] == probe_corridor:
            conflict_type = "direct"
            severity = "critical"
            message = f"Same corridor ({probe_corridor}) — direct traffic conflict"
        elif event["corridor"] in adjacent:
            conflict_type = "adjacent"
            severity = "high"
            message = f"Adjacent corridor ({event['corridor']}) — cascade risk"
        elif probe_corridor == "Non-corridor" or event["corridor"] == "Non-corridor":
            conflict_type = "temporal"
            severity = "moderate"
            message = "Same time window — citywide resource strain"
        else:
            continue  # No meaningful conflict

        conflicts.append({
            "conflict_type": conflict_type,
            "severity": severity,
            "message": message,
            "conflicting_event": event,
            "overlap_hours": min(probe_end, event_end) - max(probe_start, event_start),
        })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "moderate": 2}
    conflicts.sort(key=lambda c: severity_order.get(c["severity"], 3))

    return conflicts


def _get_compound_recommendation(compound_severity: float, num_conflicts: int) -> str:
    if compound_severity >= 8:
        return (f"CRITICAL: {num_conflicts} overlapping events push compound severity to {compound_severity}/10. "
                "Strongly recommend rescheduling or deploying 2x normal resources.")
    elif compound_severity >= 6:
        return (f"HIGH RISK: Compound severity {compound_severity}/10 with {num_conflicts} concurrent events. "
                "Deploy additional backup teams and activate secondary diversion routes.")
    else:
        return (f"MODERATE: Compound severity {compound_severity}/10. "
                "Standard deployment with monitoring should suffice.")


def _find_optimal_slots(req: ConflictCheckRequest, events: list) -> list:
    """Suggest time slots with minimal conflicts."""
    slots = []
    for hour in range(6, 22):
        probe = {
            "corridor": req.corridor,
            "date": req.date,
            "start_hour": hour,
            "end_hour": hour + req.duration_hours,
            "event_cause": req.event_cause,
        }
        conflicts = _find_conflicts(probe, events)
        cw = CAUSE_WEIGHTS.get(req.event_cause, 3)
        # Penalty for peak hours
        peak_penalty = 2 if hour in {8, 9, 10, 17, 18, 19, 20} else 0

        slots.append({
            "start_hour": hour,
            "end_hour": hour + req.duration_hours,
            "num_conflicts": len(conflicts),
            "risk_score": len(conflicts) * 3 + peak_penalty,
            "label": f"{hour:02d}:00 – {hour + req.duration_hours:02d}:00",
        })

    # Sort by risk score and return top 3 best
    slots.sort(key=lambda s: s["risk_score"])
    return slots[:3]
