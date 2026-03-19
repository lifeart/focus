const CACHE_NAME = 'focus-v1';
const ASSETS = [
  './',
  './index.html',
  './bundle.js',
  './variables.css',
  './base.css',
  './components.css',
  './layout.css',
  './exercises.css',
  './animations.css',
  './fonts.css',
  './fonts/inter-cyrillic-ext.woff2',
  './fonts/inter-cyrillic.woff2',
  './fonts/inter-latin-ext.woff2',
  './fonts/inter-latin.woff2',
  './fonts/space-grotesk-latin-ext.woff2',
  './fonts/space-grotesk-latin.woff2',
  './favicon.svg',
  './manifest.json'
];

// Install - cache all assets, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches, take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation: network-first (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets: stale-while-revalidate
  // Serve from cache immediately, then update cache in background
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Listen for skip-waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
