/* Pruebas de scripts/diff-origen.mjs (spec 002 §3.8, PD-7, T02).
   Se ejecutan desde scripts/pruebas-build.mjs (import './pruebas-diff-origen.mjs'),
   así que `node --test scripts/pruebas-build.mjs` también las corre.
   Cada prueba monta en un directorio temporal una «raíz de repo» mínima (una
   copia del script, datos/mapa-url.json, origen.md, la página construida) y un
   pages.json de ejemplo, y lanza el script con --ref. No toca el repo ni el
   pages.json de verdad. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { frases, normalizar, textoDeMain } from './diff-origen.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'diff-origen.mjs');
const CABECERA = '# 002 · Origen\n\nCabecera de prueba.\n';

const wp = (...parrafos) => `<div class="elementor"><section><!-- wp:paragraph -->${parrafos.map((p) => `<p>${p}</p>`).join('\n')}<style>.x{color:red}</style><script>var a = "No cuenta este texto de script";</script></section></div>`;
const pagina = (...parrafos) => `<!doctype html><html><head><title>Hola</title></head><body><header><nav>Texto de menú que no cuenta</nav></header><main id="principal">${parrafos.map((p) => `<p>${p}</p>`).join('\n')}<script>var b = "Tampoco este";</script></main><footer>Pie que no cuenta</footer></body></html>`;

/* Monta la raíz de prueba. `paginas`: { slug: html construido }, `wpPaginas`: { slug: html de WordPress },
   `origen`: el texto de origen.md, `mapa`: entradas de mapa-url.json. Devuelve helpers. */
function montar({ paginas = {}, wpPaginas = {}, origen = CABECERA, mapa = [], sinPagesJson = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-origen-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'diff-origen.mjs'));
  fs.mkdirSync(path.join(dir, 'datos'));
  fs.writeFileSync(path.join(dir, 'datos', 'mapa-url.json'), JSON.stringify(mapa));
  const dirOrigen = path.join(dir, 'specs', '002-paginas-interiores');
  fs.mkdirSync(dirOrigen, { recursive: true });
  fs.writeFileSync(path.join(dirOrigen, 'origen.md'), origen);
  for (const [slug, html] of Object.entries(paginas)) {
    fs.mkdirSync(path.join(dir, slug), { recursive: true });
    fs.writeFileSync(path.join(dir, slug, 'index.html'), html);
  }
  if (!sinPagesJson) {
    const lista = Object.entries(wpPaginas).map(([slug, html], i) => ({ id: i + 1, slug, link: `https://ejemplo.test/${slug}/`, title: { rendered: slug }, content: { rendered: html, protected: false } }));
    fs.writeFileSync(path.join(dir, 'pages.json'), JSON.stringify(lista));
  }
  const origenMd = () => fs.readFileSync(path.join(dirOrigen, 'origen.md'), 'utf8');
  const lanzar = (...args) => {
    const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'diff-origen.mjs'), ...args, ...(args.includes('--ref') ? [] : ['--ref', path.join(dir, 'pages.json')])], { cwd: dir, encoding: 'utf8' });
    return { codigo: r.status, salida: String(r.stdout) + String(r.stderr) };
  };
  return { dir, origenMd, lanzar, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const FALTA = 'Esta frase de la casa antigua ya no está en la página nueva';
const ESTA = 'Esta frase sí que está en las dos páginas sin cambios';

test('T02 · normalizar y frases: minúsculas, sin signos ni etiquetas, y las de menos de 4 palabras no cuentan', () => {
  assert.equal(normalizar('  ¡Hola,   MUNDO!  Más… cosas: “así”. '), 'hola mundo más cosas así');
  const f = frases(wp('Buenas noches, &laquo;Casa&raquo;&nbsp;de &#8220;Casal&#8221;. Otra frase distinta &amp; larga', 'Reservar', 'Dos palabras', '<a href="/x/">Ver</a> <strong>más</strong> cosas hoy', 'De 1.05 a 10:30 abierto siempre'));
  assert.deepEqual(f, ['buenas noches casa de casal', 'otra frase distinta larga', 'ver más cosas hoy', 'de 1 05 a 10 30 abierto siempre']);
  assert.ok(!f.some((x) => /script|color red|reservar/.test(x)), 'no se cuela el script, el estilo ni una frase corta');
  assert.equal(textoDeMain(pagina('Hola mundo')), 'hola mundo');
  assert.ok(!textoDeMain(pagina('Hola')).includes('menú') && !textoDeMain(pagina('Hola')).includes('script'));
});

test('T02 · una frase que falta y no tiene línea en origen.md es un error y no escribe nada', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA) }, origen: CABECERA + '\n## casa\n' });
  try {
    const antes = t.origenMd();
    const r = t.lanzar('casa');
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /falta y no tiene línea/);
    assert.match(r.salida, /esta frase de la casa antigua/);
    assert.equal(t.origenMd(), antes);
  } finally { t.limpiar(); }
});

test('T02 · con su línea y un motivo válido, sale bien', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA) }, origen: CABECERA + `\n## casa\n\n- «${normalizar(FALTA)}» · P-26: ya no trabaja con ella\n` });
  try {
    const r = t.lanzar('casa');
    assert.equal(r.codigo, 0, r.salida);
  } finally { t.limpiar(); }
});

test('T02 · todos los motivos de §3.8 valen y uno inventado no', () => {
  const motivos = ['franja', 'botón', 'repetida', 'errata', 'corrección §3.4', 'P-04', 'D-016', 'regla de dueños', 'enlace caído', '301 → /servicios/'];
  const frasesWp = motivos.map((m, i) => `Frase número ${i} de la casa que no se lleva`);
  const lineas = (ms) => ms.map((m, i) => `- «${normalizar(frasesWp[i])}» · ${m}`).join('\n');
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, ...frasesWp) }, origen: `${CABECERA}\n## casa\n\n${lineas(motivos)}\n` });
  try {
    assert.equal(t.lanzar('casa').codigo, 0);
  } finally { t.limpiar(); }
  const t2 = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA) }, origen: `${CABECERA}\n## casa\n\n- «${normalizar(FALTA)}» · porque sí\n` });
  try {
    const r = t2.lanzar('casa');
    assert.equal(r.codigo, 1);
    assert.match(r.salida, /motivo no válido/);
  } finally { t2.limpiar(); }
});

test('T02 · un motivo «?» es un error', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA) }, origen: `${CABECERA}\n## casa\n\n- «${normalizar(FALTA)}» · ?\n` });
  try {
    const r = t.lanzar('casa');
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /sin rellenar/);
  } finally { t.limpiar(); }
});

test('T02 · una frase corta (menos de 4 palabras) no hace falta apuntarla', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, 'Reserva ya', 'Más información aquí', 'Ver todo') }, origen: CABECERA });
  try {
    const r = t.lanzar('casa');
    assert.equal(r.codigo, 0, r.salida);
  } finally { t.limpiar(); }
});

test('T02 · la frase se busca como subcadena del texto del <main>, sin importar mayúsculas, signos ni etiquetas', () => {
  const t = montar({ paginas: { casa: pagina('Introducción. <em>Esta</em> frase <b>sí</b> que está, EN las dos: páginas (sin cambios).') }, wpPaginas: { casa: wp('Esta frase sí que está en las dos páginas sin cambios') }, origen: CABECERA });
  try {
    assert.equal(t.lanzar('casa').codigo, 0);
  } finally { t.limpiar(); }
});

test('T02 · un slug 301 se compara con la página de su destino', () => {
  const mapa = [{ ruta: '/viejo/', accion: '301', destino: '/servicios/' }, { ruta: '/servicios/', accion: 'pagina', destino: '/servicios/' }];
  const t = montar({ mapa, paginas: { servicios: pagina(ESTA) }, wpPaginas: { viejo: wp(ESTA, FALTA) }, origen: CABECERA });
  try {
    const sin = t.lanzar('viejo');
    assert.equal(sin.codigo, 1, sin.salida);
    assert.match(sin.salida, /esta frase de la casa antigua/);
    fs.appendFileSync(path.join(t.dir, 'specs', '002-paginas-interiores', 'origen.md'), `\n## viejo\n\n- «${normalizar(FALTA)}» · 301 → /servicios/\n`);
    assert.equal(t.lanzar('viejo').codigo, 0);
  } finally { t.limpiar(); }
  // la portada es el destino «/»
  const t2 = montar({ mapa: [{ ruta: '/proba/', accion: '301', destino: '/' }], wpPaginas: { proba: wp(ESTA) }, origen: CABECERA });
  try {
    fs.writeFileSync(path.join(t2.dir, 'index.html'), pagina(ESTA));
    assert.equal(t2.lanzar('proba').codigo, 0);
  } finally { t2.limpiar(); }
});

test('T02 · --fuente suma las frases de otra página a la misma sección', () => {
  const t = montar({ paginas: { servicios: pagina(ESTA) }, wpPaginas: { servicios: wp(ESTA), extra: wp(FALTA) }, origen: CABECERA });
  try {
    assert.equal(t.lanzar('servicios').codigo, 0);
    const r = t.lanzar('servicios', '--fuente', 'extra');
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /esta frase de la casa antigua/);
  } finally { t.limpiar(); }
});

test('T02 · --escribir añade al final de la sección lo que falta con «?», crea la sección y no toca lo demás', () => {
  const otra = 'Otra frase que tampoco se ha llevado a la página nueva';
  const origen = `${CABECERA}\n## antes\n\n- «lo de otra sección» · franja\n\n## casa\n\n- «${normalizar('Una línea que ya estaba escrita antes de todo')}» · errata\n\n## despues\n\n- «y esta de después» · botón\n`;
  const t = montar({ paginas: { casa: pagina(ESTA), nueva: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA, otra), nueva: wp(ESTA, FALTA) }, origen });
  try {
    const r = t.lanzar('casa', '--escribir');
    assert.equal(r.codigo, 1, 'un «?» sigue siendo error');
    const lineas = t.origenMd().split('\n');
    const i = lineas.indexOf('## casa');
    assert.deepEqual(lineas.slice(i, i + 6), ['## casa', '', `- «${normalizar('Una línea que ya estaba escrita antes de todo')}» · errata`, `- «${normalizar(FALTA)}» · ?`, `- «${normalizar(otra)}» · ?`, '']);
    assert.ok(lineas.includes('- «lo de otra sección» · franja') && lineas.includes('- «y esta de después» · botón'));
    // segunda vez: ya están apuntadas, no duplica
    t.lanzar('casa', '--escribir');
    assert.equal(t.origenMd().split('\n').filter((l) => l.endsWith('· ?')).length, 2);
    // sección nueva
    t.lanzar('nueva', '--escribir');
    const fin = t.origenMd().trimEnd().split('\n');
    assert.deepEqual(fin.slice(-3), ['## nueva', '', `- «${normalizar(FALTA)}» · ?`]);
  } finally { t.limpiar(); }
});

test('T02 · sin pages.json sale con error y no escribe nada (tampoco con --escribir)', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, sinPagesJson: true });
  try {
    const antes = t.origenMd();
    for (const args of [['casa'], ['casa', '--escribir'], ['--todas', '--escribir']]) {
      const r = t.lanzar(...args);
      assert.equal(r.codigo, 1, r.salida);
      assert.match(r.salida, /no encuentro pages\.json/);
      assert.equal(t.origenMd(), antes);
    }
  } finally { t.limpiar(); }
});

test('T02 · un slug que no está en pages.json o una página sin construir salen con error sin escribir', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA), sinconstruir: wp(ESTA, FALTA) } });
  try {
    const antes = t.origenMd();
    const a = t.lanzar('noexiste', '--escribir');
    assert.equal(a.codigo, 1);
    assert.match(a.salida, /no está en pages\.json/);
    const b = t.lanzar('sinconstruir', '--escribir');
    assert.equal(b.codigo, 1);
    assert.match(b.salida, /no está construida/);
    const c = t.lanzar('casa', '--fuente', 'noexiste', '--escribir');
    assert.equal(c.codigo, 1);
    assert.match(c.salida, /no está en pages\.json/);
    assert.equal(t.origenMd(), antes);
  } finally { t.limpiar(); }
});

test('T02 · argumentos mal puestos salen con error y no escriben', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA, FALTA) } });
  try {
    const antes = t.origenMd();
    for (const args of [[], ['--escribir'], ['casa', 'otra'], ['--todas', 'casa'], ['casa', '--raro'], ['casa', '--fuente'], ['../casa', '--escribir']]) {
      const r = t.lanzar(...args);
      assert.equal(r.codigo, 1, JSON.stringify(args) + ' → ' + r.salida);
    }
    assert.equal(t.origenMd(), antes);
  } finally { t.limpiar(); }
});

test('T02 · --todas falla si alguna de las 23 secciones no tiene su página en pages.json', () => {
  const t = montar({ paginas: { casa: pagina(ESTA) }, wpPaginas: { casa: wp(ESTA) } });
  try {
    const antes = t.origenMd();
    const r = t.lanzar('--todas', '--escribir');
    assert.equal(r.codigo, 1);
    assert.match(r.salida, /no está en pages\.json/);
    assert.equal(t.origenMd(), antes);
  } finally { t.limpiar(); }
});
