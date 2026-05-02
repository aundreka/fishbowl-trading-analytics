"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api";
import { currency, percent } from "../lib/utils";

type SummaryResponse = {
  summary: {
    total_backtests: number;
    total_assets: number;
    total_users: number;
    best_strategy: string;
    best_return: number;
    average_sharpe_ratio: number;
    recent_runs: Array<{ backtest_run_id: number; run_name: string; created_at: string }>;
  };
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryResponse["summary"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<SummaryResponse>("/analytics/summary")
      .then((data) => setSummary(data.summary))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="dashboardPage">
      {error ? <div className="platformPanel error">{error}</div> : null}

      <div className="dashboardHero">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Observe trading behavior inside a safe historical simulation lab.</h2>
        </div>
        <div className="dashboardHeroMeta">
          <span>Jan 1 - Apr 19, 2026</span>
          <button className="ghostButton">Export</button>
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
              <p>Strategy vs. benchmark</p>
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
              <h3>Allocation</h3>
              <p>By asset class</p>
            </div>
          </div>
          <div className="donutWrap">
            <div className="donutChart">
              <div>
                <strong>{currency(2400)}</strong>
                <span>capital mix</span>
              </div>
            </div>
            <ul className="allocationLegend">
              <li><span className="legendDot green" /> US Equities 48%</li>
              <li><span className="legendDot blue" /> Crypto 24%</li>
              <li><span className="legendDot orange" /> Fixed Income 14%</li>
              <li><span className="legendDot red" /> Cash 14%</li>
            </ul>
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Active Strategies</h3>
              <p>Current templates</p>
            </div>
          </div>
          <div className="miniTable">
            <div><span>{summary?.best_strategy ?? "Moving Average Crossover"}</span><strong className="positiveText">{summary ? percent(summary.best_return) : "0.00%"}</strong></div>
            <div><span>RSI Reversal</span><strong className="negativeText">-3.12%</strong></div>
            <div><span>Bollinger Mean Reversion</span><strong className="positiveText">11.40%</strong></div>
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Risk Metrics</h3>
              <p>Most recent averages</p>
            </div>
          </div>
          <div className="riskList">
            <div><span>Sharpe Ratio</span><div className="bar"><i style={{ width: "66%" }} /></div><strong>{summary?.average_sharpe_ratio ?? 0}</strong></div>
            <div><span>Sortino Ratio</span><div className="bar"><i style={{ width: "72%" }} /></div><strong>2.04</strong></div>
            <div><span>Max Drawdown</span><div className="bar danger"><i style={{ width: "34%" }} /></div><strong>-8.3%</strong></div>
            <div><span>Win Rate</span><div className="bar"><i style={{ width: "61%" }} /></div><strong>63.2%</strong></div>
          </div>
        </article>

        <article className="platformPanel">
          <div className="panelHeader compact">
            <div>
              <h3>Monthly Returns</h3>
              <p>Heatmap</p>
            </div>
          </div>
          <div className="heatmap">
            {["31","22","-8","11","18","-4","14","9","12","-3","16","20"].map((value, index) => (
              <span key={index} className={value.startsWith("-") ? "loss" : "gain"}>{value}</span>
            ))}
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
              {summary?.recent_runs?.length ? (
                summary.recent_runs.map((run) => (
                  <tr key={run.backtest_run_id}>
                    <td>{run.run_name}</td>
                    <td>{new Date(run.created_at).toLocaleString()}</td>
                    <td>{summary.best_strategy}</td>
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
