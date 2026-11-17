/* Pruebas de la construcción (spec 001 §10, PD-3): lo que se comprueba leyendo
   los HTML generados y los JSON, sin navegador.
   Uso: node construir.mjs && node --test scripts/pruebas-build.mjs
   Cada criterio «build» de la spec tiene aquí su prueba; las que aún no ha
   activado su tarea van como test.todo (no cuentan como fallo). Lo que necesita
   navegador está en verificar.mjs como PENDIENTE.
   Cada grupo va bajo el comentario de la tarea que lo activa: escribe solo
   bajo el tuyo. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import './pruebas-diff-origen.mjs'; // T02 (spec 002): scripts/diff-origen.mjs

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Ejecuta construir.mjs en `dir` (por defecto, el repo). Devuelve
   { ok, salida }: ok es false si la construcción ha fallado. */
function construir(dir = RAIZ) {
  try {
    const salida = execFileSync(process.execPath, [path.join(dir, 'construir.mjs')], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, salida };
  } catch (e) {
    return { ok: false, salida: String(e.stdout || '') + String(e.stderr || '') };
  }
}

/* Lee un fichero de la salida (rutas con «/», p. ej. 'tu-habitacion/index.html'). */
const leer = (rel, dir = RAIZ) => fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
const leerJSON = (rel, dir = RAIZ) => JSON.parse(leer(rel, dir));
const existe = (rel, dir = RAIZ) => fs.existsSync(path.join(dir, ...rel.split('/')));

/* Páginas generadas en `dir`: index.html, 404.html y <slug>/index.html por
   cada paginas/<slug>.src.html. */
function paginasGeneradas(dir = RAIZ) {
  const lista = ['index.html'];
  const pag = path.join(dir, 'paginas');
  if (fs.existsSync(pag)) for (const f of fs.readdirSync(pag).filter((x) => x.endsWith('.src.html'))) lista.push(f.slice(0, -'.src.html'.length) + '/index.html');
  if (fs.existsSync(path.join(dir, '404.src.html'))) lista.push('404.html');
  return lista;
}

/* Copia del repo en un directorio temporal, para construir con fuentes de
   ejemplo sin tocar el de verdad. Sin .git, sin las fotos (solo fotos.json) y
   sin lo que no se construye. Se borra al terminar las pruebas. */
const temporales = [];
function copiaTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casal-build-'));
  temporales.push(dir);
  const fuera = new Set(['.git', 'node_modules', 'pruebas', 'specs', 'marca']);
  fs.cpSync(RAIZ, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(RAIZ, src).split(path.sep);
      if (fuera.has(rel[0])) return false;
      if (rel[0] === 'img') return rel.length === 1 || (rel[1] === 'fotos' && (rel.length === 2 || rel[2] === 'fotos.json'));
      return true;
    },
  });
  return dir;
}
after(() => { for (const d of temporales) fs.rmSync(d, { recursive: true, force: true }); });

/* Página de ejemplo para la copia temporal: usa los parciales comunes y una foto. */
const FOTO_EJEMPLO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'))[0].nombre;
const paginaEjemplo = (menu = 'habitaciones', cuerpo = '') => `<!--pagina {"titulo":"Prueba · Casa de Casal","descripcion":"Página de prueba","menu":"${menu}"}-->
<!DOCTYPE html>
<html lang="es" data-raiz="{{raiz}}">
<head>
<!-- @incluye head -->
</head>
<body>
<!-- @incluye cabecera -->
<main id="principal"><h1>Prueba</h1><img data-foto="${FOTO_EJEMPLO}" alt="">${cuerpo}</main>
<!-- @incluye pie -->
<!-- @incluye cookies -->
<!-- @incluye scripts -->
</body>
</html>
`;

/* Construye una copia temporal con la página de ejemplo en paginas/prueba.src.html
   (o con lo que se pase) y devuelve { dir, ok, salida }. */
function construirEjemplo(fuente = paginaEjemplo()) {
  const dir = copiaTemporal();
  fs.mkdirSync(path.join(dir, 'paginas'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'paginas', 'prueba.src.html'), fuente);
  return { dir, ...construir(dir) };
}

before(() => {
  const r = construir();
  if (!r.ok) throw new Error('node construir.mjs ha fallado:\n' + r.salida);
});

test('la construcción termina y genera la portada', () => {
  // si `before` falla, ningún test llega aquí
  if (!existe('index.html')) throw new Error('falta index.html');
});

// T02 · construcción de varias páginas

// ruta absoluta a la propia web: empieza por «/» (también «//») o va a su dominio
const RE_PROPIA = /^(?:\/|(?:https?:)?\/\/(?:www\.)?(?:casadecasal\.com|alvarotaiagu\.github\.io)(?:[/:?#]|$))/i;
function rutasPropiasAbsolutas(html) {
  const malas = [];
  for (const m of html.matchAll(/\b(href|src|srcset|imagesrcset|poster)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
    const urls = /srcset$/i.test(m[1]) ? m[3].split(',').map((c) => c.trim().split(/\s+/)[0]) : [m[3].trim()];
    for (const u of urls) if (RE_PROPIA.test(u)) malas.push(`${m[1]}="${u}"`);
  }
  for (const m of html.matchAll(/url\(\s*['"]?\s*\/[^)]*\)/gi)) malas.push(m[0]);
  return malas;
}

/* La copia de ejemplo se construye una vez y la comparten las pruebas de T02. */
let ejemplo;
const conEjemplo = () => {
  if (!ejemplo) {
    ejemplo = construirEjemplo();
    assert.ok(ejemplo.ok, 'la página de ejemplo debería construirse:\n' + ejemplo.salida);
  }
  return ejemplo;
};

/* Mete `cambio` en una fuente de una copia temporal y devuelve la construcción. */
function construirCon(rel, cambiar) {
  const dir = copiaTemporal();
  const f = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, cambiar(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''));
  return { dir, ...construir(dir) };
}
const conEnlace = (trozo) => (html) => html.replace('<main id="principal">', '<main id="principal">' + trozo);

test('CA-2 · ningún HTML generado, salvo 404.html, tiene href o src que empiece por / y apunte a la propia web', () => {
  for (const rel of paginasGeneradas().filter((p) => p !== '404.html')) {
    assert.deepEqual(rutasPropiasAbsolutas(leer(rel)), [], rel);
  }
  const { dir } = conEjemplo();
  assert.deepEqual(rutasPropiasAbsolutas(leer('prueba/index.html', dir)), [], 'prueba/index.html');
});

test('CA-2 · una ruta /x metida en una fuente hace fallar la construcción', () => {
  const r = construirCon('index.src.html', conEnlace('<a href="/x">x</a>'));
  assert.equal(r.ok, false, 'la construcción debería fallar');
  assert.match(r.salida, /ruta absoluta.*href="\/x"/);
  // y no escribe nada: el index.html de la copia sigue siendo el de antes
  assert.equal(leer('index.html', r.dir), leer('index.html'));
});

test('§3.1.3 · srcset, imagesrcset, poster, url(/…) del HTML y del CSS y // propios hacen fallar la construcción', () => {
  const casos = {
    srcset: '<img srcset="img/a.jpg 1x, /img/a.jpg 2x" alt="">',
    imagesrcset: '<link rel="preload" as="image" imagesrcset="/img/a.jpg 480w">',
    'srcset en varias líneas': '<img srcset="img/a.jpg 480w,\n      /img/a.jpg 800w" alt="">',
    poster: '<video poster="/img/a.jpg"></video>',
    'url(/…) en el HTML': '<div style="background:url(/img/a.jpg)"></div>',
    '//': '<a href="//casadecasal.com/entorno/">x</a>',
    'dominio propio': '<a href="https://www.casadecasal.com/entorno/">x</a>',
    'src en una página interior': null,
  };
  for (const [nombre, trozo] of Object.entries(casos)) {
    const r = trozo
      ? construirCon('index.src.html', conEnlace(trozo))
      : construirCon('paginas/prueba.src.html', () => paginaEjemplo('casa', '<img src="/img/og.jpg" alt="">'));
    assert.equal(r.ok, false, `${nombre}: la construcción debería fallar`);
    assert.match(r.salida, /ruta absoluta/, nombre);
  }
  const css = construirCon('css/estilos.css', (c) => c + '\n.x { background: url("/img/og.jpg"); }\n');
  assert.equal(css.ok, false, 'url(/…) en css/estilos.css debería romper la construcción');
  assert.match(css.salida, /css\/estilos\.css: ruta absoluta/);
  // un enlace externo normal sí vale
  assert.ok(construirCon('index.src.html', conEnlace('<a href="https://www.openstreetmap.org/">x</a>')).ok);
});

test('§3.1.3 · un {{ sin resolver o un <base> hacen fallar la construcción', () => {
  const hueco = construirCon('index.src.html', conEnlace('<p>{{casa.nada}}</p>'));
  assert.equal(hueco.ok, false);
  assert.match(hueco.salida, /hueco sin resolver.*\{\{casa\.nada\}\}/);
  const base = construirCon('index.src.html', (h) => h.replace('<head>', '<head>\n<base href="./">'));
  assert.equal(base.ok, false);
  assert.match(base.salida, /<base>/);
  const parcial = construirCon('index.src.html', (h) => h.replace('<!-- @incluye barra -->', '<!-- @incluye no-existe -->'));
  assert.equal(parcial.ok, false);
  assert.match(parcial.salida, /parciales\/no-existe\.html/);
});

test('§3.1.3 · en la portada {{raiz}}#x sale como #x', () => {
  const html = leer('index.html');
  assert.doesNotMatch(html, /href="\.\/#/, 'ningún ./#x en la portada');
  assert.match(html, /<nav class="cab__nav"[^>]*>\s*<a href="#casa">La casa<\/a>/);
  const { dir } = conEjemplo();
  assert.match(leer('prueba/index.html', dir), /<a href="\.\.\/#casa">La casa<\/a>/, 'en una interior, ../#casa');
});

test('§3.1.3 · <html data-raiz> en todas las páginas, con la raíz de su profundidad', () => {
  // la 404 es la excepción de §9: sus rutas las calcula su propio script (T03)
  assert.match(leer('index.html'), /<html lang="es" data-raiz="\.\/">/);
  const { dir } = conEjemplo();
  assert.match(leer('prueba/index.html', dir), /<html lang="es" data-raiz="\.\.\/">/);
});

test('§3.1.4 · las fotos llevan la raíz de su página y CSS y JS llevan ?v= también bajo <slug>/', () => {
  const portada = leer('index.html');
  assert.match(portada, /<img src="\.\/img\/fotos\/[^"]+\.jpg" srcset="\.\/img\/fotos\//);
  const { dir } = conEjemplo();
  const html = leer('prueba/index.html', dir);
  assert.match(html, new RegExp(`<source type="image/avif" srcset="\\.\\./img/fotos/${FOTO_EJEMPLO}-`));
  assert.match(html, new RegExp(`<img src="\\.\\./img/fotos/${FOTO_EJEMPLO}-\\d+\\.jpg"`));
  const v = (h, f) => (new RegExp(`(?:\\./|\\.\\./)${f.replace('.', '\\.')}\\?v=([0-9a-f]{8})"`).exec(h) || [])[1];
  for (const f of ['css/estilos.css', 'js/comun.js']) {
    assert.ok(v(html, f), `${f} lleva ?v= en prueba/index.html`);
    assert.equal(v(html, f), v(leer('index.html', dir), f), `${f}: la misma huella en la portada y bajo <slug>/`);
  }
});

test('§3.1.6 · el menú tiene los seis enlaces y Reservar, en orden, con aria-current según la página', () => {
  const enlaces = (html, sel) => {
    const nav = new RegExp(`${sel}[\\s\\S]*?</nav>`).exec(html)[0];
    return [...nav.matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g)].map((m) => [m[1], m[3], !!m[2]]);
  };
  const portada = leer('index.html');
  const esperado = [['#casa', 'La casa'], ['./tu-habitacion/', 'Habitaciones'], ['#finca', 'La finca'], ['./pico-sacro-v2/', 'El Pico'], ['./entorno/', 'Entorno'], ['#llegar', 'Cómo llegar']];
  assert.deepEqual(enlaces(portada, '<nav class="cab__nav"'), esperado.map(([h, t]) => [h, t, false]));
  assert.deepEqual(enlaces(portada, '<div class="menu-movil"'), [...esperado, ['#reserva', 'Reservar']].map(([h, t]) => [h, t, false]));
  assert.match(portada, /<a class="btn btn--oro cab__cta" href="#reserva">Reservar<\/a>/);

  const { dir } = conEjemplo();
  const html = leer('prueba/index.html', dir);
  const actuales = [...html.matchAll(/<a href="([^"]*)" aria-current="page">/g)].map((m) => m[1]);
  assert.deepEqual(actuales, ['../tu-habitacion/', '../tu-habitacion/'], 'aria-current solo en Habitaciones (escritorio y móvil)');
  assert.equal(enlaces(html, '<nav class="cab__nav"')[0][0], '../#casa');
});

test('§3.1.9 · noindex,nofollow en todas las páginas generadas', () => {
  for (const rel of paginasGeneradas()) assert.match(leer(rel), /<meta name="robots" content="noindex,nofollow">/, rel);
  const { dir } = conEjemplo();
  assert.match(leer('prueba/index.html', dir), /<meta name="robots" content="noindex,nofollow">/);
});

// T03 · legales en carpeta y 404

const LEGALES = ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad'];

/* Los tres bloques comunes de una página generada, para compararlos entre
   páginas: la cabecera (del «Saltar al contenido» al final del menú móvil), el
   pie y el aviso de cookies. Se quita lo que la spec permite que cambie: la raíz
   relativa (./, ../) y aria-current. En la portada {{raiz}}#x sale como #x, así
   que en todas se deja el ancla a pelo. */
const BLOQUES = {
  cabecera: /<a class="saltar"[\s\S]*?<div class="menu-movil"[\s\S]*?\n<\/div>/,
  pie: /<footer class="pie"[\s\S]*?<\/footer>/,
  cookies: /<div class="cookies"[\s\S]*?\n<\/div>/,
};
function bloque(html, nombre, rel) {
  const m = BLOQUES[nombre].exec(html);
  assert.ok(m, `${rel}: no se encuentra el bloque «${nombre}»`);
  return m[0]
    .replace(/ aria-current="page"/g, '')
    .replace(/\b(href|src|srcset)="(?:\.\/|(?:\.\.\/)+)/g, '$1="{raiz}')
    .replace(/href="\{raiz\}#/g, 'href="#');
}

test('CA-4 · cabecera, pie y aviso de cookies idénticos en la portada y los cuatro legales (salvo {{raiz}} y aria-current)', () => {
  const portada = leer('index.html');
  for (const nombre of Object.keys(BLOQUES)) {
    const esperado = bloque(portada, nombre, 'index.html');
    for (const slug of LEGALES) {
      const rel = `${slug}/index.html`;
      assert.equal(bloque(leer(rel), nombre, rel), esperado, `${rel}: el bloque «${nombre}» no es el de la portada`);
    }
  }
  // y lo que sí cambia, cambia bien: en un legal el menú lleva a la portada con ../
  assert.match(leer('cookies/index.html'), /<nav class="cab__nav"[^>]*>\s*<a href="\.\.\/#casa">La casa<\/a>/);
  assert.doesNotMatch(BLOQUES.cabecera.exec(leer('cookies/index.html'))[0], /aria-current="page"/, 'los legales no están en el menú (en el pie, su enlace sí lleva aria-current: CA-5 de la 002)');
});

test('§3.1.8 bis · existen aviso-legal/, privacidad/, cookies/ y accesibilidad/ con index.html y no los de la raíz', () => {
  for (const slug of LEGALES) {
    assert.ok(existe(`${slug}/index.html`), `falta ${slug}/index.html`);
    assert.ok(existe(`paginas/${slug}.src.html`), `falta paginas/${slug}.src.html`);
    for (const viejo of [`${slug}.html`, `${slug}.src.html`]) assert.ok(!existe(viejo), `sobra ${viejo} en la raíz`);
    const html = leer(`${slug}/index.html`);
    assert.doesNotMatch(html, /class="legal-(cab|pie)"/, `${slug}: sin la cabecera ni el pie propios de antes`);
    assert.match(html, /<html lang="es" data-raiz="\.\.\/"/, `${slug}: data-raiz de una subcarpeta`);
  }
  // ninguna página enlaza ya a los legales viejos
  for (const rel of paginasGeneradas()) assert.doesNotMatch(leer(rel), /href="[^"]*(aviso-legal|privacidad|cookies|accesibilidad)\.html"/, rel);
});

test('§3.1.8 bis · las fuentes de los legales son las que genera scripts/legales.mjs', () => {
  // los textos se cambian en legales.mjs: un retoque a mano en paginas/ se perdería
  const dir = copiaTemporal();
  execFileSync(process.execPath, [path.join(dir, 'scripts', 'legales.mjs')], { cwd: dir, stdio: 'pipe' });
  for (const slug of LEGALES) {
    const rel = `paginas/${slug}.src.html`;
    assert.equal(leer(rel, dir).replace(/\r\n/g, '\n'), leer(rel).replace(/\r\n/g, '\n'), `${rel} no coincide con lo que genera legales.mjs`);
  }
  assert.equal(leer('404.src.html', dir), leer('404.src.html'), 'legales.mjs ya no escribe el 404');
});

test('§3.1.8 bis · ningún legal dice «C/ Pedro Ballesteros» y la dirección es «Rúa Pedro Ballesteros, 17»', () => {
  for (const slug of LEGALES) assert.ok(!leer(`${slug}/index.html`).includes('C/ Pedro Ballesteros'), `${slug}/index.html`);
  assert.ok(!leer('scripts/legales.mjs').includes('C/ Pedro Ballesteros'), 'scripts/legales.mjs');
  for (const slug of ['aviso-legal', 'privacidad']) {
    const html = leer(`${slug}/index.html`);
    assert.match(html, /<dd>Rúa Pedro Ballesteros, 17 · 15881 Lestedo, Boqueixón \(A Coruña\)<\/dd>/, slug);
    // el titular y el NIF siguen como PENDIENTE visible (P-05): no se inventan
    assert.match(html, /<p class="aviso">PENDIENTE: nombre o razón social del titular y NIF\/CIF/, slug);
  }
});

test('§8 · privacidad y cookies describen las dos marcas (casal-cookies y cdc-cortina)', () => {
  const privacidad = leer('privacidad/index.html');
  const cookies = leer('cookies/index.html');
  assert.match(privacidad, /Dos marcas técnicas/);
  assert.match(privacidad, /<code>casal-cookies<\/code>, en el almacenamiento local/);
  assert.match(privacidad, /<code>cdc-cortina<\/code>, en el almacenamiento de la sesión[^<]*Se borra sola al cerrar el navegador\./);
  assert.match(privacidad, /<a href="\.\.\/cookies\/">cookies<\/a>/, 'privacidad enlaza a ../cookies/');
  assert.match(cookies, /<b>casal-cookies<\/b> \(almacenamiento local\)/);
  assert.match(cookies, /<b>cdc-cortina<\/b> \(almacenamiento de la sesión\)[^<]*se borra sola al cerrar el navegador\./);
  assert.match(cookies, /en el pie de cada página/);
  assert.doesNotMatch(cookies, /pie de la portada/);
  for (const [slug, html] of [['privacidad', privacidad], ['cookies', cookies]]) assert.doesNotMatch(html, /[Uu]na sola cosa/, `${slug}: ya no es «una sola cosa»`);
});

test('§9 · 404.html no depende de ningún fichero relativo', () => {
  const html = leer('404.html');
  // cada href/src/srcset es de otro dominio, data:, un ancla, tel:/mailto: o empieza por «/»
  const malas = [];
  for (const m of html.matchAll(/\b(href|src|srcset|imagesrcset|poster)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
    const urls = /srcset$/i.test(m[1]) ? m[3].split(',').map((c) => c.trim().split(/\s+/)[0]) : [m[3].trim()];
    for (const u of urls) if (!/^(https:\/\/|data:|#|tel:|mailto:|\/(?!\/))/.test(u)) malas.push(`${m[1]}="${u}"`);
  }
  assert.deepEqual(malas, [], 'rutas relativas en 404.html');
  assert.doesNotMatch(html, /url\(\s*['"]?(?!data:|https:)/, 'url() relativo en el CSS en línea');
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="(?!https:)/, 'ninguna hoja de estilos propia: el CSS va en línea');
  assert.match(html, /<style>[\s\S]*--noche:[\s\S]*<\/style>/, 'el CSS va en línea');
  assert.match(html, /<img class="no__tejado" src="data:image\/png;base64,/, 'el logo va en línea');
  assert.match(html, /<a class="btn" href="\/">Volver a la portada<\/a>/, 'sin JavaScript, «Volver a la portada» va a la raíz');
  for (const h of ['/#casa', '/tu-habitacion/', '/#finca', '/pico-sacro-v2/', '/entorno/', '/#llegar', '/#reserva']) assert.ok(html.includes(`href="${h}"`), `el menú del 404 lleva a ${h}`);
});

test('§9 · el script del 404 pone el prefijo del escaparate a sus enlaces y en la raíz los deja', async () => {
  const { default: vm } = await import('node:vm');
  const html = leer('404.html');
  const codigo = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const hrefs = [...html.matchAll(/<a\b[^>]*href="(\/[^"]*)"/g)].map((m) => m[1]);
  const ejecutar = (ruta) => {
    const enlaces = hrefs.map((h) => ({ h, getAttribute() { return this.h; }, setAttribute(k, v) { this.h = v; } }));
    const document = { querySelectorAll: (sel) => (sel === 'a[href^="/"]' ? enlaces : []) };
    vm.runInNewContext(codigo, { location: { pathname: ruta }, document });
    return enlaces.map((e) => e.h);
  };
  const pre = '/casa-de-casal-lestedo-web/';
  assert.deepEqual(ejecutar(pre + 'tu-habitacion/no-existe'), hrefs.map((h) => pre + h.slice(1)), 'con prefijo');
  assert.equal(ejecutar(pre + 'no-existe/')[0], pre, '«Volver a la portada» con prefijo');
  assert.deepEqual(ejecutar('/tu-habitacion/no-existe'), hrefs, 'sin prefijo, igual');
  assert.equal(ejecutar('/no-existe')[0], '/', '«Volver a la portada» en la raíz');
});

// T04 · mapa de URL y redirecciones

import { validarMapa, estaConstruida } from './lib/mapa-url.mjs';

const mapaUrl = () => leerJSON('datos/mapa-url.json');
const lineasDe = (rel, dir = RAIZ) => leer(rel, dir).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
const sinBarraFinal = (r) => (r.length > 1 && r.endsWith('/') ? r.slice(0, -1) : r);

/* Construye una copia temporal con `json` (texto o lista) como datos/mapa-url.json. */
const construirConMapa = (json) => construirCon('datos/mapa-url.json', () => (typeof json === 'string' ? json : JSON.stringify(json)));
const mapaDeEjemplo = (nombre) => fs.readFileSync(path.join(RAIZ, 'scripts', 'pruebas-datos', nombre), 'utf8');

test('CA-8 · _redirects y .htaccess tienen una regla 301 por cada entrada 301 (20, con la 002) y ninguna por las pendiente', () => {
  const mapa = mapaUrl();
  const r301 = mapa.filter((e) => e.accion === '301');
  assert.equal(r301.length, 20, 'veinte entradas 301 en el mapa (spec 002 §3.2)');
  const redirects = lineasDe('_redirects').map((l) => l.split(/\s+/));
  const htaccess = lineasDe('.htaccess').filter((l) => l.startsWith('RedirectMatch'));
  assert.equal(htaccess.length, 20, '.htaccess: una RedirectMatch por cada 301');
  assert.equal(redirects.length, 40, '_redirects: dos líneas (con y sin barra) por cada 301');
  for (const e of r301) {
    assert.ok(redirects.some(([de, a, c]) => de === e.ruta && a === e.destino && c === '301'), `_redirects: ${e.ruta} → ${e.destino}`);
    assert.ok(htaccess.some((l) => l.startsWith(`RedirectMatch 301 ^${sinBarraFinal(e.ruta)}/?$ ${e.destino}`)), `.htaccess: ${e.ruta} → ${e.destino}`);
  }
  // ninguna regla por las pendiente (ni por las pagina o nueva)
  for (const e of mapa.filter((x) => x.accion !== '301')) {
    const r = sinBarraFinal(e.ruta);
    if (r === '/') continue;
    assert.ok(!redirects.some(([de]) => de === e.ruta || de === r), `_redirects no redirige ${e.ruta} (${e.accion})`);
    assert.ok(!htaccess.some((l) => l.includes(`^${r}/?$`)), `.htaccess no redirige ${e.ruta} (${e.accion})`);
  }
});

test('CA-27 · mapa-url.json tiene 58 entradas y cumple las reglas de §3.2 (con la 002)', () => {
  const mapa = mapaUrl();
  assert.equal(mapa.length, 58);
  assert.deepEqual(validarMapa(mapa), []);
  const cuenta = {};
  for (const e of mapa) cuenta[e.accion] = (cuenta[e.accion] || 0) + 1;
  assert.deepEqual(cuenta, { pagina: 24, '301': 20, nueva: 4, pendiente: 10 }, '54 viejas (24 + 20 + 10) y 4 nuevas (spec 002 §3.2)');
  for (const e of mapa) {
    assert.match(e.ruta, /^\/[a-z0-9\-/.]*$/, e.ruta);
    assert.ok(['ruta', 'accion', 'destino', 'spec', 'nota'].every((k) => k in e), `${e.ruta}: tiene los cinco campos`);
  }
  // los que dice la tabla de §3.2
  const de = (r) => mapa.find((e) => e.ruta === r);
  assert.equal(de('/hoteles-con-encanto-v2/').destino, '/entorno/');
  assert.equal(de('/confirmacion.html').accion, 'pagina');
  assert.equal(de('/home/').destino, '/en/');
  for (const r of ['/aviso-legal/', '/privacidad/', '/cookies/', '/accesibilidad/']) assert.equal(de(r).accion, 'nueva', r);
});

test('CA-27 · un destino //otro.com hace fallar la construcción', () => {
  const r = construirConMapa(mapaDeEjemplo('mapa-url-destino-externo.json'));
  assert.equal(r.ok, false);
  assert.match(r.salida, /mapa-url\.json: .*el destino «\/\/otro\.com»/);
  // y no escribe nada: el _redirects de la copia sigue siendo el de antes
  assert.equal(leer('_redirects', r.dir), leer('_redirects'));
});

test('CA-27 · una ruta repetida hace fallar la construcción', () => {
  const r = construirConMapa(mapaDeEjemplo('mapa-url-ruta-repetida.json'));
  assert.equal(r.ok, false);
  assert.match(r.salida, /\/entorno\/\): ruta repetida/);
});

test('CA-27 · una cadena de 301 hace fallar la construcción', () => {
  const r = construirConMapa(mapaDeEjemplo('mapa-url-cadena.json'));
  assert.equal(r.ok, false);
  assert.match(r.salida, /\/a\/: cadena de 301/);
});

test('CA-27 · un bucle de 301 hace fallar la construcción', () => {
  const r = construirConMapa(mapaDeEjemplo('mapa-url-bucle.json'));
  assert.equal(r.ok, false);
  assert.match(r.salida, /bucle de 301/);
  // también un 301 a sí mismo
  const solo = construirConMapa([{ ruta: '/', accion: 'pagina', destino: '/', spec: '001', nota: '' }, { ruta: '/a/', accion: '301', destino: '/a/', spec: '001', nota: '' }]);
  assert.equal(solo.ok, false);
  assert.match(solo.salida, /bucle de 301/);
});

test('§3.2 · un 301 a una dirección pendiente, que no está o con una ruta fuera de la regla hace fallar la construcción', () => {
  const base = [{ ruta: '/', accion: 'pagina', destino: '/', spec: '001', nota: '' }, { ruta: '/home/', accion: 'pendiente', destino: '/en/', spec: '004', nota: '' }];
  const casos = {
    'a una pendiente': [...base, { ruta: '/a/', accion: '301', destino: '/home/', spec: '001', nota: '' }],
    'a una que no está': [...base, { ruta: '/a/', accion: '301', destino: '/no-esta/', spec: '001', nota: '' }],
    'a otro dominio': [...base, { ruta: '/a/', accion: '301', destino: 'https://otro.com/', spec: '001', nota: '' }],
    'ruta con mayúsculas': [...base, { ruta: '/Inicio/', accion: '301', destino: '/', spec: '001', nota: '' }],
    'ruta con un segmento «.»': [...base, { ruta: '/./inicio/', accion: '301', destino: '/', spec: '001', nota: '' }],
  };
  for (const [nombre, mapa] of Object.entries(casos)) assert.equal(construirConMapa(mapa).ok, false, nombre);
});

test('CA-27 · .htaccess lleva ErrorDocument 404 /404.html y cada regla es RedirectMatch 301 ^…/?$', () => {
  const lineas = lineasDe('.htaccess');
  assert.ok(lineas.includes('ErrorDocument 404 /404.html'));
  for (const l of lineas.filter((x) => x !== 'ErrorDocument 404 /404.html')) {
    assert.match(l, /^RedirectMatch 301 \^\/[a-z0-9\-/\\.]*\/\?\$ \/[a-z0-9\-/.]*$/, l);
  }
});

test('§3.2 · _redirects lleva la forma con barra y sin barra de cada 301', () => {
  const lineas = lineasDe('_redirects');
  for (const e of mapaUrl().filter((x) => x.accion === '301')) {
    assert.ok(lineas.includes(`${e.ruta} ${e.destino} 301`), `${e.ruta} con barra`);
    assert.ok(lineas.includes(`${sinBarraFinal(e.ruta)} ${e.destino} 301`), `${e.ruta} sin barra`);
  }
  for (const l of lineas) assert.match(l, /^\/[a-z0-9\-/.]* \/[a-z0-9\-/.]* 301$/, l);
});

test('§3.2 · estaConstruida: / y /aviso-legal/ sí, /servicios/ no', () => {
  assert.equal(estaConstruida('/'), true);
  assert.equal(estaConstruida('/servicios/'), false, 'pagina de la 002, sin fuente todavía');
  assert.equal(estaConstruida('/inicio/'), false, 'un 301 no es una página');
  assert.equal(estaConstruida('/home/'), false, 'una pendiente no es una página');
  assert.equal(estaConstruida('/no-esta/'), false, 'fuera del mapa');
  assert.equal(estaConstruida('/confirmacion.html'), fs.existsSync(path.join(RAIZ, 'confirmacion.src.html')));
  // /aviso-legal/ está construida en cuanto existe paginas/aviso-legal.src.html (T03)
  const dir = copiaTemporal();
  fs.mkdirSync(path.join(dir, 'paginas'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'paginas', 'aviso-legal.src.html'), paginaEjemplo('aviso-legal'));
  assert.equal(estaConstruida('/aviso-legal/', dir), true);
  assert.equal(estaConstruida('/privacidad/', dir), fs.existsSync(path.join(dir, 'paginas', 'privacidad.src.html')));
  if (fs.existsSync(path.join(RAIZ, 'paginas', 'aviso-legal.src.html'))) assert.equal(estaConstruida('/aviso-legal/'), true);
});

// T05 · datos de temporada

const datosCasa = (html) => {
  const m = /<script type="application\/json" id="datos-casa">([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
};
const pieDePiscina = (html) => (/<picture data-foto="piscina">[\s\S]*?<figcaption>([^<]*)<\/figcaption>/.exec(html) || [])[1];
const listaPiscina = (html) => (/<li><b>Piscina de agua salada<\/b>([^<]*)<\/li>/.exec(html) || [])[1];
/* Construye una copia temporal cambiando datos/casa.json con `cambiar(casa)`. */
const construirConCasa = (cambiar) => construirCon('datos/casa.json', (t) => { const c = JSON.parse(t); cambiar(c); return JSON.stringify(c, null, 2); });

test('CA-12 · la piscina dice «1 jun – 20 sep» en el pie de foto y «del 1 de junio al 20 de septiembre» en la lista', () => {
  const html = leer('index.html');
  assert.equal(pieDePiscina(html), 'Piscina de agua salada, 1 jun – 20 sep');
  assert.equal(listaPiscina(html), '60 m², con zona para adultos y para niños, del 1 de junio al 20 de septiembre.');
});

test('CA-12 · con hasta=09-30 cambian el pie de foto, la lista y datos-casa', () => {
  const r = construirConCasa((c) => { c.piscina.hasta = '09-30'; });
  assert.ok(r.ok, r.salida);
  const html = leer('index.html', r.dir);
  assert.equal(pieDePiscina(html), 'Piscina de agua salada, 1 jun – 30 sep');
  assert.match(listaPiscina(html), /del 1 de junio al 30 de septiembre\.$/);
  assert.equal(datosCasa(html).piscina.hasta, '09-30');
  // y el resto de la portada no cambia
  assert.equal(html.replace(/30 sep|30 de septiembre|"hasta":"09-30"/g, ''), leer('index.html').replace(/20 sep|20 de septiembre|"hasta":"09-20"/g, ''));
});

test('§3.3 · un hasta anterior a desde o mal escrito hace fallar la construcción', () => {
  const casos = {
    'hasta antes que desde': (c) => { c.piscina.hasta = '05-20'; },
    'hasta igual a desde': (c) => { c.piscina.hasta = c.piscina.desde; },
    'sin cero delante': (c) => { c.piscina.hasta = '9-20'; },
    'día que no existe': (c) => { c.piscina.desde = '06-31'; },
    'mes que no existe': (c) => { c.piscina.hasta = '13-01'; },
    'temporada mal escrita': (c) => { c.temporadas.entera.desde = 'noviembre'; },
    'precio que no es un número': (c) => { c.precios.desde.torre = '70 €'; },
    'temporadas que no se reparten el año': (c) => { c.temporadas.habitaciones.hasta = '09-30'; },
    'temporadas que se pisan': (c) => { c.temporadas.entera.desde = '10-15'; },
  };
  for (const [nombre, cambiar] of Object.entries(casos)) {
    const r = construirConCasa(cambiar);
    assert.equal(r.ok, false, `${nombre}: la construcción debería fallar`);
    assert.match(r.salida, /datos\/casa\.json: /, nombre);
  }
  assert.match(construirConCasa(casos['hasta antes que desde']).salida, /piscina\.hasta \(05-20\) tiene que ser posterior a piscina\.desde \(06-01\)/);
});

test('§3.3 · una fecha de la piscina o un precio escritos a mano en un .src.html o en js/*.js hacen fallar la construcción', () => {
  const casos = [
    ['index.src.html', conEnlace('<p>Piscina, 1 jun – 15 sep</p>'), /15 sep/],
    ['index.src.html', conEnlace('<p>Abierta del 1 de junio al 20 de septiembre</p>'), /20 de sep/],
    ['index.src.html', conEnlace('<p>Abierta hasta el 15</p>'), /hasta el 15/],
    ['index.src.html', conEnlace('<p><b>70 €</b> desde</p>'), /«70 €»/],
    ['index.src.html', conEnlace('<p>1.190&nbsp;€ dos noches</p>'), /«1\.190&nbsp;€»/],
    ['parciales/pie.html', (h) => h + '\n<p>Desde 58 € la noche</p>\n', /parciales\/pie\.html: .*«58 €»/],
    ['paginas/prueba.src.html', () => paginaEjemplo('casa', '<p>La casa entera, 675 € una noche</p>'), /paginas\/prueba\.src\.html: .*«675 €»/],
    ['js/main.js', (j) => j + "\nconst x = 'desde 85 € la noche';\n", /js\/main\.js: .*«85 €»/],
    ['js/reserva.js', (j) => j.replace('precio: PR.torre', 'precio: 70'), /js\/reserva\.js: .*precio: 7/],
    ['js/reserva.js', (j) => j + '\nconst y = (n) => 1190 + n * 595;\n', /js\/reserva\.js: .*«1190»/],
  ];
  for (const [rel, cambiar, re] of casos) {
    const r = construirCon(rel, cambiar);
    assert.equal(r.ok, false, `${rel}: debería fallar (${re})`);
    assert.match(r.salida, /escrito a mano/, rel);
    assert.match(r.salida, re, rel);
  }
});

test('§3.3 · en las fuentes y en js/ no queda la piscina ni ningún precio escrito a mano', () => {
  const ficheros = ['index.src.html', ...fs.readdirSync(path.join(RAIZ, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];
  if (fs.existsSync(path.join(RAIZ, 'paginas'))) ficheros.push(...fs.readdirSync(path.join(RAIZ, 'paginas')).filter((f) => f.endsWith('.src.html')).map((f) => 'paginas/' + f));
  for (const rel of ficheros) {
    const t = leer(rel);
    for (const malo of ['15 sep', 'hasta el 15']) assert.ok(!t.includes(malo), `${rel}: «${malo}»`);
    assert.doesNotMatch(t, /\b(58|68|70|75|85|675|595|1\.?190)(\s|&nbsp;|<\/b>)*€/, rel);
    // los de la casa entera, tampoco sueltos (sí dentro de un color, como #4b5953, o
    // el ancho de una foto, `w: 675,`, que no es un precio)
    assert.doesNotMatch(t, /(?<![\w#.,])(675|595|1\.?190)(?![\w,]|\.\d)/, rel);
  }
});

test('§3.3 · cada página lleva <script type="application/json" id="datos-casa">', () => {
  const casa = leerJSON('datos/casa.json');
  const sinComentarios = JSON.parse(JSON.stringify(casa, (k, v) => (k.startsWith('_') ? undefined : v)));
  for (const rel of paginasGeneradas()) {
    const html = leer(rel);
    assert.deepEqual(datosCasa(html), sinComentarios, rel);
    assert.equal(html.match(/id="datos-casa"/g).length, 1, `${rel}: uno solo`);
    assert.ok(html.indexOf('id="datos-casa"') < html.indexOf('</head>'), `${rel}: en el <head>, antes de los scripts`);
  }
  const { dir } = conEjemplo();
  assert.deepEqual(datosCasa(leer('prueba/index.html', dir)), sinComentarios, 'prueba/index.html');
});

test('§3.3 · las notas y los precios del HTML salen de casa.json', () => {
  const html = leer('index.html');
  assert.match(html, /<li><b>9,6<\/b><span>Booking<br>302 comentarios<\/span><\/li>/);
  assert.match(html, /<li><b>4,9<\/b><span>Google<br>315 reseñas<\/span><\/li>/);
  assert.match(html, /<li><b>4,7<\/b><span>Tripadvisor<br>79 opiniones<\/span><\/li>/);
  // las fichas de los tipos están en /tu-habitacion/ desde T08
  const habs = leer('tu-habitacion/index.html');
  for (const [tipo, pr] of [['clasica', 58], ['confort', 68], ['torre', 70], ['terraza', 75], ['familiar', 85]]) {
    assert.match(habs, new RegExp(`<p class="tipo__desde"><b>${pr} €</b> desde, por noche</p><a class="enlace" href="\\.\\./\\?tipo=${tipo}#reserva">`), tipo);
  }
  const r = construirConCasa((c) => { c.precios.desde.torre = 72; c.notas.google.nota = 4.8; c.notas.google.recuento = 320; });
  assert.ok(r.ok, r.salida);
  const otro = leer('index.html', r.dir);
  assert.match(leer('tu-habitacion/index.html', r.dir), /<b>72 €<\/b> desde, por noche<\/p><a class="enlace" href="\.\.\/\?tipo=torre#reserva">/);
  assert.match(otro, /<p class="seccion__precio"><b>72 €<\/b> desde, por noche<\/p><button type="button" class="btn btn--oro" data-tipo="torre">/);
  assert.match(otro, /Google<br>320 reseñas/);
  // opiniones (CA-18): la nota y el recuento de Google, también de casa.json
  assert.match(otro, /<h2 class="tit" id="op-tit" data-partir>4,8 en <em>Google<\/em><\/h2>\s*<p class="op__recuento">320 reseñas<\/p>/);
});

// T06 · el JS partido en comun.js y main.js

/* Los <script src> de una página, en orden, sin ?v= ni la raíz relativa. */
const scriptsDe = (html) => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1].replace(/\?v=[0-9a-f]+$/, '').replace(/^(?:\.\/|(?:\.\.\/)+)/, ''));

test('§3.1.4 bis · comun.js en todas las páginas; sol.js, main.js, reserva.js y las librerías solo en la portada, después de comun.js', () => {
  const portada = scriptsDe(leer('index.html'));
  const propios = portada.filter((s) => s.startsWith('js/'));
  assert.deepEqual(propios, ['js/comun.js', 'js/sol.js', 'js/main.js', 'js/reserva.js'], 'la portada: comun.js antes que los suyos');
  const libs = portada.filter((s) => /gsap|ScrollTrigger|lenis/i.test(s));
  assert.equal(libs.length, 3, 'GSAP, ScrollTrigger y Lenis en la portada');
  for (const l of libs) assert.ok(portada.indexOf(l) < portada.indexOf('js/comun.js'), `${l} antes que comun.js (Lenis lo arranca comun.js)`);
  const { dir } = conEjemplo();
  const interiores = [...LEGALES.map((s) => [`${s}/index.html`, RAIZ]), ['prueba/index.html', dir]];
  for (const [rel, d] of interiores) assert.deepEqual(scriptsDe(leer(rel, d)), ['js/comun.js'], `${rel}: solo comun.js`);
});

test('§3.1.7 · la marca de la cortina es la misma en el <head>, en main.js y en las cookies, y con ancla no hay cortina', () => {
  const marca = (/sessionStorage\.getItem\('([^']+)'\)/.exec(leer('parciales/head.html')) || [])[1];
  assert.equal(marca, 'cdc-cortina', 'el script del <head> lee cdc-cortina');
  assert.match(leer('js/main.js'), new RegExp(`MARCA_CORTINA = '${marca}'[\\s\\S]*sessionStorage\\.setItem\\(MARCA_CORTINA`), 'main.js la guarda al retirar la cortina');
  assert.match(leer('cookies/index.html'), new RegExp(`<b>${marca}</b>`), 'la política de cookies la cuenta');
  const cabeza = /<script>\s*\(function \(d\)[\s\S]*?<\/script>/.exec(leer('index.html'));
  assert.ok(cabeza && cabeza.index < leer('index.html').indexOf('</head>'), 'el script va en el <head> de la portada');
  assert.match(cabeza[0], /location\.hash\.length > 1 \|\| sessionStorage\.getItem\('cdc-cortina'\)\) h\.classList\.add\('cortina-fuera'\)/);
  assert.match(cabeza[0], /try \{\s*if \(location\.hash/, 'dentro de try: si sessionStorage falla, la cortina sale como siempre');
  for (const s of LEGALES) assert.doesNotMatch(leer(`${s}/index.html`), /id="cortina"/, `${s}: las interiores nunca llevan cortina`);
});

test('§3.1.4 bis · main.js ya no tiene cabecera, menú, cookies, barra ni carrusel; las rutas propias del JS salen de data-raiz', () => {
  const main = leer('js/main.js');
  for (const s of ["'#cab'", "'#menu-btn'", "'#cookies'", "'#ck-si'", "'#barra'", "'pointerdown'", "'#leyendas-lista'", "'#regla'", "new Lenis"]) {
    assert.ok(!main.includes(s), `main.js no debería tener ${s}`);
  }
  const comun = leer('js/comun.js');
  for (const s of ["$('#cab')", "$('#menu-btn')", "$('#cookies')", "$('#barra')", 'function carrusel', "$('#leyendas-lista')", "$('#regla')"]) assert.ok(comun.includes(s), `comun.js tiene ${s}`);
  // ninguna ruta propia escrita desde la raíz del documento
  for (const f of ['js/main.js', 'js/comun.js', 'js/reserva.js', 'js/pico3d.js']) {
    assert.doesNotMatch(leer(f), /(?<!raiz \+ )['"`](?:img|datos|css|js)\//, `${f}: rutas propias con data-raiz`);
    assert.doesNotMatch(leer(f), /href="[a-z-]+\.html"/, `${f}: sin enlaces a .html sueltos`);
  }
  assert.match(leer('js/main.js'), /`\$\{R\}img\/fotos\//);
  assert.match(leer('js/pico3d.js'), /raiz \+ 'img\/terreno\/'/);
  assert.match(leer('js/reserva.js'), /href="\{enlace\}"[^\n]*enlace: R \+ 'privacidad\/'/);
});

// T07 · t() y el script de cadenas

import vm from 'node:vm';   // (las import suben solas al principio del módulo)
const cadenas = () => import(new URL('./cadenas.mjs', import.meta.url));

test('CA-28 · scripts/cadenas.mjs no encuentra cadenas fuera de t() que no estén en las excepciones', async () => {
  const { comprobar } = await cadenas();
  const r = comprobar(RAIZ);
  assert.deepEqual(r.errores, [], 'cadenas fuera de t() y sin excepción');
  assert.deepEqual(r.sinUso, [], 'excepciones que ya no usa nadie');
  assert.ok(r.revisadas > 500, `revisa de verdad js/*.js (${r.revisadas} literales)`);
});

test('CA-28 · la comprobación caza el texto suelto y deja pasar lo que no es texto', async () => {
  const { comprobar } = await cadenas();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casal-cadenas-'));
  temporales.push(dir);
  fs.mkdirSync(path.join(dir, 'js'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  const probar = (js, excepciones = { exactas: { eventos: ['click'] } }) => {
    fs.writeFileSync(path.join(dir, 'js', 'prueba.js'), js);
    fs.writeFileSync(path.join(dir, 'scripts', 't-excepciones.json'), JSON.stringify(excepciones));
    return comprobar(dir);
  };
  const base = "b.addEventListener('click', f);\n";
  assert.deepEqual(probar(base).errores, [], 'lo de la lista pasa');
  // lo que no es texto: en t(), sin dos letras, comentarios, regex, etiquetas y huecos de una plantilla
  const limpio = probar(base + [
    "el.textContent = t('Quedan {n} habitaciones', { n });",
    "x.textContent = CASAL.t('Hola');",
    "const s = ' · ', m = '—', n = 'E';",
    "// 'un comentario con texto'",
    "/* 'otro comentario' */",
    "const re = /^\\S+@\\S+\\.\\S{2,}$/, re2 = (a) => a.replace(/abc/g, '');",
    "h.innerHTML = `<div class=\"nada\">${t('Elige una habitación.')}</div>`;",
    "h.innerHTML = `<button type=\"button\" class=\"${c.join(' ')}\" data-k=\"${k}\">${d}</button>`;",
  ].join('\n'));
  assert.deepEqual(limpio.errores, []);
  // lo que sí es texto visible fuera de t()
  const casos = [
    ["el.textContent = 'Hola, mundo';", /Hola, mundo/],
    ["el.textContent = 'Quedan ' + n + ' habitaciones';", /Quedan/],
    ['h.innerHTML = `<div class="nada">Elige una habitación.</div>`;', /Elige una habitación/],
    ['h.innerHTML = `<button aria-label="Mes anterior">‹</button>`;', /Mes anterior/],
    ["img.alt = cond ? t('Uno') : 'Dos fotos';", /Dos fotos/],
    ["el.textContent = t(`Quedan ${n}`);", /la clave de t\(\) no puede llevar/],
    ["el.textContent = set('Hola');", /Hola/],
  ];
  for (const [linea, re] of casos) {
    const r = probar(base + linea + '\n');
    assert.ok(r.errores.length >= 1, `debería avisar: ${linea}`);
    assert.match(r.errores.join('\n'), re);
    assert.match(r.errores[0], /js\/prueba\.js:2:/, 'con fichero y línea');
  }
  // una excepción que ya no se usa también es un fallo
  assert.deepEqual(probar(base, { exactas: { eventos: ['click', 'keydown'] } }).sinUso, ['keydown']);
});

/* comun.js en un DOM mínimo, para usar su t() de verdad. */
function cargarComun(dic) {
  const nada = () => null, vacio = () => [];
  const html = { dataset: { raiz: './' }, lang: 'es', classList: { add() {}, contains: () => false } };
  const ctx = {
    document: { documentElement: html, readyState: 'complete', querySelector: nada, querySelectorAll: vacio },
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: class { observe() {} },
    getComputedStyle: () => ({}),
    addEventListener() {}, setTimeout() {}, location: { hash: '' },
    Intl, Object, String, Array, Math, Promise, JSON, URL,
  };
  ctx.window = ctx;
  if (dic) ctx.CASAL_T = dic;
  vm.runInNewContext(leer('js/comun.js'), ctx);
  return ctx.CASAL;
}

test('CA-20 · t(): con el castellano devuelve el mismo texto, rellena los huecos y usa el diccionario si lo hay', () => {
  const { t } = cargarComun();
  assert.equal(t('Quedan {n} habitaciones', { n: 3 }), 'Quedan 3 habitaciones');
  assert.equal(t('<b>{precio} €</b> desde, por noche', { precio: '1.190' }), '<b>1.190 €</b> desde, por noche', 'el HTML va entero en la clave');
  assert.equal(t('Sin huecos'), 'Sin huecos');
  assert.equal(t('Falta {x}', {}), 'Falta {x}', 'un hueco sin valor se queda como está');
  const en = cargarComun({ 'Quedan {n} habitaciones': '{n} rooms left' }).t;
  assert.equal(en('Quedan {n} habitaciones', { n: 2 }), '2 rooms left');
  assert.equal(en('Otra frase'), 'Otra frase', 'lo que no está en el diccionario sale como la clave');
});

test('§3.1.11 · fechas con Intl en el idioma de la página: sin meses escritos a mano ni «es-ES» fijo; el anillo sigue en Ene…Dic', () => {
  for (const f of ['js/comun.js', 'js/main.js', 'js/reserva.js']) {
    const js = leer(f);
    assert.doesNotMatch(js, /'es-ES'/, `${f}: el idioma sale de <html lang>`);
    assert.doesNotMatch(js, /'(Enero|Febrero|Septiembre|Diciembre)'|\['L', 'M', 'X'/, `${f}: meses y días con Intl.DateTimeFormat`);
  }
  assert.match(leer('js/main.js'), /new Intl\.DateTimeFormat\(idioma, \{ month: 'long', timeZone: 'UTC' \}\)[\s\S]*mayus\(fMes\.format\(Date\.UTC\(2001, m, 15\)\)\)/);
  // la misma cuenta que main.js: en castellano, las tres letras de siempre
  const { mayus } = cargarComun();
  const fMes = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' });
  const cortos = Array.from({ length: 12 }, (x, m) => mayus(fMes.format(Date.UTC(2001, m, 15))).slice(0, 3));
  assert.deepEqual(cortos, ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']);
});

// T08 · plantilla interior y /tu-habitacion/

const TIPOS_CASA = ['clasica', 'confort', 'torre', 'terraza', 'familiar'];
const clasesDe = (html) => [...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
/* Los id de dentro de <main> (la cabecera, el pie y las cookies son comunes y van fuera). */
const idsDeMain = (html) => {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html);
  return main ? [...main[1].matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]) : [];
};

test('CA-13 · la portada no tiene fichas .tipo ni .tabla-habs', () => {
  const html = leer('index.html');
  const clases = clasesDe(html);
  for (const c of ['tipo', 'tipos', 'tabla-habs', 'tabla-envoltura']) assert.ok(!clases.includes(c), `la portada tiene .${c}`);
  assert.doesNotMatch(html, /data-reservar=/, 'quedan botones «Ver fechas» de las fichas');
  // en su lugar, el enlace a la página
  assert.match(html, /<a class="btn btn--hueco" href="\.\/tu-habitacion\/">Ver todas las habitaciones<\/a>/);
});

test('CA-13 · /tu-habitacion/ tiene las cinco fichas y cada «Ver fechas» lleva a ?tipo=…#reserva', () => {
  const html = leer('tu-habitacion/index.html');
  const fichas = [...html.matchAll(/<li class="tipo" data-tipo="([a-z]+)"[\s\S]*?<\/li>/g)];
  assert.deepEqual(fichas.map((m) => m[1]), TIPOS_CASA, 'las cinco fichas, en el orden de la portada');
  for (const [li, tipo] of fichas) {
    assert.match(li, /<picture data-foto="hab-/, `${tipo}: foto`);
    assert.match(li, /<p class="eti">[^<]+<\/p><h3>[^<]+<\/h3><p>[^<]+<\/p>/, `${tipo}: planta, nombre y frase`);
    assert.match(li, new RegExp(`<a class="enlace" href="\\.\\./\\?tipo=${tipo}#reserva">Ver fechas`), `${tipo}: «Ver fechas»`);
  }
  // la tabla sale siempre (no depende de la densidad sobria) y con los precios de casa.json
  assert.match(html, /<table class="tabla-habs">\s*<caption>Las habitaciones, de un vistazo<\/caption>/);
  assert.doesNotMatch(html, /solo-sobria/);
  const casa = leerJSON('datos/casa.json');
  for (const tipo of TIPOS_CASA) assert.ok(html.includes(`<td>${casa.precios.desde[tipo]} €</td>`), `tabla: precio de ${tipo}`);
  // «Cada habitación, una leyenda» con las fotos de los nombres
  assert.match(html, /<h2>Cada habitación, una leyenda<\/h2>/);
  assert.equal((/<ul class="nombres__lista">([\s\S]*?)<\/ul>/.exec(html) || ['', ''])[1].match(/<picture /g).length, 5);
});

test('§3.1.10 · /tu-habitacion/ usa la plantilla: portadilla, «¿Te quedas?», cabecera, pie y cookies comunes (con la 002: description definitiva)', () => {
  const html = leer('tu-habitacion/index.html');
  assert.match(html, /<title>Tu habitación · Casa de Casal<\/title>/);
  // la description provisional («Tu habitación · Casa de Casal») pasa a la definitiva de la 002 §3.3 (CA-13)
  assert.match(html, /<meta name="description" content="Tenemos la habitación perfecta para ti\. [^"]+">/);
  assert.match(html, /<section class="portadilla oscura"[\s\S]*?<p class="eti">Habitaciones<\/p>\s*<h1 class="tit" id="portadilla-tit" data-partir>Tu <em>habitación<\/em><\/h1>/);
  assert.match(html, /<figure class="portadilla__foto gable"><picture data-foto="hab-mouros">/);
  assert.match(html, /<section class="te-quedas clara"[\s\S]*?¿Te <em>quedas<\/em>\?[\s\S]*?href="tel:\+34698148323"[\s\S]*?<a class="btn btn--oro" href="\.\.\/#reserva">Ver disponibilidad<\/a>/);
  for (const nombre of Object.keys(BLOQUES)) assert.equal(bloque(html, nombre, 'tu-habitacion'), bloque(leer('index.html'), nombre, 'index.html'), nombre);
  assert.match(html, /<a href="\.\.\/tu-habitacion\/" aria-current="page">Habitaciones<\/a>/);
  assert.match(html, /<html lang="es" data-raiz="\.\.\/" class="cortina-fuera">/, 'sin cortina en una página interior');
});

test('T08 · ningún id de <main> se repite entre la portada y /tu-habitacion/', () => {
  const portada = new Set(idsDeMain(leer('index.html')));
  const pagina = idsDeMain(leer('tu-habitacion/index.html'));
  assert.ok(pagina.length > 0);
  assert.deepEqual(pagina.filter((id) => portada.has(id)), []);
  assert.equal(new Set(pagina).size, pagina.length, 'id repetido dentro de /tu-habitacion/');
});

test('§3.5 · reserva.js abre el motor con el tipo de ?tipo= y no guarda nada en el navegador', () => {
  const js = leer('js/reserva.js');
  assert.match(js, /new URLSearchParams\(location\.search\)\.get\('tipo'\)/);
  assert.match(js, /TIPOS\.some\(\(tp\) => tp\.id === tipoURL\)\) elegirTipo\(tipoURL\)/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie/);
});

// T09 · panel del dibujo

const datosHabs = (html) => {
  const m = /<script type="application\/json" id="datos-habitaciones">([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
};
const fichaDe = (html) => (/<div class="seccion__ficha" data-zona="([a-z0-9-]+)">([\s\S]*?)<\/div><\/div>/.exec(html) || []);
const construirConHabs = (cambiar) => construirCon('datos/habitaciones.json', (t) => { const h = JSON.parse(t); cambiar(h); return JSON.stringify(h, null, 2); });

test('CA-15 · cada data-k del dibujo tiene su zona en habitaciones.json con al menos una habitación o estancia', () => {
  const html = leer('index.html');
  const ks = [...html.matchAll(/<g class="zona" data-k="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.equal(ks.length, 9, 'las nueve ventanas del dibujo');
  const h = leerJSON('datos/habitaciones.json');
  assert.deepEqual(Object.keys(h.zonas).sort(), [...ks].sort(), 'una zona por cada data-k, ni más ni menos');
  const precios = leerJSON('datos/casa.json').precios.desde;
  for (const k of ks) {
    const z = h.zonas[k];
    assert.ok(z.titulo, `${k}: titulo`);
    if (z.habitaciones.length) {
      for (const x of z.habitaciones) {
        assert.ok(x.nombre && typeof x.cama === 'string' && typeof x.frase === 'string', `${k}: nombre, cama y frase`);
        assert.ok(precios[x.tipo], `${k}: el tipo ${x.tipo} tiene su «desde» en casa.json`);
      }
    } else assert.ok(z.frase.trim(), `${k}: una estancia lleva su frase`);
  }
  // las estancias de la spec, con su botón donde lo hay
  for (const k of ['comedor', 'galeria', 'chimenea', 'pequena']) assert.deepEqual(h.zonas[k].habitaciones, [], k);
  assert.deepEqual(h.zonas.comedor.boton, { texto: 'Ver el desayuno', ir: '#mesa' });
  assert.deepEqual(h.zonas.pequena.boton, { texto: 'Ver la Casa Pequena', ir: '#pequena' });
  assert.match(h.zonas.comedor.planta, /hasta 30 personas/);
  // el JSON llega a la página para main.js (PD-8), con los anchos de cada foto
  const d = datosHabs(html);
  assert.ok(d, 'falta <script id="datos-habitaciones">');
  assert.deepEqual(Object.keys(d.zonas).sort(), [...ks].sort());
  assert.deepEqual(d.zonas.torre.anchos, [480, 675]);
  assert.ok(!('_nota' in d), 'sin los comentarios');
  assert.equal(datosHabs(leer('tu-habitacion/index.html')), null, 'solo en la página que lleva el panel');
});

test('§3.4.4 · sin JavaScript la portada trae pintado el panel de La Torre', () => {
  const [, k, ficha] = fichaDe(leer('index.html'));
  assert.equal(k, 'torre');
  assert.match(ficha, /<img id="sp-foto" src="\.\/img\/fotos\/hab-torre-480\.jpg"/);
  assert.match(ficha, /<h3 id="sp-nombre">La Torre<\/h3>/);
  assert.match(ficha, /<ul class="seccion__habs"><li><b>La Torre<\/b><span>[^<]+<\/span><span>[^<]+<\/span><\/li><\/ul>/, 'una habitación por línea: nombre, cama y frase');
  assert.match(ficha, /<p class="seccion__precio"><b>70 €<\/b> desde, por noche<\/p><button type="button" class="btn btn--oro" data-tipo="torre">Ver fechas de La Torre<\/button>/);
  // y main.js ya no lleva los textos: los lee del JSON
  const main = leer('js/main.js');
  assert.doesNotMatch(main, /\bconst Z = \{/);
  assert.match(main, /#datos-habitaciones/);
});

test('§3.4.4 · una zona con dos tipos saca un «Ver fechas» por tipo; una ventana sin zona rompe la construcción', () => {
  const r = construirConHabs((h) => { h.zonas.torre.habitaciones.push({ nombre: 'Os Mouros', tipo: 'confort', cama: 'Cama de 1,50', frase: '' }); });
  assert.ok(r.ok, r.salida);
  const [, , ficha] = fichaDe(leer('index.html', r.dir));
  assert.equal((ficha.match(/<li>/g) || []).length, 2);
  assert.match(ficha, /data-tipo="torre">Ver fechas de La Torre</);
  assert.match(ficha, /<b>68 €<\/b> desde, por noche<\/p><button type="button" class="btn btn--oro" data-tipo="confort">Ver fechas de Confort</);
  const sin = construirConHabs((h) => { delete h.zonas.galeria; });
  assert.equal(sin.ok, false);
  assert.match(sin.salida, /data-k="galeria".*no tienen zona/);
  const malo = construirConHabs((h) => { h.zonas.torre.habitaciones[0].tipo = 'suite'; });
  assert.equal(malo.ok, false);
  assert.match(malo.salida, /el tipo «suite» no tiene precio/);
});

test('§9 · una zona sin habitaciones ni frase enseña su título y «Pronto, con sus fotos»', () => {
  const r = construirConHabs((h) => { h.zonas.torre.habitaciones = []; h.zonas.torre.frase = ''; });
  assert.ok(r.ok, r.salida);
  const [, , ficha] = fichaDe(leer('index.html', r.dir));
  assert.match(ficha, /<h3 id="sp-nombre">La Torre<\/h3><p id="sp-texto">Pronto, con sus fotos<\/p>/);
  assert.doesNotMatch(ficha, /seccion__habs|seccion__acc/);
  assert.match(leer('js/main.js'), /t\('Pronto, con sus fotos'\)/, 'el JS pinta lo mismo');
});

test('§3.4.5 · «Cada habitación, una leyenda» de la portada sale de habitaciones.json', () => {
  const nombres = leerJSON('datos/habitaciones.json').leyendas.map((l) => l.nombre);
  assert.deepEqual(nombres, ['Os Mouros', 'A Coruxa', 'O Régulo', 'El Encanto', 'Peregrino']);
  assert.equal((/<ul class="nombres__resumen">([\s\S]*?)<\/ul>/.exec(leer('index.html')) || [])[1], nombres.map((n) => `<li><b>${n}</b></li>`).join(''));
  const r = construirConHabs((h) => { h.leyendas[0].de = 'Los mouros del Pico'; });
  assert.ok(r.ok, r.salida);
  assert.match(leer('index.html', r.dir), /<li><b>Os Mouros<\/b><span>Los mouros del Pico<\/span><\/li>/);
});

test('§3.4.4 y §3.4.6 · bajo el tejado: entradilla corta, Casa Pequena sin albornoces y la nota del esquema', () => {
  const html = leer('index.html');
  assert.match(html, /<p class="suave">Toca una ventana y descubre qué esconden sus paredes\.<\/p>/);
  assert.ok(!html.includes('Nueve habitaciones dobles'));
  assert.ok(!html.includes('Toca una ventana.'));
  for (const rel of ['index.html', 'js/main.js', 'datos/habitaciones.json']) assert.doesNotMatch(leer(rel), /albornoc/i, rel);
  assert.ok(leerJSON('datos/habitaciones.json').zonas.pequena.frase.startsWith('Fue palomar, lagar, bodega y sala de juegos; hoy, una casita de 50 m² para dos.'));
  assert.match(html, /Esquema de la casa, no plano/, 'la nota sigue hasta P-01');
});

// T10 · la historia baja y la Casa Pequena (no activa ningún CA: el de CA-10 es de T12)

test('§3.4.3 · «La historia» va después de la finca y el desayuno, en S. XVIII y sin el lagar', () => {
  const html = leer('index.html');
  const pos = (re) => { const m = re.exec(html); assert.ok(m, String(re)); return m.index; };
  const historia = pos(/<section class="historia clara" id="historia"/);
  assert.ok(pos(/<div class="mesa" id="mesa">/) < historia, 'detrás del desayuno');
  assert.ok(historia < pos(/<section class="pico" id="pico"/), 'antes del Pico');
  const sec = /<section class="historia[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(sec, /<p class="eti">La historia<\/p>\s*<h2 class="tit" id="historia-tit" data-partir>La casa de la abuela de <em>Patricia<\/em><\/h2>/);
  assert.match(sec, /<p class="entrada">Una casa de labranza gallega de granito, con galería y hórreo, levantada en el siglo XVIII\./);
  assert.match(sec, /<blockquote class="cita">/);
  assert.match(sec, /<li><b>S\. XVIII<\/b><span>Casa de labranza de la familia, con su hórreo y su molino\.<\/span><\/li>/);
  assert.match(sec, /<aside class="papeles" id="papeles"/, '«Los papeles de la casa», entero');
  assert.doesNotMatch(sec, /lagar/i);
  assert.ok(!html.includes('XVII–XVIII'));
  // la casa se queda con lo de dentro
  assert.match(/<section class="casa clara" id="casa"[\s\S]*?<\/section>/.exec(html)[0], /<p class="entrada">Dentro hay un salón con galería/);
});

test('§3.4.6 · Casa Pequena: su historia en la ficha, sin albornoces, y la foto de la puerta', () => {
  const html = leer('index.html');
  const ficha = /<article class="pequena" id="pequena"[\s\S]*?<\/article>/.exec(html)[0];
  assert.match(ficha, /<p>Su abuelo deshizo un palomar para poner aquí el lagar\. Después fue el sitio del tractor y la mesa de herramientas de su padre, la bodega con lareira donde se siguió haciendo vino y la sala de juegos\. Hoy es una casita de 50 m² para dos\. La cama de 1,60 duerme bajo la lareira/);
  assert.doesNotMatch(ficha, /albornoc/i);
  assert.match(ficha, /<picture data-foto="pequena-puerta">/);
  const foto = leerJSON('img/fotos/fotos.json').find((f) => f.nombre === 'pequena-puerta');
  assert.ok(foto && foto.origen.startsWith('patricia/'), 'la foto de Patricia, en fotos.json');
  for (const w of foto.anchos) for (const ext of ['avif', 'webp', 'jpg']) assert.ok(existe(`img/fotos/pequena-puerta-${w}.${ext}`), `pequena-puerta-${w}.${ext}`);
  // «lagar», solo en los dos textos de la Casa Pequena
  const sinCasaPequena = html.replace(ficha, '').replace(/<script type="application\/json" id="datos-habitaciones">[\s\S]*?<\/script>/, '');
  assert.doesNotMatch(sinCasaPequena, /lagar/i);
});

// T11 · la finca y el desayuno

test('CA-13 · la portada no tiene la foto del hórreo ni la de las glicinias', () => {
  const html = leer('index.html');
  assert.doesNotMatch(html, /data-foto="(?:horreo|glicinia)"/);
  assert.doesNotMatch(html, /img\/fotos\/(?:horreo|glicinia)-/);
});

test('§3.4.7 y §3.4.8 · la finca y el desayuno: sin glicinias, cenas caseras ni «dicen en Booking»', () => {
  const html = leer('index.html');
  for (const rel of ['index.html', 'js/main.js', 'js/comun.js', 'js/reserva.js']) {
    const t = leer(rel);
    for (const x of [/glicinia/i, /cenas caseras/i, /dicen en Booking/i]) assert.doesNotMatch(t, x, `${rel}: ${x}`);
  }
  const finca = /<section class="finca clara" id="finca"[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(finca, /el jardín se viste de camelias y hortensias, y da kiwis/);
  // dos fotos hasta P-02: el estanque y la piscina
  assert.deepEqual([...(/<div class="finca__mosaico">[\s\S]*?<\/div>/.exec(finca)[0]).matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]), ['estanque', 'piscina']);
  assert.match(finca, /<li><b>Estanque y cascadas<\/b>/);
  assert.match(finca, /<li><b>Hórreo y molino<\/b>De la antigua casa de labranza, de pasada por el jardín\.<\/li>/);
  assert.match(finca, /<li><b>Huerta<\/b>De aquí salen los tomates del desayuno en verano y la fruta fresca\.<\/li>/);
  assert.doesNotMatch(finca, /Molino de agua|Hórreo y lagar/);
  assert.match(finca, /«Desayuno excepcional», dicen los huéspedes\./);
  assert.match(finca, /<p class="suave">Para cenar, alrededor hay buenos restaurantes, de menú del día a O Balado, con estrella verde Michelin\.<\/p>/);
  // el anillo: sin la fila de las glicinias y con la nota nueva
  assert.match(html, /<p class="anyo__nota">Camelias y hortensias, según su web; las épocas de los frutales son las habituales en Galicia\.<\/p>/);
});

// T12 · titular, opiniones, llegar, pie y barrido

const sinEtiquetas = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const jsonLD = (html) => /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];

test('CA-9 · el título de la portada es «Boutique rural: habitaciones y apartamentos con alma» y la entradilla la de §3.4.1', () => {
  const html = leer('index.html');
  const h1 = /<h1 class="hero__tit"[^>]*>([\s\S]*?)<\/h1>/.exec(html)[1];
  assert.equal(h1, 'Boutique rural: habitaciones y apartamentos <em>con alma</em>');
  assert.equal(sinEtiquetas(/<p class="hero__sub">([\s\S]*?)<\/p>/.exec(html)[1]), 'Habitaciones con desayuno casero y apartamento independiente para disfrutar del silencio a un paso de Santiago de Compostela.');
  assert.match(html, /<p class="eti">Lestedo · Boqueixón · A 15 minutos de Santiago<\/p>/);
  // las tres notas, de casa.json
  const notas = /<ul class="notas"[\s\S]*?<\/ul>/.exec(html)[0];
  for (const n of ['9,6', '4,9', '4,7']) assert.ok(notas.includes(`<b>${n}</b>`), n);
  // <title>, description y og:description, sin «nueve habitaciones» ni «9,6 en Booking»
  for (const re of [/<title>([^<]*)<\/title>/, /<meta name="description" content="([^"]*)"/, /<meta property="og:description" content="([^"]*)"/]) {
    const v = re.exec(html)[1];
    assert.doesNotMatch(v, /nueve habitaciones|9,6 en Booking/i, v);
  }
});

// las cadenas de §10 CA-10, tal cual (sensible a mayúsculas)
const PROHIBIDAS = ['glicinia', 'albornoc', 'cenas caseras', 'Nueve habitaciones', '15 sep', 'dicen en Booking', 'XVII–XVIII', 'C/ Pedro Ballesteros', 'Tarjeta regalo'];
const buscarProhibidas = (rel) => { const t = leer(rel); return PROHIBIDAS.filter((x) => t.includes(x)).map((x) => `${rel}: «${x}»`); };

test('CA-10 · en la portada (HTML y JS) no aparece ninguna de las cadenas prohibidas de §10', () => {
  const js = fs.readdirSync(path.join(RAIZ, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  assert.deepEqual(['index.html', ...js].flatMap(buscarProhibidas), []);
  // la ficha de la casa entera del motor ya no cuenta las habitaciones (P-03)
  assert.ok(!leer('js/reserva.js').includes('Las nueve habitaciones'));
});

test('CA-10 · «lagar» aparece solo en los dos textos de la Casa Pequena', () => {
  const html = leer('index.html');
  const ficha = /<article class="pequena" id="pequena"[\s\S]*?<\/article>/.exec(html)[0];
  assert.match(ficha, /lagar/);
  const H = JSON.parse(/<script type="application\/json" id="datos-habitaciones">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.match(H.zonas.pequena.frase, /lagar/);
  // fuera la ficha y el texto del panel de la Casa Pequena, no queda ningún lagar en la portada ni en el JS
  const resto = html.replace(ficha, '').replace(JSON.stringify(H.zonas.pequena.frase).slice(1, -1), '');
  assert.doesNotMatch(resto, /lagar/i);
  for (const f of fs.readdirSync(path.join(RAIZ, 'js')).filter((x) => x.endsWith('.js'))) assert.doesNotMatch(leer('js/' + f), /lagar/i, f);
});

test('CA-10 · la misma búsqueda pasa en los legales, el pie, el JSON-LD y scripts/legales.mjs', () => {
  const malas = [...LEGALES.map((l) => `${l}/index.html`), '404.html', 'parciales/pie.html', 'scripts/legales.mjs'].flatMap(buscarProhibidas);
  // las demás páginas generadas, también
  for (const rel of paginasGeneradas()) malas.push(...buscarProhibidas(rel));
  const ld = jsonLD(leer('index.html'));
  malas.push(...PROHIBIDAS.filter((x) => ld.includes(x)).map((x) => `JSON-LD: «${x}»`));
  assert.deepEqual([...new Set(malas)], []);
  assert.equal(JSON.parse(ld).address.streetAddress, 'Rúa Pedro Ballesteros, 17');
  for (const l of LEGALES) assert.doesNotMatch(leer(`${l}/index.html`), /lagar/i, l);
});

test('CA-11 · «Booking» aparece en la portada solo en .notas, ni en el pie ni en description', () => {
  const html = leer('index.html');
  assert.match(/<ul class="notas"[\s\S]*?<\/ul>/.exec(html)[0], /Booking/);
  assert.doesNotMatch(html.replace(/<ul class="notas"[\s\S]*?<\/ul>/, ''), /Booking/);
  assert.doesNotMatch(leer('parciales/pie.html'), /booking/i);
  for (const rel of paginasGeneradas()) {
    const d = /<meta name="description" content="([^"]*)"/.exec(leer(rel));
    if (d) assert.doesNotMatch(d[1], /booking/i, rel);
  }
});

test('§3.4.14 · pie: sin Booking; «Dónde estamos», «Contacto», los grupos «La casa» y «Alrededores» de paginas.json y «Reservar» debajo (con la 002)', () => {
  const pie = /<footer class="pie"[\s\S]*?<\/footer>/.exec(leer('index.html'))[0];
  assert.doesNotMatch(pie, /booking/i);
  const titulos = [...pie.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(titulos, ['Dónde estamos', 'Contacto', 'La casa', 'Alrededores'], 'las columnas del pie (002 §3.5)');
  assert.match(pie, /<h2>Dónde estamos<\/h2>\s*<address>Rúa Pedro Ballesteros, 17/);
  // cada grupo, con sus páginas construidas en el orden de paginas.json
  for (const g of leerJSON('datos/paginas.json').grupos) {
    const ul = new RegExp(`<h2>${g.nombre}</h2>\\s*<ul>([\\s\\S]*?)</ul>`).exec(pie);
    assert.ok(ul, `el pie no tiene el grupo «${g.nombre}»`);
    const esperado = g.paginas.filter((p) => estaConstruida(`/${p.slug}/`)).map((p) => [p.corto, `./${p.slug}/`]);
    assert.deepEqual([...ul[1].matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => [m[2], m[1]]), esperado, g.nombre);
  }
  assert.match(pie, /<h2>Alrededores<\/h2>\s*<ul>[\s\S]*?<\/ul>[\s\S]*?<a href="#reserva">Reservar<\/a>/, '«Reservar» debajo de los grupos');
  for (const l of LEGALES) assert.match(pie, new RegExp(`href="\\./${l}/"`));
});

test('CA-18 · opiniones: título «4,9 en Google», sin .op__notas ni citas de Booking, enlace a Google con target _blank y rel noopener', () => {
  const sec = /<section class="opiniones[\s\S]*?<\/section>/.exec(leer('index.html'))[0];
  assert.equal(sinEtiquetas(/<h2 class="tit" id="op-tit"[^>]*>([\s\S]*?)<\/h2>/.exec(sec)[1]), '4,9 en Google');
  assert.match(sec, /<p class="op__recuento">315 reseñas<\/p>/);
  assert.doesNotMatch(sec, /op__notas|op__fuente|<blockquote|Booking/);
  const a = /<a [^>]*>Leer las reseñas en Google[\s\S]*?<\/a>/.exec(sec);
  assert.ok(a, 'falta «Leer las reseñas en Google»');
  assert.match(a[0], /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Casa\+de\+Casal\+Lestedo"/);
  assert.match(a[0], /target="_blank"/);
  assert.match(a[0], /rel="noopener"/);
});

// T13 · carrusel de estancias

const ESTANCIAS = ['fachada', 'portada-galeria', 'chimenea', 'comedor', 'lectura', 'salon-abajo', 'roca'];
const carruselCasa = () => {
  const sec = /<section class="casa clara" id="casa"[\s\S]*?<\/section>/.exec(leer('index.html'))[0];
  const pista = /<div class="estancias__pista">([\s\S]*?)\n\s*<\/div>/.exec(sec);
  assert.ok(pista, 'falta el carrusel de estancias en «La casa»');
  return { sec, figuras: [...pista[1].matchAll(/<figure class="estancias__foto[^"]*"[^>]*>([\s\S]*?)<\/figure>/g)].map((m) => m[1]) };
};

test('CA-14 · el carrusel de estancias tiene 7 <picture>, con pie y puntos en el HTML', () => {
  const { sec, figuras } = carruselCasa();
  assert.match(sec, /<p class="eti">La casa<\/p>\s*<h2 class="tit" id="casa-tit" data-partir>Así es <em>por dentro<\/em><\/h2>\s*<p class="entrada">Dentro hay un salón con galería/);
  assert.equal(figuras.length, 7);
  assert.deepEqual(figuras.map((f) => (/<picture data-foto="([^"]+)"/.exec(f) || [])[1]), ESTANCIAS, 'las siete, en el orden de §3.4.2');
  const pies = figuras.map((f) => (/<figcaption>([^<]+)<\/figcaption>/.exec(f) || [])[1]);
  assert.ok(pies.every(Boolean), 'cada foto con su pie');
  for (const f of figuras) assert.match(f, /<img [^>]*alt="[^"]+"/);
  // los puntos (uno por foto, con su nombre) y el pie que se anuncia vienen en el HTML
  const puntos = [.../<ol class="estancias__puntos" id="estancias-puntos"[^>]*>([\s\S]*?)<\/ol>/.exec(sec)[1].matchAll(/<button type="button" data-ir="(\d)" aria-label="([^"]+)"/g)];
  assert.deepEqual(puntos.map((m) => +m[1]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(puntos.map((m) => m[2]), pies);
  assert.match(sec, new RegExp(`<p class="estancias__pie" id="estancias-pie" aria-live="polite">${pies[0]}</p>`));
  assert.equal((sec.match(/class="estancias__btn" data-dir="-?1"/g) || []).length, 2, 'anterior y siguiente');
  assert.match(sec, /<div class="estancias__vista" id="estancias" tabindex="0" role="group" aria-roledescription="carrusel"/);
  // la rejilla de fotos de antes ya no está
  assert.doesNotMatch(sec, /casa__rejilla/);
  // main.js lo monta con el carrusel de comun.js
  assert.match(leer('js/main.js'), /C\.carrusel\(cajaEstancias,/);
});

test('CA-14 · del carrusel solo la primera foto va sin loading="lazy" (CA-22 bis)', () => {
  const { figuras } = carruselCasa();
  const img = (f) => /<img [^>]*>/.exec(f)[0];
  assert.doesNotMatch(img(figuras[0]), /loading="lazy"/);
  assert.doesNotMatch(img(figuras[0]), /fetchpriority="high"/, 'no le quita red a la foto de la portada');
  for (const f of figuras.slice(1)) assert.match(img(f), /loading="lazy"/);
  // y con JavaScript, las otras seis no se pintan hasta que carga la página
  assert.match(leer('css/estilos.css'), /html\.js \.estancias__foto:not\(\.on\):not\(\.lista\) \{ display: none; \}/);
  // … y el carrusel de comun.js no las prepara al montarse, solo al cargar la página o al pasar de foto
  const comun = leer('js/comun.js');
  assert.match(comun, /const ir = \(n, inicio\) => \{\s*if \(!inicio\) preparar\(\);/);
  assert.match(comun, /ir\(0, true\);/);
});

test('CA-21 · la hoja de estilos trae la fila con scroll lateral para cuando no hay JavaScript', () => {
  const css = leer('css/estilos.css');
  const regla = /html:not\(\.js\) \.estancias__pista \{([^}]*)\}/.exec(css);
  assert.ok(regla, 'falta la regla sin JavaScript');
  assert.match(regla[1], /display: flex/);
  assert.match(regla[1], /overflow-x: auto/);
  // sin JavaScript no hay botones ni puntos que no hacen nada
  assert.match(css, /html:not\(\.js\) \.estancias__mando \{ display: none; \}/);
  // y la clase js la pone el script del <head>, antes del primer pintado
  assert.match(leer('index.html'), /<script>\s*\(function \(d\) \{\s*var h = d\.documentElement;\s*h\.classList\.add\('js'\);/);
});

// T14 · /pico-sacro-v2/ y el Pico de la portada

const seccion = (html, id) => (new RegExp(`<section\\b[^>]*\\bid="${id}"[\\s\\S]*?</section>`).exec(html) || [''])[0];

test('CA-16 · el Pico de la portada tiene «Saber más» a pico-sacro-v2/ y no tiene .leyendas', () => {
  const pico = seccion(leer('index.html'), 'pico');
  assert.ok(pico, 'falta la sección del Pico en la portada');
  assert.match(pico, /<a class="btn btn--hueco-osc" href="\.\/pico-sacro-v2\/">Saber más<span class="vh"> sobre el Pico Sacro<\/span><\/a>/);
  assert.ok(!clasesDe(leer('index.html')).some((c) => c.startsWith('leyendas')), 'la portada tiene .leyendas');
  assert.doesNotMatch(pico, /Subir:/);
  // entradilla literal de §3.4.9; escena, 3D, tiempo y sol, como estaban
  assert.match(pico, /<p class="suave">A 1,4 km de la casa y 278 metros por encima\. El dibujo es el cielo de ahora mismo, visto desde la casa\.<\/p>/);
  for (const id of ['pico-dibujo', 'pico-vista', 'pico-mando3d', 'pico-dato', 'pico-hora', 'pico-refran']) assert.match(pico, new RegExp(`id="${id}"`), `falta #${id}`);
  assert.match(leer('js/main.js'), /import\('\.\/pico3d\.js'\)/, 'el 3D sigue en la portada');
});

test('CA-16 · /pico-sacro-v2/ tiene las leyendas con su lista (con la 002: en el HTML)', () => {
  assert.ok(existe('pico-sacro-v2/index.html'), 'falta pico-sacro-v2/index.html');
  const html = leer('pico-sacro-v2/index.html');
  assert.match(html, /<section class="portadilla oscura"[\s\S]*?<p class="eti">El Pico Sacro<\/p>\s*<h1 class="tit" id="portadilla-tit" data-partir>El monte de <em>la Reina Lupa<\/em><\/h1>/);
  assert.match(html, /<title>Pico Sacro · Casa de Casal<\/title>/);
  const ley = (/<div class="leyendas" data-revela>[\s\S]*?<p class="leyendas__subir">[\s\S]*?<\/p>/.exec(html) || [''])[0];
  assert.ok(ley, 'faltan las leyendas');
  // las dos fotos, la lista de pestañas y sus seis hojas con capitular (en el HTML desde la 002; comun.js solo las maneja) y «Subir»
  assert.match(ley, /<picture data-foto="pico-capilla">[\s\S]*<picture data-foto="pico-paso">/);
  assert.match(ley, /<div class="leyendas__lista" role="tablist" aria-label="Leyendas del Pico Sacro" id="leyendas-lista">\s*(?:<button type="button" role="tab" [^>]*>[^<]+<\/button>\s*){6}<\/div>/);
  assert.match(ley, /<div class="leyendas__hoja" id="leyenda-0-hoja" role="tabpanel" aria-labelledby="leyenda-0" tabindex="0">\s*<span class="leyendas__cap" aria-hidden="true">L<\/span>/);
  assert.match(ley, /<b>Subir:<\/b> siete minutos en coche/);
  // el panel con teclado es el de comun.js, que carga la página
  assert.deepEqual(scriptsDe(html), ['js/comun.js']);
  assert.match(leer('js/comun.js'), /\(function leyendas\(\) \{\s*const lista = \$\('#leyendas-lista'\), hojas = \$\('#leyendas-hojas'\);\s*if \(!lista \|\| !hojas\) return;/);
  assert.match(html, /<a href="\.\.\/pico-sacro-v2\/" aria-current="page">El Pico<\/a>/);
  assert.match(html, /<html lang="es" data-raiz="\.\.\/" class="cortina-fuera">/, 'sin cortina en una página interior');
  for (const nombre of Object.keys(BLOQUES)) assert.equal(bloque(html, nombre, 'pico-sacro-v2'), bloque(leer('index.html'), nombre, 'index.html'), nombre);
});

test('T14 · las leyendas se han movido, no copiado: ningún id de <main> se repite con la portada', () => {
  const portada = new Set(idsDeMain(leer('index.html')));
  const pagina = idsDeMain(leer('pico-sacro-v2/index.html'));
  assert.ok(pagina.includes('leyendas-lista'));
  assert.deepEqual(pagina.filter((id) => portada.has(id)), []);
  assert.equal(new Set(pagina).size, pagina.length, 'id repetido dentro de /pico-sacro-v2/');
});

// T15 · datos de alrededores

const enGalicia = (lat, lon) => lat > 41.8 && lat < 43.85 && lon > -9.35 && lon < -6.7;
const cercaDeLaCasa = (lat, lon) => lat > 42.5 && lat < 43.5 && lon > -9.1 && lon < -8.0; // el encuadre del mapa, con A Coruña

test('CA-17 · alrededores.json tiene 11 sitios con coordenadas dentro de Galicia y fuente con fecha', () => {
  const d = leerJSON('datos/alrededores.json');
  assert.ok(enGalicia(d.casa.lat, d.casa.lon), 'la casa cae fuera de Galicia');
  assert.equal(d.sitios.length, 11);
  const esperados = ['Pico Sacro', 'Ponte Ulla', 'Pazo de Oca', 'Santiago', 'Aeropuerto', 'Fervenza do Toxa', 'Carboeiro', 'Rianxo', 'A Coruña', 'Pazo de Ortigueira', 'Ruta dos Muíños de Vedra'];
  assert.deepEqual(d.sitios.map((s) => s.nombre), esperados);
  for (const s of d.sitios) {
    assert.ok(enGalicia(s.lat, s.lon) && cercaDeLaCasa(s.lat, s.lon), `${s.nombre}: coordenadas fuera de Galicia o lejos de la casa`);
    assert.ok(Number.isInteger(s.minutos) && s.minutos > 0 && s.minutos < 120, `${s.nombre}: minutos`);
    assert.match(s.fuente, /^(según la casa|OSRM \d{4}-\d{2}-\d{2})$/, `${s.nombre}: fuente`);
    assert.equal(typeof s.frase, 'string', `${s.nombre}: frase`);
    assert.ok(s.slug === null || /^[a-z0-9-]+$/.test(s.slug), `${s.nombre}: slug`);
    assert.ok(!('etiqueta' in s) || (s.etiqueta && s.etiqueta.ancho && s.etiqueta.estrecho), `${s.nombre}: etiqueta a medias`);
  }
  // Ortigueira y Vedra no tenían minutos: salen de OSRM y llevan su fecha.
  for (const n of ['Pazo de Ortigueira', 'Ruta dos Muíños de Vedra']) assert.match(d.sitios.find((s) => s.nombre === n).fuente, /^OSRM \d{4}-\d{2}-\d{2}$/);
});

test('CA-17 · mapa-alrededores.json pesa menos de 60 KB y lleva la fecha de descarga', () => {
  assert.ok(fs.statSync(path.join(RAIZ, 'datos', 'mapa-alrededores.json')).size < 60 * 1024, 'pesa 60 KB o más');
  const m = leerJSON('datos/mapa-alrededores.json');
  assert.match(m.fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(m.fuente, /OpenStreetMap/);
  assert.ok(m.costa.length > 0 && m.ulla.length > 0 && m.santiago.length > 0, 'falta una capa');
  for (const r of ['AP-9', 'AP-53', 'N-525']) assert.ok(m.carreteras[r]?.length > 0, `falta ${r}`);
  for (const t of [...m.costa, ...m.ulla, ...m.santiago, ...Object.values(m.carreteras).flat()]) {
    assert.ok(t.length > 1);
    for (const [lon, lat] of t) assert.ok(enGalicia(lat, lon), 'un punto del mapa cae fuera de Galicia');
  }
});

// T16 · mapa SVG

/* Copia temporal con una página que lleva <!--mapa--> y con /pico-sacro-v2/
   construida (en el repo aún no existe): así hay una marca con página y las
   demás sin ella. Se construye una vez para las pruebas de T16. */
let conMapa;
const mapaEjemplo = () => {
  if (!conMapa) {
    const dir = copiaTemporal();
    fs.mkdirSync(path.join(dir, 'paginas'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'paginas', 'prueba.src.html'), paginaEjemplo('habitaciones', '<!--mapa-->'));
    fs.writeFileSync(path.join(dir, 'paginas', 'pico-sacro-v2.src.html'), paginaEjemplo('pico'));
    conMapa = { dir, ...construir(dir) };
    assert.ok(conMapa.ok, 'la página con el mapa debería construirse:\n' + conMapa.salida);
    conMapa.html = leer('prueba/index.html', dir);
    conMapa.svgs = [...conMapa.html.matchAll(/<svg class="alr-mapa__svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  }
  return conMapa;
};
// cada marca: <a …data-marca="id">…</a> o <g …data-marca="id">…</g>
const marcasDe = (svg) => [...svg.matchAll(/<(a|g) class="alr-mapa__marca[^"]*"([^>]*)data-marca="([^"]+)">/g)].map((m) => ({ etiqueta: m[1], atrs: m[2], id: m[3] }));

test('CA-17 · el mapa tiene 12 marcas (la casa y 11 sitios) y la atribución de OpenStreetMap', () => {
  const { html, svgs } = mapaEjemplo();
  assert.equal(svgs.length, 2, 'van los dos <svg>: ancho y estrecho');
  assert.match(svgs[0], /alr-mapa__svg--ancho/);
  assert.match(svgs[1], /alr-mapa__svg--estrecho/);
  for (const svg of svgs) {
    const ms = marcasDe(svg);
    assert.equal(ms.length, 12, 'la casa y 11 sitios');
    assert.deepEqual(ms.map((m) => m.id).sort(), ['0', '1', '10', '2', '3', '4', '5', '6', '7', '8', '9', 'casa']);
    assert.match(svg, /class="alr-mapa__tejado"/, 'la casa con el tejado dorado');
    // nombre y minutos en cada sitio
    for (const s of leerJSON('datos/alrededores.json').sitios) {
      assert.ok(svg.includes(`>${s.minutos} min`), `${s.nombre}: faltan los minutos`);
      for (const trozo of s.nombre.split(' ')) assert.ok(svg.includes(trozo), `${s.nombre}: falta el nombre`);
    }
  }
  assert.match(html, /<figcaption class="alr-mapa__pie">© colaboradores de OpenStreetMap<\/figcaption>/);
});

test('CA-17 · A Coruña cae fuera del encuadre: va al borde con una flecha y su distancia', () => {
  for (const svg of mapaEjemplo().svgs) {
    const coru = /data-marca="8">([\s\S]*?)<\/[ag]>/.exec(svg)[1];
    assert.match(coru, /alr-mapa__flecha/);
    assert.match(coru, /62 min · \d+ km/);
  }
});

test('CA-17 · el SVG del mapa no tiene ningún href ni src a otro dominio', () => {
  for (const svg of mapaEjemplo().svgs) {
    const urls = [...svg.matchAll(/\b(?:xlink:)?(?:href|src)\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
    for (const u of urls) assert.ok(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u), `sale fuera: ${u}`);
    assert.doesNotMatch(svg, /<(?:image|use|script|foreignObject)\b|url\(|@import/i, 'nada que se cargue');
  }
});

test('CA-17 · las marcas con página construida son enlaces', () => {
  const { svgs } = mapaEjemplo();
  const d = leerJSON('datos/alrededores.json');
  for (const svg of svgs) {
    const ms = new Map(marcasDe(svg).map((m) => [m.id, m]));
    d.sitios.forEach((s, i) => {
      const m = ms.get(String(i));
      if (s.slug === 'pico-sacro-v2') {
        assert.equal(m.etiqueta, 'a', 'Pico Sacro tiene página: es un enlace');
        assert.match(m.atrs, /href="\.\.\/pico-sacro-v2\/"/, 'enlace relativo a su página');
      } else {
        assert.equal(m.etiqueta, 'g', `${s.nombre}: sin página construida, no es enlace`);
      }
    });
    assert.equal(ms.get('casa').etiqueta, 'g');
  }
});

test('T16 · <!--mapa:…--> con un modo que no existe rompe la construcción; con uno solo sale un <svg>', () => {
  const malo = construirEjemplo(paginaEjemplo('habitaciones', '<!--mapa:enorme-->'));
  assert.equal(malo.ok, false);
  assert.match(malo.salida, /modos desconocidos \(enorme\)/);
  const solo = construirEjemplo(paginaEjemplo('habitaciones', '<!--mapa:estrecho|grande-->'));
  assert.ok(solo.ok, solo.salida);
  const html = leer('prueba/index.html', solo.dir);
  assert.match(html, /<figure class="alr-mapa alr-mapa--grande alr-mapa--solo">/);
  assert.equal((html.match(/<svg class="alr-mapa__svg/g) || []).length, 1);
});

test('T16 · cada sitio y la casa llevan su etiqueta medida en las dos disposiciones', () => {
  const d = leerJSON('datos/alrededores.json');
  const lados = new Set(['e', 'o', 'n', 's', 'ne', 'no', 'se', 'so']);
  for (const s of [d.casa, ...d.sitios]) {
    for (const disp of ['ancho', 'estrecho']) {
      const e = s.etiqueta?.[disp];
      assert.ok(e && lados.has(e.lado) && Number.isFinite(e.dx) && Number.isFinite(e.dy), `${s.nombre}: falta etiqueta.${disp} (node scripts/etiquetas-mapa.mjs)`);
    }
  }
});

// T17 · /entorno/ y Alrededores de la portada

test('CA-1 · construir genera index.html, tu-habitacion/, pico-sacro-v2/, entorno/, los cuatro legales y 404.html, todos con noindex,nofollow (con la 002)', () => {
  const paginas = ['index.html', 'tu-habitacion/index.html', 'pico-sacro-v2/index.html', 'entorno/index.html', ...LEGALES.map((l) => `${l}/index.html`), '404.html'];
  // con la 002 se suman las páginas nuevas que ya tienen fuente en paginas/; cada una tiene que ser
  // de datos/paginas.json (si no, sobra)
  const delGrupo = new Set(leerJSON('datos/paginas.json').grupos.flatMap((g) => g.paginas.map((p) => `${p.slug}/index.html`)));
  const nuevas = fs.readdirSync(path.join(RAIZ, 'paginas')).filter((f) => f.endsWith('.src.html')).map((f) => `${f.slice(0, -'.src.html'.length)}/index.html`).filter((rel) => !paginas.includes(rel));
  for (const rel of nuevas) assert.ok(delGrupo.has(rel), `${rel}: sobra (tiene fuente y no está en datos/paginas.json)`);
  const todas = [...paginas, ...nuevas];
  for (const rel of todas) {
    assert.ok(existe(rel), `falta ${rel}`);
    assert.match(leer(rel), /<meta name="robots" content="noindex,nofollow">/, rel);
  }
  // y son las mismas que salen de las fuentes: ninguna sobra ni falta
  assert.deepEqual([...paginasGeneradas()].sort(), todas.sort());
});

/* La sección de alrededores de una página: el mapa, la lista y sus enlaces. */
const listaDe = (html) => (/<ul class="alr-lista">([\s\S]*?)<\/ul>/.exec(html) || [])[1];
const itemsDe = (lista) => [...lista.matchAll(/<li>(?:<a class="enlace" href="([^"]+)">|<b>)([^<]+)<\/(?:a|b)><span>([^<]+)<\/span><\/li>/g)].map((m) => ({ href: m[1] || null, nombre: m[2], texto: m[3] }));

function compruebaAlrededores(html, prefijo, construidas, rel) {
  const d = leerJSON('datos/alrededores.json');
  // el mapa (las dos disposiciones) con su atribución
  assert.equal((html.match(/<svg class="alr-mapa__svg/g) || []).length, 2, `${rel}: el mapa ancho y el estrecho`);
  assert.match(html, /<figcaption class="alr-mapa__pie">© colaboradores de OpenStreetMap<\/figcaption>/, `${rel}: atribución`);
  // la lista: los 11 sitios, de más cerca a más lejos, con nombre, minutos y frase
  const lista = listaDe(html);
  assert.ok(lista, `${rel}: falta la lista accesible`);
  const items = itemsDe(lista);
  assert.equal(items.length, 11, `${rel}: 11 sitios en la lista`);
  const minutos = items.map((it) => parseInt(it.texto, 10));
  assert.deepEqual(minutos, [...minutos].sort((a, b) => a - b), `${rel}: la lista va de más cerca a más lejos`);
  for (const s of d.sitios) {
    const it = items.find((x) => x.nombre === s.nombre);
    assert.ok(it, `${rel}: falta ${s.nombre} en la lista`);
    assert.equal(it.texto, s.frase ? `${s.minutos} min · ${s.frase}` : `${s.minutos} min`, `${rel}: ${s.nombre}`);
    // enlace solo si su página está construida, en la lista y en el mapa
    const href = s.slug && construidas.has(s.slug) ? `${prefijo}${s.slug}/` : null;
    assert.equal(it.href, href, `${rel}: enlace de ${s.nombre} en la lista`);
    const enMapa = (html.match(new RegExp(`<a class="alr-mapa__marca" href="${(prefijo + (s.slug || '')).replace(/[.]/g, '\\.')}/"`, 'g')) || []).length;
    assert.equal(enMapa, href ? 2 : 0, `${rel}: enlace de ${s.nombre} en el mapa`);
  }
}

test('CA-17 · la portada y /entorno/ llevan el mapa, la lista accesible y sus enlaces (con la 002: <title> definitivo)', () => {
  const construidas = new Set(['pico-sacro-v2']);
  const portada = leer('index.html');
  const alr = seccion(portada, 'alrededores');
  compruebaAlrededores(alr, './', construidas, 'portada');
  // la portada: sin la regla, con «Si haces el Camino» y «Saber más» a /entorno/
  assert.doesNotMatch(portada, /id="regla"|id="regla-lista"|id="datos-alrededores"/, 'la portada no lleva la regla');
  assert.match(alr, /<h3 id="pere-tit">Si haces el Camino<\/h3>/);
  assert.match(alr, /<a class="btn btn--hueco-osc" href="\.\/entorno\/">Saber más<span class="vh"> sobre el entorno<\/span><\/a>/);

  const entorno = leer('entorno/index.html');
  assert.match(entorno, /<section class="portadilla oscura"[\s\S]*?<p class="eti">Entorno<\/p>\s*<h1 class="tit" id="portadilla-tit" data-partir>Toda Galicia, <em>sin perder el día<\/em> en la carretera<\/h1>/);
  assert.match(entorno, /<title>Entorno: qué visitar cerca de Santiago · Casa de Casal<\/title>/);
  compruebaAlrededores(entorno, '../', construidas, 'entorno');
  assert.match(entorno, /<figure class="alr-mapa alr-mapa--grande">/, 'el mapa, en grande');
  assert.match(entorno, /<h3 id="pere-tit">Si haces el Camino<\/h3>/);
  assert.match(entorno, /<a href="\.\.\/entorno\/" aria-current="page">Entorno<\/a>/);
  assert.match(entorno, /<html lang="es" data-raiz="\.\.\/" class="cortina-fuera">/, 'sin cortina en una página interior');
  for (const nombre of Object.keys(BLOQUES)) assert.equal(bloque(entorno, nombre, 'entorno'), bloque(portada, nombre, 'index.html'), nombre);
});

test('CA-17 · /entorno/ lleva la regla y sus datos salen de alrededores.json (PD-7, PD-8)', () => {
  const entorno = leer('entorno/index.html');
  assert.match(entorno, /<div class="regla" id="regla" role="img" aria-label="Minutos en coche desde la casa"><\/div>/);
  const datos = JSON.parse(/<script type="application\/json" id="datos-alrededores">([^<]*)<\/script>/.exec(entorno)[1]);
  assert.deepEqual(datos.sitios, leerJSON('datos/alrededores.json').sitios.map(({ nombre, minutos }) => ({ nombre, minutos })));
  assert.deepEqual(scriptsDe(entorno), ['js/comun.js'], 'la regla es de comun.js');
  // la regla está en comun.js y lee los datos; la lista P escrita a mano ya no existe
  const comun = leer('js/comun.js');
  assert.match(comun, /\(function regla\(\) \{\s*const caja = \$\('#regla'\);\s*if \(!caja\) return;/);
  assert.match(comun, /JSON\.parse\(\$\('#datos-alrededores'\)\.textContent\)/);
  for (const js of ['js/comun.js', 'js/main.js']) {
    const txt = leer(js);
    for (const viejo of ["t('Pico Sacro')", "t('según la casa')", "t('el Versalles gallego')", '#regla-lista']) assert.ok(!txt.includes(viejo), `${js} todavía tiene ${viejo}`);
  }
  assert.ok(!leer('js/main.js').includes("'#regla'"), 'main.js no pinta la regla');
});

test('CA-17 · un sitio cuya página se construye pasa a ser enlace en la lista y en el mapa', () => {
  const dir = copiaTemporal();
  fs.writeFileSync(path.join(dir, 'paginas', 'pazo-de-oca-v2.src.html'), paginaEjemplo('entorno'));
  const r = construir(dir);
  assert.ok(r.ok, r.salida);
  const entorno = leer('entorno/index.html', dir);
  const oca = itemsDe(listaDe(entorno)).find((x) => x.nombre === 'Pazo de Oca');
  assert.equal(oca.href, '../pazo-de-oca-v2/');
  assert.equal((entorno.match(/<a class="alr-mapa__marca" href="\.\.\/pazo-de-oca-v2\/"/g) || []).length, 2);
});

test('CA-19 · en /entorno/ ningún enlace lleva a una página no construida', () => {
  const html = leer('entorno/index.html');
  const enlaces = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  let propios = 0;
  for (const h of enlaces) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(h) || h.startsWith('#')) continue;   // fuera de la web, teléfono, correo o la misma página
    const ruta = new URL(h, 'https://casa.test/entorno/').pathname;
    propios++;
    assert.ok(estaConstruida(ruta), `${h} → ${ruta}: no es una página construida`);
    const salida = ruta === '/' ? 'index.html' : ruta.slice(1) + (ruta.endsWith('/') ? 'index.html' : '');
    assert.ok(existe(salida), `${h}: falta ${salida}`);
  }
  assert.ok(propios > 10, 'la página tiene sus enlaces internos');
});

// T18 · documentos fuera de la salida

import { enlacesADocumentos } from './lib/documentos.mjs';

test('CA-29 · ningún HTML, JS o CSS de la salida enlaza a CLAUDE.md, SDD.md, DECISIONES.md ni specs/', () => {
  assert.deepEqual(enlacesADocumentos(RAIZ), []);
  // y la comprobación los encuentra: una salida de ejemplo que enlaza a cada uno
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casal-docs-'));
  temporales.push(dir);
  fs.mkdirSync(path.join(dir, 'js'));
  fs.mkdirSync(path.join(dir, 'tu-habitacion'));
  fs.writeFileSync(path.join(dir, 'tu-habitacion', 'index.html'), '<a href="../SDD.md">a</a><a href="../specs/001-base-mapa-portada/spec.md">b</a><a href="../entorno/">c</a>');
  fs.writeFileSync(path.join(dir, 'js', 'x.js'), "fetch('../DECISIONES.md'); const y = 'CLAUDE.md no es un enlace';");
  fs.writeFileSync(path.join(dir, 'x.css'), '.a { background: url("CLAUDE.md"); }');
  assert.deepEqual(enlacesADocumentos(dir).sort(), ['js/x.js → ../DECISIONES.md', 'tu-habitacion/index.html → ../SDD.md', 'tu-habitacion/index.html → ../specs/001-base-mapa-portada/spec.md', 'x.css → CLAUDE.md']);
});

// CA-24 · que verificar.mjs no vuelva a las andadas (reglas de Playwright de ../CLAUDE.md)
test('CA-24 · verificar.mjs: sin swiftshader ni esperas al 3D, escala 1 y el navegador se cierra en finally', () => {
  // sin comentarios (los «//» de una URL, como 'http://…', no cuentan: van pegados a «:»)
  const v = leer('verificar.mjs').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(v, /swiftshader|--use-gl|--use-angle/);
  assert.doesNotMatch(v, /__pico3d/);
  const escalas = [...v.matchAll(/deviceScaleFactor:\s*([\d.]+)/g)].map((m) => m[1]);
  assert.ok(escalas.length > 0 && escalas.every((x) => x === '1'), `deviceScaleFactor: ${escalas}`);
  assert.equal((v.match(/chromium\.launch\(/g) || []).length, 1, 'un solo navegador');
  assert.match(v, /chromium\.launch\([^)]*\);?\s*try\s*\{/, 'el navegador abre y justo después empieza el try');
  assert.match(v, /\}\s*finally\s*\{\s*await browser\.close\(\)/, 'y se cierra en el finally');
  assert.match(v, /reducedMotion:\s*movimiento \? 'no-preference' : 'reduce'/, 'movimiento reducido salvo donde se pide');
});

/* ==================================================================
   spec 002 · Páginas interiores en castellano (§10, plan PD-2)
   ==================================================================
   - Los criterios «por página» (CA-9 a CA-13, CA-26, el tope de fotos de §3.4
     y el tope p28 de CA-19) van en bucles: si el slug está en HECHAS, test();
     si no, todo(). Cada tarea de página añade sus slugs a HECHAS.
   - Los criterios de conjunto van con todo(): el código ya está escrito, pero
     no se ejecuta. La tarea que lo activa cambia `todo(` por `test(`.
   - Lo que necesita navegador está en verificar.mjs como PENDIENTE (T18, T19).
   - El código de cada prueba está escrito con lo que dice la spec; donde el
     marcado o la función los decide una tarea, lo dice un comentario `// T0N:`. */
import { cargarCasa, escritosAMano } from './lib/datos-casa.mjs';

{
  /* Las páginas a las que ya se les aplican sus pruebas por página. */
  const HECHAS = new Set(['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', 'contactar', 'pico-sacro-v2', 'tu-habitacion', 'entorno', 'casa-pequena-do-casal', 'desayunos-artesanos', 'manjares-gallegos']);   // T08: los cuatro legales; T09: contactar; T10: pico-sacro-v2; T11: tu-habitacion y entorno; T12: casa pequena, desayunos y manjares

  /* Un criterio sin activar: test.todo sin función, para que su código no se
     ejecute (algunas construyen copias o lanzan scripts). */
  const todo = (nombre, _fn) => test.todo(nombre);
  const porPagina = (slug) => (HECHAS.has(slug) ? test : todo);

  /* §3.1: los dos grupos, en su orden, con la columna <title>. */
  const CASA = [
    ['tu-habitacion', 'Tu habitación'],
    ['casa-pequena-do-casal', 'Casa Pequena do Casal'],
    ['desayunos-artesanos', 'Desayunos artesanos'],
    ['manjares-gallegos', 'Manjares gallegos'],
    ['tus-rincones-favoritos', 'Tus rincones favoritos'],
    ['piscina-de-agua-salada', 'Piscina de agua salada'],
    ['viajar-con-ninos', 'Viajar con niños'],
    ['servicios', 'Servicios'],
    ['que-necesitas', '¿Qué necesitas?'],
    ['experiencias', 'Experiencias'],
    ['nuestro-camino', 'Nuestro camino'],
    ['contactar', 'Contactar'],
  ];
  const ENTORNO = [
    ['entorno', 'Entorno: qué visitar cerca de Santiago'],
    ['pico-sacro-v2', 'Pico Sacro'],
    ['via-de-la-plata-v2', 'Vía de la Plata y Camino Sanabrés'],
    ['ruta-molinos-vedra-v2', 'Ruta de los molinos de Vedra'],
    ['fervenza-del-rio-toxa-v2', 'Fervenza del río Toxa'],
    ['pazo-de-oca-v2', 'Pazo de Oca'],
    ['pazo-de-ortigueira-v2', 'Pazo de Ortigueira'],
    ['monasterio-de-carboeiro-v2', 'Monasterio de Carboeiro'],
  ];
  const TITULO = new Map([...CASA, ...ENTORNO]);
  const PAGINAS = [...TITULO.keys()];                                   // las 20
  const ACOGIDA = ['tu-habitacion', 'pico-sacro-v2', 'entorno'];
  const NUEVAS = PAGINAS.filter((s) => !ACOGIDA.includes(s));           // las 17
  const SITIOS = ['ruta-molinos-vedra-v2', 'fervenza-del-rio-toxa-v2', 'pazo-de-oca-v2', 'pazo-de-ortigueira-v2', 'monasterio-de-carboeiro-v2'];
  const CON_WEB_OFICIAL = ['pazo-de-oca-v2', 'pazo-de-ortigueira-v2', 'monasterio-de-carboeiro-v2'];
  const VIA = 'via-de-la-plata-v2', PICO = 'pico-sacro-v2';
  const LEGALES_002 = [['aviso-legal', 'Aviso legal'], ['privacidad', 'Privacidad'], ['cookies', 'Cookies'], ['accesibilidad', 'Accesibilidad']];
  for (const [s, t] of LEGALES_002) TITULO.set(s, t);
  // §3.8: las 23 secciones de origen.md (las 20 y las tres que pasan a 301)
  const SECCIONES_ORIGEN = [...PAGINAS, 'un-detalle-para-sorprender', 'monumentos-naturales-y-leyendas', 'descarga-nuestras-guias'];
  // CA-6 y CA-15 comparan con la 001 terminada: el commit del que sale feat/002-base
  const REF_001 = '8af70a2';

  /* ---------- ayudas ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', euro: '€', ndash: '–', mdash: '—' };
  const desentidades = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    : ENT[e.toLowerCase()] ?? m));
  const BLOQUE = /<\/?(?:p|div|li|ul|ol|h[1-6]|br|section|article|nav|header|footer|aside|figure|figcaption|blockquote|dt|dd|dl|table|tr|td|th|picture|img|button|address)\b[^>]*>/gi;
  const htmlDe = (slug) => leer(`${slug}/index.html`);
  const fuenteDe002 = (slug, dir = RAIZ) => leer(`paginas/${slug}.src.html`, dir);
  const mainDe = (html) => {
    const m = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html);
    assert.ok(m, 'la página no tiene <main>');
    return m[1];
  };
  /* Texto visible de <main> (§10): sin <script>, <style>, comentarios ni atributos. */
  const textoVisible = (html) => desentidades(mainDe(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BLOQUE, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[\s ]+/g, ' ').trim();
  /* El comentario de datos de una fuente: <!--pagina {…}--> */
  const metaDe = (slug, dir = RAIZ) => {
    const m = /^<!--pagina (\{[\s\S]*?\})-->/.exec(fuenteDe002(slug, dir).replace(/^﻿/, ''));
    assert.ok(m, `paginas/${slug}.src.html: sin <!--pagina {…}-->`);
    return JSON.parse(m[1]);
  };
  const tituloDe = (html) => desentidades((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '');
  const descripcionDe = (html) => desentidades((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '');
  const ogTituloDe = (html) => desentidades((/<meta property="og:title" content="([^"]*)"/.exec(html) || [])[1] || '');
  /* Los JSON-LD de una página, aplanados (@graph y listas). */
  const jsonLDs = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((m) => { const j = JSON.parse(m[1]); return [].concat(j).flatMap((o) => (o && o['@graph'] ? o['@graph'] : [o])); });
  const tiposDe = (o) => [].concat(o['@type'] || []);
  const sitioDe = (slug) => leerJSON('datos/alrededores.json').sitios.find((s) => s.slug === slug);
  const escRe = (x) => x.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const cerca = (a, b) => Math.abs(Number(a) - Number(b)) < 0.001;
  /* Ruta de la web a la que lleva un href de la página `rel` («entorno/index.html»):
     «/x/», «/», «/img/…». null si es de fuera, un ancla suelta, tel:, mailto:… */
  const rutaDe = (href, rel) => {
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return null;
    const camino = href.split('#')[0].split('?')[0];
    if (!camino) return null;
    const r = camino.startsWith('/') ? camino : path.posix.resolve('/' + path.posix.dirname(rel) + '/', camino);
    return (camino.endsWith('/') || camino === '.' || camino === '..') && !r.endsWith('/') ? r + '/' : r;
  };
  const slugDeRuta = (r) => (r === '/' ? '' : (/^\/([a-z0-9-]+)\/$/.exec(r) || [])[1] || null);
  const enlacesDe = (trozo) => [...trozo.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    atrs: m[1],
    href: desentidades((/\bhref="([^"]*)"/.exec(m[1]) || [])[1] || ''),
    texto: desentidades(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    html: m[0],
  }));
  /* «Sigue leyendo» (§3.5). T04: la clase del bloque es `sigue-leyendo`, en un
     elemento sin otro igual dentro; si el marcado es otro, cámbialo solo aquí. */
  const RE_SIGUE = /<(nav|section|aside|div)\b[^>]*\bclass="[^"]*\bsigue-leyendo\b[^"]*"[^>]*>[\s\S]*?<\/\1>/;
  const sigueDe = (html) => (RE_SIGUE.exec(html) || [null])[0];
  /* Fotos de <main> sin las miniaturas de «Sigue leyendo». */
  const fotosDe = (html) => [...mainDe(html).replace(RE_SIGUE, '').matchAll(/<picture data-foto="([^"]+)">([\s\S]*?)<\/picture>/g)]
    .map((m) => ({ nombre: m[1], img: (/<img\b[^>]*>/.exec(m[2]) || [''])[0] }));
  const origenDe = (slug) => {
    const f = path.join(RAIZ, 'specs', '002-paginas-interiores', 'origen.md');
    if (!fs.existsSync(f)) return '';
    const t = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const i = t.indexOf(`\n## ${slug}\n`);
    if (i < 0) return '';
    const fin = t.indexOf('\n## ', i + 1);
    return t.slice(i, fin < 0 ? undefined : fin);
  };
  const deGit = (rel) => execFileSync('git', ['show', `${REF_001}:${rel}`], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\r\n/g, '\n');
  /* Un bloque de una página, sin lo que la spec deja cambiar: la raíz relativa y aria-current. */
  const normalizar = (s) => s.replace(/\r\n/g, '\n')
    .replace(/ aria-current="page"/g, '')
    .replace(/\b(href|src|srcset)="(?:\.\/|(?:\.\.\/)+)/g, '$1="{raiz}')
    .replace(/href="\{raiz\}#/g, 'href="#');
  const RE_CABECERA = /<header class="cab"[\s\S]*?<\/header>/;
  const RE_LLEGAR = /<section\b[^>]*\bid="llegar"[\s\S]*?<\/section>/;
  const verificarEn = (dir, ...args) => {
    try { return { ok: true, salida: execFileSync(process.execPath, [path.join(dir, 'verificar.mjs'), ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) }; }
    catch (e) { return { ok: false, salida: String(e.stdout || '') + String(e.stderr || '') }; }
  };

  /* ================= criterios por página ================= */

  // CA-9: lo que no puede quedar en ninguna página interior ni en las fuentes de paginas/
  const CA9 = [
    /glic[ií]n/i, /albornoc/i, /servicio de cenas/i, /cenas caseras/i, /cenas 100/i, /reservar la cena/i, /debido al coronavirus/i,
    /CASALESTEDO/i, /tarjeta regalo/i, /\bbonos?\b/i, /100% seguro/i, /mejor precio/i, /15\/1999/i, /acuerdo rgpd/i,
    /nueve habitaciones/i, /\b9 habitaciones/i, /C\/ ?Pedro Ballesteros/i,
    /1\.?400\s?(€|euros)/i, /550\s?(€|euros)/i, /650\s?(€|euros)/i,
    /booking/i, /tripadvisor/i,
    /enrique iglesias/i, /general armada/i, /hohenlohe/i,
    /v[ií]a stellae/i, /casa ma[ñn]oso/i, /casa casarellos/i, /pazo bendoiro/i, /trasfontao/i, /fuentemayor/i, /ecohotel/i,
    /hotel victorino/i, /opciones de alojamiento/i, /alojamiento rural pazos/i,
  ];
  const CON_LAGAR = ['casa-pequena-do-casal', 'pazo-de-ortigueira-v2'];
  for (const slug of [...PAGINAS, ...LEGALES_002.map(([s]) => s)]) {
    porPagina(slug)(`CA-9 · ${slug} · ni en el texto visible ni en la fuente casa ninguna de las cadenas prohibidas${CON_LAGAR.includes(slug) ? '' : ' (ni «lagar»)'}`, () => {
      const lista = CON_LAGAR.includes(slug) ? CA9 : [...CA9, /lagar/i];
      const textos = { 'texto visible': textoVisible(htmlDe(slug)), [`paginas/${slug}.src.html`]: desentidades(fuenteDe002(slug)) };
      const malas = [];
      for (const [donde, t] of Object.entries(textos)) for (const re of lista) { const m = re.exec(t); if (m) malas.push(`${donde}: «${m[0]}»`); }
      assert.deepEqual(malas, []);
    });
  }

  // CA-10: precios, teléfonos y horarios, en los cinco sitios, el Pico y la Vía
  const RE_PRECIO = /\d+([,.]\d+)?\s?(€|euros?)/i;
  const RE_TEL = /(?<!\d)(?:\d[ .]?){8}\d(?!\d)/;
  const RE_HORARIOS = [/\b(?:de|a las|entre)\s+\d{1,2}([:.]\d{2})?\s*(a|–|-|y)\s*\d{1,2}([:.]\d{2})?\b/i, /\d{1,2}:\d{2}/];
  const FRASE_WEB = 'Horarios y precios, en su web oficial';
  for (const slug of [...SITIOS, PICO, VIA]) {
    const conWeb = CON_WEB_OFICIAL.includes(slug);
    porPagina(slug)(`CA-10 · ${slug} · sin precios, teléfonos (salvo el suyo) ni horarios en el texto visible${conWeb ? ` y con «${FRASE_WEB}»` : ''}`, () => {
      const html = htmlDe(slug);
      const t = textoVisible(html);
      const sinElSuyo = t.replace(/(?:\+34\s?)?698(?:[ .]?\d){6}(?!\d)/g, ' ');   // 698 148 323 o 698 14 83 23
      const malas = [];
      for (const [que, re] of [['precio', RE_PRECIO], ['teléfono', RE_TEL], ...RE_HORARIOS.map((r) => ['horario', r])]) {
        const m = re.exec(que === 'teléfono' ? sinElSuyo : t);
        if (m) malas.push(`${que}: «${m[0]}»`);
      }
      assert.deepEqual(malas, []);
      if (!conWeb) return;
      assert.ok(t.includes(FRASE_WEB), `falta «${FRASE_WEB}»`);
      // el enlace va en el mismo párrafo o elemento de lista; si no hay, origen.md dice por qué
      const main = mainDe(html);
      const i = main.indexOf(FRASE_WEB);
      const ini = Math.max(main.lastIndexOf('<p>', i), main.lastIndexOf('<p ', i), main.lastIndexOf('<li', i));   // «<p» a secas casaría con <picture>
      const fin = Math.min(...['</p>', '</li>'].map((c) => main.indexOf(c, i)).filter((x) => x >= 0));
      const externos = enlacesDe(main.slice(ini, fin)).filter((a) => /^https?:\/\//.test(a.href));
      if (externos.length) {
        for (const a of externos) {
          assert.match(a.atrs, /\btarget="_blank"/, `${a.href}: en otra pestaña`);
          assert.match(a.atrs, /\brel="[^"]*\bnoopener\b/, `${a.href}: rel noopener`);
        }
      } else assert.match(origenDe(slug), /web oficial/i, `sin enlace a su web oficial: origen.md (## ${slug}) tiene que decir por qué`);
    });
  }

  // CA-11: «Abrir en Google Maps» y geo con las coordenadas de alrededores.json; ninguna en el texto
  const RE_COORDENADAS = [/\b4[1-3][.,]\d{4,}\b/, /\b[6-9][.,]\d{4,}\b/, /\d{1,2}\s?°\s?\d{1,2}\s?['′]/];
  for (const slug of [...SITIOS, PICO, VIA]) {
    const conSitio = slug !== VIA;   // la Vía no tiene entrada en alrededores.json: solo «ninguna coordenada en el texto»
    porPagina(slug)(`CA-11 · ${slug} · ${conSitio ? '«Abrir en Google Maps» y el geo del TouristAttraction con las coordenadas de alrededores.json; ' : ''}ninguna coordenada en el texto visible`, () => {
      const html = htmlDe(slug);
      const t = textoVisible(html);
      const sitio = conSitio ? sitioDe(slug) : null;
      const malas = RE_COORDENADAS.map((re) => re.exec(t)).filter(Boolean).map((m) => `«${m[0]}»`);
      if (sitio) for (const v of [sitio.lat, Math.abs(sitio.lon)]) {
        const tres = Math.abs(v).toFixed(3);
        for (const forma of [tres, tres.replace('.', ',')]) if (new RegExp(`(?<!\\d)${escRe(forma)}(?!\\d)`).test(t)) malas.push(`«${forma}»`);
      }
      assert.deepEqual(malas, [], 'coordenadas en el texto visible');
      if (!conSitio) return;
      assert.ok(sitio, `alrededores.json no tiene ningún sitio con slug ${slug}`);
      if (slug === 'pazo-de-ortigueira-v2') assert.ok(cerca(sitio.lat, 42.771) && cerca(sitio.lon, -8.426), 'Ortigueira: 42,771 N / 8,426 O en alrededores.json');
      const maps = enlacesDe(mainDe(html)).filter((a) => a.texto === 'Abrir en Google Maps');
      assert.ok(maps.length, 'falta el enlace «Abrir en Google Maps»');
      for (const a of maps) {
        const m = /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=(-?[\d.]+),(-?[\d.]+)$/.exec(a.href);
        assert.ok(m, `«Abrir en Google Maps»: ${a.href}`);
        assert.ok(cerca(m[1], sitio.lat) && cerca(m[2], sitio.lon), `Google Maps: ${m[1]},${m[2]} y alrededores.json ${sitio.lat},${sitio.lon}`);
        assert.match(a.atrs, /\btarget="_blank"/, '«Abrir en Google Maps» en otra pestaña');
        assert.match(a.atrs, /\brel="[^"]*\bnoopener\b/, '«Abrir en Google Maps»: rel noopener');
      }
      const ta = jsonLDs(html).filter((o) => tiposDe(o).includes('TouristAttraction'));
      assert.equal(ta.length, 1, 'un TouristAttraction');
      assert.ok(cerca(ta[0].geo?.latitude, sitio.lat) && cerca(ta[0].geo?.longitude, sitio.lon), `geo ${JSON.stringify(ta[0].geo)} y alrededores.json ${sitio.lat},${sitio.lon}`);
    });
  }

  // CA-12: TouristAttraction en los sitios y el Pico; ni en /entorno/ ni en la Vía
  for (const slug of [...SITIOS, PICO, 'entorno', VIA]) {
    const lleva = slug !== 'entorno' && slug !== VIA;
    porPagina(slug)(`CA-12 · ${slug} · ${lleva ? 'un TouristAttraction con name, description y geo, sin url ni image' : 'sin TouristAttraction'}; ni LodgingBusiness ni FAQPage`, () => {
      const html = htmlDe(slug);
      const lds = jsonLDs(html);   // si uno no se parsea, JSON.parse falla aquí
      const tipos = lds.flatMap(tiposDe);
      assert.ok(!tipos.includes('LodgingBusiness') && !tipos.includes('FAQPage'), `tipos: ${tipos.join(', ')}`);
      const ta = lds.filter((o) => tiposDe(o).includes('TouristAttraction'));
      if (!lleva) { assert.equal(ta.length, 0, 'no lleva TouristAttraction'); return; }
      assert.equal(ta.length, 1, 'un TouristAttraction');
      const [o] = ta;
      assert.ok(o.name && typeof o.name === 'string', 'name');
      assert.equal(o.description, descripcionDe(html), 'description: la de la página (§3.7)');
      assert.ok(o.geo && tiposDe(o.geo).includes('GeoCoordinates') && Number.isFinite(Number(o.geo.latitude)) && Number.isFinite(Number(o.geo.longitude)), 'geo: GeoCoordinates');
      assert.ok(!('url' in o) && !('image' in o), 'sin url ni image hasta la 005');
    });
  }

  // CA-13: <title> y description de cada página interior y de cada legal
  let metas;
  const todasLasMetas = () => (metas ||= paginasGeneradas().map((rel) => { const h = leer(rel); return { rel, titulo: tituloDe(h), descripcion: descripcionDe(h) }; }));
  for (const slug of [...PAGINAS, ...LEGALES_002.map(([s]) => s)]) {
    const titulo = `${TITULO.get(slug)} · Casa de Casal`;
    porPagina(slug)(`CA-13 · ${slug} · <title> «${titulo}» y description de 110 a 155`, () => {
      const html = htmlDe(slug);
      const rel = `${slug}/index.html`;
      assert.equal(tituloDe(html), titulo);
      assert.equal(ogTituloDe(html), titulo, 'og:title igual que <title> (§3.3)');
      const d = descripcionDe(html);
      const n = [...d].length;
      assert.ok(n >= 110 && n <= 155, `description de ${n} caracteres: «${d}»`);
      assert.notEqual(d, titulo, 'la description no es el <title> (el provisional de la 001)');
      assert.doesNotMatch(d, /booking/i);
      assert.doesNotMatch(d, RE_PRECIO);
      for (const o of todasLasMetas().filter((x) => x.rel !== rel)) {
        assert.notEqual(o.titulo, titulo, `mismo <title> que ${o.rel}`);
        assert.notEqual(o.descripcion, d, `misma description que ${o.rel}`);
      }
    });
  }

  // CA-26: ninguna fecha de la piscina, temporada ni precio escritos a mano en la fuente
  const fechasDeTemporada = (casa) => {
    const fechas = [casa.piscina.desde, casa.piscina.hasta, ...Object.values(casa.temporadas).flatMap((x) => [x.desde, x.hasta])];
    return [...new Set(fechas)].flatMap((mmdd) => {
      const [m, d] = mmdd.split('-').map(Number);
      const f = new Date(Date.UTC(2001, m - 1, d));
      const larga = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(f);   // «1 de abril»
      const mes = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(f);
      return [larga, `${d} ${mes.slice(0, 3)}`];   // y «1 abr», como en su web
    });
  };
  for (const slug of PAGINAS) {
    porPagina(slug)(`CA-26 · ${slug} · la fuente no tiene escrita a mano una fecha de la piscina, una temporada ni un precio`, () => {
      const casa = cargarCasa(RAIZ);
      const rel = path.join('paginas', `${slug}.src.html`);
      assert.deepEqual(escritosAMano(casa, [rel], RAIZ), []);
      const t = desentidades(fuenteDe002(slug));
      const malas = fechasDeTemporada(casa).filter((f) => new RegExp(`(?<![\\d])${f.replace(/ /g, '\\s+')}\\b`, 'i').test(t));
      assert.deepEqual(malas, [], 'fechas de casa.json escritas a mano');
    });
  }

  // §3.4: portadilla y como máximo otras cuatro fotos (sitios: otras dos), en diferido
  for (const slug of NUEVAS) {
    const tope = SITIOS.includes(slug) ? 2 : 4;
    porPagina(slug)(`§3.4 · ${slug} · fotos: la portadilla y como mucho ${tope} más, en diferido (sin contar «Sigue leyendo»)`, () => {
      const html = htmlDe(slug);
      const fotos = fotosDe(html);
      assert.ok(fotos.length >= 1, 'sin foto de portadilla');
      assert.ok(fotos.length <= 1 + tope, `${fotos.length} fotos: ${fotos.map((f) => f.nombre).join(', ')}`);
      assert.equal(fotos[0].nombre, metaDe(slug).foto, 'la primera es la de la portadilla');
      assert.match(fotos[0].img, /\bfetchpriority="high"/, 'la portadilla, con fetchpriority="high"');
      for (const f of fotos.slice(1)) {
        assert.match(f.img, /\bloading="lazy"/, `${f.nombre}: loading="lazy"`);
        assert.doesNotMatch(f.img, /\bfetchpriority=/, `${f.nombre}: solo la portadilla lleva fetchpriority`);
      }
    });
  }

  // CA-19: cada sitio, como mucho tres fotos p28. T07: fotos.json lleva el campo p28 (PD-5).
  for (const slug of SITIOS) {
    porPagina(slug)(`CA-19 · ${slug} · como mucho tres fotos p28`, () => {
      const p28 = new Set(leerJSON('img/fotos/fotos.json').filter((f) => f.p28 === true).map((f) => f.nombre));
      const suyas = fotosDe(htmlDe(slug)).filter((f) => p28.has(f.nombre));
      assert.ok(suyas.length <= 3, `${suyas.length} fotos p28: ${suyas.map((f) => f.nombre).join(', ')}`);
    });
  }

  /* ================= criterios de conjunto ================= */

  // T03 · CA-3
  const ONCE = [
    ['/entorno/ruta-dos-muinos/', '301', '/ruta-molinos-vedra-v2/', '002'],
    ['/entorno/monasterio-carboeiro/', '301', '/monasterio-de-carboeiro-v2/', '002'],
    ['/entorno/pazo-ortigueira/', '301', '/pazo-de-ortigueira-v2/', '002'],
    ['/entorno/pazo-oca/', '301', '/pazo-de-oca-v2/', '002'],
    ['/entorno/ruta-de-senderismo-fervenza-rio-toxa/', '301', '/fervenza-del-rio-toxa-v2/', '002'],
    ['/entorno/pico-sacro/', '301', '/pico-sacro-v2/', '002'],
    ['/etapas-via-plata-camino-sanabres/', '301', '/via-de-la-plata-v2/', '002'],
    ['/faqs/', '301', '/que-necesitas/', '002'],
    ['/politica-de-cancelacion-de-reservas/', 'pendiente', '/condiciones-de-reserva/', '003'],
    ['/reservas.html', 'pendiente', null, '003'],
    ['/casapequena/reservas.html', 'pendiente', null, '003'],
  ];
  test('CA-3 · mapa-url.json: 58 entradas (20 301, 4 nueva, 10 pendiente, 24 pagina) y las once de §3.2; .htaccess 20 RedirectMatch y _redirects 40 líneas', () => {
    const mapa = mapaUrl();
    assert.equal(mapa.length, 58);
    const cuenta = (a) => mapa.filter((e) => e.accion === a).length;
    assert.deepEqual({ '301': cuenta('301'), nueva: cuenta('nueva'), pendiente: cuenta('pendiente'), pagina: cuenta('pagina') }, { '301': 20, nueva: 4, pendiente: 10, pagina: 24 });
    assert.deepEqual(validarMapa(mapa), []);
    for (const [ruta, accion, destino, spec] of ONCE) {
      const e = mapa.find((x) => x.ruta === ruta);
      assert.ok(e, `falta ${ruta}`);
      assert.deepEqual([e.accion, e.destino, e.spec], [accion, destino, spec], ruta);
    }
    for (const [ruta, destino] of [['/un-detalle-para-sorprender/', '/servicios/'], ['/monumentos-naturales-y-leyendas/', '/entorno/'], ['/descarga-nuestras-guias/', '/entorno/']]) {
      const e = mapa.find((x) => x.ruta === ruta);
      assert.deepEqual([e.accion, e.destino, e.spec], ['301', destino, '002'], ruta);
      assert.ok(e.nota, `${ruta}: con su nota`);
    }
    assert.equal(mapa.find((x) => x.ruta === '/nuestro-camino/').nota, 'La historia de Patricia');
    assert.equal(lineasDe('.htaccess').filter((l) => l.startsWith('RedirectMatch 301 ')).length, 20);
    assert.equal(lineasDe('_redirects').filter((l) => /\s301$/.test(l.trim())).length, 40);
  });

  // T04 · CA-5, CA-6, CA-8 y «Sigue leyendo» (§3.5)
  // T04: el pie pinta cada grupo como <h2>{nombre}</h2><ul>…</ul>, y el menú móvil, una
  // etiqueta con el nombre y sus enlaces hasta la siguiente; ajusta aquí si el marcado es otro.
  const grupos = (dir = RAIZ) => leerJSON('datos/paginas.json', dir).grupos;
  const construidasDe = (g, dir = RAIZ) => g.paginas.filter((p) => estaConstruida(`/${p.slug}/`, dir));
  const ARRIBA = ['tu-habitacion', 'pico-sacro-v2', 'entorno'];   // ya en los siete enlaces del menú
  const slugsDe = (trozo, rel) => enlacesDe(trozo).map((a) => slugDeRuta(rutaDe(a.href, rel) || '')).filter(Boolean);
  test('CA-5 · pie y menú móvil: los dos grupos con solo las construidas y en su orden (el menú sin Habitaciones, El Pico ni Entorno); aria-current en el enlace propio', () => {
    const gs = grupos();
    for (const rel of paginasGeneradas().filter((r) => r !== '404.html')) {   // el 404 no lleva cabecera, menú ni pie
      const html = leer(rel);
      const pie = (/<footer class="pie"[\s\S]*?<\/footer>/.exec(html) || [''])[0];
      const menu = (/<div class="menu-movil"[\s\S]*?\n<\/div>/.exec(html) || [''])[0];
      assert.ok(pie && menu, `${rel}: pie y menú móvil`);
      for (const [i, g] of gs.entries()) {
        const esperadas = construidasDe(g).map((p) => p.slug);
        const ul = new RegExp(`<h2>${escRe(g.nombre)}</h2>\\s*<ul>([\\s\\S]*?)</ul>`).exec(pie);
        assert.ok(ul, `${rel}: el pie no tiene el grupo «${g.nombre}»`);
        assert.deepEqual(slugsDe(ul[1], rel), esperadas, `${rel}: pie, «${g.nombre}»`);
        const etiqueta = (n) => { const m = new RegExp(`<(?!a\\b)[a-z][^>]*>\\s*${escRe(n)}\\s*<`, 'i').exec(menu); return m ? m.index : -1; };   // la etiqueta del grupo, no el enlace «La casa» de arriba
        const desde = etiqueta(g.nombre);
        // T04: un grupo que en el menú se queda sin páginas (las suyas ya están arriba) no saca su etiqueta
        const enElMenu = esperadas.filter((s) => !ARRIBA.includes(s));
        if (!enElMenu.length) { assert.equal(desde, -1, `${rel}: el grupo «${g.nombre}» no añade nada al menú y no saca su etiqueta`); continue; }
        assert.ok(desde >= 0, `${rel}: el menú no tiene el grupo «${g.nombre}»`);
        const sig = gs[i + 1] ? etiqueta(gs[i + 1].nombre) : -1;
        const hasta = sig >= 0 ? sig : menu.indexOf('</nav>', desde) >= 0 ? menu.indexOf('</nav>', desde) : menu.length;
        assert.deepEqual(slugsDe(menu.slice(desde, hasta), rel), enElMenu, `${rel}: menú, «${g.nombre}»`);
      }
      // aria-current por slug en el pie, el menú y la cabecera
      const propio = rel === 'index.html' ? null : rel.split('/')[0];
      const cab = (RE_CABECERA.exec(html) || [''])[0];
      for (const a of enlacesDe(pie + menu + cab)) {
        if (a.href.includes('#')) continue;
        const s = slugDeRuta(rutaDe(a.href, rel) || '');
        if (!s) continue;
        assert.equal(/\baria-current="page"/.test(a.atrs), s === propio, `${rel}: ${a.href} ${s === propio ? 'sin' : 'con'} aria-current`);
      }
    }
  });
  test('CA-6 · la cabecera de escritorio es idéntica a la de la 001 (salvo {{raiz}} y aria-current)', () => {
    const ref = normalizar(RE_CABECERA.exec(deGit('index.html'))[0]);
    for (const rel of paginasGeneradas().filter((r) => r !== '404.html')) {
      const m = RE_CABECERA.exec(leer(rel));
      assert.ok(m, `${rel}: sin cabecera`);
      assert.equal(normalizar(m[0]), ref, `${rel}: la cabecera de escritorio ha cambiado`);
    }
  });
  test('CA-8 · paginas.json con un slug que no existe, uno que no es pagina, uno repetido o una página de la 002 construida sin grupo hace fallar la construcción', () => {
    const casos = [
      ['un slug que no está en el mapa', (j) => j.grupos[0].paginas.push({ slug: 'no-existe', corto: 'No existe' })],
      ['un slug que es un 301', (j) => j.grupos[0].paginas.push({ slug: 'inicio', corto: 'Inicio' })],
      ['un slug repetido', (j) => j.grupos[1].paginas.push({ ...j.grupos[0].paginas[0] })],
      ['una página construida sin grupo', (j) => { for (const g of j.grupos) g.paginas = g.paginas.filter((p) => p.slug !== 'tu-habitacion'); }],
    ];
    for (const [que, cambiar] of casos) {
      const r = construirCon('datos/paginas.json', (t) => { const j = JSON.parse(t); cambiar(j); return JSON.stringify(j, null, 2); });
      assert.equal(r.ok, false, `${que}: debería fallar`);
      assert.match(r.salida, /paginas\.json/, `${que}: el error cita paginas.json`);
    }
  });
  const comprobarSigue = (dir) => {
    for (const g of grupos(dir)) {
      const hechas = construidasDe(g, dir);
      for (const [i, p] of hechas.entries()) {
        const rel = `${p.slug}/index.html`;
        const bloque = sigueDe(leer(rel, dir));
        if (hechas.length < 2) { assert.equal(bloque, null, `${rel}: con una sola página en «${g.nombre}» no sale «Sigue leyendo»`); continue; }
        assert.ok(bloque, `${rel}: sin «Sigue leyendo»`);
        const n = Math.min(3, hechas.length - 1);
        const esperadas = Array.from({ length: n }, (_, k) => hechas[(i + 1 + k) % hechas.length]);
        const enlaces = enlacesDe(bloque);
        assert.deepEqual(enlaces.map((a) => slugDeRuta(rutaDe(a.href, rel) || '')), esperadas.map((x) => x.slug), `${rel}: las siguientes de «${g.nombre}», dando la vuelta`);
        for (const [k, a] of enlaces.entries()) {
          const destino = esperadas[k];
          assert.ok(a.texto.includes(destino.corto), `${rel}: el enlace a ${destino.slug} dice «${destino.corto}»`);
          assert.equal((/data-foto="([^"]+)"/.exec(a.html) || [])[1], metaDe(destino.slug, dir).foto, `${rel}: la miniatura de ${destino.slug} es su foto de portadilla`);
          assert.match(a.html, /loading="lazy"/, `${rel}: la miniatura de ${destino.slug}, en diferido`);
        }
      }
    }
  };
  test('§3.5 · «Sigue leyendo»: hasta tres de las siguientes de su grupo, dando la vuelta; con una sola página construida no sale', () => {
    comprobarSigue(RAIZ);
    // con una sola construida en «La casa» (copia sin las fuentes de las demás de su grupo)
    const dir = copiaTemporal();
    for (const p of grupos(dir).find((g) => g.id === 'casa').paginas) if (p.slug !== 'tu-habitacion') fs.rmSync(path.join(dir, 'paginas', `${p.slug}.src.html`), { force: true });
    const r = construir(dir);
    assert.ok(r.ok, 'la copia con una sola página en «La casa» debería construirse:\n' + r.salida);
    assert.equal(sigueDe(leer('tu-habitacion/index.html', dir)), null, 'tu-habitacion, sola en su grupo: sin «Sigue leyendo»');
    comprobarSigue(dir);
  });

  // T05 · CA-7 y CA-4 (construcción)
  test('CA-7 · {{enlace:…}}: a una sin construir sale como texto; a un 301, a un slug que no existe o un href a mano en paginas/ rompen la construcción; la portada y los parciales no', () => {
    const bien = construirEjemplo(paginaEjemplo('habitaciones', '<p>Lee {{enlace:condiciones-de-reserva|las condiciones}} y mira {{enlace:tu-habitacion|las habitaciones}}.</p>'));
    assert.ok(bien.ok, bien.salida);
    const html = leer('prueba/index.html', bien.dir);
    assert.ok(html.includes('las condiciones') && !/<a\b[^>]*>\s*las condiciones/.test(html), 'condiciones-de-reserva (sin construir) sale como texto');
    assert.match(html, /<a href="\.\.\/tu-habitacion\/">las habitaciones<\/a>/, 'tu-habitacion (construida) sale como enlace');
    for (const [que, cuerpo] of [
      ['un 301', '<p>{{enlace:monumentos-naturales-y-leyendas|las leyendas}}</p>'],
      ['un slug que no está en el mapa', '<p>{{enlace:no-existe|algo}}</p>'],
      ['un pendiente', '<p>{{enlace:home|algo}}</p>'],
      ['un href a mano a una de la 002', '<p><a href="{{raiz}}pazo-de-oca-v2/">el Pazo de Oca</a></p>'],
    ]) {
      const r = construirEjemplo(paginaEjemplo('habitaciones', cuerpo));
      assert.equal(r.ok, false, `${que}: debería fallar`);
    }
    // T05: si otra regla rechaza enlazar a una sin construir, usa aquí una de la 002 ya construida
    for (const [rel, cambiar] of [['index.src.html', conEnlace('<a href="{{raiz}}pazo-de-oca-v2/">Pazo de Oca</a>')], ['parciales/pie.html', (h) => h.replace('</footer>', '<a href="{{raiz}}pazo-de-oca-v2/">Pazo de Oca</a></footer>')]]) {
      const r = construirCon(rel, cambiar);
      assert.ok(r.ok, `${rel}: la regla del href a mano no mira la portada ni los parciales:\n${r.salida}`);
    }
  });
  test('CA-4 · (construcción) ningún href interno de los HTML generados lleva a una dirección 301, pendiente o sin construir', () => {
    const mapa = mapaUrl();
    const malas = [];
    for (const rel of paginasGeneradas().filter((r) => r !== '404.html')) {
      for (const m of leer(rel).matchAll(/\bhref="([^"]*)"/g)) {
        const r = rutaDe(desentidades(m[1]), rel);
        if (!r || /\.(css|js|png|jpe?g|webp|avif|svg|ico|json|webmanifest|pdf|xml|txt)$/i.test(r)) continue;
        const e = mapa.find((x) => x.ruta === r || x.ruta === r + '/');
        if (!e) { malas.push(`${rel}: ${m[1]} (${r}) no está en el mapa`); continue; }
        if (e.accion === '301' || e.accion === 'pendiente') malas.push(`${rel}: ${m[1]} lleva a un ${e.accion}`);
        else if (!estaConstruida(e.ruta, RAIZ, mapa)) malas.push(`${rel}: ${m[1]} lleva a una sin construir`);
      }
    }
    assert.deepEqual(malas, []);
  });

  // T06 · sitios: {{sitio.minutos}}, {{sitio.maps}} y <!--sitio:jsonld--> (§3.1, §3.7, PD-4.3)
  const fuenteSitio = (cuerpo) => paginaEjemplo('habitaciones', cuerpo)
    .replace('"descripcion":"Página de prueba"', '"descripcion":"Un sitio de prueba & <cerca> de Casa de Casal"')
    .replace('</head>', '<!--sitio:jsonld-->\n</head>');
  const CUERPO_SITIO = '<p>A {{sitio.minutos}} minutos en coche de Casa de Casal. <a href="{{sitio.maps}}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>';
  test('T06 · los minutos, el enlace a Google Maps y el TouristAttraction de un sitio salen de alrededores.json', () => {
    const dir = copiaTemporal();
    const f = path.join(dir, 'datos', 'alrededores.json');
    const alr = JSON.parse(fs.readFileSync(f, 'utf8'));
    const oca = alr.sitios.find((s) => s.slug === 'pazo-de-oca-v2');
    Object.assign(oca, { minutos: 41, lat: 42.71234, lon: -8.31234 });   // otros que los de hoy: que se vea que salen de aquí
    fs.writeFileSync(f, JSON.stringify(alr, null, 2));
    fs.writeFileSync(path.join(dir, 'paginas', 'pazo-de-oca-v2.src.html'), fuenteSitio(CUERPO_SITIO));
    const r = construir(dir);
    assert.ok(r.ok, r.salida);
    const html = leer('pazo-de-oca-v2/index.html', dir);
    const t = textoVisible(html);
    assert.ok(t.includes('A 41 minutos en coche de Casa de Casal'), 'los minutos de alrededores.json');
    assert.doesNotMatch(t, /42[.,]7123|8[.,]3123/, 'ninguna coordenada en el texto visible');
    const maps = enlacesDe(mainDe(html)).find((a) => a.texto === 'Abrir en Google Maps');
    assert.equal(maps?.href, 'https://www.google.com/maps/search/?api=1&query=42.71234,-8.31234');
    const ta = jsonLDs(html).filter((o) => tiposDe(o).includes('TouristAttraction'));
    assert.equal(ta.length, 1, 'un TouristAttraction');
    assert.deepEqual(ta[0], {
      '@context': 'https://schema.org', '@type': 'TouristAttraction', name: oca.nombre,
      description: 'Un sitio de prueba & <cerca> de Casa de Casal',
      geo: { '@type': 'GeoCoordinates', latitude: 42.71234, longitude: -8.31234 },
    });
    assert.equal(ta[0].description, descripcionDe(html), 'la description de la página');
    assert.ok(html.includes('\\u003ccerca>'), 'el «<» de la description, escapado dentro del <script>');
  });
  test('T06 · una página sin sitio en alrededores.json que usa {{sitio.…}} o <!--sitio:jsonld--> hace fallar la construcción; las de hoy no cambian', () => {
    for (const [que, fuente] of [
      ['{{sitio.minutos}}', paginaEjemplo('habitaciones', '<p>A {{sitio.minutos}} minutos</p>')],
      ['{{sitio.maps}}', paginaEjemplo('habitaciones', '<a href="{{sitio.maps}}">Abrir en Google Maps</a>')],
      ['<!--sitio:jsonld-->', fuenteSitio('')],
    ]) {
      const r = construirEjemplo(fuente);   // paginas/prueba.src.html: «prueba» no está en alrededores.json
      assert.equal(r.ok, false, `${que} sin sitio: debería fallar`);
      assert.match(r.salida, /alrededores\.json/, `${que}: el error cita alrededores.json`);
    }
    // un hueco que no existe, en una página que sí tiene sitio
    const dir = copiaTemporal();
    fs.writeFileSync(path.join(dir, 'paginas', 'pazo-de-oca-v2.src.html'), paginaEjemplo('habitaciones', '<p>{{sitio.horario}}</p>'));
    const r = construir(dir);
    assert.equal(r.ok, false, '{{sitio.horario}} no existe');
    assert.match(r.salida, /sitio\.horario/);
    // solo las páginas con sitio en alrededores.json llevan TouristAttraction (desde T10, el Pico)
    const conSitio = new Set(leerJSON('datos/alrededores.json').sitios.map((s) => s.slug).filter(Boolean).map((s) => `${s}/index.html`));
    for (const rel of paginasGeneradas().filter((r) => !conSitio.has(r))) assert.ok(!jsonLDs(leer(rel)).some((o) => tiposDe(o).includes('TouristAttraction')), `${rel}: sin TouristAttraction`);
  });

  // T07 · CA-17 (construcción) y T14 · CA-17 (las dos páginas)
  test('CA-17 · (construcción) un data-pendiente y una foto p28 salen en la lista de construir.mjs; --publicar pasa con aviso; --dominio falla con ellos y pasa sin ninguno', () => {
    // T07: fotos.json lleva p28 (PD-5) y verificar.mjs --dominio sale antes del navegador (PD-6)
    const conPendiente = construirEjemplo(paginaEjemplo('habitaciones', '<div data-pendiente="P-99"><p>[Pendiente: prueba]</p></div>'));
    assert.ok(conPendiente.ok, conPendiente.salida);
    assert.match(conPendiente.salida, /prueba\/index\.html: P-99/, 'construir.mjs lista el data-pendiente con su página');
    const dom = verificarEn(conPendiente.dir, '--dominio');
    assert.equal(dom.ok, false, '--dominio falla con un data-pendiente');
    assert.match(dom.salida, /prueba\/index\.html: P-99/, '--dominio dice cuál');
    // --publicar mira commits con git y la copia no tiene .git: un repo con un commit vacío, y base HEAD (0 commits)
    const git = (...a) => execFileSync('git', ['-c', 'user.name=prueba', '-c', 'user.email=prueba@localhost', ...a], { cwd: conPendiente.dir, stdio: 'pipe' });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    const pub = verificarEn(conPendiente.dir, '--publicar', 'HEAD');
    assert.ok(pub.ok, '--publicar pasa con material pendiente:\n' + pub.salida);
    assert.match(pub.salida, /AVISO\s+prueba\/index\.html: P-99/, '--publicar avisa del data-pendiente');
    const conP28 = construirCon('img/fotos/fotos.json', (t) => JSON.stringify(JSON.parse(t).map((f) => (f.nombre === FOTO_EJEMPLO ? { ...f, p28: true } : f)), null, 1));
    fs.writeFileSync(path.join(conP28.dir, 'paginas', 'prueba.src.html'), paginaEjemplo());
    const r = construir(conP28.dir);
    assert.ok(r.ok, r.salida);
    assert.ok(r.salida.includes(`prueba/index.html: foto p28 «${FOTO_EJEMPLO}»`), 'construir.mjs lista la foto p28 con su página');
    assert.equal(verificarEn(conP28.dir, '--dominio').ok, false, '--dominio falla con una foto p28');
    // sin ninguno: sin data-pendiente en las fuentes y sin p28 en fotos.json
    const dir = copiaTemporal();
    for (const d of ['paginas', 'parciales', '.']) for (const f of fs.readdirSync(path.join(dir, d)).filter((x) => x.endsWith('.html'))) {
      const fi = path.join(dir, d, f);
      fs.writeFileSync(fi, fs.readFileSync(fi, 'utf8').replace(/\sdata-pendiente="[^"]*"/g, ''));
    }
    const fj = path.join(dir, 'img', 'fotos', 'fotos.json');
    fs.writeFileSync(fj, JSON.stringify(JSON.parse(fs.readFileSync(fj, 'utf8')).map(({ p28, ...f }) => f), null, 1));
    assert.ok(construir(dir).ok);
    const sin = verificarEn(dir, '--dominio');
    assert.ok(sin.ok, '--dominio pasa sin ninguno:\n' + sin.salida);
  });
  test('T07 · pendientes.mjs ve data-pendiente con cualquier comilla o sin valor y una foto p28 también por su URL; no mira comentarios ni scripts', async () => {
    const { pendientesDe } = await import('./lib/pendientes.mjs');
    const p28 = new Set(['oca-jardin']);
    const html = `<!-- <div data-pendiente="P-01"> --><script>x = ' data-pendiente="P-02" ';</script>
<div data-pendiente="P-04"></div><div data-pendiente='P-05'></div><div data-pendiente=P-06></div><div data-pendiente></div><div data-pendiente="P-04"></div>
<meta property="og:image" content="../img/fotos/oca-jardin-1200.jpg"><picture data-foto="otra"></picture>`;
    assert.deepEqual(pendientesDe(html, p28), [
      { que: 'data-pendiente', id: 'P-04' }, { que: 'data-pendiente', id: 'P-05' }, { que: 'data-pendiente', id: 'P-06' },
      { que: 'data-pendiente', id: '(sin número)' }, { que: 'p28', foto: 'oca-jardin' },
    ]);
  });
  todo('CA-17 · /experiencias/ y /tus-rincones-favoritos/#terrazas llevan data-pendiente="P-04"; construir.mjs los lista y --publicar pasa con aviso', () => {
    assert.match(mainDe(htmlDe('experiencias')), /data-pendiente="P-04"/);
    const terrazas = (/<(section|div|article)\b[^>]*\bid="terrazas"[\s\S]*?<\/\1>/.exec(htmlDe('tus-rincones-favoritos')) || [''])[0];
    assert.match(terrazas, /data-pendiente="P-04"/, '#terrazas lleva el bloque P-04');
    const r = construir();
    assert.ok(r.ok, r.salida);
    for (const s of ['experiencias', 'tus-rincones-favoritos']) assert.match(r.salida, new RegExp(`${s}[\\s\\S]*?P-04|P-04[\\s\\S]*?${s}`), `construir.mjs lista el P-04 de ${s}`);
    const pub = verificarEn(RAIZ, '--publicar', 'HEAD');
    assert.ok(pub.ok, '--publicar pasa:\n' + pub.salida);
    assert.match(pub.salida, /P-04/, '--publicar avisa del P-04');
    assert.equal(verificarEn(RAIZ, '--dominio').ok, false, '--dominio falla mientras esté P-04');
  });

  // T09 · CA-14 y CA-15 (construcción)
  test('CA-14 · (construcción) /contactar/ con tel:, WhatsApp, mailto: y la dirección; ninguna página interior con <form>, <input>, <select> ni <textarea> fuera de las cookies; ningún <iframe>', () => {
    const html = htmlDe('contactar');
    const main = mainDe(html);
    assert.match(main, /href="tel:\+34698148323"/, 'teléfono con tel:');
    assert.match(main, /href="https:\/\/wa\.me\/34698148323[^"]*"/, 'WhatsApp');
    assert.match(main, /href="mailto:info@casadecasal\.com"/, 'email con mailto:');
    const t = textoVisible(html);
    for (const x of ['Rúa Pedro Ballesteros, 17', '15881 Lestedo, Boqueixón (A Coruña)', 'Se habla inglés y francés']) assert.ok(t.includes(x), `falta «${x}»`);
    for (const rel of paginasGeneradas()) {
      const h = leer(rel);
      assert.doesNotMatch(h, /<iframe\b/i, `${rel}: un <iframe> en el HTML`);
      if (rel === 'index.html') continue;
      const sinCookies = h.replace(/<div class="cookies"[\s\S]*?\n<\/div>/, '');
      assert.doesNotMatch(sinCookies, /<(form|input|select|textarea)\b/i, `${rel}: un campo de formulario`);
    }
  });
  test('CA-15 · (construcción) el HTML de #llegar de la portada es idéntico al de la 001; el mapa está en comun.js y no en main.js; /contactar/ lleva #llegar una vez', () => {
    const ref = (RE_LLEGAR.exec(deGit('index.html')) || [null])[0];
    assert.ok(ref, `sin #llegar en la portada de ${REF_001}`);
    assert.equal((RE_LLEGAR.exec(leer('index.html').replace(/\r\n/g, '\n')) || [null])[0], ref, '#llegar de la portada');
    assert.ok(!leer('js/main.js').includes('mapa-btn'), 'main.js ya no tiene el mapa');
    assert.ok(leer('js/comun.js').includes('mapa-btn'), 'comun.js tiene el mapa');
    assert.equal((htmlDe('contactar').match(/\bid="llegar"/g) || []).length, 1, '/contactar/ lleva #llegar una vez');
  });

  // T10 · CA-27 (construcción)
  // las seis leyendas que hoy escribe js/comun.js (título y el texto sin la capitular)
  const LEYENDAS = [
    ['La Reina Lupa', 'os discípulos del Apóstol pararon en este monte para pedirle a la Reina Lupa unos bueyes'],
    ['El dragón del monte Ilicino', 'ste cuento podría haber acabado mal, pero el dragón cayó con las plegarias de los discípulos'],
    ['El paso de la Reina Lupa', 'a cumbre está partida en dos por un corte vertical'],
    ['Las cuevas', 'adie sabe bien quién las hizo: unos dicen que los romanos, buscando oro'],
    ['Los mouros', ' lo largo de los siglos el Pico ha sido el centro de muchas leyendas'],
    ['Los refranes del tiempo', 'uando el Pico pone toquilla, agua tenemos, mucha o poquilla'],
  ];
  test('CA-27 · (construcción) las seis leyendas están en el HTML de /pico-sacro-v2/, la primera visible y las demás hidden; comun.js ya no tiene sus textos', () => {
    const html = htmlDe(PICO);
    const t = textoVisible(html);
    for (const [tit, txt] of LEYENDAS) {
      assert.ok(t.includes(tit), `falta el título «${tit}»`);
      assert.ok(t.includes(txt), `falta el texto de «${tit}»`);
    }
    // T10: seis paneles role="tabpanel" dentro de #leyendas; ajusta si el marcado es otro
    const paneles = [...(/<section\b[^>]*\bid="leyendas"[\s\S]*?<\/section>/.exec(html) || [''])[0].matchAll(/<[a-z]+\b[^>]*\brole="tabpanel"[^>]*>/g)].map((m) => m[0]);
    assert.equal(paneles.length, 6, 'seis paneles');
    assert.deepEqual(paneles.map((p) => /\bhidden\b/.test(p)), [false, true, true, true, true, true], 'el primero visible y los demás hidden');
    const comun = leer('js/comun.js');
    const excepciones = leer('scripts/t-excepciones.json');
    for (const [tit, txt] of LEYENDAS) {
      assert.ok(!comun.includes(txt.trim().slice(0, 40)), `comun.js todavía tiene el texto de «${tit}»`);
      assert.ok(!excepciones.includes(txt.trim().slice(0, 40)), `t-excepciones.json todavía tiene el texto de «${tit}»`);
    }
  });

  // T11 · /tu-habitacion/ y /entorno/ completas (§3.4)
  test('§3.4 · /tu-habitacion/: la cita y «Tenemos la habitación perfecta para ti» encima de las fichas, las fichas con su texto y sin la casa entera de 2020', () => {
    const html = htmlDe('tu-habitacion');
    const main = mainDe(html);
    const cita = main.indexOf('<blockquote class="cita cita--grande"');
    const tenemos = main.indexOf('Tenemos la habitación <em>perfecta para ti</em>');
    const fichas = main.indexOf('<ul class="tipos" id="tipos">');
    assert.ok(cita > 0 && cita < tenemos && tenemos < fichas, 'la cita, después «Tenemos la habitación…» y debajo las fichas');
    const t = textoVisible(html);
    for (const frase of [
      'Paso a paso ante mí se abre el camino.', 'Nada de esto antes había vivido.',
      'Como extras puedes solicitar gratis mini nevera y pack para infusiones.', 'Tú decides: baño relajante o una reconfortante ducha de lluvia.',
      'gracias al sobrecolchón de 2,10 × 1,90', 'terraza privada de 12 m²', 'Máximo 2 adultos y 2 niños.',
      'el precioso paisaje del Valle del Ulla desde la ventana', 'Aquí se encuentra la habitación con baño adaptado.',
    ]) assert.ok(t.includes(frase), `falta «${frase}»`);
    for (const re of [/alquiler [ií]ntegro/i, /de diciembre a marzo/i, /hasta 23 personas/i, /fin de año 650/i]) assert.doesNotMatch(t, re);
  });

  test('§3.4 · /entorno/: el h2 de su página antes del mapa y, debajo de la lista, siete tarjetas con «Leer más» solo a las construidas', () => {
    const html = htmlDe('entorno');
    const sec = (/<section\b[^>]*\bid="alrededores"[\s\S]*?<\/section>/.exec(html) || [''])[0];
    const h2 = sec.indexOf('<h2 class="tit alrededores__tit" id="alr-tit" data-partir>¿Qué visitar en los alrededores <em>de Santiago de Compostela</em>?</h2>');
    assert.ok(h2 > 0 && h2 < sec.indexOf('<figure class="alr-mapa'), 'el h2, antes del mapa');
    const lista = sec.indexOf('<ul class="alr-lista">'), ul = sec.indexOf('<ul class="tarjetas">');
    assert.ok(lista > 0 && ul > lista, 'las tarjetas, debajo de la lista');
    const tarjetas = [...sec.matchAll(/<li class="tarjeta">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    const destinos = [['ruta-molinos-vedra-v2', 'Ruta molinos de Vedra'], ['monasterio-de-carboeiro-v2', 'Monasterio de Carboeiro'], ['pazo-de-ortigueira-v2', 'Pazo de Ortigueira'],
      ['pazo-de-oca-v2', 'Pazo de Oca'], ['fervenza-del-rio-toxa-v2', 'Fervenza del río Toxa'], [PICO, 'Pico Sacro'], [VIA, 'Etapas de la Vía de la Plata']];
    assert.equal(tarjetas.length, destinos.length, 'siete tarjetas: cinco sitios, el Pico y la Vía');
    destinos.forEach(([slug, titulo], i) => {
      assert.ok(tarjetas[i].includes(`<h3>${titulo}</h3>`), `${slug}: la tarjeta «${titulo}»`);
      assert.doesNotMatch(tarjetas[i], /<(?:img|picture)\b/, `${slug}: tarjeta sin foto`);
      const mas = (/<p class="tarjeta__mas">([\s\S]*?)<\/p>/.exec(tarjetas[i]) || [])[1];
      assert.ok(mas && (mas.startsWith('Leer más') || mas.startsWith(`<a href="../${slug}/">Leer más`)), `${slug}: «Leer más»`);
      assert.equal(mas.startsWith('<a '), estaConstruida(`/${slug}/`), `${slug}: enlace solo si la página está construida`);
    });
    assert.match(leer('css/estilos.css'), /\.tarjeta__mas:not\(:has\(a\)\) \{ display: none; \}/, 'el «Leer más» sin enlace no se enseña');
    const enTarjetas = desentidades(tarjetas.join(' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    assert.ok(enTarjetas.includes('Una ruta corta de senderismo junto al río, con molinos restaurados.'), 'Vedra, literal');
    for (const re of [/ortigueria/i, /medinacelli/i, /general armada/i, /ruta circular/i]) assert.doesNotMatch(enTarjetas, re);
    for (const re of [/contacta ahora/i, /turismo rural en galicia/i]) assert.doesNotMatch(textoVisible(html), re);
  });

  // T15 · CA-16
  const ETAPAS = [['Ourense a Cea', /\b22 kil[oó]metros\b/], ['Cea a Laxe', /\b32 kil[oó]metros\b/], ['Laxe a Vedra', /\b33 kil[oó]metros\b/], ['Vedra a Santiago', /\b16 km\b/]];
  const FRASE_VIA = 'En la última etapa, Casa de Casal está a 300 metros del Camino y a 13 km de la catedral: el sitio para llegar temprano a Santiago.';
  todo('CA-16 · /via-de-la-plata-v2/: cada etapa con sus kilómetros, «300 metros» con la frase nueva, sin alojamientos ajenos ni días de cierre', () => {
    const t = textoVisible(htmlDe(VIA));
    // cada etapa, en su orden, y sus kilómetros antes de la siguiente
    const pos = ETAPAS.map(([e]) => t.search(new RegExp(`etapa de ${e}`, 'i')));
    for (const [k, [e]] of ETAPAS.entries()) assert.ok(pos[k] >= 0, `falta la etapa «${e}»`);
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'las etapas en su orden');
    for (const [k, [e, km]] of ETAPAS.entries()) assert.match(t.slice(pos[k], pos[k + 1] ?? undefined), km, `${e}: sus kilómetros`);
    assert.ok(t.includes(FRASE_VIA), 'la frase nueva de los 300 metros, literal');
    assert.doesNotMatch(t, /200 metros/, 'sin la frase vieja de los 200 metros');
    const ajenos = CA9.slice(CA9.findIndex((re) => re.source.startsWith('v[ií]a stellae')));
    for (const re of [...ajenos, /cierra los/i, /cerrado el/i]) assert.doesNotMatch(t, re);
  });

  // T17 · CA-1, CA-2, CA-18 y lo de CA-12 que vale para todas
  todo('CA-1 · construir genera las 17 páginas de §3.1 y las de la 001, con noindex,nofollow, cabecera, pie, cookies, «Sigue leyendo» y «¿Te quedas?»', () => {
    const r = construir();
    assert.ok(r.ok, r.salida);
    const de001 = ['index.html', '404.html', ...ACOGIDA.map((s) => `${s}/index.html`), ...LEGALES_002.map(([s]) => `${s}/index.html`)];
    for (const rel of [...NUEVAS.map((s) => `${s}/index.html`), ...de001]) {
      assert.ok(existe(rel), `falta ${rel}`);
      const html = leer(rel);
      assert.match(html, /<meta name="robots" content="noindex,nofollow">/, `${rel}: noindex,nofollow`);
      if (rel !== '404.html') {
        assert.match(html, RE_CABECERA, `${rel}: cabecera`);
        assert.match(html, /<footer class="pie"/, `${rel}: pie`);
        assert.match(html, /<div class="cookies"/, `${rel}: aviso de cookies`);
      }
    }
    for (const s of PAGINAS) {
      const html = htmlDe(s);
      assert.ok(sigueDe(html), `${s}: «Sigue leyendo»`);
      assert.match(mainDe(html), /class="te-quedas\b/, `${s}: «¿Te quedas?»`);
    }
  });
  todo('CA-2 · cada pagina de la 002 o 001+002 tiene su fuente y su salida; las únicas pagina sin construir son las tres de la 003', () => {
    const paginas = mapaUrl().filter((e) => e.accion === 'pagina');
    for (const e of paginas.filter((x) => x.spec === '002' || x.spec === '001+002')) {
      const s = slugDeRuta(e.ruta);
      assert.ok(existe(`paginas/${s}.src.html`), `${e.ruta}: sin fuente`);
      assert.ok(existe(`${s}/index.html`), `${e.ruta}: sin salida`);
    }
    const sin = paginas.filter((e) => !estaConstruida(e.ruta));
    assert.deepEqual(sin.map((e) => e.spec), ['003', '003', '003'], `sin construir: ${sin.map((e) => e.ruta).join(', ')}`);
  });
  todo('CA-18 · origen.md tiene las 23 secciones de §3.8 y diff-origen.mjs --todas sale sin error', () => {
    for (const s of SECCIONES_ORIGEN) assert.ok(origenDe(s), `origen.md: falta ## ${s}`);
    // T02: scripts/diff-origen.mjs; lee pages.json de ../casa-de-casal-lestedo-bocetos/ref/
    execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'diff-origen.mjs'), '--todas'], { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' });
  });
  todo('CA-12 · ninguna página interior lleva LodgingBusiness ni FAQPage (solo la portada lleva LodgingBusiness)', () => {
    for (const rel of paginasGeneradas().filter((r) => r !== 'index.html')) {
      const tipos = jsonLDs(leer(rel)).flatMap(tiposDe);
      assert.ok(!tipos.includes('LodgingBusiness') && !tipos.includes('FAQPage'), `${rel}: ${tipos.join(', ')}`);
    }
  });
}
