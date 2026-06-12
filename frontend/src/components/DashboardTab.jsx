import React, { useEffect, useState } from "react";
import { api } from "../api";
import BarChart from "./BarChart";

function Kpi({ label, value, accent }) {
  return (
    <div className={"kpi " + accent}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value.toFixed(1)}
        <span className="kpi-unit">h</span>
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Projektliste für das Dropdown laden.
  useEffect(() => {
    (async () => {
      try {
        const list = await api.listProjects();
        setProjects(list);
        if (list.length) setSelected(list[0].id);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  // Dashboard für das gewählte Projekt laden.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await api.dashboard(selected);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="dashboard">
      <div className="card toolbar">
        <div>
          <div className="muted small">Projekt</div>
          <select
            className="select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {projects.length === 0 && <option>Keine Projekte</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? "" : " (inaktiv)"}
              </option>
            ))}
          </select>
        </div>
        {data && (
          <div className="muted small tz">Zeitzone: {data.timezone}</div>
        )}
      </div>

      {error && <div className="card error-card">⚠️ {error}</div>}

      {data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Letzte 7 Tage" value={data.kpis.last_7_days} accent="a1" />
            <Kpi label="Letzte 30 Tage" value={data.kpis.last_30_days} accent="a2" />
            <Kpi label="Gesamt" value={data.kpis.total} accent="a3" />
          </div>

          <div className="card chart-card">
            <div className="card-head">
              <h2>Stunden pro Woche</h2>
              <span className="muted small">
                seit dem ersten Termin von „{data.project_name}"
              </span>
            </div>
            <BarChart weeks={data.weeks} />
          </div>
        </>
      )}

      {loading && !data && <div className="card muted">Lädt Dashboard…</div>}
    </div>
  );
}
