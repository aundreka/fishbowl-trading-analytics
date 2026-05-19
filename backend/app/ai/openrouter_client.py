from __future__ import annotations

import json
from socket import timeout as SocketTimeout
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.ai.prompts import SYSTEM_PROMPT
from app.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_API_URL,
    OPENROUTER_APP_NAME,
    OPENROUTER_MODEL,
    OPENROUTER_SITE_URL,
    OPENROUTER_TIMEOUT_SECONDS,
)


def ask_openrouter(question: str, context: dict | None = None) -> dict:
    context = context or {}

    if not OPENROUTER_API_KEY:
        return _local_fallback(question, context, "OPENROUTER_API_KEY is not configured.")

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(question, context)},
        ],
        "reasoning": {
            "effort": "none",
            "exclude": True,
        },
        "temperature": 0.3,
        "max_tokens": 220,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    if OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = OPENROUTER_SITE_URL
    if OPENROUTER_APP_NAME:
        headers["X-OpenRouter-Title"] = OPENROUTER_APP_NAME

    request = Request(
        OPENROUTER_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(request, timeout=OPENROUTER_TIMEOUT_SECONDS) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return _local_fallback(question, context, _read_http_error(exc))
    except (URLError, SocketTimeout, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        return _local_fallback(question, context, f"OpenRouter request failed: {exc}")

    answer = _extract_answer(response_payload)
    if not answer:
        return _local_fallback(question, context, "OpenRouter returned an empty answer.")

    return {
        "provider": "openrouter",
        "model": response_payload.get("model", OPENROUTER_MODEL),
        "live": True,
        "answer": answer,
    }


def _build_user_prompt(question: str, context: dict) -> str:
    metrics = context.get("metrics")
    if not metrics:
        return question

    metrics_json = json.dumps(metrics, indent=2, sort_keys=True)
    return (
        f"{question}\n\n"
        "Latest backtest metrics:\n"
        f"{metrics_json}\n\n"
        "Use the metrics when relevant. Keep the answer short."
    )


def _extract_answer(response_payload: dict) -> str:
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""

    message = choices[0].get("message", {})
    content = message.get("content", "")

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"].strip())
        return "\n".join(part for part in text_parts if part).strip()

    return ""


def _read_http_error(exc: HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8", errors="replace")
    except Exception:
        body = ""

    if body:
        return f"OpenRouter request failed: HTTP {exc.code} - {body}"
    return f"OpenRouter request failed: HTTP {exc.code}"


def _local_fallback(question: str, context: dict, error: str | None = None) -> dict:
    lower_question = question.lower()
    if "moving average" in lower_question:
        answer = "Moving average crossover uses two averages. Buy when short moves above long. Sell when short drops below long."
    elif "sharpe" in lower_question:
        answer = "Sharpe near 1 is usually decent for a backtest. Higher means better risk-adjusted return."
    elif "drawdown" in lower_question:
        answer = "Reduce drawdown by cutting position size, slowing entries, or adding stronger exit rules. Test each change alone."
    elif "improve" in lower_question:
        answer = "Test fewer trades, tighter filters, lower fees, and wider parameter ranges. Compare one change at a time."
    else:
        metrics = context.get("metrics")
        if metrics:
            answer = (
                f"Latest run shows total return {metrics.get('total_return', 0)} "
                f"and Sharpe {metrics.get('sharpe_ratio', 0)}. Compare slower settings and lower-fee cases next."
            )
        else:
            answer = "Ask about strategy logic, metrics, or ways to improve a backtest."

    response = {
        "provider": "local-fallback",
        "model": "local-fallback",
        "live": False,
        "answer": answer,
    }

    if error:
        response["error"] = error

    return response
