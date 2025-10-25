// v2.3.6 — SW neutro: nessuna cache aggressiva
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
// niente fetch handler → usa sempre i file più recenti
