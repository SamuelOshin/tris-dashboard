"""
Environment B: a synthetic industrial-products dataset (precision components and fasteners).

It is the second environment of the transferability test (decision D2). It is generated, not
copied from Environment A (the solar-panel samples in docs/samples/erp_mapping), and it is
deliberately different in the way a second company's export would be:

- one Excel workbook with a sheet per table (Environment A is separate CSV files);
- its own column names, none of which TRIS knows (no Generic, SAP-style or Dynamics-style match);
- dates written day.month.year, quantities with thousands separators, stock counts in "pcs";
- euro and dollar prices, several purchase lines a month with some missing months, a three-year
  span, a different part-number scheme, different categories and different suppliers;
- a commodity (steel) price surge, a tariff step on one supplier and a few thin histories.

The generator is deterministic (fixed seed): the same files come out every time. Nothing here is
read by the TRIS pipeline; the only way this data reaches it is through the ordinary file import
with the column mappings in ENVIRONMENT_B_MAPPINGS (the "configuration" of this environment).

    uv run python -m app.scripts.environment_b ../docs/samples/environment_b
"""

import calendar
import csv
import math
import random
import sys
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any

from openpyxl import Workbook

DATASET_ID = "Synthetic Environment B"
SEED = 20260412
FIRST_YEAR, MONTHS = 2023, 36

# (part no, description, commodity, unit, base price, currency, vendor, steel beta, volume)
PARTS: tuple[tuple[str, str, str, str, float, str, str, float, float], ...] = (
    ("4410-0231", "Hex bolt M8x30 A2-70", "Fasteners", "pcs", 0.082, "EUR", "V-HX-01", 1.0, 40000),
    ("4410-0238", "Hex bolt M10x40 8.8", "Fasteners", "pcs", 0.131, "EUR", "V-HX-01", 1.0, 25000),
    (
        "4412-0107",
        "Socket cap screw M6x20",
        "Fasteners",
        "pcs",
        0.074,
        "EUR",
        "V-HX-01",
        0.9,
        30000,
    ),
    ("4415-0042", "Self-locking nut M8", "Fasteners", "pcs", 0.041, "EUR", "V-HX-01", 0.8, 45000),
    ("5120-0310", "Ball bearing 6204-2RS", "Bearings", "pcs", 2.35, "USD", "V-BR-02", 0.2, 3000),
    (
        "5120-0455",
        "Tapered roller bearing 30205",
        "Bearings",
        "pcs",
        4.8,
        "USD",
        "V-BR-02",
        0.25,
        1800,
    ),
    (
        "6310-0088",
        "Turned shaft 20 mm h6",
        "Machined Parts",
        "pcs",
        7.9,
        "EUR",
        "V-MC-03",
        0.7,
        1200,
    ),
    (
        "6310-0121",
        "Machined bracket AL6061",
        "Machined Parts",
        "pcs",
        12.4,
        "EUR",
        "V-MC-03",
        0.6,
        900,
    ),
    (
        "6310-0190",
        "Ground dowel pin 6 mm",
        "Machined Parts",
        "pcs",
        0.19,
        "USD",
        "V-MC-03",
        0.7,
        20000,
    ),
    (
        "7020-0015",
        "Compression spring 1.2 mm",
        "Springs",
        "pcs",
        0.36,
        "USD",
        "V-SP-04",
        0.5,
        12000,
    ),
    ("7220-0064", "O-ring NBR 20x2", "Seals", "pcs", 0.052, "EUR", "V-SL-05", 0.1, 60000),
    ("8030-0210", "Gear housing casting", "Castings", "pcs", 18.6, "EUR", "V-CS-06", 0.9, 700),
)
VENDORS = (
    ("V-HX-01", "Hexagon Fixings GmbH", "Fasteners"),
    ("V-BR-02", "Brightline Bearings Inc", "Bearings"),
    ("V-MC-03", "Meridian Machining SA", "Machined Parts"),
    ("V-SP-04", "Spiral Spring Works", "Springs"),
    ("V-SL-05", "Sealwell Industrial", "Seals"),
    ("V-CS-06", "Castor Foundry Ltd", "Castings"),
)
ASSEMBLIES = (
    (
        "GBX-100",
        "Gearbox 100 series",
        (
            ("4410-0231", 12),
            ("4410-0238", 8),
            ("5120-0310", 2),
            ("6310-0088", 1),
            ("7220-0064", 4),
            ("8030-0210", 1),
        ),
    ),
    (
        "ACT-220",
        "Linear actuator 220",
        (
            ("4412-0107", 16),
            ("4415-0042", 16),
            ("5120-0455", 2),
            ("6310-0121", 2),
            ("6310-0190", 4),
            ("7020-0015", 3),
        ),
    ),
)
# parts whose history has missing months (a month with no purchase breaks the usable run)
GAPS = {"6310-0190": {8, 9, 20}, "7020-0015": {26}}
THIN = {"4415-0042": 9}  # first purchased only this many months before the end

RAW_COLUMNS: dict[str, list[str]] = {
    "Parts": ["Part No", "Part Description", "Commodity", "Stock UoM", "Drawing Rev"],
    "PO Lines": [
        "PO Line",
        "Part No",
        "Vendor Code",
        "Date Placed",
        "Qty Ordered",
        "Cost Each",
        "Cur",
        "Buyer Initials",
    ],
    "Stock": ["Part No", "Count Date", "Units In Stock", "Stock Value", "Cur"],
    "Assemblies": [
        "Assembly",
        "Assembly Name",
        "Component",
        "Per Assembly",
        "Meas Unit",
        "Valid From",
    ],
    "Std Costs": ["Part No", "Rev", "Valid From", "Valid To", "Planned Cost", "Cur"],
    "Vendor KPIs": ["Vendor Code", "Month", "Lead Days", "Delivered On Time"],
    "Builds": ["Assembly", "From", "To", "Built", "Meas Unit"],
    "Vendors": ["Vendor Code", "Vendor Name", "Commodity"],
}

# sheet -> TRIS table and {TRIS field: raw column}. This is all that differs from Environment A.
ENVIRONMENT_B_MAPPINGS: dict[str, dict[str, Any]] = {
    "Parts": {
        "target": "materials",
        "field_mapping": {
            "material_id": "Part No",
            "description": "Part Description",
            "category": "Commodity",
            "unit_of_measure": "Stock UoM",
        },
    },
    "PO Lines": {
        "target": "purchase_records",
        "field_mapping": {
            "purchase_reference": "PO Line",
            "material_id": "Part No",
            "supplier_id": "Vendor Code",
            "purchase_date": "Date Placed",
            "quantity": "Qty Ordered",
            "unit_price": "Cost Each",
            "currency": "Cur",
        },
    },
    "Stock": {
        "target": "inventory_records",
        "field_mapping": {
            "material_id": "Part No",
            "snapshot_date": "Count Date",
            "quantity_on_hand": "Units In Stock",
            "inventory_value": "Stock Value",
            "currency": "Cur",
        },
    },
    "Assemblies": {
        "target": "bom_entries",
        "field_mapping": {
            "product_sku": "Assembly",
            "product_description": "Assembly Name",
            "material_id": "Component",
            "bom_quantity": "Per Assembly",
            "unit_of_measure": "Meas Unit",
            "effective_from": "Valid From",
        },
    },
    "Std Costs": {
        "target": "material_costs",
        "field_mapping": {
            "material_id": "Part No",
            "version": "Rev",
            "effective_from": "Valid From",
            "effective_to": "Valid To",
            "standard_cost": "Planned Cost",
            "currency": "Cur",
        },
    },
    "Vendor KPIs": {
        "target": "supplier_operations_metrics",
        "field_mapping": {
            "supplier_id": "Vendor Code",
            "metric_date": "Month",
            "lead_time_days": "Lead Days",
            "on_time_delivery_rate": "Delivered On Time",
        },
    },
    "Builds": {
        "target": "production_records",
        "field_mapping": {
            "product_sku": "Assembly",
            "period_start": "From",
            "period_end": "To",
            "actual_volume": "Built",
            "unit_of_measure": "Meas Unit",
        },
    },
}
IMPORT_ORDER = ("Parts", "PO Lines", "Stock", "Assemblies", "Std Costs", "Vendor KPIs", "Builds")


def _month(index: int) -> tuple[int, int]:
    return FIRST_YEAR + index // 12, index % 12 + 1


def _dmy(day: date) -> str:
    return day.strftime("%d.%m.%Y")


def _thousands(value: float) -> str:
    return f"{value:,.0f}"


def _steel_index(rng: random.Random) -> list[float]:
    """Monthly steel price factor: calm, a surge in 2024, then a partial reversal."""
    level, out = 1.0, []
    for i in range(MONTHS):
        shock = 0.025 if 16 <= i <= 20 else (-0.012 if 27 <= i <= 33 else 0.0)
        level *= math.exp(shock + rng.gauss(0, 0.008))
        out.append(level)
    return out


def _price_path(rng: random.Random, part: tuple, steel: list[float]) -> list[float]:
    _, _, commodity, _, base, _, _, beta, _ = part
    own = 1.0
    path = []
    for i in range(MONTHS):
        own *= math.exp(rng.gauss(0.0015 if commodity == "Seals" else 0.0, 0.012))
        tariff = 1.09 if (commodity == "Castings" and i >= 24) else 1.0
        path.append(base * own * (steel[i] ** beta) * tariff)
    return path


def generate() -> dict[str, list[dict[str, Any]]]:
    """All sheets of Environment B as lists of rows keyed by the raw column names."""
    rng = random.Random(SEED)
    steel = _steel_index(rng)
    sheets: dict[str, list[dict[str, Any]]] = {name: [] for name in RAW_COLUMNS}
    line_no = 0
    for part in PARTS:
        part_no, descr, commodity, unit, base, cur, vendor, _, volume = part
        sheets["Parts"].append(
            {
                "Part No": part_no,
                "Part Description": descr,
                "Commodity": commodity,
                "Stock UoM": unit,
                "Drawing Rev": f"R{rng.randint(1, 4)}",
            }
        )
        path = _price_path(rng, part, steel)
        start = MONTHS - THIN.get(part_no, MONTHS)
        stock = volume * 1.5
        for i in range(start, MONTHS):
            year, month = _month(i)
            if i in GAPS.get(part_no, ()):
                continue
            lines = 1 + (rng.random() < 0.35) + (rng.random() < 0.1)
            bought = 0.0
            for _ in range(lines):
                line_no += 1
                day = date(year, month, rng.randint(2, 26))
                qty = max(1.0, round(volume / lines * math.exp(rng.gauss(0, 0.25))))
                bought += qty
                price = round(path[i] * (1 + rng.gauss(0, 0.004)), 4)
                sheets["PO Lines"].append(
                    {
                        "PO Line": f"B{line_no:05d}/10",
                        "Part No": part_no,
                        "Vendor Code": vendor,
                        "Date Placed": _dmy(day),
                        "Qty Ordered": _thousands(qty),
                        "Cost Each": price,
                        "Cur": cur,
                        "Buyer Initials": rng.choice(("KM", "TS", "JR")),
                    }
                )
            stock = max(0.0, stock + bought - volume * math.exp(rng.gauss(0, 0.1)))
            last = date(year, month, calendar.monthrange(year, month)[1])
            sheets["Stock"].append(
                {
                    "Part No": part_no,
                    "Count Date": last.isoformat(),
                    "Units In Stock": round(stock),
                    "Stock Value": round(stock * path[i], 2),
                    "Cur": cur,
                }
            )
        first_year = _month(start)[0]
        revisions = [(date(2025, 1, 1), None, 1.04)]
        if first_year <= 2024:  # a part first bought in 2025 only has the current revision
            revisions.insert(0, (date(first_year, 1, 1), date(2024, 12, 31), 1.0))
        for rev, (frm, to, mult) in enumerate(revisions, 1):
            sheets["Std Costs"].append(
                {
                    "Part No": part_no,
                    "Rev": rev,
                    "Valid From": _dmy(frm),
                    "Valid To": _dmy(to) if to else "",
                    "Planned Cost": round(base * mult, 4),
                    "Cur": cur,
                }
            )
    for assembly, name, comps in ASSEMBLIES:
        for part_no, qty in comps:
            sheets["Assemblies"].append(
                {
                    "Assembly": assembly,
                    "Assembly Name": name,
                    "Component": part_no,
                    "Per Assembly": qty,
                    "Meas Unit": "pcs",
                    "Valid From": "01.01.2023",
                }
            )
        for i in range(MONTHS - 12, MONTHS):
            year, month = _month(i)
            last = calendar.monthrange(year, month)[1]
            sheets["Builds"].append(
                {
                    "Assembly": assembly,
                    "From": _dmy(date(year, month, 1)),
                    "To": _dmy(date(year, month, last)),
                    "Built": round(900 * math.exp(rng.gauss(0, 0.05))),
                    "Meas Unit": "pcs",
                }
            )
    for vendor, vname, commodity in VENDORS:
        sheets["Vendors"].append(
            {"Vendor Code": vendor, "Vendor Name": vname, "Commodity": commodity}
        )
        lead = {"V-CS-06": 42, "V-BR-02": 28}.get(vendor, 21)
        for i in range(MONTHS):
            year, month = _month(i)
            drift = 1 + (0.012 * max(0, i - 24) if vendor == "V-CS-06" else 0)
            sheets["Vendor KPIs"].append(
                {
                    "Vendor Code": vendor,
                    "Month": f"{year}{month:02d}01",
                    "Lead Days": round(lead * drift * math.exp(rng.gauss(0, 0.05)), 1),
                    "Delivered On Time": round(min(1.0, max(0.5, rng.gauss(0.94, 0.03))), 3),
                }
            )
    return sheets


def workbook_bytes(sheets: dict[str, list[dict[str, Any]]]) -> bytes:
    """The workbook a second company would send: one sheet per table, text and numbers mixed."""
    book = Workbook()
    book.remove(book.active)
    for name, columns in RAW_COLUMNS.items():
        sheet = book.create_sheet(name)
        sheet.append(columns)
        for row in sheets[name]:
            sheet.append([row[c] for c in columns])
    out = BytesIO()
    book.save(out)
    return out.getvalue()


def write_samples(folder: Path) -> list[Path]:
    """Write the workbook and the vendor list (the vendor directory is loaded separately)."""
    folder.mkdir(parents=True, exist_ok=True)
    sheets = generate()
    book = folder / "environment_b_industrial.xlsx"
    book.write_bytes(workbook_bytes(sheets))
    vendors = folder / "environment_b_vendors.csv"
    with vendors.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=RAW_COLUMNS["Vendors"])
        writer.writeheader()
        writer.writerows(sheets["Vendors"])
    return [book, vendors]


if __name__ == "__main__":
    for written in write_samples(Path(sys.argv[1] if len(sys.argv) > 1 else ".")):
        print(written)
