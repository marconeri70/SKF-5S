
self.addEventListener('install', e=>{
  e.waitUntil(caches.open('skf5s-v215').then(c=>c.addAll([
    './','./index.html','./checklist.html','./notes.html','./style.css','./app.js',
    './manifest.json','./assets/skf-logo.png','./assets/skf-192.png','./assets/skf-512.png','./assets/5S.png','./assets/5s-hero.png'
  ])));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
