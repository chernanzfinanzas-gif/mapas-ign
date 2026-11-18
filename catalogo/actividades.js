/* ACTIVIDADES CON GUÍA (18-nov-2026, idea de Carlos) — catalogo/actividades.js
   Cosas que se hacen con una empresa o con el propio parque: visitas en todoterreno, astronomía, rutas guiadas…
   La Guía de viaje las enseña cuando un punto de salida («sal») queda a menos de 30 km de donde se duerme, y la ficha de un espacio
   natural cuando cae dentro de la zona «z» (centro y radio en km). NO se guardan precios ni horarios: cambian; se da la web.
   «rev» = cuándo se revisaron los datos. «fu» = de dónde salen.
   Piloto: Parque Nacional de Cabañeros. */
window.ACTIV = [
 { id: 'cabaneros-4x4', n: 'Visita guiada en todoterreno al Parque Nacional de Cabañeros', tp: '4x4',
   q: 'Recorrido en todoterreno con guía por el interior del parque, con un tramo a pie. Es la forma de entrar en la raña, la llanura abierta donde se ven los ciervos.',
   emp: 'Visita Cabañeros, concesionaria de las rutas en 4x4 dentro del parque', dur: 'unas 3 h', res: 'reserva previa obligatoria',
   sal: [{ n: 'Centro de visitantes de Horcajo de los Montes', la: 39.32398, lo: -4.62542 }, { n: 'Centro de visitantes Casa Palillos (posición aproximada)', la: 39.3101, lo: -4.3207 }],
   z: { la: 39.40, lo: -4.50, r: 30 }, web: 'https://www.visitacabaneros.es', tel: '926 77 53 84', rev: 'nov-2026',
   fu: ['https://www.visitacabaneros.es', 'https://soyecoturista.com/en/actividad/cabaneros-parque-nacional-visita-guiada-4x4-desde-horcajo-de-los-montes'] },
 { id: 'cabaneros-estrellas', n: 'Observación de estrellas en Cabañeros', tp: 'astronomia',
   q: 'Observación astronómica con guía, senderismo interpretativo al atardecer y observaciones solares.',
   emp: 'Las 7 Cabrillas Astroturismo Cabañeros', dur: '', res: 'con reserva',
   sal: [{ n: 'Alcoba', la: 39.26011, lo: -4.4769 }],
   z: { la: 39.40, lo: -4.50, r: 30 }, web: 'https://astroturismocabaneros.com', tel: '680 637 077', rev: 'nov-2026',
   fu: ['https://www.soyecoturista.com/asociacion/wp-content/uploads/2025/08/ESP_Catalogo_Operadores_Cabaneros.pdf'] },
 { id: 'cabaneros-aventuras', n: 'Rutas guiadas a pie, a caballo y en kayak por Cabañeros', tp: 'guiada',
   q: 'Senderismo interpretativo, observación de fauna y aves, berrea, rutas a caballo y kayak.',
   emp: 'Aventuras Cabañeros', dur: '', res: 'con reserva',
   sal: [{ n: 'El Robledo', la: 39.21762, lo: -4.28112 }],
   z: { la: 39.40, lo: -4.50, r: 30 }, web: 'https://www.aventurascabaneros.com', tel: '650 763 792', rev: 'nov-2026',
   fu: ['https://www.soyecoturista.com/asociacion/wp-content/uploads/2025/08/ESP_Catalogo_Operadores_Cabaneros.pdf'] }
];
