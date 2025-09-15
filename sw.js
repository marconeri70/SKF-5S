const CACHE = 'skf5s-v7.15.5';
const ASSETS = [
  './','./index.html',
  './style.css?v=7.15.5','./app.js?v=7.15.5',
  './assets/skf-192.png','./assets/skf-512.png','./assets/5S.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k)))));
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
