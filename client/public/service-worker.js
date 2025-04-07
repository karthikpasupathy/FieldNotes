
// Service Worker for Daynotes PWA
// This version number should be updated with each deployment
const CACHE_NAME = 'daynotes-cache-v4';
// Deployment version should be a unique identifier that changes with each deployment
const DEPLOYMENT_VERSION = '2025-04-06-1';
const UPDATE_NOTIFICATION_SENT = 'daynotes-update-notification-sent';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/daynotes-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// Track whether we've notified clients of an update
let updateNotificationSent = false;

// Helper function to notify all clients of an update
function notifyClientsOfUpdate() {
  if (updateNotificationSent) return;
  
  console.log('[Service Worker] Notifying clients of update');
  
  self.clients.matchAll({ type: 'window' }).then(clients => {
    if (clients && clients.length) {
      clients.forEach(client => {
        client.postMessage({ 
          type: 'APP_UPDATED',
          version: DEPLOYMENT_VERSION,
          cacheVersion: CACHE_NAME,
          timestamp: new Date().toISOString()
        });
      });
      
      updateNotificationSent = true;
      
      self.indexedDB.open('daynotes-sw-state', 1).onsuccess = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'id' });
        }
        
        const transaction = db.transaction(['state'], 'readwrite');
        const store = transaction.objectStore('state');
        store.put({ 
          id: UPDATE_NOTIFICATION_SENT, 
          value: true,
          timestamp: new Date().toISOString()
        });
      };
    }
  });
}

// Install event - Cache basic assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new worker version:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - Clean up old caches and notify clients
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new worker version:', CACHE_NAME);
  
  const cacheAllowlist = [CACHE_NAME];

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheAllowlist.indexOf(cacheName) === -1) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients and notify them about the update
      self.clients.claim().then(() => {
        notifyClientsOfUpdate();
      })
    ])
  );
});

// Message event - Listen for messages from clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skipping waiting phase and activating now');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE_STATUS') {
    console.log('[Service Worker] Client requested update status check');
    
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        const client = clients.find(c => c.id === event.source.id);
        if (client) {
          client.postMessage({ 
            type: 'APP_UPDATED',
            version: DEPLOYMENT_VERSION,
            cacheVersion: CACHE_NAME,
            timestamp: new Date().toISOString()
          });
        }
      })
    );
  }
  
  if (event.data && event.data.type === 'BROADCAST_UPDATE') {
    console.log('[Service Worker] Broadcasting update to all clients');
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients && clients.length) {
          clients.forEach(client => {
            client.postMessage({ 
              type: 'APP_UPDATED',
              version: DEPLOYMENT_VERSION,
              cacheVersion: CACHE_NAME,
              timestamp: new Date().toISOString(),
              source: 'broadcast'
            });
          });
        }
      })
    );
  }
});

// Fetch event - Modified strategy for better updates
self.addEventListener('fetch', (event) => {
  // Handle refresh query parameter for cache busting
  const url = new URL(event.request.url);
  const isRefreshRequest = url.searchParams.has('refresh');
  
  // Handle API requests or non-GET requests differently
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.includes('/api/')
  ) {
    return event.respondWith(fetch(event.request));
  }
  
  // For normal app resources, use a network-first strategy if it's a refresh request
  // otherwise use a cache-first strategy
  if (isRefreshRequest) {
    console.log('[Service Worker] Network-first for refresh request:', url.pathname);
    
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }

          const fetchRequest = event.request.clone();

          return fetch(fetchRequest).then(
            (response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            }
          );
        })
    );
  }
});
