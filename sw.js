// SKF 5S PWA SW – v7.6.2
CACHE_NAME = "skf5s-cache-v7"; // aumenta quando cambi file
FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css?v=7.6.2",
  "./app.js?v=7.6.2",
  "./manifest.json",
  "./assets/skf-logo.png",
  "./assets/skf-192.png",
  "./assets/skf-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

