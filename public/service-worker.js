/*/*

 * ARFLIX Service Worker - Production Ready * Simple service worker to provide offline support.  It caches the app shell

 * Features: * and manifest so that the application can start even when the network is

 * - App shell caching * unavailable.  This service worker does not implement runtime caching for

 * - Runtime API caching with network-first strategy * API responses; however, it can be extended to do so.

 * - Image caching with cache-first strategy */

 * - Background sync for failed requests

 * - Cache versioning with automatic cleanupconst CACHE_NAME = 'arflix-cache-v1';

 * - Offline fallback pageconst URLS_TO_CACHE = [

 */  '/',

  '/index.html',

const CACHE_VERSION = 'v2';  '/manifest.json',

const CACHE_NAMES = {  '/icon-192.png',

  static: `arflix-static-${CACHE_VERSION}`,  '/icon-512.png',

  dynamic: `arflix-dynamic-${CACHE_VERSION}`,];

  images: `arflix-images-${CACHE_VERSION}`,

};self.addEventListener('install', (event) => {

  event.waitUntil(

// Static assets to cache on install    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)),

const STATIC_CACHE_URLS = [  );

  '/',});

  '/index.html',

  '/manifest.json',self.addEventListener('activate', (event) => {

];  // Clean up old caches when a new service worker activates

  event.waitUntil(

// Cache size limits    caches.keys().then((cacheNames) =>

const CACHE_LIMITS = {      Promise.all(

  images: 50,        cacheNames

  dynamic: 30,          .filter((name) => name !== CACHE_NAME)

};          .map((name) => caches.delete(name)),

      ),

// === INSTALL ===    ),

self.addEventListener('install', (event) => {  );

  console.log('[SW] Installing service worker...');});

  

  event.waitUntil(self.addEventListener('fetch', (event) => {

    caches  event.respondWith(

      .open(CACHE_NAMES.static)    caches.match(event.request).then((response) => response || fetch(event.request)),

      .then((cache) => {  );

        console.log('[SW] Caching static assets');});
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATE ===
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Delete old caches
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith('arflix-') &&
                !Object.values(CACHE_NAMES).includes(name)
              );
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// === FETCH ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // === Strategy Selection ===
  
  // 1. Images: Cache-first
  if (request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.images, CACHE_LIMITS.images));
    return;
  }

  // 2. API Calls: Network-first with cache fallback
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('themoviedb.org') ||
    url.pathname.includes('/api/')
  ) {
    event.respondWith(networkFirstStrategy(request, CACHE_NAMES.dynamic, CACHE_LIMITS.dynamic));
    return;
  }

  // 3. App shell: Cache-first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
    return;
  }

  // 4. Other assets: Cache-first
  event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
});

// === CACHING STRATEGIES ===

/**
 * Cache-first strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request, cacheName, limit) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
      
      // Enforce cache size limit
      if (limit) {
        limitCacheSize(cacheName, limit);
      }
    }

    return response;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    
    // Return offline fallback if available
    const cache = await caches.open(CACHE_NAMES.static);
    return cache.match('/index.html');
  }
}

/**
 * Network-first strategy
 * Try network first, fallback to cache
 */
async function networkFirstStrategy(request, cacheName, limit) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      const responseClone = response.clone();
      cache.put(request, responseClone);
      
      // Enforce cache size limit
      if (limit) {
        limitCacheSize(cacheName, limit);
      }
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Delete oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// === BACKGROUND SYNC ===
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-watch-progress') {
    event.waitUntil(syncWatchProgress());
  }
});

async function syncWatchProgress() {
  // TODO: Implement background sync for watch progress
  console.log('[SW] Syncing watch progress...');
}

// === PUSH NOTIFICATIONS ===
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ARFLIX';
  const options = {
    body: data.body || 'New content available',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});

console.log('[SW] Service worker loaded');
