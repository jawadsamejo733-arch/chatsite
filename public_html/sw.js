/* ChatSite service worker: lets phones show message notifications while the app is in the background. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chat = event.notification.data && event.notification.data.chat;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        if (chat) w.postMessage({ type: 'open-chat', chat });
        return;
      }
    }
    await self.clients.openWindow('./' + (chat ? '#/c/' + chat : ''));
  })());
});
