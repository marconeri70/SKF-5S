// PWA cache (v7.13.0)
const CACHE = 'skf5s-cache-v7.13.0';
const ASSETS = [
  './','index.html','style.css','app.js','manifest.json',
  'assets/skf-logo.png','assets/skf-192.png','assets/5s-hero.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
