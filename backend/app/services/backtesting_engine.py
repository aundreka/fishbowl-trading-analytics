from __future__ import annotations

from app.services.analytics import calculate_metrics
from app.services.strategy_logic import generate_signals


def run_backtest_engine(prices: list[dict], strategy: dict, parameters: dict, initial_capital: float, trading_fee: float) -> dict:
    signals = generate_signals(strategy["strategy_key"], prices, parameters)
    cash = initial_capital
    position = 0.0
    trades: list[dict] = []
    equity_curve: list[float] = []
    trade_index = 1

    for price, signal in zip(prices, signals):
        close_price = float(price["close_price"])

        if signal == "BUY" and cash > 0:
            fee_amount = cash * trading_fee
            quantity = max((cash - fee_amount) / close_price, 0)
            if quantity > 0:
                position = quantity
                cash = 0.0
                trades.append(
                    {
                        "trade_id": trade_index,
                        "trade_datetime": price["price_datetime"],
                        "trade_action": "BUY",
                        "quantity": round(quantity, 6),
                        "price": round(close_price, 6),
                        "fee": round(fee_amount, 2),
                        "cash_balance": round(cash, 2),
                        "position_balance": round(position, 6),
                    }
                )
                trade_index += 1

        elif signal == "SELL" and position > 0:
            gross_value = position * close_price
            fee_amount = gross_value * trading_fee
            cash = gross_value - fee_amount
            trades.append(
                {
                    "trade_id": trade_index,
                    "trade_datetime": price["price_datetime"],
                    "trade_action": "SELL",
                    "quantity": round(position, 6),
                    "price": round(close_price, 6),
                    "fee": round(fee_amount, 2),
                    "cash_balance": round(cash, 2),
                    "position_balance": 0.0,
                }
            )
            position = 0.0
            trade_index += 1

        equity_curve.append(round(cash + (position * close_price), 2))

    if prices and position > 0:
        final_price = float(prices[-1]["close_price"])
        gross_value = position * final_price
        fee_amount = gross_value * trading_fee
        cash = gross_value - fee_amount
        trades.append(
            {
                "trade_id": trade_index,
                "trade_datetime": prices[-1]["price_datetime"],
                "trade_action": "SELL",
                "quantity": round(position, 6),
                "price": round(final_price, 6),
                "fee": round(fee_amount, 2),
                "cash_balance": round(cash, 2),
                "position_balance": 0.0,
            }
        )
        equity_curve[-1] = round(cash, 2)

    final_equity = equity_curve[-1] if equity_curve else initial_capital
    metrics = calculate_metrics(initial_capital, final_equity, trades, equity_curve or [initial_capital])
    return {
        "trades": trades,
        "metrics": metrics,
        "equity_curve": equity_curve,
    }
