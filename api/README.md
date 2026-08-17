# Sincronización con Google Calendar (API oficial, en vivo)

`api/busy-events.js` es una función serverless que lee el calendario de
Karen **en tiempo real** usando la API oficial de Google Calendar (v3),
autenticada con una cuenta de servicio. Le devuelve a
`herramienta-agenda.html` los horarios ya ocupados, en JSON.

> Reemplaza al método anterior basado en la "dirección secreta en formato
> iCal" (.ics), que pasaba por un caché de Google sin intervalo
> garantizado y por eso a veces la app mostraba horarios desactualizados
> frente a lo que Karen veía en Calendar.

## 1. Crear la cuenta de servicio en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com)
   (puede ser con cualquier cuenta de Google, no hace falta que sea la de
   Karen — igual que antes, se recomienda una cuenta dedicada a esto).
2. Crea un proyecto nuevo (o usa uno existente) desde el selector de
   proyectos arriba a la izquierda.
3. En el buscador superior, escribe **"Google Calendar API"** → ábrela →
   botón **Habilitar**.
4. Ve a **APIs y servicios → Credenciales** → **+ Crear credenciales** →
   **Cuenta de servicio**.
5. Ponle un nombre (ej. `karen-agenda-reader`) y dale clic a **Crear y
   continuar**. En los siguientes pasos ("Otorgar acceso", "Otorgar a
   usuarios acceso") puedes dejar todo vacío y darle **Listo** — esta
   cuenta no necesita permisos de proyecto, solo va a leer un Calendar
   que se le comparta directamente.
6. En la lista de cuentas de servicio, haz clic en la que acabas de
   crear → pestaña **Claves** → **Agregar clave → Crear clave nueva** →
   formato **JSON** → **Crear**. Se descarga un archivo `.json` — es
   secreto, no lo subas al repo ni lo compartas por chat.

## 2. Compartir el Calendar de Karen con la cuenta de servicio

1. Abre el archivo `.json` descargado y copia el valor del campo
   `"client_email"` (se ve como
   `karen-agenda-reader@tu-proyecto.iam.gserviceaccount.com`).
2. En [Google Calendar](https://calendar.google.com), con la cuenta de
   Karen: pasa el mouse sobre su calendario → tres puntos →
   **Configuración y uso compartido**.
3. En **"Compartir con determinadas personas"** → **Agregar personas** →
   pega ese `client_email` → permiso **"Ver todos los detalles del
   evento"** → **Enviar**.

## 3. Configurar las variables de entorno en Vercel

En [vercel.com](https://vercel.com) → tu proyecto →
**Settings → Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | el `client_email` del paso 1 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | el `private_key` del mismo archivo `.json` (pégalo completo, incluyendo `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`) |
| `GOOGLE_CALENDAR_ID` | opcional — solo si el correo de Karen cambia; por defecto es `karentrujillopsic@gmail.com` |

Si ya existían `ICS_URL` de la configuración anterior, puedes borrarla —
ya no se usa.

Vuelve a desplegar (Vercel suele redesplegar solo al detectar el cambio
de variables; si no, **Deployments → ⋯ → Redeploy**).

## 4. Probar el endpoint

Abre en el navegador (ajustando las fechas):

```
https://<tu-proyecto>.vercel.app/api/busy-events?start=2026-08-17T00:00:00Z&end=2026-08-22T23:59:59Z
```

Debe devolver algo como `{"busy":[{"start":"...","end":"..."}]}` (vacío
si no hay citas en ese rango). Si devuelve un `error`, casi siempre es
alguna de las variables de entorno mal copiada, o falta compartir el
Calendar con la cuenta de servicio.

## 5. Conectarlo a la herramienta

Esto no cambia: `herramienta-agenda.html` ya apunta a
`CALENDAR_SYNC_WEBAPP_URL`, que sigue siendo la misma URL de siempre
(`https://tools-karen-trujilo.vercel.app/api/busy-events`). No hay que
tocar nada ahí.

## Notas

- Con `singleEvents: true`, la API ya expande citas recurrentes y
  resuelve automáticamente las que Karen reagendó o canceló solo una
  semana — no depende de una implementación manual de RRULE.
- El endpoint solo expone `start`/`end` de cada evento — nunca título,
  invitados, ni ningún otro dato del paciente.
- Esta lectura es en vivo: no hay caché de por medio, a diferencia del
  método anterior por `.ics`.
