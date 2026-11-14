/* ============================================================================
   📓 CUADERNOS DE VIAJE  (idea de Carlos, 15-nov-2026)

   Vas a una zona, ves un sitio, te gusta → «📓 Al cuaderno» → a uno que ya
   tengas o a uno nuevo (nombre + fecha). La pestaña «📓 Cuadernos» enseña tus
   cuadernos y sus destinos; cada cuaderno se comparte por WhatsApp o correo y
   se descarga como GPX (rutas + sitios como puntos).

   Va en un fichero aparte para no tocar catalogo.html más que con una línea.
   Sirve igual para la App Mapas de Carlos y para Viajes (historiatotal.es):
     - App Mapas:  se guarda en el navegador y se sincroniza con su GitHub
                   (sync/cuadernos.json, con el mismo permiso que las correcciones).
     - Viajes:     window.CUAD_PUBLICO = true (lo pone hacer_version_publica.py).
                   Se guarda en el aparato («hk_cuadernos»). Con
                   window.CUAD_SYNC_HT = true, además con el código de usuario
                   de historiatotal.es — NO activarlo hasta que api/sync.php
                   junte por campos (si no, borraría los datos del usuario).

   Cada cuaderno: {id, nombre, creado, t, borrado?, s:{ idSitio: {...} }}.
   Cada destino guarda nombre, capa, tipo, municipio y posición, para no
   perderse aunque el sitio salga del catálogo. Lo borrado se MARCA (borrado +
   fecha) para que no «resucite» desde otro aparato; al juntar gana lo más nuevo.
   ========================================================================== */
(function () {
  const PUB = !!window.CUAD_PUBLICO;
  const SYNC_HT = PUB && !!window.CUAD_SYNC_HT;
  const CLAVE = PUB ? 'hk_cuadernos' : 'mapas.cuadernos';
  const LIM = 200 * 1024;
  const GH_RUTA = 'sync/cuadernos.json';

  /* ---------- datos ---------- */
  function lee() {
    try { const d = JSON.parse(window.localStorage.getItem(CLAVE) || 'null'); if (d && d.c) return d; } catch (e) {}
    return { v: 1, c: {} };
  }
  let C = lee();
  const ahora = () => Date.now();
  const nuevoId = () => ahora().toString(36) + Math.random().toString(36).slice(2, 6);
  const vivos = () => Object.values(C.c).filter(c => !c.borrado).sort((a, b) => (b.t || 0) - (a.t || 0));
  const items = c => Object.values(c.s || {}).filter(s => !s.borrado).sort((a, b) => (a.o || 0) - (b.o || 0));
  const fechaTxt = ms => new Date(ms).toLocaleDateString('es');

  function guarda() {
    const s = JSON.stringify(C);
    if (s.length > LIM) { avisa('📓 Los cuadernos ya ocupan demasiado: borra alguno que no uses.', 6000); return false; }
    try { window.localStorage.setItem(CLAVE, s); }
    catch (e) { avisa('📓 Este navegador no deja guardar los cuadernos.', 5000); return false; }
    pintaPestana(); programaSubida(); return true;
  }

  /* ---------- el sitio de la ficha abierta ---------- */
  let ACT = null;              // destino listo para guardar (foto del sitio)
  function fotoDe(p) {
    const f = (typeof F !== 'undefined' && F[p[0]]) || {};
    return { id: p[0], n: p[2], c: p[1], tp: String(p[3] || '').replace(/_/g, ' '), la: +p[4], lo: +p[5], m: f.municipio || '' };
  }
  function fotoPat(i) {
    const u = PT[i]; if (!u) return null;
    return { id: 'o@' + (+u[0]).toFixed(5) + ',' + (+u[1]).toFixed(5), n: u[3], c: 'o', tp: (PAT[u[2]] || [, ''])[1], la: +u[0], lo: +u[1], m: u[4] || '' };
  }
  const dondeEsta = id => vivos().filter(c => c.s && c.s[id] && !c.s[id].borrado);

  let volverACuadernos = false;
  function ponBoton() {
    const sh = document.getElementById('sheet'); if (!ACT || !sh || !sh.classList.contains('on')) return;
    const bs = sh.querySelectorAll('.btns'); const b = bs[bs.length - 1]; if (!b || b.querySelector('.cuad-b')) return;
    const en = dondeEsta(ACT.id);
    const x = document.createElement('button'); x.className = 'cuad-b';
    x.textContent = en.length ? '📓 En «' + en[0].nombre + '»' + (en.length > 1 ? ' +' + (en.length - 1) : '') : '📓 Al cuaderno';
    x.onclick = dialogo; b.insertBefore(x, b.firstChild);
    if (volverACuadernos) {
      volverACuadernos = false;
      if (!sh.querySelector('.cuad-volver')) { const v = document.createElement('button'); v.className = 'volver cuad-volver'; v.textContent = '← Mis cuadernos'; v.onclick = panel; sh.insertBefore(v, sh.children[1] || null); }
    }
  }
  // se engancha a las fichas sin tocar su código
  const f0 = window.ficha;
  window.ficha = function (p) { const r = f0.apply(this, arguments); try { if (p && selPt === p[0] && (p[0] in F)) { ACT = fotoDe(p); ponBoton(); } } catch (e) {} return r; };
  if (typeof window.fichaPat === 'function') {
    const g0 = window.fichaPat;
    window.fichaPat = function (i) { const r = g0.apply(this, arguments); try { ACT = fotoPat(i); ponBoton(); } catch (e) {} return r; };
  }

  /* ---------- «📓 Al cuaderno» ---------- */
  function dialogo() {
    if (!ACT) return;
    const lista = vivos(), d = document.getElementById('dlgc');
    let h = '<h3>📓 Guardar en un cuaderno</h3><div class="sub" style="margin-bottom:8px">' + esc(ACT.n) + '</div>';
    if (lista.length) h += '<div class="cuad-l">' + lista.map(c => {
      const ya = c.s && c.s[ACT.id] && !c.s[ACT.id].borrado;
      return '<button data-c="' + c.id + '"' + (ya ? ' class="ya"' : '') + '>' + (ya ? '✓ ' : '') + esc(c.nombre) + '<small>' + items(c).length + ' destino' + (items(c).length === 1 ? '' : 's') + (ya ? ' · ya está' : '') + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="cuad-n"><input id="cuad-nom" maxlength="60" placeholder="' + (lista.length ? 'O uno nuevo: nombre' : 'Nombre del cuaderno (p. ej. Asturias 2027)') + '"><button class="si" id="cuad-crea">' + (lista.length ? 'Nuevo' : 'Crear y guardar') + '</button></div>';
    h += '<div class="bs" style="margin-top:10px"><button class="sigue" id="cuad-x">Cancelar</button></div>';
    d.innerHTML = h; document.getElementById('dlg').style.display = 'flex';
    d.querySelectorAll('.cuad-l button').forEach(b => b.onclick = () => mete(b.dataset.c));
    const crea = () => { const n = (document.getElementById('cuad-nom').value || '').trim(); if (!n) { document.getElementById('cuad-nom').focus(); return; }
      const id = nuevoId(); C.c[id] = { id, nombre: n, creado: ahora(), t: ahora(), s: {} }; mete(id); };
    document.getElementById('cuad-crea').onclick = crea;
    document.getElementById('cuad-nom').onkeydown = e => { if (e.key === 'Enter') crea(); };
    document.getElementById('cuad-x').onclick = cierraDlg;
    if (!lista.length) setTimeout(() => document.getElementById('cuad-nom').focus(), 50);
  }
  const cierraDlg = () => { document.getElementById('dlg').style.display = 'none'; };
  function mete(cid) {
    const c = C.c[cid]; if (!c || !ACT) return; c.s = c.s || {};
    if (c.s[ACT.id] && !c.s[ACT.id].borrado) { cierraDlg(); avisa('📓 Ya estaba en «' + c.nombre + '»', 2500); return; }
    const t = ahora(); c.s[ACT.id] = Object.assign({}, ACT, { o: t, t }); c.t = t;
    if (guarda()) { cierraDlg(); avisa('📓 Guardado en «' + c.nombre + '»', 2500);
      const b = document.querySelector('#sheet .cuad-b'); if (b) b.remove(); ponBoton(); }
  }

  /* ---------- pestaña «📓 Cuadernos» ---------- */
  let abierto = null;
  function panel() {
    const lista = vivos(), sh = document.getElementById('sheet');
    let h = '<button class="x" onclick="cierra()">✕</button><h2>📓 Mis cuadernos</h2>';
    if (!lista.length) h += '<p class="sub">Aún no tienes ninguno. Abre un sitio o una ruta que te guste y pulsa «📓 Al cuaderno»: te pedirá un nombre y lo creará.</p>';
    for (const c of lista) {
      const it = items(c), op = abierto === c.id;
      h += '<div class="cuad-c' + (op ? ' op' : '') + '"><div class="cuad-h" data-a="' + c.id + '"><b>' + esc(c.nombre) + '</b><small>' + fechaTxt(c.creado) + ' · ' + it.length + ' destino' + (it.length === 1 ? '' : 's') + '</small><i>' + (op ? '▾' : '▸') + '</i></div>';
      if (op) {
        h += it.length ? '<ol class="cuad-i">' + it.map(s => '<li><span class="ic" style="background:' + colorDe(s) + '">' + iconoDe(s) + '</span><span class="n" data-ir="' + c.id + '|' + esc(s.id) + '">' + esc(s.n) + '<span>' + esc([s.tp, s.m].filter(Boolean).join(' · ')) + '</span></span><button class="q" title="Quitar del cuaderno" data-q="' + c.id + '|' + esc(s.id) + '">✕</button></li>').join('') + '</ol>'
          : '<p class="sub">Vacío: abre un sitio y pulsa «📓 Al cuaderno».</p>';
        h += '<div class="btns">' + (it.length ? (navigator.share ? '<button data-sh="' + c.id + '">↗ Compartir</button>' : '') +
          '<a class="sec" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(texto(c)) + '">WhatsApp</a>' +
          '<a class="sec" href="mailto:?subject=' + encodeURIComponent('Cuaderno de viaje: ' + c.nombre) + '&body=' + encodeURIComponent(texto(c)) + '">✉ Correo</a>' +
          '<button class="sec" data-gpx="' + c.id + '">⬇ GPX</button>' : '') +
          '<button class="sec" data-ren="' + c.id + '">✏️ Nombre</button><button class="sec" data-bo="' + c.id + '">🗑 Borrar</button></div>';
      }
      h += '</div>';
    }
    h += '<div class="sub" style="margin-top:14px">' + estadoTxt() + '</div>';
    sh.innerHTML = h; sh.scrollTop = 0; sh.classList.add('on');
    if (typeof sel !== 'undefined') { try { sel = null; pintaTracks(); marcaPunto(null); } catch (e) {} }
    sh.querySelectorAll('[data-a]').forEach(e => e.onclick = () => { abierto = abierto === e.dataset.a ? null : e.dataset.a; panel(); });
    sh.querySelectorAll('[data-ir]').forEach(e => e.onclick = () => { const [c, s] = e.dataset.ir.split('|'); ir(C.c[c].s[s]); });
    sh.querySelectorAll('[data-q]').forEach(e => e.onclick = () => { const [c, s] = e.dataset.q.split('|'); const x = C.c[c].s[s]; x.borrado = true; x.t = ahora(); C.c[c].t = ahora(); guarda(); panel(); });
    sh.querySelectorAll('[data-sh]').forEach(e => e.onclick = () => { const c = C.c[e.dataset.sh]; navigator.share({ title: 'Cuaderno de viaje: ' + c.nombre, text: texto(c) }).catch(() => {}); });
    sh.querySelectorAll('[data-gpx]').forEach(e => e.onclick = () => gpxCuaderno(C.c[e.dataset.gpx]));
    sh.querySelectorAll('[data-ren]').forEach(e => e.onclick = () => { const c = C.c[e.dataset.ren]; const n = prompt('Nuevo nombre del cuaderno', c.nombre); if (n && n.trim()) { c.nombre = n.trim(); c.t = ahora(); guarda(); panel(); } });
    sh.querySelectorAll('[data-bo]').forEach(e => { let p = 0; e.onclick = () => { if (Date.now() - p > 3000) { p = Date.now(); e.textContent = '¿Seguro? Pulsa otra vez'; return; } const c = C.c[e.dataset.bo]; c.borrado = true; c.t = ahora(); abierto = null; guarda(); panel(); avisa('🗑 Cuaderno borrado', 2500); }; });
  }
  const colorDe = s => (CAPAS[s.c] || CAPAS.t).c;
  const iconoDe = s => s.c === 'o' ? '⛪' : (CAPAS[s.c] || CAPAS.t).s;
  function ir(s) {
    if (!s) return;
    const q = s.c !== 'o' && typeof pid === 'function' ? pid(s.id) : null;
    volverACuadernos = true;
    if (q) { abre(s.id); return; }
    volverACuadernos = false;
    document.getElementById('sheet').classList.remove('on');
    map.setView([s.la, s.lo], Math.max(map.getZoom(), 16));
    if (s.c === 'o') { avisa('⛪ ' + s.n + (on && !on.o ? ' — enciende la capa Patrimonio para ver su ficha' : ''), 4000); }
    else avisa('📍 ' + s.n + ': ya no está en el catálogo; te llevo a su sitio.', 4000);
  }

  /* ---------- compartir ---------- */
  function texto(c) {
    const it = items(c);
    let t = '📓 ' + c.nombre + ' (cuaderno de viaje, ' + fechaTxt(c.creado) + ')\n';
    it.forEach((s, k) => {
      t += '\n' + (k + 1) + '. ' + s.n + (s.m ? ' — ' + s.m : '') + (s.tp ? ' (' + s.tp + ')' : '') + '\n';
      t += '   https://www.google.com/maps/search/?api=1&query=' + (+s.la).toFixed(5) + ',' + (+s.lo).toFixed(5) + '\n';
      if (PUB && s.c !== 'o') t += '   https://historiatotal.es/viajes/#sitio=' + encodeURIComponent(s.id) + '\n';
    });
    if (PUB) t += '\nHecho con Viajes · historiatotal.es';
    return t;
  }
  async function gpxCuaderno(c) {
    const it = items(c), rutas = it.filter(s => s.c === 'r' || s.c === 'm');
    if (rutas.length) {
      avisa('⬇ Preparando el GPX…');
      const zonas = [...new Set(rutas.map(s => ZP[s.id]).filter(Boolean))];
      await Promise.all(zonas.map(z => carga('t', z)));
    }
    const x = s => esc(s).replace(/'/g, '&apos;');
    let g = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cuadernos de viaje" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + x(c.nombre) + '</name></metadata>\n';
    for (const s of it) g += '<wpt lat="' + s.la + '" lon="' + s.lo + '"><name>' + x(s.n) + '</name>' + (s.m ? '<desc>' + x(s.m) + '</desc>' : '') + '</wpt>\n';
    let sin = 0;
    for (const s of rutas) {
      const tr = T[s.id]; if (!tr) { sin++; continue; }
      g += '<trk><name>' + x(s.n) + '</name>\n';
      for (const sg of tr) { g += '<trkseg>\n'; for (const q of sg) g += '<trkpt lat="' + q[0] + '" lon="' + q[1] + '"/>\n'; g += '</trkseg>\n'; }
      g += '</trk>\n';
    }
    g += '</gpx>\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([g], { type: 'application/gpx+xml' }));
    a.download = 'cuaderno-' + c.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '.gpx';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    avisa('⬇ GPX con ' + it.length + ' punto' + (it.length === 1 ? '' : 's') + (rutas.length - sin ? ' y ' + (rutas.length - sin) + ' ruta' + (rutas.length - sin === 1 ? '' : 's') : '') + (sin ? ' (' + sin + ' sin trazado disponible)' : ''), 4000);
  }

  /* ---------- pestaña en la barra de arriba ---------- */
  function pintaPestana() {
    const nav = document.querySelector('#top .apps'); if (!nav) return;
    let a = document.getElementById('cuad-tab');
    if (!a) { a = document.createElement('a'); a.id = 'cuad-tab'; a.title = 'Mis cuadernos de viaje'; a.onclick = panel; nav.appendChild(a); }
    const n = vivos().length;
    a.innerHTML = '<span class="ic">📓</span><span class="tx">Cuadernos</span>' + (n ? '<b class="cuad-n0">' + n + '</b>' : '');
  }

  /* ---------- sincronizar ---------- */
  function junta(rem) {        // devuelve true si aquí hay algo que fuera no tiene
    let cambio = false, pend = false;
    for (const [id, r] of Object.entries(rem || {})) {
      const l = C.c[id];
      if (!l) { C.c[id] = r; cambio = true; continue; }
      if ((r.t || 0) > (l.t || 0)) { l.nombre = r.nombre; l.borrado = r.borrado; l.t = r.t; cambio = true; }
      else if ((r.t || 0) < (l.t || 0)) pend = true;
      l.s = l.s || {};
      for (const [k, s] of Object.entries(r.s || {})) {
        const ls = l.s[k];
        if (!ls || (s.t || 0) > (ls.t || 0)) { l.s[k] = s; cambio = true; }
        else if ((s.t || 0) < (ls.t || 0)) pend = true;
      }
      for (const k of Object.keys(l.s)) if (!(r.s || {})[k]) pend = true;
    }
    for (const id of Object.keys(C.c)) if (!(rem || {})[id]) pend = true;
    if (cambio) { try { window.localStorage.setItem(CLAVE, JSON.stringify(C)); } catch (e) {} pintaPestana(); }
    return pend;
  }
  let estado = '';
  function estadoTxt() {
    if (PUB) {
      if (!SYNC_HT) return 'Se guardan en este aparato y en este navegador. No pongas nada privado.';
      const cod = codigoHT();
      return cod ? 'Se guardan en este aparato y con tu código de historiatotal.es: <b>' + esc(cod) + '</b>. Apúntalo: con él los verás en tus otros aparatos (en historiatotal.es → ⚙️ Ajustes → «usar otro código»). Cualquiera con el código puede verlos: no pongas nada privado.' + (estado ? '<br>' + estado : '')
                 : 'Se guardan en este aparato. Al crear tu primer cuaderno tendrás un código de historiatotal.es para verlos también en tus otros aparatos.';
    }
    if (typeof tokenGh !== 'function' || !tokenGh()) return 'Se guardan en este navegador. Con el permiso de GitHub de la app (el de las correcciones) se comparten con tus otros aparatos.';
    return (estado || 'Sincronizados con tus otros aparatos por GitHub.') + ' Ojo: el repositorio es público.';
  }
  let tSub = null;
  function programaSubida() { clearTimeout(tSub); tSub = setTimeout(sube, 2500); }

  // App Mapas: GitHub, como las correcciones (sync/cuadernos.json)
  async function ghLee() {
    const r = repo(), tk = tokenGh();
    if (tk) {
      const api = 'https://api.github.com/repos/' + r.duenio + '/' + r.repo + '/contents/' + GH_RUTA;
      const res = await fetch(api, { headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (res.status === 404) return { c: {}, sha: null, api, tk };
      if (!res.ok) throw new Error('GitHub respondió ' + res.status);
      const m = await res.json(); let c = {};
      try { c = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((m.content || '').replace(/\n/g, '')), ch => ch.charCodeAt(0)))).c || {}; } catch (e) {}
      return { c, sha: m.sha, api, tk };
    }
    if (!/^https?:$/.test(location.protocol)) return null;
    const res = await fetch(GH_RUTA + '?t=' + Date.now(), { cache: 'no-store' });
    return { c: res.ok ? ((await res.json()).c || {}) : {} };
  }
  // Viajes: código de usuario de historiatotal.es (solo con CUAD_SYNC_HT)
  function codigoHT() { try { const v = window.localStorage.getItem('hk_codigo'); return v ? v.replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } }
  // Si el visitante aún no tiene código, se crea igual que generaCodigo() de la web principal
  // (7 caracteres de ABCDEFGHJKLMNPQRSTUVWXYZ23456789, texto plano en «hk_codigo»); la web lo respeta.
  function creaCodigoHT() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(7); crypto.getRandomValues(r);
    const cod = Array.from(r, x => A[x % 32]).join('');
    try { window.localStorage.setItem('hk_codigo', cod); } catch (e) { return ''; }
    return cod;
  }
  async function htLee() {
    const cod = codigoHT(); if (!cod) return null;
    const res = await fetch('/api/sync.php?codigo=' + encodeURIComponent(cod), { cache: 'no-store' });
    if (!res.ok) throw new Error('el servidor respondió ' + res.status);
    const d = await res.json(); return { c: (d && d.cuadernos) || {}, cod };
  }

  let subiendo = false;
  async function sube() {
    if (subiendo) return programaSubida();
    subiendo = true;
    try {
      if (PUB) {
        if (!SYNC_HT) return;
        if (!codigoHT()) { if (!Object.keys(C.c).length || !creaCodigoHT()) return; }
        const R = await htLee(); if (!R) return; junta(R.c);
        const res = await fetch('/api/sync.php?codigo=' + encodeURIComponent(R.cod), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cuadernos: C.c }) });
        estado = res.ok ? '' : res.status === 413 ? '⚠️ Tus datos de historiatotal.es están llenos: los cuadernos quedan solo en este aparato. Borra alguno que no uses.'
                                                  : '⚠️ No se han podido guardar en el servidor (' + res.status + '); quedan en este aparato.';
        return;
      }
      if (typeof tokenGh !== 'function' || !tokenGh()) return;
      for (let i = 0; i < 3; i++) {
        const R = await ghLee(); junta(R.c);
        const c = Object.assign({}, R.c, C.c);
        const res = await fetch(R.api, { method: 'PUT', headers: { Authorization: 'Bearer ' + R.tk, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Cuadernos de viaje', content: aB64(JSON.stringify({ v: 1, c }, null, 1)), sha: R.sha || undefined }) });
        if (res.status === 409 || res.status === 422) continue;
        estado = res.ok ? '☁️ Sincronizados con tus otros aparatos por GitHub.' : '⚠️ No se han podido subir a GitHub (' + res.status + '); quedan guardados aquí.';
        return;
      }
    } catch (e) { estado = '⚠️ No se han podido sincronizar (' + e.message + '); quedan guardados aquí.'; }
    finally { subiendo = false; }
  }
  (async () => {
    try {
      const R = PUB ? (SYNC_HT ? await htLee() : null) : await ghLee();
      if (R && junta(R.c)) programaSubida();
    } catch (e) {}
  })();

  /* ---------- enlace directo a un sitio: …/#sitio=<id> ---------- */
  function deLaDireccion() {
    const m = location.hash.match(/^#sitio=(.+)$/); if (!m) return;
    const id = decodeURIComponent(m[1]); if (typeof pid === 'function' && pid(id)) setTimeout(() => abre(id), 300);
  }
  window.addEventListener('hashchange', deLaDireccion);

  /* ---------- estilos ---------- */
  const st = document.createElement('style');
  st.textContent = '#cuad-tab b.cuad-n0{background:#c2410c;color:#fff;border-radius:9px;font:700 11px system-ui;padding:1px 6px;margin-left:2px}'
    + '.btns .cuad-b{background:#c2410c}'
    + '.cuad-l{display:flex;flex-direction:column;gap:6px;max-height:40vh;overflow:auto;margin-bottom:10px}'
    + '.cuad-l button{text-align:left;background:#f4f1ea !important;color:#1d2125;font-weight:600 !important}.cuad-l button.ya{background:#e7f5ea !important}'
    + '.cuad-l small{display:block;font:400 12px system-ui;color:#5f6670}'
    + '.cuad-n{display:flex;gap:6px}.cuad-n input{flex:1;min-width:0;padding:8px;border:1px solid #ccc;border-radius:8px;font:15px system-ui}'
    + '.cuad-c{border:1px solid var(--li);border-radius:10px;margin:8px 0;padding:8px 10px}.cuad-c.op{border-color:#c2410c}'
    + '.cuad-h{display:flex;align-items:baseline;gap:8px;cursor:pointer}.cuad-h b{flex:1}.cuad-h small{color:var(--mu)}.cuad-h i{font-style:normal;color:var(--mu)}'
    + '.cuad-i{list-style:none;padding:0;margin:8px 0 0}.cuad-i li{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--li)}'
    + '.cuad-i .ic{flex:0 0 26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff}'
    + '.cuad-i .n{flex:1;cursor:pointer;font-weight:600;font-size:14px}.cuad-i .n span{display:block;font:400 12px system-ui;color:var(--mu)}'
    + '.cuad-i .q{border:0;background:none;color:#999;font-size:15px;cursor:pointer}';
  document.head.appendChild(st);

  pintaPestana();
  deLaDireccion();
  window.cuadPanel = panel;   // por si se quiere abrir desde otro sitio
})();
