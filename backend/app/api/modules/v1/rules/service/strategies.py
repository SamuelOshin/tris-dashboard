"""
Concrete Strategy Rule Implementations (R-001 through R-006).
Encapsulates transparent deterministic heuristics without fake metrics.
"""

from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.rules.schemas.rule_schemas import RuleEvaluationSignal
from app.api.modules.v1.rules.service.base_rule import BaseRule
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.suppliers.service.baseline_service import BaselineService
from app.api.modules.v1.transactions.models.transaction import Transaction


class RuleAmountDeviation(BaseRule):
    """
    R-001: Amount Deviation Rule.
    Flags when transaction amount > multiplier * historical average (excluding target).
    """

    rule_code = "R-001"
    name = "Amount Deviation"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        multiplier = float(rule_config.threshold_params.get("multiplier", 2.0))

        # Retrieve or compute historical baseline strictly excluding target transaction
        baseline = context.get("baseline")
        if not baseline:
            baseline = await BaselineService.calculate_baseline(
                supplier_id=supplier.supplier_id,
                session=session,
                exclude_transaction_id=transaction.transaction_id,
            )
            context["baseline"] = baseline

        mean_val = baseline["mean_amount"]
        ratio = round(transaction.amount / mean_val, 2) if mean_val > 0 else 0.0
        triggered = mean_val > 0 and transaction.amount > (multiplier * mean_val)
        score = rule_config.weight if triggered else 0

        explanation = (
            f"Transaction amount ${transaction.amount:,.2f} is {ratio:.2f}x "
            f"the historical average of ${mean_val:,.2f} (threshold: > {multiplier}x)."
            if triggered
            else f"Transaction amount ${transaction.amount:,.2f} is within acceptable baseline."
        )

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=explanation,
            diagnostics={
                "transaction_amount": transaction.amount,
                "baseline_mean": mean_val,
                "multiplier": multiplier,
                "calculated_ratio": ratio,
                "historical_invoices_counted": baseline["invoice_count"],
            },
        )


class RuleRecentBankChange(BaseRule):
    """
    R-002: Recent Bank Change Rule.
    Flags when bank details were changed within lookback_days prior to invoice date.
    """

    rule_code = "R-002"
    name = "Recent Bank Change"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        lookback_days = int(rule_config.threshold_params.get("lookback_days", 7))
        triggered = False
        days_diff = None

        if supplier.bank_change_date:
            delta = transaction.invoice_date - supplier.bank_change_date
            days_diff = delta.days
            # Triggered if bank changed within lookback_days prior to (or on) invoice
            if 0 <= days_diff <= lookback_days:
                triggered = True

        score = rule_config.weight if triggered else 0
        explanation = (
            f"Supplier bank details were updated {days_diff} days prior to invoice "
            f"(threshold: <= {lookback_days} days). "
            f"Reason: {supplier.bank_change_reason or 'None provided'}."
            if triggered
            else "No recent bank details change within risk window."
        )

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=explanation,
            diagnostics={
                "bank_change_date": str(supplier.bank_change_date)
                if supplier.bank_change_date
                else None,
                "invoice_date": str(transaction.invoice_date),
                "days_difference": days_diff,
                "lookback_threshold_days": lookback_days,
            },
        )


class RuleMissingApproval(BaseRule):
    """
    R-003: Missing Required Internal Control Approval.
    Flags when transactions above approval threshold lack required authorization level.
    """

    rule_code = "R-003"
    name = "Missing Required Approval"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        threshold_amount = float(rule_config.threshold_params.get("threshold_amount", 50000.0))
        required_level = rule_config.threshold_params.get("required_level", "Level 3")

        # Find approval record for this transaction
        statement = select(Approval).where(Approval.transaction_id == transaction.transaction_id)
        result = await session.execute(statement)
        approvals = list(result.scalars().all())

        triggered = False
        reason = "Approval verified."

        if transaction.amount >= threshold_amount:
            # Requires Level 3 approval
            valid_approval = [
                a
                for a in approvals
                if a.required_level == required_level and a.approval_status == "Approved"
            ]
            if not valid_approval:
                triggered = True
                status_found = approvals[0].approval_status if approvals else "None"
                reason = (
                    f"Transaction of ${transaction.amount:,.2f} exceeds threshold "
                    f"${threshold_amount:,.2f} and lacks required {required_level} approval "
                    f"(Status: {status_found})."
                )

        score = rule_config.weight if triggered else 0

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=reason,
            diagnostics={
                "transaction_amount": transaction.amount,
                "threshold_amount": threshold_amount,
                "required_level": required_level,
                "approvals_found": [a.approval_id for a in approvals],
            },
        )


class RuleOffHoursAccess(BaseRule):
    """
    R-004: Off-Hours System Access Telemetry Rule.
    Flags when system telemetry records activity outside standard window (06:00 to 20:00).
    """

    rule_code = "R-004"
    name = "Off-Hours Access"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        start_hour = int(rule_config.threshold_params.get("start_hour", 6))
        end_hour = int(rule_config.threshold_params.get("end_hour", 20))

        # Query access events related to this supplier
        statement = select(AccessEvent).where(AccessEvent.supplier_id == supplier.supplier_id)
        result = await session.execute(statement)
        events = list(result.scalars().all())

        off_hours_events = []
        for ev in events:
            h = ev.event_time.hour
            if h < start_hour or h >= end_hour:
                off_hours_events.append(ev)

        triggered = len(off_hours_events) > 0
        score = rule_config.weight if triggered else 0

        explanation = (
            f"Detected {len(off_hours_events)} off-hours access event(s) outside "
            f"standard window {start_hour:02d}:00-{end_hour:02d}:00 "
            f"(e.g. {off_hours_events[0].event_id} by {off_hours_events[0].user_id} at "
            f"{off_hours_events[0].event_time.strftime('%H:%M:%S')})."
            if triggered
            else "All related access events occurred within standard business hours."
        )

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=explanation,
            diagnostics={
                "off_hours_count": len(off_hours_events),
                "flagged_event_ids": [ev.event_id for ev in off_hours_events],
            },
        )


class RuleDuplicateInvoice(BaseRule):
    """
    R-005: Duplicate Invoice Rule.
    Flags duplicate invoice numbers from the same supplier within window_days.
    """

    rule_code = "R-005"
    name = "Duplicate Invoice"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        statement = select(Transaction).where(
            Transaction.supplier_id == supplier.supplier_id,
            Transaction.invoice_number == transaction.invoice_number,
            Transaction.transaction_id != transaction.transaction_id,
        )
        result = await session.execute(statement)
        duplicates = list(result.scalars().all())

        triggered = len(duplicates) > 0
        score = rule_config.weight if triggered else 0

        explanation = (
            f"Duplicate invoice number '{transaction.invoice_number}' detected in "
            f"{len(duplicates)} other transaction(s)."
            if triggered
            else "Invoice number is unique for this supplier."
        )

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=explanation,
            diagnostics={
                "duplicate_count": len(duplicates),
                "duplicate_ids": [d.transaction_id for d in duplicates],
            },
        )


class RuleRecurrence(BaseRule):
    """
    R-006: 90-Day Recurrence Detection Rule.
    Flags when prior confirmed risk cases exist for this supplier within lookback_days.
    """

    rule_code = "R-006"
    name = "Recurrence Detection"

    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        lookback_days = int(rule_config.threshold_params.get("lookback_days", 90))

        statement = select(RiskCase).where(
            RiskCase.supplier_id == supplier.supplier_id,
            RiskCase.status == "Closed",
        )
        result = await session.execute(statement)
        prior_cases = list(result.scalars().all())

        triggered = len(prior_cases) > 0
        score = rule_config.weight if triggered else 0

        explanation = (
            f"Detected {len(prior_cases)} prior closed risk case(s) for supplier "
            f"{supplier.supplier_id} within 90-day surveillance window."
            if triggered
            else "No prior risk recurrence detected."
        )

        return RuleEvaluationSignal(
            rule_code=self.rule_code,
            rule_name=rule_config.name or self.name,
            rule_version=rule_config.rule_version,
            triggered=triggered,
            weight=rule_config.weight,
            score=score,
            explanation=explanation,
            diagnostics={
                "prior_closed_cases": [c.case_id for c in prior_cases],
                "lookback_days": lookback_days,
            },
        )
