"""
The material risk score. Pure functions: no database, no clock.

    sub_score(f) = clamp((value - low) / (high - low), 0, 1)     per factor, from its scale
    score        = 100 * sum(w_f * sub_score_f) / sum(w_f)       over factors that can be evaluated

A factor without data is left out and the remaining weights are rescaled, so a missing input never
silently lowers (or raises) the score. If the evaluable weights add up to less than
`min_evaluable_weight`, no score is produced at all.
"""

import math
from typing import Any

from app.api.core.custom_exceptions.exceptions import ValidationError
from app.api.modules.v1.manufacturing.service.risk_types import (
    FACTOR_CODES,
    FACTORS,
    Reading,
)

LEVELS = ("Low", "Moderate", "High", "Critical")
BAND_KEYS = ("moderate", "high", "critical")


def _is_number(value: Any) -> bool:
    """A real, finite number (booleans, NaN and infinity are not valid settings)."""
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def validate_config(config: dict[str, Any]) -> None:
    """
    Check a weight set before it is stored.

    Raises:
        ValidationError: With every problem found, in plain language.
    """
    problems: list[str] = []
    weights, ramps = config.get("weights", {}), config.get("ramps", {})
    if set(weights) != set(FACTOR_CODES):
        problems.append(f"Weights must be given for exactly these factors: {list(FACTOR_CODES)}.")
    elif any(not _is_number(w) or w < 0 for w in weights.values()):
        problems.append("Every weight must be a number of zero or more.")
    elif abs(sum(weights.values()) - 100) > 1e-9:
        problems.append(f"Weights must add up to 100 (they add up to {sum(weights.values()):g}).")
    if set(ramps) != set(FACTOR_CODES):
        problems.append("A scale (low and high value) is needed for every factor.")
    else:
        for code, ramp in ramps.items():
            if len(ramp) != 2 or not all(_is_number(v) for v in ramp) or ramp[0] == ramp[1]:
                problems.append(f"The scale for '{code}' needs two different numbers.")
    bands = config.get("bands", {})
    values = [bands.get(k) for k in BAND_KEYS]
    if not all(_is_number(v) for v in values) or not 0 < values[0] < values[1] < values[2] <= 100:
        problems.append("Risk bands must increase: 0 < moderate < high < critical <= 100.")
    minimum = config.get("min_evaluable_weight")
    if not _is_number(minimum) or not 0 <= minimum <= 100:
        problems.append("The minimum data coverage must be between 0 and 100.")
    if problems:
        raise ValidationError(" ".join(problems))


def sub_score(value: float, low: float, high: float) -> float:
    """0 at `low`, 1 at `high`, linear between, held at 0 and 1 beyond."""
    return min(1.0, max(0.0, (value - low) / (high - low)))


def level_for(score: float, bands: dict[str, float]) -> str:
    if score >= bands["critical"]:
        return LEVELS[3]
    if score >= bands["high"]:
        return LEVELS[2]
    if score >= bands["moderate"]:
        return LEVELS[1]
    return LEVELS[0]


def _fmt(value: float, unit: str) -> str:
    return f"{value:g}{unit}"


def _explain(
    code: str, reading: Reading, low: float, high: float, sub: float, points: float
) -> str:
    unit = FACTORS[code].unit
    return (
        f"{reading.detail} On this factor's scale ({_fmt(low, unit)} scores 0, {_fmt(high, unit)} "
        f"scores 1) that is {sub:.2f}, which adds {points:.1f} points to the score."
    )


def score_material(readings: dict[str, Reading], config: dict[str, Any]) -> dict[str, Any]:
    """
    Score one material from its factor readings and a weight set.

    Returns:
        status ("scored" or "insufficient_data"), score (0-100 or None), level, data coverage,
        every factor with its value, weight, sub-score, points and explanation, and a summary.
    """
    weights, ramps = config["weights"], config["ramps"]
    evaluable = {c for c in FACTOR_CODES if readings[c].raw is not None and weights[c] > 0}
    total_weight = sum(weights.values())
    evaluable_weight = sum(weights[c] for c in evaluable)
    coverage = evaluable_weight / total_weight * 100 if total_weight else 0.0
    scored = bool(evaluable) and coverage >= config["min_evaluable_weight"]

    factors, score = [], 0.0
    for code in FACTOR_CODES:
        reading, (low, high) = readings[code], ramps[code]
        info = FACTORS[code]
        entry: dict[str, Any] = {
            "code": code,
            "name": info.name,
            "weight": weights[code],
            "value": reading.raw,
            "unit": info.unit.strip(),
            "scale": {"low": low, "high": high},
        }
        if code in evaluable and scored:
            sub = sub_score(reading.raw, low, high)
            points = 100 * weights[code] * sub / evaluable_weight
            score += points
            entry.update(
                status="evaluated",
                sub_score=sub,
                effective_weight_pct=100 * weights[code] / evaluable_weight,
                points=points,
                explanation=_explain(code, reading, low, high, sub, points),
            )
        else:
            note = reading.detail if reading.raw is None else "This factor has zero weight."
            entry.update(
                status="not_evaluable",
                sub_score=None,
                effective_weight_pct=0.0,
                points=0.0,
                explanation=f"Not used: {note}",
            )
        factors.append(entry)

    score = round(score, 4)  # the level is taken from the stored (rounded) score
    result: dict[str, Any] = {
        "status": "scored" if scored else "insufficient_data",
        "score": score if scored else None,
        "level": level_for(score, config["bands"]) if scored else None,
        "data_coverage_pct": round(coverage, 2),
        "factors": factors,
    }
    result["summary"] = _summary(result, config)
    return result


def _summary(result: dict[str, Any], config: dict[str, Any]) -> str:
    if result["status"] != "scored":
        return (
            f"No score: only {result['data_coverage_pct']:.0f}% of the weighting has data; "
            f"at least {config['min_evaluable_weight']:g}% is needed."
        )
    used = [f for f in result["factors"] if f["status"] == "evaluated"]
    top = sorted(used, key=lambda f: -f["points"])[:3]
    drivers = ", ".join(f"{f['name']} ({f['points']:.1f})" for f in top if f["points"] > 0)
    skipped = len(result["factors"]) - len(used)
    text = f"Score {result['score']:.1f} of 100 ({result['level']})."
    text += f" Main drivers: {drivers}." if drivers else " No factor adds to the score."
    if skipped:
        text += f" {skipped} of {len(result['factors'])} factors could not be evaluated."
    return text
