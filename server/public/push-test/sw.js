self.addEventListener('install', (event) => {
  // Activate immediately for dev
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      const text = event.data.text();
      data = JSON.parse(text);
    }
  } catch (e) {
    // ignore parse errors
  }
  const title = data.title || 'Study Planner';
  const body = data.body || '你有一条新通知';
  const options = {
    body,
    data,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/push-test/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
