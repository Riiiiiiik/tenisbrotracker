// Service Worker — Court Clash PWA
// Cache estático + Push Notifications + Atualização

const CACHE_NAME = "court-clash-v12";

// Altere este texto a cada deploy para descrever o que mudou
const UPDATE_NOTES = "Correcao de notificacao duplicada e editar foto de jogadores.";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./session.js",
  "./tournament.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Instala, faz cache dos assets e força ativação imediata
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // Ativa imediatamente sem esperar (importante para iOS)
  self.skipWaiting();
});

// Limpa caches antigos e assume controle de todas as abas
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fallback para mensagem manual (caso futuro)
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push Notification recebida ────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = { title: "Court Clash", body: "Nova atualização!", icon: "./icon-192.png" };

  if (e.data) {
    try {
      data = { ...data, ...e.data.json() };
    } catch {
      data.body = e.data.text();
    }
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [200, 100, 200],
      data: data.url || "/",
      actions: data.actions || [],
    })
  );
});

// Ao clicar na notificação, abre o app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Se já tem uma aba aberta, foca nela
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Senão, abre nova aba
      return clients.openWindow(e.notification.data || "/");
    })
  );
});

// Network-first para API, cache-first para assets estáticos
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

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
