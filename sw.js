// v2.3.7 | SW neutro: precache base + cache-first solo per asset locali
const CACHE = 'skf5s-v237';
const ASSETS = [
  './index.html','./checklist.html','./notes.html',
  './style.css','./app.js','./manifest.json',
  './assets/skf-192.png','./assets/skf-512.png','./assets/skf-logo.png','./assets/5S.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin){
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
  }
});
