/* Respaldo de las notas de remisión en esta hoja de Google (Extensiones → Apps Script).
   1) Cambia CLAVE por una palabra larga que solo tú sepas (la misma va en la app).
   2) Implementar → Nueva implementación → Aplicación web:
      Ejecutar como: Yo · Quién tiene acceso: Cualquier persona. Copia la URL que termina en /exec.
   3) Si después cambias el código: Implementar → Gestionar implementaciones → editar → Nueva versión. */
const CLAVE = 'CAMBIA-ESTA-CLAVE';
const PEDAZO = 40000; // una celda admite ~50 000 caracteres

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function escribir(ss, t) {
  const sh = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
  sh.clearContents();
  const filas = [t.headers].concat(t.rows || []);
  sh.getRange(1, 1, filas.length, t.headers.length).setValues(filas);
  sh.getRange(1, 1, 1, t.headers.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== CLAVE) return salida({ ok: false, error: 'Clave incorrecta' });
    lock.waitLock(20000); // dos dispositivos a la vez no se pisan
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    (b.tables || []).forEach(function (t) { escribir(ss, t); });
    const raw = b.raw || '';
    const sh = ss.getSheetByName('_respaldo') || ss.insertSheet('_respaldo');
    sh.clearContents();
    const partes = [];
    for (let i = 0; i < raw.length; i += PEDAZO) partes.push([raw.slice(i, i + PEDAZO)]);
    if (partes.length) {
      const rango = sh.getRange(1, 1, partes.length, 1);
      rango.setNumberFormat('@');
      rango.setValues(partes);
    }
    sh.hideSheet();
    ['Hoja 1', 'Sheet1'].forEach(function (n) {
      const s = ss.getSheetByName(n);
      if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
    });
    return salida({ ok: true });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* no se tenía el candado */ }
  }
}

/* La app lo usa para leer la última copia (folio siguiente y notas) y para probar la conexión. */
function doGet(e) {
  if (((e && e.parameter) || {}).token !== CLAVE) return salida({ ok: false, error: 'Clave incorrecta' });
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('_respaldo');
  const raw = sh && sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; }).join('') : '';
  return salida({ ok: true, data: raw ? JSON.parse(raw) : null });
}
