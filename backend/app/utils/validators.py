from __future__ import annotations

from datetime import datetime, timezone
import csv
import io
import re


REQUIRED_PRICE_COLUMNS = {
    "price_datetime",
    "open_price",
    "high_price",
    "low_price",
    "close_price",
}
HEADERLESS_OHLCVT_COLUMNS = ["price_datetime", "open_price", "high_price", "low_price", "close_price", "volume", "trades"]


def normalize_csv_header(header: str) -> str:
    normalized = header.strip().lstrip("\ufeff").lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    return normalized.strip("_")


def normalize_price_datetime(value: str | int | float) -> str:
    raw_value = str(value).strip()
    if not raw_value:
        raise ValueError("Invalid price_datetime: empty value")

    if re.fullmatch(r"\d{10}(?:\.\d+)?", raw_value):
        return datetime.fromtimestamp(float(raw_value), tz=timezone.utc).replace(tzinfo=None).isoformat()

    if re.fullmatch(r"\d{13}(?:\.\d+)?", raw_value):
        return datetime.fromtimestamp(float(raw_value) / 1000, tz=timezone.utc).replace(tzinfo=None).isoformat()

    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00")).replace(tzinfo=None).isoformat()
    except ValueError as exc:
        raise ValueError(f"Invalid price_datetime: {value}") from exc


def is_headerless_ohlcvt(csv_content: str) -> bool:
    reader = csv.reader(io.StringIO(csv_content.strip()))
    first_row = next((row for row in reader if any(cell.strip() for cell in row)), [])
    if len(first_row) < 5:
        return False

    try:
        normalize_price_datetime(first_row[0])
        for value in first_row[1:5]:
            float(value)
        if len(first_row) > 5 and first_row[5].strip():
            float(first_row[5])
    except ValueError:
        return False

    return True


def validate_csv_headers(csv_content: str) -> list[str]:
    if is_headerless_ohlcvt(csv_content):
        return []

    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    fieldnames = {normalize_csv_header(field) for field in (reader.fieldnames or [])}
    missing = REQUIRED_PRICE_COLUMNS - fieldnames
    return sorted(missing)


def validate_price_row(row: dict) -> None:
    missing = REQUIRED_PRICE_COLUMNS - set(row)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    normalize_price_datetime(row["price_datetime"])

    for key in ("open_price", "high_price", "low_price", "close_price"):
        try:
            float(row[key])
        except ValueError as exc:
            raise ValueError(f"Invalid numeric value for {key}: {row[key]}") from exc
    if row.get("volume") not in (None, ""):
        try:
            float(row["volume"])
        except ValueError as exc:
            raise ValueError(f"Invalid numeric value for volume: {row['volume']}") from exc
