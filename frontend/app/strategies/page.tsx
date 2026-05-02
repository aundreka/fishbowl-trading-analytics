"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";

type Strategy = {
  strategy_id: number;
  strategy_name: string;
  strategy_key: string;
  description: string;
  parameters: Array<{ parameter_id: number; parameter_name: string; default_value: string }>;
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState({ strategy_name: "", strategy_key: "", description: "" });

  function loadStrategies() {
    apiFetch<{ strategies: Strategy[] }>("/strategies").then((data) => setStrategies(data.strategies));
  }

  useEffect(() => {
    loadStrategies();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/strategies", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ strategy_name: "", strategy_key: "", description: "" });
    loadStrategies();
  }

  return (
    <section className="page">
      <div className="grid twoCol">
        <article className="panel">
          <p className="eyebrow">Strategy Management</p>
          <h2>Predefined and custom strategy records</h2>
          <form className="formStack" onSubmit={handleCreate}>
            <label>
              Strategy Name
              <input value={form.strategy_name} onChange={(event) => setForm({ ...form, strategy_name: event.target.value })} />
            </label>
            <label>
              Strategy Key
              <input value={form.strategy_key} onChange={(event) => setForm({ ...form, strategy_key: event.target.value })} />
            </label>
            <label>
              Description
              <textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <button type="submit">Save Strategy</button>
          </form>
        </article>
        <article className="panel">
          <h3>Available Strategies</h3>
          <div className="stack">
            {strategies.map((strategy) => (
              <div key={strategy.strategy_id} className="softCard">
                <strong>{strategy.strategy_name}</strong>
                <p className="muted">{strategy.description}</p>
                <p className="tagRow">Key: {strategy.strategy_key}</p>
                <p className="tagRow">
                  Parameters:{" "}
                  {strategy.parameters.length
                    ? strategy.parameters.map((param) => `${param.parameter_name}=${param.default_value}`).join(", ")
                    : "No predefined parameters"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
