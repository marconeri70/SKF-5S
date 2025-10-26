// v2.3.10 — SW leggero: preferisci rete, fallback cache
const CACHE='skf5s-v2.4';
const ASSETS=['./','./index.html','./checklist.html','./notes.html','./style.css','./app.js','./manifest.json','./assets/skf-192.png','./assets/skf-512.png','./assets/skf-logo.png','./assets/5S.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
