/* SevaJyothi Service Worker — minimal app-shell cache + background sync.
   Registered only in production from src/components/providers/OfflineProvider. */
const CACHE = "sj-shell-v1";
const TILE_CACHE = "sj-tiles-v1";
const TILE_CACHE_MAX = 350; // ~10MB at avg 28KB per CARTO raster tile
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const TILE_HOSTS = /(^|\.)basemaps\.cartocdn\.com$|(^|\.)tile\.openstreetmap\.org$/;

async function trimCache(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length <= max) return;
  // FIFO eviction
  await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k.startsWith("sj-")).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isTile = TILE_HOSTS.test(url.hostname);
  if (isTile) {
    // Stale-while-revalidate for OSM/CARTO raster tiles. Cap ~350 entries.
    event.respondWith(
      caches.open(TILE_CACHE).then(async (c) => {
        const cached = await c.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && (res.status === 200 || res.type === "opaque")) {
              c.put(req, res.clone())
                .then(() => trimCache(TILE_CACHE, TILE_CACHE_MAX))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Cache-first for built static assets.
  if (/\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
            return res;
          }),
      ),
    );
  }
});

// Background Sync — notify clients so they can flush IndexedDB queues.
self.addEventListener("sync", (event) => {
  if (event.tag === "sj-flush-complaints") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "sj:sync-pending" }));
      }),
    );
  }
});
