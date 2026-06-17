"""
LLM Service — Claude API integration for operational recommendations.
Falls back to template-based responses if API key is not available.
"""

import os
import json
import httpx
from typing import Optional

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are ASTRAM, an AI traffic operations advisor for Bengaluru Traffic Police. 
You speak like an experienced field operations commander — precise, direct, actionable.
Always provide: (1) Immediate actions in the next 30 minutes, (2) Personnel deployment count and positions, (3) Diversion route recommendations, (4) Time-bound warnings.
Use Bengaluru road names and landmark references. Keep response under 200 words."""


def build_incident_brief(
    event_type: str,
    cause: str,
    address: str,
    datetime_str: str,
    priority: str,
    ecrs_score: float,
    gravity_score: float = 0.0,
    nearby_pois: str = "None",
    calendar_event: Optional[str] = None,
    cascade_alerts: str = "None",
    avg_duration: Optional[float] = None,
    corridor: Optional[str] = None,
    zone: Optional[str] = None,
) -> str:
    """Build the structured incident brief for Claude."""
    return f"""INCIDENT BRIEF:
Event Type: {event_type}
Cause: {cause}
Location: {address}
Corridor: {corridor or 'Non-corridor'}
Zone: {zone or 'Unknown'}
Current Time: {datetime_str}
Priority: {priority}
ECRS Score: {ecrs_score}/10
Gravity Score: {gravity_score}/1.0 (nearby: {nearby_pois})
Active Calendar Event: {calendar_event or 'None'}
Cascading Risk: {cascade_alerts}
Historical Average Duration at this location: {avg_duration or 'N/A'} minutes

Generate operational recommendations for the duty officer."""


async def get_llm_recommendation(incident_brief: str) -> dict:
    """
    Call Claude API for operational recommendations.
    Falls back to template if API key is not set.
    """
    if not ANTHROPIC_API_KEY:
        return generate_template_response(incident_brief)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 1000,
                    "system": SYSTEM_PROMPT,
                    "messages": [
                        {
                            "role": "user",
                            "content": incident_brief,
                        }
                    ],
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["content"][0]["text"]
                return {
                    "success": True,
                    "source": "claude",
                    "recommendation": content,
                    "model": "claude-sonnet-4-6",
                }
            else:
                # API error — fall back to template
                return generate_template_response(
                    incident_brief,
                    note=f"Claude API returned status {response.status_code}. Using template response."
                )
    except Exception as e:
        return generate_template_response(
            incident_brief,
            note=f"Claude API error: {str(e)}. Using template response."
        )


def generate_template_response(incident_brief: str, note: Optional[str] = None) -> dict:
    """
    Generate a structured template response when Claude API is unavailable.
    Parses the incident brief to provide contextual recommendations.
    """
    # Parse key fields from the brief
    lines = incident_brief.strip().split("\n")
    fields = {}
    for line in lines:
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()
    
    cause = fields.get("Cause", "unknown")
    priority = fields.get("Priority", "High")
    ecrs_str = fields.get("ECRS Score", "5/10")
    ecrs = float(ecrs_str.split("/")[0]) if "/" in ecrs_str else 5.0
    location = fields.get("Location", "Unknown location")
    corridor = fields.get("Corridor", "Non-corridor")
    
    # Build contextual recommendation
    sections = []
    
    # Section 1: Immediate Actions
    if ecrs >= 8:
        sections.append("⚡ IMMEDIATE ACTIONS (Next 30 mins):\n"
                        f"• Dispatch emergency response team to {location}\n"
                        f"• Activate full road closure protocol on {corridor}\n"
                        "• Alert Commissioner's office — ECRS exceeds critical threshold\n"
                        "• Deploy traffic signal override at nearest 3 junctions")
    elif ecrs >= 6:
        sections.append("⚡ IMMEDIATE ACTIONS (Next 30 mins):\n"
                        f"• Deploy rapid response unit to {location}\n"
                        f"• Prepare diversion signage for {corridor}\n"
                        "• Coordinate with nearby police stations for backup\n"
                        "• Monitor adjacent corridors for cascade effects")
    else:
        sections.append("⚡ IMMEDIATE ACTIONS (Next 30 mins):\n"
                        f"• Send patrol unit to assess situation at {location}\n"
                        "• Monitor traffic flow on CCTV feeds\n"
                        "• Keep standby unit alert for escalation")
    
    # Section 2: Personnel
    import math
    officers = max(2, math.ceil(ecrs * 0.8))
    sections.append(f"\n👥 PERSONNEL DEPLOYMENT: {officers} officers\n"
                    f"• 2 at incident point ({location})\n"
                    f"• {max(1, officers - 3)} at upstream/downstream junctions\n"
                    "• 1 mobile patrol on diversion route")
    
    # Section 3: Diversion
    if corridor != "Non-corridor":
        sections.append(f"\n🔄 DIVERSION ROUTES:\n"
                        f"• Primary: Use alternative corridors connected to {corridor}\n"
                        "• Activate LED signage 2km upstream\n"
                        "• Coordinate with BMTC for bus route modifications")
    
    # Section 4: Time warnings
    if cause == "accident":
        sections.append("\n⏱ TIME-BOUND WARNINGS:\n"
                        "• Expected clearance: 45-90 minutes\n"
                        "• If not resolved in 60 mins → escalate to next level\n"
                        "• Document scene for insurance/legal before clearing")
    elif cause in ("procession", "public_event"):
        sections.append("\n⏱ TIME-BOUND WARNINGS:\n"
                        "• Monitor crowd density every 15 minutes\n"
                        "• Pre-position barricading team 30 mins before peak\n"
                        "• Ensure ambulance access route remains clear throughout")
    else:
        sections.append("\n⏱ TIME-BOUND WARNINGS:\n"
                        "• Re-assess situation every 30 minutes\n"
                        "• If not resolved in 2 hours → consider road closure\n"
                        "• Update control room with status changes")
    
    recommendation = "\n".join(sections)
    
    result = {
        "success": True,
        "source": "template",
        "recommendation": recommendation,
        "model": "template-engine",
    }
    
    if note:
        result["note"] = note
    
    return result
