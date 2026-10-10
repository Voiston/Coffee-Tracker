// Service Worker - Suivi Caféine Pro
// Version du cache
const CACHE_NAME = 'cafeine-pro-v5';

// Ressources de l'App Shell et CDN externes
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './widget.html',
  './manifest.json',
  './icon.svg',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap'
];

// Installation : Mise en cache de l'App Shell et des CDN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pré-mise en cache résiliente
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Pré-cache avertissement pour ' + asset + ':', err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activation : Nettoyage des anciens caches et prise de contrôle immédiate
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
    }).then(() => self.clients.claim())
  );
});

// Fetch : Stratégie "Cache First, fallback to Network" avec mise en cache dynamique
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Gérer les requêtes locales et les CDN autorisés (Google Fonts, Chart.js)
  const isSameOrigin = url.origin === self.location.origin;
  const isAllowedCdn = url.hostname.includes('googleapis.com') ||
                       url.hostname.includes('gstatic.com') ||
                       url.hostname.includes('jsdelivr.net');

  if (!isSameOrigin && !isAllowedCdn) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Si présent en cache, renvoyer immédiatement (Cache First)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Sinon, requête réseau (fallback to Network)
      return fetch(event.request).then((networkResponse) => {
        // Enregistrer la nouvelle ressource en cache si valide
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async (fetchError) => {
        // 3. Si hors-ligne et navigation de page, fallback sur index.html
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html') || await caches.match('./');
          if (fallback) return fallback;
        }
        throw fetchError;
      });
    })
  );
});
