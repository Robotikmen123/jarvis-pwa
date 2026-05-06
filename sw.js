// Network-first service worker — always tries the network so deploys reach
// users immediately, falling back to cache only when offline.
const CACHE = "jarvis-shell-v3";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./js/app.js",
  "./js/live.js",
  "./js/audio.js",
  "./js/hud.js",
  "./js/tools.js",
  "./js/config.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.protocol === "wss:" || url.protocol === "ws:") return;
  if (url.host.includes("googleapis.com")) return;
  if (url.host.includes("wttr.in")) return;

  // Network-first: try the network, cache the fresh response, fall back to
  // the cached copy only if offline.
  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request, { cache: "no-cache" });
      if (fresh && fresh.status === 200 && e.request.method === "GET") {
        const cache = await caches.open(CACHE);
        cache.put(e.request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      throw new Error("offline and not in cache");
    }
  })());
});
