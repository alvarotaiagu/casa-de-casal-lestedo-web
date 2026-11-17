/* Enlaces entre páginas (spec 002 §3.6, plan PD-4.2).
   En las fuentes, un enlace a otra página se escribe
     {{enlace:slug|texto}}  o, con ancla,  {{enlace:slug#ancla|texto}}
   y sale <a href="{{raiz}}slug/#ancla">texto</a> si la página está construida
   (estaConstruida de mapa-url.mjs) o solo «texto» si no: así se enlaza ya a
   una página de la 003 sin dar 404, y se vuelve enlace sola cuando exista.
   {{raiz}} lo resuelve después el paso 6 de construir.mjs, como todo.
   La construcción falla si:
     - el slug no está en mapa-url.json, o es un 301 o un pendiente (hay que
       enlazar al destino, no a la redirección);
     - en la fuente cruda de paginas/*.src.html hay un href="{{raiz}}<slug>/…"
       a una entrada con spec exactamente 002 o 003: va por {{enlace:…}}.
       La portada, los parciales y lo que generan las directivas quedan
       fuera de esta regla: ya deciden con estaConstruida. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estaConstruida } from './mapa-url.mjs';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RE_ENLACE = /\{\{enlace:([a-z0-9-]+)(?:#([a-z0-9-]+))?\|([^{}]+)\}\}/g;
const RE_HREF_A_MANO = /(?<![\w-])href=["']\{\{raiz\}\}([a-z0-9-]+)(?=[/#?"'])/g;
const SPECS_POR_ENLACE = new Set(['002', '003']);

const entradaDe = (mapa, slug) => mapa.find((e) => e && e.ruta === `/${slug}/`);
const linea = (texto, i) => texto.slice(0, i).split('\n').length;

/* Errores de la regla del href escrito a mano, en la fuente cruda de una página de paginas/. */
export function hrefsAMano(fuente, src, mapa) {
  const errores = [];
  for (const m of fuente.matchAll(RE_HREF_A_MANO)) {
    const e = entradaDe(mapa, m[1]);
    if (e && SPECS_POR_ENLACE.has(e.spec)) {
      errores.push(`${src}: l. ${linea(fuente, m.index)}: href a mano a /${m[1]}/ (spec ${e.spec}); escríbelo {{enlace:${m[1]}|…}}`);
    }
  }
  return errores;
}

/* {{enlace:…}} → <a> o texto. Lanza un error con todos los fallos de la página. */
export function ponerEnlaces(html, mapa, src, raiz = RAIZ_REPO) {
  if (!html.includes('{{enlace:')) return html;
  const errores = [];
  const salida = html.replace(RE_ENLACE, (m, slug, ancla, texto) => {
    const e = entradaDe(mapa, slug);
    if (!e) { errores.push(`${src}: {{enlace:${slug}|…}}: «/${slug}/» no está en mapa-url.json`); return texto; }
    if (e.accion === '301' || e.accion === 'pendiente') {
      errores.push(`${src}: {{enlace:${slug}|…}}: «/${slug}/» es un ${e.accion}${e.destino ? ` (enlaza a ${e.destino})` : ''}`);
      return texto;
    }
    if (!estaConstruida(e.ruta, raiz, mapa)) return texto;
    return `<a href="{{raiz}}${slug}/${ancla ? '#' + ancla : ''}">${texto}</a>`;
  });
  if (errores.length) throw new Error(errores.join('\n  - '));
  return salida;   // un {{enlace:…}} mal escrito queda y lo caza la validación de huecos
}
