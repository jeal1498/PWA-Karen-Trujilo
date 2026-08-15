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
 * CONFIGURACIÓN (cuenta secundaria, sin usar el Drive de Karen)
 * ────────────────────────────────────────────────────────────────────────
 * Este script está pensado para desplegarse desde una cuenta de Google
 * SECUNDARIA (no la de Karen), porque el Drive de Karen no tiene espacio
 * disponible y Apps Script necesita poder guardar el proyecto ahí.
 *
 * 1. Karen comparte su Google Calendar con la cuenta secundaria (Calendar
 *    > Configuración > su calendario > "Compartir con determinadas
 *    personas" > agregar el correo secundario con permiso "Ver todos los
 *    detalles del evento").
 * 2. CALENDAR_ID ya está puesto al correo real de Karen
 *    (karentrujillopsic@gmail.com) — es el calendario que se va a leer,
 *    no el de la cuenta que ejecuta el script.
 * 3. En el editor de Apps Script (con sesión iniciada en la cuenta
 *    SECUNDARIA): Implementar > Nueva implementación > Aplicación web.
 *      - Ejecutar como: Yo (la cuenta secundaria)
 *      - Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL de la implementación (termina en /exec) y pégala en
 *    CALENDAR_SYNC_WEBAPP_URL dentro de herramienta-agenda.html.
 * 5. Cada vez que edites este script y quieras que el cambio aplique,
 *    tienes que crear una NUEVA implementación (o gestionar versiones)
 *    desde el mismo menú.
 * ────────────────────────────────────────────────────────────────────────
 */

const CALENDAR_ID = 'karentrujillopsic@gmail.com';

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
