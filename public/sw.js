self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || "/treino/sessao", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((item) => new URL(item.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        return;
      }

      await self.clients.openWindow(target);
    }),
  );
});
