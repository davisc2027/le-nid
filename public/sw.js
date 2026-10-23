// Le Nid service worker: web push + offline support for the app shell.
// Bump BIBLE_VERSION whenever public/bible changes so phones refetch the text.
const BIBLE_VERSION = "1";
const STATIC = "static-v1"; // hashed /_next/static files: kept across deploys so open sessions keep their chunks
const BIBLE = "bible-" + BIBLE_VERSION;
const PAGES = "pages-v3"; // only the shell URLs below, never RSC or admin pages
const REFERENCE = "reference-v1"; // volunteer recordings for the speaking feature
const KEEP = [STATIC, BIBLE, PAGES, REFERENCE];
const SHELL = ["/", "/itinerary", "/files", "/todos", "/learn"];
const MAX_STATIC = 120;
const MAX_BIBLE = 140;
const MAX_REFERENCE = 300;

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Le Nid", {
      body: data.body || "",
      icon: "/icons/192",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    }),
  );
});

const good = (res) => res && res.ok && !res.redirected;

async function trim(name, max) {
  try {
    const c = await caches.open(name);
    const keys = await c.keys();
    // keys() is in insertion order, so the oldest entries go first.
    for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
  } catch {}
}

async function remember(name, req, res, max) {
  try {
    const c = await caches.open(name);
    await c.put(req, res);
    if (max) await trim(name, max);
  } catch {}
}

self.addEventListener("install", (event) => {
  // Safe to take over at once: old chunks stay in STATIC, so a lesson that is open keeps working.
  self.skipWaiting();
  // Best effort: only caches pages when the person is signed in (redirects to /login are skipped).
  event.waitUntil(
    caches.open(PAGES).then((c) =>
      Promise.all(SHELL.map((u) => fetch(u, { credentials: "same-origin" }).then((r) => good(r) && c.put(u, r)).catch(() => {}))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear") event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const p = url.pathname;

  // Hashed build files never change for a given URL: cache-first.
  if (p.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req, { cacheName: STATIC }).then((hit) => hit || fetch(req).then((res) => {
        if (good(res)) event.waitUntil(remember(STATIC, req, res.clone(), MAX_STATIC));
        return res;
      })),
    );
    return;
  }

  // Reference recordings: the manifest is network-first (new files show up at once), the clips are cache-first on
  // the full URL, which carries ?v=<hash>, so a re-recorded file is a new entry. Range requests skip the worker.
  if (p === "/reference/manifest.json") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (good(res)) event.waitUntil(remember(REFERENCE, req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { cacheName: REFERENCE }).then((hit) => hit || Response.error())),
    );
    return;
  }
  if (p.startsWith("/reference/")) {
    if (req.headers.has("range")) return;
    event.respondWith(
      caches.match(req, { cacheName: REFERENCE }).then((hit) => hit || fetch(req).then((res) => {
        if (good(res)) event.waitUntil(remember(REFERENCE, req, res.clone(), MAX_REFERENCE));
        return res;
      })),
    );
    return;
  }

  // Bible text: cache-first within a versioned cache (a new BIBLE_VERSION starts fresh).
  if (p.startsWith("/bible/")) {
    event.respondWith(
      caches.match(req, { cacheName: BIBLE }).then((hit) => hit || fetch(req).then((res) => {
        if (good(res)) event.waitUntil(remember(BIBLE, req, res.clone(), MAX_BIBLE));
        return res;
      })),
    );
    return;
  }

  // Everything else (RSC payloads and prefetches, APIs, auth, files, admin) goes straight to the network.
  if (req.mode !== "navigate" || req.headers.get("RSC") === "1") return;
  if (p.startsWith("/api/") || p.startsWith("/auth") || p.startsWith("/login") || p.startsWith("/files/")) return;

  const shell = SHELL.includes(p);
  // Page loads: network-first; offline falls back to the cached shell page, else the cached Home page.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (shell && good(res)) event.waitUntil(remember(PAGES, p, res.clone()));
        return res;
      })
      .catch(() =>
        caches.match(p, { cacheName: PAGES }).then((r) =>
          r || caches.match("/", { cacheName: PAGES }) || Response.error()).then((r) => r || Response.error()),
      ),
  );
});
