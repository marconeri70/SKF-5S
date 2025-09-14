// SKF 5S – Service Worker (v7.9.7)
const CACHE = 'skf5s-v797';
const PRECACHE = [
  './','./index.html','./style.css','./app.js',
  './assets/skf-logo.png','./assets/skf-192.png','./assets/skf-512.png',
  './assets/5S.png' // se manca non blocco l’install
];
const RUNTIME = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0'
];

self.addEventListener('install', evt=>{
  evt.waitUntil((async()=>{
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(u=>c.add(u).catch(()=>undefined)));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', evt=>{
  evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', evt=>{
  const url = evt.request.url;
  if(RUNTIME.some(u=>url.startsWith(u))){
    evt.respondWith((async()=>{
      try{
        const net = await fetch(evt.request);
        const c = await caches.open(CACHE); c.put(evt.request, net.clone()); return net;
      }catch{
        const cached = await caches.match(evt.request); if(cached) return cached;
        return new Response('',{status:504,statusText:'Offline'});
      }
    })()); return;
  }
  const same = new URL(url).origin===location.origin;
  if(same){
    evt.respondWith(caches.match(evt.request).then(r=>r||fetch(evt.request).catch(()=>caches.match('./index.html'))));
  }
});
