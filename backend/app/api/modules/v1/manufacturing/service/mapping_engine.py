"""
Mapping engine: validates a parsed source file against a field mapping and (optionally)
writes the accepted rows.

It deliberately reuses the v1.4 ingestion discipline rather than inventing a new one:
- `check_circuit_breaker` / `CircuitBreakerTrippedError` (more than 20% bad rows aborts the load),
- `_prefetch_existing_pks` (one bulk lookup instead of a query per row),
- `_flush_chunk_with_isolation` (bulk insert in a savepoint, falling back to row-by-row so one
  bad row never discards its neighbours).

The engine never commits. The caller owns the transaction and rolls back if the breaker trips.
"""

import asyncio
import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel, select

from app.api.modules.v1.ingestion.service.ingestion_service import (
    CHUNK_SIZE,
    CIRCUIT_BREAKER_THRESHOLD,
    CircuitBreakerTrippedError,
    _flush_chunk_with_isolation,
    _prefetch_existing_pks,
    check_circuit_breaker,
)
from app.api.modules.v1.manufacturing.models import Material
from app.api.modules.v1.manufacturing.service.file_parser import ParsedTable, SourceRow
from app.api.modules.v1.manufacturing.service.mapping_targets import TargetSpec
from app.api.modules.v1.manufacturing.service.value_coercion import (
    FieldValueError,
    clean_text,
    coerce_value,
    is_identifier,
)
from app.api.modules.v1.suppliers.models.supplier import Supplier

logger = logging.getLogger("tris.manufacturing.mapping")

ERROR_LOG_CAP = 1000
LOOKUP_BATCH = 5000  # keeps IN (...) lists well below the driver's parameter limit
RAW_VALUE_LIMIT = 200
DB_REJECTION_MESSAGE = "The row was rejected by a data integrity rule and was not saved"

WARNING_MESSAGES = {
    "text_truncated": "Text longer than the allowed length was shortened",
    "currency_not_iso_code": "Currency is not a 3-letter code such as USD",
    "default_applied": "A default value was used where the file had no value",
}
REFERENCE_MODELS: dict[str, tuple[type[SQLModel], str, str]] = {
    "materials": (Material, "material_id", "Material"),
    "suppliers": (Supplier, "supplier_id", "Supplier"),
}


@dataclass
class MappingSettings:
    """Everything the engine needs to know about one run besides the file itself."""

    target: TargetSpec
    field_mapping: dict[str, str]
    defaults: dict[str, str]
    dataset_id: str | None = None
    duplicate_strategy: str = "skip"


@dataclass
class RunResult:
    """Outcome of validating (and optionally importing) one file."""

    rows_total: int = 0
    rows_accepted: int = 0
    rows_rejected: int = 0
    rows_duplicate: int = 0
    rows_blank: int = 0
    errors_total: int = 0
    error_log: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[dict[str, Any]] = field(default_factory=list)
    missing_values: dict[str, int] = field(default_factory=dict)
    unmapped_optional_fields: list[str] = field(default_factory=list)
    field_error_counts: dict[str, int] = field(default_factory=dict)
    circuit_breaker: dict[str, Any] | None = None
    dry_run: bool = True

    @property
    def breaker_tripped(self) -> bool:
        return self.circuit_breaker is not None


@dataclass
class _Candidate:
    row: SourceRow
    values: dict[str, Any] = field(default_factory=dict)
    errors: list[tuple[str, str]] = field(default_factory=list)
    duplicate: bool = False


def _raw_snapshot(row: SourceRow) -> dict[str, Any]:
    return {k: (v[:RAW_VALUE_LIMIT] if isinstance(v, str) else v) for k, v in row.values.items()}


def _convert_row(
    candidate: _Candidate,
    settings: MappingSettings,
    warnings: Counter[tuple[str, str]],
    missing: Counter[str],
) -> None:
    """Coerce every mapped field of one row, recording each problem separately."""
    for spec in settings.target.fields:
        column = settings.field_mapping.get(spec.name)
        raw = candidate.row.values.get(column) if column else None
        keep = is_identifier(spec)
        text = clean_text(raw, keep_placeholders=keep)
        if text is None:
            text = clean_text(settings.defaults.get(spec.name), keep_placeholders=keep)
        try:
            value, warning = coerce_value(spec, text)
        except FieldValueError as exc:
            candidate.errors.append((spec.name, str(exc)))
            continue
        if warning:
            warnings[(warning, spec.name)] += 1
        if value is None and spec.default is not None:
            value = spec.default
            warnings[("default_applied", spec.name)] += 1
        if value is None:
            if spec.required:
                candidate.errors.append((spec.name, "Required value is missing"))
            elif column:
                missing[spec.name] += 1
        candidate.values[spec.name] = value
    if not candidate.errors:
        _check_cross_field_rules(candidate, settings.target)


def _check_cross_field_rules(candidate: _Candidate, target: TargetSpec) -> None:
    values = candidate.values
    for group in target.any_of:
        if all(values.get(name) is None for name in group):
            candidate.errors.append(
                (" / ".join(group), f"At least one of {', '.join(group)} must have a value")
            )
    for start, end in target.date_orders:
        if values.get(start) and values.get(end) and values[end] < values[start]:
            candidate.errors.append((end, f"{end} is before {start}"))


async def _existing_values(
    session: AsyncSession, model: type[SQLModel], attr_name: str, ids: set[str]
) -> set[str]:
    ordered = sorted(ids)
    found: set[str] = set()
    for start in range(0, len(ordered), LOOKUP_BATCH):
        found |= await _prefetch_existing_pks(
            session, model, attr_name, ordered[start : start + LOOKUP_BATCH]
        )
    return found


async def _check_references(
    session: AsyncSession, candidates: list[_Candidate], target: TargetSpec
) -> None:
    """Every foreign reference must already exist (the v1.4 referential pre-flight, D7)."""
    for spec in (f for f in target.fields if f.ref):
        model, attr_name, label = REFERENCE_MODELS[spec.ref or ""]
        live = [c for c in candidates if not c.errors and c.values.get(spec.name)]
        known = await _existing_values(
            session, model, attr_name, {c.values[spec.name] for c in live}
        )
        for candidate in live:
            value = candidate.values[spec.name]
            if value not in known:
                hint = " Import the material master first." if spec.ref == "materials" else ""
                candidate.errors.append(
                    (
                        spec.name,
                        f"Referential integrity failure: {label} '{value}' does not exist.{hint}",
                    )
                )


def _key_of(candidate: _Candidate, target: TargetSpec) -> tuple[Any, ...] | None:
    key = tuple(candidate.values.get(name) for name in target.key_fields)
    if not target.null_safe_key and any(part is None for part in key):
        return None
    return key


async def _existing_keys(
    session: AsyncSession, target: TargetSpec, candidates: list[_Candidate]
) -> set[tuple[Any, ...]]:
    lead = getattr(target.model, target.lead_field)
    columns = [getattr(target.model, name) for name in target.key_fields]
    lead_values = sorted({c.values[target.lead_field] for c in candidates})
    found: set[tuple[Any, ...]] = set()
    for start in range(0, len(lead_values), LOOKUP_BATCH):
        batch = lead_values[start : start + LOOKUP_BATCH]
        rows = await session.execute(select(*columns).where(lead.in_(batch)))
        found |= {tuple(r) for r in rows.fetchall()}
    return found


async def _check_duplicates(
    session: AsyncSession,
    candidates: list[_Candidate],
    settings: MappingSettings,
    result: RunResult,
) -> None:
    target = settings.target
    live = [c for c in candidates if not c.errors]
    if not live:
        return
    in_db = await _existing_keys(session, target, live)
    seen: dict[tuple[Any, ...], int] = {}
    for candidate in live:
        key = _key_of(candidate, target)
        if key is None:
            continue
        if key in seen:
            reason = f"Duplicate of row {seen[key]} in this file"
        elif key in in_db:
            reason = "A matching record is already stored"
        else:
            seen[key] = candidate.row.row_number
            continue
        if settings.duplicate_strategy == "fail":
            candidate.errors.append(
                (target.key_fields[0], f"{reason} (strategy: reject duplicates)")
            )
        else:
            candidate.duplicate = True
            result.rows_duplicate += 1


def _trip_info(
    exc: CircuitBreakerTrippedError, field_errors: Counter[str], settings: MappingSettings
) -> dict[str, Any]:
    info: dict[str, Any] = {
        "tripped": True,
        "stage": exc.stage,
        "error_count": exc.error_count,
        "total_rows": exc.total_rows,
        "ratio": round(exc.ratio, 4),
        "threshold": CIRCUIT_BREAKER_THRESHOLD,
        "message": str(exc),
    }
    if field_errors:
        suspect, count = field_errors.most_common(1)[0]
        info["suspect_field"] = suspect
        info["suspect_column"] = settings.field_mapping.get(suspect)
        info["suspect_error_count"] = count
        column = info["suspect_column"]
        where = f" (mapped from column '{column}')" if column else ""
        info["hint"] = (
            f"Most rejected rows failed on '{suspect}'{where}. "
            "Check that this field is mapped to the right column."
        )
    return info


def _evaluate_breaker(
    result: RunResult,
    errors: int,
    stage: str,
    field_errors: Counter[str],
    settings: MappingSettings,
) -> bool:
    try:
        check_circuit_breaker(
            settings.target.label, result.rows_total, errors, is_mandatory=True, stage=stage
        )
    except CircuitBreakerTrippedError as exc:
        result.circuit_breaker = _trip_info(exc, field_errors, settings)
        return True
    return False


async def _flush(
    session: AsyncSession, chunk: list[tuple[SQLModel, dict[str, Any]]], sheet: str
) -> tuple[int, list[dict[str, Any]]]:
    """Insert one chunk with v1.4 savepoint isolation, hiding database internals from the log."""
    raw_errors: list[dict[str, Any]] = []
    inserted, _ = await _flush_chunk_with_isolation(session, chunk, raw_errors, sheet)
    friendly = []
    for entry in raw_errors:
        logger.warning("Row %s rejected by the database: %s", entry["row"], entry["error"])
        friendly.append({**entry, "field": "data_integrity", "error": DB_REJECTION_MESSAGE})
    return inserted, friendly


def _summarise(
    candidates: list[_Candidate],
    structural: list[dict[str, Any]],
    warnings: Counter[tuple[str, str]],
    missing: Counter[str],
    result: RunResult,
    settings: MappingSettings,
    sheet: str,
) -> Counter[str]:
    """Fill the error log, warning list and per-field error counts on the result."""
    field_errors: Counter[str] = Counter()
    log: list[dict[str, Any]] = [{"sheet": sheet, **entry} for entry in structural]
    for candidate in candidates:
        for field_name, message in candidate.errors:
            field_errors[field_name] += 1
            log.append(
                {
                    "sheet": sheet,
                    "row": candidate.row.row_number,
                    "field": field_name,
                    "error": message,
                    "raw_value": _raw_snapshot(candidate.row),
                }
            )
    log.sort(key=lambda e: e["row"])
    result.errors_total = len(log)
    result.error_log = log[:ERROR_LOG_CAP]
    result.rows_rejected = len(structural) + sum(1 for c in candidates if c.errors)
    result.field_error_counts = dict(field_errors)
    result.warnings = [
        {
            "code": code,
            "field": field_name,
            "count": count,
            "message": f"{WARNING_MESSAGES[code]} ({field_name})",
        }
        for (code, field_name), count in sorted(warnings.items())
    ]
    result.missing_values = dict(missing)
    result.unmapped_optional_fields = [
        f.name
        for f in settings.target.fields
        if not f.required
        and f.name not in settings.field_mapping
        and f.name not in settings.defaults
    ]
    return field_errors


def _build_chunks(
    candidates: list[_Candidate], settings: MappingSettings
) -> list[list[tuple[SQLModel, dict[str, Any]]]]:
    chunks: list[list[tuple[SQLModel, dict[str, Any]]]] = []
    current: list[tuple[SQLModel, dict[str, Any]]] = []
    for candidate in candidates:
        if candidate.errors or candidate.duplicate:
            continue
        entity = settings.target.model(**candidate.values, dataset_id=settings.dataset_id)
        entity._source_row_num = candidate.row.row_number  # type: ignore[attr-defined]
        current.append((entity, _raw_snapshot(candidate.row)))
        if len(current) >= CHUNK_SIZE:
            chunks.append(current)
            current = []
    if current:
        chunks.append(current)
    return chunks


async def run_mapping(
    session: AsyncSession,
    table: ParsedTable,
    settings: MappingSettings,
    dry_run: bool,
) -> RunResult:
    """
    Validate a parsed file against a mapping and, unless dry_run, insert the accepted rows.

    Args:
        session: Database session. The engine flushes but never commits; the caller must roll
            back when `breaker_tripped` is true after an import.
        table: The parsed source file.
        settings: Target table, field mapping, defaults, dataset tag and duplicate strategy.
        dry_run: When true nothing is written.

    Returns:
        A RunResult with row counts, the row-level error log, warnings, missing-value counts
        and, if more than 20% of rows were bad, the circuit-breaker details.
    """
    result = RunResult(
        dry_run=dry_run, rows_blank=table.blank_rows, rows_total=table.data_row_count
    )
    warnings: Counter[tuple[str, str]] = Counter()
    missing: Counter[str] = Counter()

    candidates = [_Candidate(row) for row in table.rows]
    for index, candidate in enumerate(candidates):
        _convert_row(candidate, settings, warnings, missing)
        if index and index % 250 == 0:
            await asyncio.sleep(0)  # yield to the event loop on large files (v1.4 D11)
    await _check_references(session, candidates, settings.target)
    await _check_duplicates(session, candidates, settings, result)

    field_errors = _summarise(
        candidates, table.structural_errors, warnings, missing, result, settings, table.sheet_name
    )
    if _evaluate_breaker(result, result.rows_rejected, "validation", field_errors, settings):
        return result

    chunks = _build_chunks(candidates, settings)
    if dry_run:
        result.rows_accepted = sum(len(c) for c in chunks)
        return result

    db_errors: list[dict[str, Any]] = []
    for chunk in chunks:
        inserted, rejected = await _flush(session, chunk, table.sheet_name)
        result.rows_accepted += inserted
        db_errors.extend(rejected)
    if db_errors:
        result.rows_rejected += len(db_errors)
        result.errors_total += len(db_errors)
        room = max(ERROR_LOG_CAP - len(result.error_log), 0)
        result.error_log.extend(db_errors[:room])
        result.field_error_counts["data_integrity"] = len(db_errors)
    if _evaluate_breaker(result, result.rows_rejected, "insertion", field_errors, settings):
        result.rows_accepted = 0
    return result
