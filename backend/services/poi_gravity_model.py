"""
POI Gravity Model — Bengaluru Traffic Congestion Forecasting
============================================================
Built on the Astram incident dataset (Nov 2023 – Apr 2024, 8,173 events).

Architecture
------------
1. POIRegistry        — Embedded Bengaluru POI catalogue (71 POIs, 8 categories)
                        with gravity profile per POI type (peak hours, pull radius,
                        inbound/outbound direction by hour band)
2. GravityEngine      — Computes a weighted gravity score for any (lat, lon, hour, dow)
                        input by summing inverse-distance-squared attraction from all
                        nearby POIs, weighted by their type-specific time multiplier
3. CorridorProfiler   — Learns AM/PM incident ratios per corridor from the Astram data,
                        giving a data-driven inbound/outbound signature without needing
                        a direction field (which is only 0.5% populated)
4. ECRSScorer         — Event-Congestion Risk Score that combines:
                          (a) POI gravity pull at event location & time
                          (b) Corridor baseline risk (incident density)
                          (c) Event-cause severity weight
                          (d) Road-closure probability
5. POIGravityModel    — Top-level class: fits on Astram data, scores new incidents,
                        generates corridor heat profiles, and recommends deployment
"""

from __future__ import annotations

import csv
import datetime
import math
import os
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


# =============================================================================
# 1.  POI Registry
# =============================================================================

@dataclass
class POI:
    name: str
    poi_type: str
    lat: float
    lon: float


# ---------------------------------------------------------------------------
# Gravity profiles per POI type
# peak_hours: list of (start_hour, end_hour, direction, multiplier)
#   "inbound"  = people arriving → roads leading TO the POI are congested
#   "outbound" = people leaving  → roads leading AWAY are congested
#   "both"     = bi-directional
# pull_radius_km: effective influence radius
# base_weight:    relative importance of this POI type
# ---------------------------------------------------------------------------
POI_GRAVITY_PROFILES: Dict[str, dict] = {
    "it_park": {
        "pull_radius_km": 3.0,
        "base_weight": 1.4,
        "peak_hours": [
            (7,  10, "inbound",  2.5),
            (18, 21, "outbound", 2.8),
            (12, 14, "both",     0.6),
        ],
        "closure_risk_weight": 0.3,
    },
    "mall": {
        "pull_radius_km": 2.5,
        "base_weight": 1.2,
        "peak_hours": [
            (11, 14, "inbound",  1.4),
            (17, 21, "inbound",  2.2),
            (20, 22, "outbound", 1.8),
        ],
        "closure_risk_weight": 0.2,
    },
    "hospital": {
        "pull_radius_km": 2.0,
        "base_weight": 1.0,
        "peak_hours": [
            (7,  10, "inbound",  1.6),
            (16, 19, "outbound", 1.4),
            (0,   6, "both",     0.8),
        ],
        "closure_risk_weight": 0.15,
    },
    "stadium": {
        "pull_radius_km": 4.0,
        "base_weight": 2.0,
        "peak_hours": [
            (16, 19, "inbound",  3.5),
            (21, 23, "outbound", 4.0),
            (9,  12, "inbound",  2.0),
        ],
        "closure_risk_weight": 0.6,
    },
    "transit_hub": {
        "pull_radius_km": 2.5,
        "base_weight": 1.5,
        "peak_hours": [
            (6,   9, "both",     2.2),
            (18, 21, "both",     2.4),
            (22, 24, "inbound",  1.2),
        ],
        "closure_risk_weight": 0.4,
    },
    "university": {
        "pull_radius_km": 1.8,
        "base_weight": 0.9,
        "peak_hours": [
            (8,  10, "inbound",  1.8),
            (16, 18, "outbound", 1.7),
        ],
        "closure_risk_weight": 0.1,
    },
    "industrial": {
        "pull_radius_km": 2.0,
        "base_weight": 1.1,
        "peak_hours": [
            (5,   8, "inbound",  2.0),
            (14, 17, "outbound", 1.8),
            (21, 23, "inbound",  1.4),
        ],
        "closure_risk_weight": 0.2,
    },
    "religious_large": {
        "pull_radius_km": 3.0,
        "base_weight": 1.3,
        "peak_hours": [
            (6,   9, "inbound",  1.5),
            (17, 20, "inbound",  2.0),
            (0,   3, "both",     3.0),
        ],
        "closure_risk_weight": 0.5,
    },
}

# ---------------------------------------------------------------------------
# Embedded Bengaluru POI catalogue with real-world coordinates
# ---------------------------------------------------------------------------
_POI_CATALOGUE: List[Tuple[str, str, float, float]] = [
    # IT Parks
    ("Electronic City Phase 1",           "it_park",         12.8399, 77.6770),
    ("Electronic City Phase 2",           "it_park",         12.8340, 77.6760),
    ("Manyata Tech Park",                 "it_park",         13.0475, 77.6198),
    ("Bagmane Tech Park",                 "it_park",         12.9800, 77.6456),
    ("Whitefield ITPL",                   "it_park",         12.9854, 77.7272),
    ("Ecospace Business Park",            "it_park",         12.9006, 77.6784),
    ("RMZ Infinity Old Madras Rd",        "it_park",         13.0050, 77.6563),
    ("Prestige Tech Park Sarjapur",       "it_park",         12.9148, 77.6780),
    ("Embassy Golf Links",                "it_park",         12.9591, 77.6558),
    ("Salarpuria Techpark",               "it_park",         12.9500, 77.6398),
    ("Global Village Tech Park",          "it_park",         12.9154, 77.5080),
    ("Outer Ring Road Tech Cluster",      "it_park",         12.9360, 77.6900),
    ("Marathahalli Tech Hub",             "it_park",         12.9572, 77.7011),
    # Malls
    ("Phoenix Marketcity Whitefield",     "mall",            12.9946, 77.7120),
    ("Orion Mall Rajajinagar",            "mall",            12.9990, 77.5516),
    ("Forum Mall Koramangala",            "mall",            12.9304, 77.6191),
    ("Mantri Square Malleshwaram",        "mall",            13.0108, 77.5700),
    ("UB City",                           "mall",            12.9718, 77.5985),
    ("Garuda Mall MG Road",               "mall",            12.9749, 77.6093),
    ("Forum Value Mall Whitefield",       "mall",            12.9870, 77.7200),
    ("Vega City Bannerghatta",            "mall",            12.8940, 77.5978),
    ("Royal Meenakshi Mall Bannerghatta", "mall",            12.8736, 77.5972),
    ("Gopalan Arcade Rajajinagar",        "mall",            13.0004, 77.5571),
    ("Central Mall Residency Road",       "mall",            12.9726, 77.6012),
    ("Elements Mall Thanisandra",         "mall",            13.0620, 77.6150),
    # Hospitals
    ("Manipal Hospital Old Airport Rd",   "hospital",        12.9569, 77.6474),
    ("Fortis Hospital Bannerghatta",      "hospital",        12.8887, 77.5966),
    ("Narayana Health City Bommasandra",  "hospital",        12.8255, 77.6716),
    ("Sakra World Hospital Marathahalli", "hospital",        12.9587, 77.7007),
    ("MS Ramaiah Hospital Mathikere",     "hospital",        13.0225, 77.5618),
    ("St Philomena Hospital Malleswaram", "hospital",        12.9962, 77.5736),
    ("Sparsh Hospital Infantry Road",     "hospital",        12.9867, 77.5953),
    ("Apollo Hospital Bannerghatta",      "hospital",        12.8955, 77.5978),
    ("Columbia Asia Yeshwanthpura",       "hospital",        13.0294, 77.5502),
    ("Kidwai Memorial Cancer Institute",  "hospital",        12.9500, 77.5943),
    # Stadiums
    ("M Chinnaswamy Stadium",             "stadium",         12.9788, 77.5996),
    ("Kanteerava Indoor Stadium",         "stadium",         12.9724, 77.5957),
    ("Sree Kanteerava Outdoor Stadium",   "stadium",         12.9715, 77.5952),
    ("Bengaluru Football Stadium",        "stadium",         12.9724, 77.5957),
    ("Koramangala Indoor Stadium",        "stadium",         12.9336, 77.6248),
    # Transit Hubs
    ("Kempegowda Bus Station Majestic",   "transit_hub",     12.9779, 77.5722),
    ("KSR Bengaluru City Railway Stn",    "transit_hub",     12.9773, 77.5713),
    ("Kempegowda International Airport",  "transit_hub",     13.1986, 77.7066),
    ("Yeshwanthpura Railway Station",     "transit_hub",     13.0236, 77.5534),
    ("Cantonment Railway Station",        "transit_hub",     12.9945, 77.6016),
    ("Baiyappanahalli Metro Station",     "transit_hub",     12.9906, 77.6651),
    ("MG Road Metro Station",             "transit_hub",     12.9754, 77.6094),
    ("Hebbal Bus Terminal",               "transit_hub",     13.0459, 77.5963),
    ("Shivajinagar Bus Stand",            "transit_hub",     12.9879, 77.5977),
    ("Silk Board Junction Hub",           "transit_hub",     12.9175, 77.6228),
    # Universities
    ("IISc Malleswaram",                  "university",      13.0210, 77.5676),
    ("Christ University Hosur Road",      "university",      12.9341, 77.6070),
    ("RV College of Engineering",         "university",      12.9234, 77.4988),
    ("BMS College of Engineering",        "university",      12.9411, 77.5649),
    ("Bangalore University",              "university",      12.9576, 77.5119),
    ("Jyoti Nivas College Koramangala",   "university",      12.9322, 77.6146),
    ("PES University RR Nagar",           "university",      12.9148, 77.5086),
    ("Ramaiah Institute of Technology",   "university",      13.0260, 77.5608),
    # Industrial Areas
    ("Peenya Industrial Area",            "industrial",      13.0271, 77.5175),
    ("Rajajinagar Industrial Area",       "industrial",      13.0006, 77.5488),
    ("Bommasandra Industrial Area",       "industrial",      12.8235, 77.6759),
    ("Hoskote Industrial Area",           "industrial",      13.0668, 77.7987),
    ("Yeshwanthpura Industrial Area",     "industrial",      13.0219, 77.5460),
    ("Jigani Industrial Area",            "industrial",      12.7886, 77.6286),
    # Large Religious Sites
    ("ISKCON Temple Rajajinagar",         "religious_large", 13.0097, 77.5514),
    ("Dodda Ganesha Temple Basavanagudi", "religious_large", 12.9418, 77.5723),
    ("Bull Temple Basavanagudi",          "religious_large", 12.9425, 77.5720),
    ("Sri Venkataramana Swamy Malleshwaram","religious_large",13.0008,77.5680),
    ("Ulsoor Lake Murugan Temple",        "religious_large", 12.9813, 77.6178),
    ("Banashankari Temple",               "religious_large", 12.9237, 77.5503),
    ("Shivaji Nagar CSI Church",          "religious_large", 12.9878, 77.5979),
]


class POIRegistry:
    """Loads and indexes the embedded POI catalogue."""

    def __init__(self) -> None:
        self.pois: List[POI] = [
            POI(name=r[0], poi_type=r[1], lat=r[2], lon=r[3])
            for r in _POI_CATALOGUE
        ]
        self._by_type: Dict[str, List[POI]] = defaultdict(list)
        for p in self.pois:
            self._by_type[p.poi_type].append(p)

    def pois_within(
        self, lat: float, lon: float, radius_km: float
    ) -> List[Tuple[POI, float]]:
        """Return (POI, distance_km) pairs within radius_km, sorted nearest first."""
        result = []
        for p in self.pois:
            d = _haversine_km(lat, lon, p.lat, p.lon)
            if d <= radius_km:
                result.append((p, d))
        return sorted(result, key=lambda x: x[1])

    def summary(self) -> str:
        lines = [f"POIRegistry: {len(self.pois)} POIs across {len(self._by_type)} types"]
        for t, ps in sorted(self._by_type.items()):
            lines.append(f"  {t:22s}: {len(ps):>3d} POIs")
        return "\n".join(lines)


# =============================================================================
# 2.  Gravity Engine
# =============================================================================

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + (
        math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))


def _time_multiplier(poi_type: str, hour: int) -> Tuple[float, str]:
    """
    Return (multiplier, direction) for a POI type at a given hour.
    Falls back to (0.5, 'none') outside all defined peak bands.
    """
    profile = POI_GRAVITY_PROFILES.get(poi_type, {})
    best_mult, best_dir = 0.5, "none"
    for start, end, direction, mult in profile.get("peak_hours", []):
        if start <= hour < end and mult > best_mult:
            best_mult, best_dir = mult, direction
    return best_mult, best_dir


class GravityEngine:
    """
    Computes POI gravity score for any (lat, lon, hour) triple.

    Score formula (per POI within its pull_radius):
        contribution_i = base_weight_i × time_multiplier_i(hour)
                         / (distance_km_i² + ε)

    Total raw score = Σ contribution_i
    Normalized to [0, 100] using the 99th-percentile of training-data scores.
    """

    EPSILON = 0.1          # km — prevents division by zero
    MAX_SEARCH_RADIUS_KM = 6.0

    def __init__(self, registry: POIRegistry) -> None:
        self.registry = registry
        self._empirical_max: float = 1.0   # set during calibrate()

    def raw_score(
        self, lat: float, lon: float, hour: int
    ) -> Tuple[float, List[dict]]:
        """Return (raw_score, contributing_poi_list)."""
        candidates = self.registry.pois_within(lat, lon, self.MAX_SEARCH_RADIUS_KM)
        total = 0.0
        contributors: List[dict] = []
        for poi, dist_km in candidates:
            profile = POI_GRAVITY_PROFILES.get(poi.poi_type, {})
            if dist_km > profile.get("pull_radius_km", 2.0):
                continue
            base_w = profile.get("base_weight", 1.0)
            t_mult, direction = _time_multiplier(poi.poi_type, hour)
            contribution = base_w * t_mult / (dist_km ** 2 + self.EPSILON)
            total += contribution
            contributors.append({
                "poi": poi.name,
                "type": poi.poi_type,
                "dist_km": round(dist_km, 3),
                "time_mult": t_mult,
                "direction": direction,
                "contribution": round(contribution, 4),
            })
        contributors.sort(key=lambda x: -x["contribution"])
        return total, contributors

    def score(
        self, lat: float, lon: float, hour: int
    ) -> Tuple[float, List[dict]]:
        """Normalized score in [0, 100] + contributing POI list."""
        raw, contributors = self.raw_score(lat, lon, hour)
        normalized = min(100.0, round(100.0 * raw / self._empirical_max, 2))
        return normalized, contributors

    def calibrate(
        self, sample_points: List[Tuple[float, float, int]]
    ) -> None:
        """Fit empirical_max from training (lat, lon, hour) samples."""
        raws = sorted(
            self.raw_score(lat, lon, h)[0] for lat, lon, h in sample_points
        )
        idx = max(0, int(len(raws) * 0.99) - 1)
        self._empirical_max = max(raws[idx], 1e-6)


# =============================================================================
# 3.  Corridor Profiler
# =============================================================================

@dataclass
class CorridorStats:
    name: str
    total_incidents: int
    am_incidents: int        # 06:00–09:59
    pm_incidents: int        # 18:00–21:59
    am_pm_ratio: float
    peak_hour: int
    hourly_counts: Dict[int, int]
    closure_rate: float
    dominant_cause: str
    gravity_signature: str   # "inbound_dominant" | "outbound_dominant" | "balanced"

    @property
    def incidents_per_day(self) -> float:
        return round(self.total_incidents / 180, 2)  # dataset ≈ 180 days


class CorridorProfiler:
    """Learns per-corridor temporal patterns from the Astram dataset."""

    INBOUND_THRESHOLD  = 1.15   # AM/PM > 1.15 → inbound-dominant
    OUTBOUND_THRESHOLD = 0.85   # AM/PM < 0.85 → outbound-dominant
    MIN_EVENTS         = 20     # skip corridors with too few events

    def fit(self, events: List[dict]) -> Dict[str, CorridorStats]:
        hour_counts:    Dict[str, Dict[int, int]]   = defaultdict(lambda: defaultdict(int))
        closure_counts: Dict[str, List[bool]]        = defaultdict(list)
        cause_counts:   Dict[str, Dict[str, int]]   = defaultdict(lambda: defaultdict(int))

        for e in events:
            c = e.get("corridor", "")
            if not c or c in ("Non-corridor", "NULL", ""):
                continue
            hour_counts[c][e["hour"]] += 1
            closure_counts[c].append(e.get("closure", False))
            cause_counts[c][e.get("cause", "unknown")] += 1

        self.corridor_stats: Dict[str, CorridorStats] = {}
        for c, hc in hour_counts.items():
            total = sum(hc.values())
            if total < self.MIN_EVENTS:
                continue
            am    = sum(hc.get(h, 0) for h in range(6, 10))
            pm    = sum(hc.get(h, 0) for h in range(18, 22))
            ratio = am / max(pm, 1)
            peak  = max(hc, key=hc.get)
            cl    = closure_counts[c]
            cl_rate    = sum(cl) / len(cl) if cl else 0.0
            dom_cause  = max(cause_counts[c], key=cause_counts[c].get)
            if ratio >= self.INBOUND_THRESHOLD:
                sig = "inbound_dominant"
            elif ratio <= self.OUTBOUND_THRESHOLD:
                sig = "outbound_dominant"
            else:
                sig = "balanced"

            self.corridor_stats[c] = CorridorStats(
                name=c,
                total_incidents=total,
                am_incidents=am,
                pm_incidents=pm,
                am_pm_ratio=round(ratio, 3),
                peak_hour=peak,
                hourly_counts=dict(hc),
                closure_rate=round(cl_rate, 3),
                dominant_cause=dom_cause,
                gravity_signature=sig,
            )
        return self.corridor_stats

    def get(self, corridor: str) -> Optional[CorridorStats]:
        return self.corridor_stats.get(corridor)

    def top_risk_corridors(self, n: int = 10) -> List[CorridorStats]:
        return sorted(
            self.corridor_stats.values(), key=lambda s: -s.total_incidents
        )[:n]


# =============================================================================
# 4.  ECRS Scorer
# =============================================================================

# Severity weights derived from dataset:
#   closure_rate×0.4 + normalised_resolution_time×0.35 + volume_share×0.25
EVENT_CAUSE_WEIGHTS: Dict[str, float] = {
    "vip_movement":    1.00,
    "public_event":    0.85,
    "protest":         0.78,
    "tree_fall":       0.72,
    "procession":      0.68,
    "construction":    0.62,
    "water_logging":   0.58,
    "road_conditions": 0.52,
    "congestion":      0.46,
    "others":          0.40,
    "vehicle_breakdown": 0.32,
    "accident":        0.30,
    "pot_holes":       0.28,
}

CLOSURE_PROBABILITY: Dict[str, float] = {
    "vip_movement":    0.80,
    "public_event":    0.46,
    "protest":         0.40,
    "tree_fall":       0.39,
    "procession":      0.26,
    "construction":    0.26,
    "road_conditions": 0.12,
    "water_logging":   0.09,
    "others":          0.09,
    "vehicle_breakdown": 0.04,
    "accident":        0.07,
    "congestion":      0.03,
    "pot_holes":       0.02,
}

DOW_MULTIPLIER: Dict[int, float] = {
    0: 0.85,   # Monday
    1: 1.05,   # Tuesday
    2: 1.02,   # Wednesday
    3: 1.10,   # Thursday  ← highest incident day
    4: 1.08,   # Friday
    5: 1.05,   # Saturday
    6: 0.82,   # Sunday    ← lowest
}


@dataclass
class ECRSResult:
    ecrs: float
    risk_tier: str            # CRITICAL | HIGH | MODERATE | LOW
    gravity_score: float
    corridor_risk: float
    cause_weight: float
    closure_probability: float
    dow_multiplier: float
    top_pois: List[dict]
    gravity_direction: str
    recommended_deployment: str
    pre_deploy_lead_hours: int

    def to_dict(self) -> dict:
        return {
            "ecrs": self.ecrs,
            "risk_tier": self.risk_tier,
            "gravity_score": self.gravity_score,
            "corridor_risk": self.corridor_risk,
            "cause_weight": self.cause_weight,
            "closure_probability": self.closure_probability,
            "dow_multiplier": self.dow_multiplier,
            "gravity_direction": self.gravity_direction,
            "top_pois": self.top_pois[:3],
            "recommended_deployment": self.recommended_deployment,
            "pre_deploy_lead_hours": self.pre_deploy_lead_hours,
        }


class ECRSScorer:
    """
    ECRS = (0.40 × gravity_score
          + 0.30 × corridor_risk
          + 0.20 × cause_weight × 100
          + 0.10 × closure_prob × 100)  ×  dow_multiplier

    Clipped to [0, 100].
    """

    WEIGHTS = {"gravity": 0.40, "corridor": 0.30, "cause": 0.20, "closure": 0.10}

    TIER_THRESHOLDS = [
        (80, "CRITICAL"),
        (60, "HIGH"),
        (40, "MODERATE"),
        (0,  "LOW"),
    ]

    DEPLOYMENT_RULES = {
        "CRITICAL": {
            "deployment": "Full corridor team (8–12 officers) + barricading + diversion signage",
            "lead_hours": 4,
        },
        "HIGH": {
            "deployment": "6–8 officers + pre-positioned barricades + alternate route advisory",
            "lead_hours": 2,
        },
        "MODERATE": {
            "deployment": "3–4 officers + monitoring + standby rapid response",
            "lead_hours": 1,
        },
        "LOW": {
            "deployment": "1–2 officers + standard patrol",
            "lead_hours": 0,
        },
    }

    def __init__(
        self,
        gravity_engine: GravityEngine,
        corridor_profiler: CorridorProfiler,
        max_corridor_incidents: int = 743,
    ) -> None:
        self.gravity   = gravity_engine
        self.corridors = corridor_profiler
        self.max_corridor_incidents = max_corridor_incidents

    def score(
        self,
        lat: float,
        lon: float,
        hour: int,
        dow: int,
        event_cause: str,
        corridor: Optional[str] = None,
    ) -> ECRSResult:
        # Component A — POI Gravity
        g_score, contributors = self.gravity.score(lat, lon, hour)
        g_direction = contributors[0]["direction"] if contributors else "none"

        # Component B — Corridor Risk
        corridor_risk = 0.0
        if corridor and corridor not in ("Non-corridor", "NULL", ""):
            stats = self.corridors.get(corridor)
            if stats:
                corridor_risk = min(
                    100.0,
                    100.0 * stats.total_incidents / self.max_corridor_incidents,
                )
                # Scale by how active this hour is relative to the corridor peak
                hourly   = stats.hourly_counts
                peak_cnt = max(hourly.get(stats.peak_hour, 1), 1)
                curr_cnt = hourly.get(hour, 0)
                corridor_risk = min(100.0, corridor_risk * (0.7 + 0.3 * curr_cnt / peak_cnt))

        # Component C — Cause weight
        cause_w = EVENT_CAUSE_WEIGHTS.get(event_cause, 0.35)

        # Component D — Closure probability
        cl_prob = CLOSURE_PROBABILITY.get(event_cause, 0.05)

        # Composite
        raw = (
            self.WEIGHTS["gravity"]  * g_score
            + self.WEIGHTS["corridor"] * corridor_risk
            + self.WEIGHTS["cause"]    * cause_w * 100
            + self.WEIGHTS["closure"]  * cl_prob * 100
        )
        dow_mult = DOW_MULTIPLIER.get(dow, 1.0)
        ecrs     = round(min(100.0, raw * dow_mult), 2)

        tier = "LOW"
        for threshold, label in self.TIER_THRESHOLDS:
            if ecrs >= threshold:
                tier = label
                break

        rule = self.DEPLOYMENT_RULES[tier]
        return ECRSResult(
            ecrs=ecrs,
            risk_tier=tier,
            gravity_score=round(g_score, 2),
            corridor_risk=round(corridor_risk, 2),
            cause_weight=round(cause_w, 3),
            closure_probability=round(cl_prob, 3),
            dow_multiplier=dow_mult,
            top_pois=contributors[:3],
            gravity_direction=g_direction,
            recommended_deployment=rule["deployment"],
            pre_deploy_lead_hours=rule["lead_hours"],
        )


# =============================================================================
# 5.  Top-level POI Gravity Model
# =============================================================================

class POIGravityModel:
    """
    Main entry point.

    Quick start
    -----------
    model = POIGravityModel()
    model.fit("astram_data.csv")

    result = model.score_incident(
        lat=12.9788, lon=77.5996,
        hour=21, dow=4,
        event_cause="public_event",
        corridor="Old Madras Road",
    )
    print(result.to_dict())

    profile  = model.corridor_heat_profile("Mysore Road")
    forecast = model.day_forecast(lat=12.9788, lon=77.5996, dow=5)
    """

    def __init__(self) -> None:
        self.registry          = POIRegistry()
        self.gravity_engine    = GravityEngine(self.registry)
        self.corridor_profiler = CorridorProfiler()
        self.scorer: Optional[ECRSScorer] = None
        self._events: List[dict] = []
        self._fitted = False

    # ------------------------------------------------------------------
    # Fitting
    # ------------------------------------------------------------------

    def fit(self, csv_path: str) -> "POIGravityModel":
        self._events = _load_astram_csv(csv_path)
        print(f"Loaded {len(self._events):,} events from {os.path.basename(csv_path)}")

        self.corridor_profiler.fit(self._events)
        print(f"Corridor profiles learned: {len(self.corridor_profiler.corridor_stats)}")

        sample_points = [
            (e["lat"], e["lon"], e["hour"])
            for e in self._events
            if 12.7 < e["lat"] < 13.3 and 77.3 < e["lon"] < 77.9
        ]
        self.gravity_engine.calibrate(sample_points)
        print(f"Gravity engine calibrated on {len(sample_points):,} geo-valid events")
        print(f"  Empirical max (99th pct): {self.gravity_engine._empirical_max:.4f}")

        max_incidents = max(
            s.total_incidents for s in self.corridor_profiler.corridor_stats.values()
        )
        self.scorer  = ECRSScorer(self.gravity_engine, self.corridor_profiler, max_incidents)
        self._fitted = True
        print("\nModel ready.\n")
        return self

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def score_incident(
        self,
        lat: float,
        lon: float,
        hour: int,
        dow: int,
        event_cause: str,
        corridor: Optional[str] = None,
    ) -> ECRSResult:
        """Score a single incident and return a full ECRSResult."""
        self._assert_fitted()
        return self.scorer.score(lat, lon, hour, dow, event_cause, corridor)

    def corridor_heat_profile(self, corridor: str) -> Dict[str, object]:
        """
        24-hour ECRS heat profile for a named corridor.
        Uses the corridor's spatial centroid and dominant event cause.
        """
        self._assert_fitted()
        stats = self.corridor_profiler.get(corridor)
        if stats is None:
            avail = list(self.corridor_profiler.corridor_stats)[:5]
            raise ValueError(
                f"Corridor '{corridor}' not found. Available (sample): {avail}…"
            )
        lats = [e["lat"] for e in self._events if e.get("corridor") == corridor]
        lons = [e["lon"] for e in self._events if e.get("corridor") == corridor]
        c_lat = sum(lats) / len(lats)
        c_lon = sum(lons) / len(lons)

        hourly_ecrs: Dict[int, float] = {}
        for h in range(24):
            r = self.scorer.score(
                c_lat, c_lon, h, 3, stats.dominant_cause, corridor  # dow=3 (Thu, peak day)
            )
            hourly_ecrs[h] = r.ecrs

        sorted_hours = sorted(hourly_ecrs.items(), key=lambda x: -x[1])
        peak_h, peak_score = sorted_hours[0]

        return {
            "corridor": corridor,
            "centroid": {"lat": round(c_lat, 5), "lon": round(c_lon, 5)},
            "gravity_signature": stats.gravity_signature,
            "am_pm_ratio": stats.am_pm_ratio,
            "total_incidents": stats.total_incidents,
            "closure_rate": stats.closure_rate,
            "peak_risk_hour": peak_h,
            "peak_ecrs": peak_score,
            "hourly_ecrs": hourly_ecrs,
            "top_3_risk_hours": [(h, round(s, 1)) for h, s in sorted_hours[:3]],
        }

    def day_forecast(
        self,
        lat: float,
        lon: float,
        dow: int,
        event_cause: str = "public_event",
        corridor: Optional[str] = None,
    ) -> List[dict]:
        """Hourly ECRS forecast across all 24 hours for a given location."""
        self._assert_fitted()
        return [
            {
                "hour": h,
                "ecrs": (r := self.scorer.score(lat, lon, h, dow, event_cause, corridor)).ecrs,
                "risk_tier": r.risk_tier,
                "gravity_direction": r.gravity_direction,
                "gravity_score": r.gravity_score,
            }
            for h in range(24)
        ]

    def nearby_pois(
        self, lat: float, lon: float, radius_km: float = 3.0
    ) -> List[Tuple[POI, float]]:
        """Return (POI, distance_km) pairs within radius_km."""
        return self.registry.pois_within(lat, lon, radius_km)

    def top_risk_corridors(self, n: int = 10) -> List[CorridorStats]:
        self._assert_fitted()
        return self.corridor_profiler.top_risk_corridors(n)

    def _assert_fitted(self) -> None:
        if not self._fitted:
            raise RuntimeError("Call model.fit(csv_path) before inference.")


# =============================================================================
# Data Loader
# =============================================================================

def _parse_dt(s: str) -> Optional[datetime.datetime]:
    if not s or s == "NULL":
        return None
    s = s.replace("+00", "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _load_astram_csv(path: str) -> List[dict]:
    events: List[dict] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dt = _parse_dt(row.get("start_datetime", ""))
            if dt is None:
                continue
            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
            except (ValueError, KeyError):
                continue
            events.append({
                "lat":      lat,
                "lon":      lon,
                "hour":     dt.hour,
                "dow":      dt.weekday(),
                "cause":    row.get("event_cause", "others"),
                "corridor": row.get("corridor", ""),
                "junction": row.get("junction", ""),
                "zone":     row.get("zone", ""),
                "closure":  row.get("requires_road_closure", "") == "TRUE",
                "priority": row.get("priority", ""),
                "dt":       dt,
            })
    return events


# =============================================================================
# Demo / CLI
# =============================================================================

def _divider(title: str = "") -> None:
    W = 72
    if title:
        pad = (W - len(title) - 2) // 2
        print("─" * pad + f" {title} " + "─" * (W - pad - len(title) - 2))
    else:
        print("─" * W)


def _print_ecrs(r: ECRSResult) -> None:
    sym = {"CRITICAL": "🔴", "HIGH": "🟠", "MODERATE": "🟡", "LOW": "🟢"}
    bar = "█" * int(r.ecrs / 2) + "░" * (50 - int(r.ecrs / 2))
    print(f"  ECRS : {r.ecrs:>6.1f}/100  {bar}  {sym.get(r.risk_tier,'')} {r.risk_tier}")
    print(f"  ├─ Gravity score   : {r.gravity_score:.1f}   direction: {r.gravity_direction}")
    print(f"  ├─ Corridor risk   : {r.corridor_risk:.1f}")
    print(f"  ├─ Cause weight    : {r.cause_weight:.2f}  |  Closure prob: {r.closure_probability:.0%}  |  DoW ×{r.dow_multiplier}")
    print(f"  ├─ Deployment      : {r.recommended_deployment}")
    print(f"  ├─ Pre-deploy lead : {r.pre_deploy_lead_hours}h before event")
    if r.top_pois:
        print(f"  └─ Top POI pull:")
        for p in r.top_pois[:3]:
            print(f"       • {p['poi']:<42} {p['dist_km']:.2f} km  ×{p['time_mult']}  [{p['direction']}]")
    print()


def _print_corridor_profile(profile: dict) -> None:
    h_ecrs = profile["hourly_ecrs"]
    peak   = profile["peak_risk_hour"]
    max_e  = max(h_ecrs.values()) or 1
    print(f"\n  {profile['corridor']}  |  {profile['gravity_signature']}"
          f"  |  AM:PM={profile['am_pm_ratio']:.2f}"
          f"  |  peak ECRS={profile['peak_ecrs']:.0f} @ {peak:02d}:00")
    for h in range(24):
        v   = h_ecrs.get(h, 0)
        bar = "█" * int(v / max_e * 28)
        tag = ""
        if h in range(6, 10):
            tag = "  ← AM"
        elif h in range(18, 22):
            tag = "  ← PM"
        elif h == peak:
            tag = "  ← PEAK"
        print(f"    {h:02d}:00  {bar:<28}  {v:5.1f}{tag}")


def run_demo(csv_path: str) -> None:
    print()
    _divider("POI Gravity Model — Bengaluru Traffic")
    print(f"  Dataset : {csv_path}")
    print()

    model = POIGravityModel()
    model.fit(csv_path)
    print(model.registry.summary())
    print()

    # ── Scenario 1: IPL night at Chinnaswamy ─────────────────────────────
    _divider("Scenario 1 — IPL match, Chinnaswamy Stadium, 9 PM Friday")
    r1 = model.score_incident(
        lat=12.9788, lon=77.5996,
        hour=21, dow=4,
        event_cause="public_event",
        corridor="Old Madras Road",
    )
    _print_ecrs(r1)

    # ── Scenario 2: Morning breakdown on Mysore Road ──────────────────────
    _divider("Scenario 2 — Vehicle breakdown, Mysore Road, 6 AM Monday")
    r2 = model.score_incident(
        lat=12.9411, lon=77.5365,
        hour=6, dow=0,
        event_cause="vehicle_breakdown",
        corridor="Mysore Road",
    )
    _print_ecrs(r2)

    # ── Scenario 3: VIP movement, MG Road ────────────────────────────────
    _divider("Scenario 3 — VIP movement, MG Road, 11 AM Thursday")
    r3 = model.score_incident(
        lat=12.9749, lon=77.6093,
        hour=11, dow=3,
        event_cause="vip_movement",
        corridor="Old Madras Road",
    )
    _print_ecrs(r3)

    # ── Scenario 4: ISKCON festival procession ────────────────────────────
    _divider("Scenario 4 — Procession near ISKCON Temple, 7 PM Saturday")
    r4 = model.score_incident(
        lat=13.0097, lon=77.5514,
        hour=19, dow=5,
        event_cause="procession",
        corridor="Tumkur Road",
    )
    _print_ecrs(r4)

    # ── Scenario 5: Electronic City IT park evening exodus ─────────────────
    _divider("Scenario 5 — Construction, Electronic City, 7 PM Wednesday")
    r5 = model.score_incident(
        lat=12.8399, lon=77.6770,
        hour=19, dow=2,
        event_cause="construction",
        corridor="Hosur Road",
    )
    _print_ecrs(r5)

    # ── Corridor heat profiles ─────────────────────────────────────────────
    _divider("Corridor 24-hour ECRS Heat Profiles")
    for corridor in ["Mysore Road", "Bellary Road 1", "Hosur Road", "Tumkur Road"]:
        try:
            _print_corridor_profile(model.corridor_heat_profile(corridor))
        except ValueError as exc:
            print(f"  [{corridor}] {exc}")
    print()

    # ── Day forecast — Manyata Tech Park ──────────────────────────────────
    _divider("Day Forecast — Manyata Tech Park corridor (Thursday)")
    forecast = model.day_forecast(
        lat=13.0475, lon=77.6198,
        dow=3,
        event_cause="vehicle_breakdown",
        corridor="Bellary Road 1",
    )
    sym = {"CRITICAL": "🔴", "HIGH": "🟠", "MODERATE": "🟡", "LOW": "🟢"}
    print(f"  {'Hour':>5}  {'ECRS':>6}  {'Tier':<12}  Direction        Gravity")
    print(f"  {'─'*5}  {'─'*6}  {'─'*12}  {'─'*16}  {'─'*6}")
    for f in forecast:
        print(
            f"  {f['hour']:02d}:00  {f['ecrs']:>6.1f}  "
            f"{sym.get(f['risk_tier'],'')} {f['risk_tier']:<10}  "
            f"{f['gravity_direction']:<16}  {f['gravity_score']:.1f}"
        )
    print()

    # ── Top risk corridors ─────────────────────────────────────────────────
    _divider("Top 10 Risk Corridors")
    print(f"  {'Corridor':<26}  {'Events':>7}  {'Closure%':>9}  {'AM:PM':>6}  Signature")
    print(f"  {'─'*26}  {'─'*7}  {'─'*9}  {'─'*6}  {'─'*20}")
    for s in model.top_risk_corridors(10):
        print(
            f"  {s.name:<26}  {s.total_incidents:>7,}  "
            f"{s.closure_rate*100:>8.1f}%  "
            f"{s.am_pm_ratio:>6.2f}  {s.gravity_signature}"
        )

    print()
    _divider()
    print("  POI Gravity Model demo complete.")
    _divider()
    print()


# Entry point
if __name__ == "__main__":
    import sys
    data_path = (
        sys.argv[1] if len(sys.argv) > 1
        else "../Astram_event_data_anonymized__Astram_event_data_anonymizedb40ac87.csv"
    )
    run_demo(data_path)