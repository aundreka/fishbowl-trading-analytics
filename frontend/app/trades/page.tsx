"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";

export default function TradesPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ runs: any[] }>("/backtest/runs").then((data) => {
      setRuns(data.runs);
      if (data.runs[0]) {
        setSelectedRun(data.runs[0].backtest_run_id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedRun) {
      return;
    }
    apiFetch(`/backtest/runs/${selectedRun}`).then((data) => setDetails(data));
  }, [selectedRun]);

  return (
    <section className="page">
      <article className="panel">
        <p className="eyebrow">Trade Logs Viewer</p>
        <h2>Inspect simulated buy and sell events</h2>
        <label>
          Backtest Run
          <select value={selectedRun ?? ""} onChange={(event) => setSelectedRun(Number(event.target.value))}>
            {runs.map((run) => (
              <option key={run.backtest_run_id} value={run.backtest_run_id}>
                {run.run_name}
              </option>
            ))}
          </select>
        </label>
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
              {details?.trades?.length ? (
                details.trades.map((trade: any) => (
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
