// Cache super semplice per PWA offline
const SW_VERSION = '7.16.0';
const CORE = [
  './','index.html','style.css?v=7.16.0','app.js?v=7.16.0',
  'assets/skf-logo.png','assets/skf-192.png','assets/skf-512.png','assets/5S.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(SW_VERSION).then(c=>c.addAll(CORE)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SW_VERSION).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
