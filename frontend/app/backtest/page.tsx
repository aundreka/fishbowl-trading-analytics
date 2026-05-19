"use client";

import { FormEvent, useEffect, useState, useRef } from "react";

import { apiFetch } from "../../lib/api";
import { Asset, BacktestMetrics, BacktestTrade, PriceDataset, Strategy, StrategyParameter, getErrorMessage } from "../../lib/types";
import { currency, percent } from "../../lib/utils";

type BacktestForm = {
  user_id: number;
  asset_id: number;
  dataset_id: number | null;
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
  equity_points: EquityPoint[];
};

type EquityPoint = {
  price_datetime: string;
  equity: number;
  close_price: number;
};

type AiResponse = {
  answer: string;
  provider: string;
  model: string;
  live: boolean;
  error?: string;
};

type AiConfigTuneResponse = {
  provider: string;
  model: string;
  live: boolean;
  config: BacktestForm;
  position_size: number;
  summary: string;
  error?: string;
};

const STORAGE_KEY = "fishbowl-backtest-config";
const defaultForm: BacktestForm = {
  user_id: 1,
  asset_id: 1,
  dataset_id: null,
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

type DatasetOption = {
  asset: Asset;
  dataset: PriceDataset;
};

function datasetSearchText(option: DatasetOption) {
  const { asset, dataset } = option;
  return [
    asset.symbol,
    asset.asset_name,
    asset.market,
    asset.asset_type,
    dataset.dataset_name,
    dataset.first_price_date ?? "",
    dataset.last_price_date ?? "",
    dataset.source ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function formatDatasetOption(option: DatasetOption) {
  const { asset, dataset } = option;
  const range = dataset.first_price_date && dataset.last_price_date ? `${dataset.first_price_date} to ${dataset.last_price_date}` : "No dates";
  return `${asset.symbol} - ${dataset.dataset_name} - ${dataset.price_points} rows - ${range}`;
}

function scaleValue(value: number, minimum: number, maximum: number, outputMinimum: number, outputMaximum: number) {
  if (maximum === minimum) {
    return (outputMinimum + outputMaximum) / 2;
  }

  return outputMaximum - ((value - minimum) / (maximum - minimum)) * (outputMaximum - outputMinimum);
}

function buildLinePath(points: EquityPoint[], totalPoints: number, minimum: number, maximum: number) {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => {
      const x = totalPoints === 1 ? 0 : (index / (totalPoints - 1)) * 1000;
      const y = scaleValue(point.equity, minimum, maximum, 20, 280);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(points: EquityPoint[], totalPoints: number, minimum: number, maximum: number) {
  const linePath = buildLinePath(points, totalPoints, minimum, maximum);
  if (!linePath) {
    return "";
  }

  const endX = totalPoints === 1 ? 0 : ((points.length - 1) / (totalPoints - 1)) * 1000;
  return `${linePath} L ${endX} 290 L 0 290 Z`;
}

function pointPosition(index: number, total: number, equity: number, minimum: number, maximum: number) {
  return {
    x: total === 1 ? 0 : (index / (total - 1)) * 1000,
    y: scaleValue(equity, minimum, maximum, 20, 280),
  };
}

export default function BacktestPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState<BacktestForm>(defaultForm);
  const [datasetQuery, setDatasetQuery] = useState("");
  const [positionSize, setPositionSize] = useState(15);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playingPlayback, setPlayingPlayback] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panIndex, setPanIndex] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const [aiQuestion, setAiQuestion] = useState("How can I improve my strategy performance?");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiMeta, setAiMeta] = useState<AiResponse | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [askingAi, setAskingAi] = useState(false);
  const [tuningConfig, setTuningConfig] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [runError, setRunError] = useState("");
  const [aiError, setAiError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const selectedStrategy = strategies.find((strategy) => strategy.strategy_id === form.strategy_id);
  const selectedAsset = assets.find((asset) => asset.asset_id === form.asset_id);
  const datasetOptions = assets.flatMap((asset) =>
    (asset.datasets ?? []).map((dataset) => ({
      asset,
      dataset,
    })),
  );
  const selectedDatasetOption =
    datasetOptions.find((option) => option.dataset.dataset_id === form.dataset_id) ??
    datasetOptions.find((option) => option.asset.asset_id === form.asset_id);
  const selectedDataset = selectedDatasetOption?.dataset;
  const normalizedDatasetQuery = datasetQuery.trim().toLowerCase();
  const filteredDatasetOptions = normalizedDatasetQuery
    ? datasetOptions.filter((option) => datasetSearchText(option).includes(normalizedDatasetQuery))
    : datasetOptions;
  const visibleDatasetOptions =
    selectedDatasetOption &&
    !filteredDatasetOptions.some((option) => option.dataset.dataset_id === selectedDatasetOption.dataset.dataset_id)
      ? [selectedDatasetOption, ...filteredDatasetOptions]
      : filteredDatasetOptions;
  const equityPoints = result?.equity_points ?? [];
  const lastPlaybackIndex = Math.max(equityPoints.length - 1, 0);
  const activePlaybackIndex = Math.min(playbackIndex, lastPlaybackIndex);
  
  const availablePoints = activePlaybackIndex + 1;
  const visibleCount = Math.max(10, Math.floor(availablePoints / zoomLevel));
  const maxPan = Math.max(0, availablePoints - visibleCount);
  const clampedPan = Math.max(0, Math.min(panIndex, maxPan));
  const startIndex = Math.max(0, availablePoints - visibleCount - clampedPan);
  
  const visibleEquityPoints = equityPoints.slice(startIndex, startIndex + visibleCount);
  const visibleEquityValues = visibleEquityPoints.map((point) => point.equity);
  const minimumEquity = visibleEquityValues.length ? Math.min(...visibleEquityValues) : 0;
  const maximumEquity = visibleEquityValues.length ? Math.max(...visibleEquityValues) : 1;
  
  // Use a smaller padding ratio when zoomed in to maximize screen space
  const spread = maximumEquity - minimumEquity;
  const equityPadding = spread === 0 ? minimumEquity * 0.05 : spread * 0.1;
  const chartMinimum = minimumEquity - equityPadding;
  const chartMaximum = maximumEquity + equityPadding;
  const chartPath = buildLinePath(visibleEquityPoints, visibleEquityPoints.length, chartMinimum, chartMaximum);
  const chartAreaPath = buildAreaPath(visibleEquityPoints, visibleEquityPoints.length, chartMinimum, chartMaximum);
  
  const activePoint = equityPoints[activePlaybackIndex];
  const activePointVisibleIndex = activePlaybackIndex - startIndex;
  const activePosition = activePoint && activePointVisibleIndex >= 0 && activePointVisibleIndex < visibleCount
    ? pointPosition(activePointVisibleIndex, visibleEquityPoints.length, activePoint.equity, chartMinimum, chartMaximum)
    : null;
    
  const tradeMarkers = (result?.trades ?? [])
    .map((trade) => {
      const index = equityPoints.findIndex((point) => point.price_datetime === trade.trade_datetime);
      if (index < startIndex || index >= startIndex + visibleCount) {
        return null;
      }

      const point = equityPoints[index];
      return {
        trade,
        index,
        ...pointPosition(index - startIndex, visibleEquityPoints.length, point.equity, chartMinimum, chartMaximum),
      };
    })
    .filter((marker): marker is { trade: BacktestTrade; index: number; x: number; y: number } => Boolean(marker));

  useEffect(() => {
    const chartNode = chartRef.current;
    if (!chartNode) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2) {
        // Zoom
        const zoomDelta = e.deltaY * -0.01;
        setZoomLevel((current) => Math.max(1, Math.min(current + zoomDelta, availablePoints / 10)));
      } else {
        // Pan
        const panDelta = e.deltaX * 0.5;
        setPanIndex((current) => Math.max(0, current + panDelta));
      }
    };

    chartNode.addEventListener("wheel", handleWheel, { passive: false });
    return () => chartNode.removeEventListener("wheel", handleWheel);
  }, [availablePoints]);

  useEffect(() => {
    if (!playingPlayback || !equityPoints.length) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= equityPoints.length - 1) {
          window.clearInterval(interval);
          setPlayingPlayback(false);
          return current;
        }

        return current + 1;
      });
    }, 120 / playbackSpeed);

    return () => window.clearInterval(interval);
  }, [playingPlayback, equityPoints.length, playbackSpeed]);

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
      const datasetPairs = assets.flatMap((asset) =>
        (asset.datasets ?? []).map((dataset) => ({
          asset,
          dataset,
        })),
      );
      const currentDatasetPair =
        datasetPairs.find((pair) => pair.dataset.dataset_id === current.dataset_id) ??
        datasetPairs.find((pair) => pair.asset.asset_id === current.asset_id) ??
        datasetPairs[0];
      const nextAssetId = currentDatasetPair?.asset.asset_id ?? (assets[0]?.asset_id ?? current.asset_id);
      const nextDatasetId = currentDatasetPair?.dataset.dataset_id ?? current.dataset_id ?? null;
      const nextStrategyId = strategies.some((strategy) => strategy.strategy_id === current.strategy_id)
        ? current.strategy_id
        : (strategies[0]?.strategy_id ?? current.strategy_id);
      const nextParameters = normalizeParameters(
        strategies.find((strategy) => strategy.strategy_id === nextStrategyId),
        current.parameters,
      );

      if (
        nextAssetId === current.asset_id &&
        nextDatasetId === current.dataset_id &&
        nextStrategyId === current.strategy_id &&
        JSON.stringify(nextParameters) === JSON.stringify(current.parameters)
      ) {
        return current;
      }

      return {
        ...current,
        asset_id: nextAssetId,
        dataset_id: nextDatasetId,
        strategy_id: nextStrategyId,
        parameters: nextParameters,
      };
    });
  }, [assets, strategies]);

  function handleDatasetChange(datasetId: number) {
    const option = datasetOptions.find((item) => item.dataset.dataset_id === datasetId);
    if (!option) {
      return;
    }

    setForm((current) => ({
      ...current,
      asset_id: option.asset.asset_id,
      dataset_id: option.dataset.dataset_id,
      start_date: option.dataset.first_price_date ?? current.start_date,
      end_date: option.dataset.last_price_date ?? current.end_date,
    }));
  }

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
      setPlaybackIndex(0);
      setZoomLevel(1);
      setPanIndex(0);
      setPlayingPlayback(response.equity_points.length > 0);
      setAiAnswer("");
      setAiMeta(null);
      setAiError("");
    } catch (error) {
      setRunError(getErrorMessage(error));
    } finally {
      setRunningBacktest(false);
    }
  }

  async function tuneConfig() {
    setTuningConfig(true);
    setRunError("");
    setSaveMessage("");

    try {
      const response = await apiFetch<AiConfigTuneResponse>("/assistant/tune-config", {
        method: "POST",
        body: JSON.stringify({
          current_config: form,
          position_size: positionSize,
          metrics: result?.metrics ?? null,
        }),
      });

      setForm(response.config);
      setPositionSize(response.position_size);
      setSaveMessage(
        `${response.live ? "AI tuned config" : "Local AI fallback tuned config"}: ${response.summary}`,
      );
      if (response.error) {
        setRunError(response.error);
      }
    } catch (error) {
      setRunError(getErrorMessage(error));
    } finally {
      setTuningConfig(false);
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
            Search Dataset
            <input
              value={datasetQuery}
              onChange={(event) => setDatasetQuery(event.target.value)}
              placeholder="Search dataset, symbol, market, type, or date"
            />
          </label>

          <label>
            Dataset Universe
            <select
              value={form.dataset_id ?? ""}
              onChange={(event) => handleDatasetChange(Number(event.target.value))}
              disabled={loadingWorkspace || !visibleDatasetOptions.length}
            >
              {visibleDatasetOptions.length ? (
                visibleDatasetOptions.map((option) => (
                  <option key={option.dataset.dataset_id} value={option.dataset.dataset_id}>
                    {formatDatasetOption(option)}
                  </option>
                ))
              ) : (
                <option value="">No matching datasets</option>
              )}
            </select>
          </label>
          {normalizedDatasetQuery && !filteredDatasetOptions.length ? <p className="errorText">No dataset matches that search.</p> : null}
          {selectedAsset && selectedDataset ? (
            <div className="assetDatasetCard">
              <strong>{selectedAsset.symbol}</strong>
              <span>{selectedAsset.asset_name}</span>
              <span>Dataset: {selectedDataset.dataset_name}</span>
              <span>
                {selectedAsset.asset_type} / {selectedAsset.market || "Unknown market"} / {selectedDataset.price_points} rows
              </span>
              <span>
                Date range: {selectedDataset.first_price_date ?? "N/A"} to {selectedDataset.last_price_date ?? "N/A"}
              </span>
            </div>
          ) : null}

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
              type="button"
              className="ghostButton"
              onClick={tuneConfig}
              disabled={tuningConfig || loadingWorkspace || !assets.length || !strategies.length}
            >
              {tuningConfig ? "Tuning..." : "AI Tune Config"}
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
              <h3>Equity Playback</h3>
              <p>{activePoint ? `${activePoint.price_datetime.slice(0, 10)} / ${currency(activePoint.equity)}` : "Run a backtest to load playback"}</p>
            </div>
            <div className="tabRow" style={{ alignItems: "center" }}>
              {equityPoints.length ? (
                <>
                  <select 
                    value={playbackSpeed} 
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    style={{ padding: "0.2rem 0.6rem", width: "auto", background: "rgba(255, 255, 255, 0.04)", border: "none", color: "#8fa8c5", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                    <option value="10">10x</option>
                  </select>
                  <input 
                    type="range" 
                    min="0" 
                    max={equityPoints.length - 1} 
                    value={activePlaybackIndex} 
                    onChange={(e) => {
                      setPlaybackIndex(Number(e.target.value));
                      setPlayingPlayback(false);
                    }} 
                    style={{ width: "120px", height: "4px", margin: "0 0.5rem" }}
                  />
                </>
              ) : null}
              <button type="button" className="active" onClick={() => setPlaybackIndex(0)} disabled={!equityPoints.length}>
                Reset
              </button>
              <button
                type="button"
                className="active"
                onClick={() => setPlayingPlayback((current) => !current)}
                disabled={!equityPoints.length}
              >
                {playingPlayback ? "Pause" : "Play"}
              </button>
            </div>
          </div>
          <div className="tradePlaybackChart">
            {equityPoints.length ? (
              <>
                <svg viewBox="0 0 1000 320" role="img" aria-label="Backtest equity curve with buy and sell markers">
                  <defs>
                    <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#21c98b" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="#21c98b" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {[280, 215, 150, 85, 20].map((y) => {
                    const val = chartMinimum + ((chartMaximum - chartMinimum) * (280 - y)) / 260;
                    return (
                      <g key={`grid-y-${y}`}>
                        <line x1="0" x2="1000" y1={y} y2={y} className="chartGridLine" />
                        <text x="6" y={y - 6} className="chartLabel">{currency(val)}</text>
                      </g>
                    );
                  })}
                  {[0, 200, 400, 600, 800, 1000].map((x, i) => {
                    const index = Math.floor((i / 5) * (visibleEquityPoints.length - 1));
                    const point = visibleEquityPoints[index];
                    return (
                      <g key={`grid-x-${x}`}>
                        <line x1={x} x2={x} y1="20" y2="290" className="chartGridLine" />
                        {point ? (
                          <text 
                            x={x === 0 ? 6 : x === 1000 ? 994 : x} 
                            y="312" 
                            className="chartLabel" 
                            textAnchor={x === 0 ? "start" : x === 1000 ? "end" : "middle"}
                          >
                            {point.price_datetime.slice(0, 10)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  <path d={chartAreaPath} className="equityArea" />
                  <path d={chartPath} className="equityLine" />
                  {tradeMarkers.map((marker) => (
                    <g key={`${marker.trade.trade_id}-${marker.index}`} transform={`translate(${marker.x} ${marker.y})`}>
                      <circle className={marker.trade.trade_action === "BUY" ? "buyMarker" : "sellMarker"} r="8" />
                    </g>
                  ))}
                  {activePosition ? (
                    <g transform={`translate(${activePosition.x} ${activePosition.y})`}>
                      <line x1="0" x2="0" y1={-activePosition.y + 20} y2={290 - activePosition.y} className="playheadLine" />
                      <circle className="playheadDot" r="6" />
                    </g>
                  ) : null}
                </svg>
                <div className="chartCallout">
                  <span>{form.run_name}</span>
                  <strong>{result ? percent(result.metrics.total_return) : "--"}</strong>
                  <small>{activePoint ? `${activePlaybackIndex + 1} / ${equityPoints.length} candles` : "No playback"}</small>
                </div>
              </>
            ) : (
              <div className="emptyPlayback">Run a backtest to generate the equity curve and buy/sell markers.</div>
            )}
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
