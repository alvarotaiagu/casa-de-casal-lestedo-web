/* Lo que se quita, apuntado (spec 002 §3.8, PD-7, CA-18).
   Parte el texto de su página de WordPress (pages.json) en frases normalizadas
   y busca cada una en el texto visible de la página construida (<main>, sin
   <script> ni atributos). Cada frase que falta tiene que tener su línea en
   specs/002-paginas-interiores/origen.md, con un motivo válido.

   Uso:
     node scripts/diff-origen.mjs <slug> [--fuente <otro-slug>]… [--escribir] [--ref <pages.json>]
     node scripts/diff-origen.mjs --todas [--escribir] [--ref <pages.json>]
   - <slug>: la página de pages.json contra el <main> de <slug>/index.html. Si
     <slug> es un 301 en datos/mapa-url.json, se compara con su destino.
   - --fuente <otro-slug>: añade las frases de otra página de pages.json a la
     misma sección (se puede repetir).
   - --todas: las 23 secciones de §3.8; error si falta alguna.
   - --escribir: añade al final de la sección las frases que faltan, con motivo
     «?» (crea la sección si no está) y no toca las demás líneas. Un «?» sigue
     siendo error: hay que rellenarlo a mano.
   - --ref <ruta>: dónde está pages.json (por defecto, el de
     ../casa-de-casal-lestedo-bocetos/ref/ desde la raíz del repo).
   Sale con 1 si hay algo que arreglar. Si falta pages.json, el slug no está en
   pages.json o la página no está construida, sale con error sin escribir nada.
   Sin dependencias: el HTML se limpia con expresiones regulares, como
   scripts/cadenas.mjs. También se usa desde scripts/pruebas-diff-origen.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF_POR_DEFECTO = path.join(RAIZ_REPO, '..', 'casa-de-casal-lestedo-bocetos', 'ref', 'pages.json');
const ORIGEN = path.join(RAIZ_REPO, 'specs', '002-paginas-interiores', 'origen.md');
const MIN_PALABRAS = 4;

/* Las 23 secciones de §3.8: las 17 páginas nuevas de §3.1, las tres de acogida
   y las tres que pasan a 301. */
export const SECCIONES = [
  'casa-pequena-do-casal', 'desayunos-artesanos', 'manjares-gallegos', 'tus-rincones-favoritos',
  'piscina-de-agua-salada', 'viajar-con-ninos', 'servicios', 'que-necesitas', 'experiencias',
  'nuestro-camino', 'contactar',
  'via-de-la-plata-v2', 'ruta-molinos-vedra-v2', 'fervenza-del-rio-toxa-v2', 'pazo-de-oca-v2',
  'pazo-de-ortigueira-v2', 'monasterio-de-carboeiro-v2',
  'tu-habitacion', 'pico-sacro-v2', 'entorno',
  'un-detalle-para-sorprender', 'monumentos-naturales-y-leyendas', 'descarga-nuestras-guias',
];

/* Motivos válidos de §3.8. Pueden llevar detalle detrás («P-26: ya no trabaja»). */
const MOTIVO_VALIDO = /^(?:(?:franja|botón|repetida|errata|corrección §3\.4|regla de dueños|enlace caído)(?![\p{L}\p{N}])|[PD]-\d+(?!\d)|301 → \S+)/iu;

/* ---------- limpiar y normalizar ---------- */
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', shy: '', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', iquest: '¿', iexcl: '¡', ordm: 'º', ordf: 'ª', deg: '°', euro: '€', middot: '·', bull: '•', copy: '©', reg: '®', times: '×', sbquo: '‚', bdquo: '„' };
const LETRAS_ACENTUADAS = /^([aeiouAEIOU])(acute|grave|uml|circ)$|^([nN])tilde$|^([cC])cedil$/;
function entidad(m, nombre) {
  if (nombre[0] === '#') {
    const n = nombre[1] === 'x' || nombre[1] === 'X' ? parseInt(nombre.slice(2), 16) : parseInt(nombre.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  }
  if (nombre in ENTIDADES) return ENTIDADES[nombre];
  const a = nombre.match(LETRAS_ACENTUADAS);
  if (a) {
    const marca = { acute: '́', grave: '̀', uml: '̈', circ: '̂' }[a[2]] || (a[3] ? '̃' : '̧');
    return (a[1] || a[3] || a[4]).concat(marca).normalize('NFC');
  }
  return m;
}
const decodificar = (s) => s.replace(/&(#?[A-Za-z0-9]+);/g, entidad);

/* Etiquetas que cortan el texto (bloques y saltos): se cambian por un salto de
   línea; el resto (a, em, strong, span…) desaparece sin dejar hueco. */
const ETIQUETA = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const BLOQUE = new Set(['p', 'li', 'ul', 'ol', 'br', 'hr', 'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'button', 'form', 'label', 'option', 'select']);

/* HTML → texto con un salto de línea entre bloques. */
export function textoDeHtml(html) {
  const limpio = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, '\n')
    .replace(ETIQUETA, (m, nombre) => (BLOQUE.has(nombre.toLowerCase()) ? '\n' : ''));
  return decodificar(limpio);
}

/* Minúsculas, sin signos, espacios simples. Las letras y los números se quedan. */
export function normalizar(texto) {
  return String(texto)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/* Frases de un HTML de WordPress: por «.», «?», «!», «:» (no entre dos cifras:
   1.05, 10:30) y fin de bloque; sin repetir; las de menos de 4 palabras no cuentan. */
export function frases(html) {
  const vistas = new Set();
  const out = [];
  for (const trozo of textoDeHtml(html).split(/[?!\n]+|(?<!\d)[.:]+|[.:]+(?!\d)/)) {
    const f = normalizar(trozo);
    if (!f || f.split(' ').length < MIN_PALABRAS || vistas.has(f)) continue;
    vistas.add(f);
    out.push(f);
  }
  return out;
}

/* Texto normalizado del <main> de una página construida (sin <script>). */
export function textoDeMain(html) {
  const m = String(html).match(/<main(?=[\s>/])[^>]*>([\s\S]*)<\/main\s*>/i);
  return normalizar(textoDeHtml(m ? m[1] : ''));
}

/* ---------- origen.md ---------- */
const FRASE_APUNTADA = /^\s*[-*]\s*«(.*?)»\s*·\s*(.*?)\s*$/;

/* Secciones de origen.md: { slug → { ini, fin, lineas: [{ frase, motivo, n }] } }
   con ini = línea del «## slug» y fin = línea tras la última no vacía. */
export function leerOrigen(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const secciones = {};
  let actual = null;
  lineas.forEach((l, n) => {
    const h = l.match(/^##\s+(\S+)\s*$/);
    if (h) {
      actual = { ini: n, fin: n + 1, lineas: [] };
      secciones[h[1]] = actual;
      return;
    }
    if (/^#{1,2}\s/.test(l)) { actual = null; return; }
    if (!actual) return;
    if (l.trim()) actual.fin = n + 1;
    const f = l.match(FRASE_APUNTADA);
    if (f) actual.lineas.push({ frase: normalizar(f[1]), motivo: f[2], n: n + 1 });
  });
  return { lineas, secciones };
}

/* ---------- el trabajo de una sección ---------- */
function slugValido(s) {
  return typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s);
}

/* Qué página construida se compara con <slug>: la suya o, si es un 301, su
   destino (datos/mapa-url.json). Devuelve la ruta relativa, p. ej.
   'servicios/index.html'. */
function paginaDe(slug, mapa, raiz) {
  const e = mapa.find((x) => x.ruta === '/' + slug + '/' && x.accion === '301');
  const partes = e && typeof e.destino === 'string' ? e.destino.replace(/[#?].*$/, '').split('/').filter(Boolean) : [slug];
  if (partes.length === 0) return 'index.html';
  if (partes.some((p) => p === '..' || p === '.' || p.includes('.') && !/\.html$/.test(p))) return null;
  return /\.html$/.test(partes[partes.length - 1]) ? path.join(...partes) : path.join(...partes, 'index.html');
}

/* Calcula, sin escribir nada, el estado de cada sección pedida.
   Devuelve { errores: [mensaje], secciones: [{ slug, total, faltan: [frase],
   sinLinea: [frase], porRellenar: [línea], invalidos: [línea], sobran: [línea],
   falta: bool }] } o { fatal: mensaje }. */
export function comparar({ slugs, fuentes = {}, ref = REF_POR_DEFECTO, raiz = RAIZ_REPO, origen, exigirSeccion = false }) {
  if (!fs.existsSync(ref)) return { fatal: `no encuentro pages.json en ${ref} (usa --ref <ruta>)` };
  let paginas;
  try { paginas = JSON.parse(fs.readFileSync(ref, 'utf8').replace(/^﻿/, '')); } catch (e) { return { fatal: `pages.json no es JSON válido: ${e.message}` }; }
  if (!Array.isArray(paginas)) return { fatal: 'pages.json no es una lista de páginas' };
  const porSlug = new Map(paginas.map((p) => [p && p.slug, p]));
  const htmlDe = (p) => (p && p.content && typeof p.content === 'object' ? p.content.rendered : p && p.content) || '';

  let mapa = [];
  const rutaMapa = path.join(raiz, 'datos', 'mapa-url.json');
  if (fs.existsSync(rutaMapa)) {
    try { mapa = JSON.parse(fs.readFileSync(rutaMapa, 'utf8')); } catch (e) { return { fatal: `datos/mapa-url.json no es JSON válido: ${e.message}` }; }
    if (!Array.isArray(mapa)) return { fatal: 'datos/mapa-url.json no es una lista' };
  }

  const sec = leerOrigen(origen).secciones;
  const secciones = [];
  for (const slug of slugs) {
    if (!slugValido(slug)) return { fatal: `slug no válido: «${slug}»` };
    const fuenteSlugs = [slug, ...(fuentes[slug] || [])];
    const frasesOrigen = [];
    for (const f of fuenteSlugs) {
      if (!slugValido(f)) return { fatal: `slug no válido: «${f}»` };
      if (!porSlug.has(f)) return { fatal: `el slug «${f}» no está en pages.json` };
      for (const fr of frases(htmlDe(porSlug.get(f)))) if (!frasesOrigen.includes(fr)) frasesOrigen.push(fr);
    }
    const rel = paginaDe(slug, mapa, raiz);
    const fichero = rel && path.join(raiz, rel);
    if (!fichero || !fs.existsSync(fichero)) return { fatal: `la página de «${slug}» no está construida (${rel || 'ruta no válida'}): ejecuta antes node construir.mjs` };
    const main = textoDeMain(fs.readFileSync(fichero, 'utf8'));

    const faltan = frasesOrigen.filter((f) => !main.includes(f));
    const seccion = sec[slug];
    const apuntadas = new Set((seccion ? seccion.lineas : []).map((l) => l.frase));
    const sinLinea = faltan.filter((f) => !apuntadas.has(f));
    const lineas = seccion ? seccion.lineas : [];
    const porRellenar = lineas.filter((l) => /^\?/.test(l.motivo) || !l.motivo);
    const invalidos = lineas.filter((l) => l.motivo && !/^\?/.test(l.motivo) && !MOTIVO_VALIDO.test(l.motivo));
    // líneas que ya no hacen falta: la frase está en la página o no está en el origen
    const sobran = lineas.filter((l) => main.includes(l.frase) || !frasesOrigen.includes(l.frase));
    secciones.push({ slug, total: frasesOrigen.length, faltan, sinLinea, porRellenar, invalidos, sobran, falta: exigirSeccion && !seccion, pagina: rel });
  }
  return { secciones };
}

/* Añade al final de cada sección las frases que faltan, con «?». No toca las
   demás líneas. Devuelve el texto nuevo. */
export function escribirFaltan(texto, secciones) {
  const eol = /\r\n/.test(texto) ? '\r\n' : '\n';
  const { lineas, secciones: sec } = leerOrigen(texto);
  // las que ya tienen sección, de abajo arriba para que los números de línea de las de arriba no cambien
  for (const s of secciones.filter((x) => sec[x.slug]).sort((x, y) => sec[y.slug].fin - sec[x.slug].fin)) {
    if (s.sinLinea.length) lineas.splice(sec[s.slug].fin, 0, ...s.sinLinea.map((f) => `- «${f}» · ?`));
  }
  const nuevas = secciones.filter((x) => !sec[x.slug]);
  let fin = lineas.length;
  while (fin > 0 && lineas[fin - 1] === '') fin--;
  const cuerpo = lineas.slice(0, fin);
  for (const n of nuevas) cuerpo.push('', `## ${n.slug}`, ...(n.sinLinea.length ? [''] : []), ...n.sinLinea.map((f) => `- «${f}» · ?`));
  return cuerpo.join(eol) + eol;
}

/* ---------- línea de órdenes ---------- */
function leerArgumentos(argv) {
  const a = { slug: null, fuentes: [], todas: false, escribir: false, ref: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--todas') a.todas = true;
    else if (x === '--escribir') a.escribir = true;
    else if (x === '--fuente' || x === '--ref') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${x} necesita un valor`);
      if (x === '--ref') a.ref = path.resolve(v); else a.fuentes.push(v);
    } else if (x.startsWith('--')) throw new Error(`opción desconocida: ${x}`);
    else if (a.slug === null) a.slug = x;
    else throw new Error(`solo se puede dar un <slug> (sobra «${x}»)`);
  }
  if (a.todas && a.slug) throw new Error('--todas no se combina con un <slug>');
  if (a.todas && a.fuentes.length) throw new Error('--todas no se combina con --fuente');
  if (!a.todas && !a.slug) throw new Error('falta el <slug> (o --todas)');
  return a;
}

export function principal(argv, { raiz = RAIZ_REPO, ficheroOrigen = ORIGEN, salida = console } = {}) {
  let a;
  try { a = leerArgumentos(argv); } catch (e) {
    salida.error(`diff-origen: ${e.message}\nUso: node scripts/diff-origen.mjs <slug> [--fuente <otro-slug>]… [--escribir] [--ref <pages.json>]\n     node scripts/diff-origen.mjs --todas [--escribir] [--ref <pages.json>]`);
    return 1;
  }
  if (!fs.existsSync(ficheroOrigen)) {
    salida.error(`diff-origen: no encuentro ${path.relative(raiz, ficheroOrigen)}`);
    return 1;
  }
  const origen = fs.readFileSync(ficheroOrigen, 'utf8');
  const slugs = a.todas ? SECCIONES : [a.slug];
  const r = comparar({
    slugs, fuentes: a.slug ? { [a.slug]: a.fuentes } : {}, ref: a.ref || REF_POR_DEFECTO, raiz, origen, exigirSeccion: a.todas,
  });
  if (r.fatal) { salida.error(`diff-origen: ${r.fatal}. No se ha escrito nada.`); return 1; }

  const conSeccion = leerOrigen(origen).secciones;
  if (a.escribir && r.secciones.some((s) => s.sinLinea.length || !conSeccion[s.slug])) {
    fs.writeFileSync(ficheroOrigen, escribirFaltan(origen, r.secciones));
    for (const s of r.secciones) {
      if (s.sinLinea.length) salida.log(`${s.slug}: escritas ${s.sinLinea.length} líneas con «?»`);
      s.porRellenar = [...s.porRellenar, ...s.sinLinea.map((f) => ({ frase: f, motivo: '?', n: 0 }))];
      s.sinLinea = [];
      s.falta = false;
    }
  }

  let errores = 0;
  for (const s of r.secciones) {
    const corto = (f) => (f.length > 90 ? f.slice(0, 87) + '…' : f);
    const problemas = [];
    if (s.falta) problemas.push(`falta su sección «## ${s.slug}» en origen.md`);
    for (const f of s.sinLinea) problemas.push(`falta y no tiene línea: «${corto(f)}»`);
    for (const l of s.porRellenar) problemas.push(`motivo «?» sin rellenar${l.n ? ` (origen.md:${l.n})` : ''}: «${corto(l.frase)}»`);
    for (const l of s.invalidos) problemas.push(`motivo no válido «${l.motivo}» (origen.md:${l.n}): «${corto(l.frase)}»`);
    errores += problemas.length;
    const resumen = `${s.slug}: ${s.total} frases, ${s.total - s.faltan.length} en la página, ${s.faltan.length - s.sinLinea.length} apuntadas`;
    if (problemas.length) {
      salida.error(`${resumen}, ${problemas.length} por arreglar`);
      for (const p of problemas) salida.error('  - ' + p);
    } else salida.log(resumen);
    for (const l of s.sobran) salida.log(`  (aviso) línea sobrante en origen.md:${l.n}: la frase ya está en la página o no está en su origen`);
  }
  return errores ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
