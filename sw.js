// Service Worker pour BlindTest Party PWA
const CACHE_NAME = 'blindtest-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/buzzer.css',
  './js/app.js',
  './js/audio-player.js',
  './js/sfx.js',
  './js/categories.js',
  './js/ai-generator.js',
  './js/itunes-api.js',
  './js/game-engine.js',
  './js/buzzer-engine.js',
  './js/room-peer.js',
  './js/peerjs.min.js',
  './js/qrcode.min.js',
  './assets/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes audio ou API externes en cache strict pour toujours avoir les previews
  if (
    event.request.url.includes('itunes.apple.com') ||
    event.request.url.includes('mzstatic.com') ||
    event.request.url.includes('pollinations.ai') ||
    event.request.url.includes('googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
