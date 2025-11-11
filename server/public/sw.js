'use strict';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Notification';
    const options = {
      body: data.body || '',
      data,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {
    const text = event.data ? event.data.text() : '';
    event.waitUntil(self.registration.showNotification('Notification', { body: text }));
  }
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of allClients) {
      if ('focus' in c) { c.focus(); return; }
    }
    if (clients.openWindow) await clients.openWindow(url);
  })());
});
