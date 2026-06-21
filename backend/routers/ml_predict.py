"""
ML Predict Router — CREST prediction endpoints.
Loads trained XGBoost models + encoders once at startup.
"""

import os
import math
import joblib
import numpy as np
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["ml"])

# ── Paths ──────────────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_model")

# ── Lazy-loaded singletons ─────────────────────────────────────────────────
_models = {}


def _load_models():
    """Load all .pkl files once."""
    if _models:
        return
    _models["resolution"] = joblib.load(os.path.join(MODEL_DIR, "resolution_model.pkl"))
    _models["closure"] = joblib.load(os.path.join(MODEL_DIR, "closure_model.pkl"))
    _models["encoders"] = joblib.load(os.path.join(MODEL_DIR, "encoders.pkl"))
    _models["agg"] = joblib.load(os.path.join(MODEL_DIR, "agg_info.pkl"))
    print(f"  ML models loaded from {MODEL_DIR}")


# ── Request schema ─────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    event_cause: str = "others"
    corridor: str = "Non-corridor"
    hour: int = 12
    day_of_week: int = 0
    month: int = 6
    event_type: str = "unplanned"
    zone: str = ""
    police_station: str = ""
    veh_type: str = ""
    has_junction: bool = False
    is_heavy_veh: bool = False
    description: str = ""


# ── Helpers ────────────────────────────────────────────────────────────────

CAUSE_WEIGHTS = {
    "vip_movement": 9, "protest": 9,
    "public_event": 8,
    "procession": 7, "construction": 7, "accident": 7,
    "tree_fall": 6, "water_logging": 6, "debris": 6, "Debris": 6,
    "Fog / Low Visibility": 6, "fog": 6,
    "pot_holes": 5, "road_conditions": 5, "congestion": 5,
    "vehicle_breakdown": 4,
    "others": 3, "test_demo": 3,
}

PEAK_HOURS = {8, 9, 10, 17, 18, 19, 20}

MANPOWER_TABLE = {
    # (event_cause, priority) → (base_personnel, barricades, notes)
    ("accident", "High"):           (8,  5, "Ambulance coordination + traffic mgmt"),
    ("accident", "Low"):            (4,  2, "Standard accident response"),
    ("vip_movement", "High"):       (14, 10, "Full VIP corridor lockdown"),
    ("vip_movement", "Low"):        (6,  4, "VIP escort with minimal disruption"),
    ("public_event", "High"):       (12, 8, "Crowd control + barricading + diversion"),
    ("public_event", "Low"):        (5,  3, "Event monitoring with standby"),
    ("procession", "High"):         (10, 7, "Route clearance + crowd management"),
    ("procession", "Low"):          (5,  3, "Route monitoring + standby"),
    ("construction", "High"):       (6,  6, "Lane closure management + signage"),
    ("construction", "Low"):        (3,  2, "Monitoring + advisory signage"),
    ("protest", "High"):            (12, 8, "Crowd control + riot standby + barricading"),
    ("protest", "Low"):             (5,  3, "Monitoring with rapid response standby"),
    ("tree_fall", "High"):          (6,  4, "Road clearance + diversion"),
    ("tree_fall", "Low"):           (3,  2, "Clearance with traffic advisory"),
    ("water_logging", "High"):      (6,  4, "Flood management + diversion"),
    ("water_logging", "Low"):       (3,  2, "Water pumping + traffic advisory"),
    ("vehicle_breakdown", "High"):  (4,  2, "Tow + traffic management"),
    ("vehicle_breakdown", "Low"):   (2,  1, "Standard tow assistance"),
    ("congestion", "High"):         (6,  3, "Signal override + manual control"),
    ("congestion", "Low"):          (3,  1, "Monitoring + advisory"),
    ("pot_holes", "High"):          (4,  3, "Emergency repair + diversion"),
    ("pot_holes", "Low"):           (2,  1, "Warning signage + advisory"),
    ("road_conditions", "High"):    (4,  3, "Road repair coordination"),
    ("road_conditions", "Low"):     (2,  1, "Advisory signage"),
    ("debris", "High"):             (4,  3, "Clearance + diversion"),
    ("debris", "Low"):              (2,  1, "Clearance crew"),
    ("Debris", "High"):             (4,  3, "Clearance + diversion"),
    ("Debris", "Low"):              (2,  1, "Clearance crew"),
    ("others", "High"):             (4,  2, "General response team"),
    ("others", "Low"):              (2,  1, "Standard patrol"),
}

DIVERSION_ROUTES = {
    "Mysore Road":      ["Kanakapura Road via Rajarajeshwari Nagar", "Magadi Road via Chord Road"],
    "Bellary Road 1":   ["Hebbal Flyover via ORR", "Tumkur Road via Yeshwanthpura"],
    "Bellary Road 2":   ["Palace Road via Sadashivanagar", "Sankey Road via Malleswaram"],
    "Tumkur Road":      ["Magadi Road via Rajajinagar", "ORR North via Yeshwanthpura"],
    "Hosur Road":       ["Sarjapur Road", "Kanakapura Road via Electronic City"],
    "ORR North 1":      ["Bellary Road via Hebbal", "Tumkur Road via Yeshwanthpura"],
    "ORR North 2":      ["Bellary Road via Hebbal", "Old Madras Road via KR Puram"],
    "ORR East 1":       ["Old Madras Road via KR Puram", "Sarjapur Road via Marathahalli"],
    "ORR East 2":       ["Sarjapur Road via Bellandur", "Hosur Road via Silk Board"],
    "Old Madras Road":  ["ORR East via KR Puram", "Airport Road via Indiranagar"],
    "Magadi Road":      ["Mysore Road via Chord Road", "Tumkur Road via Rajajinagar"],
    "Non-corridor":     ["Use adjacent arterial roads", "Follow real-time traffic advisory"],
}

# Corridor center coordinates (Bengaluru)
CORRIDOR_COORDS = {
    "Mysore Road":      {"lat": 12.9516, "lng": 77.5185},
    "Bellary Road 1":   {"lat": 13.0067, "lng": 77.5761},
    "Bellary Road 2":   {"lat": 12.9900, "lng": 77.5800},
    "Tumkur Road":      {"lat": 13.0200, "lng": 77.5100},
    "Hosur Road":       {"lat": 12.9000, "lng": 77.6300},
    "ORR North 1":      {"lat": 13.0300, "lng": 77.5500},
    "ORR North 2":      {"lat": 13.0350, "lng": 77.6000},
    "ORR East 1":       {"lat": 12.9600, "lng": 77.6900},
    "ORR East 2":       {"lat": 12.9200, "lng": 77.6700},
    "Old Madras Road":  {"lat": 12.9900, "lng": 77.6500},
    "Magadi Road":      {"lat": 12.9600, "lng": 77.5000},
    "Non-corridor":     {"lat": 12.9716, "lng": 77.5946},
}

# Corridor adjacency graph for cascade impact
CORRIDOR_ADJACENCY = {
    "Mysore Road":      ["Magadi Road", "ORR East 2"],
    "Bellary Road 1":   ["Bellary Road 2", "Tumkur Road", "ORR North 1"],
    "Bellary Road 2":   ["Bellary Road 1", "ORR North 2"],
    "Tumkur Road":      ["Bellary Road 1", "Magadi Road", "ORR North 1"],
    "Hosur Road":       ["ORR East 2", "Old Madras Road"],
    "ORR North 1":      ["Bellary Road 1", "Tumkur Road", "ORR North 2"],
    "ORR North 2":      ["ORR North 1", "Bellary Road 2", "ORR East 1"],
    "ORR East 1":       ["ORR North 2", "Old Madras Road", "ORR East 2"],
    "ORR East 2":       ["ORR East 1", "Hosur Road", "Mysore Road"],
    "Old Madras Road":  ["ORR East 1", "Hosur Road"],
    "Magadi Road":      ["Mysore Road", "Tumkur Road"],
    "Non-corridor":     [],
}


def _safe_encode(encoders, col, value):
    """Encode with fallback to 0 for unseen labels."""
    if col not in encoders or not value:
        return 0
    try:
        return int(encoders[col].transform([value])[0])
    except (ValueError, KeyError):
        return 0


def _build_features(req: PredictRequest, encoders: dict, agg: dict) -> np.ndarray:
    """Build the 26-feature vector in exact training order."""
    TWO_PI = 2 * math.pi

    # Categorical encodings
    event_cause_enc = _safe_encode(encoders, "event_cause", req.event_cause)
    event_type_enc = _safe_encode(encoders, "event_type", req.event_type)
    corridor_enc = _safe_encode(encoders, "corridor", req.corridor)
    zone_enc = _safe_encode(encoders, "zone", req.zone)
    police_station_enc = _safe_encode(encoders, "police_station", req.police_station)
    veh_type_enc = _safe_encode(encoders, "veh_type", req.veh_type)

    # Time features
    hour = req.hour
    dow = req.day_of_week
    month = req.month
    quarter = (month - 1) // 3 + 1
    is_weekend = 1 if dow >= 5 else 0
    is_peak = 1 if hour in PEAK_HOURS else 0

    # Time bucket: 0=night(0-5), 1=morning(6-11), 2=afternoon(12-16), 3=evening(17-23)
    if hour < 6:
        time_bucket = 0
    elif hour < 12:
        time_bucket = 1
    elif hour < 17:
        time_bucket = 2
    else:
        time_bucket = 3

    # Cyclical encoding
    hour_sin = math.sin(TWO_PI * hour / 24)
    hour_cos = math.cos(TWO_PI * hour / 24)
    dow_sin = math.sin(TWO_PI * dow / 7)
    dow_cos = math.cos(TWO_PI * dow / 7)
    month_sin = math.sin(TWO_PI * month / 12)
    month_cos = math.cos(TWO_PI * month / 12)

    # Boolean features
    has_junction = 1 if req.has_junction else 0
    has_segment = 1 if req.corridor and req.corridor != "Non-corridor" else 0
    is_heavy_veh = 1 if req.is_heavy_veh else 0
    is_planned = 1 if req.event_type == "planned" else 0

    # Description length
    desc_length = len(req.description) if req.description else 0

    # Aggregated features
    corr_rate = agg.get("corr_rate", {})
    cause_med = agg.get("cause_med", {})
    default_corr = agg.get("default_corr", 0.08)
    default_sev = agg.get("default_sev", 42.0)

    try:
        corridor_closure_rate = float(corr_rate.get(req.corridor, corr_rate[req.corridor]) if req.corridor in corr_rate else default_corr)
    except (KeyError, TypeError):
        corridor_closure_rate = float(default_corr)

    try:
        cause_severity_score = float(np.log1p(cause_med.get(req.event_cause, cause_med[req.event_cause]) if req.event_cause in cause_med else default_sev))
    except (KeyError, TypeError):
        cause_severity_score = float(np.log1p(default_sev))

    cause_corridor_interact = event_cause_enc * 100 + corridor_enc

    # Build array in exact order
    features = np.array([[
        event_cause_enc, event_type_enc, corridor_enc, zone_enc,
        police_station_enc, veh_type_enc,
        hour, dow, month, quarter,
        is_weekend, is_peak, time_bucket,
        hour_sin, hour_cos, dow_sin, dow_cos,
        month_sin, month_cos,
        has_junction, has_segment, is_heavy_veh, is_planned,
        desc_length,
        corridor_closure_rate, cause_severity_score,
        cause_corridor_interact,
    ]], dtype=np.float64)

    return features


def _compute_severity(req: PredictRequest, closure: bool, resolution_min: float) -> float:
    """Weighted severity score on 1-10 scale."""
    # Cause weight (35%)
    cw = CAUSE_WEIGHTS.get(req.event_cause, 3)

    # Time weight (15%)
    if req.hour in PEAK_HOURS:
        tw = 9
    elif 6 <= req.hour <= 21:
        tw = 6
    else:
        tw = 3

    # Closure weight (20%)
    cl = 10 if closure else 2

    # Resolution weight (15%)
    if resolution_min > 240:
        rw = 10
    elif resolution_min > 120:
        rw = 7
    elif resolution_min > 60:
        rw = 5
    else:
        rw = 3

    # Corridor weight (10%)
    corrw = 6 if req.corridor and req.corridor != "Non-corridor" else 2

    # Weekend weight (5%)
    ww = 4 if req.day_of_week >= 5 else 6

    severity = (
        0.35 * cw +
        0.15 * tw +
        0.20 * cl +
        0.15 * rw +
        0.10 * corrw +
        0.05 * ww
    )
    return round(max(1.0, min(10.0, severity)), 1)


def _get_severity_label(score: float) -> str:
    if score >= 8:
        return "CRITICAL"
    if score >= 6:
        return "HIGH"
    if score >= 4:
        return "MODERATE"
    return "LOW"


def _get_manpower(event_cause: str, priority: str, severity: float, hour: int):
    """Compute personnel + barricades with scaling."""
    key = (event_cause, priority)
    base_p, base_b, notes = MANPOWER_TABLE.get(key, MANPOWER_TABLE.get(("others", priority), (3, 2, "General response")))

    scale = severity / 5.0
    if hour in PEAK_HOURS:
        time_mult = 1.25
    elif hour < 6 or hour > 22:
        time_mult = 0.7
    else:
        time_mult = 1.0

    personnel = max(2, round(base_p * scale * time_mult))
    barricades = max(1, round(base_b * scale * time_mult))

    return personnel, barricades, notes


def _explain_prediction(req: PredictRequest, severity_score: float, closure: bool,
                        resolution_min: float, personnel: int) -> list:
    """Generate human-readable explanation of prediction factors."""
    factors = []

    # Cause impact
    cw = CAUSE_WEIGHTS.get(req.event_cause, 3)
    cause_label = req.event_cause.replace("_", " ").title()
    if cw >= 8:
        factors.append({"factor": "Event Cause", "value": cause_label,
                        "impact": "high", "direction": "up",
                        "description": f"{cause_label} is a high-impact event type (weight {cw}/10)"})
    elif cw >= 6:
        factors.append({"factor": "Event Cause", "value": cause_label,
                        "impact": "medium", "direction": "up",
                        "description": f"{cause_label} has moderate severity impact (weight {cw}/10)"})
    else:
        factors.append({"factor": "Event Cause", "value": cause_label,
                        "impact": "low", "direction": "down",
                        "description": f"{cause_label} typically has lower severity (weight {cw}/10)"})

    # Peak hour
    if req.hour in PEAK_HOURS:
        factors.append({"factor": "Peak Hour", "value": f"{req.hour}:00",
                        "impact": "high", "direction": "up",
                        "description": "Peak traffic hour — 25% more personnel needed, longer resolution"})
    elif 6 <= req.hour <= 21:
        factors.append({"factor": "Time of Day", "value": f"{req.hour}:00",
                        "impact": "medium", "direction": "neutral",
                        "description": "Standard traffic hours — normal resource levels"})
    else:
        factors.append({"factor": "Off-Peak Hour", "value": f"{req.hour}:00",
                        "impact": "low", "direction": "down",
                        "description": "Low traffic period — reduced congestion risk"})

    # Corridor
    if req.corridor and req.corridor != "Non-corridor":
        factors.append({"factor": "Major Corridor", "value": req.corridor,
                        "impact": "high", "direction": "up",
                        "description": f"{req.corridor} is a major arterial — higher traffic volume and cascade risk"})
    else:
        factors.append({"factor": "Non-Corridor", "value": "Local road",
                        "impact": "low", "direction": "down",
                        "description": "Non-corridor location — limited traffic impact radius"})

    # Weekend
    if req.day_of_week >= 5:
        factors.append({"factor": "Weekend", "value": "Saturday" if req.day_of_week == 5 else "Sunday",
                        "impact": "low", "direction": "down",
                        "description": "Weekend traffic is typically 20-30% lighter"})
    else:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        factors.append({"factor": "Weekday", "value": days[req.day_of_week],
                        "impact": "medium", "direction": "up",
                        "description": "Weekday commuter traffic increases congestion"})

    # Event type
    if req.event_type == "planned":
        factors.append({"factor": "Planned Event", "value": "Pre-scheduled",
                        "impact": "low", "direction": "down",
                        "description": "Planned events allow pre-positioning of resources"})
    else:
        factors.append({"factor": "Unplanned Event", "value": "Sudden occurrence",
                        "impact": "medium", "direction": "up",
                        "description": "Unplanned incidents require reactive deployment"})

    # Heavy vehicle
    if req.is_heavy_veh:
        factors.append({"factor": "Heavy Vehicle", "value": "Yes",
                        "impact": "medium", "direction": "up",
                        "description": "Heavy vehicles block more road space and take longer to clear"})

    # Junction
    if req.has_junction:
        factors.append({"factor": "Junction Location", "value": "Yes",
                        "impact": "medium", "direction": "up",
                        "description": "Junction incidents affect multiple traffic streams"})

    # Monsoon months
    if req.month in (6, 7, 8, 9):
        factors.append({"factor": "Monsoon Season", "value": f"Month {req.month}",
                        "impact": "medium", "direction": "up",
                        "description": "Monsoon season increases water-logging and accident risk"})

    # Sort by impact severity
    impact_order = {"high": 0, "medium": 1, "low": 2}
    factors.sort(key=lambda f: impact_order.get(f["impact"], 3))

    return factors


def _compute_impact_zone(req: PredictRequest, severity: float, closure: bool) -> dict:
    """Compute the geographic impact zone for the incident."""
    coords = CORRIDOR_COORDS.get(req.corridor, CORRIDOR_COORDS["Non-corridor"])

    # Base radius in km: 0.5 to 5 km based on severity
    base_radius = 0.5 + (severity / 10.0) * 4.5
    if closure:
        base_radius *= 1.5
    if req.hour in PEAK_HOURS:
        base_radius *= 1.3

    # Find affected adjacent corridors
    affected = CORRIDOR_ADJACENCY.get(req.corridor, [])
    if severity < 5:
        affected = affected[:1]  # Only immediate neighbor for low severity

    return {
        "center_lat": coords["lat"],
        "center_lng": coords["lng"],
        "radius_km": round(base_radius, 1),
        "affected_corridors": affected,
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/predict")
def predict(req: PredictRequest):
    """ML-powered traffic event prediction."""
    _load_models()

    encoders = _models["encoders"]
    agg = _models["agg"]
    resolution_model = _models["resolution"]
    closure_model = _models["closure"]
    closure_threshold = float(agg.get("closure_threshold", 0.5))

    # Build feature vector
    X = _build_features(req, encoders, agg)

    # Predict resolution time (log-transformed target → expm1)
    resolution_log = resolution_model.predict(X)[0]
    resolution_minutes = round(float(np.expm1(resolution_log)), 1)
    resolution_minutes = max(1.0, resolution_minutes)  # floor at 1 min

    # Predict closure
    closure_proba = float(closure_model.predict_proba(X)[0][1])
    closure_predicted = bool(closure_proba >= closure_threshold)

    # Severity
    severity_score = _compute_severity(req, closure_predicted, resolution_minutes)
    severity_label = _get_severity_label(severity_score)

    # Priority — deterministic from training
    priority = "High" if req.corridor and req.corridor != "Non-corridor" else "Low"

    # Manpower
    personnel, barricades, deploy_notes = _get_manpower(
        req.event_cause, priority, severity_score, req.hour,
    )

    # Diversion routes
    diversion = DIVERSION_ROUTES.get(
        req.corridor,
        DIVERSION_ROUTES["Non-corridor"],
    )

    # Explainability
    explanation = _explain_prediction(
        req, severity_score, closure_predicted, resolution_minutes, personnel,
    )

    # Impact zone
    impact_zone = _compute_impact_zone(req, severity_score, closure_predicted)

    return {
        "resolution_minutes": float(resolution_minutes),
        "closure_predicted": closure_predicted,
        "closure_probability": round(closure_proba, 2),
        "severity_score": float(severity_score),
        "severity_label": severity_label,
        "priority": priority,
        "personnel": int(personnel),
        "barricades": int(barricades),
        "deployment_notes": deploy_notes,
        "diversion_routes": diversion,
        "explanation": explanation,
        "impact_zone": impact_zone,
    }


@router.get("/analytics")
def analytics():
    """Hardcoded training-EDA summary."""
    return {
        "total_events": 8173,
        "median_resolution_min": 42,
        "closure_rate_pct": 8,
        "model_accuracy_pct": 88,
        "cause_distribution": [
            {"cause": "Vehicle Breakdown", "count": 2850},
            {"cause": "Congestion", "count": 1640},
            {"cause": "Construction", "count": 980},
            {"cause": "Accident", "count": 720},
            {"cause": "Others", "count": 590},
            {"cause": "Public Event", "count": 410},
        ],
        "peak_hours": [8, 9, 10, 17, 18, 19, 20],
        "model_metrics": {
            "accuracy": 0.88,
            "pr_auc": 0.72,
            "f1": 0.61,
            "recall": 0.58,
            "precision": 0.65,
        },
    }
