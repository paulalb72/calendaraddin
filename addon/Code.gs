/**
 * Projektzeit – Google Calendar Add-on (Apps Script)
 *
 * Zeigt beim Öffnen eines Termins ein Seitenpanel mit einem Dropdown der aktiven
 * Projekte (Quelle: Webapp-API) und schreibt die Auswahl als privates Extended
 * Property `projectId` an den Termin. Zusätzlich wird der Titel mit dem
 * Präfix `[Projektname] ` versehen.
 *
 * Konfiguration (einmalig): Script Properties setzen, entweder über
 *   Projekt-Einstellungen > Script-Eigenschaften, oder per setupConfig() unten.
 *   - WEBAPP_URL      z. B. https://deine-domain.tld   (ohne abschließenden /)
 *   - ADDON_API_TOKEN dasselbe Token wie ADDON_API_TOKEN der Webapp
 */

var PROP_PROJECT_ID = 'projectId'; // privates Extended Property am Termin
var PREFIX_RE = /^\[[^\]]*\]\s*/; // erkennt ein vorhandenes "[...] "-Präfix

/** Einmalige Konfigurationshilfe – Werte eintragen und einmal ausführen. */
function setupConfig() {
  PropertiesService.getScriptProperties().setProperties({
    WEBAPP_URL: 'https://timetracker.makemyki.de',
    ADDON_API_TOKEN: 'DEIN_ADDON_API_TOKEN' // <- denselben Wert wie in Coolify eintragen
  });
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    url: (props.getProperty('WEBAPP_URL') || '').replace(/\/+$/, ''),
    token: props.getProperty('ADDON_API_TOKEN') || ''
  };
}

/* -------------------------------------------------------------------------- */
/* UI-Aufbau                                                                  */
/* -------------------------------------------------------------------------- */

/** Start-Karte: erscheint, wenn man das Add-on-Icon ohne offenen Termin anklickt.
 *  Sorgt dafür, dass das Icon zuverlässig in der Seitenleiste auftaucht. */
function onHomepage(e) {
  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        'Öffne einen Termin im Kalender, um ihm ein Projekt zuzuweisen.'
      )
    );
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Projektzeit'))
    .addSection(section)
    .build();
}

/** Trigger beim Öffnen eines Termins (eventOpenTrigger). */
function onCalendarEventOpen(e) {
  return buildEventCard_(e);
}

function buildEventCard_(e) {
  var calendarId = e && e.calendar ? e.calendar.calendarId : 'primary';
  var eventId = e && e.calendar ? e.calendar.id : null;

  var section = CardService.newCardSection();

  if (!eventId) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        'Bitte den Termin zuerst speichern, dann erscheint hier die Projektauswahl.'
      )
    );
    return buildCard_(section);
  }

  var projects;
  try {
    projects = fetchProjects_();
  } catch (err) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '⚠️ Projektliste konnte nicht geladen werden: ' + err.message
      )
    );
    return buildCard_(section);
  }

  var currentProjectId = getEventProjectId_(calendarId, eventId);

  var dropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Projekt')
    .setFieldName('projectId')
    .addItem('— Kein Projekt —', '', currentProjectId === '');

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    dropdown.addItem(p.name, p.id, p.id === currentProjectId);
  }
  // Falls der Termin eine ID trägt, die nicht (mehr) aktiv ist: trotzdem anzeigen.
  if (currentProjectId && !projects.some(function (p) { return p.id === currentProjectId; })) {
    dropdown.addItem('(zugewiesenes, inaktives Projekt)', currentProjectId, true);
  }

  section.addWidget(dropdown);

  var saveAction = CardService.newAction()
    .setFunctionName('onSaveProject')
    .setParameters({ calendarId: calendarId, eventId: eventId });
  var clearAction = CardService.newAction()
    .setFunctionName('onClearProject')
    .setParameters({ calendarId: calendarId, eventId: eventId });

  var buttons = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Speichern')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(saveAction)
    )
    .addButton(
      CardService.newTextButton()
        .setText('Entfernen')
        .setOnClickAction(clearAction)
    );
  section.addWidget(buttons);

  section.addWidget(
    CardService.newTextParagraph().setText(
      '<font color="#6b7280">Die Auswahl ist optional. Termine ohne Projekt ' +
        'zählen nicht in der Auswertung.</font>'
    )
  );

  return buildCard_(section);
}

function buildCard_(section) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Projektzeit'))
    .addSection(section)
    .build();
}

/* -------------------------------------------------------------------------- */
/* Aktionen                                                                   */
/* -------------------------------------------------------------------------- */

function onSaveProject(e) {
  var calendarId = e.parameters.calendarId;
  var eventId = e.parameters.eventId;
  var selected = (e.formInput && e.formInput.projectId) || '';

  if (!selected) {
    return onClearProject(e);
  }

  var projects = fetchProjects_();
  var match = null;
  for (var i = 0; i < projects.length; i++) {
    if (projects[i].id === selected) { match = projects[i]; break; }
  }
  var projectName = match ? match.name : null;

  setEventProject_(calendarId, eventId, selected, projectName);

  return notify_(
    projectName
      ? 'Projekt „' + projectName + '" zugewiesen.'
      : 'Projekt-ID gespeichert.'
  );
}

function onClearProject(e) {
  var calendarId = e.parameters.calendarId;
  var eventId = e.parameters.eventId;
  clearEventProject_(calendarId, eventId);
  return notify_('Projektzuweisung entfernt.');
}

function notify_(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

/* -------------------------------------------------------------------------- */
/* Calendar-Zugriff (Advanced Calendar Service)                               */
/* -------------------------------------------------------------------------- */

function getEventProjectId_(calendarId, eventId) {
  try {
    var ev = Calendar.Events.get(calendarId, eventId);
    if (ev.extendedProperties && ev.extendedProperties.private &&
        ev.extendedProperties.private[PROP_PROJECT_ID]) {
      return ev.extendedProperties.private[PROP_PROJECT_ID];
    }
  } catch (err) {
    // Termin evtl. neu/noch nicht gespeichert.
  }
  return '';
}

/** Setzt projectId + Titel-Präfix (F-03/F-04). */
function setEventProject_(calendarId, eventId, projectId, projectName) {
  var ev = Calendar.Events.get(calendarId, eventId);
  var baseTitle = stripPrefix_(ev.summary || '');
  var newTitle = projectName ? '[' + projectName + '] ' + baseTitle : baseTitle;

  var patch = {
    summary: newTitle,
    extendedProperties: { private: {} }
  };
  patch.extendedProperties.private[PROP_PROJECT_ID] = projectId;

  Calendar.Events.patch(patch, calendarId, eventId);
}

/** Entfernt projectId + Präfix (F-04). */
function clearEventProject_(calendarId, eventId) {
  var ev = Calendar.Events.get(calendarId, eventId);
  var baseTitle = stripPrefix_(ev.summary || '');

  var patch = {
    summary: baseTitle,
    extendedProperties: { private: {} }
  };
  // Null entfernt das Property beim Patch.
  patch.extendedProperties.private[PROP_PROJECT_ID] = null;

  Calendar.Events.patch(patch, calendarId, eventId);
}

function stripPrefix_(title) {
  return title.replace(PREFIX_RE, '');
}

/* -------------------------------------------------------------------------- */
/* Webapp-API                                                                 */
/* -------------------------------------------------------------------------- */

/** GET /api/projects -> [{id, name}] (Token-geschützt). */
function fetchProjects_() {
  var cfg = getConfig_();
  if (!cfg.url || !cfg.token) {
    throw new Error('WEBAPP_URL/ADDON_API_TOKEN nicht konfiguriert (setupConfig).');
  }
  var res = UrlFetchApp.fetch(cfg.url + '/api/projects', {
    method: 'get',
    headers: { 'X-API-Token': cfg.token },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('HTTP ' + code + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}
