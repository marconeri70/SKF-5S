// SKF 5S – Service Worker (cache semplice)
const CACHE = 'skf5s-v795';
const ASSETS = [
  './', './index.html', './style.css', './app.js',
  './assets/skf-logo.png', './assets/5S.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(r=> r || fetch(e.request))
    );
  }
});
