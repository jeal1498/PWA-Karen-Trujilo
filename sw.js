/* Service Worker · Karen Trujillo Tools
 * - Precarga el shell de las tres vistas (hub, horarios, notas) para uso offline.
 * - Navegaciones: network-first (siempre la versión más reciente si hay red), con caché de respaldo.
 * - Recursos estáticos y CDNs: stale-while-revalidate.
 * - /api/*: siempre red, nunca se cachea (datos de Calendar en vivo).
 */
const VERSION = 'v1.3.0';
const SHELL_CACHE = `kt-shell-${VERSION}`;
const RUNTIME_CACHE = `kt-runtime-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/horarios/',
  '/notas/',
  '/manifest.json',
  '/Logo_Karen_Trujillo.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png'
];

const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_URLS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('kt-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// "/horarios" y "/horarios/index.html" comparten la entrada de caché "/horarios/".
function normalizeNavigationPath(pathname) {
  let path = pathname.replace(/index\.html$/, '');
  if (!path.endsWith('/')) path += '/';
  return path;
}

async function handleNavigation(request) {
  const url = new URL(request.url);
  const cacheKey = normalizeNavigationPath(url.pathname);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(cacheKey) || await caches.match('/');
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Sin conexión</title><body style="font-family:sans-serif;padding:32px;color:#301E5B;background:#F2ECF2">' +
      '<h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas internet.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request) || await caches.match(request);
  const network = fetch(request)
    .then(response => {
      // Las respuestas opacas (status 0) de CDNs sin CORS también se guardan.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
