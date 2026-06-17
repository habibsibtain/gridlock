"""
Cascade Router — Graph-based traffic displacement simulation.
Models how blocking a corridor cascades traffic to connected alternatives.
"""

import json
import os
from typing import Optional

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures")

CORRIDOR_GRAPH = None

def load_corridor_graph() -> dict:
    global CORRIDOR_GRAPH
    if CORRIDOR_GRAPH is None:
        with open(os.path.join(FIXTURES_DIR, "corridor_graph.json"), "r") as f:
            CORRIDOR_GRAPH = json.load(f)
    return CORRIDOR_GRAPH


def get_time_load_modifier(hour: Optional[int] = None) -> float:
    """Adjust base load based on time of day."""
    if hour is None:
        return 1.0
    if 7 <= hour <= 10:
        return 1.3  # Morning peak
    elif 17 <= hour <= 21:
        return 1.4  # Evening peak (heavier)
    elif 11 <= hour <= 16:
        return 1.0  # Midday
    else:
        return 0.6  # Night / early morning


def simulate_cascade(
    blocked_corridor: str,
    blocked_percentage: float,
    hour: Optional[int] = None,
) -> dict:
    """
    Simulate the cascading effect of blocking a corridor.
    
    Args:
        blocked_corridor: Name of the blocked corridor
        blocked_percentage: Fraction blocked (0.0 to 1.0)
        hour: Hour of day (0-23) for time-adjusted loads
    
    Returns:
        Dict with blocked info, cascade alerts, and recommended actions
    """
    graph = load_corridor_graph()
    time_modifier = get_time_load_modifier(hour)
    
    if blocked_corridor not in graph:
        return {
            "error": f"Corridor '{blocked_corridor}' not found in graph",
            "available_corridors": list(graph.keys())
        }
    
    blocked_info = graph[blocked_corridor]
    capacity = blocked_info["capacity_pcu"]
    
    # Calculate displaced volume
    current_load = blocked_info["base_load_pct"] * time_modifier / 100.0
    effective_load = current_load * capacity  # PCU currently on the road
    displaced_pcu = int(effective_load * blocked_percentage)
    
    # Find alternative corridors
    connected = blocked_info["connects"]
    
    # Calculate remaining capacity for each alternative
    alternatives = []
    for corridor_name in connected:
        if corridor_name in graph:
            alt_info = graph[corridor_name]
            alt_load_pct = alt_info["base_load_pct"] * time_modifier
            alt_remaining_capacity = alt_info["capacity_pcu"] * (1 - alt_load_pct / 100.0)
            alternatives.append({
                "name": corridor_name,
                "capacity": alt_info["capacity_pcu"],
                "current_load_pct": round(min(alt_load_pct, 100), 1),
                "remaining_capacity": max(0, int(alt_remaining_capacity)),
            })
    
    # Distribute displaced traffic weighted by remaining capacity
    total_remaining = sum(alt["remaining_capacity"] for alt in alternatives)
    
    cascade_alerts = []
    recommended_actions = []
    
    for alt in alternatives:
        if total_remaining > 0:
            share = (alt["remaining_capacity"] / total_remaining) * displaced_pcu
        else:
            share = displaced_pcu / max(len(alternatives), 1)
        
        projected_load = alt["current_load_pct"] + (share / alt["capacity"] * 100)
        projected_load = round(min(projected_load, 100), 1)
        
        # Calculate time to overload (simplified model)
        if projected_load >= 85:
            # Higher projected load = faster overload
            overload_excess = projected_load - 85
            time_to_overload = max(3, int(30 - overload_excess * 1.5))
        else:
            time_to_overload = None
        
        # Determine risk level
        if projected_load >= 95:
            risk = "CRITICAL"
        elif projected_load >= 85:
            risk = "HIGH"
        elif projected_load >= 75:
            risk = "MODERATE"
        else:
            risk = "LOW"
        
        cascade_alerts.append({
            "corridor": alt["name"],
            "current_load_pct": alt["current_load_pct"],
            "projected_load_pct": projected_load,
            "displaced_pcu_share": int(share),
            "time_to_overload_mins": time_to_overload,
            "risk": risk,
        })
        
        # Generate recommended actions for high/critical alerts
        if risk == "CRITICAL":
            recommended_actions.append(
                f"URGENT: Deploy personnel to {alt['name']} junction NOW — projected {projected_load}% capacity"
            )
            recommended_actions.append(
                f"Activate emergency diversion signage on {alt['name']}"
            )
        elif risk == "HIGH":
            recommended_actions.append(
                f"Deploy 2-3 officers to {alt['name']} — projected {projected_load}% capacity in {time_to_overload} mins"
            )
    
    # Sort by risk severity
    risk_order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
    cascade_alerts.sort(key=lambda x: risk_order.get(x["risk"], 4))
    
    if not recommended_actions:
        recommended_actions.append("Monitor situation — no immediate cascade risk detected")
    
    return {
        "blocked": blocked_corridor,
        "blocked_percentage": blocked_percentage,
        "original_capacity_pcu": capacity,
        "displaced_pcu": displaced_pcu,
        "time_modifier": time_modifier,
        "cascade_alerts": cascade_alerts,
        "recommended_actions": recommended_actions,
        "total_corridors_affected": len([a for a in cascade_alerts if a["risk"] in ("HIGH", "CRITICAL")]),
    }


def get_all_corridors() -> list:
    """Get list of all corridors with their info for the dropdown."""
    graph = load_corridor_graph()
    corridors = []
    for name, info in graph.items():
        corridors.append({
            "name": name,
            "capacity_pcu": info["capacity_pcu"],
            "base_load_pct": info["base_load_pct"],
            "connected_to": info["connects"],
            "alternative_for": info.get("alternative_for", []),
        })
    return corridors
