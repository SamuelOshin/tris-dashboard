"""
The demo accounts a visitor may sign in as with one click (only when DEMO_LOGIN_ENABLED is on).

The list holds no passwords. Each entry names a seeded demo user; the seed script creates them.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DemoAccount:
    """One role a demo visitor can sign in as."""

    key: str
    username: str
    label: str
    description: str


DEMO_ACCOUNTS: tuple[DemoAccount, ...] = (
    DemoAccount(
        "admin",
        "admin",
        "Administrator",
        "Everything, including the Administration page and the audit log.",
    ),
    DemoAccount(
        "reviewer",
        "reviewer",
        "Risk reviewer",
        "Imports data, runs forecasts and scoring, opens and investigates cases.",
    ),
    DemoAccount(
        "read_only_reviewer",
        "readonly",
        "Read-only reviewer",
        "Sees every result and document; cannot change anything.",
    ),
    DemoAccount(
        "verifier",
        "verifier",
        "Compliance verifier",
        "Verifies and closes cases, but not cases they investigated.",
    ),
    DemoAccount(
        "process_owner",
        "process_owner",
        "Process owner",
        "Works cases through to corrective action; sees no Manufacturing section.",
    ),
)

BY_KEY: dict[str, DemoAccount] = {a.key: a for a in DEMO_ACCOUNTS}
