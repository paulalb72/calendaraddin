import React, { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./components/Login";
import ProjectsTab from "./components/ProjectsTab";
import ReportTab from "./components/ReportTab";
import ConnectionCard from "./components/ConnectionCard";

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState("report");

  async function check() {
    try {
      const me = await api.me();
      setAuthed(me.authenticated);
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  async function logout() {
    await api.logout();
    setAuthed(false);
  }

  if (authed === null) {
    return <div className="container">Lädt…</div>;
  }

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>Projektzeit-Erfassung</h1>
        <button className="btn secondary" onClick={logout}>
          Logout
        </button>
      </header>

      <ConnectionCard />

      <div className="tabs">
        <button
          className={tab === "report" ? "active" : ""}
          onClick={() => setTab("report")}
        >
          Auswertung
        </button>
        <button
          className={tab === "projects" ? "active" : ""}
          onClick={() => setTab("projects")}
        >
          Projekte
        </button>
      </div>

      {tab === "report" ? <ReportTab /> : <ProjectsTab />}
    </div>
  );
}
