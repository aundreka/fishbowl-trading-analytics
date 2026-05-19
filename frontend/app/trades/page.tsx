"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { BacktestMetrics, BacktestRun, BacktestTrade, getErrorMessage } from "../../lib/types";

type RunDetailsResponse = {
  run: BacktestRun;
  trades: BacktestTrade[];
  metrics: BacktestMetrics | null;
};

export default function TradesPage() {
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [details, setDetails] = useState<RunDetailsResponse | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoadingRuns(true);
      setError("");

      try {
        const data = await apiFetch<{ runs: BacktestRun[] }>("/backtest/runs");
        if (cancelled) {
          return;
        }

        setRuns(data.runs);
        setSelectedRun(data.runs[0]?.backtest_run_id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoadingRuns(false);
        }
      }
    }

    loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRun) {
      setDetails(null);
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      setLoadingDetails(true);
      setError("");

      try {
        const data = await apiFetch<RunDetailsResponse>(`/backtest/runs/${selectedRun}`);
        if (!cancelled) {
          setDetails(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoadingDetails(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedRun]);

  return (
    <section className="page">
      <article className="panel">
        <p className="eyebrow">Trade Logs Viewer</p>
        <h2>Inspect simulated buy and sell events</h2>
        {error ? <p className="errorText">{error}</p> : null}
        {loadingRuns ? <p className="muted">Loading runs...</p> : null}
        <label>
          Backtest Run
          <select value={selectedRun ?? ""} onChange={(event) => setSelectedRun(Number(event.target.value))} disabled={!runs.length}>
            {runs.length ? (
              runs.map((run) => (
                <option key={run.backtest_run_id} value={run.backtest_run_id}>
                  {run.run_name}
                </option>
              ))
            ) : (
              <option value="">No runs available</option>
            )}
          </select>
        </label>
        {loadingDetails ? <p className="muted">Loading trades...</p> : null}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {details?.trades.length ? (
                details.trades.map((trade) => (
                  <tr key={trade.trade_id}>
                    <td>{trade.trade_datetime.slice(0, 10)}</td>
                    <td>{trade.trade_action}</td>
                    <td>{trade.quantity}</td>
                    <td>{trade.price}</td>
                    <td>{trade.fee}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No trades to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
