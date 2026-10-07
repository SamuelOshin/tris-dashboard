"""
Ticket 13 — the case study is reproducible.

Runs every step of docs/CASE_STUDY_01.md (the same code as `python -m app.scripts.case_study`)
through an in-process client on an empty database and requires each figure to equal the one stored
in docs/case_study/CASE_STUDY_01_expected.json, which is what the document quotes.
"""

import json
from contextlib import asynccontextmanager

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.scripts import case_study
from tests.conftest import make_principal
from tests.modules.v1.transfer_env import add_suppliers

PRINCIPALS = {
    "reviewer": make_principal("USR-CS-REV", "cs_reviewer", "Case Reviewer", "reviewer"),
    "admin": make_principal("USR-CS-ADM", "cs_admin", "Case Admin", "admin"),
    "verifier": make_principal("USR-CS-VER", "cs_verifier", "Case Verifier", "verifier"),
}


@pytest.mark.db
@pytest.mark.asyncio
async def test_case_study_01_reproduces_every_documented_figure(
    client_as, db_session: AsyncSession
):
    await add_suppliers(db_session, tuple((s, f"{s} Ltd", "Solar") for s in case_study.SUPPLIERS))
    for person in PRINCIPALS.values():  # imports and cases record who did them, so the users exist
        person.hashed_password = "not-a-real-hash"
        db_session.add(person)
    await db_session.commit()

    @asynccontextmanager
    async def as_role(role: str):
        principal = PRINCIPALS[role]
        async with client_as(principal) as client:
            yield case_study.Actor(client, principal.name)

    logged: list[str] = []
    results = await case_study.run_case_study(as_role, log=logged.append)
    expected = json.loads(case_study.EXPECTED.read_text(encoding="utf-8"))

    assert case_study.differences(expected, results) == []
    # the claims the document makes in words, not only numbers
    assert results["exposure"]["baseline_unchanged_by_scenario"] is True
    refused = results["case"]["closure_refused"]
    assert refused["reviewer"] == [403, "PERMISSION_DENIED"]  # the role rule
    assert refused["participating_admin"] == [403, "SEPARATION_OF_DUTIES_VIOLATION"]  # the SoD rule
    assert results["case"]["replay_reproduces_stored_score"] is True
    assert results["risk_default_weights"]["weight_version"] == 1
    assert results["risk_high_band_40"]["weight_version"] == 2
    assert all(i["rejected"] == 0 for i in results["imports"].values())
    assert len(logged) == len(case_study.STEPS) * 2


def test_the_comparison_reports_a_changed_figure():
    assert case_study.differences({"a": [1.0, "x"]}, {"a": [1.0, "x"]}) == []
    assert case_study.differences({"a": [1.0, "x"]}, {"a": [1.5, "x"]}) == [
        "/a[0]: expected 1.0, got 1.5"
    ]
    assert case_study.differences({"a": 1}, {"a": 1, "b": 2}) == ["/b: expected None, got 2"]
