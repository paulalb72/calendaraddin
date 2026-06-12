"""UI-Login und Google-OAuth-Flow.

UI-Login (AUTH-07):
- POST /api/login   { password } -> setzt Session-Cookie
- POST /api/logout
- GET  /api/me      -> { authenticated: bool }

Google-OAuth (AUTH-02/03):
- GET /api/oauth/start    -> Redirect zum Google-Consent (Session-geschützt)
- GET /api/oauth/callback -> tauscht Code gegen Refresh-Token, speichert ihn
- GET /api/oauth/status   -> { connected: bool }
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..auth import (
    SESSION_COOKIE,
    create_session_token,
    require_ui_session,
    verify_password,
)
from ..config import get_settings
from ..database import get_db
from ..google_calendar import authorization_url, exchange_code, is_connected
from ..schemas import LoginRequest, OAuthStatus

router = APIRouter(prefix="/api")
settings = get_settings()


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    if not verify_password(payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falsches Passwort")
    token = create_session_token()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )
    return {"authenticated": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"authenticated": False}


@router.get("/me")
def me(request: Request):
    session = request.cookies.get(SESSION_COOKIE)
    try:
        if session:
            require_ui_session(session)
            return {"authenticated": True}
    except HTTPException:
        pass
    return {"authenticated": False}


# --------------------------------------------------------------------------- #
# Google OAuth
# --------------------------------------------------------------------------- #
@router.get("/oauth/status", response_model=OAuthStatus)
def oauth_status(db: Session = Depends(get_db), _=Depends(require_ui_session)):
    return OAuthStatus(connected=is_connected(db))


@router.get("/oauth/start")
def oauth_start(_=Depends(require_ui_session)):
    url, _state = authorization_url()
    return RedirectResponse(url)


@router.get("/oauth/callback")
def oauth_callback(code: str | None = None, error: str | None = None,
                   db: Session = Depends(get_db)):
    if error:
        return HTMLResponse(f"<h1>OAuth-Fehler</h1><p>{error}</p>", status_code=400)
    if not code:
        return HTMLResponse("<h1>Fehlender Code</h1>", status_code=400)
    try:
        exchange_code(db, code)
    except Exception as exc:  # noqa: BLE001
        return HTMLResponse(f"<h1>OAuth fehlgeschlagen</h1><p>{exc}</p>",
                            status_code=400)
    return HTMLResponse(
        "<h1>Google-Konto verbunden ✅</h1>"
        "<p>Der Refresh-Token wurde gespeichert. Du kannst dieses Fenster "
        'schließen und zur <a href="/">Webapp</a> zurückkehren.</p>'
    )
