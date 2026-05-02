from __future__ import annotations

from app.config import QWEN_API_KEY


def ask_qwen(question: str, context: dict | None = None) -> dict:
    context = context or {}
    if QWEN_API_KEY:
        return {
            "provider": "qwen",
            "live": False,
            "answer": "Qwen API wiring is configured by environment, but outbound network calls are not enabled in this local workspace session. The assistant returned a local fallback response instead.",
        }

    lower_question = question.lower()
    if "moving average" in lower_question:
        answer = "A moving average crossover strategy watches two averages. A buy signal happens when the short average moves above the long average, and a sell signal happens when it drops below."
    elif "sharpe" in lower_question:
        answer = "A Sharpe ratio around 1 is generally considered solid for a backtest. Values below that can still be useful, but they often suggest weaker risk-adjusted performance."
    elif "improve" in lower_question:
        answer = "Try testing fewer trades, adjusting entry thresholds, or pairing trend and momentum filters together. In Fishbowl, compare runs with different fees and parameter values before deciding which version is stronger."
    else:
        metrics = context.get("metrics")
        if metrics:
            answer = f"Your latest run returned {metrics.get('total_return', 0)}% with a Sharpe ratio of {metrics.get('sharpe_ratio', 0)}. A good next step is to compare it against a slower setting or a lower-fee scenario."
        else:
            answer = "Ask about a strategy, a metric, or ways to improve a backtest and I will explain it in simple terms."

    return {
        "provider": "local-fallback",
        "live": False,
        "answer": answer,
    }
