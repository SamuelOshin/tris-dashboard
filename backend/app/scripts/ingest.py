"""
TRIS Data Workbook Ingestion CLI Script.
Ingests an Excel workbook with synthetic or enterprise data into the database.

Usage:
    uv run python -m app.scripts.ingest --data-file "../test data.xlsx"
"""

import argparse
import asyncio
import sys

from app.scripts.seed import ingest_workbook_data

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    parser = argparse.ArgumentParser(description="TRIS Data Workbook Ingestion CLI")
    parser.add_argument(
        "--data-file",
        default="../test data.xlsx",
        help="Path to Excel workbook data file (default: ../test data.xlsx)",
    )
    args = parser.parse_args()
    asyncio.run(ingest_workbook_data(args.data_file))
