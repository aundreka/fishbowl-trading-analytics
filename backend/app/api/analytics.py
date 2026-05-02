from fastapi import APIRouter

from app.db.database import read_store

router = APIRouter()


@router.get("/summary")
def get_analytics_summary():
    store = read_store()
    metrics = store["performance_metrics"]
    strategies = {row["strategy_id"]: row["strategy_name"] for row in store["strategies"]}
    runs = store["backtest_runs"]

    best_run = None
    if metrics:
        best_run = max(metrics, key=lambda item: item.get("total_return", 0))

    average_sharpe = round(sum(item.get("sharpe_ratio", 0) for item in metrics) / len(metrics), 4) if metrics else 0
    total_assets = len(store["assets"])
    total_users = len(store["users"])
    recent_runs = sorted(runs, key=lambda item: item["created_at"], reverse=True)[:5]

    best_strategy = "N/A"
    if best_run:
        linked_run = next((run for run in runs if run["backtest_run_id"] == best_run["backtest_run_id"]), None)
        if linked_run:
            best_strategy = strategies.get(linked_run["strategy_id"], "N/A")

    return {
        "summary": {
            "total_backtests": len(runs),
            "total_assets": total_assets,
            "total_users": total_users,
            "best_strategy": best_strategy,
            "best_return": best_run.get("total_return", 0) if best_run else 0,
            "average_sharpe_ratio": average_sharpe,
            "recent_runs": recent_runs,
        }
    }


@router.get("/reports/backtests")
def get_backtest_report():
    store = read_store()
    metrics_lookup = {row["backtest_run_id"]: row for row in store["performance_metrics"]}
    rows = []
    for run in store["backtest_runs"]:
        rows.append({**run, "metrics": metrics_lookup.get(run["backtest_run_id"], {})})
    return {"report_type": "backtest_performance", "rows": rows}
