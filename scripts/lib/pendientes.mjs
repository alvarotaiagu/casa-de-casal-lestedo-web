/* Material pendiente (spec 002 §9 «Material pendiente», plan PD-4.4, PD-5, PD-6).
   Dos marcas se ven en el escaparate mientras falta algo de Patricia:
     - un bloque con data-pendiente="P-xx" (P-04: fotos y textos que faltan);
     - una foto «p28» (P-28: foto de un sitio que puede ser de otra web): la
       <picture data-foto="…"> de una foto con "p28": true en img/fotos/fotos.json.
   Quién lo usa:
     - construir.mjs las lista por consola al final (aviso, no error);
     - verificar.mjs --publicar, la misma lista como aviso, sin fallar;
     - verificar.mjs --dominio (el día de casadecasal.com, spec 005) falla
       mientras quede alguna. */
import fs from 'node:fs';
import path from 'node:path';

/* Los nombres de las fotos p28 de una lista como la de img/fotos/fotos.json
   (la única definición: la usan construir.mjs y verificar.mjs). */
export const nombresP28 = (fotos) => new Set(fotos.filter((f) => f && f.p28 === true).map((f) => f.nombre));
export function fotosP28(raiz) {
  return nombresP28(JSON.parse(fs.readFileSync(path.join(raiz, 'img', 'fotos', 'fotos.json'), 'utf8')));
}

// el atributo con comillas dobles, simples, sin comillas o sin valor
const RE_PENDIENTE = /\sdata-pendiente(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?(?=[\s/>])/g;
// una foto se ve por su <picture data-foto> o por la URL de cualquiera de sus tamaños (og:image, style…)
const RE_FOTO = /<picture\b[^>]*\bdata-foto="([^"]+)"|img\/fotos\/([a-z0-9-]+)-\d+\.(?:avif|webp|jpe?g)\b/g;

/* Lo pendiente de un HTML construido, sin repetir: primero los data-pendiente
   y después las fotos p28, cada uno en orden de aparición:
   [{ que: 'data-pendiente', id: 'P-04' }, { que: 'p28', foto: 'oca-jardin' }]. */
export function pendientesDe(html, p28) {
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  const vistos = new Set();
  const lista = [];
  const poner = (clave, o) => { if (!vistos.has(clave)) { vistos.add(clave); lista.push(o); } };
  // el texto de un <script> o un <style> no es un bloque de la página
  for (const m of sinComentarios.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').matchAll(RE_PENDIENTE)) {
    const id = (m[1] ?? m[2] ?? m[3] ?? '').trim() || '(sin número)';
    poner('d:' + id, { que: 'data-pendiente', id });
  }
  if (p28.size) for (const m of sinComentarios.matchAll(RE_FOTO)) {
    const nombre = m[1] || m[2];
    if (p28.has(nombre)) poner('f:' + nombre, { que: 'p28', foto: nombre });
  }
  return lista;
}

/* Los HTML que genera construir.mjs, con «/»: index.html, <slug>/index.html y 404.html. */
export function paginasConstruidas(raiz) {
  const lista = ['index.html'];
  const dir = path.join(raiz, 'paginas');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.src.html')).sort()) lista.push(`${f.slice(0, -'.src.html'.length)}/index.html`);
  if (fs.existsSync(path.join(raiz, '404.src.html'))) lista.push('404.html');
  return lista;
}

/* Lo pendiente de cada HTML construido en `raiz`: [{ rel, pendientes }], solo
   los que tienen algo. Un HTML que falta va con { falta: true }. */
export function pendientesDeLaWeb(raiz) {
  const p28 = fotosP28(raiz);
  const salida = [];
  for (const rel of paginasConstruidas(raiz)) {
    const f = path.join(raiz, ...rel.split('/'));
    if (!fs.existsSync(f)) { salida.push({ rel, falta: true, pendientes: [] }); continue; }
    const pendientes = pendientesDe(fs.readFileSync(f, 'utf8'), p28);
    if (pendientes.length) salida.push({ rel, pendientes });
  }
  return salida;
}

/* Una línea por página: «experiencias/index.html: P-04 · foto p28 «oca-jardin»». */
export function lineasPendientes(lista) {
  return lista.map(({ rel, falta, pendientes }) => (falta
    ? `${rel}: no existe (¿falta node construir.mjs?)`
    : `${rel}: ${pendientes.map((x) => (x.que === 'p28' ? `foto p28 «${x.foto}»` : `${x.id} (data-pendiente)`)).join(' · ')}`));
}
