// Service Worker para receber push notifications com VAPID
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
