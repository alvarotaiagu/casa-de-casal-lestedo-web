/* Verificación de la web de Casa de Casal (Playwright, bajando con la rueda).
   Uso: node verificar.mjs [--capturas]   → capturas en ./pruebas/ */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8781;                 // puerto propio de esta web
const CAPTURAS = process.argv.includes('--capturas');
const DIR_CAP = path.join(RAIZ, 'pruebas');
if (CAPTURAS) fs.mkdirSync(DIR_CAP, { recursive: true });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + BASE);

const fallos = [];
let nOk = 0;
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => { nOk++; console.log('  ok     ' + m); };
const comprobar = (cond, m, detalle) => (cond ? ok(m) : mal(m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')));
const cap = async (page, nombre, op) => { if (CAPTURAS) await page.screenshot({ path: path.join(DIR_CAP, nombre + '.png'), ...(op || {}) }); };
const LLAVE = 'casal-cookies';
const sinCookies = () => { try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {} };
const MOVIL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const TIEMPO = { current: { time: '2026-10-16T12:00', cloud_cover_low: 72, precipitation: 0 } };

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });   // WebGL para el Pico en 3D

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
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

async function nueva(op = {}, { cdn = 'local', script, tiempo = 'ok' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...op });
  if (cdn === 'local') await ctx.route(RE_CDN, local);
  if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
  if (cdn === 'lento') await ctx.route(RE_CDN, async (r) => { await new Promise((x) => setTimeout(x, 3000)); await local(r); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
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
for (const f of fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'))) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">/.test(s), `${f}: el charset es lo primero del head`);
  comprobar(/<meta name="robots" content="noindex/.test(s), `${f}: noindex`);
  comprobar(!/<!--svg:|data-foto="[^"]+"\s[^>]*>(?!<\/picture>)/.test(s.replace(/<picture data-foto="[^"]+">/g, '')), `${f}: sin marcadores de construir.mjs sin expandir`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)].slice(0, 8));
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/logo-oro.png', 'marca/tejado-oro.png'].every((f) => fs.existsSync(path.join(RAIZ, f))), '.nojekyll, 404, manifest, og:image, favicons y piezas del logo');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !fs.existsSync(path.join(RAIZ, r)));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  // las fotos que pide el JS (panel de la sección) también existen
  const js = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
  const delJS = [...js.matchAll(/foto: '([a-z-]+)'(?:, w: (\d+))?/g)].flatMap((m) => [`img/fotos/${m[1]}-480.jpg`, `img/fotos/${m[1]}-${m[2] || 800}.jpg`]);
  comprobar(delJS.length > 10 && delJS.every((r) => fs.existsSync(path.join(RAIZ, r))), 'existen las fotos que carga el panel de la casa', delJS.filter((r) => !fs.existsSync(path.join(RAIZ, r))));
  comprobar(/rel="preload" as="image"[^>]*portada-casa-800\.avif/.test(html.replace(/\n\s*/g, ' ')), 'la foto de la portada va precargada');
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  comprobar(!/\b(1|una)( sola| única)? reseña/i.test(texto), 'sin «una reseña»');
  comprobar(!/clientes satisfechos|cientos de|miles de/i.test(texto), 'sin prueba social inventada');
  comprobar(!/sin permanencia|sin cuotas|sin comisiones|mejor precio garantizado/i.test(texto), 'sin condiciones comerciales de reclamo');
  comprobar(!/Cantaruxa|Cristosende|Torre do R[ií]o|Lar de Donas|Pi[ñn]eiro|Labrada/i.test(html), 'ninguna foto ni texto de otros alojamientos de su página de hoteles');
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
  comprobar(/<!-- MANDO DE MAQUETA/.test(src) && /fin del MANDO DE MAQUETA/.test(src) && /14\. MANDO DE MAQUETA/.test(js) && /fin del MANDO DE MAQUETA/.test(js), 'receta de borrado del mando: marcas en index.src.html y main.js');
  comprobar(/OPCIONAL «Los papeles de la casa»/.test(src) && /fin OPCIONAL «Los papeles de la casa»/.test(src), 'la sección opcional lleva sus marcas para quitarla');
  comprobar(/cdn\.jsdelivr\.net\/npm\/@studio-freight\/lenis@1\.0\.42/.test(src) && /gsap\/3\.12\.5/.test(src), 'GSAP y Lenis con versión fija');
  const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
  comprobar(fotos.every((f) => f.ancho <= f.ancho_origen), 'fotos: ningún tamaño generado por encima del original');
}

/* ================= 1. la cortina ================= */
console.log('\n1. Cortina');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
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
  const { ctx, page } = await nueva({}, { cdn: 'caido', script: sinCookies });
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('cortina')).display === 'none'), 'sin CDN: la cortina se retira');
  comprobar(await page.evaluate(() => document.querySelectorAll('.tipo').length === 5 && document.getElementById('motor').children.length > 0), 'sin CDN: habitaciones y motor funcionan');
  await ctx.close();
}
{
  const { ctx, page } = await nueva({}, { cdn: 'lento', script: sinCookies });
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
  comprobar(await page.evaluate(() => Array.from(document.querySelectorAll('.tipo')).every((f) => getComputedStyle(f).opacity === '1') && document.querySelectorAll('.tipo').length === 5), 'sin JS: se leen los cinco tipos de habitación');
  await ctx.close();
}

/* ================= 2. la portada: el gablete ================= */
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

/* ================= 3. bajo el tejado ================= */
console.log('\n3. Habitaciones');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '.seccion', 120);
  comprobar(await page.evaluate(() => document.querySelector('.seccion').classList.contains('es-trazada')), 'el tejado del dibujo se traza al llegar');
  const esperado = { pequena: 'Casa Pequena do Casal', galeria: 'Salón con galería', confort: 'Confort', terraza: 'Con terraza', torre: 'La Torre', familiar: 'Pico Sacro', comedor: 'El comedor', chimenea: 'Recibidor con chimenea', clasicas: 'Clásicas' };
  const malas = [];
  for (const [k, n] of Object.entries(esperado)) {
    await page.click(`.zona[data-k="${k}"] .hueco`);
    await page.waitForTimeout(250);
    const v = await page.evaluate(() => ({ n: document.getElementById('sp-nombre').textContent, f: document.getElementById('sp-foto').currentSrc || document.getElementById('sp-foto').src, act: document.querySelectorAll('.zona.activa').length }));
    if (v.n !== n || v.act !== 1) malas.push([k, v]);
  }
  comprobar(malas.length === 0, 'cada ventana del dibujo abre su habitación o estancia', malas);
  await page.waitForTimeout(600);
  comprobar(await page.evaluate(() => { const i = document.getElementById('sp-foto'); return i.complete && i.naturalWidth > 0; }), 'la foto del panel carga');
  await page.focus('.zona[data-k="terraza"]');
  await page.keyboard.press('Enter');
  comprobar(await page.evaluate(() => document.getElementById('sp-nombre').textContent === 'Con terraza'), 'con el teclado (Intro) también');
  await page.click('#sp-reservar');
  await page.waitForTimeout(1600);
  const m = await page.evaluate(() => ({ f: window.__motor.st.filtro, ini: window.__motor.st.ini, top: document.getElementById('motor').getBoundingClientRect().top }));
  comprobar(m.f === 'terraza' && m.ini && Math.abs(m.top - 80) < 120, '«Ver fechas» lleva al motor con la habitación elegida y un fin de semana libre', m);
  await bajarA(page, '#tipos', 100);
  await page.click('.tipo[data-tipo="familiar"] [data-reservar]');
  await page.waitForTimeout(1500);
  comprobar(await page.evaluate(() => window.__motor.st.filtro === 'familiar' && window.__motor.st.sel.familiar === 1), 'la ficha Pico Sacro lleva al motor con ella propuesta');
  await cap(page, '03-habitaciones');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}

/* ================= 4. el Pico, hoy ================= */
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
  // leyendas: teclado
  await bajarA(page, '.leyendas', 100);
  await page.focus('#leyenda-0');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  comprobar(await page.evaluate(() => document.getElementById('leyendas-tit').textContent === 'El paso de la Reina Lupa' && document.activeElement.id === 'leyenda-2' && document.getElementById('leyenda-2').getAttribute('aria-selected') === 'true'), 'leyendas: las flechas cambian de leyenda y llevan el foco');
  comprobar(await page.evaluate(() => { const c = document.getElementById('leyendas-cap').textContent, t = document.getElementById('leyendas-txt').textContent; return c === 'L' && /^a cumbre/.test(t); }), 'la capitular y el texto se leen seguidos («L» + «a cumbre…»)');
  // el Pico en 3D (IGN): carga al acercarse y sustituye al dibujo
  await page.waitForFunction(() => !!window.__pico3d, null, { timeout: 25000 }).catch(() => {});
  const t3 = await page.evaluate(() => {
    const v = document.getElementById('pico-vista'), c = v.querySelector('canvas');
    return { tiene: !!window.__pico3d, clase: v.className, dibujo: getComputedStyle(document.getElementById('pico-dibujo')).display, lienzo: c ? [c.clientWidth, c.clientHeight] : null,
      rotulos: Array.from(v.querySelectorAll('.pico__rotulo')).filter((r) => !r.hidden).map((r) => r.textContent), mando: !document.getElementById('pico-mando3d').hidden };
  });
  comprobar(t3.tiene && /con-3d/.test(t3.clase) && t3.dibujo === 'none' && t3.lienzo && t3.lienzo[0] > 300 && t3.lienzo[1] > 150 && t3.mando, 'el Pico en 3D carga y sustituye al dibujo', t3);
  comprobar(t3.rotulos.includes('Casa de Casal') && t3.rotulos.includes('Pico Sacro · 533 m'), 'en 3D se ven los rótulos de la casa y del Pico', t3.rotulos);
  const dia3 = await page.evaluate(() => { window.__cielo('2026-10-16T10:00:00Z'); return window.__pico3d.estado(); });
  const noche3 = await page.evaluate(() => { window.__cielo('2025-11-05T23:30:00Z'); return window.__pico3d.estado(); });
  comprobar(dia3.luzSol > 1 && dia3.estrellas === 0 && noche3.luzSol === 0 && noche3.luzLuna > 0.5 && noche3.estrellas > 0.9 && noche3.luna, '3D: de día luz de sol; de noche de luna llena, luz de luna y estrellas', { dia3, noche3 });
  const px = async () => page.evaluate(() => { const c = document.querySelector('#pico-vista canvas'); const g = document.createElement('canvas'); g.width = 40; g.height = 20; g.getContext('2d').drawImage(c, 0, 0, 40, 20); return Array.from(g.getContext('2d').getImageData(0, 0, 40, 20).data).join(','); });
  await page.evaluate(() => window.__cielo('2026-10-16T10:00:00Z'));   // de día: de noche la miniatura sale casi negra
  const antes = await px();
  const bb = await (await page.$('#pico-vista')).boundingBox();
  await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.6); await page.mouse.down();
  for (let i = 0; i < 12; i++) { await page.mouse.move(bb.x + bb.width * (0.6 - i * 0.03), bb.y + bb.height * 0.6); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(1200);
  comprobar(antes !== await px(), '3D: arrastrar con el ratón gira la vista');
  await page.click('#pico-volver'); await page.waitForTimeout(500);
  comprobar(await page.evaluate(() => /arrastra/i.test(document.getElementById('pico-pista').textContent)), '3D: «Volver a la vista» funciona y la pista explica el gesto');
  await page.click('#pico-girar');
  comprobar(await page.evaluate(() => document.getElementById('pico-girar').getAttribute('aria-pressed') === 'true' && document.getElementById('pico-girar').textContent === 'Listo' && /rueda/.test(document.getElementById('pico-pista').textContent)), '3D: «Girar el monte» activa el zoom con la rueda y cambia a «Listo»');
  await page.click('#pico-girar');
  await cap(page, '04-pico');
  comprobar(page._errores.length === 0, 'sin errores', page._errores);
  await ctx.close();
}
{
  // sin Three.js (CDN caído): se queda el dibujo, sin errores
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three/, (r) => r.abort());
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#pico', 0);
  await page.waitForTimeout(4000);
  comprobar(await page.evaluate(() => !window.__pico3d && getComputedStyle(document.getElementById('pico-dibujo')).display !== 'none' && document.getElementById('pico-mando3d').hidden), 'sin Three.js se queda el dibujo del cielo');
  comprobar(page._errores.filter((e) => !/three|jsdelivr/.test(e)).length === 0, 'sin Three.js: sin errores', page._errores);
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

/* ================= 5. dos casas en una: anillo y motor ================= */
console.log('\n5. Anillo y motor de reservas');
{
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(BASE);
  await esperarCortina(page);
  await bajarA(page, '#reserva', 0);
  const M = (fn, a) => page.evaluate(fn, a);
  comprobar(await M(() => window.__motor.st.ini && !window.__motor.esEntera(window.__motor.st.ini) && Object.values(window.__motor.st.sel).reduce((a, b) => a + b, 0) >= 1), 'el motor arranca con un fin de semana de ejemplo y una habitación propuesta');
  // octubre: dos noches en la primera clásica libre
  const hoyMes = new Date().getMonth();
  await page.click('#anyo-meses button:nth-child(11)');      // noviembre
  await page.waitForTimeout(300);
  const nov = await M(() => ({ tit: document.querySelector('#motor .mes__tit').textContent, modo: document.querySelector('.motor__modo').textContent, an: document.getElementById('anyo-modo').textContent }));
  comprobar(/Noviembre/.test(nov.tit) && /Casa entera/.test(nov.modo) && /hasta 22/.test(nov.an), 'el anillo lleva el calendario a noviembre, en modo casa entera', nov);
  // dos noches libres seguidas en noviembre
  const par = await M(() => { const b = Array.from(document.querySelectorAll('#motor .dia[data-k]')).filter((x) => x.dataset.k.slice(5, 7) === '11'); for (let i = 0; i < b.length - 2; i++) { const k = b[i].dataset.k; if (window.__motor.rangoPosible(k, b[i + 2].dataset.k)) return [k, b[i + 1].dataset.k, b[i + 2].dataset.k]; } return null; });
  await page.click(`#motor [data-k="${par[0]}"]`); await page.click(`#motor [data-k="${par[2]}"]`);
  const e2 = await M(() => document.querySelector('.motor__res').textContent);
  comprobar(/1\.190 €/.test(e2) && /298 €/.test(e2) && /casa grande/i.test(e2), 'casa entera, 2 noches: 1.190 € y anticipo de 298 €', par);
  await page.click(`#motor [data-k="${par[0]}"]`); await page.click(`#motor [data-k="${par[1]}"]`);
  comprobar(/675 €/.test(await M(() => document.querySelector('.motor__res').textContent)), 'casa entera, 1 noche: 675 €');
  comprobar(await M(() => !document.querySelector('.motor__filtro') && !document.querySelector('.motor__habs')), 'en casa entera no hay filtro ni lista de habitaciones');
  // cruzar de temporada: del 31 de octubre al 2 de noviembre
  await M(() => window.CASALmotor.irMes(9));
  const y = new Date().getMonth() > 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  if (await M((k) => window.__motor.nocheLibre(k), `${y}-10-31`)) {
    await page.click(`#motor [data-k="${y}-10-31"]`); await page.click('#motor [data-acc="next"]').catch(() => {});
    await page.click(`#motor [data-k="${y}-11-02"]`);
    comprobar(/cambio de temporada/.test(await M(() => document.querySelector('#motor .motor__msg').textContent)), 'cruzar del 31 de octubre al 2 de noviembre avisa del cambio de temporada');
  } else ok('cruce de temporada: el 31 de octubre de ejemplo está ocupado (sin comprobar esta vez)');
  // Navidad cerrada
  await M(() => window.CASALmotor.irMes(11));
  comprobar(await M((y2) => { const b = document.querySelector(`#motor [data-k="${y2}-12-24"]`); return b && b.getAttribute('aria-disabled') === 'true' && /cerrad/.test(b.getAttribute('aria-label')); }, y), 'el 24 de diciembre sale cerrado');
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

/* ================= 6. cabecera, cookies, regla y pie ================= */
console.log('\n6. Cabecera, cookies, alrededores y pie');
{
  const { ctx, page } = await nueva();
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
  await bajarA(page, '#alrededores', 0);
  const solapes = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#regla text')).filter((x) => /′/.test(x.textContent)).map((x) => x.getBBox());
    const n = []; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i], b = t[j]; if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) n.push([i, j]); }
    return { n: t.length, solapes: n };
  });
  comprobar(solapes.n === 9 && solapes.solapes.length === 0, 'regla de minutos: 9 lugares y ninguna etiqueta pisa otra', solapes);
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

/* ================= 7. móvil ================= */
console.log('\n7. Móvil');
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
  const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { script: sinCookies });
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
    await page.click('#menu-movil a[href="#pico"]');
    await page.waitForTimeout(1800);
    comprobar(await page.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.getElementById('pico').getBoundingClientRect().top - 80) < 70), 'un enlace del menú cierra el menú y lleva a su sección');
    await bajarA(page, '#motor', 80);
    comprobar(await page.evaluate(() => !document.getElementById('barra').classList.contains('es-visible')), 'la barra se aparta sobre el motor de reservas');
    await cap(page, '07-motor-390');
  }
  comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores);
  await ctx.close();
}
{
  // la barra del navegador del móvil sube y baja: nada se rehace ni salta
  const { ctx, page } = await nueva(MOVIL, { script: () => { try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {} window.__refrescos = 0; addEventListener('DOMContentLoaded', () => { const t = setInterval(() => { if (window.ScrollTrigger) { ScrollTrigger.addEventListener('refresh', () => window.__refrescos++); clearInterval(t); } }, 20); }); } });
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

/* ================= 8. densidades, foco, fotos y contraste ================= */
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
  const s = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), url: location.search, tabla: getComputedStyle(document.querySelector('.tabla-envoltura')).display, clip: getComputedStyle(document.querySelector('.casa .gable img')).clipPath }));
  comprobar(s.cls && /densidad=sobria/.test(s.url) && s.tabla === 'block' && s.clip === 'none', 'la sobria: fotos rectas y además la tabla de las habitaciones', s);
  await page.click('#mando [data-densidad="cargada"]');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && getComputedStyle(document.querySelector('.tabla-envoltura')).display === 'none' && /polygon/.test(getComputedStyle(document.querySelector('.casa .gable img')).clipPath)), '«Bajo el tejado» vuelve a las fotos con gablete');
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
  for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
    await page.goto(BASE + f + '.html');
    comprobar(await page.evaluate(() => document.querySelector('h1') && document.body.scrollWidth <= innerWidth), `${f}.html se abre y no desborda`);
  }
  comprobar(page._errores.length === 0, 'legales: sin errores', page._errores);
  await ctx.close();
}

await browser.close();
servidor.close();
console.log(`\n${nOk} bien, ${fallos.length} mal`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exit(1); }
