/* Lo que hay detrás de cada ventana del dibujo (spec 001 §3.4.4 a §3.4.6, plan PD-8).
   datos/habitaciones.json tiene una zona por cada data-k del SVG de la portada:
     zonas[k] = { titulo, planta, foto, frase,
                  habitaciones: [{ nombre, tipo, cama, frase }],
                  boton: { texto, ir } | null }
   y el resumen «Cada habitación, una leyenda» (leyendas: [{ nombre, de }]).
   Esta librería:
     - valida el fichero (la foto existe, el tipo tiene precio en casa.json, el
       botón lleva a un #ancla, cada data-k de la página tiene su zona y al
       revés); si no, falla la construcción. Una zona sin habitaciones ni
       frase no falla: se avisa por consola y enseña «Pronto, con sus fotos»;
     - <!--panel:k--> → el panel de esa zona pintado en el HTML (sin
       JavaScript se ve; main.js pinta los demás con el mismo marcado);
     - <!--nombres--> → la lista de nombres del resumen;
     - en la página que lleva el panel, el <script type="application/json"
       id="datos-habitaciones"> que lee main.js, con los anchos de cada foto.
   Los textos fijos del panel («desde, por noche», «Ver fechas de…», «Pronto,
   con sus fotos») son las mismas claves de t() que usa main.js. */
import fs from 'node:fs';
import path from 'node:path';
import { huecos } from './datos-casa.mjs';

const FICHERO = ['datos', 'habitaciones.json'];
const RE_DIRECTIVA = /<!--(panel|nombres)(?::([a-z0-9-]+))?-->/g;
const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const esTexto = (s) => typeof s === 'string' && s.trim() !== '';
export const PRONTO = 'Pronto, con sus fotos';

/* ---------- validar ---------- */
export function validarHabitaciones(h, casa, fotos) {
  const errores = [];
  const tiposCasa = casa ? Object.keys(casa.precios.desde) : [];
  if (!h || typeof h.zonas !== 'object' || !h.zonas) return ['datos/habitaciones.json: falta «zonas»'];
  if (!h.tipos || typeof h.tipos !== 'object') errores.push('falta «tipos» (el nombre de cada tipo para «Ver fechas de…»)');
  else for (const t of tiposCasa) if (!esTexto(h.tipos[t])) errores.push(`tipos.${t}: falta su nombre`);
  for (const [k, z] of Object.entries(h.zonas)) {
    const donde = `zonas.${k}`;
    if (!/^[a-z0-9-]+$/.test(k)) errores.push(`${donde}: la clave no es un data-k válido`);
    if (!esTexto(z.titulo)) errores.push(`${donde}: falta «titulo»`);
    for (const c of ['planta', 'frase']) if (typeof z[c] !== 'string') errores.push(`${donde}: «${c}» tiene que ser un texto (vacío, si no hay)`);
    if (!fotos.has(z.foto)) errores.push(`${donde}: la foto «${z.foto}» no está en img/fotos/fotos.json`);
    if (!Array.isArray(z.habitaciones)) { errores.push(`${donde}: «habitaciones» tiene que ser una lista ([] en una estancia)`); continue; }
    z.habitaciones.forEach((x, i) => {
      if (!esTexto(x.nombre)) errores.push(`${donde}.habitaciones[${i}]: falta «nombre»`);
      if (!tiposCasa.includes(x.tipo)) errores.push(`${donde}.habitaciones[${i}]: el tipo «${x.tipo}» no tiene precio en datos/casa.json`);
      for (const c of ['cama', 'frase']) if (typeof x[c] !== 'string') errores.push(`${donde}.habitaciones[${i}]: «${c}» tiene que ser un texto`);
    });
    if (z.boton !== null && (typeof z.boton !== 'object' || !esTexto(z.boton.texto) || !/^#[a-z0-9-]+$/.test(z.boton.ir || ''))) {
      errores.push(`${donde}: «boton» es null o { texto, ir: "#ancla" }`);
    }
  }
  if (!Array.isArray(h.leyendas) || !h.leyendas.length) errores.push('falta «leyendas» (el resumen de los nombres)');
  else h.leyendas.forEach((l, i) => {
    if (!esTexto(l.nombre)) errores.push(`leyendas[${i}]: falta «nombre»`);
    if (l.de !== null && !esTexto(l.de)) errores.push(`leyendas[${i}]: «de» es un texto o null`);
  });
  return errores.map((e) => e.startsWith('datos/') ? e : 'datos/habitaciones.json: ' + e);
}

/* Las zonas que no enseñan nada: ni habitaciones ni frase (spec §9, «Datos incompletos»). */
export const zonasVacias = (h) => Object.entries(h.zonas).filter(([, z]) => !z.habitaciones.length && !esTexto(z.frase)).map(([k]) => k);

export function cargarHabitaciones(raiz, casa, fotos) {
  let h;
  try { h = JSON.parse(fs.readFileSync(path.join(raiz, ...FICHERO), 'utf8')); } catch (e) { throw new Error(`datos/habitaciones.json: no se puede leer (${e.message})`); }
  const errores = validarHabitaciones(h, casa, fotos);
  if (errores.length) throw new Error(errores.join('\n  - '));
  for (const k of zonasVacias(h)) console.warn(`aviso: datos/habitaciones.json: la zona «${k}» no tiene habitaciones ni frase: enseña «${PRONTO}»`);
  return h;
}

/* ---------- pintar ---------- */
// los dos anchos de la foto del panel: el menor (480 en todas las de hoy) y el mayor que no pase de 800
const anchosFoto = (f) => {
  const a = [...f.anchos].sort((x, y) => x - y), chicos = a.filter((w) => w <= 800);
  return [a[0], chicos.length ? chicos[chicos.length - 1] : a[0]];
};

/* El panel de una zona: el mismo marcado que pinta main.js. */
export function panelHTML(h, k, casa, fotos, lang = 'es') {
  const z = h.zonas[k];
  const f = fotos.get(z.foto);
  const [a0, a1] = anchosFoto(f);
  const precio = huecos(casa, lang);
  const ruta = (w) => `{{raiz}}img/fotos/${z.foto}-${w}.jpg`;
  let s = `<div class="seccion__ficha" data-zona="${k}">`
    + `<img id="sp-foto" src="${ruta(a0)}" srcset="${ruta(a0)} ${a0}w, ${ruta(a1)} ${a1}w" sizes="(max-width: 899px) 92vw, 34vw" alt="" width="${a0}" height="${Math.round(a0 * f.alto / f.ancho)}" loading="lazy">`
    + `<p class="eti" id="sp-planta">${escapar(z.planta)}</p>`
    + `<h3 id="sp-nombre">${escapar(z.titulo)}</h3>`;
  if (esTexto(z.frase)) s += `<p id="sp-texto">${escapar(z.frase)}</p>`;
  else if (!z.habitaciones.length) s += `<p id="sp-texto">${PRONTO}</p>`;
  if (z.habitaciones.length) {
    s += '<ul class="seccion__habs">' + z.habitaciones.map((x) => `<li><b>${escapar(x.nombre)}</b>`
      + (x.cama ? `<span>${escapar(x.cama)}</span>` : '') + (x.frase ? `<span>${escapar(x.frase)}</span>` : '') + '</li>').join('') + '</ul>';
  }
  const tipos = [...new Set(z.habitaciones.map((x) => x.tipo))];
  if (tipos.length || z.boton) {
    s += '<div class="seccion__acc">';
    for (const t of tipos) {
      s += `<p class="seccion__precio"><b>${precio['precio.' + t]} €</b> desde, por noche</p>`
        + `<button type="button" class="btn btn--oro" data-tipo="${t}">Ver fechas de ${escapar(h.tipos[t])}</button>`;
    }
    if (z.boton) s += `<button type="button" class="btn btn--oro" data-ir="${z.boton.ir}">${escapar(z.boton.texto)}</button>`;
    s += '</div>';
  }
  return s + '</div>';
}

/* El resumen de la portada: un nombre por línea y, si la hay, de dónde viene. */
export const nombresHTML = (h) => '<ul class="nombres__resumen">'
  + h.leyendas.map((l) => `<li><b>${escapar(l.nombre)}</b>${l.de ? `<span>${escapar(l.de)}</span>` : ''}</li>`).join('')
  + '</ul>';

/* El JSON para main.js: sin las claves «_…» y con los anchos de cada foto. */
export function etiquetaDatos(h, fotos) {
  const limpio = JSON.parse(JSON.stringify(h, (k, v) => (k.startsWith('_') ? undefined : v)));
  for (const z of Object.values(limpio.zonas)) {
    const f = fotos.get(z.foto);
    z.anchos = anchosFoto(f);
    z.alto = Math.round(z.anchos[0] * f.alto / f.ancho);   // el alto de la foto pequeña, para su width/height
  }
  return `<script type="application/json" id="datos-habitaciones">${JSON.stringify(limpio).replace(/</g, '\\u003c')}</script>`;
}

/* Las directivas de una página. Si lleva el panel, comprueba que cada data-k
   del dibujo tiene su zona (y que no sobra ninguna) e incrusta el JSON. */
export function ponerHabitaciones(html, h, casa, fotos, src, lang = 'es') {
  if (!RE_DIRECTIVA.test(html)) return html;
  RE_DIRECTIVA.lastIndex = 0;
  if (!h) throw new Error(`${src}: <!--panel--> o <!--nombres--> sin datos/habitaciones.json válido`);
  let conPanel = false;
  html = html.replace(RE_DIRECTIVA, (m, que, k) => {
    if (que === 'nombres') return nombresHTML(h);
    if (!k || !h.zonas[k]) throw new Error(`${src}: ${m}: no hay zona «${k}» en datos/habitaciones.json`);
    conPanel = true;
    return panelHTML(h, k, casa, fotos, lang);
  });
  if (conPanel) {
    const ks = [...new Set([...html.matchAll(/\bdata-k="([^"]+)"/g)].map((m) => m[1]))];
    const faltan = ks.filter((k) => !h.zonas[k]), sobran = Object.keys(h.zonas).filter((k) => !ks.includes(k));
    if (faltan.length) throw new Error(`${src}: las ventanas ${faltan.map((k) => `data-k="${k}"`).join(', ')} no tienen zona en datos/habitaciones.json`);
    if (sobran.length) throw new Error(`datos/habitaciones.json: las zonas ${sobran.join(', ')} no tienen ventana (data-k) en ${src}`);
    const tag = etiquetaDatos(h, fotos) + '\n';
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => tag + '</head>') : html;
  }
  return html;
}
