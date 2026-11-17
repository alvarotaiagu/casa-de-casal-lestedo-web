/* Mapa de URL (spec 001 §3.2 y §4, D-002, D-003).
   datos/mapa-url.json tiene una entrada por dirección, vieja o nueva:
     { ruta, accion: "pagina" | "nueva" | "301" | "pendiente", destino, spec, nota }
   De ahí salen _redirects (Cloudflare Pages) y .htaccess (Apache, Ionos), en
   la raíz de la salida. Solo reglas 301 de una ruta exacta a otra de la misma
   web (§8); las «pendiente» no generan nada.
   La construcción falla si:
     - ruta o destino no cumplen ^/[a-z0-9\-/.]*$ (ni llevan «//» ni segmentos «.» o «..»);
     - hay una ruta repetida;
     - el destino de un 301 es otro 301 (cadena) o hay un bucle;
     - el destino de un 301 no es una dirección «pagina» o «nueva».
   Una entrada 301 no se borra nunca: dejaría de redirigir (§4). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FICHERO = ['datos', 'mapa-url.json'];
const ACCIONES = new Set(['pagina', 'nueva', '301', 'pendiente']);
const RE_RUTA = /^\/[a-z0-9\-/.]*$/;

// además, sin «//» (otro dominio) ni segmentos «.» o «..»
const rutaValida = (r) => typeof r === 'string' && RE_RUTA.test(r) && !r.includes('//') && !r.split('/').some((x) => /^\.+$/.test(x));

/* Lee el mapa de `raiz` (por defecto, el repo). */
export function leerMapa(raiz = RAIZ_REPO) {
  const f = path.join(raiz, ...FICHERO);
  let mapa;
  try { mapa = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`datos/mapa-url.json: no se puede leer (${e.message})`); }
  if (!Array.isArray(mapa)) throw new Error('datos/mapa-url.json: tiene que ser una lista de entradas');
  return mapa;
}

/* Devuelve la lista de errores del mapa (vacía si está bien). */
export function validarMapa(mapa) {
  const errores = [];
  const porRuta = new Map();
  mapa.forEach((e, i) => {
    const donde = `entrada ${i + 1}${e && e.ruta ? ` (${e.ruta})` : ''}`;
    if (!e || typeof e !== 'object') { errores.push(`${donde}: no es un objeto`); return; }
    if (!ACCIONES.has(e.accion)) errores.push(`${donde}: accion «${e.accion}» no es pagina, nueva, 301 ni pendiente`);
    if (!rutaValida(e.ruta)) errores.push(`${donde}: la ruta «${e.ruta}» no cumple ^/[a-z0-9\\-/.]*$`);
    // una «pendiente» puede no tener destino todavía (lo fija su spec)
    if (!(e.accion === 'pendiente' && e.destino == null) && !rutaValida(e.destino)) {
      errores.push(`${donde}: el destino «${e.destino}» no cumple ^/[a-z0-9\\-/.]*$ (solo rutas de la misma web)`);
    }
    if ((e.accion === 'pagina' || e.accion === 'nueva') && e.destino !== e.ruta) errores.push(`${donde}: una dirección ${e.accion} tiene destino igual a su ruta`);
    if (porRuta.has(e.ruta)) errores.push(`${donde}: ruta repetida (ya está en la entrada ${porRuta.get(e.ruta) + 1})`);
    else porRuta.set(e.ruta, i);
  });
  for (const e of mapa) {
    if (!e || e.accion !== '301' || !rutaValida(e.destino)) continue;
    const d = mapa[porRuta.get(e.destino)];
    if (!d) { errores.push(`${e.ruta}: el destino ${e.destino} no está en el mapa (tiene que ser una dirección pagina o nueva)`); continue; }
    if (d.accion === '301') {
      // ¿vuelve a sí misma? entonces es un bucle; si no, una cadena
      const vistos = new Set([e.ruta]);
      let x = d, bucle = false;
      while (x && x.accion === '301') {
        if (vistos.has(x.ruta)) { bucle = true; break; }
        vistos.add(x.ruta);
        x = mapa[porRuta.get(x.destino)];
      }
      errores.push(bucle
        ? `${e.ruta}: bucle de 301 (${[...vistos].join(' → ')} → …)`
        : `${e.ruta}: cadena de 301 (su destino ${e.destino} es otro 301; apunta directamente a la dirección final)`);
    } else if (d.accion !== 'pagina' && d.accion !== 'nueva') {
      errores.push(`${e.ruta}: el destino ${e.destino} es una dirección ${d.accion} (tiene que ser pagina o nueva)`);
    }
  }
  return errores.map((x) => 'datos/mapa-url.json: ' + x);
}

/* Lee y valida; lanza un error con todos los fallos juntos. */
export function cargarMapa(raiz = RAIZ_REPO) {
  const mapa = leerMapa(raiz);
  const errores = validarMapa(mapa);
  if (errores.length) throw new Error(errores.join('\n  - '));
  return mapa;
}

const redirecciones = (mapa) => mapa.filter((e) => e.accion === '301');
const sinBarra = (r) => (r.length > 1 && r.endsWith('/') ? r.slice(0, -1) : r);
const AVISO = 'Generado por construir.mjs desde datos/mapa-url.json: no se edita a mano.';

/* _redirects (Cloudflare Pages): 301 explícito, una línea con barra y otra sin barra. */
export function textoRedirects(mapa) {
  const lineas = [`# ${AVISO}`];
  for (const e of redirecciones(mapa)) {
    const formas = new Set([e.ruta, sinBarra(e.ruta)]);
    if (!e.ruta.endsWith('/') && !/\.[a-z0-9]+$/.test(e.ruta)) formas.add(e.ruta + '/');
    for (const r of formas) lineas.push(`${r} ${e.destino} 301`);
  }
  return lineas.join('\n') + '\n';
}

/* .htaccess (Apache): la regla exacta, sin heredar el resto de la ruta, y la 404. */
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function textoHtaccess(mapa) {
  const lineas = [`# ${AVISO}`, 'ErrorDocument 404 /404.html'];
  for (const e of redirecciones(mapa)) lineas.push(`RedirectMatch 301 ^${escaparRegex(sinBarra(e.ruta))}/?$ ${e.destino}`);
  return lineas.join('\n') + '\n';
}

/* Escribe _redirects y .htaccess en la raíz de la salida. */
export function escribirRedirecciones(mapa, raiz = RAIZ_REPO) {
  fs.writeFileSync(path.join(raiz, '_redirects'), textoRedirects(mapa));
  fs.writeFileSync(path.join(raiz, '.htaccess'), textoHtaccess(mapa));
  return redirecciones(mapa).length;
}

/* Fuente de una dirección: «/» → index.src.html, «/x.html» → x.src.html y
   «/slug/» → paginas/slug.src.html. */
export function fuenteDe(ruta) {
  if (ruta === '/') return 'index.src.html';
  const fichero = /^\/([a-z0-9-]+)\.html$/.exec(ruta);
  if (fichero) return `${fichero[1]}.src.html`;
  const slug = /^\/([a-z0-9-]+)\/$/.exec(ruta);
  if (slug) return path.join('paginas', `${slug[1]}.src.html`);
  return null;
}

/* Una dirección «pagina» o «nueva» está construida si existe su fuente (§3.2).
   No hay ningún otro registro de «spec hecha». Una 301, una pendiente o una
   ruta que no está en el mapa no lo están. */
export function estaConstruida(ruta, raiz = RAIZ_REPO, mapa = leerMapa(raiz)) {
  const e = mapa.find((x) => x && x.ruta === ruta);
  if (!e || (e.accion !== 'pagina' && e.accion !== 'nueva')) return false;
  const f = fuenteDe(ruta);
  return !!f && fs.existsSync(path.join(raiz, f));
}
