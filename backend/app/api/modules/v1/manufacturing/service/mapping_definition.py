"""
Validation of a mapping *definition* (target, field mapping, defaults) independent of any
particular file, plus the extra check that the mapped columns exist in a given file.
"""

from app.api.core.custom_exceptions.exceptions import ValidationError
from app.api.modules.v1.manufacturing.service.mapping_engine import MappingSettings
from app.api.modules.v1.manufacturing.service.mapping_targets import TARGETS_BY_KEY, TargetSpec
from app.api.modules.v1.manufacturing.service.value_coercion import (
    FieldValueError,
    clean_text,
    coerce_value,
    is_identifier,
)


def get_target(key: str) -> TargetSpec:
    """Look up a canonical target or raise a readable error."""
    target = TARGETS_BY_KEY.get(key)
    if target is None:
        raise ValidationError(
            f"Unknown target '{key}'. Choose one of: {', '.join(sorted(TARGETS_BY_KEY))}."
        )
    return target


def validate_definition(
    target: TargetSpec, field_mapping: dict[str, str], defaults: dict[str, str]
) -> tuple[dict[str, str], dict[str, str]]:
    """
    Check a mapping definition and return it with blank entries removed.

    Raises:
        ValidationError: If a field is unknown, a default is invalid, or a required field has
            neither a mapped column nor a default value.
    """
    mapping = {k: v.strip() for k, v in field_mapping.items() if v and v.strip()}
    constants = {k: v.strip() for k, v in defaults.items() if v and v.strip()}
    names = {f.name for f in target.fields}

    unknown = sorted((set(mapping) | set(constants)) - names)
    if unknown:
        raise ValidationError(f"Unknown fields for '{target.label}': {unknown}.")

    problems: list[str] = []
    for name, value in constants.items():
        spec = target.field(name)
        try:
            _, warning = coerce_value(
                spec, clean_text(value, keep_placeholders=is_identifier(spec))
            )
        except FieldValueError as exc:
            problems.append(f"Default for '{name}': {exc}")
            continue
        if warning == "text_truncated":
            problems.append(f"Default for '{name}' is longer than the {spec.max_length} allowed")
    missing = [
        f.name
        for f in target.fields
        if f.required and f.name not in mapping and f.name not in constants
    ]
    if missing:
        problems.append(f"Required fields are not mapped: {missing}")
    if problems:
        raise ValidationError("; ".join(problems))
    return mapping, constants


def check_columns_exist(mapping: dict[str, str], columns: list[str]) -> None:
    """Every mapped source column must be present in the uploaded file."""
    absent = sorted({col for col in mapping.values() if col not in columns})
    if absent:
        raise ValidationError(
            f"These mapped columns are not in the file: {absent}. "
            "Choose a different column or upload the matching file."
        )


def build_settings(
    target_key: str,
    field_mapping: dict[str, str],
    defaults: dict[str, str],
    dataset_id: str | None,
    duplicate_strategy: str,
    columns: list[str] | None = None,
) -> MappingSettings:
    """Validate a definition (and, when given, the file's columns) and package it for the engine."""
    target = get_target(target_key)
    mapping, constants = validate_definition(target, field_mapping, defaults)
    if columns is not None:
        check_columns_exist(mapping, columns)
    return MappingSettings(
        target=target,
        field_mapping=mapping,
        defaults=constants,
        dataset_id=clean_text(dataset_id),
        duplicate_strategy=duplicate_strategy,
    )
