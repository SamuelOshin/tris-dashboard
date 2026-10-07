"""
The case study document quotes the stored expected figures.

`docs/CASE_STUDY_01.md` is generated from `docs/case_study/CASE_STUDY_01_expected.json`. This test
fails if the document and the figures drift apart (for example after the figures are regenerated and
the document is not), so a reader following the document is always checking against the same numbers
the automated reproduction test checks.
"""

import json

from app.scripts import case_study

DOC = case_study.REPO / "docs" / "CASE_STUDY_01.md"


def _doc() -> str:
    return DOC.read_text(encoding="utf-8")


def _expected() -> dict:
    return json.loads(case_study.EXPECTED.read_text(encoding="utf-8"))


def test_every_import_count_is_in_the_document():
    text = _doc()
    for target, row in _expected()["imports"].items():
        line = f"| {target.replace('_', ' ')} | {row['accepted']} | {row['rejected']} |"
        assert line in text, line


def test_the_detection_forecast_exposure_and_risk_figures_are_in_the_document():
    text, d = _doc(), _expected()
    material = case_study.MATERIAL
    quoted = [
        d["detection"]["latest_price"],
        d["detection"]["standard_cost"],
        d["detection"]["vs_standard_pct"],
        d["detection"]["coverage_days"],
        d["exposure"]["baseline_unit_cost"],
        d["exposure"]["forecast_unit_cost"],
        d["exposure"]["scenario_price_plus_10pct"]["unit_cost"],
    ]
    for horizon in ("30", "90"):
        f = d["forecast"][material][horizon]
        quoted += [f["forecast"], f["lower"], f["upper"], f["change_pct"]]
    for value in quoted:
        assert str(value).rstrip("0").rstrip(".") in text or str(value) in text, value
    assert f"{d['exposure']['expected_usage']:,.1f}" in text
    assert f"${d['exposure']['projected_exposure']:,.2f}" in text
    assert f"${d['exposure']['scenario_price_plus_10pct']['exposure']:,.2f}" in text
    for key in ("risk_default_weights", "risk_high_band_40"):
        for name, (score, level) in d[key]["scores"].items():
            assert f"| {name} | {score} | {level} |" in text, (key, name)


def test_the_case_and_validation_figures_are_in_the_document():
    text, d = _doc(), _expected()
    case = d["case"]
    assert " → ".join(case["history"]) in text
    for status, code in case["closure_refused"].values():
        assert f"HTTP {status}, `{code}`" in text
    assert str(case["stored_score"]) in text
    for days, h in d["validation"]["by_horizon"].items():
        assert f"{h['mape_pct']}%" in text, days
        tp, fp, fn, tn = h["tp_fp_fn_tn"]
        assert f"{h['events']} of {h['judged']}" in text, days
        assert str(tp) in text and str(fp) in text and str(fn) in text and str(tn) in text
    assert f"Method version {d['validation']['method']}" in text
