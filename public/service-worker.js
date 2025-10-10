/*
 * Simple service worker to provide offline support.  It caches the app shell
 * and manifest so that the application can start even when the network is
 * unavailable.  This service worker does not implement runtime caching for
 * API responses; however, it can be extended to do so.
 */

const CACHE_NAME = 'arflix-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)),
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches when a new service worker activates
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request)),
  );
});