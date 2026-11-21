/* =========================================================================
   Viajes (historiatotal.es/viajes) — trabajador para usar SIN COBERTURA (21-nov-2026).
   Lo escribe viajes-publico/hacer_version_publica.py como /viajes/sw.js. Basado en el sw.js de la App Mapas.
   · Mapas del IGN: primero la copia guardada; si no está, la red, y se guarda de paso (copia legible, no «opaca»).
     El IGN da sus mapas con licencia CC-BY 4.0 y permite su uso libre citando el origen.
   · Leaflet (cdnjs): primero la copia guardada.
   · La propia página y el catálogo: primero la red (con un tope de espera) y, si no hay, la copia guardada.
   · /api/ (cuadernos, viajes, visitas), carreteras, tiempo y buscadores: siempre a la red, nunca se guardan.
   · OpenStreetMap y otros mapas comunitarios: no se guardan (sus normas no lo permiten).
   ========================================================================= */
const APP = 'viajes-app-v1', TES = 'viajes-teselas-v1', LIB = 'viajes-lib-v1';
const VACIO = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9e6df"/>'
  + '<path d="M0 256L256 0M-128 256L256 -128M0 512L512 0" stroke="#ded9d0" stroke-width="1"/></svg>';
const sinTile = (req, st) => req.destination === 'image' ? new Response(VACIO, { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } })
  : new Response('tesela no disponible', { status: st || 504 });
const esImagen = r => { const t = (r.headers.get('content-type') || '').toLowerCase(); return t.startsWith('image/') && !t.includes('svg'); };
const conTope = (p, ms) => Promise.race([p, new Promise((_, mal) => setTimeout(() => mal(new Error('tope')), ms))]);

self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.add(new Request('./', { cache: 'reload' })).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  const n = await caches.keys(); await Promise.all(n.filter(x => x.startsWith('viajes-app-') && x !== APP).map(x => caches.delete(x))); await self.clients.claim(); })()); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)(openstreetmap\.org|openstreetmap\.fr|openmaps\.fr|waymarkedtrails\.org|tracestrack\.com)$/.test(url.hostname)) { e.respondWith(fetch(req).catch(() => sinTile(req, 504))); return; }
  /* --- mapas del IGN --- */
  if (/(^|\.)ign\.es$/.test(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(TES), hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      let res = null;
      try { res = await fetch(url.href, { mode: 'cors', credentials: 'omit' }); } catch (err) { res = null; }
      if (!res || !res.ok || !esImagen(res)) { if (req.mode !== 'cors') { try { res = await fetch(req); } catch (err) { res = null; } } }
      if (!res) return sinTile(req, 504);
      if (res.type !== 'opaque' && res.ok && esImagen(res)) {
        const b = await res.blob(), limpia = () => new Response(b, { headers: { 'Content-Type': b.type || 'image/jpeg', 'Content-Length': String(b.size) } });
        cache.put(url.href, limpia()).catch(() => {}); return limpia(); }
      if (res.type === 'opaque') return res;
      return sinTile(req, res.status); })());
    return; }
  /* --- Leaflet y su complemento (cdnjs) --- */
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith((async () => { const c = await caches.open(LIB), hit = await c.match(url.href); if (hit) return hit;
      let res = null; try { res = await fetch(url.href, { mode: 'cors', credentials: 'omit' }); } catch (err) { res = null; }
      if (res && res.ok) { c.put(url.href, res.clone()).catch(() => {}); return res; }
      return fetch(req); })());
    return; }
  /* --- la página y el catálogo de Viajes --- */
  if (url.origin === location.origin && url.pathname.includes('/viajes/') && !url.pathname.includes('/api/')) {
    e.respondWith((async () => {
      const cache = await caches.open(APP), clave = url.origin + url.pathname;   // sin «?v=…»
      try { const res = await conTope(fetch(req), navigator.onLine === false ? 1 : 6000);
        if (res && res.ok) { cache.put(clave, res.clone()).catch(() => {}); return res; }
        const hit = await caches.match(clave); return hit || res; }
      catch (err) { const hit = await caches.match(clave); return hit || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); } })());
  }
});
