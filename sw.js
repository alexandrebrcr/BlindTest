// Service Worker pour BlindTest Party PWA
const CACHE_NAME = 'blindtest-v7';
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
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
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
  // Ne pas intercepter les requêtes audio ou API externes
  if (
    event.request.url.includes('itunes.apple.com') ||
    event.request.url.includes('mzstatic.com') ||
    event.request.url.includes('pollinations.ai') ||
    event.request.url.includes('googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Pour les requêtes HTML (navigation / page principale), Network-First pour voir les mises à jour immédiatement
  if (event.request.mode === 'navigate' || event.request.url.includes('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Pour les autres ressources (CSS, JS) : Cache avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});