from __future__ import annotations

from datetime import datetime
import csv
import io


REQUIRED_PRICE_COLUMNS = {
    "price_datetime",
    "open_price",
    "high_price",
    "low_price",
    "close_price",
}


def validate_csv_headers(csv_content: str) -> list[str]:
    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    fieldnames = set(reader.fieldnames or [])
    missing = REQUIRED_PRICE_COLUMNS - fieldnames
    return sorted(missing)


def validate_price_row(row: dict) -> None:
    datetime.fromisoformat(str(row["price_datetime"]).replace("Z", "+00:00"))
    for key in ("open_price", "high_price", "low_price", "close_price"):
        float(row[key])
    if row.get("volume") not in (None, ""):
        float(row["volume"])
