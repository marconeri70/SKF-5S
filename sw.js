
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open('skf5s-v1').then(c=>c.addAll([
    './','./index.html','./checklist.html','./notes.html',
    './style.css','./app.js','./manifest.json','./assets/skf-512.png','./assets/5s.png'
  ])));
});
self.addEventListener('activate', e=>{ self.clients.claim(); });
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
      const copy = resp.clone();
      caches.open('skf5s-v1').then(c=>c.put(e.request, copy));
      return resp;
    }).catch(()=>caches.match('./index.html')))
  );
});
