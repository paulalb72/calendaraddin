"""Datenmodelle.

- Project: Projekt-Stammdaten (D-01).
- Setting: Key/Value-Store, u. a. für den Google-Refresh-Token (AUTH-02).
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, String, func

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
