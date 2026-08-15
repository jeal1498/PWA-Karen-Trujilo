# Sincronización con Google Calendar

`Code.gs` es el script que hay que pegar en Google Apps Script para que
`herramienta-agenda.html` pueda leer los horarios ya ocupados de Karen.

## Despliegue

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra el contenido por defecto y pega el contenido de `Code.gs`.
3. Ajusta `CALENDAR_ID` si el calendario de Karen no es el principal de la
   cuenta (déjalo en `'primary'` si sí lo es).
4. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Copia la URL que termina en `/exec`.
6. En `herramienta-agenda.html`, busca la constante
   `CALENDAR_SYNC_WEBAPP_URL` y pega ahí la URL.
7. Sube el cambio (commit + push). Listo: la herramienta empezará a restar
   automáticamente las horas ya ocupadas en Calendar al armar el póster.

## Notas

- Cualquier edición futura del script requiere crear una **nueva
  implementación** (o gestionar versiones) para que el cambio se refleje
  en la URL ya publicada.
- El endpoint solo devuelve `start`/`end` de cada evento (ninguna otra
  información del evento, como título o invitados), para no exponer datos
  sensibles de pacientes en el navegador.
