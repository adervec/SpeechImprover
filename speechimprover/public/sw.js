// Minimal PWA service worker: network-first with a runtime cache so the app
// installs and works offline. No build step / no asset manifest — it caches
// whatever the app fetches (same-origin GETs), so hashed Vite assets just work.
// ponytail: runtime cache, not precache. Add Workbox/precaching only if you need
// guaranteed-offline before first online visit or fine-grained cache control.

const CACHE = 'si-v1';
const START = new URL('./', self.location).href; // start_url — offline nav fallback.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only same-origin GETs: let the Google Identity script / Drive API pass through.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(START)))
  );
});
