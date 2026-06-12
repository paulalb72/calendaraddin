"""Anwendungs-Konfiguration aus Umgebungsvariablen.

Alle Secrets / Einstellungen werden über Environment-Variablen gesetzt
(siehe .env.example und README).
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Google OAuth ---
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_uri: str = "http://localhost:8000/api/oauth/callback"

    # Kalender, dessen Termine ausgewertet werden ("primary" = Hauptkalender)
    calendar_id: str = "primary"

    # --- Schutz der Endpunkte ---
    # Token, mit dem das Apps-Script-Add-on GET /api/projects abruft.
    addon_api_token: str = ""
    # Passwort für den Single-User-Login der Webapp-UI.
    app_password: str = "changeme"
    # Secret zum Signieren der Session-Cookies. Wenn leer -> aus app_password abgeleitet.
    session_secret: str = ""

    # --- Speicherort der SQLite-Datei (als Docker-Volume gemountet) ---
    data_dir: str = "./data"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir.rstrip('/')}/app.db"

    @property
    def effective_session_secret(self) -> str:
        return self.session_secret or f"session::{self.app_password}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
