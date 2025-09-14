// SKF 5S – Service Worker (v7.9.6a)
const CACHE = 'skf5s-v796a';
const PRECACHE = [
  './','./index.html','./style.css','./app.js',
  './assets/skf-logo.png','./assets/skf-192.png','./assets/skf-512.png',
  // questa voce può mancare: la catturiamo con try/catch
  './assets/5S.png'
];

const RUNTIME_CACHE_URLS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // precache resiliente: ignora le add() che falliscono
    await Promise.all(
      PRECACHE.map(url => cache.add(url).catch(() => undefined))
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (RUNTIME_CACHE_URLS.some(u => url.startsWith(u))) {
    event.respondWith((async () => {
      try {
        const net = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put(event.request, net.clone());
        return net;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  const sameOrigin = new URL(url).origin === location.origin;
  if (sameOrigin) {
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request).catch(() => caches.match('./index.html')))
    );
  }
});
