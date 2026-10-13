/* JOBLIO service worker — hand-written (no build step) so it works with Turbopack.
 *
 *   pages (navigations)      network first → cached copy → /offline.html
 *   /_next/static/* (JS/CSS/fonts, content-hashed)   cache first
 *   images (<img> requests, /_next/image)             stale-while-revalidate
 *   never cached: non-GET (server actions), /api/*, RSC/prefetch requests,
 *                 /_vercel/* (analytics), cross-origin requests, this file.
 *
 * Bump VERSION to drop every cache on the next deploy.
 */
const VERSION = "v1";
const PRECACHE = `joblio-precache-${VERSION}`;
const PAGES = `joblio-pages-${VERSION}`;
const STATIC = `joblio-static-${VERSION}`;
const IMAGES = `joblio-images-${VERSION}`;
const KEEP = [PRECACHE, PAGES, STATIC, IMAGES];
const OFFLINE_URL = "/offline.html";
const MAX_PAGES = 50;
const MAX_IMAGES = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("joblio-") && !KEEP.includes(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

// Signing out (or switching accounts) wipes the cached pages — they hold personal data.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-pages") {
    event.waitUntil(caches.delete(PAGES));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function isRsc(request, url) {
  return request.headers.get("RSC") === "1" || request.headers.has("Next-Router-Prefetch") || url.searchParams.has("_rsc");
}

async function networkFirstPage(event) {
  const { request } = event;
  try {
    const response = (await event.preloadResponse) || (await fetch(request));
    // Only keep complete, final HTML pages (not redirects to sign-in, errors, or 404s).
    const type = response.headers.get("Content-Type") || "";
    if (response.ok && !response.redirected && response.type === "basic" && type.includes("text/html")) {
      const copy = response.clone();
      event.waitUntil(
        caches
          .open(PAGES)
          .then((cache) => cache.put(request, copy))
          .then(() => trim(PAGES, MAX_PAGES)),
      );
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: PAGES, ignoreVary: true });
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function staleWhileRevalidate(event, cacheName, max) {
  const { request } = event;
  const cached = await caches.match(request, { cacheName });
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
        await trim(cacheName, max);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network.then(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // server actions, uploads, sign-in/out
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith("/api/") || path.startsWith("/_vercel/") || path === "/sw.js") return;

  if (request.mode === "navigate") {
    if (isRsc(request, url)) return;
    event.respondWith(networkFirstPage(event));
    return;
  }
  if (isRsc(request, url)) return; // client-side navigation payloads stay live

  if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  // Images only — never other /media files such as CVs.
  if (request.destination === "image" || path.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(event, IMAGES, MAX_IMAGES));
    return;
  }
  if (request.destination === "font") {
    event.respondWith(cacheFirst(request, STATIC));
  }
});
