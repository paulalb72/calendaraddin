import React, { useEffect, useState } from "react";
import { api } from "../api";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api.report(from, to));
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // A-03: beim ersten Laden den laufenden Monat anzeigen.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxHours = data && data.rows.length ? data.rows[0].hours : 0;

  return (
    <div className="card">
      <h2>Auswertung</h2>
      <div className="row" style={{ margin: "12px 0" }}>
        <label className="muted">
          Von&nbsp;
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="muted">
          Bis&nbsp;
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Berechne…" : "Aktualisieren"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <p className="muted">
            Zeitraum {data.date_from} – {data.date_to} · Zeitzone {data.timezone} ·
            Gesamt <strong>{data.total_hours} h</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th>Projekt</th>
                <th style={{ width: "40%" }}></th>
                <th style={{ textAlign: "right" }}>Stunden</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.project_id || "unknown"}>
                  <td>{r.project_name}</td>
                  <td>
                    <div
                      className="bar"
                      style={{
                        width: maxHours ? `${(r.hours / maxHours) * 100}%` : "0%",
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>{r.hours.toFixed(2)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Keine Buchungen im Zeitraum.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
