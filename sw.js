// Service worker — app shell cache-first (Fase 1).
const CACHE = "mirrora-v5";
const SHELL = [
  "./",
  "index.html",
  "console.html",
  "css/mirrora.css",
  "css/console.css",
  "js/console.js",
  "js/app.js",
  "js/store.js",
  "js/analytics.js",
  "js/avatar.js",
  "js/qr-handoff.js",
  "js/data/brand.js",
  "js/data/catalog.js",
  "js/lib/qrcode.js",
  "manifest.webmanifest",
  "assets/icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
