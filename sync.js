/* Sincronización de las notas con la hoja de Google de Karen (Apps Script, ver apps-script/Code.gs).
   Misma idea que sync.js de PWA-Finance: la URL y la clave viven en este dispositivo y «auto» sube sola después de
   cada cambio. Además, antes de subir se lee la hoja y se combina sin borrar nada, para que el folio siguiente salga
   de ahí y dos dispositivos no se pisen.
   Sin DOM: lo usan /sincronizar/ (conexión), /notas/ (folio y subida automática) y el menú. */
(function () {
    'use strict';

    const K = {
        conexion: 'kt_notas_sheets',
        historial: 'kt_notas_historial',
        siguiente: 'kt_notas_folio_siguiente',
        pacientes: 'kt_notas_pacientes',
        eliminadas: 'kt_notas_eliminadas'
    };
    const APP = 'karen-trujillo-notas';
    const PREFIX = 'NR-';
    const DIGITS = 4;
    const OTRO = '__otro__';
    const HISTORY_LIMIT = 5000;
    const DEBOUNCE_MS = 4000;
    const STALE_MS = 30000;
    const GATE_MS = 6000;

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    /* ---------- Conexión ---------- */
    function getCfg() {
        const c = read(K.conexion, {});
        return c && typeof c === 'object' ? c : {};
    }
    function replaceCfg(cfg) {
        write(K.conexion, cfg);
        return cfg;
    }
    function setCfg(patch) {
        return replaceCfg(Object.assign(getCfg(), patch));
    }
    function connection() {
        const c = getCfg();
        return c.url && c.token ? { url: c.url, token: c.token } : null;
    }

    const NET_HELP = 'Google no respondió. Revisa que la implementación tenga acceso «Cualquier persona», que la URL termine en /exec y que la clave sea la misma del script.';
    async function call(url, opts) {
        let res;
        try { res = await fetch(url, opts); } catch (e) { throw new Error(navigator.onLine === false ? 'Sin conexión a internet' : NET_HELP); }
        try { return await res.json(); } catch (e) { throw new Error(NET_HELP); }
    }

    /* Envía las pestañas legibles y la copia exacta. Body como text/plain para que el navegador no haga preflight. */
    async function push(tables, raw) {
        const c = connection();
        if (!c) throw new Error('Primero conecta tu hoja');
        const out = await call(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, tables, raw }) });
        if (!out.ok) throw new Error(out.error || 'Error en la hoja');
        setCfg({ last: Date.now(), error: '' });
    }

    /* Trae la última copia exacta de la hoja (null si aún no hay). */
    async function pull() {
        const c = connection();
        if (!c) throw new Error('Primero conecta tu hoja');
        const out = await call(`${c.url}${c.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(c.token)}`);
        if (!out.ok) throw new Error(out.error || 'Error en la hoja');
        return out.data;
    }

    /* ---------- Folios y datos ---------- */
    const formatFolio = n => PREFIX + String(n).padStart(DIGITS, '0');
    function folioNumber(folio) {
        const m = /(\d+)\s*$/.exec(folio || '');
        return m ? parseInt(m[1], 10) : 0;
    }
    const sameFolio = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
    function uniqueFolio(folio, taken) {
        if (!taken.has(folio.toUpperCase())) return folio;
        let i = 1;
        let candidate;
        do {
            candidate = `${folio}-R${i > 1 ? i : ''}`;
            i++;
        } while (taken.has(candidate.toUpperCase()));
        return candidate;
    }
    function newUid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function historial() {
        const raw = read(K.historial, []);
        const list = (Array.isArray(raw) ? raw : []).filter(h => h && typeof h === 'object');
        if (list.some(h => !h.uid)) {
            list.forEach(h => { if (!h.uid) h.uid = newUid(); });
            write(K.historial, list);
        }
        return list;
    }
    function nextFolio(list) {
        const stored = parseInt(read(K.siguiente, 1), 10) || 1;
        return Math.max(stored, list.reduce((max, n) => Math.max(max, folioNumber(n.folio)), 0) + 1);
    }

    /* Notas eliminadas: se recuerdan para que otro dispositivo no las vuelva a subir. */
    function tombstones() {
        const t = read(K.eliminadas, {});
        return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
    }
    function tombstoneAdd(rec) {
        const t = tombstones();
        t[rec.uid] = { folio: rec.folio, at: new Date().toISOString() };
        write(K.eliminadas, t);
    }
    function tombstoneClear(uid) {
        const t = tombstones();
        if (!t[uid]) return;
        delete t[uid];
        write(K.eliminadas, t);
    }

    /* Copia exacta (la misma que «Descargar respaldo»). */
    function copia() {
        const list = historial();
        return {
            app: APP,
            version: 1,
            exportado: new Date().toISOString(),
            folioSiguiente: nextFolio(list),
            historial: list,
            pacientes: read(K.pacientes, {}),
            eliminadas: tombstones()
        };
    }

    /* Un texto que empieza con "=", "+", "-" o "@" Sheets lo tomaría como fórmula. */
    const cell = v => (v == null ? '' : typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v);
    const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

    function tablas(data) {
        const notas = data.historial.slice().sort((a, b) => folioNumber(a.folio) - folioNumber(b.folio));
        return [
            {
                name: 'Notas · Remisiones',
                headers: ['Folio', 'Fecha', 'Paciente', 'Teléfono', 'Correo', 'Responsable', 'Conceptos', 'Subtotal', 'Descuento',
                    'Total', 'Estado', 'Pagado', 'Saldo', 'Método de pago', 'Paquete', 'Observaciones'],
                rows: notas.map(n => {
                    const items = Array.isArray(n.items) ? n.items : [];
                    const subtotal = items.reduce((sum, it) => sum + (parseInt(it.cantidad, 10) || 0) * num(it.precio), 0);
                    const total = n.total != null ? n.total : subtotal;
                    return [
                        n.folio, n.fecha, n.paciente, n.telefono, n.correo, n.responsable,
                        items.map(it => `${parseInt(it.cantidad, 10) || 0} x ${it.servicio === OTRO ? (it.personalizado || '').trim() : it.servicio} (${num(it.precio).toFixed(2)})`).join(' | '),
                        Math.round(subtotal * 100) / 100, Math.max(0, Math.round((subtotal - total) * 100) / 100), total,
                        n.estado, n.pagado != null ? n.pagado : '', n.saldo != null ? n.saldo : '', n.metodo,
                        n.paquete && n.paquete.activo ? `Sesión ${n.paquete.sesion}${n.paquete.de ? ' de ' + n.paquete.de : ''}` : '',
                        n.observaciones
                    ].map(cell);
                })
            },
            {
                name: 'Notas · Pacientes',
                headers: ['Paciente', 'Teléfono', 'Correo', 'Responsable'],
                rows: Object.values(data.pacientes || {})
                    .filter(p => p && p.paciente)
                    .sort((a, b) => a.paciente.localeCompare(b.paciente, 'es'))
                    .map(p => [p.paciente, p.telefono, p.correo, p.responsable].map(cell))
            },
            {
                name: 'Notas · Ajustes',
                headers: ['Dato', 'Valor'],
                rows: [
                    ['Folio siguiente', formatFolio(data.folioSiguiente)],
                    ['Notas', data.historial.length],
                    ['Actualizado', new Date().toLocaleString('es-MX')]
                ]
            }
        ];
    }

    /* Combina lo que hay en la hoja con lo local sin borrar nada (salvo notas eliminadas a propósito). */
    function mezclar(data) {
        if (!data || data.app !== APP || !Array.isArray(data.historial)) {
            throw new Error('La hoja no tiene un respaldo de notas válido.');
        }
        let list = historial();
        const res = { added: 0, updated: 0, removed: 0, renumbered: 0, renumberedUids: [], needPush: false, changed: false };
        const tombs = Object.assign({}, data.eliminadas, tombstones());
        const incoming = data.historial
            .filter(h => h && typeof h === 'object' && h.uid && h.folio && !tombs[h.uid])
            .map(h => JSON.parse(JSON.stringify(h)));
        const remoteUids = new Set(incoming.map(h => h.uid));
        const remoteNext = parseInt(data.folioSiguiente, 10) || 1;

        const before = list.length;
        list = list.filter(h => !tombs[h.uid]);
        res.removed = before - list.length;

        const byUid = new Map(list.map(h => [h.uid, h]));
        const clashes = [];
        incoming.forEach(rec => {
            const cur = byUid.get(rec.uid);
            if (cur) {
                const a = rec.guardado || '';
                const b = cur.guardado || '';
                if (a > b) {
                    list[list.indexOf(cur)] = rec;
                    byUid.set(rec.uid, rec);
                    res.updated++;
                } else if (b > a) {
                    res.needPush = true;
                }
                return;
            }
            const own = list.find(h => sameFolio(h.folio, rec.folio));
            if (own && !remoteUids.has(own.uid)) {
                // La nota local nunca llegó a la hoja: la de la hoja ya estaba emitida, la local pasa al siguiente folio.
                clashes.push(own);
            } else if (own) {
                rec.folio = uniqueFolio(String(rec.folio).trim(), new Set(list.map(h => String(h.folio).trim().toUpperCase())));
                res.renumbered++;
            }
            list.push(rec);
            byUid.set(rec.uid, rec);
            res.added++;
        });

        let next = Math.max(nextFolio(list), remoteNext);
        clashes.forEach(own => {
            const anterior = own.folio;
            own.folio = formatFolio(next++);
            own.guardado = new Date().toISOString();
            if (own.paquete && own.paquete.activo && sameFolio(own.paquete.id, anterior)) {
                list.filter(h => !remoteUids.has(h.uid) && h.paquete && sameFolio(h.paquete.id, anterior))
                    .forEach(h => { h.paquete.id = own.folio; h.guardado = own.guardado; });
            }
            res.renumbered++;
            res.renumberedUids.push(own.uid);
            res.needPush = true;
        });

        if (list.some(h => !remoteUids.has(h.uid))) res.needPush = true;

        if (data.pacientes && typeof data.pacientes === 'object') {
            const pacientes = read(K.pacientes, {});
            Object.entries(data.pacientes).forEach(([key, p]) => {
                if (!p || !p.paciente) return;
                if (!pacientes[key] || (p.actualizado || '') > (pacientes[key].actualizado || '')) pacientes[key] = p;
            });
            write(K.pacientes, pacientes);
        }

        const maxFolio = list.reduce((max, h) => Math.max(max, folioNumber(h.folio)), 0);
        const siguiente = Math.max(nextFolio(list), remoteNext, maxFolio + 1);
        write(K.siguiente, siguiente);
        if (remoteNext < siguiente) res.needPush = true;

        write(K.eliminadas, tombs);
        if (Object.keys(tombs).length !== Object.keys(data.eliminadas || {}).length) res.needPush = true;

        list.sort((a, b) => folioNumber(b.folio) - folioNumber(a.folio) || String(b.folio).localeCompare(String(a.folio)));
        write(K.historial, list.slice(0, HISTORY_LIMIT));

        res.changed = !!(res.added || res.updated || res.removed || res.renumbered);
        return res;
    }

    /* ---------- Sincronizar ---------- */
    const listeners = [];
    let syncing = false;
    let again = false;
    let timer = null;
    let lastPull = 0;
    // Con la hoja conectada, no se asigna folio hasta leerla (o hasta que pasen unos segundos sin red).
    let gate = !connection();

    function emit(info) {
        listeners.forEach(fn => { try { fn(info); } catch (e) { console.error(e); } });
    }

    /* opts.push: true = subir siempre; false = solo leer y combinar; sin indicar = sube solo si «auto» y hay algo nuevo. */
    async function syncNow(opts) {
        opts = opts || {};
        if (!connection()) return null;
        if (syncing) {
            again = true;
            return null;
        }
        syncing = true;
        emit({ state: 'start' });
        const started = Date.now();
        let res = null;
        let error = null;
        try {
            const remote = opts.remote !== undefined ? opts.remote : await pull();
            lastPull = Date.now();
            res = remote ? mezclar(remote) : { added: 0, updated: 0, removed: 0, renumbered: 0, renumberedUids: [], needPush: true, changed: false };
            res.empty = !remote;
            const cfg = getCfg();
            if (opts.push === true || (opts.push !== false && cfg.auto && (res.needPush || cfg.dirty || !cfg.last))) {
                const data = copia();
                await push(tablas(data), JSON.stringify(data));
                const dirty = getCfg().dirty;
                setCfg({ dirty: dirty > started ? dirty : 0 });
            } else {
                setCfg({ error: '' });
            }
            return res;
        } catch (err) {
            error = err;
            setCfg({ error: err.message || 'Sin conexión', failedAt: Date.now() });
            throw err;
        } finally {
            syncing = false;
            gate = true;
            emit({ state: 'end', res, error });
            if (again) {
                again = false;
                schedule(500);
            }
        }
    }

    function schedule(ms) {
        if (!connection()) return;
        clearTimeout(timer);
        timer = setTimeout(() => { syncNow().catch(() => {}); }, ms);
    }

    /* Se anota el cambio: si la pantalla se cierra antes de subirlo, sale al abrir la app. */
    function changed() {
        if (!connection()) return;
        setCfg({ dirty: Date.now() });
        emit({ state: 'dirty' });
        if (getCfg().auto) schedule(DEBOUNCE_MS);
    }

    /* Sincroniza al abrir la pantalla y al volver a ella. */
    function auto() {
        if (connection()) {
            setTimeout(() => { if (!gate) { gate = true; emit({ state: 'gate' }); } }, GATE_MS);
            syncNow().catch(() => {});
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !connection()) return;
            const c = getCfg();
            if ((c.auto && c.dirty) || Date.now() - lastPull > STALE_MS) schedule(300);
        });
        window.addEventListener('online', () => schedule(500));
    }

    /* Conecta una hoja: lee lo que ya tenga, combina y sube. confirmFn(remotas, locales) puede cancelar. */
    async function connect(url, token, autoOn, confirmFn) {
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
            throw new Error('La URL debe empezar con https://script.google.com/');
        }
        if (!token) throw new Error('Escribe la clave que pusiste en el script.');
        const previous = getCfg();
        setCfg({ url, token, auto: autoOn, error: '' });
        try {
            const remote = await pull();
            const remoteCount = remote && Array.isArray(remote.historial) ? remote.historial.length : 0;
            const localCount = historial().length;
            if (remoteCount && localCount && confirmFn && !confirmFn(remoteCount, localCount)) {
                replaceCfg(previous);
                return null;
            }
            setCfg({ last: 0, dirty: 0 });
            const res = await syncNow({ remote, push: true });
            return { res, remoteCount };
        } catch (err) {
            replaceCfg(previous);
            throw err;
        }
    }

    /* Enlace de conexión: conecta otro dispositivo (o el mismo, tras borrar datos) de un toque. Lleva la clave. */
    function linkFor() {
        const c = getCfg();
        const json = JSON.stringify({ u: c.url, t: c.token });
        const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `${location.origin}/sincronizar/#conectar=${b64}`;
    }
    function parseLink(hash) {
        const m = /^#conectar=([A-Za-z0-9_-]+)$/.exec(hash || '');
        if (!m) return null;
        try {
            const cfg = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
            return cfg && cfg.u && cfg.t ? { url: cfg.u, token: cfg.t } : false;
        } catch (e) { return false; }
    }

    function agoText(ts) {
        const m = Math.round((Date.now() - ts) / 60000);
        if (m < 1) return 'justo ahora';
        if (m < 60) return `hace ${m} min`;
        if (m < 1440) return `hace ${Math.round(m / 60)} h`;
        return `hace ${Math.round(m / 1440)} días`;
    }

    /* Texto de estado para las pantallas. */
    function estado() {
        const c = getCfg();
        if (!connection()) {
            return { connected: false, warn: true, text: '⚠️ Sin conectar: tus notas solo están en este dispositivo. Si se borran los datos del navegador, el folio vuelve a NR-0001.' };
        }
        if (syncing) return { connected: true, warn: false, text: 'Sincronizando con Google Sheets…' };
        if (c.error) return { connected: true, warn: true, text: `⚠️ No se pudo sincronizar: ${c.error}` + (c.last ? ` · última vez ${agoText(c.last)}` : '') };
        if (c.dirty) {
            return c.auto
                ? { connected: true, warn: false, text: 'Google Sheets · cambios por subir…' }
                : { connected: true, warn: true, text: 'Hay cambios sin subir. Toca «Sincronizar ahora» en Sincronizar.' };
        }
        return { connected: true, warn: false, text: c.last ? `Google Sheets ✓ · sincronizado ${agoText(c.last)}` : 'Google Sheets · conectado' };
    }

    window.KTSync = {
        getCfg, setCfg, replaceCfg, connection, syncNow, changed, auto, connect, linkFor, parseLink, estado, agoText,
        copia, tombstoneAdd, tombstoneClear,
        gateOpen: () => gate,
        onSync: fn => { listeners.push(fn); }
    };
})();
