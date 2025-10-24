self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/#/dashboard/tasks', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(urlToOpen));
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// sw.js

const CACHE_NAME = 'focusflow-cache-v6'; // Increment version on major change
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/screenshot1.svg',
  '/screenshot2.svg',
  '/og-image.svg'
];
const CDN_URLS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://esm.sh'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Always bypass for non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  const url = new URL(request.url);

  // App Shell: Cache First, then Network
  // This makes the app load instantly.
  if (APP_SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then(networkResponse => {
            // Optional: cache the response if it was a miss
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
            });
        });
      })
    );
    return;
  }
  
  // CDNs and JS/TSX modules: Stale-While-Revalidate
  // This keeps assets fresh without blocking the load time.
  const isCdnOrModule = CDN_URLS.some(cdn => url.href.startsWith(cdn)) || url.pathname.endsWith('.tsx');
  if (isCdnOrModule) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.warn('[SW] Fetch failed, probably offline.', err);
                });

                return cachedResponse || fetchPromise;
            });
        })
    );
    return;
  }
  
  // Default: Network Only for all other requests
  event.respondWith(fetch(request));
});