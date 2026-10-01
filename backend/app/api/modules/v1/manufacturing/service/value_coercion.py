"""
Typed coercion of raw source-file text into canonical field values.

Source files are read as text so identifiers such as ERP material numbers keep their leading
zeros. Each coercion either returns a clean value or raises FieldValueError carrying a message
that is safe to show to the person who uploaded the file.
"""

import math
import re
from datetime import date, datetime
from typing import Any

from app.api.modules.v1.manufacturing.service.mapping_targets import FieldSpec

CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
NULL_TOKENS = {"", "nan", "none", "null", "n/a", "na", "#n/a", "-"}
# ERP systems write an empty date as zeros.
EMPTY_DATE_TOKENS = {"00000000", "0000-00-00", "00.00.0000"}
THOUSANDS = re.compile(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$")
DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%d.%m.%Y", "%m/%d/%Y")
TRUE_TOKENS = {"true", "t", "yes", "y", "1", "x"}  # "X" is the ERP convention for a set flag
FALSE_TOKENS = {"false", "f", "no", "n", "0"}


class FieldValueError(ValueError):
    """A value could not be used for its canonical field; the message is user-facing."""


IDENTIFIER_NAMES = {"product_sku", "purchase_reference"}


def is_identifier(spec: FieldSpec) -> bool:
    """Keys and references: never shortened, and values such as NA or - are real codes."""
    return bool(spec.ref) or spec.name.endswith("_id") or spec.name in IDENTIFIER_NAMES


def clean_text(raw: Any, keep_placeholders: bool = False) -> str | None:
    """
    Trim a raw cell and map empty cells to None.

    Placeholder tokens (n/a, null, -, ...) also mean "empty" unless keep_placeholders is set,
    which identifier fields use because "NA" or "-" can be a genuine code.
    """
    if raw is None:
        return None
    text = CONTROL_CHARS.sub("", str(raw)).strip()
    if not text or (not keep_placeholders and text.lower() in NULL_TOKENS):
        return None
    return text


def _parse_float(text: str) -> float:
    candidate = text.replace(",", "") if THOUSANDS.match(text) else text
    try:
        number = float(candidate)
    except ValueError as exc:
        raise FieldValueError(f"'{text}' is not a valid number") from exc
    if math.isnan(number) or math.isinf(number):
        raise FieldValueError(f"'{text}' is not a finite number")
    return number


def _parse_date(text: str) -> date:
    head = re.split(r"[T ]", text, maxsplit=1)[0]  # accept "2024-01-31 00:00:00" from Excel
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(head, fmt).date()
        except ValueError:
            continue
    raise FieldValueError(
        f"'{text}' is not a recognised date (use YYYY-MM-DD, YYYYMMDD, DD.MM.YYYY or MM/DD/YYYY)"
    )


def _parse_bool(text: str) -> bool:
    lowered = text.lower()
    if lowered in TRUE_TOKENS:
        return True
    if lowered in FALSE_TOKENS:
        return False
    raise FieldValueError(f"'{text}' is not a yes/no value")


def _check_range(spec: FieldSpec, number: float) -> None:
    hint = f" ({spec.hint})" if spec.hint else ""
    if spec.min_value is not None:
        too_low = number <= spec.min_value if spec.min_exclusive else number < spec.min_value
        if too_low:
            relation = "greater than" if spec.min_exclusive else "at least"
            raise FieldValueError(f"Must be {relation} {spec.min_value:g}, got {number:g}{hint}")
    if spec.max_value is not None and number > spec.max_value:
        raise FieldValueError(f"Must be at most {spec.max_value:g}, got {number:g}{hint}")


def coerce_value(spec: FieldSpec, raw: Any) -> tuple[Any, str | None]:
    """
    Convert one raw cell to the field's type.

    Args:
        spec: The canonical field definition.
        raw: The raw cell text (or None).

    Returns:
        (value, warning). value is None when the cell is empty; warning is a short code such as
        "text_truncated" when the value was accepted but altered or looks unusual.

    Raises:
        FieldValueError: If the cell is not valid for this field.
    """
    text = clean_text(raw, keep_placeholders=is_identifier(spec))
    if text is None:
        return None, None
    if spec.kind == "float":
        number = _parse_float(text)
        _check_range(spec, number)
        return number, None
    if spec.kind == "int":
        number = _parse_float(text)
        if not number.is_integer():
            raise FieldValueError(f"'{text}' must be a whole number")
        _check_range(spec, number)
        return int(number), None
    if spec.kind == "date":
        # All-zero dates are how ERP exports write "no date"; treat them as missing.
        return (None if text in EMPTY_DATE_TOKENS else _parse_date(text)), None
    if spec.kind == "bool":
        return _parse_bool(text), None

    value = text.upper() if spec.uppercase else text
    warning = None
    if spec.max_length is not None and len(value) > spec.max_length:
        if is_identifier(spec):
            raise FieldValueError(
                f"The value is {len(value)} characters long; the limit is {spec.max_length}"
            )
        value = value[: spec.max_length]
        warning = "text_truncated"
    elif spec.name == "currency" and not re.fullmatch(r"[A-Z]{3}", value):
        warning = "currency_not_iso_code"
    return value, warning
