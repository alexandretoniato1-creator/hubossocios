// Hub Os Sócios — Service Worker com Web Push
const CACHE_NAME = 'hub-v3';

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

// Só aceita links internos do hub (ex.: "/conversas:12"); qualquer outra coisa abre o Início
function paginaDe(url) {
  const p = String(url || '').replace(/^.*\//, '');
  return /^[a-z]+(:[A-Za-z0-9_-]+)?$/.test(p) ? p : '';
}

// ── PUSH RECEBIDO (app fechado ou aberto) ──
self.addEventListener('push', e => {
  let data = { title: 'Hub Os Sócios', body: '', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  const pagina = paginaDe(data.url);
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-badge-96.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    // Um aviso por assunto: mensagens da mesma conversa se agrupam, assuntos diferentes não se apagam
    tag: 'hub-' + (pagina || 'geral'),
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
  const pagina = paginaDe(url);

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já tem uma janela aberta, foca ela e navega para a página do aviso
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', url });
          return;
        }
      }
      // Senão abre o hub já na página do aviso
      if (clients.openWindow) return clients.openWindow(pagina ? '/?p=' + encodeURIComponent(pagina) : '/');
    })
  );
});

// ── FETCH: sempre busca da rede (o hub precisa estar atualizado); sem rede, usa o que tiver guardado ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
