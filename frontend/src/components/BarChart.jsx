import React, { useState } from "react";

/**
 * Wochen-Balkendiagramm (custom, ohne externe Lib).
 * weeks: [{ week_start, label, hours }]
 */
export default function BarChart({ weeks }) {
  const [hover, setHover] = useState(null);

  if (!weeks || weeks.length === 0) {
    return <p className="muted">Noch keine Termine für dieses Projekt.</p>;
  }

  const max = Math.max(1, ...weeks.map((w) => w.hours));
  // Bei vielen Wochen nur jedes n-te Label zeigen, damit nichts überlappt.
  const step = Math.ceil(weeks.length / 14);

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  return (
    <div className="chart">
      <div className="chart-grid">
        <span>{max.toFixed(1)} h</span>
        <span>{(max / 2).toFixed(1)} h</span>
        <span>0</span>
      </div>
      <div className="chart-bars">
        {weeks.map((w, i) => {
          const pct = (w.hours / max) * 100;
          const active = hover === i;
          return (
            <div
              className="bar-col"
              key={w.week_start}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="bar-track">
                {active && (
                  <div className="bar-tip">
                    <strong>{w.hours.toFixed(2)} h</strong>
                    <span>
                      {w.label} · ab {fmtDate(w.week_start)}
                    </span>
                  </div>
                )}
                <div
                  className={"bar-fill" + (w.hours === 0 ? " empty" : "")}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className={"bar-label" + (active ? " active" : "")}>
                {i % step === 0 || active ? w.label : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
