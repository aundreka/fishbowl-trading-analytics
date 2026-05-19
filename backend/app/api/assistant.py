from __future__ import annotations

import copy
import json
from datetime import datetime

from fastapi import APIRouter

from app.ai.gemini_client import ask_gemini
from app.db.database import read_store
from app.schemas.trade import AiConfigTuneRequest, AiQuestion

router = APIRouter()


@router.post("/ask")
def ask_assistant(payload: AiQuestion):
    response = ask_gemini(payload.question, {"metrics": payload.metrics} if payload.metrics else None)
    return response


@router.post("/tune-config")
def tune_config(payload: AiConfigTuneRequest):
    context = _build_tune_context(payload.current_config)
    fallback = _fallback_config(payload.current_config, payload.position_size, context)

    response = ask_gemini(
        _build_tune_prompt(payload.current_config, payload.position_size, payload.metrics, context),
        system_prompt=(
            "You tune educational trading backtest settings. Return only valid JSON with keys "
            "config, position_size, summary. Do not include financial advice."
        ),
        max_tokens=420,
        temperature=0.1,
        use_local_fallback=False,
    )
    tuned = _parse_tune_answer(response.get("answer", ""))
    if not tuned:
        return {
            "provider": "local-fallback",
            "model": "local-fallback",
            "live": False,
            **fallback,
            "error": response.get("error"),
        }

    config = _sanitize_config(tuned.get("config", {}), fallback["config"], context)
    position_size = _clamp_int(tuned.get("position_size", fallback["position_size"]), 5, 100, fallback["position_size"])
    summary = str(tuned.get("summary") or fallback["summary"])[:240]

    return {
        "provider": response.get("provider", "gemini"),
        "model": response.get("model", "unknown"),
        "live": bool(response.get("live")),
        "config": config,
        "position_size": position_size,
        "summary": summary,
        "error": response.get("error"),
    }


def _build_tune_context(current_config: dict) -> dict:
    store = read_store()
    asset_id = int(current_config.get("asset_id", 0) or 0)
    dataset_id = current_config.get("dataset_id")
    dataset_id = int(dataset_id) if dataset_id is not None else None
    strategy_id = int(current_config.get("strategy_id", 0) or 0)
    asset = next((row for row in store["assets"] if row["asset_id"] == asset_id), None)
    dataset = None
    if dataset_id is not None:
        dataset = next((row for row in store.get("price_datasets", []) if row["dataset_id"] == dataset_id), None)
    strategy = next((row for row in store["strategies"] if row["strategy_id"] == strategy_id), None)
    prices = sorted(
        [
            row
            for row in store["historical_prices"]
            if row["asset_id"] == asset_id and (dataset_id is None or row.get("dataset_id") == dataset_id)
        ],
        key=lambda item: item["price_datetime"],
    )
    parameters = [row for row in store["strategy_parameters"] if row["strategy_id"] == strategy_id]
    first_date = prices[0]["price_datetime"][:10] if prices else current_config.get("start_date")
    last_date = prices[-1]["price_datetime"][:10] if prices else current_config.get("end_date")

    return {
        "asset": asset or {},
        "dataset": dataset or {},
        "strategy": strategy or {},
        "parameters": parameters,
        "price_points": len(prices),
        "first_date": first_date,
        "last_date": last_date,
    }


def _fallback_config(current_config: dict, position_size: int, context: dict) -> dict:
    config = copy.deepcopy(current_config)
    strategy_key = context.get("strategy", {}).get("strategy_key", "")
    price_points = int(context.get("price_points", 0) or 0)
    parameters = dict(config.get("parameters") or {})

    config["start_date"] = context.get("first_date") or config.get("start_date")
    config["end_date"] = context.get("last_date") or config.get("end_date")
    config["trading_fee"] = _clamp_float(config.get("trading_fee", 0.001), 0, 0.02, 0.001)

    if strategy_key == "moving_average_crossover":
        short_window = 10 if price_points >= 80 else max(3, min(8, price_points // 4))
        long_window = 30 if price_points >= 120 else max(short_window + 3, min(24, price_points // 2))
        parameters["short_window"] = short_window
        parameters["long_window"] = long_window
    elif strategy_key == "rsi_reversal":
        parameters["rsi_period"] = 14 if price_points >= 60 else max(5, min(14, price_points // 3))
        parameters["oversold_threshold"] = 30
        parameters["overbought_threshold"] = 70

    config["parameters"] = parameters
    if context.get("asset") and context.get("strategy"):
        config["run_name"] = f"{context['asset'].get('symbol')} {context['strategy'].get('strategy_name')} AI Tune"

    return {
        "config": config,
        "position_size": _clamp_int(position_size, 5, 35, 15),
        "summary": "Adjusted dates to available data and set conservative strategy parameters.",
    }


def _build_tune_prompt(current_config: dict, position_size: int, metrics: dict | None, context: dict) -> str:
    return json.dumps(
        {
            "task": "Tune this backtest config for an educational simulation.",
            "rules": [
                "Use available first_date and last_date.",
                "Keep initial_capital realistic.",
                "Keep trading_fee between 0 and 0.02.",
                "For moving_average_crossover, short_window must be less than long_window.",
                "For rsi_reversal, oversold_threshold must be less than overbought_threshold.",
            ],
            "current_config": current_config,
            "current_position_size": position_size,
            "latest_metrics": metrics,
            "context": context,
            "output_shape": {
                "config": current_config,
                "position_size": position_size,
                "summary": "short reason for the changes",
            },
        },
        indent=2,
        sort_keys=True,
    )


def _parse_tune_answer(answer: str) -> dict | None:
    text = answer.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _sanitize_config(candidate: dict, fallback: dict, context: dict) -> dict:
    config = copy.deepcopy(fallback)
    if not isinstance(candidate, dict):
        return config

    for key in ("user_id", "asset_id", "strategy_id"):
        config[key] = int(fallback.get(key, candidate.get(key, 0)) or 0)
    config["dataset_id"] = fallback.get("dataset_id")

    config["run_name"] = str(candidate.get("run_name") or fallback.get("run_name") or "AI Tuned Backtest")[:100]
    config["start_date"] = _safe_date(candidate.get("start_date"), context.get("first_date") or fallback.get("start_date"))
    config["end_date"] = _safe_date(candidate.get("end_date"), context.get("last_date") or fallback.get("end_date"))
    config["initial_capital"] = _clamp_float(candidate.get("initial_capital"), 100, 10_000_000, fallback.get("initial_capital", 10000))
    config["trading_fee"] = _clamp_float(candidate.get("trading_fee"), 0, 0.02, fallback.get("trading_fee", 0.001))
    config["parameters"] = _sanitize_parameters(candidate.get("parameters"), fallback.get("parameters", {}), context)

    return config


def _sanitize_parameters(candidate: object, fallback: dict, context: dict) -> dict:
    parameters = dict(fallback)
    if not isinstance(candidate, dict):
        return parameters

    strategy_key = context.get("strategy", {}).get("strategy_key", "")
    price_points = max(int(context.get("price_points", 0) or 0), 20)

    if strategy_key == "moving_average_crossover":
        short_window = _clamp_int(candidate.get("short_window"), 2, max(3, price_points // 3), int(parameters.get("short_window", 10)))
        long_window = _clamp_int(candidate.get("long_window"), short_window + 1, max(short_window + 2, price_points - 1), int(parameters.get("long_window", short_window + 5)))
        parameters["short_window"] = short_window
        parameters["long_window"] = long_window
    elif strategy_key == "rsi_reversal":
        parameters["rsi_period"] = _clamp_int(candidate.get("rsi_period"), 2, max(3, price_points // 2), int(parameters.get("rsi_period", 14)))
        oversold = _clamp_float(candidate.get("oversold_threshold"), 5, 45, float(parameters.get("oversold_threshold", 30)))
        overbought = _clamp_float(candidate.get("overbought_threshold"), 55, 95, float(parameters.get("overbought_threshold", 70)))
        if oversold >= overbought:
            oversold, overbought = 30, 70
        parameters["oversold_threshold"] = oversold
        parameters["overbought_threshold"] = overbought

    return parameters


def _safe_date(value: object, fallback: object) -> str:
    raw = str(value or fallback or "")
    try:
        return datetime.fromisoformat(raw[:10]).date().isoformat()
    except ValueError:
        return str(fallback or "")


def _clamp_int(value: object, minimum: int, maximum: int, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(minimum, min(maximum, parsed))


def _clamp_float(value: object, minimum: float, maximum: float, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = fallback
    return round(max(minimum, min(maximum, parsed)), 6)
