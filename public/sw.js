self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("expense-reminders-v1").then((cache) =>
      cache.addAll(["/", "/manifest.webmanifest", "/icon.svg"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("/"));
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Expense Reminders",
    body: "Tienes gastos por revisar.",
    url: "/",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
