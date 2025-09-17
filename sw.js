const SW_VERSION = 'skf5s-sw-v7.17.10';
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/5s-hero.png',
  './assets/skf-192.png',
  './assets/skf-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(SW_VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SW_VERSION).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const req=e.request;
  e.respondWith(
    caches.match(req).then(res=> res || fetch(req).then(r=>{
      const copy=r.clone(); caches.open(SW_VERSION).then(c=>c.put(req,copy)); return r;
    }).catch(()=>caches.match('./')) )
  );
});
