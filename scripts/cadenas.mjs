/* Comprobación de cadenas (spec 001 §3.1.11, CA-20 y CA-28, PD-6).
   Busca en js/*.js las cadenas literales ('…', "…" y `…`) con dos letras
   seguidas que no son la clave de un t('…'). Cada una tiene que estar en
   scripts/t-excepciones.json (selectores, atributos, eventos, URL, claves,
   CSS…): si no, falla. También falla si una excepción ya no se usa, para que
   la lista no crezca con restos.
   - En las cadenas con HTML (las que pinta reserva.js), las etiquetas no
     cuentan como texto, salvo sus aria-label, title, alt y placeholder, que
     sí son texto visible.
   - En las plantillas `…${x}…` solo cuentan las partes fijas; lo de dentro
     de ${…} se mira como código.
   - La clave de t() es una cadena fija: una plantilla con ${…} dentro de t()
     es un error (los huecos van en {nombre}).
   Uso: node scripts/cadenas.mjs (sale con 1 si hay algo). También se usa
   desde scripts/pruebas-build.mjs con comprobar(). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOS_LETRAS = /\p{L}{2}/u;
const ATR_VISIBLES = /\b(?:aria-label|title|alt|placeholder)\s*=\s*"([^"]*)"/gi;

/* ---------- el tokenizador: cadenas, plantillas, comentarios y regex ---------- */
// Tras qué puede ir una regex literal (y no una división)
const ANTES_DE_REGEX = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const PALABRAS_ANTES_DE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof']);

export function literales(src) {
  const out = [];
  let i = 0, ultimo = '';                       // ultimo: último carácter significativo (o palabra) de código
  const pila = [];                              // profundidad de llaves dentro de cada ${…} abierto
  const linea = (p) => src.slice(0, p).split('\n').length;
  const leerCadena = (q) => {                   // i apunta a la comilla de apertura
    const ini = i; i++;
    let v = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') { v += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; continue; }
      v += src[i++];
    }
    i++;
    out.push({ tipo: 'cadena', valor: v, partes: [v], ini, fin: i, linea: linea(ini) });
  };
  // una plantilla: guarda sus partes fijas y, en cada ${, vuelve al bucle de código
  const abrirPlantilla = (ini) => {
    const lit = { tipo: 'plantilla', partes: [], ini, linea: linea(ini), conHuecos: false };
    out.push(lit);
    seguirPlantilla(lit);
  };
  const seguirPlantilla = (lit) => {
    let v = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { v += src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; lit.partes.push(v); lit.fin = i; lit.valor = lit.partes.join('\u0001'); return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; lit.partes.push(v); lit.conHuecos = true; pila.push({ lit, llaves: 0 }); return; }
      v += c; i++;
    }
  };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '\'' || c === '"') { leerCadena(c); ultimo = 'x'; continue; }
    if (c === '`') { i++; abrirPlantilla(i - 1); ultimo = 'x'; continue; }
    if (c === '/' && (ANTES_DE_REGEX.has(ultimo) || PALABRAS_ANTES_DE_REGEX.has(ultimo))) {
      i++;
      let clase = false;
      while (i < src.length) {
        const x = src[i];
        if (x === '\\') { i += 2; continue; }
        if (x === '[') clase = true; else if (x === ']') clase = false;
        else if (x === '/' && !clase) break;
        else if (x === '\n') break;
        i++;
      }
      i++;
      while (/[a-z]/i.test(src[i] || '')) i++;
      ultimo = 'x';
      continue;
    }
    if (pila.length) {
      const tope = pila[pila.length - 1];
      if (c === '{') tope.llaves++;
      else if (c === '}') {
        if (tope.llaves === 0) { pila.pop(); i++; seguirPlantilla(tope.lit); ultimo = 'x'; continue; }
        tope.llaves--;
      }
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let p = i; while (/[\w$]/.test(src[p] || '')) p++;
      ultimo = src.slice(i, p); i = p; continue;
    }
    if (/[0-9]/.test(c)) { while (/[\w.]/.test(src[i] || '')) i++; ultimo = 'x'; continue; }
    ultimo = c === ')' || c === ']' ? 'x' : c;
    i++;
  }
  // ¿es la clave de t( … )? Lo de antes, sin espacios, termina en «t(» y la t no es parte de otro nombre
  for (const l of out) {
    let p = l.ini - 1;
    while (p >= 0 && /\s/.test(src[p])) p--;
    if (src[p] !== '(') { l.enT = false; continue; }
    p--;
    while (p >= 0 && /\s/.test(src[p])) p--;
    l.enT = src[p] === 't' && !/[\w$]/.test(src[p - 1] || '');
  }
  return out;
}

/* Lo que de una cadena es texto: fuera las etiquetas HTML, salvo sus atributos visibles. */
export function textoVisible(valor) {
  const visibles = [];
  const sinEtiquetas = valor.replace(/<\/?[A-Za-z][^<>]*>?/g, (tag) => {
    for (const m of tag.matchAll(ATR_VISIBLES)) visibles.push(m[1]);
    return ' ';
  });
  return [sinEtiquetas, ...visibles].join(' ');
}

/* ---------- las excepciones ---------- */
export function cargarExcepciones(raiz = RAIZ_REPO) {
  const j = JSON.parse(fs.readFileSync(path.join(raiz, 'scripts', 't-excepciones.json'), 'utf8'));
  const exactas = new Map();                 // cadena → grupo
  for (const [grupo, lista] of Object.entries(j.exactas || {})) for (const s of lista) exactas.set(s, grupo);
  const empiezan = Object.entries(j.empiezan || {}).flatMap(([grupo, lista]) => lista.map((s) => [s, grupo]));
  const patrones = Object.entries(j.patrones || {}).flatMap(([grupo, lista]) => lista.map((s) => [new RegExp(s), grupo, s]));
  return { exactas, empiezan, patrones };
}

/* Revisa js/*.js. Devuelve { errores, sinUso, revisadas }. */
export function comprobar(raiz = RAIZ_REPO) {
  const ex = cargarExcepciones(raiz);
  const usadas = new Set();
  const errores = [];
  let revisadas = 0;
  const dir = path.join(raiz, 'js');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    for (const l of literales(src)) {
      revisadas++;
      if (l.enT) {
        if (l.tipo === 'plantilla' && l.conHuecos) errores.push(`js/${f}:${l.linea}: la clave de t() no puede llevar \${…}: usa {hueco} (${JSON.stringify(l.partes.join('${…}')).slice(0, 80)})`);
        continue;
      }
      // las partes fijas unidas por un hueco que no es letra: una etiqueta partida por ${…} sigue siendo etiqueta
      if (!DOS_LETRAS.test(textoVisible(l.partes.join('\u0001')))) continue;
      const v = l.tipo === 'plantilla' ? l.partes.join('${…}') : l.valor;
      if (ex.exactas.has(v)) { usadas.add('exacta:' + v); continue; }
      const em = ex.empiezan.find(([s]) => v.startsWith(s));
      if (em) { usadas.add('empieza:' + em[0]); continue; }
      const pa = ex.patrones.find(([re]) => re.test(v));
      if (pa) { usadas.add('patron:' + pa[2]); continue; }
      errores.push(`js/${f}:${l.linea}: ${JSON.stringify(v).slice(0, 100)} fuera de t() y sin excepción`);
    }
  }
  const sinUso = [
    ...[...ex.exactas.keys()].filter((s) => !usadas.has('exacta:' + s)),
    ...ex.empiezan.map(([s]) => s).filter((s) => !usadas.has('empieza:' + s)),
    ...ex.patrones.map(([, , s]) => s).filter((s) => !usadas.has('patron:' + s)),
  ];
  return { errores, sinUso, revisadas };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errores, sinUso, revisadas } = comprobar();
  for (const e of errores) console.error('  - ' + e);
  for (const s of sinUso) console.error(`  - excepción sin uso en scripts/t-excepciones.json: ${JSON.stringify(s)}`);
  if (errores.length || sinUso.length) { console.error(`cadenas: ${errores.length} fuera de t() y ${sinUso.length} excepciones sin uso`); process.exit(1); }
  console.log(`cadenas: ${revisadas} literales en js/*.js, todas en t() o en las excepciones`);
}
