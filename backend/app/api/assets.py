from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.asset import AssetCreate, AssetUpdate, HistoricalDataUpload
from app.services.ai_mapper import REQUIRED_COLUMNS, map_headers_with_ai
from app.services.data_loader import parse_price_csv
from app.utils.validators import validate_csv_headers

router = APIRouter()


@router.get("/")
def get_assets():
    store = read_store()
    type_lookup = {row["asset_type_id"]: row["type_name"] for row in store["asset_types"]}
    assets = []
    datasets = []
    prices_by_dataset: dict[int, list[dict]] = {}
    for price in store["historical_prices"]:
        prices_by_dataset.setdefault(price.get("dataset_id"), []).append(price)

    for dataset in store.get("price_datasets", []):
        dataset_prices = prices_by_dataset.get(dataset["dataset_id"], [])
        dataset_prices.sort(key=lambda item: item["price_datetime"])
        datasets.append(
            {
                **dataset,
                "price_points": len(dataset_prices),
                "first_price_date": dataset_prices[0]["price_datetime"][:10] if dataset_prices else None,
                "last_price_date": dataset_prices[-1]["price_datetime"][:10] if dataset_prices else None,
            }
        )

    for asset in store["assets"]:
        asset_prices = [price for price in store["historical_prices"] if price["asset_id"] == asset["asset_id"]]
        asset_prices.sort(key=lambda item: item["price_datetime"])
        asset_datasets = [dataset for dataset in datasets if dataset["asset_id"] == asset["asset_id"]]
        assets.append(
            {
                **asset,
                "asset_type": type_lookup.get(asset["asset_type_id"], "Unknown"),
                "price_points": len(asset_prices),
                "first_price_date": asset_prices[0]["price_datetime"][:10] if asset_prices else None,
                "last_price_date": asset_prices[-1]["price_datetime"][:10] if asset_prices else None,
                "datasets": asset_datasets,
            }
        )
    return {"assets": assets, "asset_types": store["asset_types"], "datasets": datasets}


@router.post("/")
def create_asset(payload: AssetCreate):
    store = read_store()
    asset = {
        "asset_id": next_id(store, "assets", "asset_id"),
        **payload.model_dump(),
    }
    store["assets"].append(asset)
    write_store(store)
    return {"message": "Asset created.", "asset": asset}


@router.put("/{asset_id}")
def update_asset(asset_id: int, payload: AssetUpdate):
    store = read_store()
    asset = next((row for row in store["assets"] if row["asset_id"] == asset_id), None)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    for key, value in payload.model_dump(exclude_none=True).items():
        asset[key] = value
    write_store(store)
    return {"message": "Asset updated.", "asset": asset}


@router.delete("/{asset_id}")
def delete_asset(asset_id: int):
    store = read_store()
    store["assets"] = [row for row in store["assets"] if row["asset_id"] != asset_id]
    store["historical_prices"] = [row for row in store["historical_prices"] if row["asset_id"] != asset_id]
    write_store(store)
    return {"message": "Asset and its historical data deleted."}

@router.post("/validate-upload")
def validate_upload(payload: HistoricalDataUpload):
    missing = validate_csv_headers(payload.csv_content)
    ai_mapping = None
    if missing:
        ai_mapping = map_headers_with_ai(payload.csv_content)
        resolved = {k for k, v in ai_mapping.items() if v is not None}
        missing = sorted(REQUIRED_COLUMNS - resolved)

    validation_error = ""
    if not missing:
        try:
            parse_price_csv(payload.asset_id or 1, 0, payload.csv_content, 1, ai_mapping)
        except ValueError as exc:
            validation_error = str(exc)

    return {
        "valid": not missing and not validation_error,
        "missing_columns": missing,
        "ai_mapping": ai_mapping,
        "ai_normalized": bool(ai_mapping and any(ai_mapping.values())),
        "error": validation_error,
    }


@router.post("/upload")
def upload_historical_data(payload: HistoricalDataUpload):
    store = read_store()
    
    if payload.asset_id:
        asset = next((row for row in store["assets"] if row["asset_id"] == payload.asset_id), None)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")
    else:
        # Create a new asset automatically
        symbol = payload.symbol or (payload.dataset_name.split()[0] if payload.dataset_name else "UNKNOWN")
        asset_id = next_id(store, "assets", "asset_id")
        asset = {
            "asset_id": asset_id,
            "asset_type_id": 1,
            "symbol": symbol[:20],
            "asset_name": symbol,
            "market": "Uploaded",
        }
        store["assets"].append(asset)
        payload.asset_id = asset_id

    missing = validate_csv_headers(payload.csv_content)
    ai_mapping = None
    if missing:
        ai_mapping = map_headers_with_ai(payload.csv_content)

    dataset_id = next_id(store, "price_datasets", "dataset_id")
    dataset_name = payload.dataset_name.strip() if payload.dataset_name and payload.dataset_name.strip() else f"{asset['symbol']} uploaded dataset"
    dataset_record = {
        "dataset_id": dataset_id,
        "asset_id": payload.asset_id,
        "dataset_name": dataset_name,
        "uploaded_at": datetime.utcnow().isoformat(),
        "source": "upload",
    }

    next_price_id = next_id(store, "historical_prices", "price_id")
    try:
        rows = parse_price_csv(payload.asset_id, dataset_id, payload.csv_content, next_price_id, ai_mapping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    store.setdefault("price_datasets", []).append(dataset_record)
    store["historical_prices"].extend(rows)
    asset["dataset_name"] = dataset_name
    asset["dataset_uploaded_at"] = datetime.utcnow().isoformat()
    asset["dataset_rows"] = len(rows)
    write_store(store)
    return {
        "message": "Historical data uploaded.",
        "rows_imported": len(rows),
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "ai_mapped": bool(ai_mapping and any(ai_mapping.values())),
        "ai_mapping": ai_mapping,
    }


@router.get("/{asset_id}/prices")
def get_asset_prices(asset_id: int, dataset_id: Optional[int] = None):
    store = read_store()
    prices = [row for row in store["historical_prices"] if row["asset_id"] == asset_id]
    if dataset_id is not None:
        prices = [row for row in prices if row.get("dataset_id") == dataset_id]
    prices.sort(key=lambda item: item["price_datetime"])
    return {"prices": prices}
