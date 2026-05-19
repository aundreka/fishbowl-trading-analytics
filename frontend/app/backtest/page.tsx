"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { Asset, BacktestMetrics, BacktestTrade, Strategy, StrategyParameter, getErrorMessage } from "../../lib/types";
import { currency, percent } from "../../lib/utils";

type BacktestForm = {
  user_id: number;
  asset_id: number;
  strategy_id: number;
  run_name: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  trading_fee: number;
  parameters: Record<string, number | string>;
};

type BacktestResponse = {
  message: string;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equity_curve: number[];
};

type AiResponse = {
  answer: string;
  provider: string;
  model: string;
  live: boolean;
  error?: string;
};

const STORAGE_KEY = "fishbowl-backtest-config";
const defaultForm: BacktestForm = {
  user_id: 1,
  asset_id: 1,
  strategy_id: 1,
  run_name: "AAPL MA Demo",
  start_date: "2025-02-01",
  end_date: "2025-12-15",
  initial_capital: 10000,
  trading_fee: 0.001,
  parameters: { short_window: 10, long_window: 30 },
};

function coerceParameterValue(parameter: StrategyParameter, value: string): number | string {
  if (parameter.data_type === "int") {
    return Number.parseInt(value, 10);
  }
  if (parameter.data_type === "float") {
    return Number.parseFloat(value);
  }
  return value;
}

function normalizeParameters(
  strategy: Strategy | undefined,
  current: Record<string, number | string>,
): Record<string, number | string> {
  if (!strategy) {
    return current;
  }

  const next: Record<string, number | string> = {};
  for (const parameter of strategy.parameters) {
    next[parameter.parameter_name] =
      current[parameter.parameter_name] ?? coerceParameterValue(parameter, parameter.default_value);
  }
  return next;
}

function formatParameterLabel(name: string) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function BacktestPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState<BacktestForm>(defaultForm);
  const [positionSize, setPositionSize] = useState(15);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [aiQuestion, setAiQuestion] = useState("How can I improve my strategy performance?");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiMeta, setAiMeta] = useState<AiResponse | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [askingAi, setAskingAi] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [runError, setRunError] = useState("");
  const [aiError, setAiError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const selectedStrategy = strategies.find((strategy) => strategy.strategy_id === form.strategy_id);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (!savedConfig) {
        return;
      }

      const parsed = JSON.parse(savedConfig) as { form?: BacktestForm; positionSize?: number };
      if (parsed.form) {
        setForm(parsed.form);
      }
      if (typeof parsed.positionSize === "number") {
        setPositionSize(parsed.positionSize);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoadingWorkspace(true);
      setWorkspaceError("");

      try {
        const [assetData, strategyData] = await Promise.all([
          apiFetch<{ assets: Asset[] }>("/assets"),
          apiFetch<{ strategies: Strategy[] }>("/strategies"),
        ]);

        if (cancelled) {
          return;
        }

        setAssets(assetData.assets);
        setStrategies(strategyData.strategies);
      } catch (loadError) {
        if (!cancelled) {
          setWorkspaceError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assets.length && !strategies.length) {
      return;
    }

    setForm((current) => {
      const nextAssetId = assets.some((asset) => asset.asset_id === current.asset_id)
        ? current.asset_id
        : (assets[0]?.asset_id ?? current.asset_id);
      const nextStrategyId = strategies.some((strategy) => strategy.strategy_id === current.strategy_id)
        ? current.strategy_id
        : (strategies[0]?.strategy_id ?? current.strategy_id);
      const nextParameters = normalizeParameters(
        strategies.find((strategy) => strategy.strategy_id === nextStrategyId),
        current.parameters,
      );

      if (
        nextAssetId === current.asset_id &&
        nextStrategyId === current.strategy_id &&
        JSON.stringify(nextParameters) === JSON.stringify(current.parameters)
      ) {
        return current;
      }

      return {
        ...current,
        asset_id: nextAssetId,
        strategy_id: nextStrategyId,
        parameters: nextParameters,
      };
    });
  }, [assets, strategies]);

  function handleStrategyChange(strategyId: number) {
    const strategy = strategies.find((item) => item.strategy_id === strategyId);
    setForm((current) => ({
      ...current,
      strategy_id: strategyId,
      parameters: normalizeParameters(strategy, {}),
    }));
  }

  function handleParameterChange(parameter: StrategyParameter, rawValue: string) {
    setForm((current) => ({
      ...current,
      parameters: {
        ...current.parameters,
        [parameter.parameter_name]: coerceParameterValue(parameter, rawValue),
      },
    }));
  }

  function handleSaveConfig() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        form,
        positionSize,
      }),
    );
    setSaveMessage("Config saved in this browser.");
  }

  async function handleRun(event: FormEvent) {
    event.preventDefault();
    setRunningBacktest(true);
    setRunError("");
    setSaveMessage("");

    try {
      const response = await apiFetch<BacktestResponse>("/backtest/run", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setResult(response);
      setAiAnswer("");
      setAiMeta(null);
      setAiError("");
    } catch (error) {
      setRunError(getErrorMessage(error));
    } finally {
      setRunningBacktest(false);
    }
  }

  async function askAi() {
    if (!aiQuestion.trim()) {
      return;
    }

    setAskingAi(true);
    setAiError("");

    try {
      const response = await apiFetch<AiResponse>("/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ question: aiQuestion, metrics: result?.metrics ?? null }),
      });
      setAiAnswer(response.answer);
      setAiMeta(response);
      if (response.error) {
        setAiError(response.error);
      }
    } catch (error) {
      setAiAnswer("");
      setAiMeta(null);
      setAiError(getErrorMessage(error));
    } finally {
      setAskingAi(false);
    }
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

        {workspaceError ? <div className="platformPanel error">{workspaceError}</div> : null}

        <form className="strategyForm" onSubmit={handleRun}>
          <label>
            Strategy Template
            <select
              value={form.strategy_id}
              onChange={(event) => handleStrategyChange(Number(event.target.value))}
              disabled={loadingWorkspace || !strategies.length}
            >
              {strategies.length ? (
                strategies.map((strategy) => (
                  <option key={strategy.strategy_id} value={strategy.strategy_id}>
                    {strategy.strategy_name}
                  </option>
                ))
              ) : (
                <option value="">No strategies available</option>
              )}
            </select>
          </label>

          <label>
            Asset Universe
            <select
              value={form.asset_id}
              onChange={(event) => setForm({ ...form, asset_id: Number(event.target.value) })}
              disabled={loadingWorkspace || !assets.length}
            >
              {assets.length ? (
                assets.map((asset) => (
                  <option key={asset.asset_id} value={asset.asset_id}>
                    {asset.symbol}
                  </option>
                ))
              ) : (
                <option value="">No assets available</option>
              )}
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
              <span>Position Size Note</span>
              <strong>{positionSize}%</strong>
            </div>
            <input type="range" min="5" max="100" value={positionSize} onChange={(event) => setPositionSize(Number(event.target.value))} />
          </div>

          <div className="splitInputs">
            {selectedStrategy?.parameters.length ? (
              selectedStrategy.parameters.map((parameter) => (
                <label key={parameter.parameter_id}>
                  {formatParameterLabel(parameter.parameter_name)}
                  <input
                    type="number"
                    step={parameter.data_type === "float" ? "0.01" : "1"}
                    value={String(form.parameters[parameter.parameter_name] ?? parameter.default_value)}
                    onChange={(event) => handleParameterChange(parameter, event.target.value)}
                  />
                </label>
              ))
            ) : (
              <label>
                Strategy Parameters
                <input value="No parameters" disabled />
              </label>
            )}
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

          {saveMessage ? <p className="muted">{saveMessage}</p> : null}
          {runError ? <p className="errorText">{runError}</p> : null}

          <div className="buttonRow">
            <button type="button" className="ghostButton" onClick={handleSaveConfig}>
              Save Config
            </button>
            <button
              type="submit"
              className="runButton"
              disabled={runningBacktest || loadingWorkspace || !assets.length || !strategies.length}
            >
              {runningBacktest ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </form>
      </aside>

      <div className="workspaceMain">
        {loadingWorkspace ? <div className="platformPanel">Loading strategy workspace...</div> : null}

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
              <p>Mock chart, real backtest metrics</p>
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
              <strong>{result ? percent(result.metrics.total_return) : "--"}</strong>
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
                  {result?.trades.length ? (
                    result.trades.map((trade) => (
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
              {aiMeta ? (
                <p className={aiMeta.live ? "muted" : "errorText"}>
                  {aiMeta.live ? `Live reply via ${aiMeta.provider}.` : "Using local fallback reply."}
                </p>
              ) : null}
              {aiAnswer ? <div className="assistantReply">{aiAnswer}</div> : null}
              {aiError ? <p className="errorText">{aiError}</p> : null}
              <div className="assistantComposer">
                <textarea
                  rows={3}
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  placeholder="Ask about strategies, metrics, or backtest results..."
                />
                <button type="button" className="sendButton" onClick={askAi} disabled={askingAi}>
                  {askingAi ? "Asking..." : "Ask"}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
