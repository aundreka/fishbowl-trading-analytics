from __future__ import annotations


def _moving_average(values: list[float], period: int) -> list[float | None]:
    output: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < period:
            output.append(None)
            continue
        window = values[index + 1 - period : index + 1]
        output.append(sum(window) / period)
    return output


def _rsi(values: list[float], period: int) -> list[float | None]:
    output: list[float | None] = [None]
    gains: list[float] = []
    losses: list[float] = []
    for index in range(1, len(values)):
        change = values[index] - values[index - 1]
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))
        if index < period:
            output.append(None)
            continue
        avg_gain = sum(gains[index - period : index]) / period
        avg_loss = sum(losses[index - period : index]) / period
        if avg_loss == 0:
            output.append(100.0)
            continue
        rs = avg_gain / avg_loss
        output.append(100 - (100 / (1 + rs)))
    return output


def generate_signals(strategy_key: str, prices: list[dict], parameters: dict) -> list[str]:
    closes = [float(price["close_price"]) for price in prices]
    signals = ["HOLD"] * len(prices)

    if strategy_key == "moving_average_crossover":
        short_window = int(parameters.get("short_window", 10))
        long_window = int(parameters.get("long_window", 30))
        short_ma = _moving_average(closes, short_window)
        long_ma = _moving_average(closes, long_window)
        for index in range(1, len(prices)):
            if not short_ma[index] or not long_ma[index] or not short_ma[index - 1] or not long_ma[index - 1]:
                continue
            if short_ma[index] > long_ma[index] and short_ma[index - 1] <= long_ma[index - 1]:
                signals[index] = "BUY"
            elif short_ma[index] < long_ma[index] and short_ma[index - 1] >= long_ma[index - 1]:
                signals[index] = "SELL"
        return signals

    if strategy_key == "rsi_reversal":
        period = int(parameters.get("rsi_period", 14))
        oversold = float(parameters.get("oversold_threshold", 30))
        overbought = float(parameters.get("overbought_threshold", 70))
        rsi_values = _rsi(closes, period)
        for index, rsi_value in enumerate(rsi_values):
            if rsi_value is None:
                continue
            if rsi_value <= oversold:
                signals[index] = "BUY"
            elif rsi_value >= overbought:
                signals[index] = "SELL"
        return signals

    return signals
