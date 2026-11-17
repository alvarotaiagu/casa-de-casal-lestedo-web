/* Verificación de la web de Casa de Casal (Playwright, bajando con la rueda).
   Uso: node verificar.mjs [--capturas] [--final] [--solo 5,12]
        node verificar.mjs --publicar [base]
        node verificar.mjs --dominio
   --capturas → capturas en ./pruebas/
   --final    → cada PENDIENTE (criterio de la spec 001 aún sin comprobar) cuenta como fallo
   --solo     → solo esas secciones del navegador (los números que se imprimen),
                para no repetir la pasada entera al arreglar una; la 0, la de los
                archivos, va siempre. La pasada buena es la entera.
   --publicar → sin navegador: la pasada antes de mandar commits al escaparate
                (spec 001 §8 y §9, plan PD-9). Mira los commits desde `base`
                (por defecto escaparate/master) hasta HEAD. Avisa, sin fallar,
                del material pendiente (spec 002 §9): bloques data-pendiente="P-xx"
                y fotos p28 de los HTML construidos.
   --dominio  → sin navegador: la pasada del día de publicar en casadecasal.com
                (spec 002 §9, plan PD-6; la 005 le añade lo suyo). Falla si queda
                material pendiente en algún HTML construido.
   Reglas de Playwright (../CLAUDE.md, CA-24): un navegador, cerrado en
   finally; escala 1; movimiento reducido salvo donde se prueba el
   movimiento; el 3D del Pico no se pinta (Three.js no se descarga). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { vaEnDocs, enlacesADocumentos } from './scripts/lib/documentos.mjs';
import { zonasVacias } from './scripts/lib/habitaciones.mjs';
import { pendientesDeLaWeb, lineasPendientes } from './scripts/lib/pendientes.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

/* ================= --dominio: material pendiente, sin navegador ================= */
if (process.argv.includes('--dominio')) {
  let lista;
  try { lista = pendientesDeLaWeb(RAIZ); }
  catch (e) { console.error('--dominio: no se puede mirar el material pendiente (' + e.message + ')'); process.exit(2); }
  if (lista.length) {
    console.log(lineasPendientes(lista).map((l) => '  FALLO  ' + l).join('\n'));
    console.log(`\n--dominio: material pendiente en ${lista.length} páginas. No se publica en casadecasal.com.`);
    process.exit(1);
  }
  console.log('--dominio: bien. Ningún data-pendiente ni foto p28 en las páginas construidas.');
  process.exit(0);
}

/* ================= --publicar: commits y datos, sin navegador ================= */
if (process.argv.includes('--publicar')) {
  const sig = process.argv[process.argv.indexOf('--publicar') + 1];
  const base = sig && !sig.startsWith('--') ? sig : 'escaparate/master';
  const git = (...a) => execFileSync('git', ['-c', 'core.quotePath=false', ...a], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const malos = [];
  let n = 0;
  try { git('rev-parse', '--verify', '--quiet', base + '^{commit}'); }
  catch (e) { console.error(`No encuentro «${base}». ¿Falta «git fetch escaparate»?`); process.exit(2); }
  console.log(`--publicar: commits de ${base} a HEAD`);
  for (const linea of git('log', '--no-merges', '--format=%H%x09%s', `${base}..HEAD`).split('\n').filter(Boolean)) {
    const [h, ...resto] = linea.split('\t');
    const asunto = resto.join('\t');
    const ficheros = git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', h).split('\n').filter(Boolean);
    n++;
    const esDocs = /^docs:/.test(asunto);
    const fuera = esDocs ? ficheros.filter((f) => !vaEnDocs(f)) : ficheros.filter(vaEnDocs);
    if (fuera.length) malos.push(`${h.slice(0, 7)} «${asunto}»: ` + (esDocs ? 'es «docs:» y toca código: ' : 'no es «docs:» y toca documentos: ') + fuera.join(', '));
  }
  console.log(`  ${n} commits mirados`);
  // los documentos tampoco se enlazan desde la web (CA-29, la parte estática)
  for (const m of enlacesADocumentos(RAIZ)) malos.push('enlace a un documento: ' + m);
  // §9: una ventana del dibujo sin habitaciones ni frase no se publica
  let vacias = [];
  try { vacias = zonasVacias(JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'habitaciones.json'), 'utf8'))); }
  catch (e) { malos.push('datos/habitaciones.json: no se puede leer o no tiene el formato esperado (' + e.message + ')'); }
  if (vacias.length) malos.push('datos/habitaciones.json: zonas sin habitaciones ni frase (enseñan «Pronto, con sus fotos»): ' + vacias.join(', '));
  // spec 002 §9: el material pendiente se puede pasar al escaparate; solo se avisa
  let pendientes = [];
  try { pendientes = pendientesDeLaWeb(RAIZ); }
  catch (e) { malos.push('material pendiente: no se puede mirar (' + e.message + ')'); }
  if (pendientes.length) console.log(`  material pendiente en ${pendientes.length} páginas (aviso; --dominio no pasa mientras quede):\n` + lineasPendientes(pendientes).map((l) => '  AVISO  ' + l).join('\n'));
  if (malos.length) { console.log(malos.map((m) => '  FALLO  ' + m).join('\n')); console.log(`\n--publicar: ${malos.length} mal. No se pasa al escaparate.`); process.exit(1); }
  console.log('--publicar: bien. Cada commit es de código o de documentos, nunca de los dos.');
  process.exit(0);
}

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const PUERTO = 8781;                 // puerto propio de esta web
const CAPTURAS = process.argv.includes('--capturas');
const FINAL = process.argv.includes('--final');
const argSolo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] || '' : null;
if (argSolo !== null && !/^\d+(,\d+)*$/.test(argSolo)) { console.error('--solo necesita los números de las secciones: --solo 5,12'); process.exit(2); }
// la pasada final es la entera: --final con --solo daría por buena una pasada a medias
if (argSolo !== null && FINAL) { console.error('--final va sin --solo: la pasada final es la entera'); process.exit(2); }
const SOLO = argSolo !== null ? new Set(argSolo.split(',')) : null;
const toca = (n) => !SOLO || SOLO.has(String(n));
const DIR_CAP = path.join(RAIZ, 'pruebas');
if (CAPTURAS) fs.mkdirSync(DIR_CAP, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
/* El servidor imita a GitHub Pages (spec 001 §9): el prefijo del escaparate
   es opcional; /x redirige a /x/ si x es una carpeta; una carpeta sirve su
   index.html; /x sirve x.html si existe; lo que no existe sirve 404.html con
   estado 404. */
const PREFIJO = '/casa-de-casal-lestedo-web/';
const servidor = http.createServer((req, res) => {
  const [ruta, consulta] = req.url.split(/\?(.*)/s);
  let p;
  try { p = decodeURIComponent(ruta); } catch (e) { p = ruta; }
  const pre = p === PREFIJO.slice(0, -1) || p.startsWith(PREFIJO) ? PREFIJO.slice(0, -1) : '';
  // como Pages: el prefijo sin la barra final redirige a él con la barra (si no, los enlaces relativos se resolverían mal)
  if (pre && p === pre) { res.writeHead(301, { Location: PREFIJO + (consulta !== undefined ? '?' + consulta : '') }); res.end(); return; }
  const resto = p.slice(pre.length) || '/';
  const f = path.join(RAIZ, resto);
  const dentro = f === RAIZ || f.startsWith(RAIZ + path.sep);
  const servir = (fichero, estado = 200) => { res.writeHead(estado, { 'Content-Type': TIPOS[path.extname(fichero)] || 'application/octet-stream' }); fs.createReadStream(fichero).pipe(res); };
  const esFichero = (x) => fs.existsSync(x) && fs.statSync(x).isFile();
  if (dentro && fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!resto.endsWith('/')) { res.writeHead(301, { Location: pre + resto + '/' + (consulta !== undefined ? '?' + consulta : '') }); res.end(); return; }
    if (esFichero(path.join(f, 'index.html'))) return servir(path.join(f, 'index.html'));
  } else if (dentro && esFichero(f)) return servir(f);
  else if (dentro && esFichero(f + '.html')) return servir(f + '.html');
  servir(path.join(RAIZ, '404.html'), 404);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const ORIGEN = `http://localhost:${PUERTO}`;
const BASE = ORIGEN + '/';
console.log('sirviendo en ' + BASE + ' y en ' + ORIGEN + PREFIJO);

const fallos = [];
let nOk = 0;
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => { nOk++; console.log('  ok     ' + m); };
const comprobar = (cond, m, detalle) => (cond ? ok(m) : mal(m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')));
/* criterio de la spec 001 que aún no se comprueba: no suma a los fallos salvo con --final */
const pendientes = [];
const pendiente = (ca, texto) => {
  pendientes.push(ca + ' · ' + texto);
  console.log('  PENDIENTE  ' + ca + ' · ' + texto);
  if (FINAL) fallos.push('PENDIENTE ' + ca + ' · ' + texto);
};
const cap = async (page, nombre, op) => { if (CAPTURAS) await page.screenshot({ path: path.join(DIR_CAP, nombre + '.png'), ...(op || {}) }); };
const LLAVE = 'casal-cookies';
const sinCookies = () => { try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {} };
const MOVIL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const TIEMPO = { current: { time: '2026-10-16T12:00', cloud_cover_low: 72, precipitation: 0 } };

/* GSAP y Lenis desde una copia local: así la cortina no depende del CDN ese día */
const CDN = {
  'gsap.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
};
const CACHE = path.join(os.tmpdir(), 'neixon-cdn');   // la misma copia que usan las otras webs
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`No se pudo bajar ${u}: ${r.status}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
}
const RE_CDN = /(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

/* Un contexto nuevo (navegador limpio). Movimiento reducido salvo con
   { movimiento: true }, que solo piden las pruebas del movimiento. */
async function nueva(op = {}, { cdn = 'local', script, tiempo = 'ok', movimiento = false, letras = 'vacias' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: movimiento ? 'no-preference' : 'reduce', ...op });
  // el 3D del Pico no se pinta con Playwright (../CLAUDE.md): sin Three.js se queda el dibujo
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@/, (r) => r.abort());
  if (cdn === 'local') await ctx.route(RE_CDN, local);
  if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
  if (cdn === 'lento') await ctx.route(RE_CDN, async (r) => { await new Promise((x) => setTimeout(x, 3000)); await local(r); });
  // las letras de Google, vacías salvo donde se mide texto (las etiquetas del mapa, CA-17)
  if (letras !== 'reales') await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/wa\.me|google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>fuera</p>' }));
  await ctx.route(/api\.open-meteo\.com/, (r) => (tiempo === 'ok' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TIEMPO), headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  if (script) await ctx.addInitScript(script);
  const page = await ctx.newPage();
  page._errores = [];
  page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/open-meteo|ERR_FAILED/.test(m.text())) page._errores.push('consola: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
  return { ctx, page };
}
async function bajarA(page, sel, margen = 0) {
  const top = () => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    for (let i = 0; i < 200; i++) {
      const t = await top();
      if (Math.abs(t - margen) < 30) break;
      await page.mouse.wheel(0, Math.max(-450, Math.min(450, t - margen)));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
    if (Math.abs((await top()) - margen) < 40) break;
  }
  await page.waitForTimeout(300);
}
async function bajarTodo(page) {
  for (let i = 0; i < 400; i++) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(50);
    if (await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)) break;
  }
  await page.waitForTimeout(1400);
}
const esperarCortina = async (page, extra = 500) => {
  await page.waitForFunction(() => { const c = document.getElementById('cortina'); return !c || getComputedStyle(c).display === 'none'; }, null, { timeout: 12000 });
  await page.waitForTimeout(extra);
};

/* ================= 0. archivos ================= */
console.log('\n0. Archivos');
/* Las páginas de CA-1 (spec 001 §10): la portada, las de acogida, los legales y el 404 */
const PAGINAS = ['index.html', 'tu-habitacion/index.html', 'pico-sacro-v2/index.html', 'entorno/index.html',
  'aviso-legal/index.html', 'privacidad/index.html', 'cookies/index.html', 'accesibilidad/index.html', '404.html'];
const URL_DE = (f) => f.replace(/index\.html$/, '');   // 'entorno/index.html' → 'entorno/'
for (const f of PAGINAS) {
  if (!fs.existsSync(path.join(RAIZ, f))) { mal(`${f}: no existe (¿falta node construir.mjs?)`); continue; }
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  // el charset, lo primero del head (tras algún comentario) y en los primeros 1024 bytes
  comprobar(/^<!DOCTYPE html>\s*<html lang="es"[^>]*>\s*<head>\s*(?:<!--[\s\S]*?-->\s*)*<meta charset="utf-8">/.test(s) && Buffer.byteLength(s.slice(0, s.indexOf('<meta charset'))) < 1024, `${f}: el charset es lo primero del head`);
  comprobar(/<meta name="robots" content="noindex,nofollow/.test(s), `${f}: noindex,nofollow`);
  comprobar(!/<!--svg:|<!--panel:|<!--mapa:|<!-- @incluye|\{\{|data-foto="[^"]+"\s[^>]*>(?!<\/picture>)/.test(s.replace(/<picture data-foto="[^"]+">/g, '')), `${f}: sin marcadores de construir.mjs sin expandir`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)].slice(0, 8));
  // los archivos que enlaza existen (rutas relativas a su carpeta; las «/…» del 404, a la raíz)
  const rutas = new Set();
  for (const m of s.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split(/[?#]/)[0];
    if (r && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(r)) rutas.add(r);
  }
  const destino = (r) => { const d = r.startsWith('/') ? path.join(RAIZ, r) : path.join(RAIZ, path.dirname(f), r); return fs.existsSync(d) && fs.statSync(d).isDirectory() ? path.join(d, 'index.html') : d; };
  const faltan = [...rutas].filter((r) => !fs.existsSync(destino(r)));
  comprobar(faltan.length === 0, `${f}: existen los ${rutas.size} archivos y páginas que enlaza`, faltan);
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/logo-oro.png', 'marca/tejado-oro.png'].every((f) => fs.existsSync(path.join(RAIZ, f))), '.nojekyll, 404, manifest, og:image, favicons y piezas del logo');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  // (las fotos del panel de la casa ya no están en main.js: salen de datos/habitaciones.json,
  // y construir.mjs falla si una no está en fotos.json)
  comprobar(/rel="preload" as="image"[^>]*portada-casa-800\.avif/.test(html.replace(/\n\s*/g, ' ')), 'la foto de la portada va precargada');
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  comprobar(!/\b(1|una)( sola| única)? reseña/i.test(texto), 'sin «una reseña»');
  comprobar(!/clientes satisfechos|cientos de|miles de/i.test(texto), 'sin prueba social inventada');
  comprobar(!/sin permanencia|sin cuotas|sin comisiones|mejor precio garantizado/i.test(texto), 'sin condiciones comerciales de reclamo');
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
  comprobar(/TR-CO-000081/.test(texto), 'el número de registro de turismo va en la página');
  comprobar((() => { try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); return true; } catch (e) { return false; } })(), 'el JSON-LD se lee');
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:\s*flex/.test(css), 'cookies: display:flex solo en :not([hidden])');
comprobar(!/scroll-behavior:\s*smooth/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'sin scroll-behavior:smooth (pelearía con Lenis)');
comprobar(/height:\s*100dvh/.test(css.match(/\.menu-movil \{[^}]*\}/)?.[0] || ''), 'menú móvil con altura explícita 100dvh');
comprobar(!/cursor:\s*none/.test(css), 'sin cursor propio (no hay dos cursores)');
comprobar(!/\b100dvh\b/.test(css.replace(/\.menu-movil \{[^}]*\}/, '')), 'dvh solo en la capa fija del menú');
{
  const src = fs.readFileSync(path.join(RAIZ, 'index.src.html'), 'utf8');
  const js = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
  comprobar(/<!-- MANDO DE MAQUETA/.test(src) && /fin del MANDO DE MAQUETA/.test(src) && /\d+\. MANDO DE MAQUETA/.test(js) && /fin del MANDO DE MAQUETA/.test(js), 'receta de borrado del mando: marcas en index.src.html y main.js');
  comprobar(/OPCIONAL «Los papeles de la casa»/.test(src) && /fin OPCIONAL «Los papeles de la casa»/.test(src), 'la sección opcional lleva sus marcas para quitarla');
  // los <script> del CDN viven ahora en los parciales (plan PD-5)
  const scripts = ['scripts.html', 'scripts-portada.html'].map((p) => fs.readFileSync(path.join(RAIZ, 'parciales', p), 'utf8')).join('\n');
  comprobar(/cdn\.jsdelivr\.net\/npm\/@studio-freight\/lenis@1\.0\.42/.test(scripts) && /gsap\/3\.12\.5/.test(scripts), 'GSAP y Lenis con versión fija');
  const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
  comprobar(fotos.every((f) => f.ancho <= f.ancho_origen), 'fotos: ningún tamaño generado por encima del original');
}
{
  /* CA-23 (D-011): ninguna foto de otros alojamientos ni generada con IA, en
     ninguna página. Cada foto que piden las páginas de CA-1 (y los paneles del
     dibujo, que pinta main.js) es de img/fotos/fotos.json, y cada una de esas
     sale de su web, de Booking o de Patricia; ningún texto ni nombre de
     archivo es de los alojamientos que ella recomienda en su página de hoteles. */
  const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
  const nombres = new Set(fotos.map((f) => f.nombre));
  const AJENOS = /Cantaruxa|Cristosende|Torre do R[ií]o|Lar de Donas|Pi[ñn]eiro|Labrada|Casa Camino/i;
  const malas = [];
  for (const f of PAGINAS) {
    const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    if (AJENOS.test(s)) malas.push(`${f}: nombra a otro alojamiento (${s.match(AJENOS)[0]})`);
    for (const m of s.matchAll(/(?:src|srcset|imagesrcset|content)="([^"]+)"/g)) for (const parte of m[1].split(',')) {
      const r = parte.trim().split(/\s+/)[0];
      if (!/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(r) || /^data:/.test(r)) continue;
      const foto = /(?:^|\/)img\/fotos\/(.+)-\d+\.(?:jpg|webp|avif)$/.exec(r.split('?')[0]);
      if (foto) { if (!nombres.has(foto[1])) malas.push(`${f}: ${r} no está en fotos.json`); }
      else if (!/(?:^|\/)(marca\/[^/]+\.png|img\/og\.jpg)$/.test(r.split('?')[0])) malas.push(`${f}: ${r} no es una foto de img/fotos/ ni una pieza del logo`);
    }
  }
  const H = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'habitaciones.json'), 'utf8'));
  for (const [k, z] of Object.entries(H.zonas)) if (z.foto && !nombres.has(z.foto)) malas.push(`habitaciones.json: la foto de «${k}» (${z.foto}) no está en fotos.json`);
  for (const js of fs.readdirSync(path.join(RAIZ, 'js'))) if (AJENOS.test(fs.readFileSync(path.join(RAIZ, 'js', js), 'utf8'))) malas.push(`js/${js}: nombra a otro alojamiento`);
  // las imágenes de fondo de las hojas de estilos, también de img/fotos/ o del logo
  for (const hoja of fs.readdirSync(path.join(RAIZ, 'css'))) for (const m of fs.readFileSync(path.join(RAIZ, 'css', hoja), 'utf8').matchAll(/url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp|avif|gif))/gi)) {
    const foto = /(?:^|\/)img\/fotos\/(.+)-\d+\.(?:jpg|webp|avif)$/.exec(m[1]);
    if (foto ? !nombres.has(foto[1]) : !/(?:^|\/)marca\/[^/]+\.png$/.test(m[1])) malas.push(`css/${hoja}: ${m[1]} no es una foto de fotos.json ni una pieza del logo`);
  }
  for (const f of fotos) if (!/^(web|booking|patricia)\//.test(f.origen) || AJENOS.test(f.origen)) malas.push(`fotos.json: «${f.nombre}» sale de ${f.origen}`);
  comprobar(malas.length === 0, `CA-23 · las ${PAGINAS.length} páginas solo piden fotos de Casa de Casal (su web, Booking o Patricia; ninguna de otros alojamientos ni generada)`, malas);
}
{
  /* CA-24: este mismo script cumple las reglas de Playwright de ../CLAUDE.md
     (lo vigila también pruebas-build.mjs): sin WebGL por software ni esperas
     al 3D, escala 1 en todo, un solo navegador y cerrado en el finally. */
  // (las palabras prohibidas van partidas: si no, este código se encontraría a sí mismo)
  const yo = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const prohibidas = new RegExp(['swift' + 'shader', '--use-' + 'gl', '--use-' + 'angle', '__pico' + '3d'].join('|'));
  const escalas = [...yo.matchAll(/deviceScaleFactor:\s*([\d.]+)/g)].map((m) => +m[1]);
  comprobar(!prohibidas.test(yo) && escalas.length > 0 && escalas.every((e) => e === 1) && (yo.match(/chromium\.launch\(/g) || []).length === 1 && /\}\s*finally\s*\{\s*await browser\.close\(\)/.test(yo),
    'CA-24 · verificar.mjs: sin WebGL por software ni esperas al 3D, escala 1, un navegador y cerrado en el finally', { escalas });
}

/* Un solo navegador para todo el script, cerrado en el finally aunque una
   prueba reviente (CA-24). Sin banderas de WebGL: el 3D no se pinta aquí. */
const browser = await chromium.launch({ headless: true });
try {

/* ================= 1. la cortina (movimiento) ================= */
if (toca(1)) {
console.log('\n1. Cortina');
{
  const { ctx, page } = await nueva({}, { script: sinCookies, movimiento: true });
  await page.addInitScript(() => {
    window.__muestras = [];
    const t0 = performance.now();
    const tomar = () => {
      const c = document.getElementById('cortina');
      if (c) {
        const t = c.querySelector('.cortina__tejado');
        window.__muestras.push({ t: performance.now() - t0, vis: getComputedStyle(c).display !== 'none', p: +getComputedStyle(c).getPropertyValue('--p') || 0, clip: t ? getComputedStyle(t).clipPath : '' });
      }
      if (performance.now() - t0 < 7000) requestAnimationFrame(tomar);
    };
    requestAnimationFrame(tomar);
  });
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForTimeout(1300);
  await cap(page, '01-cortina-a-medias');
  await esperarCortina(page, 300);
  const dur = Date.now() - t0;
  const m = await page.evaluate(() => window.__muestras);
  comprobar(m.length > 20 && m[0].vis, 'la cortina tapa al cargar', m.length);
  comprobar(m.some((x) => /inset\(0(px|%)? (\d|[1-9]\d)\.?\d*% /.test(x.clip) && !/inset\(0(px|%)? 100%/.test(x.clip)), 'el tejado de la C se traza (hay fotogramas a medio dibujar)', m.filter((x, i) => i % 15 === 0).map((x) => x.clip).slice(0, 8));
  comprobar(m.some((x) => x.p > 0.15 && x.p < 0.85), 'la casa se abre desde la cumbrera (fotograma con --p a medias)', m.map((x) => x.p).filter((p) => p > 0).slice(0, 6));
  comprobar(dur > 2000 && dur < 6400, 'la cortina dura entre 2 y 6,4 s', dur);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none' && document.documentElement.classList.contains('cortina-fuera')), 'la cortina desaparece de verdad (display:none)');
  comprobar(await page.evaluate(() => document.getElementById('hero').classList.contains('abierta') && document.querySelector('.hero__tit').classList.contains('es-visto')), 'al abrirse, el titular entra y el tejado del gablete se dibuja');
  comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); c.hidden = false; c.style.display = 'grid'; const a = getComputedStyle(c).backgroundColor; c.style.display = ''; c.hidden = true; return a !== getComputedStyle(document.getElementById('hero')).backgroundColor; }), 'la cortina (cal) es de otro color que la portada (azul noche)');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ reducedMotion: 'reduce' }, { script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(150);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'movimiento reducido: la cortina no se ve ni un fotograma');
  await page.waitForTimeout(600);
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('con-movimiento') && getComputedStyle(document.querySelector('.hero__tit')).opacity === '1'), 'movimiento reducido: el titular se lee sin animación');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { cdn: 'caido', script: sinCookies, movimiento: true });
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin CDN: la cortina se retira');
  comprobar(await page.evaluate(() => document.getElementById('motor').children.length > 0), 'sin CDN: el motor funciona');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { cdn: 'lento', script: sinCookies, movimiento: true });
  await page.goto(BASE);
  await page.waitForTimeout(4200);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'CDN lento: la cortina no se queda puesta');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({ javaScriptEnabled: false });
  await page.goto(BASE);
  await page.waitForTimeout(400);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin JS: no hay cortina');
  await ctx.close();
}

}

/* ================= 2. la portada: el gablete ================= */
if (toca(2)) {
console.log('\n2. Portada');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 1600);
  const i = () => page.evaluate(() => window.__casal.gablete.actual());
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('gablete')).touchAction === 'pan-y'), 'touch-action: pan-y en el gablete');
  const r = await page.evaluate(() => { const b = document.getElementById('gablete').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.move(r.x + r.w * 0.7, r.y + r.h * 0.6);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) { await page.mouse.move(r.x + r.w * (0.7 - k * 0.04), r.y + r.h * 0.6); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  comprobar(await i() === 1, 'arrastrar con el ratón hacia la izquierda pasa a la siguiente foto');
  comprobar(await page.evaluate(() => document.getElementById('gablete-pie').textContent === 'El Pico Sacro, a 1,4 km' && document.querySelectorAll('#gablete-puntos [aria-current="true"]').length === 1), 'el pie y los puntos siguen a la foto');
  await page.focus('#gablete');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  comprobar(await i() === 3, 'teclado (→ →) avanza');
  await page.click('.gablete__btn[data-dir="1"]');
  comprobar(await i() === 0, 'el botón › da la vuelta al principio');
  await page.click('#gablete-puntos button[data-ir="2"]');
  comprobar(await i() === 2, 'los puntos llevan a su foto');
  await cap(page, '02-portada');
  await ctx.close();
}
{
  // toque real (CDP) en el móvil: de lado cambia la foto, de arriba abajo hace scroll
  const { ctx, page } = await nueva(MOVIL, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 1600);
  const cdp = await ctx.newCDPSession(page);
  const toque = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });
  const r = await page.evaluate(() => { const b = document.getElementById('gablete').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await toque('touchStart', r.x + r.w * 0.8, r.y + r.h * 0.6);
  for (let k = 1; k <= 10; k++) { await toque('touchMove', r.x + r.w * (0.8 - k * 0.06), r.y + r.h * 0.6); await page.waitForTimeout(16); }
  await toque('touchEnd', 0, 0);
  await page.waitForTimeout(500);
  comprobar(await page.evaluate(() => window.__casal.gablete.actual()) === 1, 'móvil: el dedo de lado cambia la foto');
  const y0 = await page.evaluate(() => scrollY);
  await toque('touchStart', r.x + r.w * 0.5, r.y + r.h * 0.8);
  for (let k = 1; k <= 10; k++) { await toque('touchMove', r.x + r.w * 0.5, r.y + r.h * 0.8 - k * 22); await page.waitForTimeout(16); }
  await toque('touchEnd', 0, 0);
  await page.waitForTimeout(900);
  comprobar(await page.evaluate(() => scrollY) > y0 + 60 && await page.evaluate(() => window.__casal.gablete.actual()) === 1, 'móvil: el dedo de arriba abajo hace scroll y no cambia la foto');
  await ctx.close();
}

}

/* ================= 3. bajo el tejado ================= */
if (toca(3)) {
console.log('\n3. Habitaciones');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '.seccion', 120);
  comprobar(await page.evaluate(() => document.querySelector('.seccion').classList.contains('es-trazada')), 'el tejado del dibujo se traza al llegar');
  // las nueve zonas fijas ya no aplican: las ventanas salen de datos/habitaciones.json (CA-15, sección 11);
  // las fichas y su «Ver fechas» están en /tu-habitacion/ (CA-13, sección 11)
  await cap(page, '03-habitaciones');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}

}

/* ================= 4. el Pico, hoy ================= */
if (toca(4)) {
console.log('\n4. El Pico');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#pico', 0);
  await page.waitForTimeout(1200);
  const d = await page.evaluate(() => ({ h: document.getElementById('pico-hora').textContent, t: document.getElementById('pico-tramos').textContent, f: document.getElementById('pico-fuente').textContent, r: document.getElementById('pico-refran').textContent, nub: +getComputedStyle(document.getElementById('pico-nubes')).opacity }));
  const mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  comprobar(/^\d\d:\d\d$/.test(d.h) && mins(d.h) > 6 * 60 + 40 && mins(d.h) < 9 * 60 + 20, 'dato en vivo: la hora de salida del sol hoy en Lestedo es creíble', d.h);
  comprobar(/abril/.test(d.t) && /mayo/.test(d.t) && /agosto/.test(d.t), 'el sol por detrás del Pico: finales de abril–mayo y agosto', d.t);
  comprobar(/dato de las 12:00/.test(d.f) && /toquilla/.test(d.r) && d.nub > 0.6, 'el tiempo de la cumbre llega solo al acercarse y pone toquilla con nubes bajas', d);
  comprobar(await page.evaluate(() => !document.querySelector('#pico input, #pico-lluvia-btn') && /72 %/.test(document.getElementById('pico-dato').textContent)), 'sin deslizador ni botones: solo el dato real de nubes');
  // el cielo de ahora: noche de luna llena, amanecer junto al Pico y mediodía
  const noche = await page.evaluate(() => window.__cielo('2025-11-05T23:30:00Z'));
  comprobar(noche.solAlt < -18 && noche.estrellas > 0.9 && noche.luz > 0.97 && noche.lunaVe && /^#0[0-9a-f]/.test(noche.cielo), 'noche de luna llena: cielo oscuro, estrellas y la luna llena en el dibujo', noche);
  const alba = await page.evaluate(() => window.__cielo('2026-05-03T06:40:00Z'));
  comprobar(alba.solAlt > 9 && alba.solAlt < 16 && alba.solVe && alba.estrellas < 0.1, 'el 3 de mayo, a media mañana, el sol asoma sobre el Pico', alba);
  const mediodia = await page.evaluate(() => window.__cielo('2026-10-16T12:30:00Z'));
  comprobar(mediodia.solVe && mediodia.solAlt > 30 && mediodia.estrellas === 0, 'a mediodía el sol está alto, hacia el sur, y es de día', mediodia);
  comprobar(await page.evaluate(() => /^Ahora, a las \d\d:\d\d, en Lestedo es de día\. Luna/.test(document.getElementById('pico-cielo-txt').textContent)), 'el texto dice la hora, el momento del día y la luna', await page.evaluate(() => document.getElementById('pico-cielo-txt').textContent));
  // el 3D (IGN) no se prueba con Playwright (CA-24, ../CLAUDE.md): Three.js no se descarga
  // (nueva() lo corta) y del 3D solo se mira que su contenedor existe; lo demás, a mano (T01, «A mano» 1)
  comprobar(await page.evaluate(() => !!document.getElementById('pico-vista') && !document.querySelector('#pico-vista canvas') && getComputedStyle(document.getElementById('pico-dibujo')).display !== 'none' && document.getElementById('pico-mando3d').hidden), 'el Pico: el contenedor del 3D existe y, sin Three.js, se queda el dibujo del cielo');
  await cap(page, '04-pico');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { script: sinCookies, tiempo: 'caido' });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#pico', 0);
  await page.waitForTimeout(1500);
  comprobar(await page.evaluate(() => /no llega/.test(document.getElementById('pico-dato').textContent) && /se mira al Pico/.test(document.getElementById('pico-refran').textContent)), 'si Open-Meteo falla, lo dice y no inventa refrán');
  await ctx.close();
}

}

/* ================= 5. dos casas en una: anillo y motor ================= */
if (toca(5)) {
console.log('\n5. Anillo y motor de reservas');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#reserva', 0);
  const M = (fn, a) => page.evaluate(fn, a);
  /* Lo que depende del día en que se pasa la prueba (el motor enseña doce
     meses desde hoy, de dos en dos): el ejemplo del arranque, el mes de casa
     entera que se puede abrir, el cambio de temporada a la vista y la Navidad.
     Se elige con los datos del propio motor, nunca con el año escrito a mano. */
  const ej = await M(() => { const { st, esEntera } = window.__motor; return { ini: st.ini, fin: st.fin, entera: !!st.ini && esEntera(st.ini), habs: Object.values(st.sel).reduce((a, b) => a + b, 0), modo: document.querySelector('.motor__modo').textContent }; });
  comprobar(ej.ini && ej.fin && (ej.entera ? ej.habs === 0 && /Casa entera/.test(ej.modo) : ej.habs >= 1 && /Habitaciones/.test(ej.modo)), 'el motor arranca con el próximo fin de semana libre de ejemplo: con una habitación propuesta o, en su temporada, la casa entera', ej);
  // el anillo lleva el calendario a un mes de casa entera (noviembre; en diciembre, cuando noviembre ya no se abre, enero)
  let mesEntera = null;
  for (const m of [10, 0, 1]) {
    await page.click(`#anyo-meses button:nth-child(${m + 1})`);
    await page.waitForTimeout(300);
    if (await M((x) => window.__motor.st.m === x, m)) { mesEntera = m; break; }
  }
  const nombreMes = mesEntera === null ? null : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mesEntera];
  const nov = await M(() => ({ tit: document.querySelector('#motor .mes__tit').textContent, modo: document.querySelector('.motor__modo').textContent, an: document.getElementById('anyo-modo').textContent }));
  comprobar(nombreMes && new RegExp(nombreMes).test(nov.tit) && /Casa entera/.test(nov.modo) && /hasta 22/.test(nov.an), `el anillo lleva el calendario a ${nombreMes ? nombreMes.toLowerCase() : 'un mes de casa entera'}, en modo casa entera`, nov);
  // dos noches libres seguidas en ese mes (sin mes abierto o sin dos noches libres, falla aquí y sigue)
  const par = nombreMes && await M((mm) => { const b = Array.from(document.querySelectorAll('#motor .dia[data-k]')).filter((x) => x.dataset.k.slice(5, 7) === mm); for (let i = 0; i < b.length - 2; i++) { const k = b[i].dataset.k; if (window.__motor.rangoPosible(k, b[i + 2].dataset.k)) return [k, b[i + 1].dataset.k, b[i + 2].dataset.k]; } return null; }, String(mesEntera + 1).padStart(2, '0'));
  if (par) {
    await page.click(`#motor [data-k="${par[0]}"]`); await page.click(`#motor [data-k="${par[2]}"]`);
    const e2 = await M(() => document.querySelector('.motor__res').textContent);
    comprobar(/1\.190 €/.test(e2) && /298 €/.test(e2) && /casa grande/i.test(e2), 'casa entera, 2 noches: 1.190 € y anticipo de 298 €', par);
    await page.click(`#motor [data-k="${par[0]}"]`); await page.click(`#motor [data-k="${par[1]}"]`);
    comprobar(/675 €/.test(await M(() => document.querySelector('.motor__res').textContent)), 'casa entera, 1 noche: 675 €');
    comprobar(await M(() => !document.querySelector('.motor__filtro') && !document.querySelector('.motor__habs')), 'en casa entera no hay filtro ni lista de habitaciones');
  } else mal('casa entera: no hay a la vista un mes de casa entera con dos noches libres seguidas (sin comprobar los precios)');
  // cruzar de temporada: la última noche libre de una temporada y una salida libre de la otra, en el
  // primer cambio que se vea entero (31 de octubre → noviembre o 31 de marzo → abril, según casa.json)
  const CASA_T = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'casa.json'), 'utf8')).temporadas;
  let cruce = null;
  for (const [antes, despues] of [[CASA_T.habitaciones.hasta, CASA_T.entera.desde], [CASA_T.entera.hasta, CASA_T.habitaciones.desde]]) {
    const m = +antes.slice(0, 2) - 1;
    await M((x) => window.CASALmotor.irMes(x), m);
    cruce = await M(([x, mmA, mmD]) => {
      const { st, nocheLibre, esEntera } = window.__motor;
      if (st.m !== x) return null;   // ese mes no se abre todavía (le falta el siguiente)
      const dias = Array.from(document.querySelectorAll('#motor .dia[data-k]')).map((b) => b.dataset.k);
      const ini = dias.filter((k) => k.slice(5, 7) === mmA.slice(0, 2) && k.slice(5) <= mmA && nocheLibre(k)).pop();
      const fin = dias.find((k) => k.slice(5, 7) === mmD.slice(0, 2) && k.slice(5) > mmD && nocheLibre(k) && esEntera(k) !== esEntera(ini || k));
      return ini && fin ? [ini, fin] : null;
    }, [m, antes, despues]);
    if (cruce) break;
  }
  if (cruce) {
    await page.click(`#motor [data-k="${cruce[0]}"]`); await page.click(`#motor [data-k="${cruce[1]}"]`);
    comprobar(/cambio de temporada/.test(await M(() => document.querySelector('#motor .motor__msg').textContent)), `cruzar de temporada (${cruce.join(' → ')}) avisa del cambio de temporada`);
  } else mal('cruce de temporada: no hay a la vista ningún cambio de temporada con noches libres a los dos lados');
  // Navidad cerrada: el diciembre que se vea (con noviembre delante si diciembre todavía no se abre)
  let navidad = null;
  for (const m of [11, 10]) {
    await M((x) => window.CASALmotor.irMes(x), m);
    navidad = await M(() => { const b = document.querySelector('#motor [data-k$="-12-24"]'); return b ? { k: b.dataset.k, dis: b.getAttribute('aria-disabled'), et: b.getAttribute('aria-label') } : null; });
    if (navidad) break;
  }
  comprobar(navidad && navidad.dis === 'true' && /cerrad/.test(navidad.et), 'el 24 de diciembre sale cerrado', navidad);
  // habitaciones: una clásica dos noches en el próximo mes de habitaciones
  await M(() => window.CASALmotor.elegirTipo('clasica'));
  await page.waitForTimeout(200);
  const hab = await M(() => ({ st: JSON.parse(JSON.stringify(window.__motor.st)), txt: document.querySelector('.motor__res').textContent }));
  comprobar(hab.st.filtro === 'clasica' && hab.st.sel.clasica === 1 && /116 €/.test(hab.txt) && /29 €/.test(hab.txt), 'una clásica 2 noches: 116 € y anticipo de 29 €', hab.st.sel);
  // pasos
  await page.click('#motor [data-acc="seguir"]');
  await page.click('#motor button[type="submit"]');
  comprobar(/Falta el nombre, un correo válido, un móvil/.test(await M(() => document.getElementById('m-error').textContent)) && await M(() => document.activeElement.id === 'm-nombre'), 'datos: avisa de lo que falta y pone el foco en el primero');
  await page.fill('#m-nombre', 'Lucía Prueba'); await page.fill('#m-correo', 'lucia@ejemplo.es'); await page.fill('#m-tel', '600 000 000'); await page.check('#m-ok');
  await page.click('#motor button[type="submit"]');
  comprobar(/Anticipo ahora \(25 %\)29 €/.test(await M(() => document.querySelector('.motor__res').textContent.replace(/\s+/g, ''))) || /29 €/.test(await M(() => document.querySelector('.motor__res').textContent)), 'pago: se cobra solo el anticipo');
  await page.click('#m-bizum'); await page.click('#motor [data-acc="pagar"]');
  comprobar(/^CDC-\d{6}-\d{3}$/.test(await M(() => document.querySelector('.confirmacion__loc').textContent)), 'confirmación con localizador CDC-…');
  comprobar(/no se ha enviado ni cobrado nada/.test(await M(() => document.querySelector('.confirmacion').textContent)), 'la confirmación dice que es una demostración');
  await cap(page, '05-motor');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}

}

/* ================= 6. cabecera, cookies y pie (el tejado de la cabecera se mueve con el scroll) ================= */
if (toca(6)) {
console.log('\n6. Cabecera, cookies y pie');
{
  const { ctx, page } = await nueva({}, { movimiento: true });
  await page.goto(BASE);
  await esperarCortina(page);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cookies')).display === 'flex'), 'cookies: se ven en la primera visita');
  await page.click('#ck-si');
  comprobar(await page.evaluate((k) => getComputedStyle(document.getElementById('cookies')).display === 'none' && localStorage.getItem(k) === 'si', LLAVE), 'cookies: «Entendido» las cierra y lo recuerda');
  await page.reload(); await esperarCortina(page);
  comprobar(await page.evaluate(() => document.getElementById('cookies').hidden), 'cookies: al recargar no vuelven');
  await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
  await page.reload(); await esperarCortina(page);
  comprobar(await page.evaluate(() => !document.getElementById('cookies').hidden), 'cookies: borrando la marca vuelven a salir');
  await page.click('#ck-no');
  await bajarA(page, '#casa', -300);
  const est = await page.evaluate(() => ({ p: +getComputedStyle(document.querySelector('.cab__lectura')).getPropertyValue('--p'), clara: document.getElementById('cab').classList.contains('es-clara') }));
  comprobar(est.p > 0.03 && est.clara, 'el tejado de la cabecera se dora al bajar y la cabecera pasa a clara sobre «La casa»', est);
  await bajarA(page, '#habitaciones', -300);
  comprobar(await page.evaluate(() => document.getElementById('cab').classList.contains('es-oscura')), 'y a oscura sobre las habitaciones');
  // la regla de minutos ya no está en la portada (está en /entorno/): lo que se mira de las etiquetas es el mapa (CA-17, sección 12)
  await bajarTodo(page);
  comprobar(await page.evaluate(() => document.getElementById('pie').classList.contains('es-posado') && +getComputedStyle(document.querySelector('.cab__lectura')).getPropertyValue('--p') > 0.97), 'al llegar al pie, el tejado se posa sobre la C y el de la cabecera está entero');
  await page.click('#abrir-cookies');
  comprobar(await page.evaluate(() => !document.getElementById('cookies').hidden), '«Preferencias de cookies» vuelve a abrir el aviso');
  await page.click('#ck-si');
  await page.click('#mapa-btn');
  comprobar(await page.evaluate(() => !!document.querySelector('#mapa iframe') && !document.getElementById('mapa-consent')), 'el mapa de Google solo se carga al pedirlo');
  await cap(page, '06-pie');
  await ctx.close();
}

}

/* ================= 7. móvil ================= */
if (toca(7)) {
console.log('\n7. Móvil');
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
  const { ctx, page } = await nueva({ ...MOVIL, viewport: { width: w, height: h } }, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page, 1200);
  const g = await page.evaluate(() => {
    const t = document.querySelector('.hero__txt').getBoundingClientRect();
    const v = document.getElementById('gablete').getBoundingClientRect();
    const cab = document.getElementById('cab').getBoundingClientRect();
    return { ancho: document.documentElement.scrollWidth, vw: innerWidth, solapa: !(v.bottom <= t.top + 1 || t.bottom <= v.top + 1), bajoCab: v.top >= cab.bottom - 30 };
  });
  comprobar(g.ancho <= g.vw, `${w}×${h}: sin scroll horizontal`, g);
  comprobar(!g.solapa && g.bajoCab, `${w}×${h}: la foto de la portada y el texto no se pisan, y la foto queda bajo la cabecera`, g);
  if (w === 390) {
    await bajarA(page, '#casa', -200);
    await page.waitForTimeout(700);
    comprobar(await page.evaluate(() => document.getElementById('barra').classList.contains('es-visible')), 'la barra fija del móvil sale al dejar la portada');
    await page.click('#menu-btn');
    await page.waitForTimeout(500);
    const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { h: r.height, vh: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
    comprobar(mm.vis === 'visible' && Math.abs(mm.h - mm.vh) < 2, 'el menú móvil abre a pantalla completa con la cabecera ya fija', mm);
    await page.click('#menu-movil a[href="./#finca"], #menu-movil a[href="#finca"]');
    await page.waitForTimeout(1800);
    comprobar(await page.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.getElementById('finca').getBoundingClientRect().top - 80) < 70), 'un enlace del menú cierra el menú y lleva a su sección', await page.evaluate(() => Math.round(document.getElementById('finca').getBoundingClientRect().top)));
    await bajarA(page, '#motor', 80);
    comprobar(await page.evaluate(() => !document.getElementById('barra').classList.contains('es-visible')), 'la barra se aparta sobre el motor de reservas');
    await cap(page, '07-motor-390');
  }
  comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores);
  await ctx.close();
}
{
  // la barra del navegador del móvil sube y baja: nada se rehace ni salta
  const { ctx, page } = await nueva(MOVIL, { movimiento: true, script: () => { try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {} window.__refrescos = 0; addEventListener('DOMContentLoaded', () => { const t = setInterval(() => { if (window.ScrollTrigger) { ScrollTrigger.addEventListener('refresh', () => window.__refrescos++); clearInterval(t); } }, 20); }); } });
  await page.goto(BASE);
  await esperarCortina(page, 1500);
  await bajarA(page, '#finca', 0);
  const n0 = await page.evaluate(() => window.__refrescos);
  const top0 = await page.evaluate(() => document.getElementById('pico').getBoundingClientRect().top + scrollY);
  for (let i = 0; i < 6; i++) { await page.setViewportSize({ width: 390, height: i % 2 ? 844 : 788 }); await page.waitForTimeout(260); }
  await page.waitForTimeout(500);
  const n1 = await page.evaluate(() => window.__refrescos);
  const top1 = await page.evaluate(() => document.getElementById('pico').getBoundingClientRect().top + scrollY);
  comprobar(n1 === n0, 'barra del móvil: 0 refresh de ScrollTrigger en 6 cambios', [n0, n1]);
  comprobar(Math.abs(top1 - top0) < 1, 'barra del móvil: nada se mueve de sitio', [top0, top1]);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  comprobar(await page.evaluate(() => window.__refrescos) > n1, 'al girar el móvil sí se rehace');
  await ctx.close();
}

}

/* ================= 8. densidades, foco, fotos y contraste ================= */
if (toca(8)) {
console.log('\n8. Densidades, foco, fotos y contraste');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  comprobar(await page.evaluate(() => document.getElementById('mando').hidden && getComputedStyle(document.getElementById('mando')).display === 'none'), 'sin ?revision el mando no se ve');
  await page.goto(BASE + '?revision');
  await esperarCortina(page);
  comprobar(await page.evaluate(() => !document.getElementById('mando').hidden), 'con ?revision el mando se ve');
  await page.click('#mando [data-densidad="sobria"]');
  // la tabla de las habitaciones ya no depende de la densidad: está en /tu-habitacion/ (spec 001 §9);
  // las fotos de «La casa» son ahora el carrusel de estancias
  const s = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), url: location.search, clip: getComputedStyle(document.querySelector('.estancias__pista')).clipPath }));
  comprobar(s.cls && /densidad=sobria/.test(s.url) && s.clip === 'none', 'la sobria: fotos rectas', s);
  await page.click('#mando [data-densidad="cargada"]');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && /polygon/.test(getComputedStyle(document.querySelector('.estancias__pista')).clipPath)), '«Bajo el tejado» vuelve a las fotos con gablete');
  // foco con la cumbrera del tejado
  await page.goto(BASE);
  await esperarCortina(page);
  await page.focus('.hero__acc .btn');
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  const foco = await page.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e), a = getComputedStyle(e, '::before'); return { tag: e.tagName, o: c.outlineStyle, antes: a.content, clip: a.clipPath }; });
  comprobar(foco.o === 'solid' && foco.antes === '""' && /polygon/.test(foco.clip), 'el foco del teclado lleva encima la cumbrera del tejado', foco);
  // fotos: ninguna pintada por encima de su ancho original
  await bajarTodo(page);
  const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
  const orig = Object.fromEntries(fotos.map((f) => [f.nombre, f.ancho_origen]));
  const grandes = await page.evaluate((orig) => Array.from(document.querySelectorAll('picture[data-foto] img')).map((i) => ({ n: i.parentElement.dataset.foto, w: Math.round(i.getBoundingClientRect().width), vis: i.getBoundingClientRect().width > 0 })).filter((x) => x.vis && x.w > orig[x.n] * 1.05), orig);
  comprobar(grandes.length === 0, 'ninguna foto se pinta más ancha que su original (1440 px)', grandes);
  // contraste (WCAG 2) de las parejas que se usan
  const lum = (h) => { const c = h.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const tok = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
  const parejas = [['tinta', 'cal', 4.5], ['tinta-2', 'cal', 4.5], ['oro-texto', 'cal', 4.5], ['tinta-2', 'cal-2', 4.5], ['oro-texto', 'cal-2', 4.5], ['cal', 'noche', 4.5], ['cal-3', 'noche', 4.5], ['oro-claro', 'noche', 4.5], ['oro', 'noche', 4.5], ['cal-3', 'noche-2', 4.5], ['oro-claro', 'noche-2', 4.5], ['cal-3', 'noche-3', 4.5], ['noche', 'oro-claro', 4.5], ['pino', 'niebla', 4.5], ['musgo', 'niebla', 4.5], ['tinta-2', 'niebla', 4.5], ['cal', 'tinta', 4.5]];
  const malas = parejas.map(([a, b, min]) => [a, b, Math.round(cr(tok[a], tok[b]) * 100) / 100, min]).filter((p) => !(p[2] >= p[3]));
  comprobar(malas.length === 0, `contraste: las ${parejas.length} parejas de texto pasan 4,5:1`, malas);
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}
{
  // páginas legales y 404
  const { ctx, page } = await nueva();
  for (const f of ['aviso-legal/', 'privacidad/', 'cookies/', 'accesibilidad/', '404.html']) {
    await page.goto(BASE + f);
    comprobar(await page.evaluate(() => document.querySelector('h1') && document.body.scrollWidth <= innerWidth), `${f} se abre y no desborda`);
  }
  comprobar(page._errores.length === 0, 'legales: sin errores', page._errores);
  await ctx.close();
}

}

/* ================= 9. el prefijo del escaparate, la 404 y las cookies entre páginas ================= */
if (toca(9)) {
console.log('\n9. Prefijo del escaparate, 404 y cookies entre páginas');
const PASADAS = [['sin prefijo', '/'], ['con el prefijo ' + PREFIJO, PREFIJO]];   // las dos, en el mismo navegador (§9)
const soloEstados = (errores) => errores.filter((e) => /^\d{3} /.test(e));
for (const [nombre, pre] of PASADAS) {
  // CA-3: ninguna petición da 404 en las páginas de CA-1, y con el prefijo nada se pide fuera de él
  const { ctx, page } = await nueva({}, { script: sinCookies });
  const fuera = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.origin === ORIGEN && !u.pathname.startsWith(pre)) fuera.push(u.pathname); });
  const malas = {};
  for (const f of PAGINAS.filter((x) => x !== '404.html')) {
    page._errores.length = 0; fuera.length = 0;
    const r = await page.goto(ORIGEN + pre + URL_DE(f));
    // las fotos en diferido también se piden, sin tener que bajar por toda la página
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const e = soloEstados(page._errores);
    if (r.status() !== 200 || e.length || fuera.length) malas[pre + URL_DE(f)] = { estado: r.status(), errores: e, fueraDelPrefijo: [...fuera] };
  }
  comprobar(Object.keys(malas).length === 0, `CA-3 · ${nombre}: ninguna petición da 404 en las ${PAGINAS.length - 1} páginas`, malas);
  // CA-2 bis: la 404 de una subcarpeta, con sus estilos y su logo, y «Volver a la portada» a la portada buena
  const r = await page.goto(ORIGEN + pre + 'tu-habitacion/no-existe');
  const no = await page.evaluate(() => {
    const logo = document.querySelector('.no__tejado'), b = getComputedStyle(document.body);
    return { h1: document.querySelector('h1')?.textContent.trim(), logo: !!logo && logo.complete && logo.naturalWidth > 0 && logo.getBoundingClientRect().width > 60, fondo: b.backgroundColor, margen: b.marginTop };
  });
  comprobar(r.status() === 404 && no.logo && no.fondo === 'rgb(18, 26, 36)' && no.margen === '0px', `CA-2 bis · ${nombre}: /tu-habitacion/no-existe sirve la 404 (estado 404) con sus estilos y su logo`, { estado: r.status(), ...no });
  await page.click('.no a.btn');
  await page.waitForURL((u) => u.pathname === pre, { timeout: 8000 }).catch(() => {});
  const vuelta = await page.evaluate(() => ({ ruta: location.pathname, portada: !!document.getElementById('hero') }));
  comprobar(vuelta.ruta === pre && vuelta.portada, `CA-2 bis · ${nombre}: «Volver a la portada» lleva a la portada`, vuelta);
  await ctx.close();
}
{
  // el servidor se porta como Pages: /x → /x/ y una carpeta sirve su index.html
  const r = await fetch(ORIGEN + PREFIJO + 'entorno', { redirect: 'manual' });
  comprobar(r.status === 301 && r.headers.get('location') === PREFIJO + 'entorno/', 'el servidor imita a Pages: /entorno redirige a /entorno/', [r.status, r.headers.get('location')]);
}
{
  // CA-5: aceptar las cookies en /entorno/ vale también para la portada
  const { ctx, page } = await nueva();
  await page.goto(BASE + 'entorno/');
  await page.waitForSelector('#cookies:not([hidden])', { timeout: 8000 }).catch(() => {});
  const antes = await page.evaluate(() => !document.getElementById('cookies').hidden);
  await page.click('#ck-si');
  await page.goto(BASE);
  await esperarCortina(page, 800);
  const despues = await page.evaluate(() => !document.getElementById('cookies').hidden);
  comprobar(antes && !despues, 'CA-5 · aceptar las cookies en /entorno/ y abrir la portada: el aviso no sale', { enEntorno: antes, enPortada: despues });
  await ctx.close();
}

}

/* ================= 10. el anillo con otra piscina y el carrusel de estancias ================= */
if (toca(10)) {
console.log('\n10. Anillo con otra piscina y carrusel de estancias');
{
  /* CA-12: con hasta=09-30 en una copia de casa.json, el anillo cambia. La
     portada se pide con la copia: pruebas-build.mjs ya prueba que construir
     con ella solo cambia el JSON de datos-casa y los dos textos de la piscina,
     así que aquí basta con servir la portada de siempre con ese JSON cambiado. */
  const f2 = (n) => Math.round(n * 100) / 100;
  const pol = (r, mes) => { const a = (mes / 12) * 2 * Math.PI - Math.PI / 2; return `${f2(220 + r * Math.cos(a))} ${f2(220 + r * Math.sin(a))}`; };
  const fin = (mmdd) => { const [m, d] = mmdd.split('-').map(Number); return Math.round((m - 1 + d / new Date(2001, m, 0).getDate()) * 20) / 20; };
  const arco = (page) => page.evaluate(() => { const p = [...document.querySelectorAll('#anyo-rueda path')].find((x) => x.getAttribute('stroke') === '#7fb0a5'); return p ? p.getAttribute('d') : null; });
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  const hoy = await arco(page);
  let cambiado = false;
  await ctx.route((u) => u.origin === ORIGEN && u.pathname === '/', async (r) => {
    const res = await r.fetch();
    const html = (await res.text()).replace(/("piscina":\{"desde":"\d\d-\d\d","hasta":)"09-20"/, (m, a) => { cambiado = true; return a + '"09-30"'; });
    await r.fulfill({ response: res, body: html });
  });
  await page.goto(BASE);
  const copia = await arco(page);
  // la piscina es el tercer aro (radio 152): acaba al final del 20 de septiembre (8,65) o del 30 (9,0)
  comprobar(cambiado && hoy && hoy.endsWith(pol(152, fin('09-20'))) && copia && copia.endsWith(pol(152, fin('09-30'))), 'CA-12 · con hasta=09-30 en una copia de casa.json, el aro de la piscina del anillo acaba a fin de septiembre (9,0 y no 8,65)', { cambiado, hoy, copia });
  comprobar(page._errores.length === 0, 'CA-12 · sin errores', page._errores);
  await ctx.close();
}
{
  // CA-14: 7 fotos; flechas, botones y puntos; el pie dice la foto que se ve y se anuncia (aria-live)
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#estancias', 140);
  const est = () => page.evaluate(() => {
    const pie = document.getElementById('estancias-pie');
    return { i: window.__casal.estancias.actual(), pie: pie.textContent, cap: document.querySelector('.estancias__foto.on figcaption')?.textContent, leibles: document.querySelectorAll('.estancias__foto:not([aria-hidden="true"])').length };
  });
  const base = await page.evaluate(() => ({ n: document.querySelectorAll('#estancias .estancias__foto').length, puntos: document.querySelectorAll('#estancias-puntos button').length, vivo: document.getElementById('estancias-pie').getAttribute('aria-live') }));
  comprobar(base.n === 7 && base.puntos === 7 && base.vivo === 'polite', 'CA-14 · el carrusel tiene 7 fotos y 7 puntos, y su pie se anuncia (aria-live)', base);
  const pasos = [];
  const anotar = async (como, esperado) => { const e = await est(); pasos.push({ como, ...e, esperado }); };
  await page.focus('#estancias');
  await page.keyboard.press('ArrowRight'); await anotar('→', 1);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await anotar('← ←', 6);
  await page.click('.estancias__btn[data-dir="1"]'); await anotar('›', 0);
  await page.click('.estancias__btn[data-dir="-1"]'); await anotar('‹', 6);
  await page.click('#estancias-puntos button[data-ir="3"]'); await anotar('punto 4', 3);
  const malos = pasos.filter((p) => p.i !== p.esperado || p.pie !== p.cap || !p.pie || p.leibles !== 1);
  comprobar(malos.length === 0, 'CA-14 · flechas del teclado, botones y puntos cambian la foto, y el pie dice la que se ve (solo esa la lee el lector)', malos.length ? malos : undefined);
  comprobar(page._errores.length === 0, 'CA-14 · sin errores', page._errores);
  await ctx.close();
}
{
  // CA-14: deslizar con el dedo (toque real por CDP, como en el gablete); de arriba abajo, scroll
  const { ctx, page } = await nueva(MOVIL, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#estancias', 160);
  const cdp = await ctx.newCDPSession(page);
  const toque = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y }] });
  const r = await page.evaluate(() => { const b = document.getElementById('estancias').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await toque('touchStart', r.x + r.w * 0.85, r.y + r.h * 0.5);
  for (let k = 1; k <= 10; k++) { await toque('touchMove', r.x + r.w * (0.85 - k * 0.06), r.y + r.h * 0.5); await page.waitForTimeout(16); }
  await toque('touchEnd', 0, 0);
  await page.waitForTimeout(400);
  const lado = await page.evaluate(() => ({ i: window.__casal.estancias.actual(), pie: document.getElementById('estancias-pie').textContent, cap: document.querySelector('.estancias__foto.on figcaption')?.textContent }));
  comprobar(lado.i === 1 && lado.pie === lado.cap, 'CA-14 · móvil: el dedo de lado pasa a la siguiente foto y el pie la sigue', { ...lado, caja: r });
  const y0 = await page.evaluate(() => scrollY);
  await toque('touchStart', r.x + r.w * 0.5, r.y + r.h * 0.8);
  for (let k = 1; k <= 10; k++) { await toque('touchMove', r.x + r.w * 0.5, r.y + r.h * 0.8 - k * 18); await page.waitForTimeout(16); }
  await toque('touchEnd', 0, 0);
  await page.waitForTimeout(600);
  comprobar(await page.evaluate(() => scrollY) > y0 + 60 && await page.evaluate(() => window.__casal.estancias.actual()) === 1, 'CA-14 · móvil: el dedo de arriba abajo hace scroll y no cambia la foto');
  await ctx.close();
}

}

/* ================= 11. el dibujo de la casa y «Ver fechas» de /tu-habitacion/ ================= */
if (toca(11)) {
console.log('\n11. Dibujo de la casa y «Ver fechas»');
{
  // CA-15: cada ventana abre su panel, con lo que dice datos/habitaciones.json (con el ratón y con Intro)
  const H = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'habitaciones.json'), 'utf8'));
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '.seccion', 120);
  const ks = await page.$$eval('.seccion .zona', (gs) => gs.map((g) => g.dataset.k));
  const malas = [];
  for (const [n, k] of ks.entries()) {
    if (n % 2) { await page.focus(`.seccion .zona[data-k="${k}"]`); await page.keyboard.press('Enter'); }
    else await page.locator(`.seccion .zona[data-k="${k}"] .hueco`).first().click();   // en su ventana: el centro de una zona de dos ventanas cae en el muro
    const p = await page.evaluate((x) => {
      const ficha = document.querySelector('#seccion-panel .seccion__ficha');
      return { zona: ficha?.dataset.zona, nombre: document.getElementById('sp-nombre')?.textContent, habs: [...document.querySelectorAll('#seccion-panel .seccion__habs li b')].map((b) => b.textContent), texto: document.getElementById('sp-texto')?.textContent || '', activa: document.querySelector(`.seccion .zona[data-k="${x}"]`).classList.contains('activa') };
    }, k);
    const z = H.zonas[k];
    const bien = z && p.zona === k && p.activa && p.nombre === z.titulo
      && (z.habitaciones.length ? p.habs.length === z.habitaciones.length && z.habitaciones.every((h, i) => h.nombre === p.habs[i]) : p.habs.length === 0 && p.texto.length > 0 && p.texto === z.frase.trim());
    if (!bien) malas.push({ k, como: n % 2 ? 'Intro' : 'clic', ...p });
  }
  comprobar(ks.length === Object.keys(H.zonas).length && malas.length === 0, `CA-15 · las ${ks.length} ventanas del dibujo abren su panel con una habitación o estancia de habitaciones.json (clic e Intro)`, malas.length ? malas : ks);
  comprobar(page._errores.length === 0, 'CA-15 · sin errores', page._errores);
  await ctx.close();
}
{
  // CA-13: el «Ver fechas» de cada ficha de /tu-habitacion/ abre el motor de la portada con su tipo elegido
  const { ctx, page } = await nueva({}, { script: sinCookies });
  const malas = [];
  const tipos = ['clasica', 'confort', 'torre', 'terraza', 'familiar'];
  for (const tipo of tipos) {
    await page.goto(BASE + 'tu-habitacion/');
    await page.click(`a[href="../?tipo=${tipo}#reserva"]`);
    await page.waitForURL((u) => u.pathname === '/' && u.searchParams.get('tipo') === tipo && u.hash === '#reserva', { timeout: 8000 }).catch(() => {});
    await page.waitForLoadState('load');
    await page.waitForFunction(() => { const r = document.getElementById('reserva').getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > 0; }, null, { timeout: 4000 }).catch(() => {});
    const m = await page.evaluate((x) => {
      const st = window.__motor?.st;
      const r = document.getElementById('reserva').getBoundingClientRect();
      return { url: location.pathname + location.search + location.hash, filtro: st?.filtro, sel: st?.sel[x] || 0, noches: st?.ini && st?.fin ? 1 : 0, chip: document.querySelector(`#motor .motor__filtro [data-filtro="${x}"]`)?.getAttribute('aria-pressed'), aLaVista: r.top < innerHeight * 0.5 && r.bottom > 0 };
    }, tipo);
    if (!(m.filtro === tipo && m.sel >= 1 && m.noches && m.chip === 'true' && m.aLaVista)) malas.push({ tipo, ...m });
  }
  comprobar(malas.length === 0, `CA-13 · los ${tipos.length} «Ver fechas» de /tu-habitacion/ abren el motor de la portada con su tipo elegido y una habitación propuesta`, malas);
  comprobar(page._errores.length === 0, 'CA-13 · sin errores', page._errores);
  await ctx.close();
}

}

/* ================= 12. las leyendas de /pico-sacro-v2/ y el mapa de alrededores ================= */
if (toca(12)) {
console.log('\n12. Leyendas del Pico y mapa de alrededores');
{
  // CA-16: las pestañas de las leyendas, con el teclado (flechas que dan la vuelta, una sola en el Tab)
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE + 'pico-sacro-v2/');
  const L = () => page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#leyendas-lista [role="tab"]')];
    const sel = tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    return { n: tabs.length, foco: tabs.indexOf(document.activeElement), sel, enTab: tabs.filter((b) => b.tabIndex === 0).length, tit: document.querySelector('#leyendas-hojas [role="tabpanel"]:not([hidden]) h3')?.textContent, nombre: tabs[sel]?.textContent };
  });
  const pasos = [];
  await page.focus('#leyenda-0');
  for (const [tecla, esperado] of [['ArrowDown', 1], ['ArrowRight', 2], ['ArrowUp', 1], ['ArrowLeft', 0], ['ArrowUp', 5], ['ArrowDown', 0]]) {
    await page.keyboard.press(tecla);
    pasos.push({ tecla, esperado, ...(await L()) });
  }
  const malos = pasos.filter((p) => p.n !== 6 || p.foco !== p.esperado || p.sel !== p.esperado || p.enTab !== 1 || p.tit !== p.nombre);
  comprobar(malos.length === 0, 'CA-16 · /pico-sacro-v2/: las 6 leyendas se recorren con las flechas (dan la vuelta) y la hoja dice la elegida', malos.length ? malos : undefined);
  await page.keyboard.press('Tab');
  comprobar(await page.evaluate(() => !document.activeElement.closest('#leyendas-lista')), 'CA-16 · el Tab sale de la lista de leyendas (solo la elegida entra en el orden del Tab)');
  comprobar(page._errores.length === 0, 'CA-16 · sin errores', page._errores);
  await ctx.close();
}
{
  /* CA-17: a 360, 390 y 1280 px ninguna caja de etiqueta se pisa con otra ni
     se sale del dibujo (con Hanken Grotesk de verdad, como etiquetas-mapa.mjs),
     y al cargar el mapa no se pide nada a otro dominio: solo salen a fuera las
     letras, GSAP y Lenis, el tiempo del Pico y Three.js (que aquí se corta). */
  const AFUERA = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|api\.open-meteo\.com)$/;
  const VISTAS = [[360, 'estrecho'], [390, 'estrecho'], [1280, 'ancho']];
  for (const pagina of ['', 'entorno/']) {
    const { ctx, page } = await nueva({ viewport: { width: 1280, height: 800 } }, { script: sinCookies, letras: 'reales' });
    const fuera = new Set();
    page.on('request', (q) => { const u = new URL(q.url()); if (u.origin !== ORIGEN && !/^(data|blob):/.test(q.url()) && !AFUERA.test(u.host)) fuera.add(u.host + u.pathname); });
    await page.goto(BASE + pagina);
    await esperarCortina(page, 200);
    await bajarA(page, '.alr-mapa', 120);
    const letra = await page.evaluate(async () => {
      await Promise.all(['500', '600'].map((w) => document.fonts.load(`${w} 16px "Hanken Grotesk"`).catch(() => {})));
      await document.fonts.ready;
      return ['500', '600'].every((w) => document.fonts.check(`${w} 16px "Hanken Grotesk"`));
    });
    const informes = [];
    for (const [ancho, disp] of VISTAS) {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      informes.push({ ancho, ...(await page.evaluate((esperada) => {
        const svgs = [...document.querySelectorAll('.alr-mapa__svg')].filter((s) => getComputedStyle(s).display !== 'none');
        if (svgs.length !== 1) return { error: `se ven ${svgs.length} mapas` };
        const svg = svgs[0];
        if (svg.dataset.disposicion !== esperada) return { error: `se ve el ${svg.dataset.disposicion}, no el ${esperada}` };
        const marco = svg.getBoundingClientRect();
        const etq = [...svg.querySelectorAll('[data-marca]')].map((g) => ({ id: g.dataset.marca, r: g.querySelector('.alr-mapa__etq').getBoundingClientRect() }));
        const choques = [], fuera = [];
        for (let i = 0; i < etq.length; i++) {
          const a = etq[i].r;
          if (a.left < marco.left || a.top < marco.top || a.right > marco.right || a.bottom > marco.bottom) fuera.push(etq[i].id);
          for (let j = i + 1; j < etq.length; j++) {
            const b = etq[j].r;
            if (Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom) < 0) choques.push(`${etq[i].id}/${etq[j].id}`);
          }
        }
        return { marcas: etq.length, choques, fuera };
      }, disp)) });
    }
    const malos = informes.filter((i) => i.error || i.marcas !== 12 || i.choques.length || i.fuera.length);
    const nombre = pagina ? '/' + pagina : 'la portada';
    comprobar(letra && malos.length === 0, `CA-17 · ${nombre}: a 360, 390 y 1280 px las 12 etiquetas del mapa no se pisan ni se salen`, letra ? (malos.length ? malos : undefined) : 'Hanken Grotesk no ha cargado (¿hay red?): sin ella las medidas no valen');
    comprobar(fuera.size === 0, `CA-17 · ${nombre}: al cargar el mapa no se pide nada a otro dominio`, [...fuera]);
    await ctx.close();
  }
}

}

/* ================= 13. sin JavaScript: el carrusel en fila, el panel y el mapa ================= */
if (toca(13)) {
console.log('\n13. Sin JavaScript');
for (const pagina of ['', 'entorno/']) {
  // CA-21 (y §9): sin JS, las 7 fotos en una fila con scroll lateral, el panel del dibujo con lo de ahora y el mapa con sus enlaces
  const { ctx, page } = await nueva({ javaScriptEnabled: false });
  await page.goto(BASE + pagina);
  const nombre = pagina ? '/' + pagina : 'la portada';
  if (!pagina) {
    const fila = await page.evaluate(() => {
      const pista = document.querySelector('.estancias__pista'), figs = [...document.querySelectorAll('.estancias__foto')];
      return { js: document.documentElement.classList.contains('js'), n: figs.length, vis: figs.filter((x) => { const r = x.getBoundingClientRect(); return r.width > 50 && r.height > 50 && getComputedStyle(x).display !== 'none' && getComputedStyle(x).opacity === '1'; }).length, desliza: pista.scrollWidth > pista.clientWidth + 50 && /auto|scroll/.test(getComputedStyle(pista).overflowX), mando: getComputedStyle(document.querySelector('.estancias__mando')).display };
    });
    // cada foto, al llevarla a la vista, se descarga y se pinta (loading="lazy" incluido)
    let cargadas = 0;
    for (let i = 0; i < fila.n; i++) {
      await page.evaluate((k) => document.querySelectorAll('.estancias__foto')[k].scrollIntoView({ block: 'center', inline: 'start' }), i);
      for (let v = 0; v < 40; v++) { if (await page.evaluate((k) => { const im = document.querySelectorAll('.estancias__foto img')[k]; return im.complete && im.naturalWidth > 0; }, i)) { cargadas++; break; } await page.waitForTimeout(100); }
    }
    comprobar(!fila.js && fila.n === 7 && fila.vis === 7 && fila.desliza && fila.mando === 'none' && cargadas === 7, 'CA-21 · sin JS, las 7 fotos del carrusel se ven en una fila con scroll lateral (sin botones)', { ...fila, cargadas });
    comprobar(await page.evaluate(() => !!document.querySelector('#seccion-panel .seccion__ficha #sp-nombre')), 'sin JS, el panel del dibujo enseña la ventana que trae el HTML (§9)');
  }
  await page.evaluate(() => document.querySelector('.alr-mapa').scrollIntoView({ block: 'center' }));
  const mapa = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('.alr-mapa__svg')].filter((s) => getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().height > 100);
    const enlaces = svgs.length === 1 ? [...svgs[0].querySelectorAll('a.alr-mapa__marca')].map((a) => a.getAttribute('href')) : [];
    const lista = [...document.querySelectorAll('.alr-lista a')].map((a) => a.getAttribute('href'));
    return { vistos: svgs.length, marcas: svgs.length === 1 ? svgs[0].querySelectorAll('[data-marca]').length : 0, enlaces, lista };
  });
  // los enlaces llevan a páginas que existen (el servidor imita a Pages)
  const rotos = [];
  for (const h of new Set([...mapa.enlaces, ...mapa.lista])) { const r = await fetch(new URL(h, BASE + pagina)); if (r.status !== 200) rotos.push(h + ' → ' + r.status); }
  comprobar(mapa.vistos === 1 && mapa.marcas === 12 && mapa.enlaces.length >= 1 && mapa.lista.length >= 1 && rotos.length === 0, `CA-21 · ${nombre}, sin JS: el mapa se ve, con sus 12 marcas y sus enlaces (que llevan a su página)`, { ...mapa, rotos });
  await ctx.close();
}

}

/* ================= 14. contraste de lo nuevo ================= */
if (toca(14)) {
console.log('\n14. Contraste de lo nuevo');
{
  /* CA-22: el contraste que se pinta de verdad (color calculado sobre el fondo
     que tiene detrás, con sus transparencias) de cada texto de las piezas
     nuevas. Las 17 parejas de tokens se miden en la sección 8. En el SVG del
     mapa, el fondo de la etiqueta es su halo (paint-order: stroke). */
  const MEDIR = (sel) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const sobre = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
    const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const fondo = (el) => {
      const capas = [];
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const s = getComputedStyle(e);
        // una foto o un degradado detrás: no se sabe qué color toca a cada letra, así que no se da por bueno
        if (s.backgroundImage !== 'none') return { imagen: e.className || e.tagName };
        const c = rgba(s.backgroundColor);
        if (c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
      }
      return { c: capas.reduceRight((b, a) => sobre(a, b), [255, 255, 255, 1]) };
    };
    const res = [];
    for (const raizSel of document.querySelectorAll(sel)) for (const el of [raizSel, ...raizSel.querySelectorAll('*')]) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (r.width < 3 || r.height < 3 || s.visibility !== 'visible' || el.closest('[hidden]')) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      if (op < 0.05) continue;
      const enSvg = el instanceof SVGElement;
      const tinta = rgba(enSvg ? s.fill : s.color); tinta[3] *= op;
      let detras;
      if (enSvg && /^stroke/.test(s.paintOrder) && s.stroke !== 'none' && parseFloat(s.strokeWidth) >= 2) detras = { c: sobre(rgba(s.stroke), fondo(el.closest('svg')).c || [255, 255, 255, 1]) };
      else detras = fondo(el);
      const texto = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (detras.imagen) { res.push({ texto, imagen: detras.imagen }); continue; }
      res.push({ texto, r: Math.round(ratio(sobre(tinta, detras.c), detras.c) * 100) / 100 });
    }
    return res;
  };
  const PIEZAS = [
    ['', '#estancias-pie', 'el pie del carrusel'],
    ['', '.alr-mapa__svg', 'las etiquetas del mapa (portada)'],
    ['entorno/', '.alr-mapa__svg', 'las etiquetas del mapa (/entorno/)'],
    ['tu-habitacion/', '.portadilla, .te-quedas', 'portadilla y «¿Te quedas?» de /tu-habitacion/'],
    ['pico-sacro-v2/', '.portadilla, .te-quedas', 'portadilla y «¿Te quedas?» de /pico-sacro-v2/'],
    ['entorno/', '.portadilla, .te-quedas', 'portadilla y «¿Te quedas?» de /entorno/'],
    ['no-existe/', 'main.no', 'la 404'],
  ];
  const { ctx, page } = await nueva({}, { script: sinCookies });
  for (const ancho of [1280, 390]) {
    await page.setViewportSize({ width: ancho, height: 844 });
    for (const [pagina, sel, nombre] of PIEZAS) {
      await page.goto(BASE + pagina);
      await page.waitForLoadState('load');
      const medidas = await page.evaluate(MEDIR, sel);
      const malas = medidas.filter((m) => m.imagen || !(m.r >= 4.5));
      const justo = medidas.filter((m) => m.r).sort((a, b) => a.r - b.r)[0];
      comprobar(medidas.length > 0 && malas.length === 0, `CA-22 · ${ancho} px · ${nombre}: ${medidas.length === 1 ? 'su texto pasa' : `sus ${medidas.length} textos pasan`} 4,5:1${justo ? ` (el más justo, «${justo.texto}», ${String(justo.r).replace('.', ',')}:1)` : ''}`, malas.length ? malas : medidas.length ? undefined : 'no se ha medido ningún texto');
    }
  }
  await ctx.close();
}

}

/* ================= 15. la consola de cada página ================= */
if (toca(15)) {
console.log('\n15. Consola de cada página');
{
  // CA-25: cero errores en la consola al cargar y recorrer (hasta el pie) cada página de CA-1, con JavaScript y movimiento reducido
  const { ctx, page } = await nueva({}, { script: sinCookies });
  const malas = {};
  for (const f of PAGINAS) {
    page._errores.length = 0;
    await page.goto(BASE + URL_DE(f));
    await page.waitForLoadState('load');
    await bajarTodo(page);
    if (page._errores.length) malas[URL_DE(f) || '/'] = [...page._errores];
  }
  comprobar(Object.keys(malas).length === 0, `CA-25 · las ${PAGINAS.length} páginas de CA-1, con JS y movimiento reducido: cero errores en la consola al cargarlas y bajar hasta el pie`, malas);
  await ctx.close();
}

}

/* ================= 16. movimiento: la cortina entre páginas (al final, la única prueba con movimiento nueva) ================= */
if (toca(16)) {
console.log('\n16. La cortina entre páginas');
/* Vigía: ¿se ha visto la cortina en algún fotograma de esta carga? */
const VIGIA = () => {
  window.__cortinaVista = false;
  const t0 = performance.now();
  const mirar = () => {
    const c = document.getElementById('cortina');
    if (c && getComputedStyle(c).display !== 'none') window.__cortinaVista = true;
    else if (performance.now() - t0 < 8000) requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
};
/* Espera a que la página cargue y pinte unos fotogramas: si la cortina tuviera que salir, ya estaría */
const pintada = (page) => page.evaluate(() => new Promise((r) => { const ya = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))); if (document.readyState === 'complete') ya(); else addEventListener('load', ya); }));
const vista = (page) => page.evaluate(() => window.__cortinaVista);
let cortinaEnPortada = false;
{
  // CA-26: un navegador limpio, como el de alguien que llega por primera vez desde Google a /entorno/
  const { ctx, page } = await nueva({}, { movimiento: true, script: VIGIA });
  await page.goto(BASE + 'entorno/');
  await page.waitForSelector('#cookies:not([hidden])', { timeout: 8000 }).catch(() => {});
  await pintada(page);
  const ent = { aviso: await page.evaluate(() => !document.getElementById('cookies').hidden), cortina: await vista(page) };
  comprobar(ent.aviso && !ent.cortina, 'CA-26 · navegador limpio: /entorno/ saca el aviso de cookies y no la cortina', ent);
  await page.click('#ck-si');
  await page.goto(BASE);
  await page.waitForFunction(() => window.__cortinaVista, null, { timeout: 5000 }).catch(() => {});
  cortinaEnPortada = await vista(page);
  comprobar(cortinaEnPortada, 'CA-26 · después, la portada sin ancla saca la cortina');
  await esperarCortina(page, 200);
  await page.reload();
  await pintada(page);
  comprobar(!(await vista(page)), 'CA-26 · al recargar la portada, la cortina no vuelve a salir');
  // CA-7: desde /entorno/, «La finca» del menú lleva a la portada con #finca y su título se ve bajo la cabecera
  await page.goto(BASE + 'entorno/');
  await pintada(page);
  await page.click('#cab .cab__nav a[href="../#finca"]');
  await page.waitForURL((u) => u.pathname === '/' && u.hash === '#finca', { timeout: 8000 }).catch(() => {});
  const bajoCab = () => { const t = document.getElementById('finca-tit').getBoundingClientRect(), c = document.getElementById('cab').getBoundingClientRect(); return { url: location.pathname + location.hash, tit: Math.round(t.top), cab: Math.round(c.bottom), alto: innerHeight }; };
  await page.waitForFunction(() => { const t = document.getElementById('finca-tit')?.getBoundingClientRect(), c = document.getElementById('cab').getBoundingClientRect(); return t && t.top >= c.bottom - 1 && t.bottom <= innerHeight; }, null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(600);   // y se queda ahí (la cabecera y Lenis no la mueven después)
  const fin = await page.evaluate(bajoCab);
  comprobar(fin.url === '/#finca' && fin.tit >= fin.cab - 1 && fin.tit < fin.alto * 0.6, 'CA-7 · desde /entorno/, «La finca» lleva a /#finca y el título queda a la vista, bajo la cabecera', fin);
  // CA-26: una ventana nueva (sesión nueva) con /#finca tampoco la saca
  const otra = await ctx.newPage();
  await otra.goto(BASE + '#finca');
  await pintada(otra);
  comprobar(!(await vista(otra)), 'CA-26 · una ventana nueva con /#finca no saca la cortina');
  comprobar(page._errores.length === 0, 'CA-26 · el recorrido, sin errores', page._errores);
  await ctx.close();
}
{
  // CA-6: nunca en /tu-habitacion/, ni siquiera en la primera visita de un navegador limpio
  const { ctx, page } = await nueva({}, { movimiento: true, script: VIGIA });
  await page.goto(BASE + 'tu-habitacion/');
  await pintada(page);
  const enHab = await vista(page);
  comprobar(cortinaEnPortada && !enHab, 'CA-6 · la cortina sale en la primera visita a la portada y nunca en /tu-habitacion/', { portada: cortinaEnPortada, tuHabitacion: enHab });
  await ctx.close();
}

}

} finally {
  await browser.close();
  servidor.close();
}

/* Criterios de navegador de una spec (§10) que todavía no se comprueban: van
   aquí con pendiente('CA-x', '…') y la tarea que los convierte en
   comprobación de verdad quita su línea. De la spec 001 no queda ninguno (T19). */

// spec 002 (T01): los navegador y estáticos de su tabla; los activan T18 y T19
pendiente('CA-4', 'spec 002 · servidas con y sin el prefijo del escaparate, ninguna petición de ninguna página da 404 (T18)');
pendiente('CA-14', 'spec 002 · en /contactar/ y la portada no hay iframe ni petición a Google hasta pulsar «Ver el mapa», con y sin cookies aceptadas; al pulsar, sale (T19)');
pendiente('CA-15', 'spec 002 · el mapa sale al pulsar y no hay errores de consola en la portada ni en /contactar/ (T19)');
pendiente('CA-19', 'spec 002 · AJENOS lleva los nombres de alojamientos de CA-9 y ninguna página construida tiene fotos de otros alojamientos ni generadas con IA (T18)');
pendiente('CA-20', 'spec 002 · PAGINAS sale de mapa-url.json (las construidas y el 404), no de una lista escrita, y la pasada entera pasa con una sola pasada con desplazamiento (T18)');
pendiente('CA-21', 'spec 002 · cero errores de consola al cargar y recorrer cada página, con JavaScript y con movimiento reducido (T19)');
pendiente('CA-22', 'spec 002 · contraste de 4,5:1 o más en «Sigue leyendo», tarjetas del entorno, cita, grupos del pie y del menú móvil (con la franja del teléfono) y bloque pendiente (T19)');
pendiente('CA-24', 'spec 002 · sin JavaScript, cada página enseña todo su texto, «Sigue leyendo» y el pie; en /pico-sacro-v2/ se ven las seis leyendas (T19)');
pendiente('CA-25', 'spec 002 · menú móvil a 390 × 844: se abre, se desplaza hasta el último de «Alrededores» con el teléfono visible, Escape lo cierra y el foco vuelve al botón (T19)');
pendiente('CA-27', 'spec 002 · las pestañas de las leyendas de /pico-sacro-v2/ se manejan con flechas del teclado, como CA-16 de la 001 (T19)');
pendiente('§3.6', 'spec 002 · cada {{enlace:slug#ancla}} apunta a un id que existe en la página destino (T18)');
pendiente('§8', 'spec 002 · los enlaces externos de <main> (fuera de #llegar, PD-8) llevan target="_blank" y rel con noopener (T18)');

console.log(`\n${nOk} bien, ${fallos.length} mal, ${pendientes.length} pendientes${FINAL ? ' (con --final cuentan como fallo)' : ''}${SOLO ? ` · solo las secciones ${[...SOLO].join(', ')}: la pasada buena es la entera` : ''}`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exit(1); }
