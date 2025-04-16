const CACHE_NAME = 'SystemEl-cache-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/gdrive.js',
    '/js/sync.js',
    'https://unpkg.com/idb@7/build/umd.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    '/manifest.json',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => caches.match('/index.html'))
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Gestion de la synchronisation en arrière-plan
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncDataWithGoogleDrive());
    }
});

async function syncDataWithGoogleDrive() {
    // Cette fonction pourrait être plus complexe dans une implémentation réelle.
    // Ici, on simule une synchronisation en déclenchant un événement pour l'application.
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_DATA' });
    });
}