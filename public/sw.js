const C = "lilith-v1",
  OK = (u) => u.origin === location.origin || u.hostname === "www.gstatic.com";
const SHELL = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/config.js",
  "/js/lib/format.js",
  "/js/lib/prayer-times.js",
  "/js/storage/index.js",
  "/js/storage/local.js",
  "/js/storage/firebase.js",
  "/manifest.json",
  "/peta.html",
  "/js/peta.js",
  "/vendor/maplibre-gl.css",
  "/vendor/maplibre-gl-csp.js",
  "/vendor/maplibre-gl-csp-worker.js",
  "/asset/icon-192.png",
  "/asset/icon-512.png",
  "/asset/favicon-64.png",
];
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then((k) => Promise.allSettled(SHELL.map((u) => k.add(u)))));
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))
      .then(() => clients.claim()),
  ),
);
const net = (r, ms) =>
  new Promise((ok, no) => {
    const t = setTimeout(() => no("timeout"), ms);
    fetch(r).then(
      (x) => {
        clearTimeout(t);
        ok(x);
      },
      (e) => {
        clearTimeout(t);
        no(e);
      },
    );
  });
// Jaringan dulu (maks 4 detik, agar tidak menggantung di sinyal lemah) (agar update langsung tampil), cadangan dari cache saat offline. Data keuangan TIDAK disimpan di sini.
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (r.method !== "GET" || !OK(u)) return;
  e.respondWith(
    net(r, 4000)
      .then((res) => {
        if (res.ok) {
          const c = res.clone();
          caches.open(C).then((k) => k.put(r, c));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(r, { ignoreSearch: true })
          .then(
            (m) =>
              m ||
              (r.mode === "navigate"
                ? caches.match("/index.html").then((x) => x || caches.match("/"))
                : Response.error()),
          ),
      ),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window" })
      .then((l) => (l.length ? l[0].focus() : clients.openWindow("/"))),
  );
});
