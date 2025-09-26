
const CACHE_NAME = 'skf5s-supervisor-v1';
const ASSETS = [
  './',
  './index.html',
  './checklist.html',
  './notes.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/5s.png',
  './assets/5s-hero.png',
  './assets/skf-192.png',
  './assets/skf-512.png',
  './assets/skf-logo.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
