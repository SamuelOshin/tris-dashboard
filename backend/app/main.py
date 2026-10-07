"""
TRIS FastAPI Application Entrypoint.
Initializes FastAPI, configures CORS, registers global exception handlers, and mounts API routers.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.api.core.config import settings
from app.api.core.custom_exceptions.register import register_exception_handlers
from app.api.db.auto_migrate import run_auto_migration
from app.api.db.database import engine
from app.api.db.schema_check import SchemaNotCurrentError, assert_schema_is_current
from app.api.modules.v1.router import api_v1_router
from app.api.utils.response_payloads import success_response

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("tris.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("Starting up TRIS Risk Intelligence Engine...")
    if settings.AUTO_MIGRATE:
        await run_auto_migration(engine)  # a failure stops start-up with the error
    try:
        revision = await assert_schema_is_current(engine)
        logger.info(f"Database schema is current (migration {revision}).")
    except SchemaNotCurrentError as exc:
        logger.error(str(exc))
        raise  # tables are only ever created by migrations: stop rather than run on a wrong schema
    except (OperationalError, OSError) as exc:
        # Only "cannot reach the database" is tolerated. An interface error (for example the wrong
        # event loop on Windows) is not, so an unchecked database is never served; any other failure
        # of the check (missing migrations folder, no permission to read the version table, ...)
        # also stops start-up.
        logger.warning(f"Could not reach the database to check its schema at start-up: {exc}")
    yield
    logger.info("Shutting down TRIS Engine.")


app = FastAPI(
    title="TRIS Risk Intelligence System API",
    description="Deterministic Risk Intelligence and Governed Case Lifecycle API for TRIS v1.3",
    version="1.3.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Global Exception Handlers (4-Layer Pattern)
register_exception_handlers(app)

# Mount API Routers
app.include_router(api_v1_router)


@app.get("/", tags=["System"])
async def root():
    """Root system entrypoint."""
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Welcome to Tris API v1.3 ...",
        data={
            "system": "TRIS Risk Intelligence Engine",
            "version": "1.3.0",
        },
    )


@app.get("/health", tags=["Health"])
async def root_health():
    """Root system health check."""
    return {"status": "HEALTHY", "system": "TRIS Risk Intelligence Engine", "version": "1.3.0"}
