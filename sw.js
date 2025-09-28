self.addEventListener('install', e=>{self.skipWaiting()});
self.addEventListener('activate', e=>{clients.claim()});
self.addEventListener('fetch', e=>{
  // passthrough network; simple SW for PWA install
});
