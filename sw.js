const C="skf5s-sup-v1";
const ASSETS=[
  "./","./index.html","./checklist.html","./style.css","./app.js",
  "./assets/5s-hero.png","./assets/skf-logo.png","./assets/pwa-192.png","./assets/pwa-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{
      const copy=res.clone(); caches.open(C).then(c=>c.put(e.request,copy)); return res;
    }).catch(()=> caches.match("./index.html")))
  );
});
