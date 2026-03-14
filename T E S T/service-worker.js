// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('game-hub-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/lib.js',
        '/hub.js',
        '/shared-styles.css',
        '/hubIndex.js'
      ]);
    })
  );
});
