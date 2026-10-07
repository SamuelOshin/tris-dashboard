"""
Write the saved-mapping-profile definitions that ship with the handover.

Each JSON file has exactly the body that `POST /api/v1/manufacturing/mapping/profiles` accepts, so a
profile can be loaded into a running application (as an administrator) with the request shown in
docs/ERP_MAPPING_GUIDE.md. The definitions are taken from the application itself:
- the layouts for the sample files come from the preview of each sample file;
- Environment B comes from ENVIRONMENT_B_MAPPINGS, the configuration of that environment.

Run from the backend folder, with the backend running and demo sign-in on (or edit `sign_in`):
    uv run python ../docs/evidence/ticket-14/export_mapping_profiles.py
"""

import json
from pathlib import Path

import httpx

from app.scripts.environment_b import ENVIRONMENT_B_MAPPINGS

ROOT = Path(__file__).resolve().parents[3]
SAMPLES = ROOT / "docs" / "samples" / "erp_mapping"
OUT = ROOT / "docs" / "samples" / "mapping_profiles"
BASE = "http://localhost:8000/api/v1"

SAMPLE_FILES = {
    "generic_materials.csv": ("generic", "materials", "Generic layout: material master"),
    "generic_purchases.csv": ("generic", "purchase_records", "Generic layout: purchase records"),
    "generic_inventory.csv": ("generic", "inventory_records", "Generic layout: inventory"),
    "generic_bom.csv": ("generic", "bom_entries", "Generic layout: bill of materials"),
    "generic_material_costs.csv": ("generic", "material_costs", "Generic layout: material costs"),
    "generic_supplier_ops.csv": (
        "generic",
        "supplier_operations_metrics",
        "Generic layout: supplier operations",
    ),
    "generic_production.csv": ("generic", "production_records", "Generic layout: production volume"),
    "sap_style_materials.csv": ("sap_style", "materials", "SAP-style demonstration: materials"),
    "sap_style_purchases.csv": (
        "sap_style",
        "purchase_records",
        "SAP-style demonstration: purchase records",
    ),
    "dynamics_style_materials.csv": (
        "dynamics_style",
        "materials",
        "Dynamics 365-style demonstration: materials",
    ),
    "dynamics_style_purchases.csv": (
        "dynamics_style",
        "purchase_records",
        "Dynamics 365-style demonstration: purchase records",
    ),
    "dynamics_style_bom.csv": (
        "dynamics_style",
        "bom_entries",
        "Dynamics 365-style demonstration: bill of materials",
    ),
}


def slug(text: str) -> str:
    return "".join(c.lower() if c.isalnum() else "_" for c in text).strip("_")


def sign_in(client: httpx.Client) -> None:
    """Reviewer session through demo sign-in (the server must have DEMO_LOGIN_ENABLED=true)."""
    client.post(f"{BASE}/auth/demo-login", json={"role": "reviewer"}).raise_for_status()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    with httpx.Client(timeout=60) as client:
        sign_in(client)
        for filename, (layout, target, name) in SAMPLE_FILES.items():
            content = (SAMPLES / filename).read_bytes()
            reply = client.post(
                f"{BASE}/manufacturing/mapping/preview",
                files={"file": (filename, content, "text/csv")},
                data={"target": target},
            )
            reply.raise_for_status()
            mapping = reply.json()["data"]["suggestions"][layout]
            body = {
                "name": name,
                "description": f"Columns of {filename} matched to the standard {target} fields.",
                "source_profile": layout,
                "target": target,
                "field_mapping": mapping,
                "defaults": {},
            }
            (OUT / f"{slug(name)}.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
            written.append(name)
    for sheet, entry in ENVIRONMENT_B_MAPPINGS.items():
        body = {
            "name": f"Environment B: {sheet}",
            "description": f"Sheet '{sheet}' of environment_b_industrial.xlsx matched to {entry['target']}.",
            "source_profile": "generic",
            "target": entry["target"],
            "field_mapping": entry["field_mapping"],
            "defaults": entry.get("defaults", {}),
        }
        (OUT / f"{slug(body['name'])}.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
        written.append(body["name"])
    print(f"wrote {len(written)} profile definitions to {OUT}")


if __name__ == "__main__":
    main()
