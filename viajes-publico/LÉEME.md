# Viajes — la versión PÚBLICA del catálogo en historiatotal.es/viajes/

**Regla (decisión de Carlos, 14-nov-2026): TODO lo que afecte a la versión pública del catálogo
—qué datos pasan, cómo se ve, cómo funciona— se decide y se hace desde el proyecto del catálogo
de la App Mapas («Puntos naturales de España»), y se publica con «Publicar Mapas».**
El chat de la app de Historia no toca esta página. Solo es dueño del menú de historiatotal.es
y del proceso diario de subida, que no hay que tocar más.

## Cómo funciona

1. Carlos trabaja en su catálogo (`catalogo.html` + `catalogo/`) y lo publica con «Publicar Mapas»,
   como siempre. Esta carpeta (`viajes-publico/`) se publica con él.
2. Cada día a las 05:17 (hora de Madrid en invierno), el proceso «Publicar Viajes» del repositorio
   `histokhb` baja del repositorio `mapas-ign` el catálogo, `sync/` y esta carpeta. Monta la versión
   pública con `hacer_version_publica.py` y sube a `historiatotal.es/viajes/` solo lo que ha cambiado.
   Ahí sí borra lo que ya no está.
3. Si el montaje falla, el proceso se para sin tocar la web, que se queda como estaba.

**Consecuencia:** cualquier cambio de formato o funcionamiento en `catalogo.html` llega solo a
historiatotal.es al día siguiente. Si algo de la versión pública tiene que ser distinto de la app
personal, se cambia en `hacer_version_publica.py` (esta carpeta), nunca en la web de Historia.

## Qué hace hacer_version_publica.py

- Quita: «Mis rutas» de Carlos, menciones, fechas y tiempos suyos, textos tipo «Carlos ha hecho este
  recorrido», «Mis fotos», edición, token, su ritmo, y los enlaces a la App Mapas y la App Fotos.
- Mete dentro de los datos sus correcciones de posición y sus estrellas (`sync/`).
- Acorta los identificadores internos para adelgazar el índice (7,2 → 4,7 MB; 1,3 MB comprimido).
- Por defecto no publica los 514 trazados de Wikiloc/Komoot (uso personal): sale su ficha.
  `--con-privados` los incluye. Pendiente de la definición de datos con Carlos.
- Cabecera: «← Historia» (vuelve a la portada de historiatotal.es) y «Viajes».
- Escribe `.htaccess` (compresión: comprobado que funciona) y `huellas.json`.
- Comprobaciones: si queda algo personal o salen muy pocos puntos, se para.
- Se apoya en textos concretos de `catalogo.html` para quitar lo personal. **Si se cambia `catalogo.html`
  en esas partes** (cabecera, botón de editar, botones de fijar posición o estrellas, sincronización,
  capa de fotos, Mis rutas, ritmo), hay que ajustar aquí el cambio correspondiente. Si no, el
  programa se para y Viajes deja de actualizarse. Probar con:
  `python hacer_version_publica.py --origen "<App Mapas>" --salida "<carpeta de prueba>"`

## Lo que vive en el lado de Historia (no se toca desde aquí)

- La pestaña «🥾 Viajes» del menú de historiatotal.es.
- El proceso diario `.github/workflows/publicar-viajes.yml` en el repositorio `histokhb`.
- **Comportamiento añadido por Carlos en la app de Historia (14-nov):** cuando desde Viajes se abre
  una ficha de Historia («📖 Su historia») y se cierra, se vuelve a Viajes, no a la portada de
  historiatotal.es. Historia lo detecta por la página de origen (referrer = historiatotal.es/viajes/).
  Por eso, SOLO en la versión pública, este programa:
  - abre «📖 Su historia» y «📜 Qué pasó aquí» en la MISMA pestaña (sin `target="_blank"`);
  - nunca pone `rel="noreferrer"`, que borraría el origen (el programa se para si aparece).
  Los enlaces siguen siendo `https://historiatotal.es/#/l/<id>` y `#/aqui/…`, sin parámetros.
  En la App Mapas normal siguen abriéndose en pestaña nueva, como quiere Carlos.

## Comprobado el 14-nov-2026 en la web real

Carga los 54.114 sitios, el índice llega comprimido, sin errores y sin cortes por «demasiadas peticiones»
recorriendo Guadarrama, Picos de Europa y el Pirineo de Huesca. «Su historia» lleva bien a las fichas
y el GPX se descarga.
