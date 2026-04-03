// Minimal service worker for push notifications
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then((cl) => {
    if (cl.length) return cl[0].focus();
    return clients.openWindow("/");
  }));
});
