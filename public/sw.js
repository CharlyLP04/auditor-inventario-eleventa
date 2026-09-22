// The local server supplies a cache version and the built asset list at startup.
const CACHE = 'auditor-shell-__BUILD_ID__';
const ASSETS = /*__PRECACHE__*/ [];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', ...ASSETS])));
  // A new version waits until all existing app windows have closed, protecting active counts.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('auditor-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(event.request.mode === 'navigate' ? '/index.html' : event.request);
    if (saved) return saved;
    return fetch(event.request);
  })());
});
