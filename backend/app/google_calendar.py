"""Google-Calendar-Zugriff (lesend) und Auswertungs-Berechnung.

Der OAuth-Refresh-Token wird in der DB (Setting-Tabelle) gespeichert (AUTH-02).
Die Stunden je Projekt werden live aus dem Kalender berechnet (D-04, F-12).
"""
from collections import defaultdict
from datetime import datetime, timezone

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Project, Setting

settings = get_settings()

# AUTH-04: Webapp nur lesend.
SCOPES = ["https://www.googleapis.com/auth/calendar.events.readonly"]
REFRESH_TOKEN_KEY = "google_refresh_token"
UNKNOWN_LABEL = "Unbekannt/Gelöscht"  # R-06


# --------------------------------------------------------------------------- #
# Setting-Helfer
# --------------------------------------------------------------------------- #
def get_setting(db: Session, key: str) -> str | None:
    row = db.get(Setting, key)
    return row.value if row else None


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


# --------------------------------------------------------------------------- #
# OAuth-Flow
# --------------------------------------------------------------------------- #
def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.oauth_redirect_uri],
        }
    }


def build_flow() -> Flow:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.oauth_redirect_uri
    return flow


def authorization_url() -> tuple[str, str]:
    flow = build_flow()
    # access_type=offline + prompt=consent -> garantiert einen Refresh-Token.
    url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url, state


def exchange_code(db: Session, code: str) -> None:
    flow = build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    if not creds.refresh_token:
        raise RuntimeError(
            "Kein Refresh-Token erhalten. Bitte App im Google-Konto trennen und "
            "Consent erneut durchlaufen."
        )
    set_setting(db, REFRESH_TOKEN_KEY, creds.refresh_token)


def is_connected(db: Session) -> bool:
    return bool(get_setting(db, REFRESH_TOKEN_KEY))


def _credentials(db: Session) -> Credentials:
    refresh_token = get_setting(db, REFRESH_TOKEN_KEY)
    if not refresh_token:
        raise RuntimeError("Google-Konto ist nicht verbunden (kein Refresh-Token).")
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    creds.refresh(GoogleRequest())
    return creds


def _calendar_service(db: Session):
    return build("calendar", "v3", credentials=_credentials(db), cache_discovery=False)


# --------------------------------------------------------------------------- #
# Auswertung
# --------------------------------------------------------------------------- #
def _parse_dt(value: str) -> datetime:
    # RFC3339; Python <3.11 versteht 'Z' nicht direkt.
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def compute_report(db: Session, date_from: str, date_to: str) -> dict:
    """Summiert die Termindauer je Projekt im Zeitraum [date_from, date_to].

    date_from / date_to sind ISO-Datumsangaben (YYYY-MM-DD). date_to ist
    inklusiv (es wird bis zum Ende dieses Tages gerechnet).
    """
    service = _calendar_service(db)

    # R-05: Zeitzone des Hauptkalenders. Sie steht in jeder events.list-Antwort,
    # daher kein calendars().get() (das wäre mit dem reinen events.readonly-Scope
    # nicht erlaubt -> 403). Erst grob in UTC abfragen, um die TZ zu lernen.
    probe = (
        service.events()
        .list(
            calendarId=settings.calendar_id,
            maxResults=1,
            singleEvents=True,
            timeMin=f"{date_from}T00:00:00Z",
            timeMax=f"{date_to}T23:59:59Z",
        )
        .execute()
    )
    cal_tz = probe.get("timeZone", "UTC")

    # Saubere Grenzen mit der Kalender-Zeitzone.
    time_min = _to_rfc3339(f"{date_from}T00:00:00", cal_tz)
    time_max = _to_rfc3339(f"{date_to}T23:59:59", cal_tz)

    seconds_by_project: dict[str | None, float] = defaultdict(float)

    page_token = None
    while True:
        resp = (
            service.events()
            .list(
                calendarId=settings.calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,  # R-02: Serien in Einzelvorkommen expandieren
                orderBy="startTime",
                maxResults=2500,
                pageToken=page_token,
            )
            .execute()
        )

        for event in resp.get("items", []):
            start = event.get("start", {})
            end = event.get("end", {})

            # R-01: Ganztägige Termine (nur 'date', kein 'dateTime') ignorieren.
            if "dateTime" not in start or "dateTime" not in end:
                continue

            # R-03: Termine ohne projectId fließen nicht ein.
            project_id = (
                event.get("extendedProperties", {})
                .get("private", {})
                .get("projectId")
            )
            if not project_id:
                continue

            duration = (_parse_dt(end["dateTime"]) - _parse_dt(start["dateTime"])).total_seconds()
            if duration <= 0:
                continue
            seconds_by_project[project_id] += duration

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    # Projekt-IDs auf aktuelle Namen mappen (D-03 / AK-08); unbekannte -> R-06.
    projects = {p.id: p.name for p in db.query(Project).all()}
    rows = []
    for project_id, seconds in seconds_by_project.items():
        name = projects.get(project_id, UNKNOWN_LABEL)
        rows.append(
            {
                "project_id": project_id,
                "project_name": name,
                "hours": round(seconds / 3600.0, 2),
            }
        )

    rows.sort(key=lambda r: r["hours"], reverse=True)  # F-11: absteigend
    total = round(sum(r["hours"] for r in rows), 2)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "timezone": cal_tz,
        "rows": rows,
        "total_hours": total,
    }


def _to_rfc3339(local_naive: str, tz_name: str) -> str:
    """Wandelt eine naive lokale Zeit in einen RFC3339-String mit Offset der
    Kalender-Zeitzone um."""
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    dt = datetime.fromisoformat(local_naive).replace(tzinfo=tz)
    return dt.isoformat()
