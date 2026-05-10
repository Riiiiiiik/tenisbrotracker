// Service Worker — Court Clash PWA
// Cache estático + notificação de atualização

const CACHE_NAME = "court-clash-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./tournament.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Instala e faz cache dos assets estáticos
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // Não chama skipWaiting() aqui — esperamos o usuário decidir atualizar
});

// Limpa caches antigos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Quando o app manda mensagem para pular a espera
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-first para API, cache-first para assets estáticos
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Requisições à API sempre vão para a rede
  if (url.origin !== location.origin) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
