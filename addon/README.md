# Calendar Add-on (Google Apps Script)

Dieses Add-on zeigt im Termin-Seitenpanel ein Dropdown der **aktiven Projekte**
(geladen aus der Webapp) und schreibt die Auswahl als privates Extended Property
`projectId` an den Termin – zusätzlich wird der Titel mit `[Projektname] ` versehen.

## Dateien
- `appsscript.json` – Manifest (Calendar-Add-on, Trigger, Scopes, Advanced Calendar Service)
- `Code.gs` – Logik (Card-Aufbau, Speichern/Entfernen, API-Aufruf)

## Einrichtung

1. **Apps-Script-Projekt anlegen**
   - https://script.google.com → *Neues Projekt*.
   - Inhalt von `Code.gs` in die Datei `Code.gs` kopieren.
   - In den Projekteinstellungen *„appsscript.json“-Manifest anzeigen* aktivieren
     und den Inhalt von `appsscript.json` übernehmen.

2. **`urlFetchWhitelist` anpassen**
   - In `appsscript.json` `https://DEINE-WEBAPP-DOMAIN/` durch deine echte
     Webapp-Domain ersetzen (mit abschließendem `/`).

3. **Konfiguration setzen**
   - Funktion `setupConfig()` öffnen, `WEBAPP_URL` und `ADDON_API_TOKEN` eintragen
     (`ADDON_API_TOKEN` muss identisch mit dem der Webapp sein), einmal ausführen.
   - Alternativ: *Projekteinstellungen → Script-Eigenschaften* manuell setzen.

4. **Advanced Calendar Service**
   - Ist über `appsscript.json` aktiviert; beim ersten Lauf ggf. *Dienste → Calendar API*
     bestätigen.

5. **Testweise bereitstellen**
   - *Bereitstellen → Bereitstellungen testen → Installieren*.
   - Google Kalender öffnen, einen Termin anklicken → das Add-on erscheint rechts.
   - Beim ersten Aufruf die angeforderten Berechtigungen erteilen.

## Verhalten
- Projektauswahl ist **optional** (F-02); „— Kein Projekt —" entfernt Zuweisung + Präfix.
- Projektwechsel ersetzt das alte Präfix (`stripPrefix_`), bestehende Termine lassen
  sich nachträglich zuweisen (F-05).
- Nur der **Hauptkalender** ist relevant für die spätere Auswertung (F-06).
