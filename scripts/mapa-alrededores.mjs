/* Datos de alrededores (spec 001 §3.4.1, tarea T15).
   Baja de OpenStreetMap (Overpass, con espejos y reintentos) la costa, el río
   Ulla, las carreteras AP-9, AP-53 y N-525 y la mancha de Santiago, y los
   simplifica a menos de 60 KB en datos/mapa-alrededores.json. Además deja en
   datos/alrededores.json los 11 sitios con sus coordenadas (nodo real de OSM)
   y sus minutos en coche desde la casa.

   Uso: node scripts/mapa-alrededores.mjs [--forzar]
   - Se puede repetir sin cambiar nada: si OSM no ha cambiado, los ficheros no se
     tocan (ni siquiera la fecha). Con --forzar se reescriben con la fecha de hoy.
   - No se llama nunca desde la web: la construcción solo lee los JSON.
   - Los minutos de los nueve sitios de hoy son los de la regla de la portada
     («según la casa» u «OSRM 2026-10-16»). Los de Ortigueira y Vedra salen de
     OSRM desde la casa, con su fecha. De los nueve, el script solo avisa si
     OSRM hoy da otra cosa; no los cambia.
   - `etiqueta` la escribe más tarde scripts/etiquetas-mapa.mjs (T16): aquí se
     conserva si ya existe.
   User-Agent genérico: sin nombres ni correos. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'datos');
const F_MAPA = path.join(DATOS, 'mapa-alrededores.json');
const F_SITIOS = path.join(DATOS, 'alrededores.json');
const FORZAR = process.argv.includes('--forzar');
const HOY = new Date().toISOString().slice(0, 10);
const UA = 'datos-mapa-osm/1.0 (script de datos abiertos)';
const LIMITE_BYTES = 60 * 1024;

/* Encuadre de los datos: de la ría de Arousa a Santiago y el Ulla. A Coruña
   queda fuera a propósito (en el mapa va al borde con una flecha). */
const CAJA = { s: 42.55, w: -8.95, n: 43.02, e: -8.15 };
const caja = `${CAJA.s},${CAJA.w},${CAJA.n},${CAJA.e}`;

/* Espejos de Overpass: overpass-api.de da 504 a menudo, por eso el primero es
   otro. Cada intento tiene su plazo y, si todos fallan, se espera y se repite. */
const ESPEJOS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(consulta) {
  for (let ronda = 0; ronda < 4; ronda++) {
    for (const url of ESPEJOS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(consulta),
          signal: AbortSignal.timeout(100000),
        });
        if (res.ok) {
          const j = await res.json();
          // Overpass contesta 200 con `remark` si se queda sin tiempo o memoria: datos a medias.
          if (!j.remark) return j;
          console.error(`  ${new URL(url).host}: ${String(j.remark).slice(0, 60)}`);
        } else console.error(`  ${new URL(url).host}: ${res.status}`);
      } catch (e) {
        console.error(`  ${new URL(url).host}: ${String(e.message).slice(0, 60)}`);
      }
    }
    await dormir(5000 * (ronda + 1));
  }
  throw new Error('Overpass no responde en ningún espejo');
}

/* ---------- Los 11 sitios y la casa: nodos o vías concretos de OSM ---------- */
const CASA = { nombre: 'Casa de Casal', osm: 'node/11111302205' };
const R16 = 'OSRM 2026-10-16';
const SITIOS = [
  { nombre: 'Pico Sacro', osm: 'node/7045311886', minutos: 7, fuente: R16, frase: 'a sus pies', slug: 'pico-sacro-v2' },
  { nombre: 'Ponte Ulla', osm: 'node/619004532', minutos: 7, fuente: R16, frase: 'el río Ulla', slug: null },
  { nombre: 'Pazo de Oca', osm: 'way/207458654', minutos: 12, fuente: R16, frase: 'el Versalles gallego', slug: 'pazo-de-oca-v2' },
  { nombre: 'Santiago', osm: 'node/998649870', minutos: 15, fuente: 'según la casa', frase: '', slug: null },
  { nombre: 'Aeropuerto', osm: 'way/71837861', minutos: 25, fuente: 'según la casa', frase: '', slug: null },
  { nombre: 'Fervenza do Toxa', osm: 'node/1004155228', minutos: 25, fuente: R16, frase: '30 m de caída', slug: 'fervenza-del-rio-toxa-v2' },
  { nombre: 'Carboeiro', osm: 'way/186002185', minutos: 27, fuente: R16, frase: 'monasterio románico', slug: 'monasterio-de-carboeiro-v2' },
  { nombre: 'Rianxo', osm: 'node/55527213', minutos: 46, fuente: R16, frase: 'la playa más cercana', slug: null },
  { nombre: 'A Coruña', osm: 'node/1235110932', minutos: 62, fuente: R16, frase: '', slug: null },
  { nombre: 'Pazo de Ortigueira', osm: 'way/371499288', minutos: null, fuente: null, frase: '', slug: 'pazo-de-ortigueira-v2' },
  { nombre: 'Ruta dos Muíños de Vedra', osm: 'way/148119313', minutos: null, fuente: null, frase: '', slug: 'ruta-molinos-vedra-v2' },
];

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const leerTexto = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n'); // en Windows git puede dejar CRLF
const leerJSON = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);

async function coordenadas() {
  const todos = [CASA, ...SITIOS];
  const ids = (tipo) => todos.filter((s) => s.osm.startsWith(tipo + '/')).map((s) => s.osm.split('/')[1]).join(',');
  const j = await overpass(`[out:json][timeout:60];(node(id:${ids('node')});way(id:${ids('way')}););out center tags;`);
  const por = new Map(j.elements.map((e) => [`${e.type}/${e.id}`, e]));
  for (const s of todos) {
    const e = por.get(s.osm);
    if (!e) throw new Error(`OSM no devuelve ${s.osm} (${s.nombre})`);
    const c = e.center || e;
    s.lat = r5(c.lat);
    s.lon = r5(c.lon);
  }
}

/* ---------- OSRM: minutos en coche desde la casa ---------- */
async function osrm(desde, hasta) {
  const rutas = [
    'https://router.project-osrm.org/route/v1/driving/',
    'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  ];
  for (let ronda = 0; ronda < 3; ronda++) {
    for (const base of rutas) {
      try {
        const res = await fetch(`${base}${desde.lon},${desde.lat};${hasta.lon},${hasta.lat}?overview=false`, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(30000),
        });
        const j = await res.json();
        if (j.code === 'Ok') return Math.round(j.routes[0].duration / 60);
      } catch { /* siguiente espejo */ }
    }
    await dormir(3000);
  }
  return null;
}

/* ---------- Geometría ---------- */
const M_LAT = 111320;
const M_LON = 111320 * Math.cos((42.85 * Math.PI) / 180);

/* Douglas-Peucker en metros (iterativo, sin recursión). */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  const xy = pts.map(([lon, lat]) => [lon * M_LON, lat * M_LAT]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let dmax = 0, im = -1;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let d;
      if (l2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > dmax) { dmax = d; im = i; }
    }
    if (dmax > tol && im > 0) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const redondear = (pts) => {
  const sal = [];
  for (const [lon, lat] of pts) {
    const p = [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4];
    const u = sal[sal.length - 1];
    if (!u || u[0] !== p[0] || u[1] !== p[1]) sal.push(p);
  }
  return sal;
};

/* Pasa una vía de Overpass (out geom) a { ids, pts:[[lon,lat]] }. */
const via = (w) => ({ ids: w.nodes, pts: w.geometry.map((g) => [g.lon, g.lat]) });

/* Une vías que comparten extremo (la costa llega partida en trozos). */
function unir(vias) {
  const resto = vias.slice().sort((a, b) => a.ids[0] - b.ids[0]);
  const salida = [];
  while (resto.length) {
    let c = resto.shift();
    let seguir = true;
    while (seguir) {
      seguir = false;
      for (let i = 0; i < resto.length; i++) {
        const o = resto[i];
        const cF = c.ids[c.ids.length - 1], cI = c.ids[0];
        if (cF === o.ids[0]) c = { ids: c.ids.concat(o.ids.slice(1)), pts: c.pts.concat(o.pts.slice(1)) };
        else if (cF === o.ids[o.ids.length - 1]) c = { ids: c.ids.concat(o.ids.slice(0, -1).reverse()), pts: c.pts.concat(o.pts.slice(0, -1).reverse()) };
        else if (cI === o.ids[o.ids.length - 1]) c = { ids: o.ids.concat(c.ids.slice(1)), pts: o.pts.concat(c.pts.slice(1)) };
        else if (cI === o.ids[0]) c = { ids: o.ids.slice().reverse().concat(c.ids.slice(1)), pts: o.pts.slice().reverse().concat(c.pts.slice(1)) };
        else continue;
        resto.splice(i, 1);
        seguir = true;
        break;
      }
    }
    salida.push(c);
  }
  return salida;
}

/* Recorta una línea a la caja (con un margen) y la parte donde sale. */
function recortar(pts, margen = 0.02) {
  const dentro = ([lon, lat]) => lon >= CAJA.w - margen && lon <= CAJA.e + margen && lat >= CAJA.s - margen && lat <= CAJA.n + margen;
  const tramos = [];
  let actual = [];
  for (const p of pts) {
    if (dentro(p)) actual.push(p);
    else { if (actual.length > 1) tramos.push(actual); actual = []; }
  }
  if (actual.length > 1) tramos.push(actual);
  return tramos;
}

const largoM = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot((p[0] - pts[i - 1][0]) * M_LON, (p[1] - pts[i - 1][1]) * M_LAT) : 0), 0);
const areaM2 = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * M_LON * pts[i + 1][1] * M_LAT - pts[i + 1][0] * M_LON * pts[i][1] * M_LAT;
  return Math.abs(a) / 2;
};

/* ---------- Capas ---------- */
async function bajarCapas() {
  console.log('Costa…');
  const costa = await overpass(`[out:json][timeout:90];way["natural"="coastline"](${caja});out geom;`);
  console.log('Río Ulla…');
  const ulla = await overpass(`[out:json][timeout:60];way["waterway"="river"]["name"~"^(Río |Rio )?Ulla$"](${caja});out geom;`);
  console.log('Carreteras…');
  const carr = await overpass(`[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary)$"]["ref"~"(^|;)(AP-9|AP-53|N-525)(;|$)"](${caja});out geom;`);
  console.log('Santiago…');
  const scq = await overpass(`[out:json][timeout:60];way["landuse"~"^(residential|commercial|retail|industrial)$"](42.84,-8.60,42.93,-8.49);out geom;`);
  return { costa, ulla, carr, scq };
}

/* Construye las capas con una tolerancia (en metros) multiplicada por `k`. */
function construirCapas(crudo, k) {
  const capa = (vias, tol) => unir(vias.map(via)).flatMap((v) => recortar(v.pts)).map((t) => redondear(simplificar(t, tol * k))).filter((t) => t.length > 1);
  const ordenar = (l) => l.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1]);
  const solo = (j) => j.elements.filter((e) => e.type === 'way' && e.geometry);
  const costa = ordenar(capa(solo(crudo.costa), 70).filter((t) => largoM(t) > 400));
  const ulla = ordenar(capa(solo(crudo.ulla), 40));
  const refDe = (w) => ['AP-9', 'AP-53', 'N-525'].find((r) => (w.tags.ref || '').split(';').includes(r));
  const carreteras = {};
  for (const r of ['AP-9', 'AP-53', 'N-525']) carreteras[r] = ordenar(capa(solo(crudo.carr).filter((w) => refDe(w) === r), 35));
  const anillos = solo(crudo.scq)
    .filter((w) => w.geometry.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1])
    .map(via)
    .filter((v) => areaM2(v.pts) > 20000)
    .sort((a, b) => a.ids[0] - b.ids[0])
    .map((v) => redondear(simplificar(v.pts, 30 * k)))
    .filter((t) => t.length > 3);
  return { costa, ulla, carreteras, santiago: ordenar(anillos) };
}

/* JSON compacto: una línea por trazo, para que pese poco y se lea el resto. */
function serializar(d) {
  const lin = (t) => '[' + t.map((p) => `[${p[0]},${p[1]}]`).join(',') + ']';
  const lista = (ts, sang) => '[\n' + ts.map((t) => sang + ' ' + lin(t)).join(',\n') + '\n' + sang + ']';
  const cr = Object.entries(d.carreteras).map(([r, ts]) => `  ${JSON.stringify(r)}: ${lista(ts, '  ')}`).join(',\n');
  return `{
 "fuente": ${JSON.stringify(d.fuente)},
 "fecha": ${JSON.stringify(d.fecha)},
 "caja": ${JSON.stringify(d.caja)},
 "costa": ${lista(d.costa, ' ')},
 "ulla": ${lista(d.ulla, ' ')},
 "carreteras": {
${cr}
 },
 "santiago": ${lista(d.santiago, ' ')}
}
`;
}

async function mapa() {
  const crudo = await bajarCapas();
  let k = 1, capas, texto;
  const previo = leerJSON(F_MAPA);
  for (;;) {
    capas = construirCapas(crudo, k);
    texto = serializar({ fuente: '© colaboradores de OpenStreetMap (ODbL)', fecha: HOY, caja: CAJA, ...capas });
    if (Buffer.byteLength(texto) < LIMITE_BYTES * 0.92 || k > 8) break;
    k *= 1.3;
  }
  if (Buffer.byteLength(texto) >= LIMITE_BYTES) throw new Error('mapa-alrededores.json pasa de 60 KB');
  if (previo && !FORZAR) {
    const sinFecha = (t) => t.replace(/"fecha": "[^"]*"/, '"fecha": ""');
    if (sinFecha(leerTexto(F_MAPA)) === sinFecha(texto)) {
      console.log('mapa-alrededores.json: sin cambios en OSM (no se toca).');
      return;
    }
  }
  fs.writeFileSync(F_MAPA, texto);
  console.log(`mapa-alrededores.json: ${(Buffer.byteLength(texto) / 1024).toFixed(1)} KB (tolerancia ×${k.toFixed(2)}), ${capas.costa.length} trazos de costa, ${capas.ulla.length} del Ulla, ${Object.values(capas.carreteras).flat().length} de carreteras, ${capas.santiago.length} manchas.`);
}

async function sitios() {
  await coordenadas();
  const previo = leerJSON(F_SITIOS);
  const antes = new Map((previo?.sitios || []).map((s) => [s.nombre, s]));
  const lista = [];
  for (const s of SITIOS) {
    const ant = antes.get(s.nombre);
    let { minutos, fuente } = s;
    const reutiliza = minutos === null && ant && ant.lat === s.lat && ant.lon === s.lon && ant.minutos != null && !FORZAR;
    const calc = reutiliza ? null : await osrm(CASA, s);
    if (minutos === null) {
      // Ortigueira y Vedra: OSRM desde la casa. Si ya estaban con las mismas
      // coordenadas, se respetan sus minutos y su fecha (así no cambia nada).
      if (reutiliza) { minutos = ant.minutos; fuente = ant.fuente; }
      else if (calc != null) { minutos = calc; fuente = `OSRM ${HOY}`; }
      else throw new Error(`OSRM no responde para ${s.nombre}`);
    } else if (calc != null && Math.abs(calc - minutos) > 3) {
      console.log(`  AVISO: ${s.nombre}: la regla dice ${minutos} min y OSRM da hoy ${calc} (no se cambia).`);
    }
    const sitio = { nombre: s.nombre, lat: s.lat, lon: s.lon, minutos, fuente, frase: s.frase, slug: s.slug, osm: s.osm };
    if (ant?.etiqueta) sitio.etiqueta = ant.etiqueta;
    lista.push(sitio);
  }
  const casa = { nombre: CASA.nombre, lat: CASA.lat, lon: CASA.lon, osm: CASA.osm };
  if (previo?.casa?.etiqueta) casa.etiqueta = previo.casa.etiqueta;   // la de la casa también (T16)
  const datos = { casa, sitios: lista };
  const texto = JSON.stringify(datos, null, 2) + '\n';
  if (fs.existsSync(F_SITIOS) && leerTexto(F_SITIOS) === texto) {
    console.log('alrededores.json: sin cambios (no se toca).');
    return;
  }
  fs.writeFileSync(F_SITIOS, texto);
  console.log(`alrededores.json: ${lista.length} sitios.`);
  for (const s of lista) console.log(`  ${s.nombre.padEnd(26)} ${String(s.minutos).padStart(3)} min  ${s.fuente}  (${s.lat}, ${s.lon})`);
}

fs.mkdirSync(DATOS, { recursive: true });
await sitios();
await mapa();
