"""
Reads an uploaded CSV or Excel file into a plain table of text cells.

Everything is read as text so identifiers keep their leading zeros and dates are interpreted
by the validator, not guessed by the reader. Structurally broken rows (wrong number of cells)
do not abort the file: they are returned as row errors so the uploader sees exactly which
lines to fix.
"""

import csv
import io
import logging
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from app.api.core.custom_exceptions.exceptions import IngestionError
from app.api.modules.v1.manufacturing.service.value_coercion import clean_text

logger = logging.getLogger("tris.manufacturing.mapping")

MAX_DATA_ROWS = 100_000
SAMPLE_ROW_COUNT = 5
DELIMITERS = ",;\t|"
ENCODINGS = ("utf-8-sig", "cp1252", "latin-1")  # SAP exports are often not UTF-8
SUPPORTED_EXTENSIONS = (".csv", ".xlsx")


@dataclass
class SourceRow:
    """One data row: its position in the file and its cells keyed by column name."""

    row_number: int  # spreadsheet line number, header being line 1
    values: dict[str, str | None]


@dataclass
class ParsedTable:
    """A source file after parsing."""

    columns: list[str]
    rows: list[SourceRow]
    structural_errors: list[dict[str, Any]] = field(default_factory=list)
    sheet_name: str = "CSV"
    sheets: list[str] = field(default_factory=list)
    delimiter: str | None = None
    blank_rows: int = 0

    @property
    def data_row_count(self) -> int:
        return len(self.rows) + len(self.structural_errors)


def _check_columns(raw_columns: list[Any]) -> list[str]:
    columns = [str(c).strip() for c in raw_columns]
    if not any(columns):
        raise IngestionError("The file has no header row. The first row must name the columns.")
    if any(not c for c in columns):
        raise IngestionError("The header row has an empty column name. Give every column a name.")
    duplicated = sorted({c for c in columns if columns.count(c) > 1})
    if duplicated:
        raise IngestionError(f"The header row repeats these column names: {duplicated}.")
    return columns


def _decode(content: bytes) -> str:
    if b"\x00" in content[:4096]:
        raise IngestionError("The file is not a text CSV file. Upload a .csv or .xlsx file.")
    for encoding in ENCODINGS:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise IngestionError("The file text could not be decoded.")  # latin-1 never fails


def _detect_delimiter(text: str) -> str:
    try:
        return csv.Sniffer().sniff(text[:4096], delimiters=DELIMITERS).delimiter
    except csv.Error:
        return ","


def _parse_csv(content: bytes) -> ParsedTable:
    text = _decode(content)
    delimiter = _detect_delimiter(text)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        columns = _check_columns(next(reader))
    except StopIteration as exc:
        raise IngestionError("The file is empty.") from exc

    table = ParsedTable(columns=columns, rows=[], delimiter=delimiter)
    try:
        for cells in reader:
            _add_csv_row(table, reader.line_num, cells)
            if table.data_row_count > MAX_DATA_ROWS:
                raise IngestionError(f"The file has more than {MAX_DATA_ROWS:,} data rows.")
    except csv.Error as exc:
        raise IngestionError(
            f"The CSV file is malformed near line {reader.line_num}: {exc}"
        ) from exc
    return table


def _add_csv_row(table: ParsedTable, line: int, cells: list[str]) -> None:
    if not any(c.strip() for c in cells):
        table.blank_rows += 1
        return
    if len(cells) != len(table.columns):
        table.structural_errors.append(
            {
                "row": line,
                "field": "file_structure",
                "error": f"The row has {len(cells)} cells but the header has "
                f"{len(table.columns)} columns",
                "raw_value": {"cells": [c[:100] for c in cells[:12]]},
            }
        )
        return
    table.rows.append(SourceRow(line, dict(zip(table.columns, cells, strict=True))))


def _parse_xlsx(content: bytes, sheet: str | None) -> ParsedTable:
    try:
        workbook = pd.ExcelFile(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001 - any reader failure means "not a readable workbook"
        logger.warning("Unreadable workbook upload: %s", exc)
        raise IngestionError(
            "The file could not be read as an Excel workbook. Check that it is a valid .xlsx file."
        ) from exc

    sheets = [str(s) for s in workbook.sheet_names]
    selected = sheet or sheets[0]
    if selected not in sheets:
        raise IngestionError(f"The workbook has no sheet named '{selected}'. Sheets: {sheets}.")
    # header=None so the raw header cells are checked; pandas would otherwise silently rename
    # duplicate or blank headers ("id.1", "Unnamed: 1") and hide the problem.
    raw = workbook.parse(selected, dtype=str, keep_default_na=False, header=None)
    if raw.empty:
        raise IngestionError("The sheet is empty. The first row must name the columns.")
    columns = _check_columns(list(raw.iloc[0]))
    frame = raw.iloc[1:]
    if len(frame) > MAX_DATA_ROWS:
        raise IngestionError(f"The sheet has more than {MAX_DATA_ROWS:,} data rows.")

    table = ParsedTable(columns=columns, rows=[], sheet_name=selected, sheets=sheets)
    for index, record in enumerate(frame.itertuples(index=False, name=None)):
        cells = [str(v) for v in record]
        if not any(c.strip() for c in cells):
            table.blank_rows += 1
            continue
        table.rows.append(SourceRow(index + 2, dict(zip(columns, cells, strict=True))))
    return table


def parse_source_file(
    content: bytes, filename: str | None, sheet: str | None = None
) -> ParsedTable:
    """
    Parse an uploaded CSV or XLSX file.

    Args:
        content: Raw file bytes.
        filename: Original file name; its extension selects the reader.
        sheet: Worksheet name for Excel files (defaults to the first sheet).

    Returns:
        The parsed table, including any structurally broken rows as row errors.

    Raises:
        IngestionError: If the file type is unsupported, empty, unreadable or has no usable
            header or no data rows.
    """
    name = (filename or "").strip().lower()
    if not name.endswith(SUPPORTED_EXTENSIONS):
        raise IngestionError(
            f"Unsupported file '{filename}'. Upload a .csv or .xlsx file "
            "(older .xls files must be saved as .xlsx first)."
        )
    if not content:
        raise IngestionError("The file is empty.")

    table = _parse_xlsx(content, sheet) if name.endswith(".xlsx") else _parse_csv(content)
    if table.data_row_count == 0:
        raise IngestionError("The file has a header row but no data rows.")
    return table


def sample_rows(table: ParsedTable) -> list[dict[str, str | None]]:
    """The first few data rows, for the column preview."""
    return [
        {k: clean_text(v) for k, v in row.values.items()} for row in table.rows[:SAMPLE_ROW_COUNT]
    ]
