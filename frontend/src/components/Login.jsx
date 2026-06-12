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
      <div className="card">
        <h1>Anmeldung</h1>
        <p className="muted">Projektzeit-Erfassung</p>
        <form onSubmit={submit} className="row" style={{ marginTop: 12 }}>
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
