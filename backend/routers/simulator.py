"""
Simulator Router — What-If Scenario Comparison.
Accepts multiple scenarios and returns predictions for each.
"""

from typing import List
from fastapi import APIRouter
from pydantic import BaseModel
from routers.ml_predict import PredictRequest, predict as run_predict

router = APIRouter(prefix="/api", tags=["simulator"])


class SimulateRequest(BaseModel):
    scenarios: List[PredictRequest]


@router.post("/simulate")
def simulate(req: SimulateRequest):
    """Run multiple scenarios and return comparative results."""
    if len(req.scenarios) > 5:
        return {"error": "Maximum 5 scenarios allowed"}

    results = []
    for i, scenario in enumerate(req.scenarios):
        prediction = run_predict(scenario)
        results.append({
            "scenario_index": i,
            "input": scenario.model_dump(),
            "prediction": prediction,
        })

    # Compute comparison summary
    if len(results) >= 2:
        severities = [r["prediction"]["severity_score"] for r in results]
        resolutions = [r["prediction"]["resolution_minutes"] for r in results]
        best_idx = severities.index(min(severities))
        worst_idx = severities.index(max(severities))

        comparison = {
            "best_scenario": best_idx,
            "worst_scenario": worst_idx,
            "severity_range": {"min": min(severities), "max": max(severities)},
            "resolution_range": {"min": min(resolutions), "max": max(resolutions)},
            "recommendation": f"Scenario {best_idx + 1} has the lowest predicted impact "
                            f"(severity {min(severities):.1f} vs {max(severities):.1f})",
        }
    else:
        comparison = None

    return {
        "results": results,
        "comparison": comparison,
    }
