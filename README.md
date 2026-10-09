# 🗓️ Tools Karen Trujillo — Admin PWA

Herramienta de gestión de agenda diseñada para uso interno de la **Psic. Karen Trujillo**. Permite visualizar, editar y exportar horarios de disponibilidad como póster de alta resolución listo para compartir.

---

## 📁 Estructura del proyecto

```
PWA-Karen-Trujilo/
├── index.html                  # Hub: menú principal con los dos módulos
├── horarios/index.html         # Módulo 1 · Horarios de Atención (póster de disponibilidad)
├── notas/index.html            # Módulo 2 · Generador de Notas de Remisión
├── manifest.json               # Manifest PWA (start_url "/", atajos a ambos módulos)
├── sw.js                       # Service Worker (offline + caché)
├── pwa.js                      # Registro compartido del Service Worker
├── vercel.json                 # Headers de sw.js / manifest
├── icons/                      # Íconos PWA (192, 512, maskable, apple-touch)
├── api/busy-events.js          # Función serverless (Google Calendar)
└── Logo_Karen_Trujillo.webp
```

| Ruta | Vista |
|------|-------|
| `/` | Menú principal: **Horarios de Atención** y **Generar Nota de Remisión** |
| `/horarios/` | Herramienta de agenda y póster (vista anterior de `index.html`) |
| `/notas/` | Formulario y vista previa de la nota de remisión |

---

## 🗓️ Horarios v2 (`/horarios/`)

Misma línea visual que Notas (barra superior, tarjetas, botones y modo oscuro):

- **Semana:** flechas para cambiar de semana, "Ir a hoy", y estado de sincronización con Google Calendar con botón para actualizar.
- **Horarios del póster:** cuadrícula semanal; tocar una hora libre la agrega o quita del póster, tocar el día lo marca como no disponible; también se puede deslizar para cambiar de semana. Leyenda de colores.
- **Póster:** resumen de horas por día y botones *Compartir disponibilidad*, *Descargar* y *Limpiar horas*.
- **Vista previa** del póster 1080×1920 (columna fija en escritorio).

---

## 🧾 Notas de remisión (`/notas/`)

- **Datos:** folio (consecutivo automático `NR-0001`, editable), fecha, paciente (nombre, teléfono, correo, responsable), uno o varios conceptos (servicio, cantidad, precio), método de pago y observaciones.
- **Documento:** vista previa en vivo tamaño carta con logo, importe con letra (MXN) y leyenda de "no es comprobante fiscal".
- **Acciones:** Descargar PDF (html2canvas + jsPDF, carga diferida), Imprimir (CSS de impresión, permite "Guardar como PDF"), Compartir (Web Share con el PDF adjunto; respaldo: descarga + WhatsApp) y Nueva nota.
- **Folios sin repetir:** el folio se asigna solo y está bloqueado (botón *Editar* para cambiarlo a mano). Cada nota tiene un identificador interno; antes de guardar se relee el historial y, si el folio ya pertenece a otra nota, una nota nueva recibe el siguiente folio libre y una nota existente no se guarda. Los folios de notas eliminadas no se reutilizan. Si hay otra pestaña abierta, su nota nueva se actualiza al siguiente folio.
- **Respaldo:** *Descargar respaldo* genera un `.json` con notas, folio siguiente y pacientes; *Restaurar* lo combina sin borrar nada (si un folio choca con otra nota, la restaurada recibe el sufijo `-R`); *Exportar a Excel* genera un `.csv`. La tarjeta avisa si hay notas sin respaldar por más de 7 días.
- **Historial:** las notas guardadas quedan en el dispositivo y pueden reabrirse o eliminarse.
- **Datos del consultorio:** fijos y no editables (constante `EMISOR` en `notas/index.html`), tomados de psicologakarentrujillo.com.mx: cédula 11009616, teléfono, correo, sitio web y dirección del consultorio en Cancún.
- **Catálogo con precios:** Terapia psicológica $650 · Terapia infantil $650 · Primera sesión $800 · Primera consulta de valoración $1,000 · Valoración TDAH $8,300 · Valoración Autismo $8,500 · Valoración Completa TDAH y Autismo $10,500 · Valoración Personalizada (precio abierto). Se editan en `SERVICIOS` dentro de `notas/index.html`.
- **Pacientes frecuentes:** al escribir el nombre se sugieren pacientes anteriores y se completan teléfono, correo y tutor.
- **Descuentos:** por porcentaje o monto fijo; la nota muestra subtotal, descuento y total.
- **Estado de pago:** Pagada, Anticipo (con monto) o Pendiente; la nota muestra lo pagado y el saldo pendiente.
- **Paquetes de sesiones:** "Sesión N de M" con costo del paquete, abonado a la fecha y saldo. Al elegir un paciente con paquete sin terminar, la nueva nota lo continúa con la siguiente sesión.

| Key `localStorage` | Contenido |
|-----|-----------|
| `kt_notas_historial` | Notas emitidas |
| `kt_notas_folio_siguiente` | Siguiente folio |
| `kt_notas_borrador` | Nota en edición |
| `kt_notas_pacientes` | Pacientes frecuentes |
| `kt_notas_ultimo_respaldo` | Fecha del último respaldo |

---

## 📲 PWA

- `manifest.json` con `scope: "/"`, `start_url: "/"` y **atajos** (mantener presionado el ícono) a `/horarios/` y `/notas/`.
- `sw.js` precarga las tres vistas; navegaciones *network-first* (siempre la versión más reciente con red, caché sin red); estáticos y CDNs *stale-while-revalidate*; `/api/*` nunca se cachea.
- Al publicar cambios grandes, sube `VERSION` en `sw.js` para renovar la caché.

---

## ⚙️ Funcionamiento general

La app es **HTML estático sin framework ni build step**. `index.html` es el hub y cada módulo vive en su propia carpeta (`/horarios/`, `/notas/`).

### Flujo de uso

1. **Seleccionar rango de fechas** → la fecha de inicio es libre; la fecha fin se ajusta automáticamente al **sábado de esa misma semana** (los domingos no se contemplan).
2. **Sincronizar Google Calendar** (opcional) → jalona los eventos del rango desde un Google Apps Script.
3. **Editar manualmente** → agregar, eliminar o ajustar horas por día.
4. **Generar y compartir** → exporta el póster como PNG de 1080×1920px.

---

## 🕐 Horario base predeterminado

Al seleccionar cualquier rango, cada día se pre-llena automáticamente con el siguiente horario. Las sesiones son de **50 minutos** con **10 minutos de break** entre cada una (intervalo total: 60 min).

| Día | Horarios |
|-----|----------|
| Lunes y Martes | 10:00 AM, 11:00 AM, 12:00 PM, 1:00 PM, 2:00 PM, 6:00 PM |
| Miércoles y Jueves | 9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM, 5:00 PM, 6:00 PM |
| Viernes | 10:00 AM, 11:00 AM, 12:00 PM, 1:00 PM |
| Sábado | 10:00 AM, 11:00 AM, 12:00 PM, 4:00 PM, 5:00 PM, 6:00 PM |
| Domingo | — (descanso, no aparece) |

> Si un día ya tiene datos guardados en `localStorage`, el horario base **no los sobreescribe**.

---

## ✏️ Edición manual

### Eliminar una hora
Presionar la **×** roja sobre cualquier chip.

### Agregar una hora
Presionar el botón **+** en la esquina del día. Acepta formato 12h (`3:00 PM`) o 24h (`15:00`).

### Editar una hora existente
Tocar el chip abre un selector de hora nativo. Al confirmar aparece un modal con dos opciones:

| Opción | Comportamiento |
|--------|----------------|
| **SÍ, RECORRER TODO** | Propaga el mismo desplazamiento a todas las citas posteriores del día |
| **NO, SOLO AJUSTAR SIGUIENTE** | Solo mueve la cita inmediatamente siguiente a `hora editada + 60 min` |

**Ejemplo:** Si se cambia `6:00 PM` → `6:30 PM` y se elige "NO":
- `6:30 PM` (editada)
- `7:30 PM` (siguiente ajustada automáticamente)

---

## 🔄 Sincronización con Google Calendar

Conectada vía **Google Apps Script**. Al sincronizar:
- Se sobreescriben todos los datos del rango actual.
- Los horarios importados se **redondean a la hora entera** (≥30 min sube al siguiente, <30 min trunca).
- Los duplicados se eliminan automáticamente.

La URL del script está hardcodeada en `horarios/index.html` (vía `/api/busy-events`):
```js
const API = "https://script.google.com/macros/s/AKfycb.../exec";
```

---

## 💾 Persistencia

Toda la información se guarda en `localStorage` del navegador:

| Key | Contenido |
|-----|-----------|
| `karen_start` | Fecha de inicio del rango |
| `karen_end` | Fecha fin del rango |
| `karen_notes` | Notas del póster |
| `karen_agenda` | Objeto JSON con los horarios por fecha (`YYYY-MM-DD`) |

> Al usar **Resetear Todo** se limpia el `localStorage` completo.

---

## 🖼️ Exportación del póster

El póster se genera con `html2canvas` a **1080×1920px** (formato Stories/vertical) y se descarga como `Agenda_Karen_Trujillo.png`. Incluye:
- Rango de fechas
- Grilla de días con sus horarios disponibles
- Notas personalizadas
- Watermark con el logo al 10% de opacidad

---

## 🧰 Tech stack

| Tecnología | Uso |
|------------|-----|
| HTML + CSS vanilla | Estructura y estilos |
| Tailwind CDN | Utilidades CSS en `index.html` |
| Google Fonts (Montserrat + Playfair Display) | Tipografía |
| Font Awesome 6 | Iconos |
| html2canvas 1.4.1 | Generación del PNG |
| Google Apps Script | Backend de Google Calendar |
| localStorage | Persistencia local |

Sin dependencias npm. Sin build step. Sin framework.

---

## 🚀 Deploy

El proyecto está desplegado en **Vercel** bajo el dominio del sitio de Karen Trujillo. Al ser HTML estático puro, cualquier hosting de archivos estáticos funciona (Vercel, Netlify, GitHub Pages, etc.).
