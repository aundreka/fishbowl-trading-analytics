from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta
from math import sin
from pathlib import Path
import json
import threading

from app.config import DATA_DIR, STORE_PATH


STORE_LOCK = threading.Lock()


def _generate_price_series(asset_id: int, dataset_id: int, base_price: float, drift: float, amplitude: float) -> list[dict]:
    start_date = date(2025, 1, 1)
    series: list[dict] = []
    for day in range(365):
        current = start_date + timedelta(days=day)
        close = base_price + (drift * day) + (sin(day / 11) * amplitude)
        open_price = close * (0.992 + ((day % 5) * 0.001))
        high = max(open_price, close) * 1.012
        low = min(open_price, close) * 0.988
        series.append(
            {
                "price_id": len(series) + 1 if asset_id == 1 else len(series) + 366,
                "asset_id": asset_id,
                "dataset_id": dataset_id,
                "price_datetime": f"{current.isoformat()}T00:00:00",
                "open_price": round(open_price, 4),
                "high_price": round(high, 4),
                "low_price": round(low, 4),
                "close_price": round(close, 4),
                "volume": round(100000 + (day * 250) + (asset_id * 5000), 2),
            }
        )
    return series


def _default_store() -> dict:
    prices = _generate_price_series(1, 1, 145.0, 0.18, 6.5)
    prices.extend(_generate_price_series(2, 2, 41000.0, 22.0, 1800.0))
    return {
        "users": [
            {
                "user_id": 1,
                "full_name": "Admin User",
                "email": "admin@fishbowl.local",
                "password_hash": "24a21c8e1c0e502f453189130a09c9188e0ef6b592f6edf95a112b2babd3f9dc",
                "role": "admin",
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "user_id": 2,
                "full_name": "Student Trader",
                "email": "user@fishbowl.local",
                "password_hash": "24a21c8e1c0e502f453189130a09c9188e0ef6b592f6edf95a112b2babd3f9dc",
                "role": "user",
                "created_at": datetime.utcnow().isoformat(),
            },
        ],
        "sessions": [],
        "asset_types": [
            {"asset_type_id": 1, "type_name": "Stock"},
            {"asset_type_id": 2, "type_name": "Crypto"},
        ],
        "assets": [
            {
                "asset_id": 1,
                "asset_type_id": 1,
                "symbol": "AAPL",
                "asset_name": "Apple Inc.",
                "market": "NASDAQ",
            },
            {
                "asset_id": 2,
                "asset_type_id": 2,
                "symbol": "BTCUSD",
                "asset_name": "Bitcoin / US Dollar",
                "market": "CRYPTO",
            },
        ],
        "price_datasets": [
            {
                "dataset_id": 1,
                "asset_id": 1,
                "dataset_name": "Seeded AAPL 2025",
                "uploaded_at": datetime.utcnow().isoformat(),
                "source": "seed",
            },
            {
                "dataset_id": 2,
                "asset_id": 2,
                "dataset_name": "Seeded BTCUSD 2025",
                "uploaded_at": datetime.utcnow().isoformat(),
                "source": "seed",
            },
        ],
        "historical_prices": prices,
        "strategies": [
            {
                "strategy_id": 1,
                "strategy_name": "Moving Average Crossover",
                "strategy_key": "moving_average_crossover",
                "description": "Buy when the short moving average rises above the long moving average and sell when it falls below.",
            },
            {
                "strategy_id": 2,
                "strategy_name": "RSI Reversal",
                "strategy_key": "rsi_reversal",
                "description": "Buy when RSI enters oversold territory and sell when it becomes overbought.",
            },
        ],
        "strategy_parameters": [
            {
                "parameter_id": 1,
                "strategy_id": 1,
                "parameter_name": "short_window",
                "data_type": "int",
                "default_value": "10",
            },
            {
                "parameter_id": 2,
                "strategy_id": 1,
                "parameter_name": "long_window",
                "data_type": "int",
                "default_value": "30",
            },
            {
                "parameter_id": 3,
                "strategy_id": 2,
                "parameter_name": "rsi_period",
                "data_type": "int",
                "default_value": "14",
            },
            {
                "parameter_id": 4,
                "strategy_id": 2,
                "parameter_name": "oversold_threshold",
                "data_type": "float",
                "default_value": "30",
            },
            {
                "parameter_id": 5,
                "strategy_id": 2,
                "parameter_name": "overbought_threshold",
                "data_type": "float",
                "default_value": "70",
            },
        ],
        "backtest_runs": [],
        "backtest_run_parameters": [],
        "simulated_trades": [],
        "performance_metrics": [],
}


def _migrate_store(store: dict) -> tuple[dict, bool]:
    changed = False
    if "price_datasets" not in store:
        store["price_datasets"] = []
        changed = True

    datasets = store["price_datasets"]
    assets = store.get("assets", [])
    prices = store.get("historical_prices", [])
    next_dataset_id = max((int(row.get("dataset_id", 0)) for row in datasets), default=0) + 1

    for asset in assets:
        asset_id = asset["asset_id"]
        asset_prices = [price for price in prices if price.get("asset_id") == asset_id]
        if not asset_prices:
            continue

        existing_dataset = next((row for row in datasets if row.get("asset_id") == asset_id), None)
        if not existing_dataset:
            dataset_name = asset.get("dataset_name") or f"Seeded {asset.get('symbol', 'Asset')} data"
            existing_dataset = {
                "dataset_id": next_dataset_id,
                "asset_id": asset_id,
                "dataset_name": dataset_name,
                "uploaded_at": asset.get("dataset_uploaded_at") or datetime.utcnow().isoformat(),
                "source": "upload" if asset.get("dataset_name") else "seed",
            }
            datasets.append(existing_dataset)
            next_dataset_id += 1
            changed = True

        for price in asset_prices:
            if "dataset_id" not in price:
                price["dataset_id"] = existing_dataset["dataset_id"]
                changed = True

    return store, changed


def ensure_store() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Path(STORE_PATH).parent.mkdir(parents=True, exist_ok=True)
    if not Path(STORE_PATH).exists():
        write_store(_default_store())
        return

    with STORE_LOCK:
        with open(STORE_PATH, "r", encoding="utf-8") as file:
            store = json.load(file)
        store, changed = _migrate_store(store)
        if changed:
            with open(STORE_PATH, "w", encoding="utf-8") as file:
                json.dump(store, file, indent=2)


def read_store() -> dict:
    ensure_store()
    with STORE_LOCK:
        with open(STORE_PATH, "r", encoding="utf-8") as file:
            return json.load(file)


def write_store(store: dict) -> None:
    with STORE_LOCK:
        with open(STORE_PATH, "w", encoding="utf-8") as file:
            json.dump(store, file, indent=2)


def next_id(store: dict, collection: str, id_field: str) -> int:
    rows = store.get(collection, [])
    if not rows:
        return 1
    return max(int(row[id_field]) for row in rows) + 1


def get_collection(collection: str) -> list[dict]:
    store = read_store()
    return deepcopy(store.get(collection, []))
