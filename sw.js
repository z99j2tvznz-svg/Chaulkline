// Chalkline service worker: makes the V3 page "cross-origin isolated", which Safari requires before a page may use
// several processor cores at once (the ball finder runs about 3x faster on 4 cores). GitHub Pages cannot send the two
// headers that do this, so this worker adds them to the site's own files as they arrive. Nothing is cached or changed:
// every request still goes to the network. The V2.3.3 page (/v2/) and the check page (/check/) are left alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, url = new URL(r.url);
  if (url.origin !== self.location.origin || /\/(v2|check|archive)\//.test(url.pathname)) return;
  if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
  e.respondWith(fetch(r).then(res => {
    if (!res || res.status === 0 || res.type === 'opaque') return res;
    const h = new Headers(res.headers);
    h.set('Cross-Origin-Embedder-Policy', 'require-corp');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }));
});
