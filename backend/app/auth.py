"""Authentifizierung.

- API-Token-Schutz für das Add-on (AUTH-06 / F-15).
- Single-User-Passwort-Schutz der Webapp-UI via signiertem Session-Cookie (AUTH-07).
"""
import hmac

from fastapi import Cookie, Header, HTTPException, status
from itsdangerous import BadSignature, URLSafeTimedSerializer

from .config import get_settings

settings = get_settings()
SESSION_COOKIE = "session"
_serializer = URLSafeTimedSerializer(settings.effective_session_secret, salt="ui-session")


def verify_password(password: str) -> bool:
    return hmac.compare_digest(password, settings.app_password)


def create_session_token() -> str:
    return _serializer.dumps({"ok": True})


def require_ui_session(session: str | None = Cookie(default=None)):
    """Dependency: gültige UI-Session (Cookie) erforderlich."""
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Nicht angemeldet")
    try:
        # max_age = 30 Tage
        _serializer.loads(session, max_age=60 * 60 * 24 * 30)
    except BadSignature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session ungültig")
    return True


def require_api_token(x_api_token: str | None = Header(default=None)):
    """Dependency: gültiges Add-on-Token im Header X-API-Token (F-15 / AK-09)."""
    expected = settings.addon_api_token
    if not expected:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ADDON_API_TOKEN ist nicht konfiguriert",
        )
    if not x_api_token or not hmac.compare_digest(x_api_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Ungültiges API-Token")
    return True
