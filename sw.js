/* Offline support: network first, falling back to what was cached on the last successful load.
   After one full online visit (game files, Three.js from the CDN, fonts) the game also opens offline. */
const CACHE = 'qitar-v11';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html') || Response.error())));
});
