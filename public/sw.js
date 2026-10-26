self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? "Seu descanso terminou." };
  }

  const title = typeof payload.title === "string" ? payload.title : "Descanso concluído";
  const url = typeof payload.url === "string" ? payload.url : "/treino/sessao";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "Pronto para continuar o treino.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: typeof payload.tag === "string" ? payload.tag : "bctrl-workout-rest",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || "/treino/sessao", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
      if (client) {
        if (client.url !== target) await client.navigate(target);
        await client.focus();
        return;
      }

      await self.clients.openWindow(target);
    }),
  );
});
