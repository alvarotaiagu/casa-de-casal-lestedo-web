/* Grupos de páginas interiores (spec 002 §3.5, plan PD-4.1).
   datos/paginas.json es la única lista de páginas interiores por grupo:
     { grupos: [ { id, nombre, paginas: [ { slug, corto } ] } ] }
   De ahí salen tres directivas, que construir.mjs expande después de @incluye:
     <!--grupos:pie-->     las columnas «La casa» y «Alrededores» del pie;
     <!--grupos:menu-->    los mismos grupos en el menú móvil, sin los que ya
                           están en los siete enlaces de arriba;
     <!--sigue-leyendo-->  hasta tres páginas que siguen a esta en su grupo,
                           dando la vuelta, con la foto de su portadilla.
   Solo se pintan las páginas construidas (estaConstruida de mapa-url.mjs).
   aria-current="page" va por slug: el de la página que se construye.
   La construcción falla si:
     - un slug no es una entrada «pagina» de mapa-url.json;
     - un slug sale dos veces;
     - una fuente de paginas/ con spec 002 o 001+002 no está en ningún grupo;
     - una página que no está en ningún grupo lleva <!--sigue-leyendo-->. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estaConstruida, leerMapa } from './mapa-url.mjs';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FICHERO = ['datos', 'paginas.json'];
const SPECS_CON_GRUPO = new Set(['002', '001+002']);
// los que ya están en los siete enlaces del menú (001 §3.1.6): el menú móvil no los repite
const EN_EL_MENU = new Set(['tu-habitacion', 'pico-sacro-v2', 'entorno']);
const RE_PAGINA = /^\s*<!--pagina\s+(\{[\s\S]*?\})\s*-->/;

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fuente = (raiz, slug) => path.join(raiz, 'paginas', `${slug}.src.html`);

/* El comentario <!--pagina {…}--> de una fuente (para la foto de «Sigue leyendo»). */
function datosDe(raiz, slug) {
  const m = RE_PAGINA.exec(fs.readFileSync(fuente(raiz, slug), 'utf8').replace(/^﻿/, ''));
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }   // el error lo da construir.mjs al leer esa página
}

/* Devuelve la lista de errores de `datos` (vacía si está bien). */
export function validarPaginas(datos, mapa, raiz = RAIZ_REPO) {
  const errores = [];
  if (!datos || !Array.isArray(datos.grupos)) return ['datos/paginas.json: tiene que tener una lista «grupos»'];
  const porRuta = new Map(mapa.filter(Boolean).map((e) => [e.ruta, e]));
  const vistos = new Map();
  datos.grupos.forEach((g, i) => {
    const donde = `grupo ${i + 1}${g && g.id ? ` (${g.id})` : ''}`;
    // el id va en id="menu-grupo-…" del menú móvil: solo minúsculas, cifras y guiones
    if (!g || typeof g.id !== 'string' || !/^[a-z0-9-]+$/.test(g.id) || typeof g.nombre !== 'string' || !g.nombre.trim() || !Array.isArray(g.paginas)) {
      errores.push(`${donde}: necesita id (a-z, 0-9 y -), nombre y una lista «paginas»`);
      return;
    }
    for (const p of g.paginas) {
      if (!p || typeof p.slug !== 'string' || typeof p.corto !== 'string' || !p.corto.trim()) { errores.push(`${donde}: cada página necesita slug y corto (${JSON.stringify(p)})`); continue; }
      const e = porRuta.get(`/${p.slug}/`);
      if (!e) errores.push(`${donde}: «${p.slug}» no está en mapa-url.json`);
      else if (e.accion !== 'pagina') errores.push(`${donde}: «${p.slug}» es una dirección ${e.accion} en mapa-url.json (solo van páginas «pagina»)`);
      if (vistos.has(p.slug)) errores.push(`${donde}: «${p.slug}» está repetida (ya está en el grupo ${vistos.get(p.slug)})`);
      else vistos.set(p.slug, g.id);
    }
  });
  // toda fuente de la 002 (o de la 001 completada en la 002) va en un grupo
  const dir = path.join(raiz, 'paginas');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.src.html')).sort()) {
      const slug = f.slice(0, -'.src.html'.length);
      const e = porRuta.get(`/${slug}/`);
      if (e && SPECS_CON_GRUPO.has(e.spec) && !vistos.has(slug)) errores.push(`paginas/${f} es de la spec ${e.spec} y no está en ningún grupo`);
    }
  }
  return errores.map((x) => 'datos/paginas.json: ' + x);
}

/* Lee y valida datos/paginas.json; deja preparadas las páginas construidas de
   cada grupo con su corto y su foto. Lanza un error con todos los fallos juntos. */
export function cargarPaginas(raiz = RAIZ_REPO, mapa = leerMapa(raiz)) {
  let datos;
  try { datos = JSON.parse(fs.readFileSync(path.join(raiz, ...FICHERO), 'utf8')); } catch (e) { throw new Error(`datos/paginas.json: no se puede leer (${e.message})`); }
  const errores = validarPaginas(datos, mapa, raiz);
  if (errores.length) throw new Error(errores.join('\n  - '));
  const grupos = datos.grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    paginas: g.paginas
      .filter((p) => estaConstruida(`/${p.slug}/`, raiz, mapa))
      .map((p) => ({ slug: p.slug, corto: p.corto, foto: datosDe(raiz, p.slug).foto })),
  }));
  return { grupos };
}

/* ---------- lo que pintan las directivas ---------- */
const actual = (slug, propio) => (slug === propio ? ' aria-current="page"' : '');
const enlace = (p, propio) => `<a href="{{raiz}}${p.slug}/"${actual(p.slug, propio)}>${escapar(p.corto)}</a>`;

function pie(grupos, propio) {
  return grupos.filter((g) => g.paginas.length).map((g) => [
    '          <div class="pie__grupo">',
    `            <h2>${escapar(g.nombre)}</h2>`,
    '            <ul>',
    ...g.paginas.map((p) => `              <li>${enlace(p, propio)}</li>`),
    '            </ul>',
    '          </div>',
  ].join('\n')).join('\n');
}

function menu(grupos, propio) {
  const con = grupos.map((g) => ({ ...g, paginas: g.paginas.filter((p) => !EN_EL_MENU.has(p.slug)) })).filter((g) => g.paginas.length);
  if (!con.length) return '';
  return [
    '    <div class="menu-movil__grupos">',
    ...con.flatMap((g) => [
      `      <p class="menu-movil__eti" id="menu-grupo-${g.id}">${escapar(g.nombre)}</p>`,
      `      <ul aria-labelledby="menu-grupo-${g.id}">`,
      ...g.paginas.map((p) => `        <li>${enlace(p, propio)}</li>`),
      '      </ul>',
    ]),
    '    </div>',
  ].join('\n');
}

function sigueLeyendo(grupos, propio, src) {
  const g = grupos.find((x) => x.paginas.some((p) => p.slug === propio));
  if (!g) throw new Error(`${src}: lleva <!--sigue-leyendo--> y no está en ningún grupo de datos/paginas.json`);
  const n = Math.min(3, g.paginas.length - 1);
  if (n < 1) return '';   // sola en su grupo: no sale (§9)
  const i = g.paginas.findIndex((p) => p.slug === propio);
  const siguientes = Array.from({ length: n }, (_, k) => g.paginas[(i + 1 + k) % g.paginas.length]);
  // la miniatura es la foto de su portadilla; una página sin foto (solo las de
  // ejemplo de las pruebas) sale con el texto
  const miniatura = (p) => (p.foto ? `<img data-foto="${escapar(p.foto)}" alt="" sizes="(max-width: 699px) 112px, 380px" loading="lazy">` : '');
  return [
    '<nav class="sigue-leyendo" aria-labelledby="sigue-leyendo-tit">',
    '  <div class="env">',
    '    <h2 class="eti" id="sigue-leyendo-tit">Sigue leyendo</h2>',
    '    <ul class="sigue-leyendo__lista">',
    ...siguientes.map((p) => `      <li><a class="sigue-leyendo__enlace" href="{{raiz}}${p.slug}/">${miniatura(p)}<span>${escapar(p.corto)}</span></a></li>`),
    '    </ul>',
    '  </div>',
    '</nav>',
  ].join('\n');
}

/* En el pie, el enlace a la propia página lleva aria-current (también los
   legales, que están escritos en el parcial). */
function marcarPie(html, propio) {
  if (!propio) return html;
  return html.replace(/<footer class="pie"[\s\S]*?<\/footer>/, (pieHtml) => pieHtml.replace(
    new RegExp(`<a href="\\{\\{raiz\\}\\}${propio}/"(?![^>]*aria-current)`, 'g'),
    (m) => m + ' aria-current="page"',
  ));
}

/* Expande las tres directivas en `html`. `propio` es el slug de la página que
   se construye (null en la portada y el 404). */
export function ponerGrupos(html, paginas, propio, src) {
  if (!/<!--(?:grupos:(?:pie|menu)|sigue-leyendo)-->/.test(html)) return html;
  const linea = (s) => (s ? s + '\n' : '');   // un grupo vacío no deja la línea en blanco
  html = html.replace(/[ \t]*<!--grupos:pie-->\n?/g, () => linea(pie(paginas.grupos, propio)));
  html = html.replace(/[ \t]*<!--grupos:menu-->\n?/g, () => linea(menu(paginas.grupos, propio)));
  html = html.replace(/<!--sigue-leyendo-->\n?/g, () => { const s = sigueLeyendo(paginas.grupos, propio, src); return s ? s + '\n' : ''; });
  return marcarPie(html, propio);
}
