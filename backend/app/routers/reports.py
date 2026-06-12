"""Auswertungs-Endpunkt (F-10..F-13).

GET /api/report?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
Standardzeitraum (A-03): laufender Monat, wenn nichts angegeben.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import require_ui_session
from ..database import get_db
from ..google_calendar import compute_report, is_connected
from ..schemas import ReportResponse

router = APIRouter(prefix="/api")


@router.get(
    "/report",
    response_model=ReportResponse,
    dependencies=[Depends(require_ui_session)],
)
def report(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if not date_from or not date_to:
        today = date.today()
        first = today.replace(day=1)
        date_from = date_from or first.isoformat()
        date_to = date_to or today.isoformat()

    if not is_connected(db):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Google-Konto ist nicht verbunden. Bitte zuerst OAuth durchführen.",
        )

    try:
        return compute_report(db, date_from, date_to)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
