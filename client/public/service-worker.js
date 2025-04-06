// Service Worker for Daynotes PWA
const CACHE_NAME = 'daynotes-cache-v4'; // Updated version number
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
      // Notify each client of the update
      clients.forEach(client => {
        client.postMessage({ 
          type: 'APP_UPDATED',
          version: CACHE_NAME,
          timestamp: new Date().toISOString()
        });
      });
      
      // Set flag to avoid duplicate notifications
      updateNotificationSent = true;
      
      // Store in IndexedDB that we've sent notification
      // This helps track across service worker instances
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
  
  // We don't skipWaiting() automatically anymore - this will be triggered
  // when the user clicks "Refresh Now" in the update notification
  
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
    // When user clicks "Refresh Now", we'll skip waiting and activate the new worker
    console.log('[Service Worker] Skipping waiting phase and activating now');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE_STATUS') {
    // Client is asking if there was an update
    console.log('[Service Worker] Client requested update status check');
    
    // Try to notify this specific client if we're a new version
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        const client = clients.find(c => c.id === event.source.id);
        if (client) {
          client.postMessage({ 
            type: 'APP_UPDATED',
            version: CACHE_NAME,
            timestamp: new Date().toISOString()
          });
        }
      })
    );
  }
  
  if (event.data && event.data.type === 'BROADCAST_UPDATE') {
    // A client wants us to broadcast update message to all clients
    // This is especially important for mobile PWAs
    console.log('[Service Worker] Broadcasting update to all clients');
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients && clients.length) {
          clients.forEach(client => {
            client.postMessage({ 
              type: 'APP_UPDATED',
              version: CACHE_NAME,
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
    
    // If this is a refresh request, try network first, fall back to cache
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    // Normal cache-first strategy for regular requests
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached response if found
          if (response) {
            return response;
          }

          // Clone the request as it can only be used once
          const fetchRequest = event.request.clone();

          // Try to fetch from network
          return fetch(fetchRequest).then(
            (response) => {
              // If response is invalid or is a cors request, just return it
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              // Clone the response as it can only be used once
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