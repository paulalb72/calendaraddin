# Deployment mit Coolify

[Coolify](https://coolify.io/) ist eine selbst-gehostete PaaS, die diese App baut,
hinter einem Reverse-Proxy (Traefik) ausliefert und **automatisch HTTPS** über
Let's Encrypt einrichtet. Die so vergebene Domain macht die Webapp aus dem Internet
erreichbar – genau das braucht das Apps-Script-Add-on (Anforderung A-02), um
`GET /api/projects` aufzurufen.

> Empfohlen wird der **Dockerfile-Build-Pack** (einfach, robust). Eine
> Compose-Variante ist am Ende beschrieben.

---

## 0. Voraussetzungen

- Eine laufende **Coolify-Instanz** auf einem Server mit öffentlicher IP.
- Eine **Domain/Subdomain**, deren DNS-`A`-Record auf den Server zeigt
  (z. B. `projektzeit.deine-domain.tld`).
- Der Code muss in einem **Git-Repository** liegen, auf das Coolify zugreifen kann
  (GitHub/GitLab/Gitea oder eine öffentliche/Deploy-Key-Repo-URL).

### Code nach Git bringen (falls noch nicht geschehen)

```bash
cd c:\Users\PaulA\Desktop\Calendar_AddIn
git init
git add .
git commit -m "Projektzeit-Erfassung: initial"
git branch -M main
git remote add origin <DEINE-REPO-URL>
git push -u origin main
```

> `.gitignore` schließt `.env`, `data/`, `node_modules/` und `.venv/` bereits aus –
> es werden **keine Secrets** committet.

---

## 1. Ressource in Coolify anlegen

1. In Coolify: **Project → + New → Application**.
2. Git-Quelle wählen und das Repository + Branch `main` auswählen.
3. **Build Pack: `Dockerfile`** auswählen.
   - *Dockerfile Location:* `/Dockerfile` (Standard).
   - *Base Directory:* `/` (Standard).

## 2. Netzwerk / Domain

1. **Ports Exposes:** `8000` (der Port, auf dem uvicorn lauscht).
2. **Domains:** deine Domain eintragen, z. B. `https://projektzeit.deine-domain.tld`.
   - Coolify erzeugt automatisch das Let's-Encrypt-Zertifikat und proxyt auf Port 8000.
3. **Health Check Path** (falls abgefragt): `/api/health`.
   *(Das Dockerfile bringt bereits einen `HEALTHCHECK` mit.)*

## 3. Persistenter Speicher (WICHTIG für SQLite + Refresh-Token)

Ohne persistenten Speicher gehen DB und Google-Refresh-Token bei jedem Redeploy
verloren. Deshalb:

1. Tab **Storages → + Add**.
2. **Mount Path im Container:** `/data`
   *(Name/Volume kann Coolify verwalten – Hauptsache der Mount-Pfad ist `/data`.)*

Das Backend schreibt seine SQLite-Datei nach `DATA_DIR=/data/app.db` (im Image als
Default gesetzt) und speichert dort auch den OAuth-Refresh-Token.

## 4. Umgebungsvariablen (Tab „Environment Variables")

| Variable | Wert |
|---|---|
| `GOOGLE_CLIENT_ID` | aus Google Cloud (OAuth-Client) |
| `GOOGLE_CLIENT_SECRET` | aus Google Cloud (als *Secret* markieren) |
| `OAUTH_REDIRECT_URI` | `https://projektzeit.deine-domain.tld/api/oauth/callback` |
| `CALENDAR_ID` | `primary` |
| `ADDON_API_TOKEN` | langes Zufallstoken (als *Secret*) – identisch im Add-on |
| `APP_PASSWORD` | dein UI-Login-Passwort (als *Secret*) |
| `SESSION_SECRET` | optionales langes Zufallstoken (als *Secret*) |
| `DATA_DIR` | `/data` *(im Image bereits Default – nur zur Klarheit)* |

> `OAUTH_REDIRECT_URI` **muss** exakt der öffentlichen Coolify-Domain entsprechen
> und genauso in der Google Cloud Console hinterlegt sein (siehe nächster Schritt).

## 5. Google-OAuth-Client an die Domain anpassen

In der [Google Cloud Console](https://console.cloud.google.com/) → *Anmeldedaten* →
deinen OAuth-Client (Webanwendung) öffnen und unter **Autorisierte Redirect-URIs**
ergänzen:

```
https://projektzeit.deine-domain.tld/api/oauth/callback
```

(Der OAuth-Zustimmungsbildschirm bleibt im **Testmodus**, dein Gmail als Testnutzer –
keine Google-Verifizierung nötig.)

## 6. Deploy & einmaliger OAuth-Consent

1. In Coolify **Deploy** klicken und das Build-Log abwarten
   (Stufe 1 baut das React-Frontend, Stufe 2 das Python-Backend).
2. Domain öffnen → mit `APP_PASSWORD` anmelden.
3. Karte **„Google-Kalender-Verbindung" → „Mit Google verbinden"** → Consent erteilen.
   Der Refresh-Token wird in `/data` gespeichert und übersteht Redeploys.
4. Im Tab **Projekte** ein paar Projekte anlegen.

## 7. Add-on verbinden

Im Apps-Script-Add-on ([addon/README.md](addon/README.md)):
- `setupConfig()`: `WEBAPP_URL = https://projektzeit.deine-domain.tld`,
  `ADDON_API_TOKEN = <derselbe Wert wie in Coolify>`.
- In `appsscript.json` die `urlFetchWhitelist` auf
  `https://projektzeit.deine-domain.tld/` setzen.

---

## Redeploys & Updates

- Neuer `git push` auf `main` → in Coolify **Redeploy** (oder Auto-Deploy per Webhook
  aktivieren). Dank `/data`-Storage bleiben Projekte und Google-Verbindung erhalten.

## Troubleshooting

- **502/Bad Gateway nach Deploy:** kurz warten – der `start-period` des Healthchecks
  ist 20 s. Sonst Build-Log + Container-Logs in Coolify prüfen.
- **OAuth-Fehler `redirect_uri_mismatch`:** `OAUTH_REDIRECT_URI` (Coolify) und die
  autorisierte Redirect-URI (Google Cloud) müssen **zeichengenau** übereinstimmen
  (inkl. `https://` und ohne abschließenden Slash-Unterschied).
- **Daten weg nach Redeploy:** Persistent Storage auf `/data` fehlt (Schritt 3).
- **Add-on lädt keine Projekte:** `urlFetchWhitelist`/`WEBAPP_URL` falsch, oder
  `ADDON_API_TOKEN` stimmt nicht zwischen Coolify und Apps Script überein.

---

## Alternative: Docker-Compose-Deployment in Coolify

Coolify kann auch direkt `docker-compose.yml` verwenden (Build Pack: *Docker Compose*).
Dann übernimmt Coolify das benannte Volume `projektzeit-data` für die Persistenz.
Für die automatische Domain-/Proxy-Zuordnung nutzt Coolify „Magic"-Variablen –
ergänze im Service `app` z. B.:

```yaml
    environment:
      - SERVICE_FQDN_APP_8000          # erzeugt Domain + Traefik-Routing für Port 8000
      - OAUTH_REDIRECT_URI=${SERVICE_FQDN_APP_8000}/api/oauth/callback
```

Coolify füllt `SERVICE_FQDN_APP_8000` mit der vergebenen `https://…`-Domain. Die
übrigen Variablen (Secrets) wie oben in der Coolify-UI setzen. Für den hier
beschriebenen Single-Container-Fall ist der **Dockerfile-Build-Pack** aber
einfacher und wird empfohlen.
