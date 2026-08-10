/* ==========================================================================
   sw.js — offline support
   Caches the application's own files so LUMEN opens without a connection.
   It never sees or stores a word of your journal: entries live in the
   browser's local storage and are never fetched over the network, so nothing
   here has any journal content to cache.

   Strategy is network-first with a short timeout. Online, you always get the
   current version — no stale build to clear. Offline or on a flaky
   connection, the request falls back to the cache almost immediately.

   NOTE: if you add a file to the app, add it to PRECACHE too, or it won't be
   there offline.
   ========================================================================== */

const VERSION = "lumen-v1";
const NETWORK_TIMEOUT = 2500;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./styles/tokens.css",
  "./styles/lumen.css",
  "./js/app.js",
  "./js/router.js",
  "./js/store.js",
  "./js/media.js",
  "./js/prompts.js",
  "./js/components/calendar.js",
  "./js/components/polaroid.js",
  "./js/components/settings.js",
  "./js/data/demo.js",
  "./js/utils/date.js",
  "./js/utils/dom.js",
  "./js/utils/text.js",
  "./js/views/editor.js",
  "./js/views/entry.js",
  "./js/views/journal.js",
  "./js/views/onboarding.js",
  "./js/views/reflections.js",
  "./js/views/today.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One at a time: a single missing file shouldn't fail the whole install
    // and leave the app with no offline support at all.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);

  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    // A redirected response can't be stored against a navigation request.
    if (response.ok && !response.redirected) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Any in-app route is the same document; hand back the shell.
    if (request.mode === "navigate") {
      const shell = await cache.match(new URL("./index.html", self.location).href);
      if (shell) return shell;
    }
    throw error;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("network timed out")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}
