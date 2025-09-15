const CACHE = 'skf5s-v7.15.3';
const ASSETS = [
  './',
  'index.html',
  'style.css?v=7.15.3',
  'app.js?v=7.15.3',
  'assets/5S.png',
  'assets/skf-192.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=> k!==CACHE && caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e)=>{
  const {request} = e;
  e.respondWith(
    caches.match(request).then(res => res || fetch(request).then(r=>{
      const copy = r.clone();
      caches.open(CACHE).then(c=>c.put(request, copy)).catch(()=>{});
      return r;
    }).catch(()=> caches.match('./')))
  );
});
