// SKF 5S – Service Worker (v7.9.6)
const CACHE = 'skf5s-v796';
const PRECACHE = [
  './','./index.html','./style.css','./app.js',
  './assets/skf-logo.png','./assets/5S.png','./assets/skf-192.png','./assets/skf-512.png',
  // opzionale: se in futuro metti file locali delle librerie, aggiungili qui
];

// pattern per file CDN che vogliamo mettere in cache runtime
const RUNTIME_CACHE_URLS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url = e.request.url;

  // Network-first per i file CDN (così li scarica e poi li serve anche offline)
  if (RUNTIME_CACHE_URLS.some(u => url.startsWith(u))) {
    e.respondWith((async ()=>{
      try {
        const net = await fetch(e.request);
        const cache = await caches.open(CACHE);
        cache.put(e.request, net.clone());
        return net;
      } catch {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        throw new Error('offline');
      }
    })());
    return;
  }

  // Cache-first per tutto ciò che è stesso dominio (PWA)
  const sameOrigin = new URL(url).origin === location.origin;
  if (sameOrigin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
