"""
Dataset registry: the named datasets that have been imported, with a label saying whether the
data is synthetic or authorised. The label is an attestation made by an administrator; TRIS cannot
tell either from the data. A dataset starts as "unlabelled" until someone says what it is.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError, ValidationError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    DatasetRegistryEntry,
    InventoryRecord,
    MaterialCost,
    ProductionRecord,
    PurchaseRecord,
    SupplierOperationsMetric,
)
from app.api.modules.v1.manufacturing.service import admin_audit as audit

LABELS = ("unlabelled", "synthetic", "authorized")
COUNTED = {
    "purchase lines": PurchaseRecord,
    "stock records": InventoryRecord,
    "bill of materials lines": BOMEntry,
    "cost records": MaterialCost,
    "supplier metrics": SupplierOperationsMetric,
    "production records": ProductionRecord,
}


def ensure_registered(session: AsyncSession, user: User, dataset_id: str) -> DatasetRegistryEntry:
    """
    Queue a registry entry for a dataset name seen for the first time (saved with the caller's
    commit). Callers check the registry first; see `register`.
    """
    entry = DatasetRegistryEntry(dataset_id=dataset_id, registered_by=user.user_id)
    session.add(entry)
    audit.record(
        session,
        user,
        audit.DATASET_REGISTERED,
        "dataset",
        dataset_id,
        f"Dataset '{dataset_id}' was registered by its first import (label: unlabelled).",
    )
    return entry


async def register(session: AsyncSession, user: User, dataset_id: str | None) -> None:
    """Register a dataset on its first import; does nothing if it is already registered."""
    if dataset_id and await session.get(DatasetRegistryEntry, dataset_id) is None:
        ensure_registered(session, user, dataset_id)


async def _data_names(session: AsyncSession) -> set[str]:
    names: set[str] = set()
    for model in COUNTED.values():
        rows = await session.execute(select(model.dataset_id).where(model.dataset_id.isnot(None)))
        names |= {r[0] for r in rows.all()}
    return names


async def _stats(session: AsyncSession, dataset_id: str) -> dict[str, Any]:
    counts = {}
    for label, model in COUNTED.items():
        total = (
            await session.execute(
                select(func.count()).select_from(model).where(model.dataset_id == dataset_id)
            )
        ).scalar_one()
        if total:
            counts[label] = total
    first, last, materials = (
        await session.execute(
            select(
                func.min(PurchaseRecord.purchase_date),
                func.max(PurchaseRecord.purchase_date),
                func.count(func.distinct(PurchaseRecord.material_id)),
            ).where(PurchaseRecord.dataset_id == dataset_id)
        )
    ).one()
    return {
        "records": counts,
        "materials_with_purchases": materials,
        "purchases_from": first.isoformat() if first else None,
        "purchases_to": last.isoformat() if last else None,
    }


async def list_datasets(session: AsyncSession) -> list[dict[str, Any]]:
    """Registered datasets and any named dataset found in the data that was never registered."""
    entries = {
        e.dataset_id: e for e in (await session.execute(select(DatasetRegistryEntry))).scalars()
    }
    out = []
    for name in sorted(set(entries) | await _data_names(session)):
        entry = entries.get(name)
        out.append(
            {
                "dataset_id": name,
                "registered": entry is not None,
                "label": entry.label if entry else "unlabelled",
                "source_type": entry.source_type if entry else "file upload",
                "registered_by": entry.registered_by if entry else None,
                "registered_at": entry.registered_at.isoformat() if entry else None,
                "label_set_by": entry.label_set_by if entry else None,
                "label_set_at": entry.label_set_at.isoformat()
                if entry and entry.label_set_at
                else None,
                **await _stats(session, name),
            }
        )
    return out


async def set_label(
    session: AsyncSession, user: User, dataset_id: str, label: str
) -> list[dict[str, Any]]:
    """
    State whether a dataset is synthetic or authorised. Audited.

    Raises:
        ValidationError: If the label is not one of the allowed values.
        NotFoundError: If no such dataset is registered or present in the data.
    """
    if label not in LABELS:
        raise ValidationError(f"The label must be one of: {', '.join(LABELS)}.")
    entry = await session.get(DatasetRegistryEntry, dataset_id)
    if entry is None:
        if dataset_id not in await _data_names(session):
            raise NotFoundError(f"Dataset '{dataset_id}' was not found.")
        entry = ensure_registered(session, user, dataset_id)
    previous = entry.label
    entry.label = label
    entry.label_set_by = user.user_id
    entry.label_set_at = datetime.now(UTC)
    audit.record(
        session,
        user,
        audit.DATASET_LABEL_CHANGED,
        "dataset",
        dataset_id,
        f"Dataset '{dataset_id}' label changed from {previous} to {label}.",
    )
    await session.commit()
    return await list_datasets(session)
