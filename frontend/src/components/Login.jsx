import React, { useState } from "react";
import { api } from "../api";

export default function Login({ onLoggedIn }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="brand">
        <span className="brand-dot" />
        <h1>Projektzeit</h1>
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Anmeldung</h2>
        <p className="muted small">Bitte mit dem App-Passwort einloggen.</p>
        <form onSubmit={submit} className="row" style={{ marginTop: 14 }}>
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ flex: 1 }}
          />
          <button className="btn" disabled={busy}>
            {busy ? "…" : "Login"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
