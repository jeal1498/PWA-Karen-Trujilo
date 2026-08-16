# Sincronización con Google Calendar (vía Vercel)

`api/busy-events.js` es una función serverless que lee el calendario de
Karen a partir de su **dirección secreta en formato iCal** y le devuelve
a `herramienta-agenda.html` los horarios ya ocupados, en JSON. No depende
de espacio en Google Drive ni de Apps Script.

## 1. Obtener la dirección secreta iCal de Karen

1. Abre [Google Calendar](https://calendar.google.com) con la cuenta de
   Karen.
2. En la columna izquierda, pasa el mouse sobre su calendario → tres
   puntos → **Configuración y uso compartido**.
3. Baja hasta **"Integrar calendario"**.
4. Copia el enlace de **"Dirección secreta en formato iCal"**.
   - Es secreta: cualquiera con ese link puede ver el calendario
     completo. No la subas al repo ni la compartas por chat.

## 2. Desplegar en Vercel

1. En [vercel.com](https://vercel.com), **Add New → Project** y elige el
   repo `jeal1498/PWA-Karen-Trujilo`.
2. Antes de darle *Deploy*, entra a **Environment Variables** y agrega:
   - `ICS_URL` = (la dirección secreta que copiaste en el paso 1)
3. Dale *Deploy*. Vercel detecta `api/busy-events.js` automáticamente y
   lo publica como endpoint.
4. Cuando termine, tu endpoint queda en:
   `https://<tu-proyecto>.vercel.app/api/busy-events`

## 3. Probar el endpoint

Abre en el navegador (ajustando las fechas):

```
https://<tu-proyecto>.vercel.app/api/busy-events?start=2026-08-17T00:00:00Z&end=2026-08-22T23:59:59Z
```

Debe devolver algo como `{"busy":[{"start":"...","end":"..."}]}` (vacío
si no hay citas en ese rango).

## 4. Conectarlo a la herramienta

En `herramienta-agenda.html`, busca la constante
`CALENDAR_SYNC_WEBAPP_URL` y pega ahí:

```
https://<tu-proyecto>.vercel.app/api/busy-events
```

Sube el cambio (commit + push) y la herramienta empezará a restar
automáticamente las horas ya ocupadas en Calendar al armar el póster.

## Notas

- Soporta eventos recurrentes (citas semanales fijas), no solo eventos
  sueltos.
- El endpoint solo expone `start`/`end` de cada evento — nunca título,
  invitados, ni ningún otro dato del paciente.
- Cualquier cambio a `api/busy-events.js` se publica automáticamente al
  hacer push a `main` (Vercel redepliega solo).
