"""Pydantic-Schemas für Request/Response."""
from typing import Optional

from pydantic import BaseModel, Field


class ProjectPublic(BaseModel):
    """Antwort für das Add-on (F-14): nur id + name."""

    id: str
    name: str


class ProjectAdmin(BaseModel):
    id: str
    name: str
    active: bool

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    active: bool = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    active: Optional[bool] = None


class LoginRequest(BaseModel):
    password: str


class ReportRow(BaseModel):
    project_id: Optional[str]
    project_name: str
    hours: float


class ReportResponse(BaseModel):
    date_from: str
    date_to: str
    timezone: str
    rows: list[ReportRow]
    total_hours: float


class OAuthStatus(BaseModel):
    connected: bool


class WeekBucket(BaseModel):
    week_start: str  # Montag der Woche (ISO-Datum)
    label: str       # z. B. "KW23"
    hours: float


class DashboardKpis(BaseModel):
    last_7_days: float
    last_30_days: float
    total: float


class DashboardResponse(BaseModel):
    project_id: str
    project_name: str
    timezone: str
    weeks: list[WeekBucket]
    kpis: DashboardKpis
