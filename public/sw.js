// DRK Serviceportal – Service Worker
// Strategie: Network-first für HTML, Cache-first für Assets
// Bei neuem Deploy: sofort übernehmen → App lädt automatisch neu

const CACHE_NAME = 'drk-v1';
const PRECACHE = ['/'];

// Install: sofort aktivieren (kein Warten auf alten SW)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

// Activate: alte Caches löschen, sofort übernehmen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first (damit immer aktuelle Daten)
self.addEventListener('fetch', event => {
  // Nur GET, keine Firebase/Brevo-Requests cachen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase') || url.hostname.includes('brevo')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Antwort im Cache speichern (nur erfolgreiche)
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // Offline-Fallback
  );
});
