"""
Centralized RBAC Permissions Registry.
Single source of truth for all roles, display labels, and permission group presets.
"""

from enum import StrEnum


class Role(StrEnum):
    """Canonical system roles. Values are lowercase for case-insensitive matching."""

    ADMIN = "admin"
    COMPLIANCE = "compliance"
    REVIEWER = "reviewer"
    VERIFIER = "verifier"
    CFO = "cfo"
    SECURITY = "security"
    PROCUREMENT = "procurement"


ROLE_LABELS: dict[Role, str] = {
    Role.ADMIN: "System Administrator",
    Role.COMPLIANCE: "Compliance Lead",
    Role.REVIEWER: "Risk Reviewer",
    Role.VERIFIER: "Compliance Verifier",
    Role.CFO: "Executive Leadership",
    Role.SECURITY: "Security Analyst",
    Role.PROCUREMENT: "Procurement Specialist",
}


# ── Pre-built permission groups ─────────────────────────────────────
# Semantic constants for role combinations used across modules.

ALL_ROLES: list[Role] = list(Role)
"""Every authenticated role — functionally equivalent to any authenticated user."""

PRIVILEGED_ROLES: list[Role] = [Role.ADMIN, Role.COMPLIANCE]
"""Admin + Compliance — full data visibility, rule editing, job oversight."""

WRITE_ROLES: list[Role] = [Role.ADMIN, Role.COMPLIANCE, Role.REVIEWER]
"""Roles permitted to ingest data and perform write operations."""

CASE_READ_ROLES: list[Role] = list(Role)
"""Roles permitted to read case data."""

CASE_TRANSITION_ROLES: list[Role] = [
    Role.REVIEWER,
    Role.VERIFIER,
    Role.ADMIN,
    Role.COMPLIANCE,
]
"""Roles permitted to execute case state transitions."""
