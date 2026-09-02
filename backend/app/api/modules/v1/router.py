"""
V1 API Router Assembly.
Combines all domain module routers under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.modules.v1.ingestion.routes.ingestion_routes import (
    router as ingestion_router,
)
from app.api.modules.v1.rules.routes.rule_routes import router as rules_router
from app.api.modules.v1.suppliers.routes.supplier_routes import (
    router as suppliers_router,
)

api_v1_router = APIRouter(prefix="/api/v1")

# Register domain module routers
api_v1_router.include_router(ingestion_router)
api_v1_router.include_router(suppliers_router)
api_v1_router.include_router(rules_router)


@api_v1_router.get("/health", tags=["Health"])
async def api_health():
    """V1 API health check endpoint."""
    return {"status": "HEALTHY", "version": "1.3.0"}
