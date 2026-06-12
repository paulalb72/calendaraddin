import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createProject(newName.trim());
      setNewName("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rename(p) {
    const name = window.prompt("Neuer Projektname:", p.name);
    if (name == null || !name.trim() || name === p.name) return;
    try {
      await api.updateProject(p.id, { name: name.trim() });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(p) {
    try {
      await api.updateProject(p.id, { active: !p.active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Projekte</h2>
      <p className="muted">
        Inaktive Projekte erscheinen nicht mehr im Add-on-Dropdown, bleiben aber
        in der Auswertung historisch erhalten.
      </p>

      <form onSubmit={add} className="row" style={{ margin: "12px 0" }}>
        <input
          type="text"
          placeholder="Neues Projekt…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn">Anlegen</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Lädt…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <span className={"badge" + (p.active ? "" : " off")}>
                    {p.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn secondary"
                    onClick={() => rename(p)}
                    style={{ marginRight: 6 }}
                  >
                    Umbenennen
                  </button>
                  <button className="btn secondary" onClick={() => toggleActive(p)}>
                    {p.active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Noch keine Projekte angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
