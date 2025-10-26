// v2.3.8 — SW minimale: usa sempre i file più recenti (niente cache offline invasiva)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
// niente fetch handler → lasciamo rete/browser gestire fresh content
