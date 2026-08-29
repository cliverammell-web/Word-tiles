/* Word Tiles — offline cache.

   Page loads are network-first: the app checks for a new index.html on every
   launch and only falls back to the cache when the network is slow or absent.
   That means an upload reaches every device on its next launch, with no cache
   bumping and no clearing of site data.

   index.html is large, but GitHub Pages sends an ETag, so an unchanged file
   costs a small 304 rather than a full download.

   Static assets below stay cache-first — they are icons and never change. */
const CACHE = 'word-tiles-v8';
const NET_TIMEOUT = 4000;   // fall back to the cached app after this

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

/** Fetch, but give up after ms so a dead connection doesn't hang the launch. */
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let sync traffic alone

  // Page loads: newest version wins, cache is the safety net.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetchWithTimeout(req, NET_TIMEOUT);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const hit = await caches.match('./index.html');
        if (hit) return hit;
        return new Response('Word Tiles is not cached yet.', { status: 503 });
      }
    })());
    return;
  }

  // Everything else: cache first, since it is only icons and the manifest.
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
