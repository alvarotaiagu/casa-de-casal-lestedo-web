/* Datos de temporada (spec 001 §3.3, D-017, plan PD-8).
   datos/casa.json es la única fuente de las fechas de la piscina, las
   temporadas, las notas de las reseñas y los precios «desde» (provisionales,
   P-21). Esta librería:
     - valida el fichero (fechas «MM-DD» reales; en la piscina, `hasta`
       después de `desde`); si no, falla la construcción;
     - rellena los huecos {{casa.…}} de las fuentes, con Intl en el idioma de
       la página (<html lang>);
     - escribe el <script type="application/json" id="datos-casa"> que lee el JS;
     - busca en las fuentes y en js/*.js fechas de la piscina o precios escritos
       a mano (tienen que salir de aquí).
   Huecos:
     {{casa.piscina.corta}}        «1 jun – 20 sep»
     {{casa.piscina.larga}}        «del 1 de junio al 20 de septiembre»
     {{casa.precio.<tipo>}}        «70» (clasica, confort, torre, terraza, familiar)
     {{casa.precio.minimo}}        el más bajo de los cinco
     {{casa.entera.una}}, {{casa.entera.dos}}, {{casa.entera.noche_mas}}   «675», «1.190», «595»
     {{casa.entera.plazas}}        «22»
     {{casa.notas.<fuente>.nota}}  «4,9» (booking, google, tripadvisor)
     {{casa.notas.<fuente>.recuento}}  «315»
   Un hueco que no existe se queda como está y lo caza la validación de
   «hueco sin resolver». */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FICHERO = ['datos', 'casa.json'];
const TIPOS = ['clasica', 'confort', 'torre', 'terraza', 'familiar'];
const FUENTES_NOTAS = ['booking', 'google', 'tripadvisor'];

/* ---------- validar ---------- */
const RE_MMDD = /^(\d{2})-(\d{2})$/;
const diasDelMes = (m) => new Date(Date.UTC(2001, m, 0)).getUTCDate();   // año sin 29 de febrero
function fechaValida(s) {
  const m = RE_MMDD.exec(typeof s === 'string' ? s : '');
  if (!m) return false;
  const mes = +m[1], dia = +m[2];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes(mes);
}
const esPrecio = (n) => Number.isInteger(n) && n > 0;
/* «MM-DD» del día siguiente (el 12-31 pasa al 01-01). */
function diaSiguiente(s) {
  const d = new Date(Date.UTC(2001, +s.slice(0, 2) - 1, +s.slice(3) + 1));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function validarCasa(casa) {
  const errores = [];
  const p = casa && casa.piscina;
  if (!p) errores.push('falta «piscina»');
  else {
    for (const k of ['desde', 'hasta']) if (!fechaValida(p[k])) errores.push(`piscina.${k} «${p[k]}» no es una fecha MM-DD`);
    if (fechaValida(p.desde) && fechaValida(p.hasta) && p.hasta <= p.desde) errores.push(`piscina.hasta (${p.hasta}) tiene que ser posterior a piscina.desde (${p.desde})`);
  }
  for (const t of ['habitaciones', 'entera']) {
    const x = casa && casa.temporadas && casa.temporadas[t];
    if (!x) { errores.push(`falta temporadas.${t}`); continue; }
    // una temporada puede cruzar el año (la casa entera, de noviembre a marzo)
    for (const k of ['desde', 'hasta']) if (!fechaValida(x[k])) errores.push(`temporadas.${t}.${k} «${x[k]}» no es una fecha MM-DD`);
  }
  // el anillo usa las dos y el motor solo la de la casa entera: tienen que repartirse el año
  const th = casa && casa.temporadas && casa.temporadas.habitaciones, te = casa && casa.temporadas && casa.temporadas.entera;
  if (th && te && [th.desde, th.hasta, te.desde, te.hasta].every(fechaValida)
      && (diaSiguiente(th.hasta) !== te.desde || diaSiguiente(te.hasta) !== th.desde)) {
    errores.push(`temporadas: habitaciones (${th.desde} a ${th.hasta}) y entera (${te.desde} a ${te.hasta}) tienen que repartirse el año, sin huecos ni días repetidos`);
  }
  for (const f of FUENTES_NOTAS) {
    const n = casa && casa.notas && casa.notas[f];
    if (!n) { errores.push(`falta notas.${f}`); continue; }
    if (typeof n.nota !== 'number' || !(n.nota > 0)) errores.push(`notas.${f}.nota no es un número`);
    if (!Number.isInteger(n.recuento) || n.recuento < 0) errores.push(`notas.${f}.recuento no es un número entero`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.mirado || '')) errores.push(`notas.${f}.mirado no es una fecha AAAA-MM-DD`);
  }
  const pr = casa && casa.precios;
  if (!pr) errores.push('falta «precios»');
  else {
    for (const t of TIPOS) if (!esPrecio(pr.desde && pr.desde[t])) errores.push(`precios.desde.${t} no es un precio entero`);
    for (const k of ['una', 'dos', 'noche_mas', 'plazas']) if (!esPrecio(pr.entera && pr.entera[k])) errores.push(`precios.entera.${k} no es un número entero`);
  }
  return errores.map((e) => 'datos/casa.json: ' + e);
}

export function cargarCasa(raiz = RAIZ_REPO) {
  let casa;
  try { casa = JSON.parse(fs.readFileSync(path.join(raiz, ...FICHERO), 'utf8')); } catch (e) { throw new Error(`datos/casa.json: no se puede leer (${e.message})`); }
  const errores = validarCasa(casa);
  if (errores.length) throw new Error(errores.join('\n  - '));
  return casa;
}

/* ---------- formatear ---------- */
const deMMDD = (s) => { const [m, d] = s.split('-').map(Number); return new Date(Date.UTC(2001, m - 1, d)); };
const esEs = (lang) => /^es\b/i.test(lang);

/* «1 jun»: en castellano, el mes en tres letras como en su web (Intl da «sept»). */
function fechaCorta(s, lang) {
  const partes = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).formatToParts(deMMDD(s));
  return partes.map((x) => (x.type === 'month' && esEs(lang) ? x.value.replace(/\.$/, '').slice(0, 3) : x.value)).join('');
}
const fechaLarga = (s, lang) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(deMMDD(s));

export function piscinaCorta(casa, lang = 'es') {
  const { desde, hasta } = casa.piscina;
  if (esEs(lang)) return `${fechaCorta(desde, lang)} – ${fechaCorta(hasta, lang)}`;
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).formatRange(deMMDD(desde), deMMDD(hasta));
}
export function piscinaLarga(casa, lang = 'es') {
  const { desde, hasta } = casa.piscina;
  if (esEs(lang)) return `del ${fechaLarga(desde, lang)} al ${fechaLarga(hasta, lang)}`;
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).formatRange(deMMDD(desde), deMMDD(hasta));
}

/* Los huecos y su texto, para un idioma. */
export function huecos(casa, lang = 'es') {
  const entero = new Intl.NumberFormat(lang, { useGrouping: 'always' });   // punto de miles también con cuatro cifras, como en su web
  const nota = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const h = {
    'piscina.corta': piscinaCorta(casa, lang),
    'piscina.larga': piscinaLarga(casa, lang),
    'precio.minimo': entero.format(Math.min(...TIPOS.map((t) => casa.precios.desde[t]))),
  };
  for (const t of TIPOS) h[`precio.${t}`] = entero.format(casa.precios.desde[t]);
  for (const [k, v] of Object.entries(casa.precios.entera)) h[`entera.${k}`] = entero.format(v);
  for (const f of FUENTES_NOTAS) {
    h[`notas.${f}.nota`] = nota.format(casa.notas[f].nota);
    h[`notas.${f}.recuento`] = entero.format(casa.notas[f].recuento);
  }
  return h;
}

/* Rellena los {{casa.…}} conocidos; los demás se quedan para la validación. */
export function rellenar(html, casa, lang = 'es') {
  const h = huecos(casa, lang);
  return html.replace(/\{\{casa\.([a-z0-9_.]+)\}\}/g, (m, k) => (k in h ? h[k] : m));
}

/* <script type="application/json" id="datos-casa"> sin las claves «_…» (comentarios). */
export function etiquetaDatos(casa) {
  const limpio = JSON.parse(JSON.stringify(casa, (k, v) => (k.startsWith('_') ? undefined : v)));
  const json = JSON.stringify(limpio).replace(/</g, '\\u003c');
  return `<script type="application/json" id="datos-casa">${json}</script>`;
}

/* Pone el JSON al final del <head> (o al principio del <body> si no hay head). */
export function incrustar(html, casa) {
  const tag = etiquetaDatos(casa) + '\n';
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '</head>');
  return html.replace(/<body\b[^>]*>\n?/i, (m) => m + tag);
}

/* ---------- escritos a mano ---------- */
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formasNumero = (n) => [...new Set([String(n), new Intl.NumberFormat('es', { useGrouping: 'always' }).format(n)])].map(escaparRegex);

function reglas(casa) {
  const precios = [...TIPOS.map((t) => casa.precios.desde[t]), casa.precios.entera.una, casa.precios.entera.dos, casa.precios.entera.noche_mas];
  const todos = [...new Set(precios)].flatMap(formasNumero).join('|');
  const entera = [casa.precios.entera.una, casa.precios.entera.dos, casa.precios.entera.noche_mas].flatMap(formasNumero).join('|');
  const plazas = casa.precios.entera.plazas;
  return [
    { que: 'fecha de la piscina', re: /\b(1[05]|20) (de )?sep/gi },
    { que: 'fecha de la piscina', re: /hasta el 15\b/gi },
    { que: 'precio', re: new RegExp(`(?<![\\d.,])(?:${todos})(?:\\s|&nbsp;|&#160;|</b>)*(?:€|&euro;)`, 'g') },
    { que: 'plazas de la casa entera', re: new RegExp(`\\bhasta ${plazas}\\b|\\b${plazas} (?:personas|plazas)\\b`, 'g') },
    // solo en el JS: números sueltos de la casa entera y precios en las claves
    { que: 'precio', soloJS: true, re: new RegExp(`(?<![\\w.,])(?:${entera})(?![\\w,]|\\.\\d)`, 'g') },
    { que: 'precio', soloJS: true, re: /\b(?:precio|pr)\s*:\s*['"]?\d/g },
    { que: 'plazas de la casa entera', soloJS: true, re: /\bPLAZAS_ENTERA\s*=\s*\d/g },
  ];
}

/* Busca fechas de la piscina y precios escritos a mano. `ficheros` son rutas
   relativas a `raiz` (fuentes .src.html, parciales y js/*.js). */
export function escritosAMano(casa, ficheros, raiz = RAIZ_REPO) {
  const errores = [];
  const rs = reglas(casa);
  for (const rel of ficheros) {
    const f = path.join(raiz, rel);
    if (!fs.existsSync(f)) continue;
    const texto = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const js = rel.endsWith('.js');
    for (const r of rs) {
      if (r.soloJS && !js) continue;
      for (const m of texto.matchAll(r.re)) {
        const l = texto.slice(0, m.index).split('\n').length;
        errores.push(`${rel.split(path.sep).join('/')}: l. ${l}: «${m[0].trim()}» escrito a mano (${r.que}): sale de datos/casa.json`);
      }
    }
  }
  return errores;
}

/* Lo que hay que mirar: las fuentes de las páginas, los parciales y js/*.js. */
export function ficherosAMirar(fuentes, raiz = RAIZ_REPO) {
  const lista = [...fuentes];
  for (const dir of ['parciales', 'js']) {
    const d = path.join(raiz, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) if (dir === 'js' ? f.endsWith('.js') : f.endsWith('.html')) lista.push(path.join(dir, f));
  }
  return lista;
}
