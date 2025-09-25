const CACHE = "skf5s-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./checklist.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./assets/5s-hero.png",
  "./assets/skf-logo.png",
  "./assets/pwa-192.png",
  "./assets/pwa-512.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(req, copy));
      return resp;
    }))
  );
});
