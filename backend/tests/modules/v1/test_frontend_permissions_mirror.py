"""
The front end shows each role's limits up front (a disabled button and a short reason). Those lists
are copied from the server's, so this test fails if the two drift apart: a button that is enabled
for a role the server refuses, or disabled for a role the server allows.
"""

import re
from pathlib import Path

from app.api.core import permissions as server

FRONTEND = Path(__file__).resolve().parents[4] / "frontend" / "lib" / "permissions.ts"


def frontend_roles(name: str) -> set[str]:
    text = FRONTEND.read_text(encoding="utf-8")
    match = re.search(rf"export const {name} = \[([^\]]*)\]", text)
    assert match, f"{name} not found in frontend/lib/permissions.ts"
    return set(re.findall(r"'([a-z_]+)'", match.group(1)))


def values(roles) -> set[str]:
    return {r.value for r in roles}


def test_who_may_import_matches_the_server():
    assert frontend_roles("IMPORT_ROLES") == values(server.WRITE_ROLES)


def test_who_may_work_a_case_matches_the_server():
    assert frontend_roles("CASE_WORK_ROLES") == values(server.CASE_TRANSITION_ROLES)


def test_who_may_close_a_case_matches_the_server():
    assert frontend_roles("CASE_CLOSE_ROLES") == values(server.CASE_VERIFICATION_ROLES)


def test_the_read_only_reviewer_is_in_none_of_the_write_lists():
    for name in ("IMPORT_ROLES", "CASE_WORK_ROLES", "CASE_CLOSE_ROLES"):
        assert "read_only_reviewer" not in frontend_roles(name)


def test_who_is_read_only_matches_the_server():
    assert frontend_roles("READ_ONLY_ROLES") == values(server.READ_ONLY_ROLES)
