"""
TRIS FastAPI Application Entrypoint.
Initializes FastAPI, configures CORS, registers global exception handlers, and mounts API routers.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.core.config import settings
from app.api.core.custom_exceptions.register import register_exception_handlers
from app.api.db.database import create_db_and_tables
from app.api.modules.v1.router import api_v1_router

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("tris.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("Starting up TRIS Risk Intelligence Engine...")
    try:
        await create_db_and_tables()
        logger.info("Database models verified and tables initialized.")
    except Exception as e:
        logger.warning(f"Database table initialization deferred or connecting to remote DB: {e}")
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


@app.get("/health", tags=["Health"])
async def root_health():
    """Root system health check."""
    return {"status": "HEALTHY", "system": "TRIS Risk Intelligence Engine", "version": "1.3.0"}
