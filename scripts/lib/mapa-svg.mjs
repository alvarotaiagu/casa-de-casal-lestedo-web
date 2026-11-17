/* Mapa de alrededores en SVG (spec 001 §3.4.1, plan PD-5, tarea T16).
   A partir de datos/mapa-alrededores.json (costa, Ulla, carreteras y la mancha
   de Santiago) y datos/alrededores.json (la casa y los 11 sitios) dibuja, en la
   construcción, dos <svg> que se alternan con CSS:
     - «ancho» (pantallas de 700 px o más): de la ría de Arousa a Carboeiro;
     - «estrecho» (menos de 700 px): encuadre más cerrado y letra más grande.
   Cada marca lleva su nombre y sus minutos; la casa, el tejado dorado. Si el
   sitio tiene página ya construida (estaConstruida), la marca es un enlace
   <a href="{{raiz}}slug/">. Lo que cae fuera del encuadre (A Coruña) va al
   borde con una flecha y su distancia. Sin nada de fuera: ni teselas, ni
   fuentes, ni imágenes.
   La posición de cada etiqueta NO se mide aquí: la mide una vez
   scripts/etiquetas-mapa.mjs y la guarda en alrededores.json como
     etiqueta: { ancho: {lado, dx, dy}, estrecho: {lado, dx, dy} }
   (lado: e, o, n, s, ne, no, se, so; dx y dy en unidades del viewBox).
   Directiva en las fuentes: <!--mapa:ancho|estrecho|grande-->
     - ancho, estrecho: qué disposiciones van (sin ninguna de las dos, van las
       dos alternadas con CSS; con una sola, se ve siempre esa);
     - grande: la figura ocupa todo el ancho de la página (/entorno/).
   Ejemplos: <!--mapa--> o <!--mapa:ancho|estrecho--> (portada),
   <!--mapa:grande--> (/entorno/).
   Con los mismos datos (T17): <!--alrededores:lista--> pinta la lista
   accesible de debajo del mapa, y la página que lleva la regla de minutos
   (id="regla") recibe <script type="application/json" id="datos-alrededores">,
   que lee comun.js (PD-7, PD-8). */
import fs from 'node:fs';
import path from 'node:path';
import { estaConstruida, leerMapa } from './mapa-url.mjs';

/* ---------- disposiciones ---------- */
// caja: encuadre en grados; ancho: unidades del viewBox; letra: cuerpo de las
// etiquetas en unidades del viewBox (el SVG escala entero con el ancho).
export const DISPOSICIONES = {
  ancho: { caja: { w: -8.88, e: -8.17, s: 42.6, n: 42.96 }, ancho: 800, letra: 14, partir: 99 },
  estrecho: { caja: { w: -8.6, e: -8.21, s: 42.655, n: 42.965 }, ancho: 360, letra: 15, partir: 18 },
};
export const LADOS = ['e', 'o', 'ne', 'se', 'no', 'so', 'n', 's'];
const DIR = { e: [1, 0], o: [-1, 0], n: [0, -1], s: [0, 1], ne: [0.7, -0.7], no: [-0.7, -0.7], se: [0.7, 0.7], so: [-0.7, 0.7] };
const ANCLA = { e: 'start', ne: 'start', se: 'start', o: 'end', no: 'end', so: 'end', n: 'middle', s: 'middle' };
const BORDE = 18;          // las marcas de fuera, a esta distancia del borde
const PIE = '© colaboradores de OpenStreetMap';

const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Proyección equirrectangular con el coseno de la latitud media del encuadre. */
export function proyeccion(nombre) {
  const d = DISPOSICIONES[nombre];
  if (!d) throw new Error(`mapa: disposición desconocida «${nombre}»`);
  const { w, e, s, n } = d.caja;
  const cos = Math.cos(((s + n) / 2) * Math.PI / 180);
  const k = d.ancho / ((e - w) * cos);
  const alto = Math.round((n - s) * k);
  return { ...d, nombre, alto, xy: (lon, lat) => [(lon - w) * k * cos, (n - lat) * k] };
}

/* Distancia en línea recta, en km. */
function km(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/* Parte un nombre largo en dos líneas por el espacio más cercano a la mitad. */
function partir(nombre, max) {
  if (nombre.length <= max || !nombre.includes(' ')) return [nombre];
  let mejor = -1;
  for (let i = 0; i < nombre.length; i++) if (nombre[i] === ' ' && (mejor < 0 || Math.abs(i - nombre.length / 2) < Math.abs(mejor - nombre.length / 2))) mejor = i;
  return [nombre.slice(0, mejor), nombre.slice(mejor + 1)];
}

/* ---------- las marcas ---------- */
/* Devuelve la casa y los sitios en unidades del viewBox:
   { id, nombre, x, y, r, casa, borde: {angulo}|null, lineas: [{texto, clase}], slug, minutos }.
   id: «casa» o el índice del sitio (0-10), el mismo en las dos disposiciones. */
export function marcas(sitios, nombre) {
  const p = proyeccion(nombre);
  const L = p.letra;
  const [cx, cy] = p.xy(sitios.casa.lon, sitios.casa.lat);
  const lista = [{ id: 'casa', nombre: sitios.casa.nombre, x: cx, y: cy, r: L * 0.62, casa: true, borde: null, slug: null, etiqueta: sitios.casa.etiqueta,
    lineas: [{ texto: sitios.casa.nombre, clase: 'casa' }] }];
  sitios.sitios.forEach((s, i) => {
    let [x, y] = p.xy(s.lon, s.lat);
    let borde = null;
    const min = BORDE;
    if (x < 0 || x > p.ancho || y < 0 || y > p.alto) {
      // fuera: al borde, por la recta que va de la casa al sitio
      const dx = x - cx, dy = y - cy;
      let t = 1;
      if (dx) t = Math.min(t, ((dx > 0 ? p.ancho - min : min) - cx) / dx);
      if (dy) t = Math.min(t, ((dy > 0 ? p.alto - min : min) - cy) / dy);
      x = cx + dx * t; y = cy + dy * t;
      borde = { angulo: Math.atan2(dy, dx), km: Math.round(km(sitios.casa, s)) };
    }
    const lineas = partir(s.nombre, p.partir).map((texto) => ({ texto, clase: 'nombre' }));
    lineas.push({ texto: borde ? `${s.minutos} min · ${borde.km} km` : `${s.minutos} min`, clase: 'min' });
    lista.push({ id: String(i), nombre: s.nombre, x, y, r: L * 0.3, casa: false, borde, slug: s.slug, minutos: s.minutos, etiqueta: s.etiqueta, lineas });
  });
  return lista;
}

/* Dónde va la etiqueta de una marca con {lado, dx, dy}: punto de anclaje del
   texto (ax, ay de la primera línea base), text-anchor, paso entre líneas y,
   si se ha separado de la marca, la línea guía. Lo usan la construcción y
   etiquetas-mapa.mjs (el mismo cálculo en los dos sitios). */
export function colocar(m, et, nombre) {
  const L = DISPOSICIONES[nombre].letra;
  const lado = et && DIR[et.lado] ? et.lado : 'e';
  const dx = (et && +et.dx) || 0, dy = (et && +et.dy) || 0;
  const lh = L * 1.18, n = m.lineas.length;
  const g = m.r + L * 0.25;
  const arriba = 0.74 * L, abajo = (n - 1) * lh + 0.24 * L;   // de la primera línea base al alto y al bajo del bloque
  const [ux, uy] = DIR[lado];
  let ax = m.x + (ux === 0 ? 0 : Math.sign(ux) * (Math.abs(ux) < 1 ? 0.7 * g : g));
  let ay;
  if (uy === 0) ay = m.y - (abajo - arriba) / 2;
  else if (uy < 0) ay = m.y - (Math.abs(uy) < 1 ? 0.7 * g : g) - abajo;
  else ay = m.y + (Math.abs(uy) < 1 ? 0.7 * g : g) + arriba;
  ax += dx; ay += dy;
  // guía: de la marca al lado del bloque que la mira
  let guia = null;
  if (Math.hypot(dx, dy) >= 4) {
    const tx = ax, ty = uy === 0 ? ay + (abajo - arriba) / 2 : uy < 0 ? ay + abajo : ay - arriba;
    const d = Math.hypot(tx - m.x, ty - m.y);
    if (d > m.r + 2) guia = [m.x + ((tx - m.x) / d) * (m.r + 1.5), m.y + ((ty - m.y) / d) * (m.r + 1.5), tx, ty];
  }
  return { lado, dx, dy, ax, ay, lh, ancla: ANCLA[lado], guia };
}

/* ---------- la base ---------- */
function ruta(puntos, cerrar) {
  if (puntos.length < 2) return '';
  return 'M' + puntos.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + (cerrar ? 'Z' : '');
}

/* Proyecta, quita lo que cae lejos del encuadre y los puntos a menos de
   `paso` unidades del anterior. Una línea que sale y vuelve se parte. */
function trazos(lineas, p, paso = 1.6) {
  const fuera = 30;
  const dentro = ([x, y]) => x > -fuera && x < p.ancho + fuera && y > -fuera && y < p.alto + fuera;
  const res = [];
  for (const t of lineas) {
    const pts = t.map(([lon, lat]) => p.xy(lon, lat));
    let actual = [];
    pts.forEach((q, i) => {
      const util = dentro(q) || (i > 0 && dentro(pts[i - 1])) || (i < pts.length - 1 && dentro(pts[i + 1]));
      if (!util) { if (actual.length > 1) res.push(actual); actual = []; return; }
      const u = actual[actual.length - 1];
      if (!u || Math.hypot(q[0] - u[0], q[1] - u[1]) >= paso || i === pts.length - 1) actual.push(q);
    });
    if (actual.length > 1) res.push(actual);
  }
  return res;
}

/* Polígonos: fuera los que no tocan el encuadre; los demás, pegados al borde
   (con los puntos tan juntos, lo de dentro no cambia y pesan mucho menos). */
function poligonos(anillos, p, paso = 1.6) {
  const res = [];
  const m = 3;
  const pegar = ([x, y]) => [Math.min(Math.max(x, -m), p.ancho + m), Math.min(Math.max(y, -m), p.alto + m)];
  for (const a of anillos) {
    const crudos = a.map(([lon, lat]) => p.xy(lon, lat));
    const xs = crudos.map((q) => q[0]), ys = crudos.map((q) => q[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > p.ancho || Math.max(...ys) < 0 || Math.min(...ys) > p.alto) continue;
    const pts = crudos.map(pegar);
    const q = [pts[0]];
    for (const r of pts.slice(1)) if (Math.hypot(r[0] - q[q.length - 1][0], r[1] - q[q.length - 1][1]) >= paso) q.push(r);
    if (q.length > 2) res.push(q);
  }
  return res;
}

/* El mar: cada trozo de costa abierto que empieza y acaba en el borde de la caja
   de los datos se cierra por el borde dejando el agua a la derecha (en OSM la
   tierra queda a la izquierda de la costa). Los anillos cerrados son islas. */
function mar(costa, caja) {
  const tol = 0.012;
  const { w, e, s, n } = caja;
  const t = ([lon, lat]) => {
    const d = [Math.abs(lat - n), Math.abs(lon - e), Math.abs(lat - s), Math.abs(lon - w)];
    const i = d.indexOf(Math.min(...d));
    if (d[i] > tol) return null;
    return [(lon - w) / (e - w), 1 + (n - lat) / (n - s), 2 + (e - lon) / (e - w), 3 + (lat - s) / (n - s)][i];
  };
  const esquinas = [[w, n], [e, n], [e, s], [w, s]];   // en t = 0 (4), 1, 2, 3
  const agua = [], islas = [];
  for (const c of costa) {
    const a = c[0], b = c[c.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) { islas.push(c); continue; }
    const ta = t(a), tb = t(b);
    if (ta === null || tb === null) {
      // sin cerrar: se dibuja la línea de costa, pero sin el agua de ese trozo
      console.warn(`aviso: mapa: un trozo de costa (${c.length} puntos) no acaba en el borde de los datos; su agua no se pinta`);
      continue;
    }
    // del final al principio, en el sentido de las agujas del reloj
    const fin = ta > tb ? ta : ta + 4;
    const pol = [...c];
    for (let k = Math.ceil(tb + 1e-9); k < fin; k++) pol.push(esquinas[k % 4]);
    agua.push(pol);
  }
  return { agua, islas };
}

function base(datosMapa, p) {
  const { agua, islas } = mar(datosMapa.costa, datosMapa.caja);
  const capa = (cls, d) => (d ? `<path class="alr-mapa__${cls}" d="${d}"/>` : '');
  const unir = (lista, cerrar) => lista.map((q) => ruta(q, cerrar)).join('');
  const costaAbierta = datosMapa.costa;
  return '<g aria-hidden="true">'
    + `<rect class="alr-mapa__tierra" width="${p.ancho}" height="${p.alto}"/>`
    + capa('agua', unir(poligonos(agua, p), true))
    + capa('isla', unir(poligonos(islas, p), true))
    + capa('costa', unir(trazos(costaAbierta, p)))
    + capa('santiago', unir(poligonos(datosMapa.santiago, p), true))
    + capa('rio', unir(trazos(datosMapa.ulla, p)))
    + capa('nacional', unir(trazos(datosMapa.carreteras['N-525'] || [], p)))
    + capa('autopista', unir(trazos([...(datosMapa.carreteras['AP-9'] || []), ...(datosMapa.carreteras['AP-53'] || [])], p)))
    + '</g>';
}

/* ---------- marcas y etiquetas ---------- */
function dibujoMarca(m) {
  const x = r1(m.x), y = r1(m.y);
  if (m.casa) {
    // la casa: el tejado dorado a dos aguas sobre el muro
    const s = m.r;
    return `<path class="alr-mapa__muro" d="M${r1(x - s * 0.72)} ${r1(y - s * 0.1)}h${r1(s * 1.44)}v${r1(s * 0.95)}h${r1(-s * 1.44)}Z"/>`
      + `<path class="alr-mapa__tejado" d="M${r1(x - s)} ${r1(y + s * 0.05)}L${x} ${r1(y - s)}L${r1(x + s)} ${r1(y + s * 0.05)}Z"/>`;
  }
  if (m.borde) {
    // flecha hacia fuera del encuadre
    const a = m.borde.angulo, L = m.r * 3.2;
    const pt = (d, g) => `${r1(x + Math.cos(a + g) * d)} ${r1(y + Math.sin(a + g) * d)}`;
    return `<path class="alr-mapa__flecha" d="M${pt(L * 0.55, 0)}L${pt(L * 0.5, 2.5)}L${pt(L * 0.1, Math.PI)}L${pt(L * 0.5, -2.5)}Z"/>`;
  }
  return `<circle class="alr-mapa__punto" cx="${x}" cy="${y}" r="${r1(m.r)}"/>`;
}

export function textoEtiqueta(m, c, nombre, extra = '') {
  const L = DISPOSICIONES[nombre].letra;
  const tspans = m.lineas.map((l, i) => `<tspan class="alr-mapa__${l.clase}" x="${r1(c.ax)}" y="${r1(c.ay + i * c.lh)}">${esc(l.texto)}</tspan>`).join('');
  return `<text class="alr-mapa__etq" font-size="${L}" text-anchor="${c.ancla}"${extra}>${tspans}</text>`;
}

function marcaSVG(m, nombre, href) {
  const c = colocar(m, m.etiqueta && m.etiqueta[nombre], nombre);
  const guia = c.guia ? `<path class="alr-mapa__guia" d="M${r1(c.guia[0])} ${r1(c.guia[1])}L${r1(c.guia[2])} ${r1(c.guia[3])}"/>` : '';
  const cuerpo = guia + dibujoMarca(m) + textoEtiqueta(m, c, nombre);
  const cls = `alr-mapa__marca${m.casa ? ' alr-mapa__marca--casa' : ''}${m.borde ? ' alr-mapa__marca--borde' : ''}`;
  if (href) {
    const etq = m.lineas.filter((l) => l.clase === 'nombre').map((l) => l.texto).join(' ') + ', ' + m.lineas[m.lineas.length - 1].texto;
    return `<a class="${cls}" href="${href}" aria-label="${esc(etq)}" data-marca="${m.id}">${cuerpo}</a>`;
  }
  return `<g class="${cls}" data-marca="${m.id}">${cuerpo}</g>`;
}

/* Un <svg> de una disposición. `enlace(slug)` devuelve el href o null. */
export function svgMapa(nombre, datosMapa, sitios, enlace = () => null) {
  const p = proyeccion(nombre);
  const ms = marcas(sitios, nombre);
  // la casa, encima de todo
  const orden = [...ms.slice(1), ms[0]];
  return `<svg class="alr-mapa__svg alr-mapa__svg--${nombre}" viewBox="0 0 ${p.ancho} ${p.alto}" width="${p.ancho}" height="${p.alto}" role="group" aria-label="Mapa de alrededores: minutos en coche desde la casa" data-disposicion="${nombre}">`
    + base(datosMapa, p)
    + orden.map((m) => marcaSVG(m, nombre, m.slug ? enlace(m.slug) : null)).join('')
    + '</svg>';
}

/* La figura con las disposiciones pedidas y el pie de OpenStreetMap. */
export function figuraMapa(modos, datosMapa, sitios, enlace) {
  const lista = modos.filter((x) => x === 'ancho' || x === 'estrecho');
  const disp = lista.length ? lista : ['ancho', 'estrecho'];
  const cls = ['alr-mapa'];
  if (modos.includes('grande')) cls.push('alr-mapa--grande');
  if (disp.length === 1) cls.push('alr-mapa--solo');
  return `<figure class="${cls.join(' ')}">`
    + disp.map((d) => svgMapa(d, datosMapa, sitios, enlace)).join('')
    + `<figcaption class="alr-mapa__pie">${esc(PIE)}</figcaption>`
    + '</figure>';
}

/* ---------- la directiva ---------- */
const RE_MAPA = /<!--mapa(?::([a-z|]*))?\s*-->/g;
const MODOS = new Set(['ancho', 'estrecho', 'grande']);

export function leerDatos(raiz) {
  const leer = (f) => JSON.parse(fs.readFileSync(path.join(raiz, 'datos', f), 'utf8'));
  return { datosMapa: leer('mapa-alrededores.json'), sitios: leer('alrededores.json') };
}

/* El enlace de un sitio: a su página si ya está construida (§3.2); si no, null
   y el sitio se queda como texto (ningún enlace da 404, CA-19). */
const enlazador = (raiz, mapaUrl) => {
  const mapa = mapaUrl || leerMapa(raiz);
  return (slug) => (estaConstruida(`/${slug}/`, raiz, mapa) ? `{{raiz}}${slug}/` : null);
};

/* Sustituye las directivas <!--mapa:…--> del HTML. `raiz`: la carpeta del
   repo que se construye (para estaConstruida); `mapaUrl`: el de mapa-url.json.
   Los datos se leen solo si hay alguna directiva. */
export function ponerMapas(html, raiz, mapaUrl, src = '') {
  if (!html.includes('<!--mapa')) return html;
  let datos = null;
  return html.replace(RE_MAPA, (m, arg) => {
    const modos = (arg || '').split('|').filter(Boolean);
    const malos = modos.filter((x) => !MODOS.has(x));
    if (malos.length) throw new Error(`${src}: <!--mapa:${arg}--> lleva modos desconocidos (${malos.join(', ')}); valen ancho, estrecho y grande`);
    if (!datos) datos = leerDatos(raiz);
    return figuraMapa(modos, datos.datosMapa, datos.sitios, enlazador(raiz, mapaUrl));
  });
}

/* ---------- la lista accesible y la regla (T17, spec §3.4.11 y §3.5) ---------- */
/* La lista de debajo del mapa: un sitio por línea, de más cerca a más lejos,
   con su nombre (enlace si tiene página construida), sus minutos y su frase.
   Va en el HTML, así que se lee igual sin JavaScript. */
export function listaAlrededores(sitios, enlace = () => null) {
  const orden = sitios.sitios.map((s, i) => ({ s, i })).sort((a, b) => a.s.minutos - b.s.minutos || a.i - b.i);
  return '<ul class="alr-lista">'
    + orden.map(({ s }) => {
      const href = s.slug ? enlace(s.slug) : null;
      const nombre = href ? `<a class="enlace" href="${href}">${esc(s.nombre)}</a>` : `<b>${esc(s.nombre)}</b>`;
      return `<li>${nombre}<span>${s.minutos} min${s.frase ? ' · ' + esc(s.frase) : ''}</span></li>`;
    }).join('')
    + '</ul>';
}

/* Los sitios para la regla de comun.js (PD-7, PD-8): solo lo que pinta. */
export function etiquetaDatosAlrededores(sitios) {
  const json = JSON.stringify({ sitios: sitios.sitios.map(({ nombre, minutos }) => ({ nombre, minutos })) });
  return `<script type="application/json" id="datos-alrededores">${json.replace(/</g, '\\u003c')}</script>`;
}

/* <!--alrededores:lista--> → la lista; y si la página lleva la regla
   (id="regla"), el <script id="datos-alrededores"> en el <head>. */
export function ponerAlrededores(html, raiz, mapaUrl) {
  const conLista = html.includes('<!--alrededores:lista-->');
  const conRegla = /\bid="regla"/.test(html);
  if (!conLista && !conRegla) return html;
  const { sitios } = leerDatos(raiz);
  if (conLista) html = html.replace(/<!--alrededores:lista-->/g, () => listaAlrededores(sitios, enlazador(raiz, mapaUrl)));
  if (conRegla) {
    const tag = etiquetaDatosAlrededores(sitios) + '\n';
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => tag + '</head>') : html.replace(/<body\b[^>]*>\n?/i, (m) => m + tag);
  }
  return html;
}
