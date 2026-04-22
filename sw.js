/* ═══ Markly Service Worker ═══
   Strategy:
   - App shell (HTML/CSS/JS) + CDN scripts: cache-first.
   - Remote data (bookmarks.yaml, dead-links.json, tags.json): network-first,
     fallback to cache so the app works fully offline once loaded.
   - Google Fonts: network-first (degrades to system fonts when offline).
   - Favicons (google favicon service): network-first; silent fallback (broken
     images are already hidden by the app).

   On install the shell is pre-cached; CDN resources are pre-fetched
   best-effort so they don't abort the install if a CDN is slow or blocked. */

const CACHE_VERSION = "v1";
const SHELL_CACHE   = `markly-shell-${CACHE_VERSION}`;
const DATA_CACHE    = `markly-data-${CACHE_VERSION}`;

const SHELL_URLS = [
  "./",
  "./index.html",
  "./export.html",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/css/base.css",
  "./assets/css/main.css",
  "./assets/css/sidebar.css",
  "./assets/css/modal.css",
  "./assets/css/export.css",
  "./assets/js/config.js",
  "./assets/js/helpers.js",
  "./assets/js/data.js",
  "./assets/js/render.js",
  "./assets/js/actions.js",
  "./assets/js/export.js",
];

// Pre-cached best-effort: failures won't abort install but will mean these
// resources require a network hit on first offline use.
const CDN_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js",
  "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(SHELL_URLS);
      await Promise.allSettled(
        CDN_URLS.map((url) =>
          fetch(url)
            .then((r) => { if (r.ok) cache.put(url, r); })
            .catch(() => {})
        )
      );
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Remote data: network-first so the app always shows fresh bookmarks when
  // online, but falls back to the last-good cached response when offline.
  if (
    url.hostname === "raw.githubusercontent.com" ||
    url.pathname.endsWith(".yaml") ||
    url.pathname.endsWith(".json")
  ) {
    e.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Google Fonts: network-first (cache for offline fallback).
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Favicon service: network-first, silent failure (broken images are hidden).
  if (url.hostname === "www.google.com" && url.pathname.startsWith("/s2/favicons")) {
    e.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // App shell and CDN scripts: cache-first.
  e.respondWith(cacheFirst(request, SHELL_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — resource not cached", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response("Offline — resource not cached", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
