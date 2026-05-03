// Hub Os Sócios — Service Worker com Web Push
const CACHE_NAME = 'hub-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── PUSH RECEBIDO (app fechado ou aberto) ──
self.addEventListener('push', e => {
  let data = { title: 'Hub Os Sócios', body: '', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: '/icone-192.png',
    badge: '/icone-72.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'hub-notif',
    renotify: true,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Ignorar' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── CLIQUE NA NOTIFICAÇÃO ──
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const url = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já tem uma janela aberta, foca ela
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', url });
          return;
        }
      }
      // Senão abre nova janela
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ── FETCH (cache básico para PWA offline) ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
