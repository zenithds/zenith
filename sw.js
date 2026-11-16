// Zenith offline cache. Bump VERSION when you upload new files.
const VERSION = 'zenith-v2';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const withTimeout = (p, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase traffic is left alone
  const fresh = () =>
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    });
  // The page and config.js: try the network first so updates arrive, fall back to the cache offline.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/config.js') || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      withTimeout(fresh(), 3500).catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')),
      ),
    );
    return;
  }
  // Icons and the rest: cache first.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((cached) => cached || fresh()));
});
