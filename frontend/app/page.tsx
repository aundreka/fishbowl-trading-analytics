"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api";
import { Asset, BacktestMetrics, BacktestRun, Strategy, getErrorMessage } from "../lib/types";
import { currency, percent } from "../lib/utils";

type Summary = {
  total_backtests: number;
  total_assets: number;
  total_users: number;
  best_strategy: string;
  best_return: number;
  average_sharpe_ratio: number;
  recent_runs: Array<{ backtest_run_id: number; run_name: string; created_at: string }>;
};

type SummaryResponse = { summary: Summary };
type BacktestReportResponse = { rows: BacktestRun[] };
type AssetsResponse = { assets: Asset[] };
type StrategiesResponse = { strategies: Strategy[] };

const legendColors = ["green", "blue", "orange", "red"] as const;

function clampBar(value: number, factor: number) {
  return `${Math.max(14, Math.min(100, Math.round(Math.abs(value) * factor)))}%`;
}

function safePercent(value?: number | null) {
  return typeof value === "number" ? percent(value) : "--";
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reportRows, setReportRows] = useState<BacktestRun[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [summaryData, reportData, assetData, strategyData] = await Promise.all([
          apiFetch<SummaryResponse>("/analytics/summary"),
          apiFetch<BacktestReportResponse>("/analytics/reports/backtests"),
          apiFetch<AssetsResponse>("/assets"),
          apiFetch<StrategiesResponse>("/strategies"),
        ]);

        if (cancelled) {
          return;
        }

        setSummary(summaryData.summary);
        setReportRows(
          [...reportData.rows].sort((left, right) => right.created_at.localeCompare(left.created_at)),
        );
        setAssets(assetData.assets);
        setStrategies(strategyData.strategies);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const strategyLookup = Object.fromEntries(strategies.map((strategy) => [strategy.strategy_id, strategy.strategy_name]));
  const bestRun = reportRows.reduce<BacktestRun | null>((best, run) => {
    if (!best) {
      return run;
    }
    return (run.metrics?.total_return ?? Number.NEGATIVE_INFINITY) > (best.metrics?.total_return ?? Number.NEGATIVE_INFINITY)
      ? run
      : best;
  }, null);
  const worstDrawdown = reportRows.length
    ? Math.min(...reportRows.map((run) => run.metrics?.max_drawdown ?? 0))
    : 0;
  const averageWinRate = reportRows.length
    ? reportRows.reduce((sum, run) => sum + (run.metrics?.win_rate ?? 0), 0) / reportRows.length
    : 0;
  const averageInitialCapital = reportRows.length
    ? reportRows.reduce((sum, run) => sum + run.initial_capital, 0) / reportRows.length
    : 0;
  const assetMix = Object.entries(
    assets.reduce<Record<string, number>>((mix, asset) => {
      mix[asset.asset_type] = (mix[asset.asset_type] ?? 0) + 1;
      return mix;
    }, {}),
  ).map(([label, count]) => ({
    label,
    percentage: assets.length ? Math.round((count / assets.length) * 100) : 0,
  }));
  const strategyPerformance = strategies
    .map((strategy) => {
      const returns = reportRows
        .filter((run) => run.strategy_id === strategy.strategy_id)
        .map((run) => run.metrics?.total_return)
        .filter((value): value is number => typeof value === "number");

      return {
        strategyName: strategy.strategy_name,
        bestReturn: returns.length ? Math.max(...returns) : null,
      };
    })
    .sort((left, right) => {
      if (left.bestReturn === null && right.bestReturn === null) {
        return left.strategyName.localeCompare(right.strategyName);
      }
      if (left.bestReturn === null) {
        return 1;
      }
      if (right.bestReturn === null) {
        return -1;
      }
      return right.bestReturn - left.bestReturn;
    })
    .slice(0, 3);
  const recentReturns = reportRows
    .map((run) => run.metrics?.total_return)
    .filter((value): value is number => typeof value === "number")
    .slice(0, 12);

  return (
    <section className="dashboardPage">
      {error ? <div className="platformPanel error">{error}</div> : null}
      {loading && !summary ? <div className="platformPanel">Loading dashboard data...</div> : null}

      <div className="dashboardHero">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Observe trading behavior inside a safe historical simulation lab.</h2>
        </div>
        <div className="dashboardHeroMeta">
          <span>{summary ? `${summary.total_backtests} saved runs` : "Loading runs..."}</span>
          <span className="statusPill">{bestRun ? "Real metrics loaded" : "Awaiting first backtest"}</span>
        </div>
      </div>

      <div className="metricStrip">
        <article className="metricCard positive">
          <span>Total Return</span>
          <strong>{summary ? percent(summary.best_return) : "..."}</strong>
          <small>Best run in workspace</small>
        </article>
        <article className="metricCard">
          <span>Average Sharpe</span>
          <strong>{summary?.average_sharpe_ratio ?? "..."}</strong>
          <small>Risk-adjusted score</small>
        </article>
        <article className="metricCard negative">
          <span>Assets Tracked</span>
          <strong>{summary?.total_assets ?? "..."}</strong>
          <small>Instrument library</small>
        </article>
        <article className="metricCard">
          <span>Saved Runs</span>
          <strong>{summary?.total_backtests ?? "..."}</strong>
          <small>Simulation history</small>
        </article>
        <article className="metricCard">
          <span>Researchers</span>
          <strong>{summary?.total_users ?? "..."}</strong>
          <small>Active accounts</small>
        </article>
      </div>

      <div className="dashboardGrid">
        <article className="platformPanel curvePanel">
          <div className="panelHeader">
            <div>
              <h3>Equity Curve</h3>
              <p>Mock chart, real best-run callout</p>
            </div>
            <div className="tabRow">
              <span className="active">Strategy</span>
              <span>Benchmark</span>
            </div>
          </div>
          <div className="mockChart">
            <div className="chartBenchmark" />
            <div className="chartStrategy" />
            <div className="chartCallout">
              <span>{summary?.best_strategy ?? "No strategy yet"}</span>
              <strong>{summary ? percent(summary.best_return) : "..."}</strong>
            </div>
          </div>
        </article>

        <article className="platformPanel allocationPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Asset Mix</h3>
              <p>By tracked instruments</p>
            </div>
          </div>
          <div className="donutWrap">
            <div className="donutChart">
              <div>
                <strong>{currency(averageInitialCapital)}</strong>
                <span>avg start capital</span>
              </div>
            </div>
            <ul className="allocationLegend">
              {assetMix.length ? (
                assetMix.slice(0, 4).map((item, index) => (
                  <li key={item.label}>
                    <span className={`legendDot ${legendColors[index]}`} /> {item.label} {item.percentage}%
                  </li>
                ))
              ) : (
                <li>No tracked assets yet.</li>
              )}
            </ul>
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Active Strategies</h3>
              <p>Best result by template</p>
            </div>
          </div>
          <div className="miniTable">
            {strategyPerformance.length ? (
              strategyPerformance.map((entry) => (
                <div key={entry.strategyName}>
                  <span>{entry.strategyName}</span>
                  <strong className={entry.bestReturn !== null && entry.bestReturn >= 0 ? "positiveText" : "negativeText"}>
                    {entry.bestReturn !== null ? percent(entry.bestReturn) : "No runs yet"}
                  </strong>
                </div>
              ))
            ) : (
              <div><span>No strategies loaded.</span><strong>--</strong></div>
            )}
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Risk Metrics</h3>
              <p>Derived from saved runs</p>
            </div>
          </div>
          <div className="riskList">
            <div><span>Average Sharpe</span><div className="bar"><i style={{ width: clampBar(summary?.average_sharpe_ratio ?? 0, 35) }} /></div><strong>{summary?.average_sharpe_ratio ?? 0}</strong></div>
            <div><span>Best Return</span><div className="bar"><i style={{ width: clampBar(bestRun?.metrics?.total_return ?? 0, 2.5) }} /></div><strong>{safePercent(bestRun?.metrics?.total_return)}</strong></div>
            <div><span>Worst Drawdown</span><div className="bar danger"><i style={{ width: clampBar(worstDrawdown, 4) }} /></div><strong>{percent(worstDrawdown)}</strong></div>
            <div><span>Average Win Rate</span><div className="bar"><i style={{ width: clampBar(averageWinRate, 1) }} /></div><strong>{percent(averageWinRate)}</strong></div>
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Recent Returns</h3>
              <p>Latest saved backtests</p>
            </div>
          </div>
          <div className="heatmap">
            {recentReturns.length ? (
              recentReturns.map((value, index) => (
                <span key={`${value}-${index}`} className={value < 0 ? "loss" : "gain"}>{Math.round(value)}</span>
              ))
            ) : (
              <span className="loss">No runs yet</span>
            )}
          </div>
        </article>
      </div>

      <article className="platformPanel">
        <div className="panelHeader compact">
          <div>
            <h3>Recent Backtest Sessions</h3>
            <p>Saved runs for comparison</p>
          </div>
        </div>
        <div className="tableWrap">
          <table className="darkTable">
            <thead>
              <tr>
                <th>Run</th>
                <th>Created</th>
                <th>Focus</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length ? (
                reportRows.slice(0, 5).map((run) => (
                  <tr key={run.backtest_run_id}>
                    <td>{run.run_name}</td>
                    <td>{new Date(run.created_at).toLocaleString()}</td>
                    <td>{strategyLookup[run.strategy_id] ?? "Unknown strategy"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No saved runs yet. Create a backtest to populate the dashboard.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
