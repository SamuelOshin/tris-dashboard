"""
TRIS User Seeder CLI Script.
Initializes database tables, creates demo user personas with Argon2id passwords,
and sets up database triggers without ingesting test data.

Usage:
    uv run python -m app.scripts.seed_users
"""

import asyncio
import sys

from app.scripts.seed import seed_users_and_triggers

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_users_and_triggers())
