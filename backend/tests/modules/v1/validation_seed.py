"""Shared seed helpers for the Ticket 11 tests (not a test module)."""

import calendar
from collections.abc import Sequence
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.models import Material, PurchaseRecord
from tests.modules.v1.exposure_seed import ensure_supplier

VALIDATION = "/api/v1/manufacturing/validation"


def month_end_of(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def trending(n: int, start: float = 100.0, slope: float = 1.5) -> list[float]:
    """A rising price with small, fixed wobbles (no randomness)."""
    return [round(start + slope * i + ((i * 7) % 5 - 2) * 0.4, 4) for i in range(n)]


def flat_then_spike(
    n: int, base: float = 50.0, spike_months: int = 2, spike: float = 1.12
) -> list[float]:
    """A flat price that jumps in the last months (an event no history could foretell)."""
    return [round(base + ((i * 3) % 4 - 1) * 0.1, 4) for i in range(n - spike_months)] + [
        round(base * spike, 4)
    ] * spike_months


async def seed_series(
    session: AsyncSession,
    material_id: str,
    prices: Sequence[float],
    *,
    start: tuple[int, int] = (2023, 7),
    quantity: float = 100.0,
    supplier: str = "SUP-V1",
    currency: str = "USD",
) -> date:
    """One purchase per month, on the last day of the month, at the given prices.

    Returns the date of the last purchase (the end of the data).
    """
    session.add(
        Material(
            material_id=material_id,
            description=f"{material_id} part",
            category="Metals",
            unit_of_measure="kg",
        )
    )
    await ensure_supplier(session, supplier)
    await session.commit()
    year, month = start
    last = date(year, month, 1)
    for price in prices:
        last = month_end_of(year, month)
        session.add(
            PurchaseRecord(
                material_id=material_id,
                supplier_id=supplier,
                purchase_date=last,
                quantity=quantity,
                unit_price=float(price),
                currency=currency,
            )
        )
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    await session.commit()
    return last
