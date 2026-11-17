/* Pone ?v=<huella> a los CSS y JS propios de cada HTML generado, para que
   GitHub Pages no sirva ficheros viejos de la cache del navegador tras un cambio.
   Recorre los .html de la raíz (no los *.src.html) y los <carpeta>/index.html,
   y entiende css/…, ./css/… y ../css/… (lo mismo con js/). El mismo fichero
   lleva la misma huella en todas las páginas.
   Solo toca los atributos href= y src= (nunca texto suelto que se parezca). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
// carpetas que no son páginas: fuentes, parciales, recursos y lo que no se publica
const NO_PAGINAS = new Set(['.git', 'node_modules', 'pruebas', 'paginas', 'parciales', 'specs', 'scripts', 'css', 'js', 'img', 'marca', 'datos']);
const huellas = new Map();

function huella(abs) {
  if (huellas.has(abs)) return huellas.get(abs);
  if (!fs.existsSync(abs)) return null;
  // sin \r: la misma huella en Windows (autocrlf) y en Linux
  const h = crypto.createHash('sha1').update(fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
  huellas.set(abs, h);
  return h;
}

function paginas(dir = RAIZ, lista = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!NO_PAGINAS.has(e.name) && !e.name.startsWith('.')) paginas(f, lista); }
    else if (dir === RAIZ ? e.name.endsWith('.html') && !e.name.endsWith('.src.html') : e.name === 'index.html') lista.push(f);
  }
  return lista;
}

let tocados = 0;
for (const p of paginas()) {
  const antes = fs.readFileSync(p, 'utf8');
  // anclado al atributo: (href|src)="[../]ruta.css|js" con un ?v= opcional ya puesto
  const despues = antes.replace(
    /(\b(?:href|src)=")((?:\.\.\/)*(?:\.\/)?(?:css|js)\/[A-Za-z0-9._-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")/g,
    (todo, pre, rel, post) => {
      const h = huella(path.resolve(path.dirname(p), rel));
      if (!h) return todo;
      return pre + rel + '?v=' + h + post;
    });
  if (despues !== antes) {
    fs.writeFileSync(p, despues);
    tocados++;
    console.log('  ' + path.relative(RAIZ, p).split(path.sep).join('/'));
  }
}
console.log(`${tocados} html actualizados, ${huellas.size} ficheros con huella`);
for (const [abs, h] of huellas) console.log(`  ${path.relative(RAIZ, abs).split(path.sep).join('/')}  ${h}`);
