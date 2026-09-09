"""
Governed Case Lifecycle and State Machine Service.
Enforces strict transition rules, 8-field verified closure gatekeeper, and immutable audit trails.
Pure business logic — raises domain exceptions directly.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import (
    InvalidStateTransitionError,
    NotFoundError,
    VerifiedClosureValidationError,
    WorkflowPreConditionError,
)
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.cases.schemas.case_schemas import (
    CaseTransitionRequest,
    CaseUpdateRequest,
)

# Governed State Transition Matrix
VALID_TRANSITIONS: Dict[str, List[str]] = {
    "New": ["Assigned"],
    "Assigned": ["Under Investigation"],
    "Under Investigation": ["Corrective Action"],
    "Corrective Action": ["Pending Verification"],
    "Pending Verification": ["Closed", "Under Investigation"],  # Approval or rejection
    "Closed": ["Reopened"],
    "Reopened": ["Under Investigation", "Pending Verification"],
}

# The 8 Mandatory Closure Fields Required by Enterprise Compliance
MANDATORY_CLOSURE_FIELDS = [
    "root_cause",
    "corrective_action",
    "closure_type",
    "closure_evidence",
    "verified_by",
    "closure_date",
    "follow_up_requirement",
    "recurrence_monitoring",
]


class CaseService:
    """Enterprise risk case lifecycle manager."""

    @staticmethod
    async def get_all_cases(
        session: AsyncSession,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        supplier_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[RiskCase]:
        """Retrieve filtered cases."""
        statement = select(RiskCase).order_by(RiskCase.created_at.desc())

        if status:
            statement = statement.where(RiskCase.status == status)
        if priority:
            statement = statement.where(RiskCase.priority == priority)
        if supplier_id:
            statement = statement.where(RiskCase.supplier_id == supplier_id)

        statement = statement.offset(skip).limit(limit)
        result = await session.execute(statement)
        return list(result.scalars().all())

    @staticmethod
    async def get_case_by_id(case_id: str, session: AsyncSession) -> Dict[str, Any]:
        """
        Retrieve case with complete chronological audit history.

        Raises:
            NotFoundError: If case does not exist.
        """
        case = await session.get(RiskCase, case_id)
        if not case:
            raise NotFoundError(f"Case '{case_id}' not found")

        # Query full chronological audit history
        hist_stmt = (
            select(CaseHistory)
            .where(CaseHistory.case_id == case_id)
            .order_by(CaseHistory.timestamp.asc())
        )
        hist_res = await session.execute(hist_stmt)
        history = list(hist_res.scalars().all())

        # Query prior supplier cases for recurrence tracking (Spec Section 4.K & 6)
        prior_stmt = (
            select(RiskCase)
            .where(RiskCase.supplier_id == case.supplier_id)
            .where(RiskCase.case_id != case_id)
            .order_by(RiskCase.created_at.desc())
        )
        prior_res = await session.execute(prior_stmt)
        prior_cases = list(prior_res.scalars().all())

        case_dict = case.model_dump()
        case_dict["history"] = [h.model_dump() for h in history]
        case_dict["prior_cases"] = [
            {
                "case_id": p.case_id,
                "case_number": p.case_number,
                "status": p.status,
                "priority": p.priority,
                "transaction_id": p.transaction_id,
                "root_cause": p.root_cause,
                "corrective_action": p.corrective_action,
                "closure_date": str(p.closure_date) if p.closure_date else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in prior_cases
        ]
        return case_dict

    @staticmethod
    async def transition_case(
        case_id: str,
        transition: CaseTransitionRequest,
        session: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Executes a governed state transition.

        Raises:
            NotFoundError: If case does not exist.
            InvalidStateTransitionError: If transition is not allowed by state matrix.
            VerifiedClosureValidationError: If closing without all 8 mandatory fields.
        """
        case = await session.get(RiskCase, case_id)
        if not case:
            raise NotFoundError(f"Case '{case_id}' not found")

        current_status = case.status
        target_status = transition.to_status
        allowed_targets = VALID_TRANSITIONS.get(current_status, [])

        # 1. Validate State Machine Transition
        if target_status not in allowed_targets:
            raise InvalidStateTransitionError(
                current_status=current_status,
                attempted_status=target_status,
                allowed_transitions=allowed_targets,
            )

        # 2a. Enforce root_cause before advancing to Corrective Action
        if target_status == "Corrective Action":
            root_cause_value = (transition.root_cause or "").strip()
            if not root_cause_value:
                raise WorkflowPreConditionError(
                    message=(
                        "Root cause explanation is required before advancing to Corrective Action. "
                        "Document your finding in the Investigation tab first."
                    ),
                    missing_field="root_cause",
                )
            case.root_cause = root_cause_value

        # 2b. Enforce corrective_action before advancing to Pending Verification
        if target_status == "Pending Verification":
            corrective_action_value = (transition.corrective_action or "").strip()
            if not corrective_action_value:
                raise WorkflowPreConditionError(
                    message=(
                        "Corrective action plan is required before advancing to"
                        " Pending Verification. Document your remediation first."
                    ),
                    missing_field="corrective_action",
                )
            case.corrective_action = corrective_action_value

        # 2c. Enforce all 8 closure fields on final closure transition
        if target_status == "Closed":
            # Resolve fields: prefer payload value, fall back to what's already on the case record
            def _resolve(payload_val: str | None, case_val: str | None) -> str | None:
                v = (payload_val or "").strip()
                return v if v else (case_val or "").strip() or None

            resolved = {
                "root_cause": _resolve(transition.root_cause, case.root_cause),
                "corrective_action": _resolve(transition.corrective_action, case.corrective_action),
                "closure_type": _resolve(transition.closure_type, case.closure_type),
                "closure_evidence": _resolve(transition.closure_evidence, case.closure_evidence),
                "verified_by": _resolve(transition.verified_by, case.verified_by),
                "closure_date": transition.closure_date or case.closure_date,
                "follow_up_requirement": _resolve(
                    transition.follow_up_requirement, case.follow_up_requirement
                ),
                "recurrence_monitoring": _resolve(
                    transition.recurrence_monitoring, case.recurrence_monitoring
                ),
            }

            missing_fields = [
                field for field, val in resolved.items() if not val
            ]
            if missing_fields:
                raise VerifiedClosureValidationError(
                    message=f"Verified closure failed: missing mandatory fields {missing_fields}",
                    missing_fields=missing_fields,
                )

            # Persist all 8 closure fields
            case.root_cause = resolved["root_cause"]
            case.corrective_action = resolved["corrective_action"]
            case.closure_type = resolved["closure_type"]
            case.closure_evidence = resolved["closure_evidence"]
            case.verified_by = resolved["verified_by"]
            case.closure_date = resolved["closure_date"]
            case.follow_up_requirement = resolved["follow_up_requirement"]
            case.recurrence_monitoring = resolved["recurrence_monitoring"]

        # 3. Handle Assignment & Department Update
        if transition.assigned_to:
            case.assigned_to = transition.assigned_to
        if transition.department:
            case.department = transition.department

        # Format audit note to capture ownership assignment if provided
        audit_note = transition.note
        if transition.assigned_to or transition.department:
            assign_parts = []
            if transition.assigned_to:
                assign_parts.append(f"Owner: {transition.assigned_to}")
            if transition.department:
                assign_parts.append(f"Dept: {transition.department}")
            assign_str = f"[{', '.join(assign_parts)}]"
            audit_note = f"{audit_note} - {assign_str}" if audit_note else assign_str

        # 4. Record Immutable Audit History
        history = CaseHistory(
            case_id=case.case_id,
            actor=transition.actor,
            action=f"Status Transition: {current_status} -> {target_status}",
            previous_status=current_status,
            new_status=target_status,
            note=audit_note,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(history)

        # 5. Emit Notifications for Case Lifecycle Events
        from app.api.modules.v1.notifications.service.notification_service import (
            NotificationService,
        )

        if transition.assigned_to:
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Assigned to You",
                message=(
                    f"You have been assigned as lead reviewer for Case {case.case_id} "
                    f"(Supplier: {case.supplier_id})."
                ),
                category="CASE_ALERT",
                severity="INFO",
                recipient_user_id=transition.assigned_to,
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id, "supplier_id": case.supplier_id},
            )

        if target_status == "Under Investigation":
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Investigation Started",
                message=(
                    f"Investigation started for Case {case.case_id} by {transition.actor}."
                ),
                category="CASE_ALERT",
                severity="INFO",
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id, "supplier_id": case.supplier_id},
            )
        elif target_status == "Corrective Action":
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Remediation Active",
                message=(
                    f"Corrective action recorded for Case {case.case_id} by {transition.actor}."
                ),
                category="CASE_ALERT",
                severity="INFO",
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id, "supplier_id": case.supplier_id},
            )
        elif target_status == "Pending Verification":
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Pending Verification",
                message=(
                    f"Case {case.case_id} ({case.supplier_id}) completed investigation "
                    "and requires compliance verification sign-off."
                ),
                category="CASE_ALERT",
                severity="WARNING",
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id, "supplier_id": case.supplier_id},
            )
        elif target_status == "Closed":
            verifier = case.verified_by or transition.actor
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Sealed and Closed",
                message=(
                    f"Case {case.case_id} ({case.supplier_id}) was "
                    f"verified and sealed by {verifier}."
                ),
                category="CASE_ALERT",
                severity="SUCCESS",
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id, "verified_by": case.verified_by},
            )
        elif target_status == "Reopened":
            await NotificationService.emit(
                db=session,
                title=f"Case {case.case_id} Reopened",
                message=f"Case {case.case_id} was reopened by {transition.actor}.",
                category="CASE_ALERT",
                severity="WARNING",
                recipient_role="Reviewer",
                link_url=f"/cases/{case.case_id}",
                metadata_json={"case_id": case.case_id},
            )

        # 6. Commit Transition
        case.status = target_status
        case.updated_at = datetime.now(timezone.utc)
        session.add(case)
        await session.commit()
        await session.refresh(case)

        return await CaseService.get_case_by_id(case_id, session)

    @staticmethod
    async def update_case(
        case_id: str,
        update_data: CaseUpdateRequest,
        actor: str,
        session: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Updates case fields and records an audit history entry.

        Raises:
            NotFoundError: If case does not exist.
            WorkflowPreConditionError: If attempting to edit a closed case.
        """
        case = await session.get(RiskCase, case_id)
        if not case:
            raise NotFoundError(f"Case '{case_id}' not found")

        if case.status == "Closed":
            raise WorkflowPreConditionError(
                "Closed cases cannot be modified. Reopen the case to make changes."
            )

        updated_fields: List[str] = []
        if update_data.root_cause is not None:
            case.root_cause = update_data.root_cause.strip() or None
            updated_fields.append("root_cause")
        if update_data.corrective_action is not None:
            case.corrective_action = update_data.corrective_action.strip() or None
            updated_fields.append("corrective_action")
        if update_data.closure_type is not None:
            case.closure_type = update_data.closure_type
            updated_fields.append("closure_type")
        if update_data.closure_evidence is not None:
            case.closure_evidence = update_data.closure_evidence.strip() or None
            updated_fields.append("closure_evidence")
        if update_data.verified_by is not None:
            case.verified_by = update_data.verified_by.strip() or None
            updated_fields.append("verified_by")
        if update_data.closure_date is not None:
            case.closure_date = update_data.closure_date
            updated_fields.append("closure_date")
        if update_data.follow_up_requirement is not None:
            case.follow_up_requirement = update_data.follow_up_requirement.strip() or None
            updated_fields.append("follow_up_requirement")
        if update_data.recurrence_monitoring is not None:
            case.recurrence_monitoring = update_data.recurrence_monitoring.strip() or None
            updated_fields.append("recurrence_monitoring")
        if update_data.assigned_to is not None:
            case.assigned_to = update_data.assigned_to.strip() or None
            updated_fields.append("assigned_to")
        if update_data.department is not None:
            case.department = update_data.department.strip() or None
            updated_fields.append("department")
        if update_data.priority is not None:
            case.priority = update_data.priority
            updated_fields.append("priority")

        case.updated_at = datetime.now(timezone.utc)

        audit_note = update_data.note or f"Updated fields: {', '.join(updated_fields)}"
        history = CaseHistory(
            case_id=case.case_id,
            actor=actor,
            action=f"Case Details Updated ({case.status})",
            previous_status=case.status,
            new_status=case.status,
            note=audit_note,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(history)
        session.add(case)
        await session.commit()
        await session.refresh(case)

        return await CaseService.get_case_by_id(case_id, session)

