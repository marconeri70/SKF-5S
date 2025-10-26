// sw.js  v2.3.9-hotfix
const CACHE = 'skf5s-v239-hotfix';
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

// install
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // per i file "vivi", vai SEMPRE in rete (così prendi l'ultima app.js / style.css / html)
  if (url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('/style.css') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/checklist.html') ||
      url.pathname.endsWith('/notes.html')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // cache-first per tutto il resto
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
