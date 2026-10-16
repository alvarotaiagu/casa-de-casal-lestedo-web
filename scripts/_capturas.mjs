/* Capturas sueltas para revisar a ojo (puerto 8779): node scripts/_capturas.mjs [esc|mov] [sección…]
   Baja con la rueda (Lenis), no con scrollTo. Deja los PNG en pruebas/. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const R = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(R, p); if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => s.listen(8779, r));
const modo = process.argv[2] || 'esc';
const secciones = process.argv.slice(3).length ? process.argv.slice(3) : ['hero', 'casa', 'habitaciones', 'pequena', 'finca', 'mesa', 'pico', 'reserva', 'motor', 'alrededores', 'opiniones', 'llegar', 'pie'];
const vp = modo === 'mov' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: modo === 'mov', hasTouch: modo === 'mov' });
const p = await ctx.newPage();
const errores = []; p.on('pageerror', (e) => errores.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await p.addInitScript(() => { try { localStorage.setItem('casal-cookies', 'si'); } catch (e) {} });
await p.goto('http://localhost:8779/' + (process.env.Q || ''), { waitUntil: 'networkidle' });
await p.waitForTimeout(5200);
fs.mkdirSync(path.join(R, 'pruebas'), { recursive: true });
for (const id of secciones) {
  const y = await p.evaluate((i) => { const el = document.getElementById(i); return el ? el.getBoundingClientRect().top + scrollY - 70 : null; }, id);
  if (y === null) { console.log('no existe #' + id); continue; }
  for (let i = 0; i < 40; i++) {
    const falta = await p.evaluate((yy) => yy - scrollY, y);
    if (Math.abs(falta) < 30) break;
    if (modo === 'mov') await p.evaluate((d) => scrollBy(0, d), Math.sign(falta) * Math.min(Math.abs(falta), 600));
    else await p.mouse.wheel(0, Math.sign(falta) * Math.min(Math.abs(falta), 700));
    await p.waitForTimeout(140);
  }
  await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(R, 'pruebas', `${modo}-${id}.png`) });
}
const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
console.log(modo, 'scrollWidth', ancho, 'vista', vp.width, 'errores', errores);
await b.close(); s.close();
