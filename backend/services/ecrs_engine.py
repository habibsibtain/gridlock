"""
ECRS Engine — Event-Congestion Risk Score Calculator
Computes risk scores on a 1-10 scale for traffic incidents.
"""

import math
from typing import Optional

# Base severity scores by event cause
BASE_SEVERITY = {
    "vehicle_breakdown": 1,
    "accident": 3,
    "construction": 2,
    "water_logging": 2,
    "pot_holes": 1,
    "tree_fall": 2,
    "public_event": 4,
    "procession": 5,
    "vip_movement": 3,
    "protest": 4,
    "congestion": 2,
    "road_conditions": 1,
    "others": 1,
    "Debris": 1,
    "debris": 1,
    "test_demo": 0,
    "Fog / Low Visibility": 2,
}

# High-traffic corridors get a multiplier
HIGH_TRAFFIC_CORRIDORS = {
    "Mysore Road", "Bellary Road 1", "Bellary Road 2",
    "Tumkur Road", "ORR North 1", "ORR North 2",
    "ORR East 1", "ORR East 2", "Hosur Road",
    "Old Madras Road"
}

# ECRS label mapping
ECRS_LABELS = [
    (3, "Low Risk", "green"),
    (5, "Moderate", "yellow"),
    (7, "High", "orange"),
    (9, "Critical", "red"),
    (10, "Extreme", "flashing_red"),
]


def get_corridor_weight(corridor: Optional[str]) -> float:
    """High-traffic corridors get a 1.5x multiplier."""
    if corridor and corridor in HIGH_TRAFFIC_CORRIDORS:
        return 1.5
    return 1.0


def get_time_multiplier(hour: Optional[int]) -> float:
    """Peak hours (7-10 AM, 5-9 PM) get a 1.8x multiplier."""
    if hour is None:
        return 1.0
    if 7 <= hour <= 10 or 17 <= hour <= 21:
        return 1.8
    return 1.0


def compute_base_ecrs(
    event_cause: str,
    corridor: Optional[str] = None,
    hour_of_day: Optional[int] = None,
    requires_road_closure: bool = False,
) -> float:
    """
    Compute the base ECRS score before gravity/calendar adjustments.
    Returns a raw score (not yet capped at 10).
    """
    severity = BASE_SEVERITY.get(event_cause, 1)
    corridor_w = get_corridor_weight(corridor)
    time_mult = get_time_multiplier(hour_of_day)
    closure_flag = 1.3 if requires_road_closure else 1.0

    raw = severity * corridor_w * time_mult * closure_flag
    return raw


def normalize_ecrs(raw_score: float) -> float:
    """
    Normalize raw ECRS to a 1-10 scale.
    The max theoretical raw score is: 5 * 1.5 * 1.8 * 1.3 = 17.55
    We use a log-scaling approach to spread values nicely on 1-10.
    """
    # Max raw score: procession (5) * high_traffic (1.5) * peak (1.8) * closure (1.3) = 17.55
    max_raw = 17.55
    if raw_score <= 0:
        return 1.0
    # Scale linearly but apply slight compression for higher values
    normalized = (raw_score / max_raw) * 10.0
    return max(1.0, min(10.0, round(normalized, 1)))


def apply_gravity(ecrs: float, gravity_score: float) -> float:
    """Apply POI gravity augmentation: final = base * (1 + 0.5 * gravity)."""
    augmented = ecrs * (1 + 0.5 * gravity_score)
    return max(1.0, min(10.0, round(augmented, 1)))


def apply_calendar(ecrs: float, calendar_multiplier: float) -> float:
    """Apply calendar event multiplier."""
    adjusted = ecrs * calendar_multiplier
    return max(1.0, min(10.0, round(adjusted, 1)))


def compute_full_ecrs(
    event_cause: str,
    corridor: Optional[str] = None,
    hour_of_day: Optional[int] = None,
    requires_road_closure: bool = False,
    gravity_score: float = 0.0,
    calendar_multiplier: float = 1.0,
) -> dict:
    """
    Compute the full ECRS with all augmentations.
    Returns dict with score, label, color, and component breakdown.
    """
    raw = compute_base_ecrs(event_cause, corridor, hour_of_day, requires_road_closure)
    base_normalized = normalize_ecrs(raw)

    # Apply gravity
    after_gravity = apply_gravity(base_normalized, gravity_score)

    # Apply calendar
    final = apply_calendar(after_gravity, calendar_multiplier)

    # Get label and color
    label = "Extreme"
    color = "flashing_red"
    for threshold, lbl, clr in ECRS_LABELS:
        if final <= threshold:
            label = lbl
            color = clr
            break

    return {
        "score": final,
        "raw_score": round(raw, 2),
        "label": label,
        "color": color,
        "components": {
            "base_severity": BASE_SEVERITY.get(event_cause, 1),
            "corridor_weight": get_corridor_weight(corridor),
            "time_multiplier": get_time_multiplier(hour_of_day),
            "closure_flag": 1.3 if requires_road_closure else 1.0,
            "gravity_score": gravity_score,
            "calendar_multiplier": calendar_multiplier,
        }
    }


def compute_resource_recommendation(
    ecrs_score: float,
    corridor: Optional[str] = None,
    requires_road_closure: bool = False,
    gravity_score: float = 0.0,
    calendar_multiplier: float = 1.0,
    cascade_alert_count: int = 0,
) -> dict:
    """
    Compute personnel deployment recommendation.
    Returns deployment count and position breakdown.
    """
    base_count = math.ceil(ecrs_score * 0.8)

    if corridor and corridor in HIGH_TRAFFIC_CORRIDORS:
        base_count += 2
    if requires_road_closure:
        base_count += 3
    if gravity_score > 0.7:
        base_count += 2
    if calendar_multiplier > 1.0:
        base_count = math.ceil(base_count * min(calendar_multiplier, 2.0))
    if cascade_alert_count > 0:
        base_count += cascade_alert_count

    # Generate position breakdown
    positions = []
    remaining = base_count
    
    # At incident point
    incident_officers = min(2, remaining)
    positions.append(f"{incident_officers} at incident point")
    remaining -= incident_officers

    if remaining > 0 and requires_road_closure:
        closure_officers = min(2, remaining)
        positions.append(f"{closure_officers} at road closure points")
        remaining -= closure_officers

    if remaining > 0:
        upstream = min(1, remaining)
        positions.append(f"{upstream} at upstream junction")
        remaining -= upstream

    if remaining > 0:
        diversion = min(1, remaining)
        positions.append(f"{diversion} at diversion point")
        remaining -= diversion

    if remaining > 0 and cascade_alert_count > 0:
        positions.append(f"{remaining} at cascade corridor junctions")
    elif remaining > 0:
        positions.append(f"{remaining} on patrol along corridor")

    return {
        "total_officers": base_count,
        "positions": positions,
        "summary": f"Recommended Deployment: {base_count} officers — " + ", ".join(positions)
    }
