from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.asset import AssetCreate, AssetUpdate, HistoricalDataUpload
from app.services.data_loader import parse_price_csv
from app.utils.validators import validate_csv_headers

router = APIRouter()


@router.get("/")
def get_assets():
    store = read_store()
    type_lookup = {row["asset_type_id"]: row["type_name"] for row in store["asset_types"]}
    assets = []
    for asset in store["assets"]:
        asset_prices = [price for price in store["historical_prices"] if price["asset_id"] == asset["asset_id"]]
        assets.append(
            {
                **asset,
                "asset_type": type_lookup.get(asset["asset_type_id"], "Unknown"),
                "price_points": len(asset_prices),
            }
        )
    return {"assets": assets, "asset_types": store["asset_types"]}


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
    return {
        "valid": not missing,
        "missing_columns": missing,
    }


@router.post("/upload")
def upload_historical_data(payload: HistoricalDataUpload):
    store = read_store()
    asset = next((row for row in store["assets"] if row["asset_id"] == payload.asset_id), None)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    next_price_id = next_id(store, "historical_prices", "price_id")
    rows = parse_price_csv(payload.asset_id, payload.csv_content, next_price_id)
    store["historical_prices"] = [row for row in store["historical_prices"] if row["asset_id"] != payload.asset_id]
    store["historical_prices"].extend(rows)
    write_store(store)
    return {"message": "Historical data uploaded.", "rows_imported": len(rows)}


@router.get("/{asset_id}/prices")
def get_asset_prices(asset_id: int):
    store = read_store()
    prices = [row for row in store["historical_prices"] if row["asset_id"] == asset_id]
    prices.sort(key=lambda item: item["price_datetime"])
    return {"prices": prices}
