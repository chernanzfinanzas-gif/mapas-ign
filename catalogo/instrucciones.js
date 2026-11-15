/* Pantalla de instrucciones de Viajes (15-nov-2026, pedido de Carlos).
   Solo sale en la versión pública (historiatotal.es/viajes), que es donde hacer_version_publica.py pone CUAD_PUBLICO.
   - Sale al entrar, una vez por visita (al volver de una ficha de Historia no se repite).
   - «Ya conozco cómo funciona, no mostrar más esto» se guarda en el aparato: localStorage 'hk_viajes_instr' = '1'.
   - Para verla siempre, en pruebas: añadir ?instrucciones a la dirección. */
(function(){
  var FORZADA = /[?&]instrucciones\b/.test(location.search);
  if (!window.CUAD_PUBLICO && !FORZADA) return;
  var CLAVE = 'hk_viajes_instr', VISTA = 'hk_viajes_instr_vista';
  function lee(a, k){ try { return a.getItem(k); } catch(e){ return null; } }
  function pon(a, k, v){ try { a.setItem(k, v); } catch(e){} }
  if (!FORZADA) {
    if (lee(localStorage, CLAVE) === '1') return;
    if (lee(sessionStorage, VISTA) === '1') return;
  }
  var css = '#vjins{position:fixed;inset:0;z-index:9000;background:rgba(30,25,20,.55);overflow:auto;-webkit-overflow-scrolling:touch;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2b2118}'
    + '#vjins .caja{position:relative;margin:18px auto;width:calc(100% - 28px);max-width:520px;background:#fffdf8;border-radius:18px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.3);box-sizing:border-box}'
    + '#vjins .cab{display:flex;align-items:center;gap:12px;margin-bottom:6px}'
    + '#vjins .cab img{width:62px;height:auto}'
    + '#vjins h2{margin:0;font-size:22px;line-height:1.2;color:#7c2d12}'
    + '#vjins .sub{margin:2px 0 0;font-size:14px;color:#6b5d50}'
    + '#vjins .p{margin:12px 0 0;padding-top:12px;border-top:1px solid #eadfcf}'
    + '#vjins .p h3{margin:0 0 3px;font-size:16px;color:#2b2118}'
    + '#vjins .p p{margin:0;font-size:14.5px;line-height:1.45}'
    + '#vjins .ir{display:block;width:100%;margin:16px 0 10px;padding:13px;border:0;border-radius:12px;background:#2f6b3a;color:#fff;font-size:17px;font-weight:700;cursor:pointer}'
    + '#vjins label{display:flex;gap:8px;align-items:center;font-size:14px;color:#5b4f44;cursor:pointer}'
    + '#vjins label input{width:18px;height:18px;flex:none}';
  var html = '<div class="caja" role="dialog" aria-modal="true" aria-labelledby="vjins-t">'
    + '<div class="cab"><img src="https://historiatotal.es/img/ammo/ammo-viajero.webp" alt="" onerror="this.remove()"><div><h2 id="vjins-t">Bienvenido a Viajes</h2><p class="sub">Así se usa, en un minuto</p></div></div>'
    + '<div class="p"><h3>🗺️ El mapa</h3><p>Muévete y acerca el mapa a la zona que te interesa: verás rutas por la naturaleza, yacimientos, castillos, iglesias, monumentos y miradores. Las capas de arriba eligen qué ver.</p></div>'
    + '<div class="p"><h3>📍 Cerca de ti</h3><p><b>Activa la ubicación</b> del móvil y da permiso a la página cuando te lo pida. Con <b>((•))</b> ves tu posición en el mapa y con <b>⌖</b> el mapa va a donde estás. «📍 Qué hay cerca» te da la lista de lo que tienes a menos de 25 km, empezando por lo más próximo.</p></div>'
    + '<div class="p"><h3>🔭 Explorar lejos</h3><p>El mapa <b>no vuelve solo a tu posición</b>: muévelo con libertad o usa 🔍 Buscar sitio o localidad. Los botones <b>10 · 25 · 50 km</b> encuadran lo que hay alrededor del centro de la pantalla. Y si llevas el mapa a otra zona, «📍 Qué hay cerca» te da lo que hay allí.</p></div>'
    + '<div class="p"><h3>📖 Su historia</h3><p>Toca cualquier sitio para ver su ficha, con el tiempo que hará allí. Con «📖 Su historia» o «📜 Qué pasó aquí» lees lo que ocurrió en ese lugar; al cerrar, vuelves al mapa.</p></div>'
    + '<div class="p"><h3>📓 Tus cuadernos de viaje</h3><p>En la ficha de un sitio, «📓 Al cuaderno» lo guarda en un cuaderno con el nombre que quieras («Asturias 2027», «Iglesias románicas»…). En la pestaña 📓 Cuadernos los abres en el mapa, los compartes por WhatsApp o correo y descargas un GPX para tu GPS.</p></div>'
    + '<div class="p"><h3>🔑 Tu código</h3><p>Los cuadernos se guardan con tu código de historiatotal.es: con él los verás en el móvil y en el ordenador. Anótalo, no lo compartas y no pongas nada privado.</p></div>'
    + '<button class="ir" type="button">Ir a Viajes</button>'
    + '<label><input type="checkbox"> Ya conozco cómo funciona, no mostrar más esto</label>'
    + '</div>';
  function abre(){
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'vjins'; d.innerHTML = html; document.body.appendChild(d);
    var chk = d.querySelector('input'), ir = d.querySelector('.ir');
    function cierra(){
      pon(sessionStorage, VISTA, '1');
      if (chk.checked) pon(localStorage, CLAVE, '1');
      d.remove(); st.remove();
    }
    ir.onclick = cierra;
    ir.focus({preventScroll:true});
  }
  if (document.body) abre(); else document.addEventListener('DOMContentLoaded', abre);
})();
