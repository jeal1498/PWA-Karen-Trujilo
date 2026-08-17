/**
 * /api/busy-events
 *
 * Reemplazo del Apps Script: lee el calendario de Karen a partir de su
 * "dirección secreta en formato iCal" (no depende de espacio en Google
 * Drive, ni de OAuth, ni de Apps Script) y devuelve, en JSON, los eventos
 * ocupados dentro de un rango de fechas. Expande eventos recurrentes
 * (RRULE) correctamente usando node-ical.
 *
 * Contrato (idéntico al que ya usa herramienta-agenda.html):
 *   GET /api/busy-events?start=ISO_STRING&end=ISO_STRING
 *   -> { "busy": [ { "start": ISO_STRING, "end": ISO_STRING }, ... ] }
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN (una sola vez, en Vercel, NO en este archivo)
 * ────────────────────────────────────────────────────────────────────────
 * 1. En Google Calendar: Configuración del calendario de Karen >
 *    "Integrar calendario" > copiar "Dirección secreta en formato iCal".
 * 2. En Vercel: Project Settings > Environment Variables > agrega
 *    ICS_URL = (esa dirección secreta), para Production.
 * 3. Nunca pegues esa URL directo en el código ni la subas al repo: es
 *    secreta, cualquiera con ella puede leer el calendario completo.
 * ────────────────────────────────────────────────────────────────────────
 */

const ical = require('node-ical');

module.exports = async function handler(req, res) {
  // CORS: la herramienta se abre desde el navegador de Karen en otro dominio.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const icsUrl = process.env.ICS_URL;
  if (!icsUrl) {
    res.status(500).json({ error: 'Falta configurar la variable de entorno ICS_URL en Vercel.' });
    return;
  }

  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ error: 'Faltan parámetros "start" y "end" (formato ISO 8601).' });
    return;
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);
  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    res.status(400).json({ error: 'Los parámetros "start"/"end" no son fechas válidas.' });
    return;
  }

  try {
    const data = await ical.async.fromURL(icsUrl);
    const busy = [];

    for (const key in data) {
      const ev = data[key];
      if (ev.type !== 'VEVENT') continue;

      // Eventos de todo el día no representan una hora puntual ocupada.
      const isAllDay = ev.datetype === 'date';
      if (isAllDay) continue;

      if (ev.rrule) {
        // Evento recurrente: expandir solo las ocurrencias dentro del rango.
        // OJO: rrule.between() NO excluye las excepciones (EXDATE) ni aplica
        // las citas reagendadas individualmente (RECURRENCE-ID) — sigue
        // devolviendo la fecha/hora del patrón original tal cual. Hay que
        // resolverlas a mano contra ev.exdate / ev.recurrences, que
        // node-ical indexa por la fecha local (America/Mexico_City) de la
        // ocurrencia original dentro de la serie.
        const occurrences = ev.rrule.between(rangeStart, rangeEnd, true);
        const durationMs = ev.end.getTime() - ev.start.getTime();

        for (const occStart of occurrences) {
          const localDateKey = occStart.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

          // Cancelada solo esa semana ("eliminar solo este evento" en Calendar).
          if (ev.exdate && ev.exdate[localDateKey]) continue;

          // Reagendada solo esa semana ("este evento" al mover la cita):
          // usar el horario real de la excepción en vez del patrón original.
          const override = ev.recurrences && ev.recurrences[localDateKey];
          if (override) {
            if (override.status === 'CANCELLED') continue;
            busy.push({ start: override.start.toISOString(), end: override.end.toISOString() });
            continue;
          }

          const occEnd = new Date(occStart.getTime() + durationMs);
          busy.push({ start: occStart.toISOString(), end: occEnd.toISOString() });
        }
      } else {
        const evStart = ev.start;
        const evEnd = ev.end;
        if (evStart < rangeEnd && evEnd > rangeStart) {
          busy.push({ start: evStart.toISOString(), end: evEnd.toISOString() });
        }
      }
    }

    res.status(200).json({ busy });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
