const SW_VERSION = 'skf5s-sw-v7.17.15';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { clients.claim(); });