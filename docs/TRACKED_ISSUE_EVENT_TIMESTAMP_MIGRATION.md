# 📋 Tracked Issue: Explicit `event_timestamp` Column Migration & Synthetic Fixture Decoupling

- **Issue ID**: `ISSUE-GOV-001`
- **Domain**: Data Architecture & Rule Engine Invariant Compliance
- **Severity**: High (Compliance with `AGENTS.md` §4c Non-Negotiable Domain Invariants)
- **Status**: **RESOLVED & VERIFIED**
- **Date**: 2026-09-30
- **Alembic Revision**: `cbbdff801f48_add_event_timestamp_to_transactions`

---

## 1. Problem Statement & Architectural Context

`AGENTS.md` §4c establishes a non-negotiable domain invariant:

> **No Hardcoded Fixture Identities**: Production services must derive event times from record data. Never branch on synthetic IDs like `TX-TEMP-001` or pin an event timestamp to a literal date inside a service. Use the transaction's own `created_at` or an explicit event-time field.

### Root Cause of the Previous Limitation
The temporal surveillance test fixture (`TX-TEMP-001`) simulates an August 2026 transaction with two approvals:
1. `APP-TEMP-001`: `2026-08-28 09:32:00 UTC` (Pre-event approval)
2. `APP-TEMP-002`: `2026-08-28 11:06:00 UTC` (Late/post-event approval)

The payment occurred at `2026-08-28 10:14:00 UTC`. However, the `transactions` database schema only captured:
- `invoice_date` (date only, e.g. `2026-08-28`)
- `posting_date` (date only)
- `created_at` (system ingestion timestamp, set at runtime e.g. September 2026)

Because `created_at` reflects when rows were ingested into PostgreSQL (long after August 2026), evaluating against `created_at` would place the transaction event after *both* approvals, invalidating the temporal completeness test.

Consequently, `strategies.py` (Rule `R-007`) and `remediation_service.py` previously contained a documented workaround:
```python
# PREVIOUS WORKAROUND (DELETED)
if transaction.transaction_id == "TX-TEMP-001":
    event_timestamp = datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC)
```

While transparently documented, this violated the strict principle of zero synthetic branching in production engines.

---

## 2. Implementation & Resolution

### Step 1: SQLModel ORM Schema Extension
Added an explicit, indexed `event_timestamp` column to the `Transaction` table (`app/api/modules/v1/transactions/models/transaction.py`):
```python
event_timestamp: datetime | None = Field(
    default=None,
    nullable=True,
    index=True,
    sa_type=DateTime(timezone=True),
)
```

### Step 2: Formal Alembic Migration
Generated and executed revision `cbbdff801f48_add_event_timestamp_to_transactions.py`:
- `op.add_column('transactions', sa.Column('event_timestamp', sa.DateTime(timezone=True), nullable=True))`
- `op.create_index(op.f('ix_transactions_event_timestamp'), 'transactions', ['event_timestamp'], unique=False)`
- Applied cleanly to live PostgreSQL: `uv run alembic upgrade head`.

### Step 3: Ingestion Pipeline & Fixture Support
1. Updated `IngestionService._ingest_transactions_sheet` to parse `event_timestamp` or `event_time` from incoming spreadsheet rows and ISO-8601 strings into UTC `datetime`.
2. Updated `TemporalFixtureService` to persist `"event_timestamp": "2026-08-28 10:14:00"` for `TX-TEMP-001`.
3. Updated `TransactionResponse` schema to serialize `event_timestamp`.

### Step 4: Complete Elimination of Synthetic Branching
Refactored production services to derive event time purely from record data:
- **`strategies.py` (Rule R-007)**:
  ```python
  if not event_timestamp:
      if getattr(transaction, "event_timestamp", None):
          event_timestamp = transaction.event_timestamp
      elif transaction.created_at:
          event_timestamp = transaction.created_at
  ```
- **`remediation_service.py`**:
  ```python
  if getattr(tx, "event_timestamp", None):
      return _to_utc(tx.event_timestamp)
  return _to_utc(tx.created_at)
  ```

All hardcoded references to `TX-TEMP-001` in business logic were permanently removed.

---

## 3. Verification & Evidence

1. **R-007 & Remediation Replay Test Suite**:
   ```bash
   uv run pytest tests/modules/v1/test_r007_approval_timing.py tests/modules/v1/test_remediation_replay.py -v
   # 16/16 passed (100%)
   ```
2. **Acceptance Test Matrix (T01–T10 + Workbook)**:
   ```bash
   uv run pytest tests/test_acceptance_t01_t10.py -v
   # 15/15 passed (100%)
   ```
3. **Full Regression Suite**:
   ```bash
   uv run pytest tests/ -q
   # 127/127 passed (100%)
   ```
4. **Code Quality**:
   ```bash
   uv run ruff check .
   # All checks passed!
   ```
