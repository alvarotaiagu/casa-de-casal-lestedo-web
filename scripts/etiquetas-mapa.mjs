/* Etiquetas del mapa de alrededores (spec 001 §3.4.1, tarea T16).
   Una sola prueba de Playwright, sin 3D: mide cada etiqueta con getBBox en las
   dos disposiciones (ancho y estrecho) con Hanken Grotesk ya cargada, busca
   para cada una un lado y un desplazamiento con los que ninguna caja se pisa
   (4 unidades de holgura, sin tapar otras marcas ni salirse del dibujo) y los
   guarda en datos/alrededores.json:
     etiqueta: { ancho: {lado, dx, dy}, estrecho: {lado, dx, dy} }
   en cada sitio y en la casa. Después carga el mapa ya colocado con la hoja de
   estilos de la web a 360, 390 y 1280 px y comprueba que ninguna caja se pisa.
   La web no mide nada: la construcción solo lee el JSON.

   Uso: node scripts/etiquetas-mapa.mjs [--sin-navegador]
   --sin-navegador → no abre Playwright ni escribe nada: estima el ancho de la
                      letra para probar la búsqueda (solo para depurar).
   Se lanza a mano cuando cambian los sitios, sus nombres o el encuadre.
   Antes, mira que no haya otra prueba en marcha (reglas de ../CLAUDE.md). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DISPOSICIONES, LADOS, proyeccion, marcas, colocar, textoEtiqueta, figuraMapa, leerDatos } from './lib/mapa-svg.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_SITIOS = path.join(RAIZ, 'datos', 'alrededores.json');
const SIN_NAVEGADOR = process.argv.includes('--sin-navegador');
const HOLGURA = 4;                                       // entre cajas, en unidades del viewBox
const VISTAS = [{ ancho: 360, disp: 'estrecho' }, { ancho: 390, disp: 'estrecho' }, { ancho: 1280, disp: 'ancho' }];
const POR_DEFECTO = { lado: 'e', dx: 0, dy: 0 };

const leerTexto = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const { datosMapa, sitios } = leerDatos(RAIZ);
const CSS = leerTexto(path.join(RAIZ, 'css', 'estilos.css'));
// las mismas letras que la web (parciales/head.html)
const LETRAS = (/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)">/.exec(leerTexto(path.join(RAIZ, 'parciales', 'head.html'))) || [])[1];
if (!LETRAS) throw new Error('No encuentro el enlace de las letras en parciales/head.html');

const pagina = (cuerpo) => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${LETRAS.replace(/&/g, '&amp;')}">
<style>${CSS}</style></head>
<body><main><section class="alrededores clara"><div class="env">${cuerpo}</div></section></main></body></html>`;

/* ---------- 1. medir: cada etiqueta en sus 8 lados, sin desplazar ---------- */
function svgMedir(nombre) {
  const p = proyeccion(nombre);
  let s = `<svg class="alr-mapa__svg" style="display:block" viewBox="0 0 ${p.ancho} ${p.alto}" width="${p.ancho}" height="${p.alto}" data-medir="${nombre}">`;
  for (const m of marcas(sitios, nombre)) {
    for (const lado of LADOS) s += textoEtiqueta(m, colocar(m, { lado, dx: 0, dy: 0 }, nombre), nombre, ` data-m="${m.id}" data-lado="${lado}"`);
  }
  return s + '</svg>';
}

/* Sin navegador: caja aproximada (para probar la búsqueda). */
function estimar(nombre) {
  const L = DISPOSICIONES[nombre].letra;
  const cajas = {};
  for (const m of marcas(sitios, nombre)) {
    for (const lado of LADOS) {
      const c = colocar(m, { lado, dx: 0, dy: 0 }, nombre);
      const w = Math.max(...m.lineas.map((l) => l.texto.length * L * (l.clase === 'min' ? 0.56 : 0.62)));
      const x = c.ancla === 'start' ? c.ax : c.ancla === 'end' ? c.ax - w : c.ax - w / 2;
      cajas[`${m.id}|${lado}`] = { x, y: c.ay - 1.05 * L, width: w, height: (m.lineas.length - 1) * c.lh + 1.4 * L };
    }
  }
  return cajas;
}

/* ---------- 2. buscar: lado y desplazamiento sin pisarse ---------- */
const pisa = (a, b, h = 0) => a.x - h < b.x + b.width && b.x - h < a.x + a.width && a.y - h < b.y + b.height && b.y - h < a.y + a.height;
const mover = (c, dx, dy) => ({ x: c.x + dx, y: c.y + dy, width: c.width, height: c.height });

// el segmento [x1,y1]-[x2,y2] cruza la caja (Liang-Barsky)
function cruza([x1, y1, x2, y2], c) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - c.x], [dx, c.x + c.width - x1], [-dy, y1 - c.y], [dy, c.y + c.height - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

// dos guías se cortan
function corta([a, b, c, d], [e, f, g, h]) {
  const giro = (x1, y1, x2, y2, x3, y3) => Math.sign((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1));
  return giro(a, b, c, d, e, f) !== giro(a, b, c, d, g, h) && giro(e, f, g, h, a, b) !== giro(e, f, g, h, c, d);
}

function cajaMarca(m) {
  const r = m.borde ? m.r * 1.8 : m.r + 1;
  return { x: m.x - r, y: m.y - r, width: 2 * r, height: 2 * r };
}

function candidatos(lado) {
  const lista = [];
  const [ux, uy] = { e: [1, 0], o: [-1, 0], n: [0, -1], s: [0, 1], ne: [0.7, -0.7], no: [-0.7, -0.7], se: [0.7, 0.7], so: [-0.7, 0.7] }[lado];
  for (const d of [0, 5, 10, 16, 24, 34, 46, 60, 76, 94, 115, 140]) {
    for (const t of [0, 6, -6, 12, -12, 20, -20, 30, -30, 42, -42, 56, -56]) {
      const dx = Math.round(ux * d - uy * t), dy = Math.round(uy * d + ux * t);
      lista.push({ lado, dx, dy, coste: d + Math.abs(t) * 1.2 + LADOS.indexOf(lado) * 2 });
    }
  }
  return lista;
}
const TODOS = LADOS.flatMap(candidatos).sort((a, b) => a.coste - b.coste);

/* Recocido simulado (con semilla fija: da siempre lo mismo). Cada etiqueta
   elige entre sus candidatos válidos (dentro del dibujo y sin tapar ninguna
   marca); se minimiza 1000 × choques + lo que se aparta de su sitio. Choque:
   dos cajas a menos de HOLGURA, una guía que cruza otra caja o dos guías que
   se cortan. */
function buscar(nombre, cajas) {
  const p = proyeccion(nombre);
  const ms = marcas(sitios, nombre);
  const dentro = (c) => c.x >= 2 && c.y >= 2 && c.x + c.width <= p.ancho - 2 && c.y + c.height <= p.alto - 2;
  const opciones = ms.map((m) => {
    const lista = [];
    for (const cand of TODOS) {
      const c = colocar(m, cand, nombre);
      const caja = mover(cajas[`${m.id}|${cand.lado}`], cand.dx, cand.dy);
      if (!dentro(caja)) continue;
      if (ms.some((o) => pisa(caja, cajaMarca(o), o === m ? 1 : HOLGURA / 2))) continue;
      if (c.guia && ms.some((o) => o !== m && cruza(c.guia, cajaMarca(o)))) continue;
      lista.push({ caja, guia: c.guia, coste: cand.coste, et: { lado: cand.lado, dx: cand.dx, dy: cand.dy } });
    }
    if (!lista.length) throw new Error(`${nombre}: «${m.nombre}» no cabe en ningún lado sin tapar otra marca`);
    return lista;
  });
  const choques = (a, b) => (pisa(a.caja, b.caja, HOLGURA) ? 1 : 0)
    + (a.guia && cruza(a.guia, b.caja) ? 1 : 0) + (b.guia && cruza(b.guia, a.caja) ? 1 : 0)
    + (a.guia && b.guia && corta(a.guia, b.guia) ? 1 : 0);
  const n = ms.length;
  const estado = new Array(n).fill(0);   // cada una, en su candidato más barato
  const local = (i, k) => {
    let e = opciones[i][k].coste;
    for (let j = 0; j < n; j++) if (j !== i) e += 1000 * choques(opciones[i][k], opciones[j][estado[j]]);
    return e;
  };
  const total = () => {
    let e = 0, c = 0;
    for (let i = 0; i < n; i++) {
      e += opciones[i][estado[i]].coste;
      for (let j = i + 1; j < n; j++) c += choques(opciones[i][estado[i]], opciones[j][estado[j]]);
    }
    return { e: e + 1000 * c, c };
  };
  let semilla = 20261116;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  let mejor = null;
  const PASOS = 400000;
  for (let paso = 0; paso < PASOS; paso++) {
    const T = 400 * Math.pow(0.5 / 400, paso / PASOS);
    const i = Math.floor(azar() * n);
    const k = Math.floor(azar() * opciones[i].length);
    const delta = local(i, k) - local(i, estado[i]);
    if (delta <= 0 || azar() < Math.exp(-delta / T)) estado[i] = k;
    if (paso % 1000 === 999 || paso === PASOS - 1) {
      const t = total();
      if (t.c === 0 && (!mejor || t.e < mejor.e)) mejor = { e: t.e, estado: [...estado] };
    }
  }
  if (!mejor) throw new Error(`${nombre}: no encuentro sitio para todas las etiquetas sin que se pisen`);
  return new Map(ms.map((m, i) => [m.id, opciones[i][mejor.estado[i]].et]));
}

/* ---------- 3. comprobar en la página de verdad ---------- */
async function comprobar(pagina, vista) {
  await pagina.setViewportSize({ width: vista.ancho, height: 900 });
  return pagina.evaluate((esperada) => {
    const svgs = [...document.querySelectorAll('.alr-mapa__svg')].filter((s) => getComputedStyle(s).display !== 'none');
    if (svgs.length !== 1) return { error: `se ven ${svgs.length} mapas` };
    const svg = svgs[0];
    if (svg.dataset.disposicion !== esperada) return { error: `se ve el ${svg.dataset.disposicion}, no el ${esperada}` };
    const marco = svg.getBoundingClientRect();
    const etq = [...svg.querySelectorAll('[data-marca]')].map((g) => ({ id: g.dataset.marca, r: g.querySelector('.alr-mapa__etq').getBoundingClientRect() }));
    let minimo = Infinity, choques = [], fuera = [];
    for (let i = 0; i < etq.length; i++) {
      const a = etq[i].r;
      if (a.left < marco.left || a.top < marco.top || a.right > marco.right || a.bottom > marco.bottom) fuera.push(etq[i].id);
      for (let j = i + 1; j < etq.length; j++) {
        const b = etq[j].r;
        const sx = Math.max(b.left - a.right, a.left - b.right), sy = Math.max(b.top - a.bottom, a.top - b.bottom);
        const sep = Math.max(sx, sy);   // < 0: se pisan
        if (sep < minimo) minimo = sep;
        if (sep < 0) choques.push(`${etq[i].id}/${etq[j].id}`);
      }
    }
    return { marcas: etq.length, minimo: Math.round(minimo * 10) / 10, choques, fuera, escala: marco.width / svg.viewBox.baseVal.width };
  }, vista.disp);
}

/* ---------- todo junto ---------- */
async function medirYComprobar(etiquetadas) {
  const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });   // sin WebGL: aquí no hay 3D
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    await pg.setContent(pagina(svgMedir('ancho') + svgMedir('estrecho')), { waitUntil: 'load' });
    const letra = await pg.evaluate(async () => {
      await Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 16px "Hanken Grotesk"`)));
      await document.fonts.ready;
      return ['500', '600'].every((w) => document.fonts.check(`${w} 16px "Hanken Grotesk"`));
    });
    if (!letra) throw new Error('Hanken Grotesk no se ha cargado: sin ella las medidas no valen (¿hay red?)');
    const cajas = await pg.evaluate(() => {
      const res = {};
      for (const svg of document.querySelectorAll('svg[data-medir]')) {
        const d = (res[svg.dataset.medir] = {});
        for (const t of svg.querySelectorAll('text[data-m]')) {
          const b = t.getBBox();
          d[`${t.dataset.m}|${t.dataset.lado}`] = { x: b.x, y: b.y, width: b.width, height: b.height };
        }
      }
      return res;
    });
    // por si la búsqueda falla: las medidas quedan en el temporal para depurar
    fs.writeFileSync(path.join(os.tmpdir(), 'casal-etiquetas-cajas.json'), JSON.stringify(cajas));
    const res = etiquetadas(cajas);
    // el mapa ya colocado, con la hoja de estilos de la web, a 360, 390 y 1280
    await pg.setContent(pagina(figuraMapa([], datosMapa, res.sitios, (slug) => `#${slug}`)), { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    const informes = [];
    for (const v of VISTAS) informes.push({ ...v, ...(await comprobar(pg, v)) });
    await ctx.close();
    return { ...res, informes };
  } finally {
    await browser.close();
  }
}

function colocarTodas(cajas) {
  const nuevo = structuredClone(sitios);
  const movidas = {};
  for (const nombre of Object.keys(DISPOSICIONES)) {
    const ets = buscar(nombre, cajas[nombre]);
    movidas[nombre] = [];
    const todas = [['casa', nuevo.casa], ...nuevo.sitios.map((s, i) => [String(i), s])];
    for (const [id, s] of todas) {
      const et = ets.get(id);
      s.etiqueta = { ...(s.etiqueta || {}), [nombre]: et };
      if (et.lado !== POR_DEFECTO.lado || et.dx || et.dy) movidas[nombre].push(`${s.nombre}: ${et.lado} ${et.dx},${et.dy}`);
    }
  }
  // el orden de siempre: ancho y luego estrecho
  for (const s of [nuevo.casa, ...nuevo.sitios]) s.etiqueta = { ancho: s.etiqueta.ancho, estrecho: s.etiqueta.estrecho };
  return { sitios: nuevo, movidas };
}

if (SIN_NAVEGADOR) {
  const { movidas } = colocarTodas({ ancho: estimar('ancho'), estrecho: estimar('estrecho') });
  for (const [n, l] of Object.entries(movidas)) console.log(`${n}: ${l.length} de 12 movidas\n  ${l.join('\n  ')}`);
  console.log('(estimado, sin navegador: no se escribe nada)');
} else {
  const { sitios: nuevo, movidas, informes } = await medirYComprobar(colocarTodas);
  for (const [n, l] of Object.entries(movidas)) console.log(`${n}: ${l.length} de 12 etiquetas fuera de su sitio por defecto (este, sin desplazar)\n  ${l.join('\n  ')}`);
  let mal = false;
  for (const i of informes) {
    if (i.error) { mal = true; console.log(`${i.ancho} px: ${i.error}`); continue; }
    const ok = i.marcas === 12 && !i.choques.length && !i.fuera.length;
    if (!ok) mal = true;
    console.log(`${i.ancho} px (${i.disp}, escala ${i.escala.toFixed(2)}): ${i.marcas} marcas, separación mínima ${i.minimo} px${i.choques.length ? `, SE PISAN ${i.choques.join(' ')}` : ''}${i.fuera.length ? `, FUERA ${i.fuera.join(' ')}` : ''}`);
  }
  if (mal) { console.error('Las etiquetas no caben sin pisarse: no se escribe alrededores.json.'); process.exit(1); }
  const texto = JSON.stringify(nuevo, null, 2) + '\n';
  if (fs.existsSync(F_SITIOS) && leerTexto(F_SITIOS) === texto) console.log('alrededores.json: sin cambios.');
  else { fs.writeFileSync(F_SITIOS, texto); console.log('alrededores.json: etiquetas guardadas.'); }
}
