/* LCP y peso en un móvil de gama media (Pixel 7 emulado, 4G lento, CPU ×4).
   Uso: node scripts/rendimiento.mjs   (3 pasadas; GSAP y Lenis desde copia local) */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(8783, r));
const CACHE = path.join(os.tmpdir(), 'neixon-cdn');
// las fotos del carrusel de estancias, tal como salen en la portada (CA-22 bis)
const ESTANCIAS = [...fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8').matchAll(/<figure class="estancias__foto[^"]*"[^>]*><picture data-foto="([^"]+)"/g)].map((m) => m[1]);
if (!ESTANCIAS.length) throw new Error('No encuentro las fotos de estancias en index.html (¿falta node construir.mjs?)');
const b = await chromium.launch();   // un navegador, cerrado en el finally (../CLAUDE.md)
try {
for (let n = 1; n <= 3; n++) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await ctx.route(/(gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {}
    window.__lcp = null; window.__long = [];
    new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__lcp = { t: e.startTime, url: e.url || e.element?.tagName }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  let bytes = 0, reqs = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
  const t0 = Date.now();
  await page.goto('http://localhost:8783/index.html');
  await page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 30000 });
  const fuera = Date.now() - t0;
  await page.waitForTimeout(800);
  // CA-22 bis: del carrusel de estancias solo se pide la primera foto antes de que cargue la página
  const r = await page.evaluate((nombres) => {
    const nav = performance.getEntriesByType('navigation')[0];
    const estancias = performance.getEntriesByType('resource').filter((e) => e.startTime < (nav.loadEventEnd || performance.now()) && nombres.some((x) => e.name.includes('/img/fotos/' + x + '-'))).map((e) => e.name.split('/').pop());
    return { lcp: window.__lcp, long: window.__long, estancias };
  }, ESTANCIAS);
  console.log(`pasada ${n}: LCP ${Math.round(r.lcp.t)} ms (${String(r.lcp.url).split('/').pop()}) · portal fuera ${fuera} ms · ${reqs} peticiones, ${(bytes / 1024).toFixed(0)} KB · tareas largas ${JSON.stringify(r.long)} · estancias antes de load: ${r.estancias.join(', ') || 'ninguna'}`);
  await ctx.close();
}
} finally {
  await b.close(); srv.close();
}
