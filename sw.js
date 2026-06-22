// sw.js — Service Worker "network-first": sempre busca a versão mais nova do servidor
// (ignora o cache do navegador) e só usa cache como reserva quando estiver offline.
// Resolve o problema de ver versão antiga após cada deploy sem precisar de hard refresh.
const CACHE = 'gpr-cache-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // CDNs (chart.js, etc.) seguem o fluxo normal
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((resp) => {
        if (resp && resp.ok) { const clone = resp.clone(); caches.open(CACHE).then((c) => c.put(req, clone)); }
        return resp;
      })
      .catch(() => caches.match(req))            // offline → última versão guardada
  );
});
