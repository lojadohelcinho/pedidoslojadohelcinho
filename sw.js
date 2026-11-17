self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('helcinho-admin-v1').then((cache) => {
      return cache.addAll([
        'admin.html',
        'logohelcinho.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
