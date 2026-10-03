// Service worker: makes the game installable and playable offline.
const CACHE = 'bus-puzzle-v1';

// On install, cache the page and every file it links to, so the first offline start already works.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('./', { cache: 'no-cache' });
      const html = await page.clone().text();
      await cache.put('./', page);
      const links = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((url) => !/^[a-z]+:/i.test(url));
      await Promise.all(links.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // The page itself: prefer the network so a new version shows up, fall back to the cached copy offline.
      if (request.mode === 'navigate') {
        try {
          const fresh = await fetch(request);
          cache.put('./', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('./')) ?? Response.error();
        }
      }
      // Everything else is fingerprinted by the build, so a cached copy never goes stale.
      const hit = await cache.match(request);
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })(),
  );
});
