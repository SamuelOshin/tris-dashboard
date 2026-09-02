"""
Database Engine, Session Factory, and Dependency Injection for TRIS.
Uses SQLAlchemy 2.0 Async Engine with SQLModel integration.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.api.core.config import settings

# Construct async engine with pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    future=True,
    pool_pre_ping=True,
)

# Async session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an asynchronous database session.
    Automatically commits on success or rolls back on exception.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_db_and_tables() -> None:
    """Create all database tables registered with SQLModel metadata."""
    from app.api.db.model_registry import ensure_models_registered

    ensure_models_registered()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
