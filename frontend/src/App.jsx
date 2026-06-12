import React, { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./components/Login";
import ProjectsTab from "./components/ProjectsTab";
import DashboardTab from "./components/DashboardTab";
import ConnectionCard from "./components/ConnectionCard";

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark"
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [theme, setTheme] = useTheme();

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
    return (
      <div className="container center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" />
          <h1>Projektzeit</h1>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            title="Theme wechseln"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className="btn secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <ConnectionCard />

      <div className="tabs">
        <button
          className={tab === "dashboard" ? "active" : ""}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={tab === "projects" ? "active" : ""}
          onClick={() => setTab("projects")}
        >
          Projekte
        </button>
      </div>

      {tab === "dashboard" ? <DashboardTab /> : <ProjectsTab />}
    </div>
  );
}
