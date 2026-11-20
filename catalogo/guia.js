/* GUÍA DE VIAJE (17-nov-2026, idea de Carlos) — catalogo/guia.js
   Pestaña «🧭 Guía»: se crean viajes (los que se quiera). Cada viaje tiene fechas, punto de salida y dónde se duerme cada noche.
   Con eso cada día es de TRASLADO (se duerme en otro sitio) o de BASE (se duerme en el mismo), y la app sugiere:
     · «De camino»: lo destacado a menos de 10 km del trayecto POR CARRETERA (18-nov: ruta, km y tiempo de un servicio OSRM
       gratuito; si no responde, se usa la línea recta), repartido a lo largo del camino y sin lo que rodea al punto de salida;
     · «Campamento base»: lo que hay a 10, 25 y 50 km del sitio donde se duerme, por estrellas, y las rutas a pie más cercanas.
   18-nov: «🎟 Actividades con guía» cerca (catalogo/actividades.js: visitas en todoterreno, astronomía…).
   Lo ya marcado como visto sale apagado. Con «＋» una sugerencia pasa al plan del día.
   Datos: {g:{id:{id,nombre,ini,fin,sal:{n,la,lo},noches:[{n,la,lo}|null],dias:{i:[{id,n,c,la,lo}]},creado,t,borrado?}}}
   Guardado: Viajes → localStorage «hk_guias» + api/sync.php (apartado «guias») con el código del usuario.
             App Mapas → localStorage «mapas.guias» y, si Carlos escribe su código de Viajes, el MISMO apartado
             «guias» de api/sync.php (18-nov c): los viajes se ven en las dos apps. Viajes usa ids cortos
             (huella md5 del id largo, como hacer_version_publica.py); App Mapas los traduce al bajar y al subir.
   Se engancha a catalogo.html sin tocar su código (usa map, D, CAPAS, abre, pid, hecha, esc, avisa, cierra). */
(function () {
  if (typeof map === 'undefined' || typeof D === 'undefined') return;
  const PUB = !!window.CUAD_PUBLICO, SYNC_HT = PUB && !!window.CUAD_SYNC_HT;
  const CLAVE = PUB ? 'hk_guias' : 'mapas.guias', LIM = 200 * 1024, ANCHO = 10;
  const API = PUB ? '/api/sync.php' : 'https://historiatotal.es/api/sync.php', KCOD = PUB ? 'hk_codigo' : 'mapas.hk_codigo';
  let volver = null;   // ficha abierta desde un día del viaje: al cerrarla se vuelve a ese día

  let G = { g: {} }; try { const v = JSON.parse(window.localStorage.getItem(CLAVE) || 'null'); if (v && v.g) G = v; } catch (e) {}
  const ahora = () => Date.now(), nuevoId = () => ahora().toString(36) + Math.random().toString(36).slice(2, 6);
  const vivos = () => Object.values(G.g).filter(v => !v.borrado).sort((a, b) => (b.ini || '').localeCompare(a.ini || '') || (b.t || 0) - (a.t || 0));
  function guarda(v) { if (v) v.t = ahora(); try { window.localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) {} pintaPestana(); programaSubida(); }

  /* ---------- fechas y distancias ---------- */
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const ms = s => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d); };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const nDias = v => (v.ini && v.fin && v.fin >= v.ini) ? Math.min(60, Math.round((ms(v.fin) - ms(v.ini)) / 86400000) + 1) : 0;
  const fechaDia = (v, i) => { const d = new Date(ms(v.ini) + i * 86400000); return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MESES[d.getUTCMonth()]; };
  const rango = v => { if (!v.ini) return 'sin fechas'; const a = new Date(ms(v.ini)), b = new Date(ms(v.fin || v.ini));
    return a.getUTCDate() + (a.getUTCMonth() !== b.getUTCMonth() ? ' ' + MESES[a.getUTCMonth()] : '') + (v.fin && v.fin !== v.ini ? '–' + b.getUTCDate() : '') + ' ' + MESES[b.getUTCMonth()] + ' ' + b.getUTCFullYear(); };
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dla = (b.la - a.la) * r, dlo = (b.lo - a.lo) * r, x = Math.sin(dla / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dlo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const kmTxt = k => k < 10 ? k.toFixed(1).replace('.', ',') + ' km' : Math.round(k) + ' km';
  // un día va de «desde» a «hasta»: el primero sale de casa, el último vuelve a casa, los demás van de una noche a la siguiente
  function tramo(v, i) { const n = nDias(v), a = i === 0 ? v.sal : (v.noches || [])[i - 1], b = i === n - 1 ? v.sal : (v.noches || [])[i];
    const tipo = !a || !b ? 'x' : km(a, b) < 3 ? 'b' : 't'; return { a: a || null, b: b || null, tipo, km: a && b ? km(a, b) : 0 }; }

  /* ---------- tiempo (19-nov): previsión de Open-Meteo si faltan 15 días o menos; si no, lo normal en esas fechas (media de los 10 últimos años) ---------- */
  const TK = 'guia.tiempo'; let TC = {}; try { TC = JSON.parse(window.localStorage.getItem(TK) || '{}') || {}; } catch (e) { TC = {}; }
  const falloT = {}, pendT = {};
  function guardaTC() { const ks = Object.keys(TC).sort((x, y) => (TC[y].t || 0) - (TC[x].t || 0)); ks.slice(400).forEach(k => delete TC[k]); try { window.localStorage.setItem(TK, JSON.stringify(TC)); } catch (e) {} }
  const hoyISO = () => { const d = new Date(); return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
  const fDia = (v, i) => iso(ms(v.ini) + i * 86400000);
  // dónde se mira el tiempo de un día: donde se pasa (base), o donde se llega (traslado), salvo si se vuelve a casa
  function sitioT(v, i) { const t = tramo(v, i); if (t.tipo === 'x') return null; if (t.tipo === 'b') return t.a; if (v.sal && km(t.b, v.sal) < 3) return t.a; return t.b; }
  const tk = (p, f) => p.la.toFixed(2) + ',' + p.lo.toFixed(2) + '|' + f;
  function tiempoDe(p, f) { const x = p && TC[tk(p, f)]; if (!x) return null; if (x.k === 'p' && ahora() - x.t > 3 * 3600e3) return null; if (x.k === 'n' && f <= iso(ms(hoyISO()) + 15 * 86400000)) return null; return x; }
  const WMO = c => c === 0 ? ['☀️', 'despejado'] : c === 1 ? ['🌤', 'casi despejado'] : c === 2 ? ['⛅', 'nubes y claros'] : c === 3 ? ['☁️', 'cubierto'] : c === 45 || c === 48 ? ['🌫', 'niebla']
    : c >= 51 && c <= 57 ? ['🌦', 'llovizna'] : c === 61 ? ['🌧', 'lluvia débil'] : c === 63 ? ['🌧', 'lluvia'] : c === 65 ? ['🌧', 'lluvia fuerte'] : c === 66 || c === 67 ? ['🌧', 'lluvia que hiela']
    : c >= 71 && c <= 77 ? ['🌨', 'nieve'] : c >= 80 && c <= 82 ? ['🌦', 'chubascos'] : c === 85 || c === 86 ? ['🌨', 'chubascos de nieve'] : c >= 95 ? ['⛈', 'tormenta'] : ['🌡', ''];
  const gr = x => Math.round(x) + '°';
  function tiempoTxt(x, largo, donde) { if (!x) return ''; const en = donde ? ' en ' + donde : '';
    if (x.k === 'p') { const w = WMO(x.c); return w[0] + ' ' + gr(x.mx) + ' / ' + gr(x.mn) + (x.pp != null ? ' · 💧' + x.pp + ' %' : '')
      + (largo ? ' — ' + w[1] + en + (x.mm >= 1 ? ', unos ' + Math.round(x.mm) + ' l/m²' : '') + '. Previsión de Open-Meteo.' : ''); }
    const ll = x.ll < 0.05 ? 'casi nunca llueve' : 'llueve ' + Math.round(x.ll * 100) + ' % de los días';
    return '📊 Lo normal' + en + ': ' + gr(x.mx) + ' / ' + gr(x.mn) + ' · ' + ll + (largo ? '. Es la media de los 10 últimos años en estas fechas (Open-Meteo); la previsión de verdad sale cuando falten 15 días.' : ''); }
  async function pideT(url) { const r = await fetch(url); if (!r.ok) throw new Error('tiempo ' + r.status); return r.json(); }
  // pide lo que falte del viaje (un aviso por sitio y tipo); devuelve true si ha llegado algo nuevo
  async function pideTiempo(v) { const n = nDias(v), hoy = hoyISO(), lim = iso(ms(hoy) + 15 * 86400000), G_ = {};
    for (let i = 0; i < n; i++) { const p = sitioT(v, i), f = fDia(v, i); if (!p || f < hoy || tiempoDe(p, f)) continue;
      const tipo = f <= lim ? 'p' : 'n', g = p.la.toFixed(2) + ',' + p.lo.toFixed(2) + '|' + tipo;
      if (falloT[g] && ahora() - falloT[g] < 600e3) continue; (G_[g] = G_[g] || { p, tipo, fs: [] }).fs.push(f); }
    let nuevo = false;
    for (const [g, o] of Object.entries(G_)) {
      if (!pendT[g]) pendT[g] = (async () => { const la = o.p.la.toFixed(3), lo = o.p.lo.toFixed(3), fs = o.fs.slice().sort();
        try {
          if (o.tipo === 'p') { const d = await pideT('https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=' + fs[0] + '&end_date=' + fs[fs.length - 1]);
            const D_ = d.daily || {}; (D_.time || []).forEach((f, j) => { if (D_.temperature_2m_max[j] == null) return; TC[tk(o.p, f)] = { k: 'p', c: D_.weather_code[j], mx: D_.temperature_2m_max[j], mn: D_.temperature_2m_min[j], pp: D_.precipitation_probability_max ? D_.precipitation_probability_max[j] : null, mm: D_.precipitation_sum ? D_.precipitation_sum[j] : 0, t: ahora() }; });
          } else { const y = new Date().getFullYear(), d = await pideT('https://archive-api.open-meteo.com/v1/archive?latitude=' + la + '&longitude=' + lo + '&start_date=' + (y - 10) + '-01-01&end_date=' + (y - 1) + '-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto');
            const D_ = d.daily || {}, ix = {}; (D_.time || []).forEach((f, j) => ix[f] = j);
            for (const f of fs) { const [, m, dd] = f.split('-').map(Number); let a = 0, b = 0, ll = 0, c = 0;
              for (let yy = y - 10; yy < y; yy++) for (let s = -3; s <= 3; s++) { const j = ix[iso(Date.UTC(yy, m - 1, dd) + s * 86400000)]; if (j == null || D_.temperature_2m_max[j] == null) continue; a += D_.temperature_2m_max[j]; b += D_.temperature_2m_min[j]; ll += (D_.precipitation_sum[j] || 0) >= 1 ? 1 : 0; c++; }
              if (c) TC[tk(o.p, f)] = { k: 'n', mx: a / c, mn: b / c, ll: ll / c, t: ahora() }; } }
          guardaTC(); return true;
        } catch (e) { falloT[g] = ahora(); return false; } finally { delete pendT[g]; } })();
      if (await pendT[g]) nuevo = true; }
    return nuevo; }

  /* ---------- sugerencias ---------- */
  const est = p => p[8] || 1, visto = id => { try { return typeof hecha === 'function' && !!hecha(id); } catch (e) { return false; } };
  /* ---------- carretera (18-nov): ruta, km y tiempo entre dos puntos, de un servidor OSRM público ---------- */
  const SERV = ['https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'https://router.project-osrm.org/route/v1/driving/'], RCL = 'guia.rutas';
  let RC = {}; try { RC = JSON.parse(window.localStorage.getItem(RCL) || '{}') || {}; } catch (e) { RC = {}; }
  const rk = (a, b) => [a.la, a.lo, b.la, b.lo].map(x => (+x).toFixed(3)).join(','), enCache = (a, b) => RC[rk(a, b)] || null, pendR = {}, falloR = {};
  function guardaRC() { const ks = Object.keys(RC).sort((x, y) => (RC[y].t || 0) - (RC[x].t || 0)); ks.slice(60).forEach(k => delete RC[k]); try { window.localStorage.setItem(RCL, JSON.stringify(RC)); } catch (e) {} }
  function carretera(a, b) { const k = rk(a, b); if (RC[k]) return Promise.resolve(RC[k]); if (pendR[k]) return pendR[k];
    return pendR[k] = (async () => { for (const base of SERV) { try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
          const res = await fetch(base + a.lo + ',' + a.la + ';' + b.lo + ',' + b.la + '?overview=simplified&geometries=geojson', { signal: ctl.signal }); clearTimeout(tm);
          if (!res.ok) continue; const d = await res.json(), r = d && d.routes && d.routes[0]; if (!r || !r.geometry) continue;
          const o = { km: +(r.distance / 1000).toFixed(1), min: Math.round(r.duration / 60), g: r.geometry.coordinates.map(c => [+c[1].toFixed(4), +c[0].toFixed(4)]), t: ahora() };
          RC[k] = o; guardaRC(); delete falloR[k]; return o; } catch (e) {} }
        falloR[k] = true; return null; })().finally(() => { delete pendR[k]; }); }
  /* recorrido del día en coche, pasando por las paradas en orden (19-nov): una sola petición con todos los puntos */
  const rkR = P => 'R:' + P.map(p => (+p.la).toFixed(3) + ',' + (+p.lo).toFixed(3)).join(';'), enCacheR = P => RC[rkR(P)] || null;
  function recorrido(P) { const k = rkR(P); if (RC[k]) return Promise.resolve(RC[k]); if (pendR[k]) return pendR[k];
    return pendR[k] = (async () => { for (const base of SERV) { try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
          const res = await fetch(base + P.map(p => (+p.lo) + ',' + (+p.la)).join(';') + '?overview=simplified&geometries=geojson', { signal: ctl.signal }); clearTimeout(tm);
          if (!res.ok) continue; const d = await res.json(), r = d && d.routes && d.routes[0]; if (!r || !r.geometry || !r.legs) continue;
          const o = { km: +(r.distance / 1000).toFixed(1), min: Math.round(r.duration / 60), g: r.geometry.coordinates.map(c => [+c[1].toFixed(4), +c[0].toFixed(4)]), legs: r.legs.map(l => ({ km: +(l.distance / 1000).toFixed(1), min: Math.round(l.duration / 60) })), t: ahora() };
          RC[k] = o; guardaRC(); delete falloR[k]; return o; } catch (e) {} }
        falloR[k] = true; return null; })().finally(() => { delete pendR[k]; }); }
  /* ordenar las paradas de un día para conducir menos (20-nov): tiempos en coche entre todos los puntos (OSRM «table»); si no responde, línea recta a 50 km/h */
  const DES = {};
  async function matriz(P) {
    for (const base of SERV) { try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
        const res = await fetch(base.replace('/route/', '/table/') + P.map(p => (+p.lo) + ',' + (+p.la)).join(';') + '?annotations=duration', { signal: ctl.signal }); clearTimeout(tm);
        if (!res.ok) continue; const d = await res.json(); if (d && d.durations && d.durations.length === P.length && d.durations.every(f => f.every(x => x != null))) return { D: d.durations, coche: true }; } catch (e) {} }
    return { D: P.map(a => P.map(b => km(a, b) * 1.3 / 50 * 3600)), coche: false }; }
  // nodos: 0 = salida del día, 1..n = paradas, n+1 = final del día. Devuelve el orden de las paradas con menos tiempo total.
  function mejorOrden(D, n) { const fin = n + 1, coste = o => { let c = D[0][o[0]]; for (let j = 1; j < o.length; j++) c += D[o[j - 1]][o[j]]; return c + D[o[o.length - 1]][fin]; };
    let mejor = null, mc = Infinity;
    if (n <= 8) { const usado = new Array(n + 2).fill(false), act = [];
      const rec = (c, ult) => { if (c >= mc) return; if (act.length === n) { const t = c + D[ult][fin]; if (t < mc) { mc = t; mejor = act.slice(); } return; }
        for (let k = 1; k <= n; k++) if (!usado[k]) { usado[k] = true; act.push(k); rec(c + D[ult][k], k); act.pop(); usado[k] = false; } };
      rec(0, 0); }
    else { const resto = new Set(Array.from({ length: n }, (_, k) => k + 1)); let ult = 0; mejor = [];
      while (resto.size) { let b = null; for (const k of resto) if (b == null || D[ult][k] < D[ult][b]) b = k; mejor.push(b); resto.delete(b); ult = b; }
      let mejora = true; while (mejora) { mejora = false; for (let a = 0; a < n - 1; a++) for (let b = a + 1; b < n; b++) { const o = mejor.slice(0, a).concat(mejor.slice(a, b + 1).reverse(), mejor.slice(b + 1)); if (coste(o) < coste(mejor) - 1) { mejor = o; mejora = true; } } } }
    return { orden: mejor, coste: coste(mejor), viejo: coste(Array.from({ length: n }, (_, k) => k + 1)) }; }

  const ptsDia = (v, i) => { const t = tramo(v, i), P = (v.dias || {})[i] || []; return t.tipo === 'x' || !P.length ? null : [t.a].concat(P, [t.b || t.a]); };
  const durTxt = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 >= 3 ? ' ' + (Math.round(m % 60 / 5) * 5 || 5) + ' min' : '');
  const viaTxt = (t) => { const r = enCache(t.a, t.b); return r ? kmTxt(r.km) + ' por carretera · unas ' + durTxt(r.min) : kmTxt(t.km) + ' en línea recta' + (falloR[rk(t.a, t.b)] ? '' : ' <span class="gv-c">· calculando la carretera…</span>'); };

  /* ---------- «De camino»: puntos a menos de ANCHO km del trayecto (la carretera si se conoce; si no, la línea recta) ---------- */
  function deCamino(a, b, minE, g, sinFin) {       // sinFin: el trayecto acaba en casa (día de vuelta): tampoco se sugiere lo que la rodea
    const k = Math.cos((a.la + b.la) / 2 * Math.PI / 180), X = lo => (lo - a.lo) * 111.2 * k, Y = la => (la - a.la) * 111.2;
    const P = (g && g.length > 1 ? g : [[a.la, a.lo], [b.la, b.lo]]).map(q => [X(q[1]), Y(q[0])]), cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = cum[cum.length - 1] || 1, recta = Math.hypot(X(b.lo), Y(b.la));
    const R0 = Math.max(ANCHO, Math.min(40, recta * 0.15));       // lo que rodea al punto de salida no es «de camino»: es de donde vienes
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of P) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const o = [];
    for (const p of D.p) { if (p[1] !== 't' && p[1] !== 'n' && p[1] !== 'h') continue; if (est(p) < minE) continue;
      const px = X(p[5]), py = Y(p[4]); if (px < x0 - ANCHO || px > x1 + ANCHO || py < y0 - ANCHO || py > y1 + ANCHO) continue;
      if (Math.hypot(px, py) < R0) continue;
      if (sinFin && Math.hypot(px - X(b.lo), py - Y(b.la)) < R0) continue;
      let bd = 1e9, bf = 0;
      for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], ay = P[i - 1][1], dx = P[i][0] - ax, dy = P[i][1] - ay, l2 = dx * dx + dy * dy; let u = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; u = Math.max(0, Math.min(1, u));
        const d = Math.hypot(px - ax - u * dx, py - ay - u * dy); if (d < bd) { bd = d; bf = (cum[i - 1] + u * (cum[i] - cum[i - 1])) / tot; } }
      if (bd <= ANCHO) o.push({ p, d: bd, f: bf }); }
    return o; }
  // para que no salga todo amontonado en un extremo: el trayecto se parte en 8 trozos y de cada uno se quedan los 6 mejores
  function reparte(todo) { const B = 8, POR = 6, cubos = Array.from({ length: B }, () => []);
    for (const x of todo) cubos[Math.min(B - 1, Math.floor(x.f * B))].push(x);
    return cubos.flatMap(c => c.sort((x, y) => est(y.p) - est(x.p) || x.d - y.d).slice(0, POR)).sort((x, y) => x.f - y.f); }
  /* ---------- actividades con guía (catalogo/actividades.js) ---------- */
  let actP = null;
  const cargaAct = () => actP || (actP = new Promise(ok => { if (window.ACTIV) return ok(); const sc = document.createElement('script'); sc.src = 'catalogo/actividades.js'; sc.onload = () => ok(); sc.onerror = () => ok(); document.head.appendChild(sc); }));
  function actCerca(c, R) { const o = []; for (const a of (window.ACTIV || [])) { let m = null; for (const q of (a.sal || [])) { const d = km(c, q); if (!m || d < m.d) m = { d, q }; } if (m && m.d <= R) o.push({ a, d: m.d, q: m.q }); } return o.sort((x, y) => x.d - y.d); }
  const actHtml = (x, desde) => { const a = x.a; return '<div class="gv-a"><b>' + esc(a.n) + '</b><span>' + esc(a.q) + '</span><span class="m">' + esc(a.emp) + (x.q ? ' · sale de ' + esc(x.q.n) + (desde ? ', a ' + kmTxt(x.d) + ' de ' + esc(desde) : '') : '') + (a.dur ? ' · ' + esc(a.dur) : '') + (a.res ? ' · ' + esc(a.res) : '') + '</span>'
    + '<span class="m">' + (a.web ? '<a href="' + esc(a.web) + '" target="_blank" rel="noopener">Web y reservas</a>' : '') + (a.tel ? ' · ☎ ' + esc(a.tel) : '') + (a.rev ? ' · datos de ' + esc(a.rev) + ': confírmalos antes de ir' : '') + '</span></div>'; };
  function alrededor(c, minE, R) { const o = [];
    for (const p of D.p) { if (p[1] !== 't' && p[1] !== 'n' && p[1] !== 'h') continue; if (est(p) < minE) continue;
      if (Math.abs(p[4] - c.la) > R / 100 || Math.abs(p[5] - c.lo) > R / 70) continue; const d = km(c, { la: p[4], lo: p[5] }); if (d <= R) o.push({ p, d }); }
    return o.sort((x, y) => est(y.p) - est(x.p) || x.d - y.d); }
  function rutasCerca(c, R, n) { const o = [];
    for (const p of D.p) { if (p[1] !== 'r') continue; if (Math.abs(p[4] - c.la) > R / 100 || Math.abs(p[5] - c.lo) > R / 70) continue; const d = km(c, { la: p[4], lo: p[5] }); if (d <= R) o.push({ p, d }); }
    return o.sort((x, y) => x.d - y.d).slice(0, n); }

  /* ---------- dibujo en el mapa ---------- */
  const capa = L.layerGroup(); let enMapa = null;
  const chincheta = (t, cls) => L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: '<div class="gv-ch ' + (cls || '') + '">' + t + '</div>' });
  function pintaMapa(v, dia, encuadra) { capa.clearLayers(); enMapa = v ? v.id : null; if (!v) { map.removeLayer(capa); return; } if (!map.hasLayer(capa)) capa.addTo(map);
    const n = nDias(v), pts = [];
    const rrD = dia != null && ptsDia(v, dia) ? enCacheR(ptsDia(v, dia)) : null;
    for (let i = 0; i < n; i++) { const t = tramo(v, i), hoy = i === dia && !rrD; if (t.tipo === 't') L.polyline((enCache(t.a, t.b) || {}).g || [[t.a.la, t.a.lo], [t.b.la, t.b.lo]], { color: hoy ? '#ea580c' : '#2563eb', weight: hoy ? 5 : 3, opacity: .85, dashArray: hoy ? null : '8 7', interactive: false }).addTo(capa); }
    if (rrD) { L.polyline(rrD.g, { color: '#fff', weight: 8, opacity: .9, interactive: false }).addTo(capa); L.polyline(rrD.g, { color: '#ea580c', weight: 5, opacity: .95, interactive: false }).addTo(capa); }
    if (v.sal) { L.marker([v.sal.la, v.sal.lo], { icon: chincheta('🏠'), interactive: false, zIndexOffset: 950 }).addTo(capa); pts.push([v.sal.la, v.sal.lo]); }
    (v.noches || []).forEach((x, i) => { if (!x) return; const rep = i > 0 && v.noches[i - 1] && km(v.noches[i - 1], x) < 3; if (!rep) L.marker([x.la, x.lo], { icon: chincheta('🛏<small>' + (i + 1) + '</small>', 'n'), interactive: false, zIndexOffset: 940 }).addTo(capa); pts.push([x.la, x.lo]); });
    if (dia != null) { const t = tramo(v, dia);
      if (t.tipo === 'b') [10, 25, 50].forEach(r => L.circle([t.a.la, t.a.lo], { radius: r * 1000, color: '#ea580c', weight: 1.5, opacity: .7, dashArray: '6 6', fill: false, interactive: false }).addTo(capa));
      ((v.dias || {})[dia] || []).forEach((s, j) => L.marker([s.la, s.lo], { icon: chincheta(String(j + 1), 'p'), interactive: false, zIndexOffset: 960 }).addTo(capa));
      if (encuadra && t.a) { const b = t.tipo === 'b' ? L.latLng(t.a.la, t.a.lo).toBounds(60000) : t.b ? L.latLngBounds([[t.a.la, t.a.lo], [t.b.la, t.b.lo]]) : null; if (b) map.fitBounds(b, { padding: [40, 40], paddingBottomRight: [innerWidth >= 760 ? 400 : 20, innerWidth >= 760 ? 20 : Math.round(innerHeight * .5)] }); }
    } else if (encuadra && pts.length) map.fitBounds(L.latLngBounds(pts).pad(.15), { paddingBottomRight: [innerWidth >= 760 ? 400 : 20, innerWidth >= 760 ? 20 : Math.round(innerHeight * .5)], maxZoom: 11 }); }

  /* ---------- pantallas ---------- */
  const sh = () => document.getElementById('sheet');
  function abreHoja(h) { const s = sh(); s.innerHTML = h; s.scrollTop = 0; s.classList.add('on'); try { if (typeof sel !== 'undefined') { sel = null; pintaTracks(); marcaPunto(null); } } catch (e) {} return s; }
  const cab = (t, volver) => '<button class="x" id="gv-x">✕</button>' + (volver ? '<button class="volver" id="gv-v">' + volver + '</button>' : '') + '<h2>' + t + '</h2>';
  function cierraG() { pintaMapa(null); activo = null; try { cierra(); } catch (e) { sh().classList.remove('on'); } }
  let activo = null;            // {v:id, d:índice de día} del último día abierto: es donde va «🧭 Al viaje» desde una ficha

  function lista() { pintaMapa(null); const L_ = vivos();
    let h = cab('🧭 Guía de viaje');
    h += '<p class="sub">Crea un viaje, di cuándo sales, de dónde y dónde duermes cada noche. Para cada día te sugiero qué ver: lo que queda de camino o lo que hay alrededor de donde duermes.</p>';
    for (const v of L_) { const n = nDias(v), nn = (v.noches || []).filter(Boolean).length;
      h += '<div class="cuad-c"><div class="cuad-h" data-gv="' + v.id + '"><b>' + esc(v.nombre) + '</b><small>' + rango(v) + (n ? ' · ' + n + (n === 1 ? ' día' : ' días') : '') + '</small><i>▸</i></div></div>'; }
    h += '<div class="btns"><button id="gv-nuevo">＋ Nuevo viaje</button></div><div class="sub" style="margin-top:14px">' + estadoTxt() + '</div>';
    const s = abreHoja(h); s.querySelector('#gv-x').onclick = cierraG; enganchaCodigo(s);
    s.querySelector('#gv-nuevo').onclick = () => { const hoy = iso(ahora()), id = nuevoId(); G.g[id] = { id, nombre: 'Viaje nuevo', ini: hoy, fin: iso(ahora() + 2 * 86400000), sal: null, noches: [null, null], dias: {}, creado: ahora(), t: ahora() }; guarda(G.g[id]); viaje(id, true); };
    s.querySelectorAll('[data-gv]').forEach(e => e.onclick = () => viaje(e.dataset.gv, true)); }

  function ajusta(v) { const n = nDias(v); v.noches = (v.noches || []).slice(0, Math.max(0, n - 1)); while (v.noches.length < n - 1) v.noches.push(null);
    v.dias = v.dias || {}; for (const k of Object.keys(v.dias)) if (+k >= n) delete v.dias[k]; }

  const lugAb = {};   // «Salida y noches» desplegado (por viaje, mientras dure la visita a la página)
  function viaje(id, encuadra) { const v = G.g[id]; if (!v || v.borrado) return lista(); ajusta(v); const n = nDias(v);
    let h = cab(esc(v.nombre), '← Mis viajes');
    h += '<div class="gv-f"><label>Sales el <input type="date" id="gv-ini" value="' + esc(v.ini || '') + '"></label><label>Vuelves el <input type="date" id="gv-fin" value="' + esc(v.fin || '') + '" min="' + esc(v.ini || '') + '"></label>';
    { const tot = n ? n : 1, hay = (v.sal ? 1 : 0) + (v.noches || []).slice(0, Math.max(0, n - 1)).filter(Boolean).length, ab = !!lugAb[id];
      h += '<button class="sec gv-tl" id="gv-tl" aria-expanded="' + ab + '" title="De dónde sales y dónde duermes cada noche">🛏 Destinos ' + (hay < tot ? '<span style="color:#b45309">⚠' + (tot - hay) + '</span>' : '✓') + ' ' + (ab ? '▴' : '▾') + '</button></div>';
      h += '<p class="sub gv-tlh" id="gv-tlh" style="margin:-4px 0 8px;cursor:pointer">' + (ab ? 'Toca cada línea para poner de dónde sales y dónde duermes cada noche. «🛏 Destinos ▴» lo vuelve a plegar.'
        : (hay < tot ? '👉 Despliega <b>«🛏 Destinos»</b> para poner de dónde sales y dónde duermes cada noche' + (hay ? '' : ': sin eso no puedo sugerirte nada') + '.' : 'De dónde sales y dónde duermes: en <b>«🛏 Destinos»</b>.')) + '</p>';
      h += '<div id="gv-lugs"' + (ab ? '' : ' style="display:none"') + '>'; }
    h += '<div class="gv-l"><span class="e">🏠</span><span class="n" data-lug="sal"><b>Sales de</b>' + (v.sal ? esc(v.sal.n) : '<i>toca para decir de dónde</i>') + '</span></div>';
    for (let i = 0; i < n - 1; i++) { const x = v.noches[i], ant = i > 0 ? v.noches[i - 1] : null;
      h += '<div class="gv-l"><span class="e">🛏</span><span class="n" data-lug="' + i + '"><b>Noche ' + (i + 1) + ' · ' + fechaDia(v, i) + '</b>' + (x ? esc(x.n) : '<i>toca para decir dónde duermes</i>') + '</span>' + (!x && ant ? '<button class="gv-ig" data-ig="' + i + '" title="Dormir en el mismo sitio que la noche anterior">= anterior</button>' : '') + '</div>'; }
    h += '</div><h3 class="gv-h3">Los días</h3>';
    if (!n) h += '<p class="sub">Pon las fechas para ver los días.</p>';
    for (let i = 0; i < n; i++) { const t = tramo(v, i), k = ((v.dias || {})[i] || []).length;
      const d = t.tipo === 'x' ? '<i>falta decir ' + (!t.a ? (i === 0 ? 'de dónde sales' : 'dónde duermes la noche ' + i) : (i === n - 1 ? 'de dónde sales' : 'dónde duermes la noche ' + (i + 1))) + '</i>'
        : t.tipo === 'b' ? 'Base en ' + esc(t.a.n) : esc(t.a.n) + ' → ' + esc(t.b.n) + ' · ' + viaTxt(t);
      h += '<div class="cuad-c' + (t.tipo === 'x' ? ' gv-x' : '') + '"><div class="cuad-h" data-dia="' + i + '"><b>Día ' + (i + 1) + ' · ' + fechaDia(v, i) + '<span class="gv-s">' + d + '</span></b><small>' + (k ? k + (k === 1 ? ' parada' : ' paradas') + (() => { const P = ptsDia(v, i), r = P && enCacheR(P); return r ? '<br>🚗 ' + kmTxt(r.km) + ' · ' + durTxt(r.min) : ''; })() : '') + (() => { const x = tiempoDe(sitioT(v, i), fDia(v, i)); return x ? (k ? '<br>' : '') + tiempoTxt(x) : ''; })() + '</small><i>▸</i></div></div>'; }
    { let K = 0, M = 0, todos = true, hay = false; for (let i = 0; i < n; i++) { const t = tramo(v, i); if (t.tipo !== 't') continue; hay = true; const r = enCache(t.a, t.b); if (r) { K += r.km; M += r.min; } else todos = false; }
      if (hay && todos) h += '<p class="sub">En total, unos <b>' + kmTxt(K) + '</b> de coche entre etapas y unas <b>' + durTxt(M) + '</b> al volante, sin paradas ni excursiones.</p>'; }
    h += '<div class="btns"><button id="gv-lle" title="Una página con todo el viaje para imprimir, guardar en PDF, descargar o mandar">🧳 Guía para llevar</button><button class="sec" id="gv-ren">✏️ Nombre</button><button class="sec" id="gv-bo">🗑 Borrar viaje</button></div>';
    const s = abreHoja(h); pintaMapa(v, null, encuadra);
    // las carreteras que falten se piden de una en una; al acabar se repinta (si se sigue en esta pantalla)
    { const faltan = []; for (let i = 0; i < n; i++) { const t = tramo(v, i); if (t.tipo === 't' && !enCache(t.a, t.b) && !falloR[rk(t.a, t.b)]) faltan.push(t); }
      if (faltan.length) (async () => { for (const t of faltan) await carretera(t.a, t.b); const el = document.getElementById('gv-ini'); if (el && enMapa === id && sh().classList.contains('on')) { const y = sh().scrollTop; viaje(id); sh().scrollTop = y; } })(); }
    pideTiempo(v).then(nv => { if (nv && enMapa === id && document.getElementById('gv-ini') && sh().classList.contains('on')) { const y = sh().scrollTop; viaje(id); sh().scrollTop = y; } });
    s.querySelector('#gv-x').onclick = cierraG; s.querySelector('#gv-v').onclick = lista;
    s.querySelector('#gv-ini').onchange = e => { if (!e.target.value) return; v.ini = e.target.value; if (!v.fin || v.fin < v.ini) v.fin = v.ini; ajusta(v); guarda(v); viaje(id); };
    s.querySelector('#gv-fin').onchange = e => { if (!e.target.value || e.target.value < v.ini) return; v.fin = e.target.value; ajusta(v); guarda(v); viaje(id); };
    s.querySelector('#gv-tl').onclick = s.querySelector('#gv-tlh').onclick = () => { lugAb[id] = !lugAb[id]; const y = sh().scrollTop; viaje(id); sh().scrollTop = y; };
    s.querySelectorAll('[data-lug]').forEach(e => e.onclick = () => lugar(id, e.dataset.lug));
    s.querySelectorAll('[data-ig]').forEach(e => e.onclick = () => { const i = +e.dataset.ig; v.noches[i] = { ...v.noches[i - 1] }; guarda(v); viaje(id, true); });
    s.querySelectorAll('[data-dia]').forEach(e => e.onclick = () => { const i = +e.dataset.dia; if (tramo(v, i).tipo === 'x') { lugAb[id] = true; viaje(id); sh().scrollTop = 0; avisa('Primero di de dónde sales y dónde duermes', 2500); return; } dia(id, i, true); });
    s.querySelector('#gv-lle').onclick = () => hojaLlevar(v);
    s.querySelector('#gv-ren').onclick = () => { const x = prompt('Nombre del viaje', v.nombre); if (x && x.trim()) { v.nombre = x.trim().slice(0, 80); guarda(v); viaje(id); } };
    { const b = s.querySelector('#gv-bo'); let p = 0; b.onclick = () => { if (ahora() - p > 3000) { p = ahora(); b.textContent = '¿Seguro? Pulsa otra vez'; return; } v.borrado = true; guarda(v); avisa('🗑 Viaje borrado', 2500); lista(); }; } }

  // elegir un lugar: buscando una localidad (OpenStreetMap) o con el centro del mapa
  /* buscador de pueblos propio (catalogo/pueblos.js, de OpenStreetMap): acepta faltas y va antes que tiendas o negocios */
  let pbP = null, PB = null;
  const cargaPueblos = () => pbP || (pbP = new Promise(ok => { if (window.PUEBLOS) return ok(); const sc = document.createElement('script'); sc.src = 'catalogo/pueblos.js'; sc.onload = () => ok(); sc.onerror = () => ok(); document.head.appendChild(sc); }));
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function lev(a, b, max) { if (Math.abs(a.length - b.length) > max) return max + 1; let p = Array.from({ length: b.length + 1 }, (_, k) => k);
    for (let i = 1; i <= a.length; i++) { const c = [i]; let m = i; for (let j = 1; j <= b.length; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (c[j] < m) m = c[j]; } if (m > max) return max + 1; p = c; } return p[b.length]; }
  function buscaPueblos(txt) { const W = window.PUEBLOS; if (!W) return []; if (!PB) PB = W.l.map(x => ({ x, ns: [x[0]].concat(x[5] ? x[5].split('|') : []).map(norm) }));
    const pal = norm(txt).split(' ').filter(Boolean); if (!pal.length) return []; const pv = W.p.map(norm), o = [];
    for (const e of PB) { let best = 99;
      for (let k = pal.length; k >= 1; k--) { const qq = pal.slice(0, k).join(' '), resto = pal.slice(k), tol = qq.length >= 11 ? 3 : qq.length >= 7 ? 2 : qq.length >= 4 ? 1 : 0;
        let sc = 99; e.ns.forEach((nm, ix) => { let d;
          if (nm === qq) d = 0; else if (nm.startsWith(qq)) d = 0.5; else if (nm.includes(' ' + qq) || nm.includes(qq)) d = 1.2;
          else { const a = lev(qq, nm, tol), b = lev(qq, nm.slice(0, qq.length), tol); d = Math.min(a <= tol ? 1 + a : 99, b <= tol ? 1.5 + b : 99); }
          if (ix) d += 0.3; if (d < sc) sc = d; });
        if (sc < 99) { const pn = pv[e.x[3]] || ''; for (const w of resto) sc += w.length < 4 ? 0.05 : pn.includes(w) ? -0.4 : 1.5; sc -= 0.25 * (k - 1); best = Math.min(best, sc); } }
      if (best < 99) o.push({ s: best - e.x[4] * 0.15, e }); }
    return o.sort((a, b) => a.s - b.s).slice(0, 6).map(({ e }) => ({ n: e.x[0], la: e.x[1], lo: e.x[2], sub: ['pueblo', 'villa', 'ciudad'][e.x[4]] + ' · ' + (W.p[e.x[3]] || '') + (e.x[5] ? ' · ' + e.x[5].split('|')[0] : '') })); }

  function buscador(q, r, elige) { let t = null, n = 0;
    const pinta = (L, extra) => { r._l = L; r.innerHTML = L.length ? L.map((l, j) => '<li data-j="' + j + '"><b>' + esc(l.n) + '</b><span>' + esc(l.sub) + '</span></li>').join('') + (extra || '') : (extra || '<li class="tt">No encuentro ese sitio. Prueba con otro nombre o usa el centro del mapa.</li>'); };
    q.oninput = () => { clearTimeout(t); const txt = q.value.trim(); if (txt.length < 3) { r.innerHTML = ''; return; } const k = ++n;
      cargaPueblos().then(() => { if (k !== n) return; const loc = buscaPueblos(txt); pinta(loc, '<li class="tt">Buscando más…</li>');
        t = setTimeout(async () => { let x = []; try { x = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=es,pt,fr,ad&limit=8&accept-language=es&q=' + encodeURIComponent(txt))).json(); } catch (e) {} if (k !== n) return;
          const lug = l => /^(place|boundary)$/.test(l.category || l.class || '') ? 0 : 1;
          const W = (x || []).slice().sort((a, b) => lug(a) - lug(b)).map(l => { const p = String(l.display_name || '').split(', '); return { n: l.name || p[0], sub: p.slice(1, 4).join(', '), la: +l.lat, lo: +l.lon }; })
            .filter(w => !loc.some(o => km(o, w) < 2 && norm(o.n) === norm(w.n)));
          pinta(loc.concat(W).slice(0, 10)); }, 450); }); };
    r.onclick = e => { const li = e.target.closest('li[data-j]'); if (!li) return; elige(r._l[+li.dataset.j]); }; }
  function ponLugar(id, cual, x) { const v = G.g[id]; if (!v) return; if (cual === 'sal') v.sal = x; else v.noches[+cual] = x; finLugar(); lugAb[id] = true; guarda(v); viaje(id, true); }
  /* elegir sitio tocando el mapa (o un sitio del catálogo) */
  let ML = null, mlMk = null;
  const mlTxt = () => { const v = ML && G.g[ML.id]; return !v ? '' : ML.cual === 'sal' ? '🏠 Salgo de aquí' : '🛏 Dormir aquí · noche ' + (+ML.cual + 1); };
  function finLugar() { ML = null; const b = document.getElementById('gv-ml'); if (b) b.remove(); if (mlMk) { try { map.removeLayer(mlMk); } catch (e) {} mlMk = null; } }
  function enMapaLugar(id, cual) { ML = { id, cual }; const s = sh(); s.classList.remove('on');
    let b = document.getElementById('gv-ml'); if (!b) { b = document.createElement('div'); b.id = 'gv-ml'; document.body.appendChild(b); }
    b.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:3000;background:#1d4ed8;color:#fff;border-radius:12px;padding:9px 12px;font:600 14px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.3);width:min(420px,92vw);box-sizing:border-box';
    b.innerHTML = '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between"><span>' + (cual === 'sal' ? 'Toca en el mapa el sitio de donde sales, o búscalo' : 'Toca en el mapa dónde duermes la noche ' + (+cual + 1) + ', o búscalo') + '</span><button id="gv-mlx" style="background:#fff;color:#1d4ed8;border:0;border-radius:8px;padding:5px 9px;font:600 13px system-ui">Cancelar</button></div>'
      + '<input id="gv-mlq" type="search" placeholder="Buscar pueblo o ciudad…" autocomplete="off" class="gv-q" style="margin:8px 0 0;width:100%;box-sizing:border-box;color:#1d2125"><ul id="gv-mlr" class="gv-r" style="background:#fff;color:#1d2125;border-radius:8px;margin:4px 0 0;max-height:40vh;overflow:auto"></ul>';
    b.querySelector('#gv-mlx').onclick = () => { finLugar(); lugar(id, cual); };
    const q = b.querySelector('#gv-mlq'), r = b.querySelector('#gv-mlr');
    buscador(q, r, l => { r.innerHTML = ''; q.value = ''; q.blur(); map.setView([+l.la, +l.lo], Math.max(map.getZoom(), 12), { animate: false }); tarjetaLugar(+l.la, +l.lo, l.n, l.sub); }); }
  function pueblo(la, lo) { const W = window.PUEBLOS; if (!W) return null; let m = null; for (const x of W.l) { const d = km({ la, lo }, { la: x[1], lo: x[2] }); if (d < 4 && (!m || d < m.d)) m = { d, x }; } return m && { n: m.x[0], sub: (W.p[m.x[3]] || ''), d: m.d }; }
  function tarjetaLugar(la, lo, nom, sub0) { if (!ML) return; const { id, cual } = ML;
    if (mlMk) { try { map.removeLayer(mlMk); } catch (e) {} } mlMk = L.circleMarker([la, lo], { radius: 9, color: '#1d4ed8', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map);
    const banda = x => { const b = document.getElementById('gv-ml'); if (b) b.style.display = x ? '' : 'none'; };
    const pinta = (n, sub) => { banda(false); const s = abreHoja('<button class="x" id="gv-x">✕</button><h2>📍 ' + esc(n) + '</h2><p class="sub">' + esc(sub || '') + '</p><div class="btns"><button id="gv-mlok">' + mlTxt() + '</button><button class="sec" id="gv-mlotro">Tocar otro sitio</button></div>');
      s.querySelector('#gv-x').onclick = () => { finLugar(); lugar(id, cual); };
      s.querySelector('#gv-mlok').onclick = () => ponLugar(id, cual, { n, la: +la.toFixed(5), lo: +lo.toFixed(5) });
      s.querySelector('#gv-mlotro').onclick = () => { if (mlMk) { try { map.removeLayer(mlMk); } catch (e) {} mlMk = null; } sh().classList.remove('on'); banda(true); }; };
    if (nom) return pinta(nom, sub0 || '');
    cargaPueblos().then(async () => { if (!ML) return; const p = pueblo(la, lo); if (p) return pinta(p.n, (p.d < 0.6 ? '' : 'a ' + kmTxt(p.d) + ' del pueblo · ') + p.sub);
      pinta('Buscando el nombre…', ''); let n = la.toFixed(3) + ', ' + lo.toFixed(3), sub = '';
      try { const x = await (await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=es&lat=' + la + '&lon=' + lo)).json(); const a = x.address || {}; n = a.village || a.town || a.city || a.municipality || a.hamlet || x.name || n; sub = [a.province || a.state || '', a.country && a.country !== 'España' ? a.country : ''].filter(Boolean).join(', '); } catch (e) {}
      if (ML) pinta(n, sub); }); }
  map.on('click', e => { if (ML) setTimeout(() => tarjetaLugar(e.latlng.lat, e.latlng.lng), 0); });

  function lugar(id, cual) { const v = G.g[id], es = cual === 'sal', i = es ? -1 : +cual;
    let h = cab(es ? '🏠 ¿De dónde sales?' : '🛏 ¿Dónde duermes la noche ' + (i + 1) + '?', '← ' + esc(v.nombre));
    h += '<input id="gv-q" type="search" placeholder="Escribe un pueblo o ciudad…" autocomplete="off" class="gv-q"><ul id="gv-r" class="gv-r"></ul>';
    h += '<div class="btns"><button id="gv-enmapa">🗺 Elegir en el mapa</button><button class="sec" id="gv-centro">📍 Usar el centro del mapa</button></div><p class="sub">«Elegir en el mapa» te lleva al mapa: toca el pueblo o un sitio del catálogo y pulsa «' + (es ? '🏠 Salgo de aquí' : '🛏 Dormir aquí') + '».</p>';
    const s = abreHoja(h), q = s.querySelector('#gv-q'), r = s.querySelector('#gv-r');
    const pon = x => ponLugar(id, cual, x);
    s.querySelector('#gv-enmapa').onclick = () => enMapaLugar(id, cual);
    s.querySelector('#gv-x').onclick = cierraG; s.querySelector('#gv-v').onclick = () => viaje(id);
    s.querySelector('#gv-centro').onclick = async () => { const c = map.getCenter(); let nom = c.lat.toFixed(3) + ', ' + c.lng.toFixed(3);
      try { const x = await (await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=es&lat=' + c.lat + '&lon=' + c.lng)).json(); const a = x.address || {}; nom = a.village || a.town || a.city || a.municipality || a.hamlet || x.name || nom; } catch (e) {}
      pon({ n: nom, la: +c.lat.toFixed(5), lo: +c.lng.toFixed(5) }); };
    buscador(q, r, l => pon({ n: l.n, la: +(+l.la).toFixed(5), lo: +(+l.lo).toFixed(5) }));
    setTimeout(() => { try { q.focus(); } catch (e) {} }, 250); }

  let minE = 4;
  function dia(id, i, encuadra) { volver = null; const v = G.g[id]; if (!v) return lista(); const t = tramo(v, i), n = nDias(v); activo = { v: id, d: i };
    const plan = ((v.dias = v.dias || {})[i] = v.dias[i] || []), enPlan = new Set(plan.map(s => s.id));
    let h = cab('Día ' + (i + 1) + ' · ' + fechaDia(v, i), '← ' + esc(v.nombre));
    if (t.tipo === 'x') { h += '<p class="sub">Para sugerirte algo necesito saber de dónde sales y dónde duermes este día. Vuelve al viaje y complétalo.</p>'; const s = abreHoja(h); pintaMapa(v, i, false); s.querySelector('#gv-x').onclick = cierraG; s.querySelector('#gv-v').onclick = () => viaje(id); return; }
    const rt = t.tipo === 't' ? enCache(t.a, t.b) : null, pr = ptsDia(v, i), rr = pr ? enCacheR(pr) : null;
    h += '<p class="gv-t" id="gv-dia-' + i + '">' + (t.tipo === 'b' ? '🏕 Día de base en <b>' + esc(t.a.n) + '</b>' : '🚗 Traslado: <b>' + esc(t.a.n) + '</b> → <b>' + esc(t.b.n) + '</b> · ' + viaTxt(t)) + '</p>';
    { const p = sitioT(v, i), f = fDia(v, i), x = tiempoDe(p, f); if (p && f >= hoyISO()) h += '<p class="sub gv-tie">' + (x ? tiempoTxt(x, true, esc(p.n)) : '🌡 Mirando el tiempo en ' + esc(p.n) + '…') + '</p>'; }
    // el plan del día
    h += '<h3 class="gv-h3">Tu plan del día</h3>';
    if (!plan.length) h += '<p class="sub">Vacío. Pulsa «＋» en una sugerencia de abajo, o abre cualquier sitio del mapa y pulsa «🧭 Al viaje».</p>';
    else { h += '<ol class="cuad-i">'; let ant = t.a, tot = 0;
      plan.forEach((s, j) => { const d = km(ant, s), lg = rr && rr.legs[j]; tot += d; ant = s; h += '<li><span class="ic gv-n">' + (j + 1) + '</span><span class="n" data-ir="' + esc(s.id) + '">' + esc(s.n) + '<span>' + (lg ? '🚗 ' + kmTxt(lg.km) + ' · ' + durTxt(lg.min) : 'a ' + kmTxt(d) + ' en línea recta') + (j ? ' desde la parada anterior' : ' desde ' + esc(t.a.n)) + (visto(s.id) ? ' · ✅ ya visto' : '') + '</span></span>' + (j ? '<button class="q" data-su="' + j + '" title="Subir">↑</button>' : '') + '<button class="q" data-qu="' + j + '" title="Quitar del día">✕</button></li>'; });
      tot += km(ant, t.b || t.a); const fin = t.b || t.a, ul = rr && rr.legs[plan.length];
      h += '</ol>' + (plan.length >= 2 || DES[id + '|' + i] ? '<div class="btns" style="margin:2px 0 6px">' + (plan.length >= 2 ? '<button class="sec" id="gv-ord" title="Busca el orden de las paradas con menos tiempo de coche, desde ' + esc(t.a.n) + ' hasta ' + esc((t.b || t.a).n) + '">🔀 Ordenar para conducir menos</button>' : '') + (DES[id + '|' + i] ? '<button class="sec" id="gv-des">↩ Deshacer el orden</button>' : '') + '</div>' : '') + (ul ? '<p class="sub" style="margin-top:-4px">Y de la última parada ' + (t.tipo === 'b' ? 'de vuelta a ' : 'a ') + esc(fin.n) + ': 🚗 ' + kmTxt(ul.km) + ' · ' + durTxt(ul.min) + '</p>' : '');
      h += rr ? '<p class="gv-t">🚗 Recorrido del día en coche' + (t.tipo === 'b' ? ' (ida y vuelta a ' + esc(t.a.n) + ')' : ' hasta ' + esc(fin.n)) + ': <b>' + kmTxt(rr.km) + '</b> · unas <b>' + durTxt(rr.min) + '</b> al volante, sin contar el tiempo en cada sitio' + (t.tipo === 't' && rt ? ' (el trayecto directo son ' + kmTxt(rt.km) + ' y ' + durTxt(rt.min) + ')' : '') + '. Aproximado.</p>'
        : '<p class="sub">Total del día, de parada en parada y hasta ' + esc(fin.n) + ': unos <b>' + kmTxt(tot) + '</b> en línea recta' + (falloR[rkR(pr)] ? ' (no he podido calcular la ruta en coche; por carretera será más).' : ' <span class="gv-c">· calculando la ruta en coche…</span>') + '</p>'; }
    // sugerencias
    const fila = (x, sub) => { const p = x.p, ya = enPlan.has(p[0]), vi = visto(p[0]); return '<li class="' + (vi ? 'gv-vi' : '') + '"><span class="ic" style="background:' + (CAPAS[p[1]] || CAPAS.t).c + '">' + (p[1] === 'r' ? '🥾' : est(p) + '★') + '</span><span class="n" data-ir="' + esc(p[0]) + '">' + esc(p[2]) + '<span>' + sub + (vi ? ' · ✅ ya visto' : '') + '</span></span><button class="gv-mas' + (ya ? ' ya' : '') + '" data-mas="' + esc(p[0]) + '" title="' + (ya ? 'Ya está en el día' : 'Añadir al día') + '">' + (ya ? '✓' : '＋') + '</button></li>'; };
    const filtro = '<div class="gv-e">Importancia mínima: ' + [5, 4, 3].map(e => '<button data-e="' + e + '" class="' + (minE === e ? 'on' : '') + '">' + e + '★' + (e < 5 ? ' o más' : '') + '</button>').join('') + '</div>';
    if (t.tipo === 't') { const aCasa = !!(v.sal && km(t.b, v.sal) < 3), todo = deCamino(t.a, t.b, minE, rt && rt.g, aCasa), S = reparte(todo), largo = rt ? rt.km : t.km;
      h += '<h3 class="gv-h3">🚗 De camino</h3><p class="sub">Lo que queda a menos de ' + ANCHO + ' km ' + (rt ? 'de la carretera' : 'de la línea recta (todavía no tengo la carretera)') + ', repartido a lo largo del camino y en el orden en que lo encuentras. No incluyo lo que rodea a ' + esc(t.a.n) + (aCasa ? ' ni a ' + esc(t.b.n) + ', que es tu punto de partida' : '') + '.</p>' + filtro;
      h += S.length ? '<ol class="cuad-i">' + S.map(x => fila(x, 'km ' + Math.round(x.f * largo) + ' · a ' + kmTxt(x.d) + (rt ? ' de la carretera' : ' del trayecto'))).join('') + '</ol>' + (todo.length > S.length ? '<p class="sub">Hay ' + (todo.length - S.length) + ' más que no enseño (dejo los 6 mejores de cada tramo): sube la importancia mínima para afinar.</p>' : '') : '<p class="sub">No hay nada de esa importancia cerca del trayecto. Prueba a bajar la importancia mínima.</p>';
      const R = aCasa ? [] : rutasCerca(t.b, 15, 6); if (R.length) h += '<h3 class="gv-h3">🥾 Rutas a pie cerca de ' + esc(t.b.n) + '</h3><ol class="cuad-i">' + R.map(x => fila(x, 'sale a ' + kmTxt(x.d))).join('') + '</ol>';
    } else { const S = alrededor(t.a, minE, 50), an = [[0, 10], [10, 25], [25, 50]];
      h += '<h3 class="gv-h3">🏕 Alrededor de ' + esc(t.a.n) + '</h3>' + filtro;
      if (!S.length) h += '<p class="sub">No hay nada de esa importancia a menos de 50 km. Prueba a bajar la importancia mínima.</p>';
      for (const [a, b] of an) { const g = S.filter(x => x.d >= a && x.d < b); if (!g.length) continue;
        h += '<div class="visto-mu">' + (a ? 'De ' + a + ' a ' + b + ' km' : 'A menos de ' + b + ' km') + ' · ' + g.length + '</div><ol class="cuad-i">' + g.slice(0, 25).map(x => fila(x, 'a ' + kmTxt(x.d))).join('') + '</ol>' + (g.length > 25 ? '<p class="sub">…y ' + (g.length - 25) + ' más.</p>' : ''); }
      const R = rutasCerca(t.a, 25, 10); if (R.length) h += '<h3 class="gv-h3">🥾 Rutas a pie cerca</h3><ol class="cuad-i">' + R.map(x => fila(x, 'sale a ' + kmTxt(x.d))).join('') + '</ol>'; }
    { const base = t.tipo === 'b' ? t.a : t.b, A = (t.tipo === 't' && v.sal && km(t.b, v.sal) < 3) ? [] : actCerca(base, 30);
      if (A.length) h += '<h3 class="gv-h3">🎟 Actividades con guía cerca de ' + esc(base.n) + '</h3>' + A.map(x => actHtml(x, base.n)).join(''); }
    h += '<div class="btns">' + (i > 0 ? '<button class="sec" data-otro="' + (i - 1) + '">← Día ' + i + '</button>' : '') + (i < n - 1 ? '<button class="sec" data-otro="' + (i + 1) + '">Día ' + (i + 2) + ' →</button>' : '') + '</div>';
    const s = abreHoja(h); pintaMapa(v, i, encuadra);
    const otraVez = () => { if (activo && activo.v === id && activo.d === i && document.getElementById('gv-dia-' + i)) { const y = sh().scrollTop; dia(id, i); sh().scrollTop = y; } };
    if (t.tipo === 't' && !rt && !falloR[rk(t.a, t.b)]) carretera(t.a, t.b).then(otraVez);
    if (pr && !rr && !falloR[rkR(pr)]) recorrido(pr).then(r => { otraVez(); if (r && enMapa === v.id) pintaMapa(v, i, false); });
    pideTiempo(v).then(nv => { if (nv) otraVez(); else { const e = document.querySelector('.gv-tie'); if (e && /Mirando/.test(e.textContent)) e.textContent = '🌡 No he podido consultar el tiempo ahora.'; } });
    if (!window.ACTIV) cargaAct().then(() => { if (window.ACTIV && window.ACTIV.length) otraVez(); });
    s.querySelector('#gv-x').onclick = cierraG; s.querySelector('#gv-v').onclick = () => viaje(id, true);
    s.querySelectorAll('[data-e]').forEach(e => e.onclick = () => { minE = +e.dataset.e; const y = sh().scrollTop; dia(id, i); sh().scrollTop = y; });
    s.querySelectorAll('[data-otro]').forEach(e => e.onclick = () => dia(id, +e.dataset.otro, true));
    s.querySelectorAll('[data-mas]').forEach(e => e.onclick = () => { const p = pid(e.dataset.mas); if (!p) return; const y = sh().scrollTop;
      const k = plan.findIndex(x => x.id === p[0]); if (k >= 0) plan.splice(k, 1); else { plan.push({ id: p[0], n: p[2], c: p[1], la: p[4], lo: p[5] }); if (t.tipo === 't') ordena(plan, t); }
      delete DES[id + '|' + i]; guarda(v); dia(id, i); sh().scrollTop = y; });
    s.querySelectorAll('[data-qu]').forEach(e => e.onclick = () => { plan.splice(+e.dataset.qu, 1); delete DES[id + '|' + i]; guarda(v); dia(id, i); });
    { const bo = s.querySelector('#gv-ord'); if (bo) bo.onclick = async () => { bo.disabled = true; bo.textContent = '⏳ Calculando…'; const y = sh().scrollTop;
        const P = [t.a].concat(plan, [t.b || t.a]), M_ = await matriz(P), r = mejorOrden(M_.D, plan.length), ahorro = Math.round((r.viejo - r.coste) / 60);
        if (!(activo && activo.v === id && activo.d === i)) return;
        if (ahorro < 1 || r.orden.every((k, j) => k === j + 1)) { avisa('✓ Ya estaban en el orden con menos coche' + (M_.coche ? '' : ' (calculado en línea recta)'), 3000); dia(id, i); sh().scrollTop = y; return; }
        DES[id + '|' + i] = plan.slice(); const np = r.orden.map(k => plan[k - 1]); plan.splice(0, plan.length, ...np); guarda(v);
        avisa('🔀 Reordenado: unos ' + ahorro + ' min menos de coche' + (M_.coche ? '' : ' (calculado en línea recta: no he podido consultar las carreteras)'), 4000); dia(id, i); sh().scrollTop = y; }; }
    { const bd = s.querySelector('#gv-des'); if (bd) bd.onclick = () => { const o = DES[id + '|' + i]; delete DES[id + '|' + i]; if (o) { plan.splice(0, plan.length, ...o); guarda(v); avisa('↩ Orden anterior recuperado', 2500); } const y = sh().scrollTop; dia(id, i); sh().scrollTop = y; }; }
    s.querySelectorAll('[data-su]').forEach(e => e.onclick = () => { const j = +e.dataset.su; plan.splice(j - 1, 0, plan.splice(j, 1)[0]); delete DES[id + '|' + i]; guarda(v); dia(id, i); });
    s.querySelectorAll('[data-ir]').forEach(e => e.onclick = () => { if (pid(e.dataset.ir)) { volver = { v: id, d: i, id: e.dataset.ir, y: sh().scrollTop }; abre(e.dataset.ir); } else avisa('Ese sitio ya no está en el catálogo.', 3000); }); }
  /* ---------- guía para llevar (20-nov): una página sola con todo el viaje, que funciona sin conexión; se imprime, se guarda en PDF, se descarga o se comparte ---------- */
  function mapaSVG(capas, ancho) { // capas: [{pts:[{la,lo}], linea:true|false, color, ancho, discont, puntos:[{la,lo,txt,c}]}]
    const T_ = []; capas.forEach(c => (c.pts || []).concat(c.puntos || []).forEach(p => T_.push(p))); if (!T_.length) return '';
    let a = Math.min(...T_.map(p => p.la)), b = Math.max(...T_.map(p => p.la)), c0 = Math.min(...T_.map(p => p.lo)), d0 = Math.max(...T_.map(p => p.lo));
    const k = Math.cos((a + b) / 2 * Math.PI / 180), mx = Math.max((d0 - c0) * k, b - a, 0.02) * 0.12; a -= mx; b += mx; c0 -= mx / k; d0 += mx / k;
    const W = ancho || 640, H = Math.max(160, Math.min(520, Math.round(W * (b - a) / ((d0 - c0) * k || 1)))), X = lo => ((lo - c0) / (d0 - c0) * W).toFixed(1), Y = la => ((b - la) / (b - a) * H).toFixed(1);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="background:#f4f1ea;border:1px solid #ddd;border-radius:8px">';
    for (const c of capas) if (c.pts && c.pts.length > 1) s += '<polyline fill="none" stroke="' + c.color + '" stroke-width="' + (c.ancho || 3) + '"' + (c.discont ? ' stroke-dasharray="7 6"' : '') + ' stroke-linejoin="round" points="' + c.pts.map(p => X(p.lo) + ',' + Y(p.la)).join(' ') + '"/>';
    for (const c of capas) for (const p of (c.puntos || [])) s += '<circle cx="' + X(p.lo) + '" cy="' + Y(p.la) + '" r="11" fill="' + (p.c || '#ea580c') + '" stroke="#fff" stroke-width="2"/><text x="' + X(p.lo) + '" y="' + (+Y(p.la) + 4) + '" text-anchor="middle" font="700 11px system-ui" style="font:700 11px system-ui" fill="#fff">' + esc(p.txt) + '</text>'
      + (p.nom ? '<text x="' + (+X(p.lo) + 14) + '" y="' + (+Y(p.la) + 4) + '" style="font:600 11px system-ui;paint-order:stroke;stroke:#f4f1ea;stroke-width:3px" fill="#222">' + esc(p.nom.length > 28 ? p.nom.slice(0, 27) + '…' : p.nom) + '</text>' : '');
    return s + '</svg>'; }
  const corta = (x, n) => { x = String(x || ''); if (x.length <= n) return x; const c = x.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf('. ') + 1, c.lastIndexOf(' '))) + '…'; };
  async function guiaLlevar(v, boton) {
    const n = nDias(v), ids = new Set(); for (let i = 0; i < n; i++) ((v.dias || {})[i] || []).forEach(s => ids.add(s.id));
    if (boton) { boton.disabled = true; boton.textContent = '⏳ Preparando la guía…'; }
    // fichas de las paradas, recorridos que falten y tiempo
    await Promise.all([...ids].map(id => ZP[id] && !(id in F) ? carga('f', ZP[id]).catch(() => null) : null));
    try { await cargaAct(); } catch (e) {}
    for (let i = 0; i < n; i++) { const t = tramo(v, i), P = ptsDia(v, i); if (P && !enCacheR(P) && !falloR[rkR(P)]) await recorrido(P); else if (!P && t.tipo === 't' && !enCache(t.a, t.b) && !falloR[rk(t.a, t.b)]) await carretera(t.a, t.b); }
    try { await pideTiempo(v); } catch (e) {}
    const CL = { t: '#7c3aed', n: '#0f766e', h: '#92400e', r: '#374151', m: '#be185d' };
    let h = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(v.nombre) + ' · guía de viaje</title><style>'
      + 'body{font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:780px;margin:0 auto;padding:16px;background:#fff}h1{font-size:26px;margin:4px 0}h2{font-size:20px;margin:28px 0 4px;padding-top:10px;border-top:3px solid #ea580c}'
      + '.sub{color:#6b7280;font-size:13px}.dia{break-before:page}.p{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin:10px 0;break-inside:avoid}.p h3{margin:0 0 2px;font-size:16px}.n{display:inline-block;min-width:22px;height:22px;border-radius:11px;background:#ea580c;color:#fff;text-align:center;font:700 13px/22px system-ui;margin-right:6px}'
      + '.p ul{margin:6px 0 4px 18px;padding:0}.p li{margin:1px 0}.coche{color:#374151;font-size:13px;margin:2px 0 0}.t{background:#eff6ff;border-radius:8px;padding:6px 10px;font-size:14px;margin:6px 0}.bar{position:sticky;top:0;background:#fff;padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;z-index:2}'
      + '.bar button{font:600 14px system-ui;padding:9px 14px;border-radius:9px;border:1px solid #d1d5db;background:#f9fafb}a{color:#1d4ed8}@media print{.bar{display:none}h2{border-top-width:2px}body{padding:0}}</style></head><body>';
    h += '<div class="bar"><button onclick="print()">🖨 Imprimir o guardar en PDF</button></div>';
    h += '<h1>🧭 ' + esc(v.nombre) + '</h1><div class="sub">' + esc(rango(v)) + ' · ' + n + ' días · sales de ' + esc(v.sal ? v.sal.n : '—') + '</div>';
    // mapa general
    { const C = [], noches = []; let K = 0, Mi = 0, todos = true;
      for (let i = 0; i < n; i++) { const t = tramo(v, i); if (t.tipo !== 't') continue; const r = enCache(t.a, t.b); if (r) { K += r.km; Mi += r.min; } else todos = false;
        C.push({ pts: r && r.g ? r.g.map(g => ({ la: g[0], lo: g[1] })) : [t.a, t.b], color: '#2563eb', ancho: 3, discont: !r }); }
      (v.noches || []).forEach((x, i) => { if (x && !noches.some(y => km(y, x) < 1)) noches.push({ la: x.la, lo: x.lo, txt: '🛏', nom: x.n, c: '#1d4ed8' }); });
      if (v.sal) C.push({ puntos: [{ la: v.sal.la, lo: v.sal.lo, txt: '⌂', nom: v.sal.n, c: '#111827' }] }); C.push({ puntos: noches });
      h += mapaSVG(C);
      if (todos && K) h += '<p class="sub">En total, unos <b>' + kmTxt(K) + '</b> de coche entre etapas y unas <b>' + durTxt(Mi) + '</b> al volante, sin excursiones.</p>';
      h += '<ol style="padding-left:20px;margin:8px 0">' + Array.from({ length: n }, (_, i) => { const t = tramo(v, i), k = ((v.dias || {})[i] || []).length;
        return '<li><b>' + fechaDia(v, i) + '</b> · ' + (t.tipo === 'x' ? '<i>sin definir</i>' : t.tipo === 'b' ? 'base en ' + esc(t.a.n) : esc(t.a.n) + ' → ' + esc(t.b.n)) + (k ? ' · ' + k + (k === 1 ? ' parada' : ' paradas') : '') + '</li>'; }).join('') + '</ol>'; }
    for (let i = 0; i < n; i++) { const t = tramo(v, i), plan = (v.dias || {})[i] || [];
      h += '<section class="dia"><h2>Día ' + (i + 1) + ' · ' + fechaDia(v, i) + '</h2>';
      if (t.tipo === 'x') { h += '<p class="sub">Día sin definir (falta la salida o la noche).</p></section>'; continue; }
      const rt = t.tipo === 't' ? enCache(t.a, t.b) : null, P = ptsDia(v, i), rr = P ? enCacheR(P) : null, fin = t.b || t.a;
      h += '<div class="sub">' + (t.tipo === 'b' ? '🏕 Día de base en <b>' + esc(t.a.n) + '</b>' : '🚗 ' + esc(t.a.n) + ' → ' + esc(t.b.n) + (rt ? ' · ' + kmTxt(rt.km) + ' por carretera · unas ' + durTxt(rt.min) : ' · ' + kmTxt(t.km) + ' en línea recta')) + '</div>';
      { const p = sitioT(v, i), x = tiempoDe(p, fDia(v, i)); if (x) h += '<div class="t">' + tiempoTxt(x, true, esc(p.n)) + '</div>'; }
      const geo = rr && rr.g ? rr.g.map(g => ({ la: g[0], lo: g[1] })) : rt && rt.g && !plan.length ? rt.g.map(g => ({ la: g[0], lo: g[1] })) : [t.a].concat(plan, [fin]);
      h += mapaSVG([{ pts: geo, color: '#ea580c', ancho: 3.5, discont: !(rr || (rt && !plan.length)) }, { puntos: [{ la: t.a.la, lo: t.a.lo, txt: t.tipo === 'b' ? '🛏' : 'A', nom: t.a.n, c: '#1d4ed8' }].concat(t.tipo === 't' ? [{ la: t.b.la, lo: t.b.lo, txt: 'B', nom: t.b.n, c: '#1d4ed8' }] : []) },
        { puntos: plan.map((s, j) => ({ la: s.la, lo: s.lo, txt: String(j + 1), nom: s.n, c: '#ea580c' })) }], 640);
      if (!plan.length) h += '<p class="sub">Sin paradas en el plan de este día.</p>';
      else { if (rr) h += '<p class="coche">🚗 Recorrido del día: <b>' + kmTxt(rr.km) + '</b> · unas <b>' + durTxt(rr.min) + '</b> al volante (sin contar el tiempo en cada sitio). Aproximado.</p>';
        plan.forEach((s, j) => { const p = pid(s.id), f = F[s.id] || {}, lg = rr && rr.legs[j];
          h += '<div class="p"><h3><span class="n">' + (j + 1) + '</span>' + esc(s.n) + (p && p[8] ? ' <span class="sub">' + '★'.repeat(p[8]) + '</span>' : '') + '</h3>';
          h += '<div class="sub">' + (f.municipio ? esc(f.municipio) + ' · ' : '') + (lg ? '🚗 ' + kmTxt(lg.km) + ' · ' + durTxt(lg.min) + (j ? ' desde la parada anterior' : ' desde ' + esc(t.a.n)) : '') + (p && p[6] ? ' · ⚠ posición aproximada' : '') + '</div>';
          if (f.distancia_km) h += '<div class="sub">🥾 ' + String(f.distancia_km).replace('.', ',') + ' km' + (f.desnivel_positivo_m ? ' · +' + f.desnivel_positivo_m + ' m' : '') + (f.tiempo_estimado_horas ? ' · unas ' + durTxt(Math.round(f.tiempo_estimado_horas * 60)) + ' andando' : '') + '</div>';
          if (f.resumen) h += '<p style="margin:6px 0 2px">' + esc(corta(f.resumen, 520)) + '</p>';
          if (f.ver_alli && f.ver_alli.length) h += '<ul>' + f.ver_alli.slice(0, 8).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
          if (f.visita) h += '<div style="font-size:14px"><b>Visita:</b> ' + esc(f.visita) + '</div>';
          if (f.web) h += '<div style="font-size:13px"><a href="' + esc(f.web) + '">' + esc(f.web.replace(/^https?:\/\//, '').slice(0, 60)) + '</a></div>';
          h += '<div style="font-size:13px;margin-top:3px">📍 ' + (+s.la).toFixed(5) + ', ' + (+s.lo).toFixed(5) + ' · <a href="https://www.google.com/maps/dir/?api=1&destination=' + s.la + ',' + s.lo + '">Cómo llegar</a></div></div>'; });
        const ul = rr && rr.legs[plan.length]; if (ul) h += '<p class="coche">Y de la última parada ' + (t.tipo === 'b' ? 'de vuelta a ' : 'a ') + esc(fin.n) + ': 🚗 ' + kmTxt(ul.km) + ' · ' + durTxt(ul.min) + '</p>'; }
      { const A = actCerca(t.tipo === 'b' ? t.a : t.b, 30); if (A.length && !(t.tipo === 't' && v.sal && km(t.b, v.sal) < 3)) h += '<p class="sub" style="margin-top:10px"><b>🎟 Actividades con guía cerca:</b> ' + A.slice(0, 6).map(x => esc(x.a.n || x.a.nombre || '') + ' (' + kmTxt(x.d) + ')').join(' · ') + '</p>'; }
      h += '</section>'; }
    h += '<p class="sub" style="margin-top:30px;border-top:1px solid #e5e7eb;padding-top:8px">Hecho el ' + new Date().toLocaleDateString('es-ES') + ' con la guía de viaje' + (PUB ? ' de historiatotal.es/viajes' : ' de App Mapas') + '. Textos: Wikipedia y webs oficiales; posiciones y mapas: © colaboradores de OpenStreetMap; carreteras: OSRM; tiempo: Open-Meteo. Distancias y tiempos aproximados.</p></body></html>';
    if (boton) { boton.disabled = false; boton.textContent = '🧳 Guía para llevar'; }
    return h; }
  function hojaLlevar(v) { const s = abreHoja(cab('🧳 Guía para llevar', '← ' + esc(v.nombre)) + '<p class="sub">Una sola página con todo el viaje: mapas de cada día, paradas con su ficha, kilómetros y tiempo. Se ve <b>sin conexión</b> una vez descargada.</p>'
      + '<div class="btns" style="flex-direction:column;align-items:stretch;gap:8px"><button id="gl-ver">👀 Verla e imprimir / guardar en PDF</button><button class="sec" id="gl-baj">⬇ Descargar al móvil u ordenador (.html)</button>' + (navigator.canShare ? '<button class="sec" id="gl-com">📤 Mandarla (WhatsApp, correo…)</button>' : '') + '</div><p class="sub" id="gl-est"></p>');
    s.querySelector('#gv-x').onclick = cierraG; s.querySelector('#gv-v').onclick = () => viaje(v.id);
    const nombreF = 'Guia ' + v.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/\s+/g, ' ').trim() + '.html', est = s.querySelector('#gl-est');
    const hazla = async b => { est.textContent = '⏳ Preparando (fichas, carreteras y tiempo)…'; const h = await guiaLlevar(v, b); est.textContent = ''; return h; };
    s.querySelector('#gl-ver').onclick = async e => { const w = window.open('', '_blank'); const h = await hazla(e.target); if (w) { w.document.open(); w.document.write(h); w.document.close(); } else { const u = URL.createObjectURL(new Blob([h], { type: 'text/html' })); location.href = u; } };
    s.querySelector('#gl-baj').onclick = async e => { const h = await hazla(e.target), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h], { type: 'text/html' })); a.download = nombreF; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); est.textContent = '✓ Descargada: «' + nombreF + '». Ábrela desde Descargas; funciona sin conexión.'; };
    const bc = s.querySelector('#gl-com'); if (bc) bc.onclick = async e => { const h = await hazla(e.target), file = new File([h], nombreF, { type: 'text/html' });
      try { if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: v.nombre }); else est.textContent = 'Este aparato no deja mandar ficheros; usa «Descargar».'; } catch (er) { if (er && er.name !== 'AbortError') est.textContent = 'No se ha podido mandar; usa «Descargar».'; } }; }

  // en un día de traslado las paradas se ordenan solas según se avanza por el trayecto
  function ordena(plan, t) { const k = Math.cos((t.a.la + t.b.la) / 2 * Math.PI / 180), bx = (t.b.lo - t.a.lo) * k, by = t.b.la - t.a.la, L2 = bx * bx + by * by || 1;
    const f = s => ((s.lo - t.a.lo) * k * bx + (s.la - t.a.la) * by) / L2; plan.sort((x, y) => f(x) - f(y)); }

  /* ---------- enganche a las fichas: «← volver al día» y «🧭 Al viaje» ---------- */
  const f0 = window.ficha;
  if (typeof f0 === 'function') window.ficha = function (p) { const r = f0.apply(this, arguments);
    try { const s = sh(); if (p && s.classList.contains('on') && (p[1] === 't' || p[1] === 'n' || p[1] === 'h' || p[1] === 'r')) {
      if (volver && p[0] !== volver.id) volver = null;
      if (volver && !s.querySelector('.gv-volver')) { const w = volver, b = document.createElement('button'); b.className = 'volver gv-volver'; b.textContent = '← Día ' + (w.d + 1) + ' del viaje'; b.onclick = () => { volver = null; dia(w.v, w.d); sh().scrollTop = w.y || 0; }; s.insertBefore(b, s.children[1] || null); }
      if (p[1] === 'n' && window.ACTIV && !s.querySelector('.gv-af')) { const A = (window.ACTIV || []).filter(x => x.z && km({ la: p[4], lo: p[5] }, x.z) <= x.z.r).map(a => ({ a, d: 0, q: (a.sal || [])[0] }));
        if (A.length) { const d = document.createElement('div'); d.className = 'gv-af'; d.innerHTML = '<h3 class="gv-h3">🎟 Actividades con guía en la zona</h3>' + A.map(x => actHtml(x, '')).join(''); const bb = s.querySelectorAll('.btns'); const ref = bb[bb.length - 1]; if (ref) ref.parentNode.insertBefore(d, ref); else s.appendChild(d); } }
      if (ML && G.g[ML.id] && !s.querySelector('.gv-ml')) { const w = ML, b = document.createElement('button'); b.className = 'gv-ml'; b.textContent = mlTxt(); b.onclick = () => ponLugar(w.id, w.cual, { n: p[2], la: +(+p[4]).toFixed(5), lo: +(+p[5]).toFixed(5) });
        const bb = s.querySelectorAll('.btns'), r0 = bb[bb.length - 1]; if (r0) r0.insertBefore(b, r0.firstChild); else s.appendChild(b); }
      const a = activo && G.g[activo.v] && !G.g[activo.v].borrado ? activo : null, bs = s.querySelectorAll('.btns'), bt = bs[bs.length - 1];
      if (a && bt && !bt.querySelector('.gv-b')) { const v = G.g[a.v], plan = ((v.dias = v.dias || {})[a.d] = v.dias[a.d] || []), ya = plan.some(x => x.id === p[0]);
        const b = document.createElement('button'); b.className = 'gv-b'; b.textContent = ya ? '🧭 En el día ' + (a.d + 1) + ' de «' + v.nombre + '»' : '🧭 Al día ' + (a.d + 1) + ' de «' + v.nombre + '»';
        b.onclick = () => { const k = plan.findIndex(x => x.id === p[0]); if (k >= 0) { plan.splice(k, 1); avisa('Quitado del día ' + (a.d + 1), 2000); } else { plan.push({ id: p[0], n: p[2], c: p[1], la: p[4], lo: p[5] }); const t = tramo(v, a.d); if (t.tipo === 't') ordena(plan, t); avisa('🧭 Añadido al día ' + (a.d + 1) + ' de «' + v.nombre + '»', 2500); if (volver && volver.id === p[0]) setTimeout(() => { if (volver && volver.id === p[0]) window.cierra(); }, 700); }
          guarda(v); b.textContent = (k >= 0 ? '🧭 Al día ' : '🧭 En el día ') + (a.d + 1) + ' de «' + v.nombre + '»'; if (enMapa === v.id) pintaMapa(v, a.d, false); };
        bt.insertBefore(b, bt.firstChild); } } } catch (e) {}
    return r; };

  { const c0 = window.cierra; if (typeof c0 === 'function') window.cierra = function () { const w = volver; volver = null; const r = c0.apply(this, arguments);
    if (w && G.g[w.v] && !G.g[w.v].borrado) { try { dia(w.v, w.d); sh().scrollTop = w.y || 0; } catch (e) {} } return r; }; }

  /* ---------- pestaña ---------- */
  function pintaPestana() { const nav = document.querySelector('#top .apps'); if (!nav) return;
    let a = document.getElementById('guia-tab'); if (!a) { a = document.createElement('a'); a.id = 'guia-tab'; a.title = 'Guía de viaje: prepara un viaje día a día'; a.onclick = lista; nav.appendChild(a); }
    const n = vivos().length; a.innerHTML = '<span class="ic">🧭</span><span class="tx">Guía</span>' + (n ? '<b>' + n + '</b>' : ''); }

  /* ---------- guardar con el código de historiatotal.es (Viajes; y App Mapas si Carlos escribe su código) ---------- */
  const codigo = () => { try { const v = window.localStorage.getItem(KCOD); return v ? v.replace(/^"|"$/g, '') : ''; } catch (e) { return ''; } };
  const SYNC = () => SYNC_HT || (!PUB && !!codigo());
  /* md5 (para calcular el id corto que usa Viajes: huella md5 del id largo, igual que hacer_version_publica.py) */
  const MD5S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], MD5K = []; for (let i = 0; i < 64; i++) MD5K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  function md5hex(str) {
    const b = new TextEncoder().encode(str), n = b.length, nb = ((n + 8) >> 6) + 1, w = new Int32Array(nb * 16);
    for (let i = 0; i < n; i++) w[i >> 2] |= b[i] << ((i % 4) * 8);
    w[n >> 2] |= 0x80 << ((n % 4) * 8); w[nb * 16 - 2] = n * 8;
    const S = MD5S, K = MD5K;
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (let o = 0; o < w.length; o += 16) { let A = a0, B = b0, C = c0, Dd = d0;
      for (let i = 0; i < 64; i++) { let F, g;
        if (i < 16) { F = (B & C) | (~B & Dd); g = i; } else if (i < 32) { F = (Dd & B) | (~Dd & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ Dd; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~Dd); g = (7 * i) % 16; }
        const s = S[(i >> 4) * 4 + (i % 4)], x = (A + F + K[i] + w[o + g]) | 0;
        A = Dd; Dd = C; C = B; B = (B + ((x << s) | (x >>> (32 - s)))) | 0; }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + Dd) | 0; }
    let h = ''; for (const v of [a0, b0, c0, d0]) for (let j = 0; j < 4; j++) h += ((v >>> (j * 8)) & 255).toString(16).padStart(2, '0');
    return h; }
  function corto(id, largo) { const h = md5hex(id), L = []; for (let i = 0; i < 32; i += 4) L.push(parseInt(h.slice(i, i + 4), 16));
    const A = '0123456789abcdefghijklmnopqrstuvwxyz'; let s = '';
    for (let k = 0; k < largo; k++) { let r = 0; for (let i = 0; i < 8; i++) { const c = r * 65536 + L[i]; L[i] = Math.floor(c / 36); r = c % 36; } s = A[r] + s; }
    return id.split(':')[0] + ':' + s; }
  let MAPA = null, INV = null;
  function mapa() { if (MAPA) return MAPA; const M = {}, n = {}, P = D.p.filter(p => p[1] !== 'm' && !/^r:(app|nueva)-/.test(p[0]));
    for (const p of P) { const k = corto(p[0], 7); M[p[0]] = k; n[k] = (n[k] || 0) + 1; } for (const p of P) if (n[M[p[0]]] > 1) M[p[0]] = corto(p[0], 10);
    INV = {}; for (const k in M) INV[M[k]] = k; return MAPA = M; }
  function convierte(g, f) { const o = {}; for (const [id, v] of Object.entries(g || {})) { if (!v || typeof v !== 'object') continue; const c = JSON.parse(JSON.stringify(v));
      if (c.dias) for (const k in c.dias) (c.dias[k] || []).forEach(x => { if (x && x.id) x.id = f(x.id); }); o[id] = c; } return o; }
  const aViajes = g => PUB ? g : convierte(g, id => mapa()[id] || id), deViajes = g => PUB ? g : (mapa(), convierte(g, id => INV[id] || id));
  let estado = '';
  function estadoTxt() { if (!PUB) { const c = codigo(); return c ? '🔗 Enlazada con Viajes (historiatotal.es) con tu código <b>' + esc(c) + '</b>: los viajes que hagas aquí o en Viajes se ven en los dos sitios y en tus otros aparatos. <a href="#" id="gv-des">Desenlazar</a>' + (estado ? '<br>' + estado : '')
      : 'Tus viajes se guardan en este aparato. Para verlos también en Viajes y en tus otros aparatos, escribe tu código de Viajes (sale abajo en la pestaña 🧭 Guía de Viajes):<div style="display:flex;gap:6px;margin-top:6px"><input id="gv-cod" maxlength="7" placeholder="ABC2345" style="width:90px;text-transform:uppercase;font:600 14px system-ui;padding:5px"><button id="gv-enl">🔗 Enlazar</button></div>' + (estado ? '<br>' + estado : ''); }
    if (!SYNC_HT) return 'Se guardan en este aparato y en este navegador.';
    const c = codigo(); return c ? 'Se guardan en este aparato y con tu código de historiatotal.es: <b>' + esc(c) + '</b>. Con él los verás en tus otros aparatos.' + (estado ? '<br>' + estado : '') : 'Se guardan en este aparato. Al crear tu primer viaje tendrás un código de historiatotal.es para verlos también en tus otros aparatos.'; }
  function junta(rem) { let pend = false, cambio = false;
    for (const [id, r] of Object.entries(rem || {})) { const l = G.g[id]; if (!r || typeof r !== 'object') continue; if (!l || (l.t || 0) < (r.t || 0)) { G.g[id] = r; cambio = true; } else if ((l.t || 0) > (r.t || 0)) pend = true; }
    for (const id of Object.keys(G.g)) if (!(rem || {})[id]) pend = true;
    if (cambio) { try { window.localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) {} pintaPestana(); }
    return pend; }
  async function lee() { const c = codigo(); if (!c) return null; const res = await fetch(API + '?codigo=' + encodeURIComponent(c), { cache: 'no-store' }); if (!res.ok) throw new Error('el servidor respondió ' + res.status);
    const d = await res.json(), g = d && d.guias; return { g: deViajes((g && typeof g === 'object' && !Array.isArray(g)) ? g : {}), c }; }
  let tSub = null, subiendo = false;
  function programaSubida() { if (!SYNC()) return; clearTimeout(tSub); tSub = setTimeout(sube, 2500); }
  async function sube() { if (subiendo) return programaSubida(); subiendo = true;
    try { if (!codigo()) { if (!PUB || !Object.keys(G.g).length || typeof window.cuadCreaCodigo !== 'function' || !window.cuadCreaCodigo()) return; }
      const R = await lee(); if (!R) return; junta(R.g);
      const cuerpo = JSON.stringify({ guias: aViajes(G.g) }); if (cuerpo.length > LIM) { estado = '⚠️ Tus viajes ocupan demasiado para guardarlos en el servidor: quedan solo en este aparato. Borra alguno que no uses.'; return; }
      const res = await fetch(API + '?codigo=' + encodeURIComponent(R.c), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });
      estado = res.ok ? '' : '⚠️ No se han podido guardar en el servidor (' + res.status + '); quedan en este aparato.';
    } catch (e) { estado = '⚠️ Sin conexión con el servidor: los viajes quedan en este aparato.'; } finally { subiendo = false; } }
  if (SYNC() && codigo()) setTimeout(async () => { try { const R = await lee(); if (R && junta(R.g)) programaSubida(); } catch (e) {} }, 1500);
  // App Mapas: enlazar / desenlazar con el código de Viajes (lo ve Carlos en la pestaña Guía de Viajes)
  function enganchaCodigo(s) { if (PUB) return; const i = s.querySelector('#gv-cod'), b = s.querySelector('#gv-enl'), d = s.querySelector('#gv-des');
    if (b) b.onclick = async () => { const c = (i.value || '').trim().toUpperCase(); if (!/^[A-HJ-NP-Z2-9]{7}$/.test(c)) return avisa('El código son 7 letras y números, como sale en Viajes.', 3500);
      try { window.localStorage.setItem(KCOD, c); } catch (e) { return; } b.disabled = true; b.textContent = 'Comprobando…';
      try { const R = await lee(); const n = Object.values(R.g).filter(v => !v.borrado).length; junta(R.g); estado = n ? '✅ Traídos ' + n + ' viaje' + (n > 1 ? 's' : '') + ' de Viajes.' : 'En Viajes aún no hay viajes con ese código.'; programaSubida(); }
      catch (e) { estado = '⚠️ No he podido hablar con historiatotal.es; lo intentaré al guardar.'; } lista(); };
    if (d) d.onclick = e => { e.preventDefault(); try { window.localStorage.removeItem(KCOD); } catch (x) {} estado = 'Desenlazada: los viajes siguen en este aparato y en Viajes, pero ya no se sincronizan.'; lista(); }; }

  /* ---------- estilos ---------- */
  const st = document.createElement('style');
  st.textContent = '#guia-tab b{background:#2563eb;color:#fff;border-radius:9px;font:700 11px system-ui;padding:1px 6px;margin-left:2px}'
    + '.gv-f{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 10px}.gv-f label{font:600 13px system-ui;color:var(--mu);display:flex;flex-direction:column;gap:3px;flex:1;min-width:105px}.gv-tl{align-self:flex-end;flex:0 0 auto;padding:8px 10px!important;font:600 13px system-ui!important;white-space:nowrap}.gv-f input{font:15px system-ui;padding:7px 8px;border:1px solid #c9ced4;border-radius:8px;color:#1d2125;background:#fff}'
    + '.gv-l{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--li)}.gv-l .e{font-size:19px;flex:0 0 26px;text-align:center}.gv-l .n{flex:1;cursor:pointer;font-size:14.5px}.gv-l .n b{display:block;font:600 12px system-ui;color:var(--mu)}.gv-l .n i{color:#2563eb;font-style:normal}'
    + '.gv-ig{border:1px solid #c9ced4;background:#fff;border-radius:8px;padding:5px 8px;font:600 12px system-ui;cursor:pointer;color:#1d2125}'
    + '.gv-h3{font:700 15px system-ui;margin:16px 0 4px}.gv-s{display:block;font:400 12.5px system-ui;color:var(--mu);margin-top:2px}.gv-s i{color:#b45309;font-style:normal}.cuad-c.gv-x{border-style:dashed}'
    + '.gv-t{margin:4px 0 2px;font-size:14.5px}.gv-q{width:100%;box-sizing:border-box;font:16px system-ui;padding:9px 10px;border:1px solid #c9ced4;border-radius:8px;margin:6px 0}'
    + '.gv-r{list-style:none;margin:0;padding:0}.gv-r li{padding:8px 4px;border-top:1px solid var(--li);cursor:pointer}.gv-r li b{display:block;font-size:14.5px}.gv-r li span{font-size:12.5px;color:var(--mu)}.gv-r li.tt{color:var(--mu);cursor:default;font-size:13px}'
    + '.gv-e{font:600 12.5px system-ui;color:var(--mu);display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:6px 0}.gv-e button{border:1px solid #c9ced4;background:#fff;border-radius:14px;padding:4px 9px;font:600 12.5px system-ui;cursor:pointer;color:#1d2125}.gv-e button.on{background:#2563eb;border-color:#2563eb;color:#fff}'
    + '.cuad-i .ic{font:700 11.5px system-ui}.cuad-i .ic.gv-n{background:#ea580c;font-size:13px}.cuad-i li.gv-vi .n{opacity:.5}'
    + '.gv-mas{flex:0 0 32px;height:32px;border:0;border-radius:50%;background:#2563eb;color:#fff;font:700 17px/1 system-ui;cursor:pointer}.gv-mas.ya{background:#16a34a}'
    + '.btns .gv-b{background:#2563eb}.gv-c{color:#b45309;font-size:12px}'
    + '.gv-a{border:1px solid #f0c98a;background:#fffaf0;border-radius:10px;padding:9px 11px;margin:8px 0}.gv-a b{display:block;font-size:14.5px}.gv-a span{display:block;font-size:13.5px;margin-top:3px}.gv-a span.m{color:var(--mu);font-size:12.5px}.gv-a a{color:#2563eb;font-weight:600}'
    + '.gv-ch{width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 0 0 2.5px #2563eb,0 1px 5px #0007;display:flex;align-items:center;justify-content:center;font-size:15px;position:relative}.gv-ch small{position:absolute;right:-6px;top:-7px;background:#2563eb;color:#fff;border-radius:9px;font:700 10.5px/15px system-ui;min-width:15px;text-align:center;padding:0 2px}'
    + '.gv-ch.p{background:#ea580c;color:#fff;font:800 13px system-ui;box-shadow:0 0 0 2.5px #fff,0 1px 5px #0007}';
  document.head.appendChild(st);
  pintaPestana(); setTimeout(cargaAct, 5000);
  window.guiaPanel = lista;
})();
