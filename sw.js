/* SKF 5S – Service Worker (v7.11) */
const CACHE = 'skf5s-cache-v7.11';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=7.11',
  './app.js?v=7.11',
  './assets/5s-hero.png',
  './assets/skf-logo.png',
  './assets/skf-192.png',
  './assets/skf-512.png',
  './manifest.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        return resp;
      }))
    );
  }
});
