/* Genera las páginas a partir de sus fuentes (spec 001 §3.1, plan PD-5).
   Fuentes: index.src.html (portada), paginas/<slug>.src.html (→ <slug>/index.html)
   y 404.src.html (→ 404.html, en la raíz).
   Pasos, en este orden:
     1. leer las fuentes y su comentario de datos <!--pagina {...}-->;
     2. <!-- @incluye nombre --> → parciales/nombre.html; {{pagina.…}} y {{actual:…}};
     3. {{casa.…}} con datos/casa.json en el idioma de <html lang>, y el
        <script id="datos-casa"> en el <head> (scripts/lib/datos-casa.mjs);
     4. directivas: <!--grupos:pie-->, <!--grupos:menu--> y <!--sigue-leyendo-->
        con datos/paginas.json (spec 002 §3.5, scripts/lib/paginas.mjs);
        {{enlace:slug|texto}} → <a href="{{raiz}}slug/"> o solo el texto
        (spec 002 §3.6, scripts/lib/enlaces.mjs; el href a mano de paginas/
        se mira en la fuente cruda, antes del paso 2);
        {{sitio.minutos}}, {{sitio.maps}} y <!--sitio:jsonld--> con la entrada de
        datos/alrededores.json de la página (spec 002 §3.1 y §3.7, scripts/lib/sitios.mjs);
        <!--svg:ruta/archivo.svg atributos--> → el SVG en línea
        <!--mapa:…--> (T16), <!--alrededores:lista--> y los datos de la regla
        (T17), y <!--panel:k--> y <!--nombres--> con
        datos/habitaciones.json (T09);
     5. <img data-foto="nombre"> → <picture> AVIF/WebP/JPG con {{raiz}}img/fotos/…;
     6. {{raiz}} → ./, ../ o ../../ según la profundidad (en la portada,
        {{raiz}}#x → #x);
     7. validaciones: ruta absoluta a la propia web, {{ sin resolver, <base>;
     8. escribir (solo si ninguna página ha fallado);
     9. versionar.mjs: ?v=<huella> a CSS y JS;
    10. _redirects y .htaccess (T04);
    11. lista por consola el material pendiente: data-pendiente="P-xx" y fotos
        p28 (spec 002 §9, scripts/lib/pendientes.mjs). Es un aviso, no un error.
   Se edita SIEMPRE la fuente o el parcial; el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { cargarMapa, escribirRedirecciones } from './scripts/lib/mapa-url.mjs';
import { cargarCasa, rellenar, incrustar, escritosAMano, ficherosAMirar } from './scripts/lib/datos-casa.mjs';
import { ponerMapas, ponerAlrededores } from './scripts/lib/mapa-svg.mjs';
import { cargarHabitaciones, ponerHabitaciones } from './scripts/lib/habitaciones.mjs';
import { cargarPaginas, ponerGrupos } from './scripts/lib/paginas.mjs';
import { ponerEnlaces, hrefsAMano } from './scripts/lib/enlaces.mjs';
import { cargarSitios, ponerSitios } from './scripts/lib/sitios.mjs';
import { nombresP28, pendientesDe, lineasPendientes } from './scripts/lib/pendientes.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).map((f) => [f.nombre, f]));
const leerTexto = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

/* ---------- 1. fuentes ---------- */
function fuentes() {
  const lista = [{ src: 'index.src.html', salida: 'index.html', profundidad: 0, portada: true }];
  const dirPag = path.join(RAIZ, 'paginas');
  if (fs.existsSync(dirPag)) {
    for (const f of fs.readdirSync(dirPag).filter((x) => x.endsWith('.src.html')).sort()) {
      const slug = f.slice(0, -'.src.html'.length);
      lista.push({ src: path.join('paginas', f), salida: path.join(slug, 'index.html'), profundidad: 1, slug });
    }
  }
  if (fs.existsSync(path.join(RAIZ, '404.src.html'))) lista.push({ src: '404.src.html', salida: '404.html', profundidad: 0, es404: true });
  // cualquier otra fuente de la raíz ya no se construye: que no pase en silencio
  for (const f of fs.readdirSync(RAIZ).filter((x) => x.endsWith('.src.html') && x !== 'index.src.html' && x !== '404.src.html')) {
    console.warn(`aviso: ${f} no se construye (las páginas van en paginas/<slug>.src.html)`);
  }
  return lista;
}

const RE_PAGINA = /^\s*<!--pagina\s+(\{[\s\S]*?\})\s*-->\s*\n?/;
function datosPagina(html, src) {
  const m = RE_PAGINA.exec(html);
  if (!m) return { html, datos: null };
  let datos;
  try { datos = JSON.parse(m[1]); } catch (e) { throw new Error(`${src}: el comentario <!--pagina …--> no es JSON válido (${e.message})`); }
  return { html: html.slice(m[0].length), datos };
}

/* ---------- 2. parciales y datos de la página ---------- */
function incluir(html, src, nivel = 0) {
  if (nivel > 5) throw new Error(`${src}: parciales incluidos en bucle`);
  return html.replace(/<!--\s*@incluye\s+([a-z0-9-]+)\s*-->\n?/g, (m, nombre) => {
    const f = path.join(RAIZ, 'parciales', nombre + '.html');
    if (!fs.existsSync(f)) throw new Error(`${src}: no existe el parcial parciales/${nombre}.html`);
    return incluir(leerTexto(f), src, nivel + 1);
  });
}

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// {{pagina.x|em}}: el texto escapado y *esto* en cursiva (el título de la portadilla: «Tu *habitación*»)
const conCursiva = (s) => escapar(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
function rellenarPagina(html, datos) {
  const d = datos ? { og_titulo: datos.titulo, og_descripcion: datos.descripcion, ...datos } : {};
  html = html.replace(/\{\{pagina\.([a-z0-9_]+)(\|em)?\}\}/g, (m, k, em) => (d[k] == null ? m : em ? conCursiva(d[k]) : escapar(d[k])));   // si falta, lo caza la validación
  // menú: aria-current="page" en el enlace de la página (spec §3.1.6)
  return html.replace(/\{\{actual:([a-z0-9-]+)\}\}/g, (m, k) => (d.menu === k ? ' aria-current="page"' : ''));
}

/* ---------- 4. SVG en línea ---------- */
function svgEnLinea(ruta, atrs) {
  let s = leerTexto(path.join(RAIZ, ruta)).replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  // el mismo SVG va varias veces en la página: fuera todos sus id (el JS usa
  // data-* y el orden de las piedras); el id lo pone quien lo incrusta
  s = s.replace(/\sid="[^"]*"/g, '');
  // quita role/aria del archivo: los decide quien lo incrusta
  s = s.replace(/<svg\b([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(role|aria-label)="[^"]*"/g, '') + ' ' + atrs.trim() + '>');
  return s;
}

/* ---------- 5. fotos ---------- */
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `{{raiz}}img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  // el JPG por defecto: el ancho intermedio (o el único)
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="{{raiz}}img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

/* ---------- 6. raíz relativa ---------- */
function ponerRaiz(html, p) {
  if (p.portada) html = html.replace(/\{\{raiz\}\}#/g, '#');   // sin recargar: conserva ?revision y Lenis
  return html.replace(/\{\{raiz\}\}/g, p.profundidad ? '../'.repeat(p.profundidad) : './');
}

/* ---------- 7. validaciones (spec §3.1.3) ---------- */
// ruta absoluta propia: empieza por «/» (también «//») o va al dominio de la web
const RE_PROPIA = /^(?:\/|(?:https?:)?\/\/(?:www\.)?(?:casadecasal\.com|alvarotaiagu\.github\.io)(?:[/:?#]|$))/i;
const RE_URL_ABS = /url\(\s*(['"]?)\s*\/[^)]*\)/gi;
function linea(texto, i) { return texto.slice(0, i).split('\n').length; }

function rutasAbsolutas(html) {
  const malas = [];
  for (const m of html.matchAll(/\b(href|src|srcset|imagesrcset|poster)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
    const atr = m[1].toLowerCase();
    const urls = atr.endsWith('srcset') ? m[3].split(',').map((c) => c.trim().split(/\s+/)[0]) : [m[3].trim()];
    for (const u of urls) if (RE_PROPIA.test(u)) malas.push(`l. ${linea(html, m.index)}: ${atr}="${u}"`);
  }
  for (const m of html.matchAll(RE_URL_ABS)) malas.push(`l. ${linea(html, m.index)}: ${m[0]}`);
  return malas;
}

function validar(html, p) {
  const errores = [];
  if (!p.es404) for (const r of rutasAbsolutas(html)) errores.push(`ruta absoluta a la propia web (usa {{raiz}}) en ${r}`);
  for (const m of html.matchAll(/\{\{[^}\n]*\}?\}?/g)) errores.push(`hueco sin resolver en l. ${linea(html, m.index)}: ${m[0]}`);
  for (const m of html.matchAll(/<base[\s>]/gi)) errores.push(`<base> en l. ${linea(html, m.index)}: no se usa (rutas relativas con {{raiz}})`);
  return errores.map((e) => `${p.src}: ${e}`);
}

function validarCSS() {
  const errores = [];
  const dir = path.join(RAIZ, 'css');
  if (!fs.existsSync(dir)) return errores;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.css'))) {
    const css = leerTexto(path.join(dir, f));
    for (const m of css.matchAll(RE_URL_ABS)) errores.push(`css/${f}: ruta absoluta en l. ${linea(css, m.index)}: ${m[0]}`);
  }
  return errores;
}

/* ---------- la construcción ---------- */
function construir() {
  const errores = validarCSS();
  let mapa = null;
  try { mapa = cargarMapa(RAIZ); } catch (e) { errores.push(e.message); }                         // §3.2
  let paginas = null;
  if (mapa) try { paginas = cargarPaginas(RAIZ, mapa); } catch (e) { errores.push(e.message); }    // 002 §3.5
  let sitios = null;
  try { sitios = cargarSitios(RAIZ); } catch (e) { errores.push(e.message); }                     // 002 §3.7
  let casa = null;
  try { casa = cargarCasa(RAIZ); } catch (e) { errores.push(e.message); }                         // §3.3
  let habs = null;
  if (casa) try { habs = cargarHabitaciones(RAIZ, casa, FOTOS); } catch (e) { errores.push(e.message); }   // §3.4.4
  const lista = fuentes();
  // §3.3: fechas de la piscina y precios, solo desde datos/casa.json
  if (casa) errores.push(...escritosAMano(casa, ficherosAMirar(lista.map((p) => p.src), RAIZ), RAIZ));
  const salidas = [];
  for (const p of lista) {
    // en Windows, aviso-legal.html y aviso-legal/index.html juntos confunden al servidor y a Pages
    if (p.slug && fs.existsSync(path.join(RAIZ, p.slug + '.html'))) errores.push(`${p.src}: sobra ${p.slug}.html en la raíz (la página sale a ${p.slug}/index.html)`);
    try {
      const cruda = leerTexto(path.join(RAIZ, p.src));
      if (p.slug && mapa) { const aMano = hrefsAMano(cruda, p.src, mapa); if (aMano.length) throw new Error(aMano.join('\n  - ')); }   // 002 §3.6
      const leida = datosPagina(cruda, p.src);
      let html = rellenarPagina(incluir(leida.html, p.src), leida.datos);                         // 1-2
      const lang = (/<html\b[^>]*\blang="([^"]+)"/i.exec(html) || [, 'es'])[1];
      if (casa) html = incrustar(rellenar(html, casa, lang), casa);                                 // 3
      if (paginas) html = ponerGrupos(html, paginas, p.slug || null, p.src);                       // 4 · grupos y «Sigue leyendo» (002 §3.5)
      if (mapa) html = ponerEnlaces(html, mapa, p.src, RAIZ);                                       // 4 · {{enlace:…}} (002 §3.6)
      if (sitios) html = ponerSitios(html, sitios, p.slug || null, leida.datos, p.src);                // 4 · {{sitio.…}} y <!--sitio:jsonld--> (002 §3.7)
      html = html.replace(/<!--svg:([^\s>]+)\s*([^>]*?)-->/g, (m, ruta, a) => svgEnLinea(ruta, a));   // 4
      html = ponerMapas(html, RAIZ, mapa, p.src);                                                   // 4 · <!--mapa:…--> (T16)
      html = ponerAlrededores(html, RAIZ, mapa);                                                    // 4 · <!--alrededores:lista--> y datos de la regla (T17)
      html = ponerHabitaciones(html, habs, casa, FOTOS, p.src, lang);                               // 4 · <!--panel:k--> y <!--nombres--> (T09)
      html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));   // 5
      html = ponerRaiz(html, p);                                                                    // 6
      const malos = validar(html, p);                                                               // 7
      if (malos.length) errores.push(...malos);
      else salidas.push({ p, html });
    } catch (e) {
      errores.push(e.message);
    }
  }
  if (errores.length) {
    console.error('La construcción ha fallado:\n' + errores.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }
  for (const { p, html } of salidas) {                                                              // 8
    const destino = path.join(RAIZ, p.salida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
    console.log(`${p.src.split(path.sep).join('/')} → ${p.salida.split(path.sep).join('/')} (${(html.length / 1024).toFixed(0)} KB)`);
  }
  execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });          // 9
  const n301 = escribirRedirecciones(mapa, RAIZ);                                                  // 10
  console.log(`datos/mapa-url.json → _redirects y .htaccess (${n301} reglas 301)`);
  // 11. material pendiente (002 §9): aviso, no error; verificar.mjs --dominio falla con él
  const p28 = nombresP28([...FOTOS.values()]);
  const pendientes = salidas.map(({ p, html }) => ({ rel: p.salida.split(path.sep).join('/'), pendientes: pendientesDe(html, p28) })).filter((x) => x.pendientes.length);
  if (pendientes.length) console.log(`aviso: material pendiente en ${pendientes.length} páginas (verificar.mjs --dominio no pasa mientras quede):\n` + lineasPendientes(pendientes).map((l) => '  - ' + l).join('\n'));
}

construir();
