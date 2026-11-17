/* Prepara las fotos de la web desde las de su WordPress (fotos/web, hasta 2560 px)
   y las de Booking (fotos/booking, máx. 1280 px), guardadas en la carpeta de bocetos.
   Uso: node scripts/fotos.mjs [--forzar]
   - Gradación común y sutil: algo menos de azul saturado y un punto cálido.
   - NUNCA amplía: los anchos se recortan al ancho original (muchas fotos de
     habitaciones solo tienen 800 px; se muestran pequeñas a propósito).
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json.
   - «p28»: true en fotos-lista.json (foto de un sitio que puede ser de otra web,
     spec 002 §8 y §9, P-28) pasa tal cual a fotos.json (plan 002 PD-5): de ahí
     lo leen construir.mjs y verificar.mjs --dominio.
   - Solo rehace las imágenes de una foto si ha cambiado: su entrada de
     fotos-lista.json (ruta, sat, claro, recorte, aq, wq), el tamaño del
     original o los anchos. La huella va en fotos.json («huella»); «p28» no
     cuenta (cambiarlo solo reescribe fotos.json). Una entrada de fotos.json sin
     huella (de antes de la 002) se da por buena si están todas sus imágenes.
     Si cambias la receta de abajo (gradación, calidades), --forzar las rehace todas. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, '../casa-de-casal-lestedo-bocetos/ref/fotos');
const SALIDA = path.join(RAIZ, 'img/fotos');
const JSON_FOTOS = path.join(SALIDA, 'fotos.json');
const FORZAR = process.argv.includes('--forzar');
fs.mkdirSync(SALIDA, { recursive: true });

// nombre, archivo (en ref/fotos-web o ruta relativa a ref/), opciones { sat, claro, recorte:{left,top,width,height}, aq, wq, p28 }
const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1200, 1600, 2200];
const EXT = ['avif', 'webp', 'jpg'];

const previas = new Map((fs.existsSync(JSON_FOTOS) ? JSON.parse(fs.readFileSync(JSON_FOTOS, 'utf8')) : []).map((f) => [f.nombre, f]));
const huellaDe = (f, tam) => crypto.createHash('sha1')
  .update(JSON.stringify([f.ruta, f.sat ?? null, f.claro ?? null, f.recorte ?? null, f.aq ?? null, f.wq ?? null, tam, ANCHOS]))
  .digest('hex').slice(0, 12);
const estanTodas = (nombre, anchos) => Array.isArray(anchos) && anchos.length > 0
  && anchos.every((w) => EXT.every((e) => fs.existsSync(path.join(SALIDA, `${nombre}-${w}.${e}`))));

const salida = [];
let rehechas = 0;
for (const f of FOTOS) {
  if ('p28' in f && typeof f.p28 !== 'boolean') throw new Error(`${f.nombre}: «p28» va true o false (o no va)`);
  const fuente = path.join(REF, f.ruta);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  const huella = huellaDe(f, fs.statSync(fuente).size);
  const marca = f.p28 ? { p28: true } : {};
  const previa = previas.get(f.nombre);
  if (!FORZAR && previa && previa.origen === f.ruta && (previa.huella === huella || previa.huella === undefined) && estanTodas(f.nombre, previa.anchos)) {
    const { huella: _h, p28: _p, ...resto } = previa;
    salida.push({ ...resto, huella, ...marca });
    continue;
  }
  let base = sharp(fuente).rotate();
  if (f.recorte) base = base.extract(f.recorte);
  const buf = await base.toBuffer();
  const meta = await sharp(buf).metadata();
  const anchos = ANCHOS.filter((w) => w < meta.width - 30);
  anchos.push(meta.width > 2200 ? 2200 : meta.width);
  const unicos = [...new Set(anchos)].filter((w) => w >= 400 || w === meta.width);
  for (const w of unicos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      .modulate({ saturation: f.sat ?? 0.93, brightness: f.claro ?? 1.0 })
      .linear(1.02, -2);
    if (meta.width <= 900) p = p.sharpen({ sigma: 0.5, m1: 0.6, m2: 1.2 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    // «aq»/«wq» en la lista: calidad propia (la portada va más comprimida, es la foto del LCP)
    await p.clone().avif({ quality: f.aq ?? 52, effort: f.aq ? 6 : 4 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: f.wq ?? 74 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(dst + '.jpg');
  }
  const alto = Math.round(meta.height * (unicos[unicos.length - 1] / meta.width));
  salida.push({ nombre: f.nombre, anchos: unicos, ancho: unicos[unicos.length - 1], alto, origen: f.ruta, ancho_origen: meta.width, alto_origen: meta.height, huella, ...marca });
  rehechas++;
  console.log(f.nombre.padEnd(22), unicos.join(','), `${meta.width}x${meta.height}`);
}
fs.writeFileSync(JSON_FOTOS, JSON.stringify(salida, null, 1));
console.log(`${salida.length} fotos (${rehechas} rehechas, ${salida.length - rehechas} sin cambios)`);
