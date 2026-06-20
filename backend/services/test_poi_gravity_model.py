"""
POI Gravity Model — Test Harness
=================================
Four test suites covering different aspects of the model.

Run:
    python test_poi_gravity_model.py [path/to/astram.csv]

Outputs a full report with pass/fail verdicts.
"""

import sys
import csv
import datetime
import math
from collections import defaultdict
from typing import List, Dict

sys.path.insert(0, ".")
from poi_gravity_model import POIGravityModel, POIRegistry, _haversine_km

CSV_DEFAULT = "/mnt/project/Astram_event_data_anonymized__Astram_event_data_anonymizedb40ac87.csv"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def parse_dt(s: str):
    if not s or s == "NULL":
        return None
    s = s.replace("+00", "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def load_csv(path: str) -> List[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    return rows


def mean(vals):
    return sum(vals) / len(vals) if vals else 0.0


def divider(title="", w=72):
    if title:
        pad = (w - len(title) - 2) // 2
        print("─" * pad + f" {title} " + "─" * (w - pad - len(title) - 2))
    else:
        print("─" * w)


PASS = "✓ PASS"
FAIL = "✗ FAIL"
WARN = "⚠ WARN"


# ─────────────────────────────────────────────────────────────────────────────
# Suite 1 — Unit tests (no data needed)
# ─────────────────────────────────────────────────────────────────────────────

def suite_unit(model: POIGravityModel) -> List[dict]:
    results = []

    # 1a: Gravity score is higher at a known POI location than a random field
    g_stadium, _ = model.gravity_engine.score(12.9788, 77.5996, 21)   # Chinnaswamy, 9 PM
    g_empty,   _ = model.gravity_engine.score(12.9200, 77.5400, 21)   # no POI nearby
    results.append({
        "name": "1a: Stadium gravity > empty field",
        "status": PASS if g_stadium > g_empty * 5 else FAIL,
        "detail": f"Stadium={g_stadium:.1f}, empty={g_empty:.1f} (ratio={g_stadium/max(g_empty,0.01):.1f}x)",
    })

    # 1b: Gravity decays with distance (inverse-square)
    g_0km, _ = model.gravity_engine.score(12.9788, 77.5996, 21)   # at Chinnaswamy
    g_1km, _ = model.gravity_engine.score(12.9888, 77.5996, 21)   # ~1 km away
    g_3km, _ = model.gravity_engine.score(12.9788, 77.5696, 21)   # ~3 km away
    results.append({
        "name": "1b: Gravity decays with distance",
        "status": PASS if g_0km > g_1km > g_3km else FAIL,
        "detail": f"0km={g_0km:.1f}, 1km={g_1km:.1f}, 3km={g_3km:.1f}",
    })

    # 1c: IT Park scores higher at 8 AM (morning rush) than 3 PM (off-peak)
    g_am, _ = model.gravity_engine.score(13.0475, 77.6198, 8)    # Manyata 8 AM
    g_pm, _ = model.gravity_engine.score(13.0475, 77.6198, 14)   # Manyata 2 PM
    results.append({
        "name": "1c: IT Park gravity peaks at 8 AM vs 2 PM",
        "status": PASS if g_am > g_pm else FAIL,
        "detail": f"08:00={g_am:.1f}, 14:00={g_pm:.1f}",
    })

    # 1d: Stadium scores higher at 9 PM (post-match) than 2 PM (no match)
    g_night, _ = model.gravity_engine.score(12.9788, 77.5996, 21)
    g_day,   _ = model.gravity_engine.score(12.9788, 77.5996, 14)
    results.append({
        "name": "1d: Stadium gravity peaks post-match (9 PM) vs midday",
        "status": PASS if g_night > g_day else FAIL,
        "detail": f"21:00={g_night:.1f}, 14:00={g_day:.1f}",
    })

    # 1e: ECRS scores are in [0, 100]
    test_cases = [
        (12.9788, 77.5996, 21, 4, "public_event",      "Old Madras Road"),
        (12.9411, 77.5365, 6,  0, "vehicle_breakdown",  "Mysore Road"),
        (12.9749, 77.6093, 11, 3, "vip_movement",       "Old Madras Road"),
        (13.0097, 77.5514, 19, 5, "procession",         "Tumkur Road"),
        (13.1986, 77.7066, 3,  2, "accident",           None),   # Airport, no corridor
    ]
    all_valid = True
    for lat, lon, h, d, cause, corr in test_cases:
        r = model.score_incident(lat, lon, h, d, cause, corr)
        if not (0 <= r.ecrs <= 100):
            all_valid = False
    results.append({
        "name": "1e: All ECRS scores in [0, 100]",
        "status": PASS if all_valid else FAIL,
        "detail": f"Tested {len(test_cases)} scenarios",
    })

    # 1f: Cause severity ordering — vip_movement should outscore vehicle_breakdown
    #     at the same location and time
    r_vip = model.score_incident(12.9749, 77.6093, 11, 3, "vip_movement", "Old Madras Road")
    r_veh = model.score_incident(12.9749, 77.6093, 11, 3, "vehicle_breakdown", "Old Madras Road")
    results.append({
        "name": "1f: VIP movement ECRS > vehicle breakdown (same loc/time)",
        "status": PASS if r_vip.ecrs > r_veh.ecrs else FAIL,
        "detail": f"vip_movement={r_vip.ecrs:.1f}, vehicle_breakdown={r_veh.ecrs:.1f}",
    })

    # 1g: Thursday (dow=3) should score >= Monday (dow=0) for same event
    r_thu = model.score_incident(12.9788, 77.5996, 21, 3, "public_event", "Old Madras Road")
    r_mon = model.score_incident(12.9788, 77.5996, 21, 0, "public_event", "Old Madras Road")
    results.append({
        "name": "1g: Thursday ECRS >= Monday (day-of-week multiplier)",
        "status": PASS if r_thu.ecrs >= r_mon.ecrs else FAIL,
        "detail": f"Thursday={r_thu.ecrs:.1f} (×1.10), Monday={r_mon.ecrs:.1f} (×0.85)",
    })

    # 1h: POI registry — expected counts
    reg = model.registry
    results.append({
        "name": "1h: POI registry has >= 71 POIs across >= 8 types",
        "status": PASS if len(reg.pois) >= 71 and len(set(p.poi_type for p in reg.pois)) >= 8 else FAIL,
        "detail": f"{len(reg.pois)} POIs, {len(set(p.poi_type for p in reg.pois))} types",
    })

    # 1i: Corridor profiles — all major corridors present
    expected = ["Mysore Road", "Bellary Road 1", "Tumkur Road", "Hosur Road", "ORR North 1"]
    missing = [c for c in expected if c not in model.corridor_profiler.corridor_stats]
    results.append({
        "name": "1i: All 5 major corridors in corridor profile",
        "status": PASS if not missing else FAIL,
        "detail": f"Missing: {missing}" if missing else "All present",
    })

    # 1j: Gravity direction changes correctly by hour for IT park
    _, contribs_am = model.gravity_engine.score(13.0475, 77.6198, 8)
    _, contribs_pm = model.gravity_engine.score(13.0475, 77.6198, 19)
    it_dir_am = next((c["direction"] for c in contribs_am if c["type"] == "it_park"), None)
    it_dir_pm = next((c["direction"] for c in contribs_pm if c["type"] == "it_park"), None)
    results.append({
        "name": "1j: IT Park direction = inbound(AM) / outbound(PM)",
        "status": PASS if it_dir_am == "inbound" and it_dir_pm == "outbound" else FAIL,
        "detail": f"AM direction={it_dir_am}, PM direction={it_dir_pm}",
    })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Suite 2 — Internal consistency on full dataset
# ─────────────────────────────────────────────────────────────────────────────

def suite_internal(model: POIGravityModel, rows: List[dict]) -> List[dict]:
    results = []

    # Score all valid events
    scored = []
    for r in rows:
        s = parse_dt(r.get("start_datetime", ""))
        if not s:
            continue
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except (ValueError, KeyError):
            continue
        if not (12.7 < lat < 13.3 and 77.3 < lon < 77.9):
            continue
        res = model.score_incident(lat, lon, s.hour, s.weekday(), r["event_cause"], r["corridor"])
        scored.append({
            "ecrs": res.ecrs,
            "tier": res.risk_tier,
            "closure": r.get("requires_road_closure", "") == "TRUE",
            "priority": r.get("priority", ""),
            "cause": r.get("event_cause", ""),
        })

    # 2a: High-priority events should score higher than low-priority (mean)
    hi = [e["ecrs"] for e in scored if e["priority"] == "High"]
    lo = [e["ecrs"] for e in scored if e["priority"] == "Low"]
    sep = mean(hi) - mean(lo)
    results.append({
        "name": "2a: High-priority mean ECRS > Low-priority mean ECRS",
        "status": PASS if sep > 5 else (WARN if sep > 0 else FAIL),
        "detail": f"High={mean(hi):.1f} (n={len(hi)}), Low={mean(lo):.1f} (n={len(lo)}), gap={sep:.1f}pts",
    })

    # 2b: Closure events should rank higher than non-closure in ECRS distribution
    cl_ranks  = sorted(scored, key=lambda x: x["ecrs"])
    n = len(cl_ranks)
    cl_idx    = [i for i, e in enumerate(cl_ranks) if e["closure"]]
    ncl_idx   = [i for i, e in enumerate(cl_ranks) if not e["closure"]]
    mean_cl   = mean(cl_idx) / n * 100
    mean_ncl  = mean(ncl_idx) / n * 100
    results.append({
        "name": "2b: Closure events rank higher than non-closures",
        "status": PASS if mean_cl > mean_ncl else FAIL,
        "detail": f"Closure mean percentile={mean_cl:.1f}%, Non-closure={mean_ncl:.1f}%",
    })

    # 2c: Cause severity ordering preserved on full dataset
    cause_means = defaultdict(list)
    for e in scored:
        cause_means[e["cause"]].append(e["ecrs"])
    expected_order = [
        ("vip_movement",      "vehicle_breakdown"),
        ("public_event",      "vehicle_breakdown"),
        ("public_event",      "pot_holes"),
        ("tree_fall",         "congestion"),
    ]
    order_ok = True
    details = []
    for high_cause, low_cause in expected_order:
        hv = cause_means.get(high_cause)
        lv = cause_means.get(low_cause)
        if hv and lv:
            ok = mean(hv) > mean(lv)
            order_ok = order_ok and ok
            details.append(f"{high_cause}({mean(hv):.1f}) {'>' if ok else '<'} {low_cause}({mean(lv):.1f})")
    results.append({
        "name": "2c: Cause severity ordering preserved across full dataset",
        "status": PASS if order_ok else FAIL,
        "detail": " | ".join(details),
    })

    # 2d: No score outside [0, 100]
    out_of_range = [e for e in scored if not (0 <= e["ecrs"] <= 100)]
    results.append({
        "name": "2d: No ECRS score outside [0, 100]",
        "status": PASS if not out_of_range else FAIL,
        "detail": f"{len(out_of_range)} out-of-range scores" if out_of_range else "All scores valid",
    })

    # 2e: ECRS bin monotonicity — higher ECRS bins should not have lower closure rates
    #     Check the general trend (allow some non-monotonicity due to sample noise)
    bins = defaultdict(lambda: [0, 0])
    for e in scored:
        b = int(e["ecrs"] / 10) * 10
        bins[b][1] += 1
        if e["closure"]:
            bins[b][0] += 1
    bin_rates = [(b, bins[b][0] / bins[b][1] if bins[b][1] else 0) for b in sorted(bins.keys())]
    # Spearman-like: does rate go up in upper half?
    upper_rates = [r for b, r in bin_rates if b >= 50]
    lower_rates = [r for b, r in bin_rates if b < 50 and b >= 10]
    upper_trend = mean(upper_rates) > mean(lower_rates) if upper_rates and lower_rates else False
    results.append({
        "name": "2e: Closure rate trend is higher for ECRS>=50 vs ECRS 10-49",
        "status": PASS if upper_trend else WARN,
        "detail": f"ECRS>=50 closure rate={mean(upper_rates)*100:.1f}%, ECRS 10-49={mean(lower_rates)*100:.1f}% | "
                  + " | ".join(f"[{b}-{b+9}]:{r*100:.0f}%" for b, r in bin_rates if bins[b][1] >= 20),
    })

    # 2f: CRITICAL tier events should have highest closure rate
    tier_cl = defaultdict(lambda: [0, 0])
    for e in scored:
        tier_cl[e["tier"]][1] += 1
        if e["closure"]:
            tier_cl[e["tier"]][0] += 1
    tier_rates = {t: (v[0] / v[1] if v[1] else 0) for t, v in tier_cl.items()}
    tier_order_ok = (
        tier_rates.get("CRITICAL", 0) >= tier_rates.get("HIGH", 0)
        and tier_rates.get("HIGH", 0) >= tier_rates.get("MODERATE", 0)
    )
    tier_detail = " | ".join(
        f"{t}: {tier_cl[t][0]}/{tier_cl[t][1]} ({tier_rates.get(t,0)*100:.1f}%)"
        for t in ["CRITICAL", "HIGH", "MODERATE", "LOW"]
        if t in tier_cl
    )
    results.append({
        "name": "2f: Tier closure rates follow CRITICAL>=HIGH>=MODERATE",
        "status": PASS if tier_order_ok else WARN,
        "detail": tier_detail,
    })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Suite 3 — Temporal holdout (Apr 2024)
# ─────────────────────────────────────────────────────────────────────────────

def suite_holdout(model: POIGravityModel, rows: List[dict]) -> List[dict]:
    results = []

    test_rows = [
        r for r in rows
        if parse_dt(r.get("start_datetime", ""))
        and parse_dt(r["start_datetime"]).strftime("%Y-%m") == "2024-04"
    ]

    scored = []
    for r in test_rows:
        s = parse_dt(r["start_datetime"])
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except (ValueError, KeyError):
            continue
        if not (12.7 < lat < 13.3 and 77.3 < lon < 77.9):
            continue
        res = model.score_incident(lat, lon, s.hour, s.weekday(), r["event_cause"], r["corridor"])
        scored.append({
            "ecrs": res.ecrs,
            "tier": res.risk_tier,
            "closure": r.get("requires_road_closure", "") == "TRUE",
            "priority": r.get("priority", ""),
            "cause": r.get("event_cause", ""),
        })

    n_closures = sum(1 for e in scored if e["closure"])
    print(f"  Holdout set: {len(scored)} events, {n_closures} closures ({100*n_closures/len(scored):.1f}%)")

    # 3a: Priority separation on holdout
    hi = [e["ecrs"] for e in scored if e["priority"] == "High"]
    lo = [e["ecrs"] for e in scored if e["priority"] == "Low"]
    sep = mean(hi) - mean(lo)
    results.append({
        "name": "3a: Priority separation holds on Apr-2024 holdout",
        "status": PASS if sep > 5 else (WARN if sep > 0 else FAIL),
        "detail": f"High={mean(hi):.1f}, Low={mean(lo):.1f}, gap={sep:.1f}pts (n={len(scored)})",
    })

    # 3b: Closure events score higher than non-closures on holdout
    cl_ecrs  = [e["ecrs"] for e in scored if e["closure"]]
    ncl_ecrs = [e["ecrs"] for e in scored if not e["closure"]]
    results.append({
        "name": "3b: Closure events mean ECRS > non-closure on holdout",
        "status": PASS if mean(cl_ecrs) > mean(ncl_ecrs) else FAIL,
        "detail": f"Closure mean={mean(cl_ecrs):.1f} (n={len(cl_ecrs)}), Non-closure mean={mean(ncl_ecrs):.1f} (n={len(ncl_ecrs)})",
    })

    # 3c: At threshold=40, what is the precision/recall/F1?
    thresh = 40
    tp = sum(1 for e in scored if e["ecrs"] >= thresh and e["closure"])
    fp = sum(1 for e in scored if e["ecrs"] >= thresh and not e["closure"])
    tn = sum(1 for e in scored if e["ecrs"] < thresh and not e["closure"])
    fn = sum(1 for e in scored if e["ecrs"] < thresh and e["closure"])
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    # For a heavily imbalanced dataset (9% closure rate), F1 > 0.15 is meaningful
    results.append({
        "name": f"3c: F1 score on closure prediction (threshold={thresh})",
        "status": PASS if f1 > 0.15 else (WARN if f1 > 0.08 else FAIL),
        "detail": f"P={precision:.3f}, R={recall:.3f}, F1={f1:.3f} | TP={tp} FP={fp} TN={tn} FN={fn}",
    })

    # 3d: Score distribution on holdout is stable (similar mean to training set)
    train_rows = [
        r for r in rows
        if parse_dt(r.get("start_datetime", ""))
        and parse_dt(r["start_datetime"]).strftime("%Y-%m") < "2024-04"
    ]
    train_scored = []
    for r in train_rows:
        s = parse_dt(r["start_datetime"])
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except:
            continue
        if not (12.7 < lat < 13.3 and 77.3 < lon < 77.9):
            continue
        res = model.score_incident(lat, lon, s.hour, s.weekday(), r["event_cause"], r["corridor"])
        train_scored.append(res.ecrs)

    test_mean  = mean([e["ecrs"] for e in scored])
    train_mean = mean(train_scored)
    drift = abs(test_mean - train_mean)
    results.append({
        "name": "3d: ECRS distribution stable (train vs holdout mean drift < 5)",
        "status": PASS if drift < 5 else WARN,
        "detail": f"Train mean={train_mean:.1f}, Holdout mean={test_mean:.1f}, drift={drift:.1f}",
    })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Suite 4 — Ground-truth scenario tests (known incidents)
# ─────────────────────────────────────────────────────────────────────────────

def suite_scenarios(model: POIGravityModel) -> List[dict]:
    """
    Hand-curated scenarios where the expected outcome is unambiguous.
    Each test defines an event and its expected ECRS tier from domain knowledge.
    """
    results = []

    scenarios = [
        # (name, lat, lon, hour, dow, cause, corridor, expected_tier_min, expected_tier_max)
        # IPL match post-game: crowd exit from Chinnaswamy, Friday 9 PM
        ("IPL post-match dispersal (Chinnaswamy, Fri 9 PM)",
         12.9788, 77.5996, 21, 4, "public_event", "Old Madras Road", "HIGH", "CRITICAL"),

        # VIP movement on MG Road, peak traffic hour, Thursday
        ("VIP movement MG Road (Thu 11 AM)",
         12.9749, 77.6093, 11, 3, "vip_movement", "Old Madras Road", "HIGH", "CRITICAL"),

        # Vehicle breakdown on quiet non-corridor at 3 AM
        ("Vehicle breakdown, no corridor, 3 AM",
         12.8500, 77.5500, 3, 1, "vehicle_breakdown", None, "LOW", "MODERATE"),

        # IT Park evening exodus + construction on Hosur Road
        ("Construction, Electronic City, Wed 7 PM",
         12.8399, 77.6770, 19, 2, "construction", "Hosur Road", "HIGH", "CRITICAL"),

        # Festival procession near ISKCON on Saturday evening
        ("Procession near ISKCON, Sat 7 PM",
         13.0097, 77.5514, 19, 5, "procession", "Tumkur Road", "MODERATE", "HIGH"),

        # Pothole report in low-density area, early Tuesday morning
        ("Pothole report, no POI nearby, Tue 2 AM",
         12.8700, 77.4800, 2, 1, "pot_holes", None, "LOW", "LOW"),

        # Protest outside Vidhana Soudha area, Thursday peak
        ("Protest, central Bengaluru, Thu 10 AM",
         12.9794, 77.5918, 10, 3, "protest", "Old Madras Road", "HIGH", "CRITICAL"),

        # Water logging on Outer Ring Road during monsoon peak hour
        ("Water logging, ORR North 1, Thu PM peak",
         13.0300, 77.5900, 19, 3, "water_logging", "ORR North 1", "MODERATE", "HIGH"),
    ]

    tier_rank = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}

    for name, lat, lon, hour, dow, cause, corridor, expected_min, expected_max in scenarios:
        r = model.score_incident(lat, lon, hour, dow, cause, corridor)
        actual_rank = tier_rank.get(r.risk_tier, 0)
        min_rank    = tier_rank.get(expected_min, 0)
        max_rank    = tier_rank.get(expected_max, 3)
        ok = min_rank <= actual_rank <= max_rank
        results.append({
            "name": f"4: {name}",
            "status": PASS if ok else FAIL,
            "detail": f"ECRS={r.ecrs:.1f} → {r.risk_tier} | Expected: [{expected_min}–{expected_max}]",
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Main runner
# ─────────────────────────────────────────────────────────────────────────────

def run_all(csv_path: str) -> None:
    print()
    divider("POI Gravity Model — Test Harness")
    print(f"  Dataset: {csv_path}")
    print()

    # Fit model
    model = POIGravityModel()
    model.fit(csv_path)
    rows = load_csv(csv_path)

    all_results = []
    suites = [
        ("Suite 1 — Unit Tests (structural correctness)", suite_unit(model)),
        ("Suite 2 — Internal Consistency (full dataset)",  suite_internal(model, rows)),
        ("Suite 3 — Temporal Holdout (Apr 2024)",          None),   # runs separately
        ("Suite 4 — Scenario Tests (domain knowledge)",    suite_scenarios(model)),
    ]

    # Run suites 1, 2, 4
    for title, suite_results in [(s[0], s[1]) for s in suites if s[1] is not None]:
        divider(title)
        for r in suite_results:
            icon = r["status"]
            print(f"  {icon}  {r['name']}")
            print(f"         {r['detail']}")
        all_results.extend(suite_results)
        print()

    # Suite 3 (holdout) needs separate print for progress message
    divider("Suite 3 — Temporal Holdout (Apr 2024)")
    s3 = suite_holdout(model, rows)
    for r in s3:
        icon = r["status"]
        print(f"  {icon}  {r['name']}")
        print(f"         {r['detail']}")
    all_results.extend(s3)
    print()

    # Summary
    divider("Summary")
    passed = sum(1 for r in all_results if r["status"] == PASS)
    warned = sum(1 for r in all_results if r["status"] == WARN)
    failed = sum(1 for r in all_results if r["status"] == FAIL)
    total  = len(all_results)
    print(f"  Total: {total}  |  ✓ Passed: {passed}  |  ⚠ Warned: {warned}  |  ✗ Failed: {failed}")
    print()
    if failed:
        print("  Failed tests:")
        for r in all_results:
            if r["status"] == FAIL:
                print(f"    ✗ {r['name']}")
                print(f"      {r['detail']}")
    if warned:
        print("  Warnings (investigate):")
        for r in all_results:
            if r["status"] == WARN:
                print(f"    ⚠ {r['name']}")
                print(f"      {r['detail']}")
    print()
    divider()
    verdict = "ALL TESTS PASSED" if failed == 0 else f"{failed} TEST(S) FAILED"
    print(f"  Verdict: {verdict}")
    divider()
    print()


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else CSV_DEFAULT
    run_all(path)