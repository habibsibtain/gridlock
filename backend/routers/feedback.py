"""
Feedback Router — Post-Event Learning Loop.
Stores predicted vs actual outcomes for model drift tracking.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["feedback"])

# Simple JSON file store
FEEDBACK_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback_data.json")


def _load_feedback() -> list:
    if os.path.exists(FEEDBACK_FILE):
        with open(FEEDBACK_FILE, "r") as f:
            return json.load(f)
    return []


def _save_feedback(data: list):
    with open(FEEDBACK_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


class FeedbackSubmission(BaseModel):
    # Predicted values (from the ML model)
    predicted_resolution_min: float
    predicted_closure: bool
    predicted_severity: float
    predicted_personnel: int
    predicted_barricades: int
    event_cause: str = ""
    corridor: str = ""
    hour: int = 12

    # Actual values (from field officers)
    actual_resolution_min: float
    actual_closure: bool
    actual_personnel: int
    notes: str = ""


@router.post("/feedback")
def submit_feedback(req: FeedbackSubmission):
    """Submit post-event feedback comparing predicted vs actual outcomes."""
    feedback = _load_feedback()

    entry = {
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
        "event_cause": req.event_cause,
        "corridor": req.corridor,
        "hour": req.hour,
        "predicted": {
            "resolution_min": req.predicted_resolution_min,
            "closure": req.predicted_closure,
            "severity": req.predicted_severity,
            "personnel": req.predicted_personnel,
            "barricades": req.predicted_barricades,
        },
        "actual": {
            "resolution_min": req.actual_resolution_min,
            "closure": req.actual_closure,
            "personnel": req.actual_personnel,
        },
        "delta": {
            "resolution_error": round(req.actual_resolution_min - req.predicted_resolution_min, 1),
            "resolution_error_pct": round(
                abs(req.actual_resolution_min - req.predicted_resolution_min)
                / max(req.predicted_resolution_min, 1) * 100, 1
            ),
            "closure_correct": req.actual_closure == req.predicted_closure,
            "personnel_delta": req.actual_personnel - req.predicted_personnel,
        },
        "notes": req.notes,
    }

    feedback.append(entry)
    _save_feedback(feedback)

    return {"status": "saved", "entry": entry}


@router.get("/feedback/history")
def get_feedback_history():
    """Get all feedback entries with predicted vs actual comparisons."""
    feedback = _load_feedback()
    # Return most recent first
    return {"entries": list(reversed(feedback)), "total": len(feedback)}


@router.get("/feedback/stats")
def get_feedback_stats():
    """Compute model drift statistics from feedback data."""
    feedback = _load_feedback()

    if not feedback:
        return {
            "total_entries": 0,
            "avg_resolution_error": 0,
            "avg_resolution_error_pct": 0,
            "closure_accuracy_pct": 0,
            "avg_personnel_delta": 0,
            "trend": [],
            "lessons": [],
        }

    total = len(feedback)
    resolution_errors = [abs(f["delta"]["resolution_error"]) for f in feedback]
    resolution_error_pcts = [f["delta"]["resolution_error_pct"] for f in feedback]
    closure_correct = sum(1 for f in feedback if f["delta"]["closure_correct"])
    personnel_deltas = [f["delta"]["personnel_delta"] for f in feedback]

    # Over/under estimation
    over_estimates = sum(1 for f in feedback if f["delta"]["resolution_error"] < 0)
    under_estimates = sum(1 for f in feedback if f["delta"]["resolution_error"] > 0)

    # Generate trend (last N entries)
    trend = []
    for f in feedback[-20:]:
        trend.append({
            "timestamp": f["timestamp"],
            "resolution_error": f["delta"]["resolution_error"],
            "closure_correct": f["delta"]["closure_correct"],
        })

    # Auto-generate lessons learned
    lessons = []
    avg_err = sum(resolution_errors) / total
    if avg_err > 30:
        lessons.append({
            "type": "warning",
            "message": f"Average resolution time error is {avg_err:.0f} min — model may need retraining",
        })
    if closure_correct / total < 0.7:
        lessons.append({
            "type": "warning",
            "message": f"Closure prediction accuracy is {closure_correct/total*100:.0f}% — below 70% threshold",
        })
    if over_estimates > under_estimates * 2:
        lessons.append({
            "type": "info",
            "message": "Model tends to overestimate resolution time — consider adjusting predictions down",
        })
    elif under_estimates > over_estimates * 2:
        lessons.append({
            "type": "info",
            "message": "Model tends to underestimate resolution time — field teams need more buffer time",
        })
    if avg_err < 15 and closure_correct / total > 0.8:
        lessons.append({
            "type": "success",
            "message": "Model performing well — predictions closely match field outcomes",
        })

    # Per-cause accuracy
    cause_stats = {}
    for f in feedback:
        cause = f.get("event_cause", "unknown")
        if cause not in cause_stats:
            cause_stats[cause] = {"count": 0, "total_error": 0}
        cause_stats[cause]["count"] += 1
        cause_stats[cause]["total_error"] += abs(f["delta"]["resolution_error"])

    cause_accuracy = [
        {"cause": c, "count": s["count"], "avg_error": round(s["total_error"] / s["count"], 1)}
        for c, s in cause_stats.items()
    ]
    cause_accuracy.sort(key=lambda x: x["avg_error"], reverse=True)

    return {
        "total_entries": total,
        "avg_resolution_error": round(avg_err, 1),
        "avg_resolution_error_pct": round(sum(resolution_error_pcts) / total, 1),
        "closure_accuracy_pct": round(closure_correct / total * 100, 1),
        "avg_personnel_delta": round(sum(personnel_deltas) / total, 1),
        "over_estimates": over_estimates,
        "under_estimates": under_estimates,
        "trend": trend,
        "cause_accuracy": cause_accuracy,
        "lessons": lessons,
    }
