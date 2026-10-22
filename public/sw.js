// Le Nid service worker: web push + offline support for the app shell.
const CACHE = "le-nid-v2";
const SHELL = ["/", "/itinerary", "/files", "/todos", "/learn"];

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

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Best effort: only caches pages when the person is signed in (redirects to /login are skipped).
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((u) => fetch(u, { credentials: "same-origin" }).then((r) => good(r) && c.put(u, r)).catch(() => {}))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => clients.claim()),
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

  // Static assets never change for a given URL: cache-first.
  if (p.startsWith("/_next/static/") || p.startsWith("/bible/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (good(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  const isPage = req.mode === "navigate" || req.headers.get("RSC") === "1";
  if (!isPage || p.startsWith("/api/") || p.startsWith("/auth") || p.startsWith("/login")) return;

  // Pages and Next client navigations: network-first, last good copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (good(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((r) =>
          r || (req.mode === "navigate" ? caches.match("/") : null) || Response.error()),
      ),
  );
});
