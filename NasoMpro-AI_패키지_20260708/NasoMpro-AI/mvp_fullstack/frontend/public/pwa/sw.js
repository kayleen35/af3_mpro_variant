const CACHE = "nasalmpro-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./albumin.html",
  "./manifest.json",
  "./reference_actives.json",
  "./mpro_library_web.json",
  "./qsar_model.json",
  "./agent_library.json",
  "./validation.json",
  "https://cdn.jsdelivr.net/npm/@rdkit/rdkit/dist/RDKit_minimal.js",
  "https://cdn.jsdelivr.net/npm/@rdkit/rdkit/dist/RDKit_minimal.wasm"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
