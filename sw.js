/* Word Tiles — offline cache.
   Bump CACHE whenever you upload a new index.html, or tablets will keep
   serving the old one. */
const CACHE = 'word-tiles-v6';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Added one at a time so a single missing file can't fail the install.
    await Promise.all(ASSETS.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // Page loads: cached app first, so it opens with no connection.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await caches.match('./index.html');
      if (hit) return hit;
      try { return await fetch(req); }
      catch (err) { return new Response('Word Tiles is not cached yet.', { status: 503 }); }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
