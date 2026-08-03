const CACHE_NAME = 'dompetq-v2'; // Naikkan versi cache
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
  // 'https://cdn.tailwindcss.com' <-- DIHAPUS agar tidak bentrok CORS
];

// 1. Install Event (Caching Aset Utama)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching assets...');
      // Menggunakan Promise.allSettled agar jika ada 1 asset gagal, sisanya tetap ter-cache
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate Event (Pembersihan Cache Lama)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event (Network First dengan Fallback Cache & Handling CORS)
self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url;

  // Abaikan request ke Firebase API & Tailwind CDN dari penanganan SW
  if (
    reqUrl.includes('firestore.googleapis.com') || 
    reqUrl.includes('identitytoolkit') ||
    reqUrl.includes('cdn.tailwindcss.com')
  ) {
    return;
  }

  // Hanya proses request HTTP/HTTPS GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Hanya simpan ke cache jika response valid (status 200/basic)
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Ambil dari cache jika offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Jika tidak ada di cache, biarkan return kosong tanpa crash
        return new Response('Offline / Resource not found', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
