// Service Worker para receber push notifications com VAPID
// Versão do cache - atualizado automaticamente a cada build
const CACHE_VERSION = 'v__BUILD_TIME__';
const CACHE_NAME = `agriroute-cache-${CACHE_VERSION}`;

// Workbox precache manifest injection point
const precacheManifest = self.__WB_MANIFEST || [];

// Limpar caches antigos ao ativar nova versão
self.addEventListener('activate', function(event) {
  console.log('[SW] Ativando nova versão:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Deletar todos os caches que não sejam a versão atual
          if (cacheName.startsWith('agriroute-cache-') && cacheName !== CACHE_NAME) {
            console.log('[SW] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Forçar todos os clientes a usar a nova versão
      return self.clients.claim();
    })
  );
});

// Forçar atualização imediata quando nova versão é detectada
self.addEventListener('install', function(event) {
  console.log('[SW] Instalando nova versão:', CACHE_VERSION);
  // Pular waiting e ativar imediatamente
  self.skipWaiting();
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push notification received:', event);
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nova Notificação - AGRIROUTE';
  
  // Ícone baseado no tipo de notificação
  let icon = '/android-chrome-192x192.png';
  if (data.type === 'new_proposal') icon = '/android-chrome-192x192.png';
  if (data.type === 'proposal_accepted') icon = '/android-chrome-192x192.png';
  if (data.type === 'location_request') icon = '/android-chrome-192x192.png';
  
  const options = {
    body: data.message || '',
    icon: icon,
    badge: '/android-chrome-192x192.png',
    data: data.data || {},
    tag: data.type || 'notification',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    renotify: true,
    silent: false
  };

  // Tocar som de notificação
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('[SW] Audio play blocked:', e));
  } catch (e) {
    console.log('[SW] Audio error:', e);
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true})
      .then(function(clientList) {
        // Se já existe uma janela aberta, focar nela
        for (let client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Se não, abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
