"""
Tests for application settings and configuration normalization.
"""

from app.api.core.config import Settings


def test_database_url_normalization():
    """Verify that PostgreSQL connection URLs are normalized to async psycopg driver."""
    s1 = Settings(DATABASE_URL="postgresql://user:pass@localhost:5432/mydb")
    assert s1.DATABASE_URL == "postgresql+psycopg://user:pass@localhost:5432/mydb"

    s2 = Settings(DATABASE_URL="postgres://user:pass@localhost:5432/mydb")
    assert s2.DATABASE_URL == "postgresql+psycopg://user:pass@localhost:5432/mydb"

    s3 = Settings(DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/mydb")
    assert s3.DATABASE_URL == "postgresql+psycopg://user:pass@localhost:5432/mydb"

    s4 = Settings(DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/mydb")
    assert s4.DATABASE_URL == "postgresql+psycopg://user:pass@localhost:5432/mydb"

    s5 = Settings(DATABASE_URL="sqlite+aiosqlite:///:memory:")
    assert s5.DATABASE_URL == "sqlite+aiosqlite:///:memory:"
