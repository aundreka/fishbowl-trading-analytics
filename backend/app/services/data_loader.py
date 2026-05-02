from __future__ import annotations

import csv
import io

from app.utils.validators import validate_csv_headers, validate_price_row


def parse_price_csv(asset_id: int, csv_content: str, starting_price_id: int) -> list[dict]:
    missing = validate_csv_headers(csv_content)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    rows: list[dict] = []
    current_id = starting_price_id
    for raw_row in reader:
        validate_price_row(raw_row)
        rows.append(
            {
                "price_id": current_id,
                "asset_id": asset_id,
                "price_datetime": raw_row["price_datetime"],
                "open_price": float(raw_row["open_price"]),
                "high_price": float(raw_row["high_price"]),
                "low_price": float(raw_row["low_price"]),
                "close_price": float(raw_row["close_price"]),
                "volume": float(raw_row["volume"]) if raw_row.get("volume") not in (None, "") else None,
            }
        )
        current_id += 1
    return rows
