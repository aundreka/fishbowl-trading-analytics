from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.backtest import BacktestRequest, CompareRequest
from app.services.backtesting_engine import run_backtest_engine

router = APIRouter()


@router.get("/runs")
def list_runs():
    store = read_store()
    metrics_lookup = {row["backtest_run_id"]: row for row in store["performance_metrics"]}
    runs = []
    for run in store["backtest_runs"]:
        metrics = metrics_lookup.get(run["backtest_run_id"], {})
        runs.append({**run, "metrics": metrics})
    runs.sort(key=lambda item: item["created_at"], reverse=True)
    return {"runs": runs}


@router.get("/runs/{run_id}")
def get_run(run_id: int):
    store = read_store()
    run = next((row for row in store["backtest_runs"] if row["backtest_run_id"] == run_id), None)
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found.")
    trades = [row for row in store["simulated_trades"] if row["backtest_run_id"] == run_id]
    metrics = next((row for row in store["performance_metrics"] if row["backtest_run_id"] == run_id), None)
    parameters = [row for row in store["backtest_run_parameters"] if row["backtest_run_id"] == run_id]
    return {"run": run, "trades": trades, "metrics": metrics, "parameters": parameters}


@router.post("/compare")
def compare_runs(payload: CompareRequest):
    store = read_store()
    metrics_lookup = {row["backtest_run_id"]: row for row in store["performance_metrics"]}
    comparison = []
    for run_id in payload.run_ids:
        run = next((row for row in store["backtest_runs"] if row["backtest_run_id"] == run_id), None)
        if run:
            comparison.append({**run, "metrics": metrics_lookup.get(run_id, {})})
    return {"comparison": comparison}


@router.delete("/runs/{run_id}")
def delete_run(run_id: int):
    store = read_store()
    store["backtest_runs"] = [row for row in store["backtest_runs"] if row["backtest_run_id"] != run_id]
    store["backtest_run_parameters"] = [row for row in store["backtest_run_parameters"] if row["backtest_run_id"] != run_id]
    store["simulated_trades"] = [row for row in store["simulated_trades"] if row["backtest_run_id"] != run_id]
    store["performance_metrics"] = [row for row in store["performance_metrics"] if row["backtest_run_id"] != run_id]
    write_store(store)
    return {"message": "Backtest run deleted."}


@router.post("/run")
def run_backtest(payload: BacktestRequest):
    store = read_store()
    asset = next((row for row in store["assets"] if row["asset_id"] == payload.asset_id), None)
    strategy = next((row for row in store["strategies"] if row["strategy_id"] == payload.strategy_id), None)
    if not asset or not strategy:
        raise HTTPException(status_code=404, detail="Asset or strategy not found.")

    prices = [
        row
        for row in store["historical_prices"]
        if row["asset_id"] == payload.asset_id and payload.start_date <= row["price_datetime"][:10] <= payload.end_date
    ]
    prices.sort(key=lambda item: item["price_datetime"])
    if len(prices) < 20:
        raise HTTPException(status_code=400, detail="Not enough historical data in the selected date range.")

    results = run_backtest_engine(
        prices=prices,
        strategy=strategy,
        parameters=payload.parameters,
        initial_capital=payload.initial_capital,
        trading_fee=payload.trading_fee,
    )

    run_id = next_id(store, "backtest_runs", "backtest_run_id")
    run_record = {
        "backtest_run_id": run_id,
        "user_id": payload.user_id,
        "asset_id": payload.asset_id,
        "strategy_id": payload.strategy_id,
        "run_name": payload.run_name,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "initial_capital": payload.initial_capital,
        "trading_fee": payload.trading_fee,
        "created_at": datetime.utcnow().isoformat(),
    }
    store["backtest_runs"].append(run_record)

    parameter_defs = [row for row in store["strategy_parameters"] if row["strategy_id"] == payload.strategy_id]
    next_parameter_id = next_id(store, "backtest_run_parameters", "run_parameter_id")
    for parameter_def in parameter_defs:
        value = payload.parameters.get(parameter_def["parameter_name"], parameter_def["default_value"])
        store["backtest_run_parameters"].append(
            {
                "run_parameter_id": next_parameter_id,
                "backtest_run_id": run_id,
                "parameter_id": parameter_def["parameter_id"],
                "parameter_value": str(value),
            }
        )
        next_parameter_id += 1

    next_trade_id = next_id(store, "simulated_trades", "trade_id")
    stored_trades = []
    for trade in results["trades"]:
        stored_trades.append({"trade_id": next_trade_id, "backtest_run_id": run_id, **{k: v for k, v in trade.items() if k != "trade_id"}})
        next_trade_id += 1
    store["simulated_trades"].extend(stored_trades)

    metric_id = next_id(store, "performance_metrics", "metric_id")
    metrics_record = {
        "metric_id": metric_id,
        "backtest_run_id": run_id,
        **results["metrics"],
    }
    store["performance_metrics"].append(metrics_record)
    write_store(store)

    return {
        "message": "Backtest completed successfully.",
        "run": run_record,
        "metrics": metrics_record,
        "trades": stored_trades,
        "equity_curve": results["equity_curve"],
        "asset": asset,
        "strategy": strategy,
    }
