
const CACHE='skf5s-supervisor-v211';
const FILES=[
  './','./index.html','./checklist.html','./notes.html','./style.css','./app.js','./manifest.json',
  './assets/5s.png','./assets/skf-192.png','./assets/skf-512.png','./assets/skf-logo.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
