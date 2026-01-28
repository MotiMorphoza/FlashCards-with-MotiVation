const CACHE_NAME = "FC with Moti Vation V280126";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});

self.addEventListener("message", event => {
  if (event.data === "GET_CACHE_NAME") {
    event.ports[0].postMessage(CACHE_NAME);
  }
});

/* ===== HUB CSV CACHE ===== */

const HUB_CACHE = "hub-csv-v1";

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // רק קבצי CSV מה-HUB
  if (
    url.pathname.startsWith("/hub/") &&
    url.pathname.endsWith(".csv")
  ) {
    event.respondWith(
      networkFirstCsv(event.request)
    );
  }
});

async function networkFirstCsv(request){
  const cache = await caches.open(HUB_CACHE);

  try{
    const fresh = await fetch(request);
    if(fresh && fresh.ok){
      cache.put(request, fresh.clone());
      return fresh;
    }
    throw new Error("Network response not ok");
  }catch(e){
    const cached = await cache.match(request);
    if(cached){
      return cached;
    }
    // אין רשת ואין cache
    return new Response("", { status: 504 });
  }
}

