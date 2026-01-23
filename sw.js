const CACHE_NAME = "moti-v2"; // ⬅️ שינוי גרסה = טריגר לעדכון
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting(); // ⬅️ מפעיל מייד גרסה חדשה
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // ⬅️ משתלט מייד על האפליקציה
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});
