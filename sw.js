// sw.js  • v2.3.9-hotfix-2  (network-first su file “vivi”)
const CACHE = 'skf5s-v239-hotfix-2';
const ASSETS = [
  './',
  './index.html',
  './checklist.html',
  './notes.html',
  './style.css',
  './assets/skf-192.png',
  './assets/skf-512.png',
  './assets/skf-logo.png',
  './assets/5S.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Rete prima per i file critici (così prendi sempre l’ultima app.js / html / css)
  if (
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/checklist.html') ||
    url.pathname.endsWith('/notes.html') ||
    url.pathname.endsWith('/style.css')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Cache-first per tutto il resto
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
