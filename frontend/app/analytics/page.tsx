"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { BacktestRun, getErrorMessage } from "../../lib/types";
import { currency, percent } from "../../lib/utils";

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoading(true);
      setError("");

      try {
        const data = await apiFetch<{ runs: BacktestRun[] }>("/backtest/runs");
        if (!cancelled) {
          setRuns(data.runs);
        }
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

    loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <article className="panel">
        <p className="eyebrow">Performance Analytics</p>
        <h2>Compare saved backtest sessions</h2>
        {error ? <p className="errorText">{error}</p> : null}
        {loading ? <p className="muted">Loading saved runs...</p> : null}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Return</th>
                <th>Net Profit</th>
                <th>Sharpe</th>
                <th>Trades</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.map((run) => (
                  <tr key={run.backtest_run_id}>
                    <td>{run.run_name}</td>
                    <td>{percent(run.metrics?.total_return ?? 0)}</td>
                    <td>{currency(run.metrics?.net_profit ?? 0)}</td>
                    <td>{run.metrics?.sharpe_ratio ?? 0}</td>
                    <td>{run.metrics?.total_trades ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No runs available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
