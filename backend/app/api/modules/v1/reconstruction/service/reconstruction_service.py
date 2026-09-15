"""Historical Reconstruction Service — TRIS v1.4.

Core invariant: NEVER use information created after the event_timestamp to determine
historical state. This is the single most important rule in this entire module.

Every reconstructed fact carries provenance (source_record_id, source_table,
effective_from, recorded_at). UNKNOWN is returned when required evidence is
missing — it is never treated as PASS.

Architecture:
    - Pure business logic. No HTTP layer. No try-except.
    - Raises domain exceptions directly.
    - Read-only against original case/transaction/approval/supplier tables.
    - Writes only to reconstruction_snapshots (append-only, no FK to mutable fields).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.reconstruction.models.reconstruction_snapshot import ReconstructionSnapshot
from app.api.modules.v1.reconstruction.schemas.reconstruction_schemas import (
    AccessStateAtEvent,
    ApplicableRuleAtEvent,
    ApprovalStateAtEvent,
    EvidenceCompleteness,
    ProvenanceFact,
    ReconstructionResult,
    SupplierStateAtEvent,
    TransactionStateAtEvent,
)
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction


def _to_utc(dt: datetime | None) -> datetime | None:
    """Normalize a datetime to UTC, adding tzinfo if naive."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


# ---------------------------------------------------------------------------
# LEVEL HIERARCHY — used by approval evaluation
# ---------------------------------------------------------------------------
LEVEL_RANKS: dict[str, int] = {"Level 1": 1, "Level 2": 2, "Level 3": 3}

# Amount threshold above which Level 2 approval is required (per R-007 spec)
HIGH_VALUE_THRESHOLD = 50_000.0

# Bank-change recency window (days) for the remediation replay control (Sec 7)
BANK_CHANGE_RECENCY_DAYS = 7


class HistoricalReconstructionService:
    """Service that reconstructs cross-system state at an arbitrary event timestamp.

    No hindsight leakage: only facts recorded at or before event_timestamp
    are included in any determination. Facts recorded after are tracked
    separately as "excluded late evidence" for transparency.
    """

    # ------------------------------------------------------------------
    # PUBLIC ENTRY POINT
    # ------------------------------------------------------------------

    @staticmethod
    async def reconstruct(
        transaction_id: str,
        event_timestamp: datetime,
        session: AsyncSession,
        case_id: str | None = None,
        persist: bool = True,
    ) -> ReconstructionResult:
        """Reconstruct all relevant state as of event_timestamp for a transaction.

        Args:
            transaction_id: The transaction to reconstruct.
            event_timestamp: The exact timestamp to reconstruct state at.
                             Facts after this point are excluded.
            session: Active async database session (read-write for persisting snapshot).
            case_id: Optional associated risk case ID for traceability.
            persist: If True, writes an append-only snapshot to reconstruction_snapshots.

        Returns:
            ReconstructionResult with PASS | FAIL | UNKNOWN outcome and full provenance.
        """
        # Normalize event_timestamp to UTC
        et = _to_utc(event_timestamp)
        assert et is not None  # guaranteed by normalization above

        # 1. Reconstruct each domain
        (
            transaction_state,
            tx_completeness,
        ) = await HistoricalReconstructionService._reconstruct_transaction(
            transaction_id, et, session
        )
        (
            supplier_state,
            sup_completeness,
        ) = await HistoricalReconstructionService._reconstruct_supplier(
            transaction_state, et, session
        )
        (
            approval_state,
            app_completeness,
        ) = await HistoricalReconstructionService._reconstruct_approvals(
            transaction_id, et, session
        )
        (
            access_state,
            access_completeness,
        ) = await HistoricalReconstructionService._reconstruct_access(
            transaction_state, et, session
        )
        rule_state, rule_completeness = await HistoricalReconstructionService._reconstruct_rule(
            et, session
        )

        # 2. Determine overall evidence completeness
        completeness_map = {
            "supplier_state": sup_completeness,
            "approval_state": app_completeness,
            "access_state": access_completeness,
            "transaction_state": tx_completeness,
            "rule_version": rule_completeness,
        }
        all_values = list(completeness_map.values())
        if "MISSING" in all_values:
            overall = "MISSING"
        elif "PARTIAL" in all_values:
            overall = "PARTIAL"
        else:
            overall = "COMPLETE"

        evidence_completeness = EvidenceCompleteness(
            **completeness_map,
            overall=overall,
        )

        # 3. Determine PASS / FAIL / UNKNOWN
        outcome, explanation = HistoricalReconstructionService._determine_outcome(
            transaction_state=transaction_state,
            approval_state=approval_state,
            supplier_state=supplier_state,
            rule_state=rule_state,
            evidence_completeness=evidence_completeness,
            event_timestamp=et,
        )

        # 4. Build result
        result = ReconstructionResult(
            transaction_id=transaction_id,
            case_id=case_id,
            event_timestamp=et,
            outcome=outcome,
            explanation=explanation,
            supplier_state=supplier_state,
            approval_state=approval_state,
            access_state=access_state,
            transaction_state=transaction_state,
            applicable_rule=rule_state,
            evidence_completeness=evidence_completeness,
        )

        # 5. Persist append-only snapshot
        if persist:
            snapshot_id = await HistoricalReconstructionService._persist_snapshot(result, session)
            result.snapshot_id = snapshot_id

        return result

    # ------------------------------------------------------------------
    # DOMAIN RECONSTRUCTION METHODS
    # ------------------------------------------------------------------

    @staticmethod
    async def _reconstruct_transaction(
        transaction_id: str,
        event_timestamp: datetime,
        session: AsyncSession,
    ) -> tuple[TransactionStateAtEvent | None, str]:
        """Reconstruct transaction state as-of event_timestamp.

        Returns:
            (TransactionStateAtEvent | None, completeness: "COMPLETE" | "MISSING")
        """
        tx = await session.get(Transaction, transaction_id)
        if tx is None:
            return None, "MISSING"

        provenance = [
            ProvenanceFact(
                field="transaction",
                value=transaction_id,
                source_record_id=tx.transaction_id,
                source_table="transactions",
                effective_from=_to_utc(tx.created_at),
                recorded_at=_to_utc(tx.created_at),
            )
        ]

        state = TransactionStateAtEvent(
            transaction_id=tx.transaction_id,
            amount=tx.amount,
            currency=tx.currency,
            invoice_date=tx.invoice_date.isoformat() if tx.invoice_date else "",
            approval_required=tx.approval_required,
            approval_status_at_event=tx.approval_status,
            provenance=provenance,
        )
        return state, "COMPLETE"

    @staticmethod
    async def _reconstruct_supplier(
        transaction_state: TransactionStateAtEvent | None,
        event_timestamp: datetime,
        session: AsyncSession,
    ) -> tuple[SupplierStateAtEvent | None, str]:
        """Reconstruct supplier master-data state as-of event_timestamp.

        Returns:
            (SupplierStateAtEvent | None, completeness)
        """
        if transaction_state is None:
            return None, "MISSING"

        # Look up supplier via transaction_id
        tx_result = await session.execute(
            select(Transaction).where(
                Transaction.transaction_id == transaction_state.transaction_id
            )
        )
        tx = tx_result.scalar_one_or_none()
        if tx is None:
            return None, "MISSING"

        supplier = await session.get(Supplier, tx.supplier_id)
        if supplier is None:
            return None, "MISSING"

        # Determine if bank change was within 7 days before the event
        bank_change_within_window = False
        bank_change_date_iso: str | None = None
        if supplier.bank_change_date:
            bank_change_dt = datetime(
                supplier.bank_change_date.year,
                supplier.bank_change_date.month,
                supplier.bank_change_date.day,
                tzinfo=UTC,
            )
            bank_change_date_iso = supplier.bank_change_date.isoformat()
            # Only count bank change if it was before or at the event timestamp
            if bank_change_dt <= event_timestamp:
                days_diff = (event_timestamp - bank_change_dt).days
                bank_change_within_window = days_diff <= BANK_CHANGE_RECENCY_DAYS

        provenance = [
            ProvenanceFact(
                field="supplier_master",
                value=supplier.supplier_id,
                source_record_id=supplier.supplier_id,
                source_table="suppliers",
                effective_from=_to_utc(supplier.created_at),
                recorded_at=_to_utc(supplier.created_at),
            )
        ]
        if supplier.bank_change_date:
            provenance.append(
                ProvenanceFact(
                    field="bank_change_date",
                    value=bank_change_date_iso,
                    source_record_id=supplier.supplier_id,
                    source_table="suppliers",
                    effective_from=datetime(
                        supplier.bank_change_date.year,
                        supplier.bank_change_date.month,
                        supplier.bank_change_date.day,
                        tzinfo=UTC,
                    ),
                    recorded_at=_to_utc(supplier.created_at),
                )
            )

        state = SupplierStateAtEvent(
            supplier_id=supplier.supplier_id,
            name=supplier.name,
            category=supplier.category,
            risk_tier=supplier.risk_tier,
            bank_change_date=bank_change_date_iso,
            bank_changed_within_7_days=bank_change_within_window,
            provenance=provenance,
        )
        return state, "COMPLETE"

    @staticmethod
    async def _reconstruct_approvals(
        transaction_id: str,
        event_timestamp: datetime,
        session: AsyncSession,
    ) -> tuple[ApprovalStateAtEvent | None, str]:
        """Reconstruct approval state as-of event_timestamp.

        CRITICAL: Approvals recorded AFTER event_timestamp are strictly excluded
        from the effective state. They are listed in excluded_late_approvals for
        transparency/provenance, but NEVER used in the outcome determination.

        Returns:
            (ApprovalStateAtEvent | None, completeness)
        """
        result = await session.execute(
            select(Approval).where(Approval.transaction_id == transaction_id)
        )
        all_approvals = list(result.scalars().all())

        if not all_approvals:
            # No approvals exist at all — this is not automatically UNKNOWN
            # (the transaction may genuinely have no approval records)
            return ApprovalStateAtEvent(
                effective_approvals=[],
                excluded_late_approvals=[],
                highest_effective_level=None,
                provenance=[
                    ProvenanceFact(
                        field="approval_records",
                        value="no_approvals_found",
                        source_record_id=transaction_id,
                        source_table="approvals",
                        effective_from=None,
                        recorded_at=None,
                    )
                ],
            ), "MISSING"

        effective_approvals: list[dict[str, Any]] = []
        excluded_late_approvals: list[dict[str, Any]] = []
        provenance: list[ProvenanceFact] = []

        for ap in all_approvals:
            ap_date_utc = _to_utc(ap.approval_date)

            if ap_date_utc is not None and ap_date_utc <= event_timestamp:
                # Effective: recorded at or before event timestamp
                effective_approvals.append(
                    {
                        "approval_id": ap.approval_id,
                        "required_level": ap.required_level,
                        "approver_name": ap.approver_name,
                        "approver_role": ap.approver_role,
                        "approval_status": ap.approval_status,
                        "approval_date": ap_date_utc.isoformat() if ap_date_utc else None,
                        "notes": ap.notes,
                    }
                )
                provenance.append(
                    ProvenanceFact(
                        field="effective_approval",
                        value=ap.approval_id,
                        source_record_id=ap.approval_id,
                        source_table="approvals",
                        effective_from=ap_date_utc,
                        recorded_at=_to_utc(ap.created_at),
                    )
                )
            else:
                # Late: excluded from the historical state determination
                excluded_late_approvals.append(
                    {
                        "approval_id": ap.approval_id,
                        "required_level": ap.required_level,
                        "approver_name": ap.approver_name,
                        "approver_role": ap.approver_role,
                        "approval_status": ap.approval_status,
                        "approval_date": ap_date_utc.isoformat() if ap_date_utc else None,
                        "exclusion_reason": (
                            f"Recorded after event_timestamp ({event_timestamp.isoformat()})"
                        ),
                        "notes": ap.notes,
                    }
                )
                provenance.append(
                    ProvenanceFact(
                        field="excluded_late_approval",
                        value=ap.approval_id,
                        source_record_id=ap.approval_id,
                        source_table="approvals",
                        effective_from=ap_date_utc,
                        recorded_at=_to_utc(ap.created_at),
                    )
                )

        # Determine highest effective approval level
        highest_level: str | None = None
        if effective_approvals:
            effective_levels = [
                a["required_level"] for a in effective_approvals if a.get("required_level")
            ]
            if effective_levels:
                highest_level = max(effective_levels, key=lambda lv: LEVEL_RANKS.get(lv, 0))

        state = ApprovalStateAtEvent(
            effective_approvals=effective_approvals,
            excluded_late_approvals=excluded_late_approvals,
            highest_effective_level=highest_level,
            provenance=provenance,
        )
        completeness = "COMPLETE" if effective_approvals or excluded_late_approvals else "MISSING"
        return state, completeness

    @staticmethod
    async def _reconstruct_access(
        transaction_state: TransactionStateAtEvent | None,
        event_timestamp: datetime,
        session: AsyncSession,
    ) -> tuple[AccessStateAtEvent | None, str]:
        """Reconstruct access/authority state as-of event_timestamp.

        An access event is considered active if its event_time <= event_timestamp
        and the grant hasn't been revoked before the event_timestamp.

        Uses paired GRANT / REVOKE events to determine active window.

        Returns:
            (AccessStateAtEvent | None, completeness)
        """
        if transaction_state is None:
            return None, "MISSING"

        tx_result = await session.execute(
            select(Transaction).where(
                Transaction.transaction_id == transaction_state.transaction_id
            )
        )
        tx = tx_result.scalar_one_or_none()
        if tx is None:
            return None, "MISSING"

        # Fetch all access events for this supplier at or before event_timestamp
        result = await session.execute(
            select(AccessEvent).where(AccessEvent.supplier_id == tx.supplier_id)
        )
        all_events = list(result.scalars().all())

        # Partition into pre-event events and post-event events
        pre_events = [
            e
            for e in all_events
            if _to_utc(e.event_time) is not None and _to_utc(e.event_time) <= event_timestamp  # type: ignore[operator]
        ]

        # Determine if elevated access was active: a GRANT exists with no paired REVOKE by event_ts
        grant_actions = {"ELEVATED_ACCESS_GRANT", "ACCESS_GRANT", "GRANT"}
        revoke_actions = {"ELEVATED_ACCESS_REVOKE", "ACCESS_REVOKE", "REVOKE"}

        active_grants: list[dict[str, Any]] = []
        for evt in pre_events:
            if evt.action in grant_actions:
                # Check if a revoke for this user/resource pair exists before event_timestamp
                paired_revoke = any(
                    rev.action in revoke_actions
                    and rev.user_id == evt.user_id
                    and rev.resource == evt.resource
                    and _to_utc(rev.event_time) is not None
                    and _to_utc(rev.event_time) <= event_timestamp  # type: ignore[operator]
                    for rev in pre_events
                )
                if not paired_revoke:
                    active_grants.append(
                        {
                            "event_id": evt.event_id,
                            "user_id": evt.user_id,
                            "action": evt.action,
                            "resource": evt.resource,
                            "event_time": _to_utc(evt.event_time).isoformat()
                            if _to_utc(evt.event_time)
                            else None,
                            "system": evt.system,
                        }
                    )

        provenance = [
            ProvenanceFact(
                field="access_event",
                value=evt["event_id"],
                source_record_id=evt["event_id"],
                source_table="access_events",
                effective_from=datetime.fromisoformat(evt["event_time"])
                if evt.get("event_time")
                else None,
                recorded_at=datetime.fromisoformat(evt["event_time"])
                if evt.get("event_time")
                else None,
            )
            for evt in active_grants
        ]

        state = AccessStateAtEvent(
            elevated_access_active=len(active_grants) > 0,
            active_access_events=active_grants,
            provenance=provenance,
        )
        completeness = "COMPLETE" if pre_events else "PARTIAL"
        return state, completeness

    @staticmethod
    async def _reconstruct_rule(
        event_timestamp: datetime,
        session: AsyncSession,
    ) -> tuple[ApplicableRuleAtEvent | None, str]:
        """Reconstruct the rule version applicable at event_timestamp.

        For now, fetches R-007 (the temporal approval rule). In future, this
        can be extended to reconstruct the exact rule version based on updated_at.

        Returns:
            (ApplicableRuleAtEvent | None, completeness)
        """
        result = await session.execute(select(RuleConfig).where(RuleConfig.rule_code == "R-007"))
        rule = result.scalar_one_or_none()

        if rule is None:
            return None, "MISSING"

        # Determine applicable rule version at event_timestamp.
        # Since we currently version rules with a simple integer counter (no updated_at history),
        # we use the current version. If updated_at is after event_timestamp, we note PARTIAL.
        completeness = "COMPLETE"
        rule_updated_at_utc = _to_utc(rule.updated_at)
        if rule_updated_at_utc and rule_updated_at_utc > event_timestamp:
            # Rule was modified after the event — we're using a newer version
            # This is "PARTIAL" because we can't guarantee the exact historical params
            completeness = "PARTIAL"

        provenance = [
            ProvenanceFact(
                field="rule_version",
                value=rule.rule_version,
                source_record_id=rule.rule_code,
                source_table="rule_configs",
                effective_from=None,  # Rule effective_from not yet modeled historically
                recorded_at=rule_updated_at_utc,
            )
        ]

        state = ApplicableRuleAtEvent(
            rule_code=rule.rule_code,
            rule_name=rule.name,
            rule_version=rule.rule_version,
            threshold_params=rule.threshold_params,
            provenance=provenance,
        )
        return state, completeness

    # ------------------------------------------------------------------
    # OUTCOME DETERMINATION
    # ------------------------------------------------------------------

    @staticmethod
    def _determine_outcome(
        transaction_state: TransactionStateAtEvent | None,
        approval_state: ApprovalStateAtEvent | None,
        supplier_state: SupplierStateAtEvent | None,
        rule_state: ApplicableRuleAtEvent | None,
        evidence_completeness: EvidenceCompleteness,
        event_timestamp: datetime,
    ) -> tuple[str, str]:
        """Determine the event-time control outcome.

        Returns:
            (outcome, explanation) where outcome is "PASS" | "FAIL" | "UNKNOWN".

        Rules:
            - If any critical domain is MISSING → UNKNOWN (never defaults to PASS).
            - If approval evidence is MISSING → UNKNOWN.
            - If required approval level not satisfied by effective approvals → FAIL.
            - If all checks pass → PASS.
        """
        # Critical domains that must be COMPLETE for a PASS/FAIL determination
        if evidence_completeness.transaction_state == "MISSING":
            return (
                "UNKNOWN",
                "Unable to determine outcome: transaction record was not found or did not exist "
                "at the specified event timestamp.",
            )

        if evidence_completeness.approval_state == "MISSING":
            return (
                "UNKNOWN",
                "Unable to determine outcome: no approval records were found for this transaction. "
                "Missing required evidence — returning UNKNOWN, not PASS.",
            )

        if transaction_state is None or approval_state is None:
            return (
                "UNKNOWN",
                "Insufficient historical evidence to make a determination.",
            )

        # Determine required approval level based on amount
        required_level = (
            "Level 2" if transaction_state.amount >= HIGH_VALUE_THRESHOLD else "Level 1"
        )
        req_rank = LEVEL_RANKS.get(required_level, 2)

        # Check if any effective (pre-event) approved approval satisfies the required level
        valid_effective = [
            a
            for a in approval_state.effective_approvals
            if a.get("approval_status") == "Approved"
            and LEVEL_RANKS.get(a.get("required_level", ""), 0) >= req_rank
        ]

        if valid_effective:
            # PASS — required approval was in place before the event
            highest_used = max(
                (a.get("required_level", "") for a in valid_effective),
                key=lambda lv: LEVEL_RANKS.get(lv, 0),
            )
            return (
                "PASS",
                f"At event time {event_timestamp.strftime('%Y-%m-%d %H:%M')} UTC, "
                f"transaction amount ${transaction_state.amount:,.2f} required {required_level}. "
                f"Effective pre-event approval at {highest_used} satisfied the requirement.",
            )
        else:
            # FAIL — required approval was NOT in place before the event
            excluded_count = len(approval_state.excluded_late_approvals)
            effective_levels = [
                a.get("required_level", "None") for a in approval_state.effective_approvals
            ]

            if excluded_count > 0 and not approval_state.effective_approvals:
                explanation = (
                    f"CONTROL FAILED at event time "
                    f"{event_timestamp.strftime('%Y-%m-%d %H:%M')} UTC. "
                    f"Transaction of ${transaction_state.amount:,.2f} required "
                    f"{required_level} approval before execution. "
                    f"Zero approvals existed at event time. "
                    f"{excluded_count} approval(s) were recorded AFTER the event and are excluded."
                )
            elif approval_state.effective_approvals:
                explanation = (
                    f"CONTROL FAILED at event time "
                    f"{event_timestamp.strftime('%Y-%m-%d %H:%M')} UTC. "
                    f"Transaction of ${transaction_state.amount:,.2f} required "
                    f"{required_level} approval. "
                    f"Effective pre-event approvals only reached level(s): {effective_levels}. "
                    f"This does not satisfy the {required_level} requirement."
                )
                if excluded_count > 0:
                    excluded_ids = [
                        a.get("approval_id") for a in approval_state.excluded_late_approvals
                    ]
                    explanation += (
                        f" {excluded_count} post-event approval(s) {excluded_ids} were excluded "
                        f"(hindsight leakage prevention)."
                    )
            else:
                explanation = (
                    f"CONTROL FAILED at event time "
                    f"{event_timestamp.strftime('%Y-%m-%d %H:%M')} UTC. "
                    f"Transaction of ${transaction_state.amount:,.2f} required "
                    f"{required_level} approval before execution. "
                    f"No qualifying approvals were present at event time."
                )

            return "FAIL", explanation

    # ------------------------------------------------------------------
    # PERSISTENCE
    # ------------------------------------------------------------------

    @staticmethod
    async def _persist_snapshot(
        result: ReconstructionResult,
        session: AsyncSession,
    ) -> int:
        """Persist reconstruction result to reconstruction_snapshots (append-only).

        Never writes to original case/transaction/approval tables.

        Returns:
            The auto-generated snapshot_id.
        """
        # Build completeness dict — mode="json" ensures datetime fields serialize as ISO strings
        completeness_dict = result.evidence_completeness.model_dump(mode="json")

        # Build full payload dict for JSON column
        # mode="json" converts datetime, date, UUID objects to JSON-serializable primitives
        payload: dict[str, Any] = {
            "outcome": result.outcome,
            "explanation": result.explanation,
            "supplier_state": result.supplier_state.model_dump(mode="json")
            if result.supplier_state
            else None,
            "approval_state": result.approval_state.model_dump(mode="json")
            if result.approval_state
            else None,
            "access_state": result.access_state.model_dump(mode="json")
            if result.access_state
            else None,
            "transaction_state": result.transaction_state.model_dump(mode="json")
            if result.transaction_state
            else None,
            "applicable_rule": result.applicable_rule.model_dump(mode="json")
            if result.applicable_rule
            else None,
        }

        snapshot = ReconstructionSnapshot(
            transaction_id=result.transaction_id,
            case_id=result.case_id,
            event_timestamp=result.event_timestamp,
            outcome=result.outcome,
            explanation=result.explanation,
            reconstruction_payload=payload,
            applicable_rule_version=(
                result.applicable_rule.rule_version if result.applicable_rule else None
            ),
            applicable_rule_code=(
                result.applicable_rule.rule_code if result.applicable_rule else None
            ),
            evidence_completeness=completeness_dict,
        )
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        return snapshot.snapshot_id  # type: ignore[return-value]
