# Projektzeit-Erfassung für Google Calendar

Beim Bearbeiten eines Termins im Google Kalender wählt man über ein Add-on ein
**Projekt** aus einem Dropdown; die Termindauer wird damit dem Projekt zugeordnet.
Projektpflege und Auswertung (Gesamtstunden pro Projekt) laufen in einer kleinen,
per Docker deploybaren **Webapp**.

> Umsetzung der `anforderungen_kalender_projektzeit(1).md`.

## Architektur

| Komponente | Technik | Aufgabe |
|---|---|---|
| **A – Calendar Add-on** | Google Apps Script (`addon/`) | Projekt-Dropdown im Termin-Panel, schreibt `projectId` (Extended Property) + Titel-Präfix. |
| **B – Webapp** | FastAPI + React + SQLite (`backend/`, `frontend/`) | Projektpflege, Auswertung, `GET /api/projects` für das Add-on, OAuth-Zugriff auf den Kalender. |

**Datenfluss:** Projekte werden in der Webapp gepflegt (SQLite) → Add-on holt aktive
Projekte über `GET /api/projects` → Nutzer wählt im Termin ein Projekt → Add-on
speichert die Projekt-ID am Termin → Auswertung liest die Termine live aus dem
Kalender und summiert die Dauer je Projekt-ID. **Buchungen werden nicht persistiert**,
nur die Projekt-Stammdaten.

```
Calendar_AddIn/
├── backend/            FastAPI-App (API + serviert das React-Build)
│   └── app/
│       ├── main.py            App, Routing, Static-Serving (SPA)
│       ├── config.py          Env-Konfiguration
│       ├── database.py        SQLite/SQLAlchemy
│       ├── models.py          Project, Setting (Refresh-Token)
│       ├── schemas.py         Pydantic-Schemas
│       ├── auth.py            API-Token + UI-Session
│       ├── google_calendar.py OAuth + Auswertungsberechnung
│       └── routers/           projects, reports, auth_routes (login + oauth)
├── frontend/           React (Vite): Login, Projekte, Auswertung, OAuth-Status
├── addon/              Apps-Script-Add-on (appsscript.json, Code.gs)
├── Dockerfile          Multi-Stage: baut Frontend, serviert via FastAPI
├── docker-compose.yml  App + Volume für SQLite/Refresh-Token
└── .env.example        Vorlage der Umgebungsvariablen
```

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth-Client (Web) aus Google Cloud |
| `OAUTH_REDIRECT_URI` | Muss exakt als Redirect-URI im OAuth-Client stehen |
| `CALENDAR_ID` | Auszuwertender Kalender, Standard `primary` |
| `ADDON_API_TOKEN` | Schützt `GET /api/projects`; identisch im Add-on hinterlegen |
| `APP_PASSWORD` | Passwort für den Webapp-Login (Single-User) |
| `SESSION_SECRET` | Optional; signiert Session-Cookies (sonst aus `APP_PASSWORD`) |

---

## Einrichtungsanleitung

### 1. Google-Cloud-Projekt + OAuth-Client

1. [Google Cloud Console](https://console.cloud.google.com/) → neues Projekt anlegen.
2. **APIs & Dienste → Bibliothek →** *Google Calendar API* aktivieren.
3. **OAuth-Zustimmungsbildschirm**: Nutzertyp *Extern*, **Status „Testing"** lassen,
   das eigene Gmail-Konto als **Testnutzer** hinzufügen (so ist keine
   Google-Verifizierung nötig).
4. **Anmeldedaten → OAuth-Client-ID erstellen → Anwendungstyp „Webanwendung"**.
   - *Autorisierte Redirect-URIs*: deine `OAUTH_REDIRECT_URI`
     (lokal `http://localhost:8000/api/oauth/callback`,
     in Prod `https://deine-domain.tld/api/oauth/callback`).
   - Client-ID + Secret in die `.env` übernehmen.

### 2. Webapp deployen & OAuth einmalig durchlaufen

> Für ein gehostetes Deployment mit automatischer Domain + HTTPS siehe
> [DEPLOY_COOLIFY.md](DEPLOY_COOLIFY.md). Lokal/eigener Server:

```bash
cp .env.example .env        # Werte eintragen
docker compose up -d --build
```

- Webapp öffnen (`http://localhost:8000` bzw. deine Domain) → mit `APP_PASSWORD` anmelden.
- Karte **„Google-Kalender-Verbindung"** → **„Mit Google verbinden"** → Consent erteilen.
- Danach wird der **Refresh-Token** im Volume (SQLite) gespeichert; die Auswertung
  funktioniert ab jetzt ohne erneuten Login.

> Hinweis (A-02): Damit das Apps-Script-Add-on `GET /api/projects` erreichen kann,
> muss die Webapp **aus dem Internet erreichbar** sein (Domain/Reverse Proxy).
> Für reine lokale Tests kann das Add-on nicht auf `localhost` zugreifen.

### 3. Add-on einrichten

Siehe [`addon/README.md`](addon/README.md): Apps-Script-Projekt mit `appsscript.json`
und `Code.gs` anlegen, `WEBAPP_URL` + `ADDON_API_TOKEN` setzen (via `setupConfig()`),
`urlFetchWhitelist` auf die Domain anpassen, testweise bereitstellen.

### 4. Add-on testen

Kalender öffnen → Termin anklicken → rechts erscheint das Panel **„Projektzeit"** mit
dem Dropdown der aktiven Projekte. Auswählen → *Speichern*: Titel erhält `[Projekt] `
und die Projekt-ID wird am Termin gespeichert.

---

## Lokale Entwicklung (ohne Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -r requirements.txt
# Env setzen (PowerShell): $env:APP_PASSWORD="test"; $env:ADDON_API_TOKEN="dev-token" ...
uvicorn app.main:app --reload --port 8000
```

**Frontend (Hot-Reload, proxyt /api → :8000):**
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Für den Produktivbetrieb baut `npm run build` nach `frontend/dist`, was FastAPI
unter `/` ausliefert (im Docker-Image automatisch).

---

## Umsetzung der Anforderungen (Kurzmapping)

- **F-01/F-02/AK-01**: Add-on-Dropdown nur aktiver Projekte aus `GET /api/projects`;
  Auswahl optional („— Kein Projekt —").
- **F-03/F-04/AK-02/AK-03**: `Code.gs` setzt privates Extended Property `projectId`
  und Titel-Präfix `[Name] `; Wechsel/Entfernen bereinigt den Titel.
- **F-07..F-09**: Projektpflege-Tab (Anlegen/Umbenennen/Aktiv schalten); inaktive
  Projekte verschwinden aus dem Add-on, bleiben in der Auswertung (über die ID).
- **F-10..F-13 / R-01..R-06**: `google_calendar.compute_report` – `singleEvents=True`
  (Serien einzeln, R-02), ignoriert Ganztagestermine (R-01) und Termine ohne
  Projekt-ID (R-03), Dauer = Ende−Start (F-13), Zeitzone des Kalenders (R-05),
  unbekannte IDs → „Unbekannt/Gelöscht" (R-06), absteigend sortiert (F-11).
- **F-14/F-15/AK-09**: `GET /api/projects` nur mit Header `X-API-Token`.
- **AUTH-02..AUTH-07**: OAuth (nur `calendar.events.readonly`), Refresh-Token im
  Volume, UI per `APP_PASSWORD` geschützt.
- **AK-08**: Auswertung mappt Projekt-ID → aktuellen Namen, ohne Stunden zu verlieren.
```
