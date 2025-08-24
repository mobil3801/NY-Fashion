
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `inventory-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-cache-${CACHE_VERSION}`;

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/assets/index.css',
  '/assets/index.js',
  '/favicon.ico'
];

// API endpoints to cache
const CACHE_PATTERNS = [
  /\/api\/inventory\//,
  /getProducts/,
  /getCategories/,
  /saveProduct/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with network-first strategy
  if (CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default to network with fallback
  event.respondWith(networkWithFallback(request));
});

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return a custom offline response for inventory API calls
    if (request.url.includes('inventory')) {
      return new Response(JSON.stringify({
        error: 'Offline - cached data unavailable',
        offline: true
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    throw error;
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  cache.put(request, networkResponse.clone());
  
  return networkResponse;
}

// Network with fallback strategy
async function networkWithFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return a generic offline page or error response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle cache bump messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_BUMP') {
    handleCacheBump();
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    handleClearCache();
  }
});

// Cache bump mechanism - force refresh cached data
async function handleCacheBump() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    
    // Remove all cached API responses to force fresh data
    const apiRequests = requests.filter(request => 
      CACHE_PATTERNS.some(pattern => pattern.test(new URL(request.url).pathname))
    );
    
    await Promise.all(
      apiRequests.map(request => cache.delete(request))
    );
    
    console.log('[SW] Cache bumped - removed', apiRequests.length, 'cached API responses');
    
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_BUMPED',
        count: apiRequests.length
      });
    });
  } catch (error) {
    console.error('[SW] Cache bump failed:', error);
  }
}

// Clear all caches
async function handleClearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    
    console.log('[SW] All caches cleared');
    
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_CLEARED'
      });
    });
  } catch (error) {
    console.error('[SW] Cache clear failed:', error);
  }
}
