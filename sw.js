// sw.js — v2.3.11 (network-first per documenti e script, cache sicura per asset)
// Cambia SEMPRE CACHE_NAME quando pubblichi una nuova build.
const CACHE_NAME = 'skf5s-cache-v2.3.11';

// Asset statici sicuri da mettere in cache (icone/immagine 5S)
const STATIC_ASSETS = [
  'assets/skf-192.png',
  'assets/skf-512.png',
  'assets/skf-logo.png',
  'assets/5S.png',
  'manifest.json'
];

// Install: pre-cache SOLO asset non critici (non HTML/JS/CSS)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: elimina TUTTE le cache precedenti
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Messaggio per forzare l'update immediato
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch:
// - documenti (HTML), script (JS) e CSS => NETWORK-FIRST (niente cache stantia)
// - immagini e icone => CACHE-FIRST con fallback rete
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const dest = req.destination;

  // Network-first per risorse critiche
  if (dest === 'document' || dest === 'script' || dest === 'style') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => res)
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first per asset statici (icone/immagini)
  if (dest === 'image') {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
            return res;
          })
        );
      })
    );
    return;
  }

  // Default: prova rete, poi cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
