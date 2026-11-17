/* Documentos internos del taller (spec 001 §8, CA-29, plan PD-9).
   CLAUDE.md, SDD.md, DECISIONES.md y specs/ tienen la historia de la familia
   y el presupuesto: nunca llegan al escaparate, que es público. Lo usan
   scripts/pruebas-build.mjs (lo estático) y verificar.mjs --publicar (los
   commits). */
import fs from 'node:fs';
import path from 'node:path';

export const DOCUMENTOS = ['CLAUDE.md', 'SDD.md', 'DECISIONES.md', 'specs/'];
/* Lo que también puede ir en un commit «docs:»: el README del taller (T20) no
   es privado, pero tampoco se pasa al escaparate, que tiene el suyo. */
export const SOLO_EN_DOCS = [...DOCUMENTOS, 'README.md'];

const casa = (lista) => (f) => lista.some((d) => (d.endsWith('/') ? f.startsWith(d) : f === d));
export const esDocumento = casa(DOCUMENTOS);
export const vaEnDocs = casa(SOLO_EN_DOCS);

/* ¿Una ruta enlazada (href, src, import, url()…) apunta a un documento? */
const NOMBRES = new Set(['CLAUDE.md', 'SDD.md', 'DECISIONES.md']);
export function apuntaADocumento(ref) {
  // http(s):, mailto:, data: y //otro.dominio no son ficheros nuestros
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return false;
  const partes = ref.split(/[?#]/)[0].replace(/\\/g, '/').split('/');
  return partes.some((p) => NOMBRES.has(p)) || partes.slice(0, -1).includes('specs') || partes.at(-1) === 'specs';
}

/* Ficheros de la salida que se miran: todo HTML (también los .src.html, que
   viajan al escaparate con su commit) y el JS y el CSS de la web. Las
   herramientas (scripts/, construir.mjs…) no se sirven a nadie. */
const FUERA = new Set(['.git', 'node_modules', 'specs', 'scripts', 'pruebas']);
function ficherosDeSalida(raiz, rel = '') {
  const lista = [];
  for (const e of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!FUERA.has(e.name) && !e.name.startsWith('.')) lista.push(...ficherosDeSalida(raiz, r)); }
    else if (/\.(html|js|css)$/.test(e.name)) lista.push(r);
  }
  return lista;
}

const RE_REF = /\b(?:href|src|srcset|action|data|content)\s*=\s*["']([^"']*)["']|url\(\s*["']?([^"')]*)|\b(?:import|from|fetch)\s*\(?\s*["'`]([^"'`]*)["'`]/g;

/* Devuelve «fichero → enlace» por cada enlace de la salida a un documento. */
export function enlacesADocumentos(raiz) {
  const malos = [];
  for (const f of ficherosDeSalida(raiz)) {
    const s = fs.readFileSync(path.join(raiz, ...f.split('/')), 'utf8');
    for (const m of s.matchAll(RE_REF)) {
      const ref = m[1] ?? m[2] ?? m[3];
      for (const parte of ref.split(',')) {
        const r = parte.trim().split(/\s+/)[0];
        if (r && apuntaADocumento(r)) malos.push(`${f} → ${r}`);
      }
    }
  }
  return malos;
}
