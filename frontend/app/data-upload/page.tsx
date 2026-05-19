"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { getErrorMessage } from "../../lib/types";

const sampleCsv = `price_datetime,open_price,high_price,low_price,close_price,volume
2025-01-01T00:00:00,100,105,98,103,150000
2025-01-02T00:00:00,103,107,101,106,145000
2025-01-03T00:00:00,106,108,102,104,120000`;

type HeaderMapping = Record<string, string | null>;

type UploadValidation = {
  valid: boolean;
  missing_columns: string[];
  ai_mapping?: HeaderMapping | null;
  ai_normalized?: boolean;
  error?: string;
};

type UploadResult = {
  rows_imported: number;
  dataset_id?: number;
  dataset_name?: string;
  ai_mapped?: boolean;
  ai_mapping?: HeaderMapping | null;
};

function formatHeaderMapping(mapping?: HeaderMapping | null) {
  if (!mapping) {
    return "";
  }

  return Object.entries(mapping)
    .filter(([targetHeader, sourceHeader]) => sourceHeader && targetHeader !== "trades")
    .map(([targetHeader, sourceHeader]) => `${sourceHeader} -> ${targetHeader}`)
    .join(", ");
}

function formatIgnoredColumns(mapping?: HeaderMapping | null) {
  if (!mapping?.trades) {
    return "";
  }

  return `${mapping.trades} recognized as trades and ignored by the current price schema`;
}

type UploadAsset = { asset_id: number; symbol: string; dataset_name?: string; dataset_rows?: number };

export default function DataUploadPage() {
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [assetId, setAssetId] = useState<number | "">("");
  const [symbol, setSymbol] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [csvContent, setCsvContent] = useState(sampleCsv);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    apiFetch<{ assets: UploadAsset[] }>("/assets").then((data) => setAssets(data.assets));
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvContent(text);
        setDatasetName(file.name.replace(/\.csv$/i, ""));
        setFeedback(`Loaded ${file.name}. Click 'Validate' or 'Upload' to proceed.`);
      };
      reader.readAsText(file);
    }
  };

  async function validateData() {
    try {
      const result = await apiFetch<UploadValidation>("/assets/validate-upload", {
        method: "POST",
        body: JSON.stringify({ asset_id: assetId === "" ? undefined : assetId, symbol: symbol || undefined, csv_content: csvContent }),
      });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      if (result.valid && result.ai_normalized) {
        const mappingText = formatHeaderMapping(result.ai_mapping);
        const ignoredText = formatIgnoredColumns(result.ai_mapping);
        setFeedback(`AI normalized headers: ${mappingText}.${ignoredText ? ` ${ignoredText}.` : ""}`);
        return;
      }

      setFeedback(result.valid ? "Dataset headers look valid." : `Missing columns: ${result.missing_columns.join(", ")}`);
    } catch (error) {
      setFeedback(getErrorMessage(error));
    }
  }

  async function uploadData(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await apiFetch<UploadResult>("/assets/upload", {
        method: "POST",
        body: JSON.stringify({ asset_id: assetId === "" ? undefined : assetId, symbol: symbol || undefined, csv_content: csvContent, dataset_name: datasetName }),
      });
      const mappingText = formatHeaderMapping(result.ai_mapping);
      const ignoredText = formatIgnoredColumns(result.ai_mapping);
      const aiSuffix = result.ai_mapped && mappingText ? ` after AI normalization: ${mappingText}` : "";
      const ignoredSuffix = ignoredText ? ` ${ignoredText}.` : "";
      const datasetLabel = result.dataset_name ? ` as "${result.dataset_name}"` : "";
      
      // Refresh assets to include the new dataset or new asset
      apiFetch<{ assets: UploadAsset[] }>("/assets").then((data) => setAssets(data.assets));
      
      setFeedback(`Uploaded ${result.rows_imported} rows${datasetLabel} successfully${aiSuffix}.${ignoredSuffix}`);
    } catch (error) {
      setFeedback(getErrorMessage(error));
    }
  }

  return (
    <section className="page">
      <article className="panel">
        <p className="eyebrow">Historical Data Upload</p>
        <h2>Validate and import market data</h2>
        <form className="formStack" onSubmit={uploadData}>
          <label>
            Asset (Optional)
            <select value={assetId} onChange={(event) => setAssetId(event.target.value === "" ? "" : Number(event.target.value))}>
              <option value="">Create new asset from symbol</option>
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.dataset_name ? `${asset.symbol} - ${asset.dataset_name}` : asset.symbol}
                </option>
              ))}
            </select>
          </label>
          {assetId === "" && (
            <label>
              New Asset Symbol
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="Example: BTC"
                required
              />
            </label>
          )}
          <label>
            Dataset Name
            <input
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Example: XRP 1D Binance 2023"
            />
          </label>
          <label>
            Upload File (.csv)
            <input type="file" accept=".csv" onChange={handleFileChange} style={{ marginBottom: "1rem" }} />
          </label>
          <label>
            CSV Content (Preview/Edit)
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
