"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";

type Asset = {
  asset_id: number;
  symbol: string;
  asset_name: string;
  market: string;
  asset_type_id: number;
  asset_type: string;
  price_points: number;
  dataset_name?: string;
  dataset_uploaded_at?: string;
  dataset_rows?: number;
  first_price_date?: string | null;
  last_price_date?: string | null;
  datasets?: Array<{
    dataset_id: number;
    dataset_name: string;
    price_points: number;
    first_price_date?: string | null;
    last_price_date?: string | null;
  }>;
};

type AssetType = { asset_type_id: number; type_name: string };

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [form, setForm] = useState({ symbol: "", asset_name: "", market: "", asset_type_id: 1 });

  function loadAssets() {
    apiFetch<{ assets: Asset[]; asset_types: AssetType[] }>("/assets").then((data) => {
      setAssets(data.assets);
      setAssetTypes(data.asset_types);
    });
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/assets", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ symbol: "", asset_name: "", market: "", asset_type_id: 1 });
    loadAssets();
  }

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Asset Management</p>
          <h2>Track instruments available for backtesting.</h2>
        </div>
      </div>
      <div className="grid twoCol">
        <article className="panel">
          <h3>Add Asset</h3>
          <form className="formStack" onSubmit={handleCreate}>
            <label>
              Symbol
              <input value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} />
            </label>
            <label>
              Asset Name
              <input value={form.asset_name} onChange={(event) => setForm({ ...form, asset_name: event.target.value })} />
            </label>
            <label>
              Market
              <input value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })} />
            </label>
            <label>
              Type
              <select
                value={form.asset_type_id}
                onChange={(event) => setForm({ ...form, asset_type_id: Number(event.target.value) })}
              >
                {assetTypes.map((type) => (
                  <option key={type.asset_type_id} value={type.asset_type_id}>
                    {type.type_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Create Asset</button>
          </form>
        </article>
        <article className="panel">
          <h3>Available Assets</h3>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Dataset</th>
                  <th>Date Range</th>
                  <th>Price Rows</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.asset_id}>
                    <td>{asset.symbol}</td>
                    <td>{asset.asset_name}</td>
                    <td>{asset.asset_type}</td>
                    <td>
                      {asset.datasets?.length
                        ? asset.datasets.map((dataset) => dataset.dataset_name).join(", ")
                        : (asset.dataset_name ?? "Seeded data")}
                    </td>
                    <td>
                      {asset.first_price_date && asset.last_price_date
                        ? `${asset.first_price_date} to ${asset.last_price_date}`
                        : "N/A"}
                    </td>
                    <td>{asset.price_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
