const CACHE_NAME = 'zoryanyi-klas-v1';
const ASSETS = [
  './',
  './index.html',
  './teacher/index.html',
  './manifest.json',
  './styles/base.css',
  './styles/tokens.css',
  './vendor/jsQR.min.js',
  './vendor/qrcode.min.js',
  './src/app.js',
  './src/teacher.js',
  './src/data/firebase.js',
  './src/data/firebase-config.js',
  './src/data/repo.js',
  './src/data/tx.js',
  './src/engine/time.js',
  './src/engine/economy.js',
  './src/engine/qr-protocol.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('Failed to cache asset:', asset, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Ignore firestore API calls & google APIs
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
