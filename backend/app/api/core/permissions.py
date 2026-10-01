"""
Centralized RBAC Permissions Registry.
Single source of truth for all roles, display labels, and permission group presets.
"""

from enum import StrEnum


class Role(StrEnum):
    """Canonical system roles. Values are lowercase for case-insensitive matching."""

    ADMIN = "admin"
    REVIEWER = "reviewer"
    VERIFIER = "verifier"
    PROCESS_OWNER = "process_owner"
    READ_ONLY_REVIEWER = "read_only_reviewer"

    # Deprecated legacy roles — preserved for backward compatibility
    COMPLIANCE = "compliance"
    CFO = "cfo"
    SECURITY = "security"
    PROCUREMENT = "procurement"


ROLE_LABELS: dict[Role, str] = {
    Role.ADMIN: "System Administrator",
    Role.REVIEWER: "Risk Reviewer",
    Role.VERIFIER: "Compliance Verifier",
    Role.PROCESS_OWNER: "Process Owner",
    Role.READ_ONLY_REVIEWER: "Read-Only Reviewer",
    Role.COMPLIANCE: "Compliance Lead",
    Role.CFO: "Executive Leadership",
    Role.SECURITY: "Security Analyst",
    Role.PROCUREMENT: "Procurement Specialist",
}


# ── Role Groups ─────────────────────────────────────────────────────────────

CORE_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
    Role.VERIFIER,
    Role.PROCESS_OWNER,
]
"""The four core roles of the TRIS v1.4 RBAC model."""

DEPRECATED_ROLES: list[Role] = [
    Role.COMPLIANCE,
    Role.CFO,
    Role.SECURITY,
    Role.PROCUREMENT,
]
"""Deprecated roles preserved for legacy backward compatibility."""

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
    Role.PROCESS_OWNER,
    Role.ADMIN,
]
"""Roles permitted to execute case state transitions."""

CASE_VERIFICATION_ROLES: list[Role] = [
    Role.VERIFIER,
    Role.ADMIN,
]
"""Roles permitted to independently verify and close cases."""


# ── Manufacturing & Analytics Capability Scaffolding (v2.0 D7) ───────────────

MANUFACTURING_INGESTION_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
]
"""Roles permitted to upload/ingest manufacturing and ERP/BOM data."""

ANALYTICS_EXECUTION_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
]
"""Roles permitted to run material cost analytics, forecasting, and scenario models."""

VALIDATION_RUN_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
]
"""Roles permitted to execute model validation benchmark runs."""

MANUFACTURING_CONFIG_ROLES: list[Role] = [
    Role.ADMIN,
]
"""Roles permitted to configure models/versions, mapping profiles, and dataset registries."""

ANALYTICS_EXPORT_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
]
"""Roles permitted to export approved analytical outputs."""

MANUFACTURING_VIEW_ROLES: list[Role] = [
    Role.ADMIN,
    Role.REVIEWER,
    Role.READ_ONLY_REVIEWER,
]
"""Roles that may open the Manufacturing section and read its results (mirrors the UI)."""

READ_ONLY_ROLES: list[Role] = [
    Role.READ_ONLY_REVIEWER,
]
"""Roles restricted to pure read-only access (no write/execution permissions)."""

NON_READ_ONLY_ROLES: list[Role] = [r for r in Role if r not in READ_ONLY_ROLES]
"""Every role except read-only ones; keeps pre-v2.0 access open for all existing roles."""
