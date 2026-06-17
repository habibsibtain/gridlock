"""
Gravity Model — POI-based spatial traffic pull/push simulation.
Calculates how nearby Points of Interest affect traffic congestion risk.
"""

import json
import math
import os
from datetime import datetime, time
from typing import List, Optional, Tuple

# Load POI data
FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures")

def load_pois() -> list:
    with open(os.path.join(FIXTURES_DIR, "poi_gravity.json"), "r") as f:
        return json.load(f)

POI_LIST = None

def get_pois():
    global POI_LIST
    if POI_LIST is None:
        POI_LIST = load_pois()
    return POI_LIST


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km between two lat/lng points using Haversine formula."""
    R = 6371.0  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def parse_time(time_str: str) -> time:
    """Parse a time string like '08:30' into a time object."""
    parts = time_str.split(":")
    return time(int(parts[0]), int(parts[1]))


def minutes_from_midnight(t: time) -> float:
    """Convert time to minutes from midnight."""
    return t.hour * 60 + t.minute


def gaussian_time_proximity(
    incident_time: time,
    inflow_peak_str: str,
    outflow_peak_str: str,
    sigma_minutes: float = 90.0,
) -> float:
    """
    Compute time proximity using a Gaussian distribution.
    Returns a value between 0 and 1, peaking at the inflow and outflow peak times.
    """
    incident_mins = minutes_from_midnight(incident_time)
    inflow_mins = minutes_from_midnight(parse_time(inflow_peak_str))
    outflow_mins = minutes_from_midnight(parse_time(outflow_peak_str))
    
    # Calculate Gaussian proximity to both peaks
    inflow_proximity = math.exp(-0.5 * ((incident_mins - inflow_mins) / sigma_minutes) ** 2)
    outflow_proximity = math.exp(-0.5 * ((incident_mins - outflow_mins) / sigma_minutes) ** 2)
    
    # Also consider the "active window" between inflow and outflow
    if inflow_mins <= outflow_mins:
        if inflow_mins <= incident_mins <= outflow_mins:
            window_proximity = 0.5  # Some base proximity during active hours
        else:
            window_proximity = 0.0
    else:
        # Handles overnight windows (e.g., 21:00 to 04:00)
        if incident_mins >= inflow_mins or incident_mins <= outflow_mins:
            window_proximity = 0.5
        else:
            window_proximity = 0.0
    
    return max(inflow_proximity, outflow_proximity, window_proximity)


def compute_gravity_score(
    incident_lat: float,
    incident_lng: float,
    incident_time: time,
) -> Tuple[float, List[dict]]:
    """
    Compute the aggregate gravity score for a location at a given time.
    Returns (normalized_score, list_of_contributing_pois).
    """
    pois = get_pois()
    score = 0.0
    contributing_pois = []
    
    for poi in pois:
        distance_km = haversine(incident_lat, incident_lng, poi["lat"], poi["lng"])
        
        if distance_km <= poi["peak_radius_km"]:
            time_proximity = gaussian_time_proximity(
                incident_time, poi["inflow_peak"], poi["outflow_peak"]
            )
            
            # Gravity contribution decays with distance
            distance_factor = 1 - (distance_km / poi["peak_radius_km"])
            gravity_contribution = poi["gravity_strength"] * time_proximity * distance_factor
            
            score += gravity_contribution
            contributing_pois.append({
                "name": poi["name"],
                "type": poi["type"],
                "distance_km": round(distance_km, 2),
                "time_proximity": round(time_proximity, 3),
                "contribution": round(gravity_contribution, 3),
                "is_peak": time_proximity > 0.7,
            })
    
    normalized_score = min(score, 1.0)
    
    return normalized_score, contributing_pois


def get_all_pois_with_status(current_time: Optional[time] = None) -> list:
    """
    Get all POIs with their current activity status.
    Used for map overlay visualization.
    """
    pois = get_pois()
    if current_time is None:
        current_time = datetime.now().time()
    
    result = []
    for poi in pois:
        time_proximity = gaussian_time_proximity(
            current_time, poi["inflow_peak"], poi["outflow_peak"]
        )
        result.append({
            **poi,
            "time_proximity": round(time_proximity, 3),
            "is_active": time_proximity > 0.3,
            "is_peak": time_proximity > 0.7,
            "status": "peak" if time_proximity > 0.7 else ("active" if time_proximity > 0.3 else "dormant"),
        })
    
    return result
