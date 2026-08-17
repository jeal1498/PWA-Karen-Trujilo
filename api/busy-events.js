/**
 * /api/busy-events
 *
 * Lee el Google Calendar de Karen EN VIVO usando la API oficial de Google
 * Calendar (v3) con una cuenta de servicio, y devuelve, en JSON, los
 * horarios ya ocupados dentro de un rango de fechas.
 *
 * Reemplaza al método anterior (dirección secreta en formato iCal / .ics),
 * que pasaba por un caché interno de Google sin intervalo garantizado
 * (community reports: desde minutos hasta 24h) — por eso a veces la app no
 * coincidía con lo que Karen veía en Calendar. Esta API no tiene ese
 * caché: cada consulta lee el calendario directamente.
 *
 * Con singleEvents: true, Google ya entrega cada ocurrencia de un evento
 * recurrente expandida individualmente, incluyendo las que Karen reagendó
 * o canceló "solo esa semana" — no hay que reimplementar a mano RRULE /
 * EXDATE / RECURRENCE-ID como con el método ICS anterior.
 *
 * Contrato (idéntico al que ya usa herramienta-agenda.html):
 *   GET /api/busy-events?start=ISO_STRING&end=ISO_STRING
 *   -> { "busy": [ { "start": ISO_STRING, "end": ISO_STRING }, ... ] }
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN (una sola vez, en Google Cloud + Vercel)
 * ────────────────────────────────────────────────────────────────────────
 * Ver api/README.md para la guía paso a paso completa. En resumen:
 * 1. Crear una cuenta de servicio en Google Cloud Console con la Google
 *    Calendar API habilitada.
 * 2. Karen comparte su Calendar (solo lectura) con el correo de esa
 *    cuenta de servicio.
 * 3. En Vercel, Environment Variables:
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL
 *      GOOGLE_SERVICE_ACCOUNT_KEY
 *      GOOGLE_CALENDAR_ID   (opcional; por defecto karentrujillopsic@gmail.com)
 * ────────────────────────────────────────────────────────────────────────
 */

const { JWT } = require('google-auth-library');

const DEFAULT_CALENDAR_ID = 'karentrujillopsic@gmail.com';

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !key) {
    throw new Error('Faltan las variables de entorno GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY en Vercel.');
  }

  // Si la clave se pegó en Vercel con "\n" literales en vez de saltos de
  // línea reales, los normalizamos.
  const privateKey = key.replace(/\\n/g, '\n');

  const client = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  const { token } = await client.getAccessToken();
  return token;
}

module.exports = async function handler(req, res) {
  // CORS: la herramienta se abre desde el navegador de Karen en otro dominio.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
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
    const token = await getAccessToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      + `?timeMin=${encodeURIComponent(rangeStart.toISOString())}`
      + `&timeMax=${encodeURIComponent(rangeEnd.toISOString())}`
      + `&singleEvents=true&orderBy=startTime`;

    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await apiRes.json();

    if (!apiRes.ok) {
      const message = (data.error && data.error.message) || `Google Calendar API respondió ${apiRes.status}`;
      throw new Error(message);
    }

    const busy = (data.items || [])
      .filter(ev => ev.status !== 'cancelled')
      // Eventos de todo el día vienen con "date" (solo fecha) en vez de
      // "dateTime"; no representan una hora puntual ocupada.
      .filter(ev => ev.start && ev.start.dateTime && ev.end && ev.end.dateTime)
      .map(ev => ({ start: ev.start.dateTime, end: ev.end.dateTime }));

    res.status(200).json({ busy });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
