/* Offline play: the game files are kept on the device. Only the online race needs the internet. */
const BUILD = '20261119d', CORE = 'qs-core-' + BUILD, ASSETS = 'qs-assets';
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
  for (const k of await caches.keys()) if (k !== CORE && k !== ASSETS) await caches.delete(k);
  await self.clients.claim();
  try {   // models, pictures and the rest are fetched once in the background
    const list = await (await fetch('precache.json')).json(), c = await caches.open(ASSETS);
    for (const f of list.assets) { if (!(await c.match(f))) await c.add(f).catch(() => {}); }
  } catch (err) { /* offline right now */ }
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  if (u.origin !== location.origin && !/(fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com)$/.test(u.hostname)) return;   // Firebase etc. go straight to the network
  if (u.origin === location.origin && (r.mode === 'navigate' || fresh(r.url))) {   // page and version file: newest when online, saved copy when not
    e.respondWith((async () => {
      try { const n = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(() => j(new Error('slow')), 4000))]); if (n.ok) { (await caches.open(CORE)).put(r.mode === 'navigate' ? './' : r, n.clone()); } return n; }
      catch (err) { return (await caches.match(r, { ignoreSearch: true })) || (await caches.match('./')) || Response.error(); }
    })()); return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(r) || (u.origin === location.origin && await caches.match(r, { ignoreSearch: true }));
    if (hit) { if (/^\/(models|thumbs|audio)\//.test(u.pathname)) fetch(r).then(async (n) => { if (n.ok) (await caches.open(ASSETS)).put(r, n); }).catch(() => {}); return hit; }   // pictures, models and sounds: show the saved copy, refresh it quietly for next time
    try { const n = await fetch(r); if (n.ok || n.type === 'opaque') (await caches.open(/^\/(models|thumbs|audio)\//.test(u.pathname) ? ASSETS : CORE)).put(r, n.clone()); return n; }
    catch (err) { return Response.error(); }
  })());
});
