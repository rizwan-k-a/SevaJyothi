/* SevaJyothi — dedicated Web Push messaging worker.
 * Scope: /push-sw.js. Does NOT cache HTML, does NOT control app navigation.
 * Only handles `push` and `notificationclick` events. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "SevaJyothi", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SevaJyothi";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || payload.complaint_id || "sevajyothi",
    renotify: true,
    data: {
      url: payload.url || "/",
      complaint_id: payload.complaint_id || null,
      type: payload.type || null,
    },
    // Keep the OS chrome minimal and clear
    requireInteraction: payload.priority === "critical",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus an existing tab if same-origin and route matches
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            client.postMessage({ type: "push:navigate", url: targetUrl });
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
