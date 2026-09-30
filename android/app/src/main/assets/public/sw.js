const CACHE_NAME = 'rentgf-v3';
const OFFLINE_URL = '/offline.html';

// Files to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// Install — cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🔧 RentGF SW: Caching essentials');
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // If offline.html doesn't exist yet, skip it
        return cache.addAll(['/', '/index.html', '/manifest.json']);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch — Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET, API calls, sockets, and media streams
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('socket.io')) return;
  if (event.request.url.includes('cloudinary.com')) return;
  if (event.request.destination === 'audio' || event.request.destination === 'video') return;
  if (event.request.url.match(/\.(mp3|wav|ogg|mp4|webm)(\?.*)?$/i)) return;
  if (event.request.headers.get('range')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL).then(r => r || caches.match('/'));
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ─── Web Push Notification Handler ───
self.addEventListener('push', (event) => {
  let data = { title: 'Coffeely', body: 'You have a new update.', icon: '/logo192.png', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    tag: data.tag || 'coffeely_push',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: !!(data.title && (data.title.includes('Call') || data.title.includes('Incoming'))),
    actions: [
      { action: 'open', title: 'Open 💬' },
      { action: 'close', title: 'Dismiss ✕' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification Click Handler ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (client.navigate) client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});