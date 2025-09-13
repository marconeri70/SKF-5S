// sw.js – Service Worker SKF 5S v7.9.1
const CACHE_NAME = "skf5s-cache-v15";
const URLS_TO_CACHE = [
  "./",
  "index.html",
  "style.css?v=7.9.1",
  "app.js?v=7.9.1",
  "manifest.json",
  "assets/skf-192.png",
  "assets/skf-512.png",
  "assets/skf-logo.png",
  "assets/5s-hero.png"
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate (elimina cache vecchie)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return (
        resp ||
        fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});


