// Hub Os Sócios — Service Worker com Web Push
const CACHE_NAME = 'hub-v4';

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

// O hub avisa quando uma conversa foi lida: some a notificação dela (como no WhatsApp)
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'hub-limpar-conversa' && d.id) {
    e.waitUntil(self.registration.getNotifications({ tag: 'hub-conversa-' + d.id }).then(ns => ns.forEach(n => n.close())));
  }
});

// ── PUSH RECEBIDO (app fechado ou aberto) ──
self.addEventListener('push', e => {
  let data = { title: 'Hub Os Sócios', body: '', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  e.waitUntil((async () => {
    const pagina = paginaDe(data.url);
    let title = data.title, body = data.body, tag = 'hub-' + (pagina || 'geral'), extra = {};

    if (data.conversa && data.conversa.id) {
      // Hub aberto e na tela: a mensagem aparece lá dentro, não precisa tocar o celular
      const janelas = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      // (no iPhone/Safari o aviso sempre aparece: lá, um push sem notificação pode desligar os avisos)
      const ua = (self.navigator && self.navigator.userAgent) || '';
      const safari = /iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Android|Edg/.test(ua));
      if (!safari && janelas.some(c => c.focused && c.visibilityState === 'visible')) return;
      // Uma notificação por conversa, juntando as últimas mensagens
      tag = 'hub-conversa-' + data.conversa.id;
      const anteriores = await self.registration.getNotifications({ tag });
      const prev = (anteriores[0] && anteriores[0].data) || {};
      const linhas = [...(prev.linhas || []), data.conversa.linha].slice(-6);
      const n = (prev.n || 0) + 1;
      if (n > 1) { title = `${data.conversa.titulo} (${n} mensagens)`; body = linhas.join('\n'); }
      extra = { linhas, n };
    }

    await self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-badge-96.png',
      data: { url: data.url || '/', ...extra },
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag,
      renotify: true,
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Ignorar' }
      ]
    });
  })());
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
