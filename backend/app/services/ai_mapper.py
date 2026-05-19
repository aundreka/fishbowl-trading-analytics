from __future__ import annotations

import csv
import io
import json

from app.ai.gemini_client import ask_gemini
from app.utils.validators import normalize_csv_header


OUTPUT_COLUMNS = ["price_datetime", "open_price", "high_price", "low_price", "close_price", "volume", "trades"]
REQUIRED_COLUMNS = {"price_datetime", "open_price", "high_price", "low_price", "close_price"}

HEADER_ALIASES = {
    "price_datetime": {
        "date",
        "datetime",
        "date_time",
        "timestamp",
        "ts",
        "time",
        "open_time",
        "start_time",
        "period_start",
        "unix",
        "unix_time",
        "unix_timestamp",
        "price_date",
        "price_datetime",
    },
    "open_price": {"open", "o", "open_price", "opening_price"},
    "high_price": {"high", "h", "high_price", "highest_price"},
    "low_price": {"low", "l", "low_price", "lowest_price"},
    "close_price": {"close", "c", "close_price", "last", "last_price", "price", "adj_close", "adjusted_close"},
    "volume": {"volume", "vol", "v", "trade_volume", "total_volume", "base_volume", "quote_volume"},
    "trades": {"trades", "trade_count", "number_of_trades", "num_trades", "n_trades", "count"},
}

MAPPER_SYSTEM_PROMPT = """
You map trading CSV headers to this schema:
price_datetime, open_price, high_price, low_price, close_price, volume, trades.

Return only valid JSON.
Keys must be the schema names.
Values must be exact source header names from the CSV.
Use null when no matching source header exists.
The trades field is optional and represents the number of individual trades.
""".strip()


def map_headers_with_ai(csv_content: str) -> dict[str, str | None]:
    headers, sample_rows = _read_sample(csv_content)
    mapping = _map_headers_locally(headers)

    if REQUIRED_COLUMNS.issubset({key for key, value in mapping.items() if value}):
        return _complete_mapping(mapping)

    ai_mapping = _map_headers_with_gemini(headers, sample_rows)
    mapping.update(ai_mapping)
    return _complete_mapping(mapping)


def _read_sample(csv_content: str) -> tuple[list[str], list[list[str]]]:
    reader = csv.reader(io.StringIO(csv_content.strip()))
    headers = next(reader, [])
    rows = []
    for _ in range(3):
        try:
            rows.append(next(reader))
        except StopIteration:
            break
    return headers, rows


def _map_headers_locally(headers: list[str]) -> dict[str, str | None]:
    mapping: dict[str, str | None] = {}
    normalized_lookup = {normalize_csv_header(header): header for header in headers}

    for target_key, aliases in HEADER_ALIASES.items():
        if target_key in normalized_lookup:
            mapping[target_key] = normalized_lookup[target_key]
            continue

        matched_header = None
        for normalized_header, original_header in normalized_lookup.items():
            if normalized_header in aliases:
                matched_header = original_header
                break

        mapping[target_key] = matched_header

    return mapping


def _map_headers_with_gemini(headers: list[str], sample_rows: list[list[str]]) -> dict[str, str | None]:
    if not headers:
        return {}

    sample = "\n".join(",".join(row) for row in [headers, *sample_rows])
    question = (
        "Map this CSV sample to the required schema.\n\n"
        f"{sample}\n\n"
        "Return JSON only."
    )
    response = ask_gemini(
        question,
        system_prompt=MAPPER_SYSTEM_PROMPT,
        max_tokens=320,
        temperature=0,
        use_local_fallback=False,
    )
    answer = _extract_json_text(response.get("answer", ""))

    try:
        parsed = json.loads(answer)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    return _sanitize_ai_mapping(parsed, headers)


def _sanitize_ai_mapping(raw_mapping: dict, headers: list[str]) -> dict[str, str | None]:
    normalized_lookup = {normalize_csv_header(header): header for header in headers}
    mapping: dict[str, str | None] = {}

    for target_key in OUTPUT_COLUMNS:
        source_header = raw_mapping.get(target_key)
        if source_header is None:
            mapping[target_key] = None
            continue
        if not isinstance(source_header, str):
            continue

        normalized_source = normalize_csv_header(source_header)
        if normalized_source in normalized_lookup:
            mapping[target_key] = normalized_lookup[normalized_source]

    return mapping


def _extract_json_text(answer: str) -> str:
    if "```json" in answer:
        return answer.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in answer:
        return answer.split("```", 1)[1].split("```", 1)[0].strip()
    return answer.strip()


def _complete_mapping(mapping: dict[str, str | None]) -> dict[str, str | None]:
    return {column: mapping.get(column) for column in OUTPUT_COLUMNS}
