// Le Nid service worker: web push + offline support for the app shell.
// Bump BIBLE_VERSION whenever public/bible changes so phones refetch the text.
const BIBLE_VERSION = "1";
const STATIC = "static-v1"; // hashed /_next/static files: kept across deploys so open sessions keep their chunks
const BIBLE = "bible-" + BIBLE_VERSION;
const PAGES = "pages-v6"; // only the shell URLs below, never RSC or admin pages
const REFERENCE = "reference-v1"; // volunteer recordings for the speaking feature
const KEEP = [STATIC, BIBLE, PAGES, REFERENCE];
const SHELL = ["/", "/itinerary", "/files", "/todos", "/learn", "/learn/three-circles", "/learn/three-circles/show"];
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

// Shown when a page can't be loaded and there is no saved copy of it. Built here because /offline.html would need a login.
const offlinePage = () => new Response(
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Can't reach Le Nid</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;font:16px/1.5 -apple-system,system-ui,sans-serif;background:#faf5ec;color:#2b2118;text-align:center}
@media (prefers-color-scheme:dark){body{background:#1d1612;color:#f3e9dd}}
main{max-width:340px}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 14px}b{color:#a8412e}
button{min-height:48px;width:100%;border:0;border-radius:14px;background:#a8412e;color:#fff;font:800 16px inherit;font-family:inherit}</style></head>
<body><main><h1>Can't reach Le Nid</h1><p>This page didn't load. If you're on Wi-Fi, try switching to <b>cellular data</b> (some Wi-Fi networks block the app), then tap Try again.</p>
<button onclick="location.reload()">Try again</button></main></body></html>`,
  { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
);

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
        // Offline: the cached copy of this page. Only the shell pages may fall back to the cached Home page; anything
        // else (Translate, lessons...) gets the "Can't reach Le Nid" page, so a dropped connection never looks like
        // the app "kicked you back to Home" while the address still says /translate.
        caches.match(p, { cacheName: PAGES }).then((r) =>
          r || (shell ? caches.match("/", { cacheName: PAGES }) : null)).then((r) => r || offlinePage()),
      ),
  );
});
