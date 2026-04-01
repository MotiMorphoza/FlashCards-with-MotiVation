try {
  importScripts("./sw-assets.js");
} catch (error) {
  console.warn("Generated service-worker asset manifest could not be loaded.", error);
}

const CACHE_NAME = "llh-core-v19";
const ASSETS = Array.isArray(self.APP_SHELL_ASSETS) && self.APP_SHELL_ASSETS.length > 0
  ? self.APP_SHELL_ASSETS
  : [
      "./",
      "./index.html",
      "./manifest.json",
      "./styles.css",
      "./hubIndex.js",
      "./core/hubManager.js",
    ];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isHubMetadataRequest = requestUrl.pathname.endsWith("/hubIndex.js");
  const isHubContentRequest = requestUrl.pathname.includes("/hub/");
  const isAppShellRequest =
    isSameOrigin &&
    (event.request.mode === "navigate" ||
      /\.(?:html|css|js|json)$/i.test(requestUrl.pathname));

  if (isHubMetadataRequest || isHubContentRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  if (isAppShellRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (isSameOrigin && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
