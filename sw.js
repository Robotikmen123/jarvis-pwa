// Minimal service worker — caches the app shell so the PWA opens offline.
// Network calls (Gemini Live, weather, etc.) always go to the network.
const CACHE = "jarvis-shell-v1";
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache the WebSocket or API calls
  if (url.protocol === "wss:" || url.protocol === "ws:") return;
  if (url.host.includes("googleapis.com")) return;

  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => hit))
  );
});
