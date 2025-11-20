self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? JSON.parse(event.data.text()) : {} } catch {}
  const title = data.title || 'Study Planner'
  const body = data.body || '收到一条通知'
  const options = {
    body,
    icon: data.icon || undefined,
    data,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (allClients.length > 0) {
      const client = allClients[0]
      client.focus()
    } else {
      clients.openWindow('/')
    }
  })())
})
