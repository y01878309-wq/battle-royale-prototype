/* Offline play: the game files are kept on the device. Only the online race needs the internet. */
const BUILD = '20261122b', CORE = 'qs-core-' + BUILD, ASSETS = 'qs-assets';
const off = () => self.navigator && self.navigator.onLine === false;   // no connection: never wait for the network, use the saved copy at once
const fresh = (url) => /(^|\/)(index\.html|version\.json)?$/.test(new URL(url).pathname) || /version\.json$/.test(url);
self.addEventListener('install', (e) => e.waitUntil((async () => {
  self.skipWaiting();
  try {
    const list = await (await fetch('precache.json', { cache: 'no-store' })).json(), c = await caches.open(CORE);
    await Promise.all(list.core.map((f) => { const u = /\.(js|css)$/.test(f) && !/^vendor\//.test(f) ? f + '?v=' + BUILD : f; return c.add(new Request(u, { cache: 'reload' })).catch(() => {}); }));
    await c.add('./').catch(() => {});
  } catch (err) { /* installs again next time */ }
})()));
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const ready = !!(await (await caches.open(CORE)).match('./'));   // never drop the old copy of the game until the new one is complete
  if (ready) for (const k of await caches.keys()) if (k !== CORE && k !== ASSETS && k !== 'qs-voice') await caches.delete(k);
  await self.clients.claim();
  try {   // models, pictures and the rest are fetched once in the background
    const list = await (await fetch('precache.json')).json(), c = await caches.open(ASSETS);
    for (const f of list.assets) { if (!(await c.match(f))) await c.add(f).catch(() => {}); }
  } catch (err) { /* offline right now */ }
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  const ext = u.origin !== location.origin;
  if (ext && !/(fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com)$/.test(u.hostname)) return;   // Firebase data etc. go straight to the network
  if (ext) {   // fonts and the Firebase scripts: the saved copy at once (also with no signal, where waiting would leave the first screen blank), refreshed quietly; with no saved copy give up after 2.5 s
    e.respondWith((async () => {
      const c = await caches.open(ASSETS), hit = await c.match(r); if (!hit && off()) return Response.error(); const net = fetch(r).then((n) => { if (n.ok || n.type === 'opaque') c.put(r, n.clone()); return n; });
      if (hit) { net.catch(() => {}); return hit; }
      try { return await Promise.race([net, new Promise((_, j) => setTimeout(() => j(new Error('slow')), 2500))]); } catch (err) { return Response.error(); }
    })()); return;
  }
  if (u.origin === location.origin && u.pathname === '/api/tts') {   // speech pieces: kept for good, so the voice also works with no internet
    e.respondWith((async () => { const c = await caches.open('qs-voice'), hit = await c.match(r); if (hit) return hit; try { const n = await fetch(r); if (n.ok) c.put(r, n.clone()); return n; } catch (err) { return Response.error(); } })()); return;
  }
  if (u.origin === location.origin && (r.mode === 'navigate' || fresh(r.url) || /\/splash\.jpg$/.test(u.pathname))) {   // page and version file: newest when online, saved copy when not
    e.respondWith((async () => {
      try { if (off()) throw new Error('offline'); const n = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(() => j(new Error('slow')), 3000))]); if (n.ok) { (await caches.open(CORE)).put(r.mode === 'navigate' ? './' : r, n.clone()); } return n; }
      catch (err) { return (await caches.match(r, { ignoreSearch: true })) || (await caches.match('./')) || (await caches.match('index.html')) || (await caches.match('/')) || Response.error(); }
    })()); return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(r) || (u.origin === location.origin && await caches.match(r, { ignoreSearch: true }));
    if (hit) { if (/^\/(models|thumbs|audio)\//.test(u.pathname)) fetch(r).then(async (n) => { if (n.ok) (await caches.open(ASSETS)).put(r, n); }).catch(() => {}); return hit; }   // pictures, models and sounds: show the saved copy, refresh it quietly for next time
    if (off()) return Response.error();
    try { const n = await fetch(r); if (n.ok || n.type === 'opaque') (await caches.open(/^\/(models|thumbs|audio)\//.test(u.pathname) ? ASSETS : CORE)).put(r, n.clone()); return n; }
    catch (err) { return Response.error(); }
  })());
});

/* Notifications that arrive from outside the game (sent from the admin page through /api/push). */
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'قطارات مصر', { body: d.body || '', dir: 'rtl', lang: 'ar', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => { const l = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); for (const c of l) { if ('focus' in c) return c.focus(); } return self.clients.openWindow((e.notification.data && e.notification.data.url) || './'); })());
});
