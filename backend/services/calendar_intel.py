"""
Calendar Intelligence — Festival and event pattern matching.
Provides baseline switching and traffic multiplier based on cultural calendar.
"""

import json
import os
from datetime import datetime, date
from typing import List, Optional

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures")

CALENDAR_EVENTS = None


def load_calendar() -> list:
    global CALENDAR_EVENTS
    if CALENDAR_EVENTS is None:
        with open(os.path.join(FIXTURES_DIR, "calendar_matrix.json"), "r") as f:
            CALENDAR_EVENTS = json.load(f)
    return CALENDAR_EVENTS


# Baseline descriptions for different event types
BASELINE_CONFIGS = {
    "normal": {
        "name": "Normal Day",
        "description": "Standard traffic patterns. Use historical median ECRS thresholds.",
        "alert_threshold_modifier": 1.0,
        "patrol_modifier": 1.0,
    },
    "diwali": {
        "name": "Diwali Baseline",
        "description": "Elevated commercial zone traffic. Increase patrol recommendations by 40%. Extended shopping hours.",
        "alert_threshold_modifier": 0.7,  # Lower thresholds (more sensitive)
        "patrol_modifier": 1.4,
    },
    "procession_immersion": {
        "name": "Procession Baseline",
        "description": "Treat procession route as dynamic road closure. Activate cascade rerouting. Night operations.",
        "alert_threshold_modifier": 0.5,
        "patrol_modifier": 1.8,
    },
    "ipl": {
        "name": "IPL Match Baseline",
        "description": "Lower alert thresholds for 3km stadium radius. Flag U-turns near Chinnaswamy. Post-match surge plan.",
        "alert_threshold_modifier": 0.6,
        "patrol_modifier": 1.5,
    },
    "public_holiday": {
        "name": "Public Holiday Baseline",
        "description": "Reduced all thresholds. Normal traffic suppressed. Minimal deployment. Monitor for sporadic events only.",
        "alert_threshold_modifier": 1.5,  # Higher thresholds (less sensitive)
        "patrol_modifier": 0.5,
    },
    "state_event": {
        "name": "State Event Baseline",
        "description": "Full VIP security protocol. Maximum road closures. Pre-positioned diversion teams. Commissioner alert level.",
        "alert_threshold_modifier": 0.3,
        "patrol_modifier": 2.5,
    },
    "festival": {
        "name": "Festival Baseline",
        "description": "Moderate traffic increase in commercial areas. Extended evening patrols. Pedestrian zone monitoring.",
        "alert_threshold_modifier": 0.8,
        "patrol_modifier": 1.3,
    },
}


def get_events_for_date(target_date: str) -> list:
    """
    Find all calendar events active on a given date.
    
    Args:
        target_date: ISO date string (YYYY-MM-DD)
    
    Returns:
        List of matching events with baseline config
    """
    events = load_calendar()
    matching = []
    
    for event in events:
        if target_date in event["dates"]:
            baseline_key = event.get("baseline", "normal")
            baseline_config = BASELINE_CONFIGS.get(baseline_key, BASELINE_CONFIGS["normal"])
            
            matching.append({
                **event,
                "baseline_config": baseline_config,
            })
    
    return matching


def get_calendar_risk(target_date: str, zone: Optional[str] = None) -> dict:
    """
    Compute calendar risk for a given date and optional zone.
    
    Returns:
        Dict with active events, combined multiplier, baseline mode, and recommendations
    """
    events = get_events_for_date(target_date)
    
    if not events:
        return {
            "date": target_date,
            "has_events": False,
            "active_events": [],
            "combined_multiplier": 1.0,
            "baseline": "normal",
            "baseline_config": BASELINE_CONFIGS["normal"],
            "affected_zones": [],
            "recommendations": ["Normal operations. Standard deployment."],
        }
    
    # Filter events by zone if specified
    if zone:
        zone_events = []
        for event in events:
            if "all" in event["affected_zones"] or zone in event["affected_zones"]:
                zone_events.append(event)
        relevant_events = zone_events if zone_events else events
    else:
        relevant_events = events
    
    # Use the highest multiplier from all active events
    max_multiplier = max(e["traffic_multiplier"] for e in relevant_events)
    
    # Use the most impactful baseline
    baseline_priority = ["state_event", "procession_immersion", "ipl", "diwali", "festival", "public_holiday", "normal"]
    active_baseline = "normal"
    for priority in baseline_priority:
        for event in relevant_events:
            if event.get("baseline") == priority:
                active_baseline = priority
                break
        if active_baseline != "normal":
            break
    
    baseline_config = BASELINE_CONFIGS.get(active_baseline, BASELINE_CONFIGS["normal"])
    
    # Collect all affected zones
    all_zones = set()
    for event in relevant_events:
        all_zones.update(event["affected_zones"])
    
    # Generate recommendations
    recommendations = []
    for event in relevant_events:
        recommendations.append(f"[{event['name']}] {event['description']}")
        if event["peak_hours"]:
            recommendations.append(
                f"  Peak impact: {event['peak_hours'][0]} to {event['peak_hours'][-1]}"
            )
    
    # Add deployment recommendation
    patrol_mod = baseline_config["patrol_modifier"]
    if patrol_mod > 1.0:
        pct_increase = int((patrol_mod - 1.0) * 100)
        recommendations.append(
            f"Increase patrol deployment by {pct_increase}% across affected zones"
        )
    elif patrol_mod < 1.0:
        pct_decrease = int((1.0 - patrol_mod) * 100)
        recommendations.append(
            f"Reduce deployment by {pct_decrease}% — holiday/low-traffic baseline"
        )
    
    return {
        "date": target_date,
        "has_events": True,
        "active_events": relevant_events,
        "combined_multiplier": max_multiplier,
        "baseline": active_baseline,
        "baseline_config": baseline_config,
        "affected_zones": sorted(list(all_zones)),
        "recommendations": recommendations,
    }


def get_all_calendar_events() -> list:
    """Get all events for the calendar view."""
    events = load_calendar()
    result = []
    for event in events:
        baseline_key = event.get("baseline", "normal")
        baseline_config = BASELINE_CONFIGS.get(baseline_key, BASELINE_CONFIGS["normal"])
        result.append({
            **event,
            "baseline_config": baseline_config,
        })
    return result


def get_monthly_events(year: int, month: int) -> dict:
    """Get events for a specific month, organized by date."""
    events = load_calendar()
    monthly = {}
    
    for event in events:
        for date_str in event["dates"]:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d")
                if d.year == year and d.month == month:
                    if date_str not in monthly:
                        monthly[date_str] = []
                    monthly[date_str].append({
                        "name": event["name"],
                        "type": event["type"],
                        "traffic_multiplier": event["traffic_multiplier"],
                        "baseline": event.get("baseline", "normal"),
                    })
            except ValueError:
                continue
    
    return monthly
