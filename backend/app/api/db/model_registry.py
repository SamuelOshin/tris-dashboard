"""
Central Model Registry.
Ensures all SQLModel classes are imported and registered in SQLModel.metadata.
"""

import importlib
import logging

logger = logging.getLogger("tris.db")

MODEL_MODULES = [
    "app.api.modules.v1.auth.models",
    "app.api.modules.v1.suppliers.models",
    "app.api.modules.v1.transactions.models",
    "app.api.modules.v1.approvals.models",
    "app.api.modules.v1.access_events.models",
    "app.api.modules.v1.rules.models",
    "app.api.modules.v1.cases.models",
    "app.api.modules.v1.ingestion.models",
    "app.api.modules.v1.notifications.models",
]


def ensure_models_registered() -> None:
    """Import all model modules to register tables with SQLModel metadata."""
    for module_name in MODEL_MODULES:
        try:
            importlib.import_module(module_name)
        except ImportError as e:
            logger.debug(f"Module {module_name} not yet initialized: {e}")
