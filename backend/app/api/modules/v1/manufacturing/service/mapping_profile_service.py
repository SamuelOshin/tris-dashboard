"""
Saved mapping profile service: create, list, fetch and delete reusable mappings.
Pure business logic — raises domain exceptions directly.
"""

from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import AlreadyExistsError, NotFoundError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.models import MappingProfile
from app.api.modules.v1.manufacturing.schemas.mapping_schemas import MappingProfileCreate
from app.api.modules.v1.manufacturing.service.mapping_definition import (
    get_target,
    validate_definition,
)
from app.api.modules.v1.manufacturing.service.value_coercion import clean_text


async def create_profile(
    session: AsyncSession, user: User, payload: MappingProfileCreate
) -> MappingProfile:
    """
    Save a mapping so it can be reloaded for later files.

    Raises:
        ValidationError: If the target, fields or defaults are not valid.
        AlreadyExistsError: If a profile with the same name already exists.
    """
    target = get_target(payload.target)
    mapping, defaults = validate_definition(target, payload.field_mapping, payload.defaults)
    name = payload.name.strip()
    existing = await session.execute(select(MappingProfile).where(MappingProfile.name == name))
    if existing.scalar_one_or_none() is not None:
        raise AlreadyExistsError(f"A mapping profile named '{name}' already exists.")

    profile = MappingProfile(
        profile_id=f"PROF-{uuid4().hex[:12]}",
        name=name,
        description=clean_text(payload.description),
        source_profile=payload.source_profile,
        target=target.key,
        field_mapping=mapping,
        defaults=defaults,
        created_by=user.user_id,
    )
    session.add(profile)
    await session.commit()
    return profile


async def list_profiles(session: AsyncSession, target: str | None = None) -> list[MappingProfile]:
    """All saved profiles, newest first, optionally limited to one target table."""
    stmt = select(MappingProfile).order_by(MappingProfile.created_at.desc())
    if target:
        stmt = stmt.where(MappingProfile.target == target)
    return list((await session.execute(stmt)).scalars().all())


async def get_profile(session: AsyncSession, profile_id: str) -> MappingProfile:
    """Fetch one profile or raise NotFoundError."""
    profile = await session.get(MappingProfile, profile_id)
    if profile is None:
        raise NotFoundError(f"Mapping profile '{profile_id}' was not found.")
    return profile


async def delete_profile(session: AsyncSession, profile_id: str) -> None:
    """Delete a profile. Past imports keep their own copy of the mapping they used."""
    profile = await get_profile(session, profile_id)
    await session.delete(profile)
    await session.commit()
