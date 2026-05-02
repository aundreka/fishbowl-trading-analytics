"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { currency, percent } from "../../lib/utils";

type Asset = { asset_id: number; symbol: string };
type Strategy = {
  strategy_id: number;
  strategy_name: string;
  parameters: Array<{ parameter_name: string; default_value: string }>;
};

export default function BacktestPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState({
    user_id: 1,
    asset_id: 1,
    strategy_id: 1,
    run_name: "AAPL MA Demo",
    start_date: "2025-02-01",
    end_date: "2025-12-15",
    initial_capital: 10000,
    trading_fee: 0.001,
    parameters: { short_window: 10, long_window: 30 },
  });
  const [result, setResult] = useState<any>(null);
  const [aiQuestion, setAiQuestion] = useState("How can I improve my strategy performance?");
  const [aiAnswer, setAiAnswer] = useState("");

  useEffect(() => {
    apiFetch<{ assets: Asset[] }>("/assets").then((data) => setAssets(data.assets));
    apiFetch<{ strategies: Strategy[] }>("/strategies").then((data) => setStrategies(data.strategies));
  }, []);

  async function handleRun(event: FormEvent) {
    event.preventDefault();
    const response = await apiFetch<any>("/backtest/run", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setResult(response);
  }

  async function askAi() {
    const response = await apiFetch<{ answer: string }>("/assistant/ask", {
      method: "POST",
      body: JSON.stringify({ question: aiQuestion, metrics: result?.metrics ?? null }),
    });
    setAiAnswer(response.answer);
  }

  return (
    <section className="backtestWorkspace">
      <aside className="strategySidebar">
        <div className="strategyHeader">
          <div>
            <p className="eyebrow">Backtesting</p>
            <h2>{form.run_name}</h2>
          </div>
          <span className="statusPill">Core module</span>
        </div>

        <form className="strategyForm" onSubmit={handleRun}>
          <label>
            Strategy Template
            <select
              value={form.strategy_id}
              onChange={(event) => setForm({ ...form, strategy_id: Number(event.target.value) })}
            >
              {strategies.map((strategy) => (
                <option key={strategy.strategy_id} value={strategy.strategy_id}>
                  {strategy.strategy_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Asset Universe
            <select value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: Number(event.target.value) })}>
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </label>

          <div className="splitInputs">
            <label>
              Start Date
              <input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
            </label>
            <label>
              End Date
              <input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
            </label>
          </div>

          <label>
            Run Name
            <input value={form.run_name} onChange={(event) => setForm({ ...form, run_name: event.target.value })} />
          </label>

          <label>
            Initial Capital
            <input
              type="number"
              value={form.initial_capital}
              onChange={(event) => setForm({ ...form, initial_capital: Number(event.target.value) })}
            />
          </label>

          <div className="sliderBlock">
            <div className="sliderHeader">
              <span>Position Size</span>
              <strong>15%</strong>
            </div>
            <input type="range" min="5" max="100" defaultValue="15" />
          </div>

          <div className="splitInputs">
            <label>
              Short Window
              <input
                type="number"
                value={Number(form.parameters.short_window)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    parameters: { ...form.parameters, short_window: Number(event.target.value) },
                  })
                }
              />
            </label>
            <label>
              Long Window
              <input
                type="number"
                value={Number(form.parameters.long_window)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    parameters: { ...form.parameters, long_window: Number(event.target.value) },
                  })
                }
              />
            </label>
          </div>

          <label>
            Trading Fee
            <input
              type="number"
              step="0.0001"
              value={form.trading_fee}
              onChange={(event) => setForm({ ...form, trading_fee: Number(event.target.value) })}
            />
          </label>

          <div className="buttonRow">
            <button type="button" className="ghostButton">
              Save Config
            </button>
            <button type="submit" className="runButton">
              Run Backtest
            </button>
          </div>
        </form>
      </aside>

      <div className="workspaceMain">
        <div className="metricStrip">
          <article className="metricCard positive">
            <span>Total Return</span>
            <strong>{result ? percent(result.metrics.total_return) : "--"}</strong>
            <small>vs. research baseline</small>
          </article>
          <article className="metricCard">
            <span>Sharpe Ratio</span>
            <strong>{result?.metrics.sharpe_ratio ?? "--"}</strong>
            <small>risk-adjusted score</small>
          </article>
          <article className="metricCard negative">
            <span>Drawdown</span>
            <strong>{result ? percent(result.metrics.max_drawdown) : "--"}</strong>
            <small>capital stress</small>
          </article>
          <article className="metricCard">
            <span>Win Rate</span>
            <strong>{result ? percent(result.metrics.win_rate) : "--"}</strong>
            <small>closed positions</small>
          </article>
          <article className="metricCard">
            <span>Total Trades</span>
            <strong>{result?.metrics.total_trades ?? "--"}</strong>
            <small>execution count</small>
          </article>
        </div>

        <article className="platformPanel chartStage">
          <div className="panelHeader">
            <div>
              <h3>Equity Curve</h3>
              <p>Daily growth vs benchmark</p>
            </div>
            <div className="tabRow">
              <span className="active">Equity Curve</span>
              <span>Trade Log</span>
              <span>Confidence</span>
            </div>
          </div>
          <div className="mockChart tall">
            <div className="chartBenchmark" />
            <div className="chartStrategy dramatic" />
            <div className="drawdownBand" />
            <div className="chartCallout">
              <span>{form.run_name}</span>
              <strong>{result ? percent(result.metrics.total_return) : "+34.7%"}</strong>
            </div>
          </div>
        </article>

        <div className="workspaceLower">
          <article className="platformPanel tradePanel">
            <div className="panelHeader compact">
              <div>
                <h3>Trade Log</h3>
                <p>Executed simulation orders</p>
              </div>
            </div>
            <div className="tableWrap">
              <table className="darkTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.trades?.length ? (
                    result.trades.map((trade: any) => (
                      <tr key={trade.trade_id}>
                        <td>{trade.trade_datetime.slice(0, 10)}</td>
                        <td>{trade.trade_action}</td>
                        <td>{trade.quantity}</td>
                        <td>{trade.price}</td>
                        <td>{currency(trade.cash_balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>Run a backtest to generate simulated trades.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="assistantPanel">
            <div className="assistantSidebar">
              <p>Quick Prompts</p>
              {[
                "Explain moving average crossover",
                "Is a Sharpe ratio of 0.8 good?",
                "How do I reduce max drawdown?",
                "Best RSI thresholds for swing trading",
                "Win rate vs. risk-reward ratio",
                "What parameters should I test first?",
              ].map((prompt) => (
                <button key={prompt} type="button" className="promptChip" onClick={() => setAiQuestion(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="assistantMain">
              <div className="assistantCenter">
                <div className="assistantMark">AI</div>
                <h3>Fishbowl AI Strategy Assistant</h3>
                <p>Ask me about trading strategies, performance metrics, or how to interpret your backtest results.</p>
                <div className="assistantTags">
                  {["What is RSI?", "Backtesting basics", "Sharpe ratio", "Max drawdown", "Beginner tips"].map((tag) => (
                    <button key={tag} type="button" className="assistantTag" onClick={() => setAiQuestion(tag)}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              {aiAnswer ? <div className="assistantReply">{aiAnswer}</div> : null}
              <div className="assistantComposer">
                <textarea
                  rows={3}
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  placeholder="Ask about strategies, metrics, or backtest results..."
                />
                <button type="button" className="sendButton" onClick={askAi}>
                  Ask
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
