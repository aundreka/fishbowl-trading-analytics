from __future__ import annotations


def calculate_metrics(initial_capital: float, final_equity: float, trades: list[dict], equity_curve: list[float]) -> dict:
    total_return = ((final_equity - initial_capital) / initial_capital) * 100 if initial_capital else 0
    net_profit = final_equity - initial_capital
    total_trades = len(trades)

    wins = 0
    paired_buy_price = None
    returns: list[float] = []
    for trade in trades:
        if trade["trade_action"] == "BUY":
            paired_buy_price = trade["price"]
        elif trade["trade_action"] == "SELL" and paired_buy_price is not None:
            if trade["price"] > paired_buy_price:
                wins += 1
            returns.append((trade["price"] - paired_buy_price) / paired_buy_price)
            paired_buy_price = None

    peak = equity_curve[0] if equity_curve else initial_capital
    max_drawdown = 0.0
    for point in equity_curve:
        peak = max(peak, point)
        if peak:
            drawdown = ((point - peak) / peak) * 100
            max_drawdown = min(max_drawdown, drawdown)

    if returns:
        mean_return = sum(returns) / len(returns)
        variance = sum((value - mean_return) ** 2 for value in returns) / len(returns)
        sharpe_ratio = mean_return / (variance ** 0.5) if variance else mean_return
    else:
        sharpe_ratio = 0.0

    closed_trades = max(1, len(returns))
    return {
        "total_return": round(total_return, 4),
        "net_profit": round(net_profit, 2),
        "win_rate": round((wins / closed_trades) * 100, 2) if returns else 0.0,
        "max_drawdown": round(max_drawdown, 4),
        "sharpe_ratio": round(sharpe_ratio, 4),
        "total_trades": total_trades,
    }
