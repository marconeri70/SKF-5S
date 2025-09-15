const CACHE = 'skf-5s-cache-v1';
const ASSETS = [
  './', './index.html', './style.css', './app.js',
  './manifest.json', './assets/skf-192.png', './assets/skf-512.png', './assets/5s-hero.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE && caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
