# Plan: la app de mapas como app turística

Escrito el 1 de noviembre de 2026. **Plan, no construcción.** Se retoma cuando esté cerrado el catálogo de Naturaleza.

---

## 1. La idea

Una sola app de viaje con cuatro capas: **Mis rutas, Naturaleza, Historia y Turismo**.

No se hace una app nueva. La base es la app de mapas (Mapas IGN offline), que ya tiene lo que le falta a una app turística. Las otras dos piezas, el catálogo de Naturaleza y los lugares de HistoKHB, entran como capas.

## 2. Qué hay hoy, medido

| Pieza | Qué tiene | Dónde vive |
|---|---|---|
| App de mapas (v81) | 692 rutas tuyas (11.432 km), mapas IGN sin cobertura, el tiempo, avisos de AEMET, planificar y editar rutas, objetivos para el Garmin, buscador sin cobertura y «¿Qué he hecho por aquí?» | `App Mapas`, web pública |
| Catálogo de Naturaleza | ~6.650 fichas: rutas, cascadas, miradores, parques…, con datos, texto y track en la mayoría | `Proyecto Mis Rutas` |
| Lugares de HistoKHB | 2.192 fichas de lugar en todo el mundo, cada una con texto, «qué ver allí», fuentes y enlace a la app de Historia | `Historia Universal/app/datos/lugares.json` |
| Turismo | Nada todavía | — |

## 3. Las capas

| Capa | Qué se ve en el mapa | Al tocar |
|---|---|---|
| Mis rutas | Lo que ya hay | Lo que ya hay |
| Naturaleza | Puntos y tracks del catálogo, con color por tipo | Ficha: km, subida, tiempo, dificultad, texto y botón «Pasar a Mis objetivos» (de ahí, GPX al Garmin) |
| Historia | Puntos de los lugares de HistoKHB | Resumen del lugar, «qué ver allí» y enlace a su ficha en HistoKHB |
| Turismo | Por definir | — |

Cada capa se enciende y se apaga, como ya pasa con los mapas.

## 4. La función estrella: «¿Qué hay por aquí?»

Es la ampliación del «¿Qué he hecho por aquí?». Desde donde estás, o desde el punto que toques, saca una sola lista con:

- tus rutas cercanas (lo que ya hace hoy, a 4 km);
- naturaleza cercana (rutas, cascadas, miradores…);
- historia cercana (lugares de HistoKHB);
- el tiempo de los próximos días en esa zona.

Es lo que se hizo a mano el 1-nov para Nuevo Baztán (catálogo + búsqueda + guía), pero hecho por la app sola.

Lo que ya existe y gana con las capas nuevas:

- **¿Dónde hace mejor tiempo?**: comparar también zonas del catálogo, no solo las tuyas.
- **Planificar**: ir a un punto del catálogo o de Historia.
- **Mis objetivos**: pasar una ruta del catálogo a objetivos de un toque, y de ahí al Garmin. Era una de las ideas originales del catálogo.
- **Buscador**: que encuentre también fichas de Naturaleza y lugares de Historia sin cobertura.

## 5. Cómo se cargan los datos

Igual que tus rutas: troceados en celdas por zonas, cargando solo lo que se ve. Así la app sigue siendo ligera en el móvil y funciona sin cobertura con lo ya bajado.

Ningún dato se mete a mano. Las capas se generan por programa desde el catálogo y desde `lugares.json`, y se regeneran cuando cambian.

## 6. LA DECISIÓN ABIERTA: los tracks de Wikiloc y Komoot

La app de mapas es una web pública. Tus rutas son tuyas y pueden estar. Pero el catálogo lleva tracks de Wikiloc y Komoot que se acordó **no publicar**.

| Opción | Qué supone |
|---|---|
| A. Publicar Naturaleza sin esos tracks | Se ven el punto y la ficha; el track, solo si es de fuente abierta (Terra Nostrum, webs oficiales, OSM…) |
| B. Esos tracks solo en tu móvil | Se cargan desde un fichero local y no pasan por la web. Hay que comprobar cómo encaja con el circuito actual entre dispositivos |

**Idea de Carlos (1-nov), pendiente de concretar:** hacerla **app personal en su propio hosting**, cerrada con contraseña. Resuelve esta decisión: así pueden ir todos los tracks. Antes hay que saber del hosting:

1. Si tiene HTTPS. Sin HTTPS, el móvil no deja usar el GPS ni el modo sin cobertura.
2. Cómo se protege con contraseña.
3. Cómo se sube: cambiar «Publicar Mapas.bat», que hoy sube a GitHub.
4. Si admite un pequeño programa en el servidor (PHP o similar) que sustituya al circuito actual entre el móvil y el ordenador, que hoy usa GitHub con un token.

HistoKHB sigue pública como está.

Orden general acordado: primero se terminan la app de Historia y la de Economía, y después se empieza con esto.

## 7. Orden

1. Cerrar el catálogo de Naturaleza, con la limpieza de las rayas rectas de los tracks con huecos.
2. Capa de Historia: la más fácil, porque los datos ya están limpios y con coordenadas.
3. Capa de Naturaleza y «¿Qué hay por aquí?».
4. Turismo, cuando se defina qué entra. La recomendación es empezar por muy poco (museos, pueblos con encanto, miradores) y dejar fuera los restaurantes, que cambian demasiado.

## 8. Riesgo a vigilar

Los proyectos mueren cuando piden una decisión por elemento. Regla para las capas nuevas: **solo fuentes que se carguen en bloque**. Nada que obligue a revisar ficha a ficha.
