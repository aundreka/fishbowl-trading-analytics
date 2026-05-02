"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";

const sampleCsv = `price_datetime,open_price,high_price,low_price,close_price,volume
2025-01-01T00:00:00,100,105,98,103,150000
2025-01-02T00:00:00,103,107,101,106,145000
2025-01-03T00:00:00,106,108,102,104,120000`;

export default function DataUploadPage() {
  const [assets, setAssets] = useState<Array<{ asset_id: number; symbol: string }>>([]);
  const [assetId, setAssetId] = useState(1);
  const [csvContent, setCsvContent] = useState(sampleCsv);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    apiFetch<{ assets: Array<{ asset_id: number; symbol: string }> }>("/assets").then((data) => setAssets(data.assets));
  }, []);

  async function validateData() {
    const result = await apiFetch<{ valid: boolean; missing_columns: string[] }>("/assets/validate-upload", {
      method: "POST",
      body: JSON.stringify({ asset_id: assetId, csv_content: csvContent }),
    });
    setFeedback(result.valid ? "Dataset headers look valid." : `Missing columns: ${result.missing_columns.join(", ")}`);
  }

  async function uploadData(event: FormEvent) {
    event.preventDefault();
    const result = await apiFetch<{ rows_imported: number }>("/assets/upload", {
      method: "POST",
      body: JSON.stringify({ asset_id: assetId, csv_content: csvContent }),
    });
    setFeedback(`Uploaded ${result.rows_imported} rows successfully.`);
  }

  return (
    <section className="page">
      <article className="panel">
        <p className="eyebrow">Historical Data Upload</p>
        <h2>Validate and import market data</h2>
        <form className="formStack" onSubmit={uploadData}>
          <label>
            Asset
            <select value={assetId} onChange={(event) => setAssetId(Number(event.target.value))}>
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </label>
          <label>
            CSV Content
            <textarea rows={12} value={csvContent} onChange={(event) => setCsvContent(event.target.value)} />
          </label>
          <div className="buttonRow">
            <button type="button" className="secondary" onClick={validateData}>
              Validate
            </button>
            <button type="submit">Upload Dataset</button>
          </div>
        </form>
        {feedback ? <p className="callout">{feedback}</p> : null}
      </article>
    </section>
  );
}
