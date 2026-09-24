const cacheVersion = new URL(self.location.href).searchParams.get('v') || 'local';
const cacheName = `his-static-shell-${cacheVersion}`;
const staticCdnHosts = new Set([
  'code.jquery.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);
const offlinePartials = [
  '/partials/navbar.html',
  '/partials/views/offline_sticker.html',
  '/partials/print-areas.html'
];

async function fetchAndCache(cache, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const parsed = new URL(url, self.location.origin);
    const request = new Request(parsed.href, {
      cache: 'reload',
      mode: parsed.origin === self.location.origin ? 'same-origin' : 'no-cors',
      signal: controller.signal
    });
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
  } catch {
    // Optional CDN assets must not prevent the offline shell from installing.
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const response = await fetch('/index.html', { cache: 'reload' });
    if (!response.ok) throw new Error('Unable to cache the app shell');
    await cache.put('/', response.clone());
    await cache.put('/index.html', response.clone());

    const html = await response.text();
    const discoveredAssets = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
      .map(match => match[1])
      .filter(value => value.startsWith('/') || staticCdnHosts.has(new URL(value, self.location.origin).hostname));
    const assets = new Set([
      ...offlinePartials,
      '/version.json',
      '/luckxay-logo.jpg',
      ...discoveredAssets
    ]);
    await Promise.allSettled([...assets].map(url => fetchAndCache(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('his-static-shell-') && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, cache, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (fallbackUrl) await cache.put(fallbackUrl, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request))
      || (fallbackUrl ? await cache.match(fallbackUrl) : null)
      || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isCdnAsset = staticCdnHosts.has(url.hostname)
    && ['script', 'style', 'font'].includes(request.destination);
  const isLocalStatic = url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/partials/')
    || ['/version.json', '/luckxay-logo.jpg'].includes(url.pathname)
  );
  if (!isNavigation && !isCdnAsset && !isLocalStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (isNavigation) return networkFirst(request, cache, '/index.html');

    const cached = await cache.match(request, {
      ignoreSearch: url.origin === self.location.origin && url.pathname.startsWith('/partials/')
    });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
