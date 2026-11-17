/* Datos de un sitio en su página (spec 002 §3.1 «Estructura de la página de un
   sitio», §3.7; plan PD-4.3).
   El sitio de una página es la entrada de datos/alrededores.json con su slug.
   En la fuente:
     {{sitio.minutos}}     los minutos en coche desde la casa
                           («A {{sitio.minutos}} minutos en coche de Casa de Casal»);
     {{sitio.maps}}        la URL de «Abrir en Google Maps», con sus coordenadas:
                           https://www.google.com/maps/search/?api=1&query=<lat>,<lon>
                           (va en un href; las coordenadas no salen en el texto);
     <!--sitio:jsonld-->   el JSON-LD TouristAttraction: name (el del sitio en
                           alrededores.json), description (la del comentario
                           <!--pagina …-->) y geo. Sin url ni image: los pone la
                           005, absolutos al dominio.
   La construcción falla si una página usa uno de estos y no tiene entrada en
   alrededores.json, o si usa un {{sitio.…}} que no existe. */
import fs from 'node:fs';
import path from 'node:path';

const RE_HUECO = /\{\{sitio\.([a-z0-9_]+)\}\}/g;
const RE_DIRECTIVA = /<!--\s*sitio:jsonld\s*-->/g;
const usaSitio = (html) => /\{\{sitio\.|<!--\s*sitio:/.test(html);

/* Los sitios de alrededores.json que tienen página, por slug. */
export function cargarSitios(raiz) {
  const f = path.join(raiz, 'datos', 'alrededores.json');
  let datos;
  try { datos = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`datos/alrededores.json: no se puede leer (${e.message})`); }
  if (!datos || !Array.isArray(datos.sitios)) throw new Error('datos/alrededores.json: tiene que tener una lista «sitios»');
  const porSlug = new Map();
  for (const s of datos.sitios) if (s && s.slug) porSlug.set(s.slug, s);
  return porSlug;
}

const urlMaps = (s) => `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;

export function jsonLD(sitio, descripcion) {
  const o = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: sitio.nombre,
    description: descripcion,
    geo: { '@type': 'GeoCoordinates', latitude: sitio.lat, longitude: sitio.lon },
  };
  return `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
}

/* Rellena los huecos y la directiva de `slug`. `datos` es el comentario
   <!--pagina …--> de la página (para la description). Lanza un error con
   todos los fallos de la página. */
export function ponerSitios(html, sitios, slug, datos, src) {
  if (!usaSitio(html)) return html;
  const sitio = slug ? sitios.get(slug) : null;
  if (!sitio) throw new Error(`${src}: usa {{sitio.…}} o <!--sitio:jsonld--> y alrededores.json no tiene ningún sitio con slug «${slug || '(sin slug)'}»`);
  const errores = [];
  const valores = {
    minutos: Number.isFinite(sitio.minutos) ? String(sitio.minutos) : null,
    maps: Number.isFinite(sitio.lat) && Number.isFinite(sitio.lon) ? urlMaps(sitio).replace(/&/g, '&amp;') : null,
  };
  let salida = html.replace(RE_HUECO, (m, k) => {
    if (!(k in valores)) { errores.push(`${src}: {{sitio.${k}}} no existe (hay {{sitio.minutos}} y {{sitio.maps}})`); return m; }
    if (valores[k] == null) { errores.push(`${src}: {{sitio.${k}}}: el sitio «${slug}» de alrededores.json no tiene ${k === 'maps' ? 'lat y lon' : 'minutos'}`); return m; }
    return valores[k];
  });
  for (const m of salida.matchAll(/<!--\s*sitio:([a-z0-9]+(?:-[a-z0-9]+)*)?/g)) if (m[1] !== 'jsonld') errores.push(`${src}: <!--sitio:${m[1] ?? ''}--> no existe (hay <!--sitio:jsonld-->)`);
  if (salida.match(RE_DIRECTIVA)) {
    if (!datos || typeof datos.descripcion !== 'string' || !datos.descripcion.trim()) errores.push(`${src}: <!--sitio:jsonld--> necesita «descripcion» en el comentario <!--pagina …-->`);
    else if (valores.maps == null) errores.push(`${src}: <!--sitio:jsonld-->: el sitio «${slug}» de alrededores.json no tiene lat y lon`);
    else salida = salida.replace(RE_DIRECTIVA, () => jsonLD(sitio, datos.descripcion));
  }
  if (errores.length) throw new Error(errores.join('\n  - '));
  return salida;
}
