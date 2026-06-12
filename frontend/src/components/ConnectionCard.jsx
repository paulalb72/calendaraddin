import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function ConnectionCard() {
  const [connected, setConnected] = useState(null);

  async function load() {
    try {
      const s = await api.oauthStatus();
      setConnected(s.connected);
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div className="conn">
        <div>
          <h2 style={{ margin: 0 }}>Google-Kalender-Verbindung</h2>
          <p className="muted small" style={{ margin: "5px 0 0" }}>
            {connected == null
              ? "Status wird geprüft…"
              : connected
              ? "Verbunden – Dashboard ist aktiv."
              : "Nicht verbunden – bitte einmalig autorisieren."}
          </p>
        </div>
        <span className={"badge" + (connected ? "" : " off")}>
          {connected ? "● Verbunden" : "○ Getrennt"}
        </span>
      </div>
      {connected === false && (
        <p style={{ marginTop: 14, marginBottom: 0 }}>
          <a className="btn" href="/api/oauth/start" style={{ textDecoration: "none" }}>
            Mit Google verbinden
          </a>
        </p>
      )}
    </div>
  );
}
