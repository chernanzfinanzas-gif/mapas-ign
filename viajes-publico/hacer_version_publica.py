# -*- coding: utf-8 -*-
"""
VERSIÓN PÚBLICA del catálogo para historiatotal.es/viajes/  (14-nov-2026)

La monta el proceso automático «Publicar Viajes» de GitHub cada día, a partir
del catálogo que Carlos publica en su app de mapas (repositorio mapas-ign).
También se puede lanzar a mano:

    python hacer_version_publica.py --origen <carpeta con catalogo.html, catalogo/ y sync/> --salida <carpeta>

Qué hace (nada de esto toca el catálogo de origen):
  - Quita «Mis rutas» de Carlos (puntos, fichas, trazados, perfiles, menciones),
    sus fotos, la edición, el token, su ritmo y los enlaces a sus otras apps.
  - Deja DENTRO de los datos sus correcciones de posición y sus estrellas
    (sync/), para que la página no dependa de GitHub al verse.
  - Acorta los identificadores internos (no se ven) para adelgazar el índice.
  - Por defecto NO publica los trazados marcados «privado» (Wikiloc/Komoot,
    solo uso personal): la ficha sí sale. --con-privados los incluye.
  - Pone cabecera de historiatotal.es con «← Historia».
  - Escribe .htaccess (comprimir, si el servidor lo permite) y huellas.json.
"""
import os, sys, re, json, glob, shutil, hashlib, argparse

ap = argparse.ArgumentParser()
ap.add_argument('--origen', required=True)
ap.add_argument('--salida', required=True)
ap.add_argument('--con-privados', action='store_true')
A = ap.parse_args()
SRC, OUT = A.origen, A.salida
CAT = os.path.join(SRC, 'catalogo')
MIA = lambda i: isinstance(i, str) and (i.startswith('r:app-') or i.startswith('r:nueva-'))
NOTA_MIA = re.compile(r'Posición marcada por Carlos en el mapa del catálogo \([^)]*\)\.?')
zona = lambda la, lo: '%d_%d' % (int((la * 2) // 1), int((lo * 2) // 1))

def lee_js(fn):
    s = open(fn, encoding='utf-8').read()
    i, j = s.index('{'), s.rindex('}') + 1
    return s[:i], json.loads(s[i:j]), s[j:]

def escribe(fn, texto):
    os.makedirs(os.path.dirname(fn) or '.', exist_ok=True)
    with open(fn, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)

def js(d):
    return json.dumps(d, ensure_ascii=False, separators=(',', ':'))

def lee_sync(nombre):
    fn = os.path.join(SRC, 'sync', nombre)
    try:
        return (json.load(open(fn, encoding='utf-8')) or {}).get('c') or {}
    except Exception:
        return {}

# ── 1. Índice de puntos ─────────────────────────────────────────────────────
preP, D, postP = lee_js(os.path.join(CAT, 'puntos.js'))
n0 = len(D['p'])
D['p'] = [p for p in D['p'] if p[1] != 'm' and not MIA(p[0])]
ZP = {p[0]: zona(p[4], p[5]) for p in D['p']}        # zona de su fichero de datos (posición ORIGINAL)

COR, EST = lee_sync('correcciones-catalogo.json'), lee_sync('estrellas-catalogo.json')
movidos = {}                                         # id -> zona nueva, si la corrección le cambia de zona
n_cor = n_est = 0
for p in D['p']:
    if p[1] in ('r', 'm'):
        continue
    k = COR.get(p[0])
    if k and not k.get('borrado') and k.get('lat') is not None:
        p[4], p[5] = round(float(k['lat']), 6), round(float(k['lon']), 6); n_cor += 1
        z2 = zona(p[4], p[5])
        if z2 != ZP[p[0]]:
            movidos[p[0]] = z2
    e = EST.get(p[0])
    if e and not e.get('borrado') and e.get('e'):
        while len(p) < 9: p.append(None)
        p[8] = int(e['e']); n_est += 1

# trazados privados (Wikiloc/Komoot): fuera, salvo --con-privados
PRIV = set()
if not A.con_privados:
    for fn in glob.glob(os.path.join(CAT, 'f', '*.js')):
        _, d, _ = lee_js(fn)
        PRIV.update(k for k, f in d.items() if f.get('privado') and not MIA(k))

# identificadores cortos y FIJOS: «t:iglesia-de-…-navacerrada» → «t:3kx9q0a».
# Salen de una huella del id completo, así que un sitio conserva siempre el mismo aunque
# entren o salgan otros (lo necesitan los cuadernos de viaje y cualquier enlace guardado).
# 7 caracteres: con ~54.000 sitios la probabilidad de que dos coincidan es ~2 %; si pasa,
# esos dos llevan 10 caracteres (también fijos).
def b36(n, largo):
    s = ''
    for _ in range(largo):
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
    return s
def corto(i, largo):
    h = int(hashlib.md5(i.encode('utf-8')).hexdigest(), 16)
    return i.split(':', 1)[0] + ':' + b36(h, largo)
NUEVO = {p[0]: corto(p[0], 7) for p in D['p']}
from collections import Counter
_rep = {v for v, n in Counter(NUEVO.values()).items() if n > 1}
for k in [k for k, v in NUEVO.items() if v in _rep]:
    NUEVO[k] = corto(k, 10)
assert len(set(NUEVO.values())) == len(NUEVO), 'identificadores cortos repetidos'
HIST = {NUEVO[p[0]]: p[0][2:] for p in D['p'] if p[1] == 'h'}   # el enlace «Su historia» usaba el id

def remapea(x):
    """Cambia los ids viejos por los cortos en cualquier sitio; quita referencias a rutas de Carlos."""
    if isinstance(x, str):
        return NUEVO.get(x, x)
    if isinstance(x, list):
        out = []
        for v in x:
            if MIA(v) or (isinstance(v, list) and v and MIA(v[0])):
                continue
            out.append(remapea(v))
        return out
    if isinstance(x, dict):
        return {NUEVO.get(k, k): remapea(v) for k, v in x.items() if not MIA(k)}
    return x

D['tb'] = {NUEVO[k]: v for k, v in D['tb'].items() if k in NUEVO and k not in PRIV}
D['am'] = []
D['pb'] = remapea(D.get('pb', {}))
D['pbi'] = [NUEVO[i] for i in D.get('pbi', []) if i in NUEVO]
hi = {NUEVO[k]: v for k, v in (D.get('hi') or {}).items() if k in NUEVO}
hi.update(HIST); D['hi'] = hi
for p in D['p']:
    p[0] = NUEVO[p[0]]
escribe(os.path.join(OUT, 'catalogo', 'puntos.js'), preP + js(D) + postP)

# ── 2. Fichas, trazados y perfiles por zonas ────────────────────────────────
extra = {}                                            # fichas que hay que copiar a la zona nueva
n_textos = 0
for tipo in ('f', 't', 'e'):
    for fn in sorted(glob.glob(os.path.join(CAT, tipo, '*.js'))):
        pre, d, post = lee_js(fn)
        d = {k: v for k, v in d.items() if not MIA(k) and k in NUEVO and not (tipo != 'f' and k in PRIV)}
        if tipo == 'f':
            for k, f in d.items():
                if 'rp' in f:
                    f['rp'] = [i for i in f['rp'] if not MIA(i)]
                    if not f['rp']: del f['rp']
                if k in PRIV:
                    f.pop('pp', None); f.pop('pu', None)
                for campo in ('resumen', 'visita', 'posicion_nota'):
                    v = f.get(campo)
                    if isinstance(v, str) and 'Carlos' in v:
                        v2 = re.sub(r'\s*Carlos ha hecho este recorrido\.?', '', v)
                        v2 = NOTA_MIA.sub('Posición marcada a mano sobre el mapa.', v2)
                        v2 = v2.replace('que señaló Carlos', 'marcada a mano').replace(' por Carlos', '')
                        if v2 != v: f[campo] = v2; n_textos += 1
                if k in movidos:
                    extra.setdefault(movidos[k], {})[k] = f
        d = remapea(d)
        z = os.path.basename(fn)[:-3]
        dest = os.path.join(OUT, 'catalogo', tipo, z + '.js')
        if tipo == 'f':
            d.update(remapea(extra.pop(z, {})))
        escribe(dest, pre + js(d) + post)
# zonas nuevas que solo existen por una corrección
for z, d in extra.items():
    escribe(os.path.join(OUT, 'catalogo', 'f', z + '.js'), "zonaCargada('f','%s'," % z + js(remapea(d)) + ');')

for fn in ('patrimonio.js', 'utiles.js'):
    s = open(os.path.join(CAT, fn), encoding='utf-8').read()
    assert 'r:app-' not in s, fn + ' trae rutas de Carlos'
    escribe(os.path.join(OUT, 'catalogo', fn), s)

# ── 3. La página ────────────────────────────────────────────────────────────
h = open(os.path.join(SRC, 'catalogo.html'), encoding='utf-8').read()

def cambia(viejo, nuevo, regex=False):
    global h
    if regex:
        h2, n = re.subn(viejo, nuevo, h, flags=re.S)
    else:
        n = h.count(viejo); h2 = h.replace(viejo, nuevo)
    assert n >= 1, 'No encuentro en catalogo.html: ' + viejo[:90]
    h = h2

cambia(r'<div role="navigation" class="apps".*?Fotos</span></a></div>',
       '<div role="navigation" class="apps" aria-label="Historia Total"><a href="../" title="Volver a Historia Total"><span class="ic">&#8592;</span><span class="tx">Historia</span></a>'
       '<a class="aqui" aria-current="page" title="Viajes"><span class="ic">&#129406;</span><span class="tx">Viajes</span></a></div>', regex=True)
cambia(r'<title>.*?</title>', '<title>Viajes · Historia Total: qué ver y qué hacer</title>', regex=True)
cambia('<script src="catalogo/puntos.js"></script>\n<script>',
       '<script src="catalogo/puntos.js"></script>\n<script>\n'
       '/* VERSIÓN PÚBLICA (historiatotal.es/viajes): lo que guarda en el navegador lleva su propio prefijo */\n'
       'const LSX = {getItem:k=>{try{return window.localStorage.getItem("viajes."+k);}catch(e){return null;}},'
       ' setItem:(k,v)=>{try{window.localStorage.setItem("viajes."+k,v);}catch(e){}},'
       ' removeItem:k=>{try{window.localStorage.removeItem("viajes."+k);}catch(e){}}};')
h = h.replace('window.localStorage', '\0WLS').replace('localStorage.', 'LSX.').replace('\0WLS', 'window.localStorage')
cambia('</style>', '#cor,#editar,.estbt{display:none!important}\n</style>')
cambia("setTimeout(()=>{ const e=document.createElement('button'); e.id='editar';",
       "if(0)setTimeout(()=>{ const e=document.createElement('button'); e.id='editar';")
cambia("""if (ap) h += '<div class="btns" style="margin-top:4px"><button onclick="fijaGPS(""",
       """if (0) h += '<div class="btns" style="margin-top:4px"><button onclick="fijaGPS(""")
cambia("""if (PC) h += '<div class="estbt">""", """if (0) h += '<div class="estbt">""")
cambia("(mia?' · <b>puesta por ti</b>':'')", "''")
cambia('function botonCor(){', 'function botonCor(){ return; ')
cambia('function tokenGh(){', "function tokenGh(){ return ''; ")
cambia('async function leeRemoto(){', 'async function leeRemoto(){ return {c:{}}; ')
cambia('async function leeEst(){', 'async function leeEst(){ return {c:{}}; ')
cambia('function sube(){', 'function sube(){ return Promise.resolve(false); ')
cambia('function subeEst(){', 'function subeEst(){ return; ')
cambia("for (const k of ['m','r','n','h','t','o','u']){", "for (const k of ['r','n','h','t','o','u']){")
cambia("{ const b=document.createElement('button'); b.className='chip off'; b.innerHTML='📷",
       "if(0){ const b=document.createElement('button'); b.className='chip off'; b.innerHTML='📷")
cambia('\nrutasNuevasDeLaApp();', '\n/* pública: sin rutas de la colección personal */')
cambia("fetch('rutas/ritmo.json')", 'Promise.resolve({ok:false})')
cambia("const hk = c==='h' ? id.slice(2) : (D.hi||{})[id];", "const hk = (D.hi||{})[id];")
# «📖 Su historia» y «📜 Qué pasó aquí» en la MISMA pestaña: así la app de Historia ve (por la página de
# origen) que se viene de Viajes y, al cerrar la ficha, vuelve aquí. Nada de noreferrer. (14-nov, chat de Historia)
cambia('<a class="sec" target="_blank" rel="noopener" style="border:1.5px solid #7c2d12;',
       '<a class="sec" style="border:1.5px solid #7c2d12;')
cambia('<a class="sec" target="_blank" rel="noopener" style="background:#7c2d12;',
       '<a class="sec" style="background:#7c2d12;')
cambia('creator="Mapas Carlos"', 'creator="historiatotal.es/viajes"')
cambia(r'versión (\d+-nov [a-zñ]+)', r'viajes · versión \1', regex=True)
# el aviso de los tracks privados ya no aplica en lo público (no llevan trazado)
if not A.con_privados:
    cambia("if (f.privado) h += '<div class=\"aviso\">🔒 Track de Wikiloc/Komoot: solo uso personal.</div>';",
           "if (f.privado) h += '<div class=\"aviso\">Trazado no disponible aquí: consulta la ruta en su fuente original.</div>';")
escribe(os.path.join(OUT, 'index.html'), h)

# ── 4. Servidor: comprimir si se puede, y caché corta para el índice ───────
escribe(os.path.join(OUT, '.htaccess'),
"""# Viajes (historiatotal.es): pide al servidor comprimir. Si el módulo no está, no hace nada.
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/json
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(js|html)$">
    Header set Cache-Control "max-age=3600"
  </FilesMatch>
</IfModule>
""")

# ── 5. Comprobaciones: nada personal ni roto ────────────────────────────────
todo = {}
for fn in glob.glob(os.path.join(OUT, '**', '*'), recursive=True):
    if os.path.isfile(fn):
        todo[os.path.relpath(fn, OUT).replace(os.sep, '/')] = open(fn, 'rb').read()
for rel, b in todo.items():
    if not rel.startswith('catalogo/'): continue
    s = b.decode('utf-8')
    for malo in ('r:app-', 'tu_tiempo_horas', 'colección personal de Carlos', 'marcada por Carlos',
                 'Carlos ha hecho', 'señaló Carlos'):
        assert malo not in s, 'queda «%s» en %s' % (malo, rel)
assert len(D['p']) > 40000, 'muy pocos puntos (%d): algo ha ido mal, no se publica' % len(D['p'])
for malo in ('href="fotos/"', "fetch('rutas/ritmo.json')", 'index.html#', 'noreferrer'):
    assert malo not in h, 'queda «%s» en la página' % malo

huellas = {rel: hashlib.md5(b).hexdigest() for rel, b in sorted(todo.items())}
escribe(os.path.join(OUT, 'huellas.json'), json.dumps(huellas, indent=0))

tam = sum(len(b) for b in todo.values())
print('VERSIÓN PÚBLICA montada en', OUT)
print('  puntos: %d -> %d   (fuera las rutas de Carlos)' % (n0, len(D['p'])))
print('  correcciones de posición metidas: %d (cambian de zona: %d) · estrellas: %d' % (n_cor, len(movidos), n_est))
print('  trazados privados fuera: %d' % len(PRIV))
print('  textos personales limpiados: %d' % n_textos)
print('  índice: %.1f MB · total %.1f MB en %d ficheros' % (len(todo['catalogo/puntos.js']) / 1048576, tam / 1048576, len(todo)))
