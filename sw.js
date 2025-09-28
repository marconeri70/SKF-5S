
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open('skf5s-supervisor-v2').then(cache=>cache.addAll([
    './','index.html','checklist.html','notes.html','style.css','app.js','manifest.json'
  ])));
});
self.addEventListener('activate', e=>{ e.waitUntil(clients.claim()); });
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
