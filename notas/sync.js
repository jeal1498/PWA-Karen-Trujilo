/* Conexión con la hoja de Google de Karen (Apps Script, ver apps-script/Code.gs). Misma idea que sync.js de PWA-Finance:
   la URL y la clave viven en este dispositivo; «auto» sube sola después de cada cambio.
   Las pestañas y la combinación de notas las arma notas/index.html. */
(function () {
    'use strict';

    const KEY = 'kt_notas_sheets';

    function getCfg() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    }
    function replaceCfg(cfg) {
        try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ }
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

    window.KTSync = { getCfg, setCfg, replaceCfg, connection, push, pull };
})();
