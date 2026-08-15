/**
 * Sincronización de Google Calendar → herramienta-agenda.html
 *
 * Este script se publica como Web App y expone un único endpoint (doGet)
 * que devuelve, en JSON, los eventos ya agendados en el calendario de Karen
 * dentro de un rango de fechas. La herramienta-agenda.html lo consulta desde
 * window.CalendarSync.fetchBusyEvents(start, end) para restar esas horas
 * de la plantilla base antes de armar el póster.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN
 * ────────────────────────────────────────────────────────────────────────
 * 1. Cambia CALENDAR_ID por el correo del calendario de Karen, o deja
 *    "primary" para usar el calendario principal de la cuenta que despliega
 *    el script.
 * 2. En el editor de Apps Script: Implementar > Nueva implementación >
 *    Aplicación web.
 *      - Ejecutar como: Yo (tu cuenta / la cuenta de Karen)
 *      - Quién tiene acceso: Cualquier usuario (para que la herramienta,
 *        que corre en el navegador de Karen, pueda llamarla sin login)
 * 3. Copia la URL de la implementación (termina en /exec) y pégala en
 *    CALENDAR_SYNC_WEBAPP_URL dentro de herramienta-agenda.html.
 * 4. Cada vez que edites este script y quieras que el cambio aplique,
 *    tienes que crear una NUEVA implementación (o gestionar versiones)
 *    desde el mismo menú.
 * ────────────────────────────────────────────────────────────────────────
 */

const CALENDAR_ID = 'primary';

/**
 * GET /exec?start=ISO_STRING&end=ISO_STRING
 * Respuesta: { "busy": [ { "start": ISO_STRING, "end": ISO_STRING }, ... ] }
 */
function doGet(e) {
  try {
    const startParam = e.parameter.start;
    const endParam = e.parameter.end;

    if (!startParam || !endParam) {
      return jsonResponse({ error: 'Faltan parámetros "start" y "end" (formato ISO 8601).' }, 400);
    }

    const start = new Date(startParam);
    const end = new Date(endParam);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return jsonResponse({ error: 'Los parámetros "start"/"end" no son fechas válidas.' }, 400);
    }

    const calendar = CALENDAR_ID === 'primary'
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(CALENDAR_ID);

    if (!calendar) {
      return jsonResponse({ error: 'No se encontró el calendario configurado (CALENDAR_ID).' }, 500);
    }

    const events = calendar.getEvents(start, end);

    // Solo eventos con horario definido (se excluyen eventos de todo el día,
    // que no representan una hora puntual ocupada dentro de la agenda).
    const busy = events
      .filter(function (ev) { return !ev.isAllDayEvent(); })
      .map(function (ev) {
        return {
          start: ev.getStartTime().toISOString(),
          end: ev.getEndTime().toISOString()
        };
      });

    return jsonResponse({ busy: busy });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
