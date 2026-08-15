# Sincronización con Google Calendar

`Code.gs` es el script que hay que pegar en Google Apps Script para que
`herramienta-agenda.html` pueda leer los horarios ya ocupados de Karen.

## Por qué una cuenta secundaria

El Drive de Karen no tiene espacio disponible, y Apps Script necesita
guardar el proyecto ahí para poder desplegarlo — por eso las
implementaciones desde su cuenta fallaban. La solución: alojar el script
en una cuenta de Google **secundaria y vacía**, y que Karen le comparta
su Calendar (solo lectura) a esa cuenta.

## Despliegue

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**,
   con sesión iniciada en la **cuenta secundaria** (no la de Karen).
2. Borra el contenido por defecto y pega el contenido de `Code.gs`.
3. `CALENDAR_ID` ya está puesto al correo real de Karen
   (`karentrujillopsic@gmail.com`) — es el calendario que se lee, no el
   de la cuenta que ejecuta el script.
4. Antes de probarlo, Karen debe compartir su Calendar con la cuenta
   secundaria: Google Calendar → Configuración → su calendario →
   **Compartir con determinadas personas** → agregar el correo
   secundario con permiso **"Ver todos los detalles del evento"**.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo** (la cuenta secundaria)
   - Quién tiene acceso: **Cualquier usuario**
6. Copia la URL que termina en `/exec`.
7. En `herramienta-agenda.html`, busca la constante
   `CALENDAR_SYNC_WEBAPP_URL` y pega ahí la URL.
8. Sube el cambio (commit + push). Listo: la herramienta empezará a restar
   automáticamente las horas ya ocupadas en Calendar al armar el póster.

## Notas

- Cualquier edición futura del script requiere crear una **nueva
  implementación** (o gestionar versiones) para que el cambio se refleje
  en la URL ya publicada.
- El endpoint solo devuelve `start`/`end` de cada evento (ninguna otra
  información del evento, como título o invitados), para no exponer datos
  sensibles de pacientes en el navegador.
