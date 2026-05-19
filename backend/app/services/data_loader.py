from __future__ import annotations

import csv
import io

from app.utils.validators import (
    HEADERLESS_OHLCVT_COLUMNS,
    is_headerless_ohlcvt,
    normalize_csv_header,
    normalize_price_datetime,
    validate_csv_headers,
    validate_price_row,
)


def parse_price_csv(
    asset_id: int,
    dataset_id: int,
    csv_content: str,
    starting_price_id: int,
    header_map: dict | None = None,
) -> list[dict]:
    missing = validate_csv_headers(csv_content)
    if missing and not header_map:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    if is_headerless_ohlcvt(csv_content):
        reader = csv.DictReader(io.StringIO(csv_content.strip()), fieldnames=HEADERLESS_OHLCVT_COLUMNS)
    else:
        reader = csv.DictReader(io.StringIO(csv_content.strip()))

    rows: list[dict] = []
    current_id = starting_price_id

    for raw_row in reader:
        row = {normalize_csv_header(key): value for key, value in raw_row.items() if key}

        if header_map:
            mapped_row: dict[str, str] = {}
            for target_key, original_key in header_map.items():
                if not original_key:
                    continue

                source_key = normalize_csv_header(str(original_key))
                if source_key in row:
                    mapped_row[normalize_csv_header(str(target_key))] = row[source_key]

            row = {**row, **mapped_row}

        validate_price_row(row)
        rows.append(
            {
                "price_id": current_id,
                "asset_id": asset_id,
                "dataset_id": dataset_id,
                "price_datetime": normalize_price_datetime(row["price_datetime"]),
                "open_price": float(row["open_price"]),
                "high_price": float(row["high_price"]),
                "low_price": float(row["low_price"]),
                "close_price": float(row["close_price"]),
                "volume": float(row["volume"]) if row.get("volume") not in (None, "") else None,
            }
        )
        current_id += 1
    return rows
