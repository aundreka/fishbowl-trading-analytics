from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.strategy import StrategyCreate, StrategyUpdate

router = APIRouter()


@router.get("/")
def get_strategies():
    store = read_store()
    strategies = []
    for strategy in store["strategies"]:
        parameters = [row for row in store["strategy_parameters"] if row["strategy_id"] == strategy["strategy_id"]]
        strategies.append({**strategy, "parameters": parameters})
    return {"strategies": strategies}


@router.post("/")
def create_strategy(payload: StrategyCreate):
    store = read_store()
    strategy = {
        "strategy_id": next_id(store, "strategies", "strategy_id"),
        **payload.model_dump(),
    }
    store["strategies"].append(strategy)
    write_store(store)
    return {"message": "Strategy created.", "strategy": strategy}


@router.put("/{strategy_id}")
def update_strategy(strategy_id: int, payload: StrategyUpdate):
    store = read_store()
    strategy = next((row for row in store["strategies"] if row["strategy_id"] == strategy_id), None)
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found.")
    for key, value in payload.model_dump(exclude_none=True).items():
        strategy[key] = value
    write_store(store)
    return {"message": "Strategy updated.", "strategy": strategy}


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: int):
    store = read_store()
    store["strategies"] = [row for row in store["strategies"] if row["strategy_id"] != strategy_id]
    store["strategy_parameters"] = [row for row in store["strategy_parameters"] if row["strategy_id"] != strategy_id]
    write_store(store)
    return {"message": "Strategy deleted."}
