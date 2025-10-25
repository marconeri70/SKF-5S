// v2.3.5 — SW neutro: nessuna cache aggressiva
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
// niente fetch: usiamo sempre la rete → i file nuovi sono immediati
