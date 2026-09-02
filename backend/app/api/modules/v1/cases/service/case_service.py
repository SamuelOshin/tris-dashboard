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
)
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.cases.schemas.case_schemas import CaseTransitionRequest

# Governed State Transition Matrix
VALID_TRANSITIONS: Dict[str, List[str]] = {
    "New": ["Assigned"],
    "Assigned": ["Under Investigation"],
    "Under Investigation": ["Corrective Action"],
    "Corrective Action": ["Pending Verification"],
    "Pending Verification": ["Closed", "Under Investigation"],  # Approval or rejection
    "Closed": ["Reopened"],
    "Reopened": ["Under Investigation"],
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

        case_dict = case.model_dump()
        case_dict["history"] = [h.model_dump() for h in history]
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

        # 2. Enforce 8-Field Verified Closure Gatekeeper
        if target_status == "Closed":
            missing_fields: List[str] = []
            transition_data = transition.model_dump()

            for field in MANDATORY_CLOSURE_FIELDS:
                val = transition_data.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    missing_fields.append(field)

            if missing_fields:
                raise VerifiedClosureValidationError(
                    message=f"Verified closure failed: missing mandatory fields {missing_fields}",
                    missing_fields=missing_fields,
                )

            # Populate 8 closure fields onto the case model
            case.root_cause = transition.root_cause
            case.corrective_action = transition.corrective_action
            case.closure_type = transition.closure_type
            case.closure_evidence = transition.closure_evidence
            case.verified_by = transition.verified_by
            case.closure_date = transition.closure_date
            case.follow_up_requirement = transition.follow_up_requirement
            case.recurrence_monitoring = transition.recurrence_monitoring

        # 3. Handle Assignment Update
        if transition.assigned_to:
            case.assigned_to = transition.assigned_to

        # 4. Record Immutable Audit History
        history = CaseHistory(
            case_id=case.case_id,
            actor=transition.actor,
            action=f"Status Transition: {current_status} -> {target_status}",
            previous_status=current_status,
            new_status=target_status,
            note=transition.note,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(history)

        # 5. Commit Transition
        case.status = target_status
        case.updated_at = datetime.now(timezone.utc)
        session.add(case)
        await session.commit()
        await session.refresh(case)

        return await CaseService.get_case_by_id(case_id, session)
