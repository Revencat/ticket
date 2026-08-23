const CACHE = "ticketbox-v3";
const CORE = ["/index.html", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // Navegaciones: SIEMPRE se pide el HTML nuevo al servidor (cache: "no-cache"
  // obliga a revalidar). Solo si no hay red se sirve la última copia guardada.
  // Así la app nunca se queda clavada en una versión antigua.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(new Request(req, { cache: "no-cache" }))
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match("/index.html")
            .then((hit) => hit || caches.match("/"))
            .then((hit2) => hit2 || new Response("", { status: 504, statusText: "Offline" }))
        )
    );
    return;
  }

  // Recursos (JS, CSS, fuentes…): primero la red; si falla, la copia en caché.
  // Los assets de Vite llevan hash en el nombre, así que nunca hay colisiones.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});
