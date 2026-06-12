"""SQLite-Datenbank-Setup (SQLAlchemy)."""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()

# Sicherstellen, dass das Daten-Verzeichnis existiert (Volume-Mount).
os.makedirs(settings.data_dir, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Modelle importieren, damit sie bei create_all registriert sind.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
