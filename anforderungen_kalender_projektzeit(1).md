# Anforderungsliste: Projektzeit-Erfassung für Google Calendar

> Auftragsdokument zur Umsetzung mit Claude Code.
> Ziel: Beim Bearbeiten eines Termins im Google Kalender wählt man ein Projekt
> aus einem Dropdown; die Termindauer wird damit dem Projekt zugeordnet. Pflege
> der Projekte und Auswertung (Gesamtstunden pro Projekt) laufen in einer kleinen
> Webapp, die per Docker deploybar ist.

---

## 1. Architektur (zwei Komponenten)

**Komponente A – Calendar Add-on (Google Apps Script)**
Liefert das Projekt-Dropdown im Termin-Seitenpanel und schreibt die Zuweisung an
den Termin. Holt die Projektliste live aus der Webapp (Komponente B).

**Komponente B – Webapp (Docker)**
- Projektpflege (Anlegen/Bearbeiten/Aktiv-Schalten).
- Auswertung: Gesamtstunden pro Projekt für einen wählbaren Zeitraum.
- Stellt dem Add-on eine API für die Projektliste bereit.
- Liest die Termine über die Google Calendar API, um die Stunden zu berechnen.

**Datenfluss**
1. Nutzer pflegt Projekte in der Webapp → gespeichert in der App-DB.
2. Add-on ruft `GET /api/projects` der Webapp ab und zeigt aktive Projekte im Dropdown.
3. Nutzer wählt im Termin ein Projekt → Add-on speichert die **Projekt-ID** am
   Termin (Extended Property) und setzt das **Titel-Präfix** mit dem Projektnamen.
4. Webapp-Auswertung liest die Termine des Hauptkalenders im Zeitraum, liest je
   Termin die Projekt-ID, mappt sie auf das aktuelle Projekt und summiert die Dauer.

> Hinweis: Die eigentlichen „Buchungen" werden **nicht** in der App-DB gehalten,
> sondern live aus dem Kalender berechnet. Die DB hält nur die Projekt-Stammdaten.

## 2. Tech-Stack (Empfehlung, leicht austauschbar)

- **Backend:** Python + **FastAPI**
- **Datenbank:** **SQLite** (eine Datei, als Docker-Volume gemountet)
- **Frontend:** **React (Vite)**, als statisches Build von FastAPI mit ausgeliefert
- **Auslieferung:** ein **Docker-Container** (+ optional `docker-compose.yml`)
- **Google-Zugriff:** OAuth2 (siehe §6)

## 3. Funktionale Anforderungen

### 3.1 Add-on (im Kalender)
- F-01: Beim Öffnen/Bearbeiten eines Termins erscheint ein **Seitenpanel** mit
  **Dropdown der aktiven Projekte** (Quelle: Webapp-API).
- F-02: Projektauswahl ist **optional**. Termine ohne Projekt zählen nicht.
- F-03: Nach Auswahl speichert das Add-on die **Projekt-ID** als privates
  **Extended Property** am Termin und setzt das **Titel-Präfix** im Format
  `[Projektname] Ursprünglicher Titel`.
- F-04: Projektwechsel ersetzt das alte Präfix; Entfernen der Auswahl entfernt das
  Präfix und das Extended Property.
- F-05: **Bestehende Termine** lassen sich nachträglich genauso zuweisen.
- F-06: Einbezogen wird ausschließlich der **Hauptkalender (primary)**.

### 3.2 Webapp – Projektpflege
- F-07: Liste aller Projekte mit Anlegen/Bearbeiten.
- F-08: Pro Projekt: **stabile ID** (intern), **Name**, **Aktiv** (Ja/Nein).
- F-09: Inaktive Projekte erscheinen nicht mehr im Add-on-Dropdown, bleiben aber in
  der Auswertung historisch erhalten.

### 3.3 Webapp – Auswertung
- F-10: Eingabe **Von-Datum** und **Bis-Datum**.
- F-11: Ausgabe **Projektname → Gesamtstunden** im Zeitraum, absteigend sortiert
  (Tabelle; einfache Balkendarstellung optional).
- F-12: Berechnung live beim Laden/Ändern des Zeitraums (Abruf der Calendar API).
- F-13: Stundenbasis = **tatsächliche Termindauer** (Ende − Start).

### 3.4 Webapp – API (für das Add-on)
- F-14: `GET /api/projects` liefert die aktiven Projekte als `{id, name}`.
- F-15: Endpoint ist mit einem **API-Token** (Header) geschützt.

## 4. Datenmodell / Speicherung

- D-01: **Projekt** (DB): `id` (stabil, z. B. UUID/Autoincrement), `name`, `active`.
- D-02: **Zuweisung am Termin:** privates Extended Property `projectId` = Projekt-ID.
  Zusätzlich Titel-Präfix mit dem **Namen** (nur zur Sichtbarkeit).
  → Quelle der Wahrheit für die Auswertung ist die **Projekt-ID** am Termin.
- D-03: Umbenennen eines Projekts ändert nur den Namen; alte Termine bleiben über
  die ID korrekt zugeordnet (Präfix alter Termine bleibt ggf. der alte Name).
- D-04: Auswertung wird live aus dem Kalender berechnet, nicht persistiert.

## 5. Google-Zugriff & Authentifizierung

- AUTH-01: **Konto:** privates Gmail-Konto.
- AUTH-02: **Webapp → Kalender:** OAuth2-Flow, einmaliger Consent im Browser,
  Backend speichert den **Refresh-Token** (in DB oder gemountetem Volume) und holt
  damit Access-Tokens. (Service-Account scheidet bei privatem Gmail aus.)
- AUTH-03: Benötigte Cloud-Einrichtung: eigenes Google-Cloud-Projekt mit
  OAuth-Consent-Screen im **Testmodus** (eigenes Konto als Testnutzer → keine
  Google-Verifizierung nötig).
- AUTH-04: **Scope Webapp:** nur lesend, z. B. `calendar.events.readonly`.
- AUTH-05: **Scope Add-on:** Kalender **lesen/schreiben** (Extended Property + Titel).
- AUTH-06: **Add-on → Webapp:** Schutz per API-Token (in Apps Script + Webapp als
  Secret/Env hinterlegt).
- AUTH-07: **Webapp-UI:** Single-User-Schutz per Passwort aus Umgebungsvariable
  (kein Mehrbenutzer-Login nötig).

## 6. Sonderfälle / Regeln

- R-01: **Ganztägige Termine** werden **ignoriert**.
- R-02: **Serien-/wiederkehrende Termine** zählen **jede Wiederholung einzeln**
  (Auswertung iteriert über die einzelnen Vorkommen im Zeitraum).
- R-03: Termine **ohne Projekt-ID** fließen nicht in die Auswertung ein.
- R-04: Verschobene/umdatierte Termine spiegeln sich automatisch in der nächsten
  Auswertung wider (keine eingefrorenen Werte).
- R-05: Zeitzone gemäß Hauptkalender.
- R-06: Trägt ein Termin eine Projekt-ID, die nicht (mehr) in der DB existiert,
  wird sie unter „Unbekannt/Gelöscht" gruppiert statt verworfen.

## 7. Nicht-Ziele (Out of Scope)

- Mehrbenutzer/Team, geteilte Auswertungen, Rechteverwaltung.
- Mehrere oder alle Kalender (nur Hauptkalender).
- Aufschlüsselung nach Woche/Monat, Stundensätze, Kosten, Rechnungen.
- Start/Stop-Timer, Live-Tracking, mobile App, Drittanbieter-Tracker.
- Pflicht-Projektauswahl (bleibt optional).

## 8. Annahmen (bitte bei Bedarf anpassen)

- A-01: Präfix-Format `[Projektname] `; bei Wechsel/Entfernen wird der Titel bereinigt.
- A-02: Webapp ist aus dem Internet erreichbar (Apps Script muss `GET /api/projects`
  aufrufen können) – z. B. über eine Domain/Reverse Proxy beim Docker-Deployment.
- A-03: Standard-Auswertungszeitraum ist der laufende Monat, bis Von/Bis gesetzt wird.
- A-04: Ein „alles seit Beginn"-Schnellfilter ist nice-to-have, nicht zwingend.

## 9. Akzeptanzkriterien (Definition of Done)

- AK-01: Im Termin-Panel erscheinen nur **aktive** Projekte aus der Webapp.
- AK-02: Nach Auswahl + Speichern trägt der Termintitel das Präfix und die
  Projekt-ID ist am Termin hinterlegt.
- AK-03: Ein bestehender Termin lässt sich nachträglich zuweisen.
- AK-04: Ganztägige Termine erscheinen nie in der Stundensumme.
- AK-05: Eine Serie über z. B. 5 Wochen erzeugt 5 einzeln gezählte Buchungen.
- AK-06: Die Webapp-Auswertung zeigt für Von/Bis korrekte Gesamtstunden je Projekt,
  absteigend sortiert.
- AK-07: Termine ohne Projekt tauchen in keiner Summe auf.
- AK-08: Ein umbenanntes Projekt zeigt in der Auswertung den neuen Namen, ohne
  historische Stunden zu verlieren.
- AK-09: `GET /api/projects` ist ohne gültiges Token nicht abrufbar.

## 10. Deployment- & Umsetzungshinweise für Claude Code

- Ein **Dockerfile** (FastAPI serviert React-Build) und optional **docker-compose.yml**
  (App + gemountetes Volume für SQLite + Refresh-Token).
- **Umgebungsvariablen** dokumentieren: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `ADDON_API_TOKEN`, `APP_PASSWORD`, ggf. `OAUTH_REDIRECT_URI`, `CALENDAR_ID=primary`.
- **Einrichtungsanleitung** mitliefern:
  1. Google-Cloud-Projekt + OAuth-Consent-Screen (Testmodus) + OAuth-Client anlegen.
  2. Webapp deployen, OAuth-Consent einmalig durchlaufen, Refresh-Token speichern.
  3. Apps-Script-Add-on anlegen, `eventOpenTrigger` implementieren, API-URL + Token setzen.
  4. Add-on testweise bereitstellen, Berechtigungen erteilen.
- Apps-Script-Bausteine: Manifest mit `addOns.calendar` (`eventOpenTrigger`,
  ggf. `eventUpdateTrigger`), Advanced Calendar Service für Extended Properties,
  `UrlFetchApp` für den Aufruf der Webapp-API.
- Scopes minimal halten.
