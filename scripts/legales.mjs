/* Genera las fuentes de las cuatro páginas legales (spec 001 §3.1.8 bis):
   paginas/<slug>.src.html, que construir.mjs saca a <slug>/index.html con la
   cabecera, el pie y el aviso de cookies comunes (parciales/).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Los textos se cambian AQUÍ, no en paginas/*.src.html (se sobrescriben).
   Cada legal lleva (spec 002 §3.3, plan PD-8 bis):
     - titulo: el del <title> y og:title, seguido de « · Casa de Casal»;
     - h1: el título que se ve en la página;
     - descripcion: la meta description, de 110 a 155 caracteres, que dice qué
       contiene la página (sin precios ni «Booking»); el script falla si no.
   El 404 ya no sale de aquí: 404.src.html se edita a mano (§9).
   El titular y el NIF no aparecen en ninguna fuente: van como PENDIENTE visible (P-05). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<p class="aviso">PENDIENTE: nombre o razón social del titular y NIF/CIF (no aparecen en su web actual).</p>
<dl>
  <dt>Nombre comercial</dt><dd>Casa de Casal</dd>
  <dt>Domicilio</dt><dd>Rúa Pedro Ballesteros, 17 · 15881 Lestedo, Boqueixón (A Coruña)</dd>
  <dt>Teléfono</dt><dd><a href="tel:+34698148323">698 148 323</a></dd>
  <dt>Correo</dt><dd><a href="mailto:info@casadecasal.com">info@casadecasal.com</a></dd>
</dl>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    h1: 'Aviso legal',
    descripcion: 'Quién es el titular de casadecasal.com, condiciones de uso de la web, propiedad intelectual de textos y fotos, responsabilidad y ley aplicable.',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<p>Establecimiento de turismo rural inscrito en el Registro de Empresas y Actividades Turísticas de Galicia con el número <b class="nw">TR-CO-000081</b>.</p>
<h2>Uso de la web</h2>
<p>Esta web informa sobre Casa de Casal y enseña cómo será la reserva directa. Quien la usa se compromete a hacerlo de buena fe y conforme a la ley.</p>
<p>Por ahora, el motor de reservas de esta web es una demostración: las fechas ocupadas son de ejemplo, los precios son los «desde» publicados por la casa y no se envía, guarda ni cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotografías son del titular o se usan con su permiso. No se pueden reproducir sin autorización.</p>
<p>Los tiempos en coche se han calculado con datos de <a href="https://www.openstreetmap.org/copyright">© colaboradores de OpenStreetMap</a> (licencia ODbL) y el servicio OSRM. El tiempo del Pico Sacro viene de <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0).</p>
<p>El Pico en 3D usa el modelo digital del terreno MDT05 y la ortofoto PNOA, © <a href="https://www.ign.es">Instituto Geográfico Nacional</a> (CC BY 4.0).</p>
<h2>Responsabilidad</h2>
<p>Las distancias, los tiempos de viaje y la hora a la que sale el sol son aproximados. Los enlaces a otras webs (Google Maps, WhatsApp) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, escríbenos o llámanos: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Privacidad',
    h1: 'Política de privacidad',
    descripcion: 'Qué datos personales tratamos cuando nos escribes o reservas, para qué los usamos, cuánto tiempo los guardamos y cómo ejercer tus derechos.',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Solo los que nos mandas al hacer una consulta o una reserva (por WhatsApp, teléfono o correo): nombre, móvil, correo, fechas, número de personas y lo que quieras contarnos. Los usamos para contestarte y, si reservas, para gestionar tu estancia.</p>
<p>El motor de reservas de esta web es, por ahora, una demostración: lo que escribas en él no sale de tu navegador ni se guarda.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al escribirnos y, si reservas, la ejecución del contrato de alojamiento. Conservamos los datos el tiempo necesario para atender la consulta y, en las reservas, los plazos que exige la ley (incluido el registro de viajeros).</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal. Si nos escribes por WhatsApp, ese servicio trata el mensaje según sus propias políticas.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos en <a href="mailto:info@casadecasal.com">info@casadecasal.com</a>. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Dos marcas técnicas, sin ningún dato personal:</p>
<ul>
  <li><code>casal-cookies</code>, en el almacenamiento local, para recordar que ya has visto el aviso de cookies.</li>
  <li><code>cdc-cortina</code>, en el almacenamiento de la sesión, para no repetir la entrada de la portada cada vez que vuelves a ella. Se borra sola al cerrar el navegador.</li>
</ul>
<p>Más detalles en <a href="{{raiz}}cookies/">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Cookies',
    h1: 'Política de cookies',
    descripcion: 'Qué guarda esta web en tu navegador (ninguna cookie de análisis ni de publicidad) y qué servicios de terceros usa, como Google Fonts y Google Maps.',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>casal-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
  <li><b>cdc-cortina</b> (almacenamiento de la sesión): recuerda que ya has visto la entrada de la portada, para no repetirla cada vez que vuelves a ella. Es técnica y se borra sola al cerrar el navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>Open-Meteo</b>: al llegar a la sección del Pico Sacro, la web pide a Open-Meteo el tiempo de ahora en la cumbre. Recibe tu dirección IP y no instala cookies.</li>
  <li><b>Librerías</b> (GSAP, Lenis y Three.js para el Pico en 3D): se descargan de cdnjs y jsDelivr, que reciben tu dirección IP. No instalan cookies. El relieve y la foto aérea del IGN van en esta misma web.</li>
</ul>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de cada página.</p>`,
  },
  accesibilidad: {
    titulo: 'Accesibilidad',
    h1: 'Declaración de accesibilidad',
    descripcion: 'Compromiso de accesibilidad de casadecasal.com según el Real Decreto 1112/2018, situación de cumplimiento y cómo avisarnos de una barrera de acceso.',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme al Real Decreto 1112/2018, de 7 de septiembre, y a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. Las fotos de la portada se cambian también con las flechas del teclado, y el dibujo de la casa se recorre con el tabulador.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, escribe a <a href="mailto:info@casadecasal.com">info@casadecasal.com</a> o llama al <a href="tel:+34698148323">698 148 323</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

// cada legal: el comentario de datos (PD-5), los parciales comunes y su texto.
// Sin «menu»: ningún enlace del menú lleva aria-current. La página no tiene
// cortina, así que la cabecera se ve desde el principio (cortina-fuera).
const fuente = (p) => `<!--pagina ${JSON.stringify({ titulo: `${p.titulo} · Casa de Casal`, descripcion: p.descripcion })}-->
<!DOCTYPE html>
<html lang="es" data-raiz="{{raiz}}" class="cortina-fuera">
<head>
<!-- @incluye head -->
<link rel="stylesheet" href="{{raiz}}css/legal.css">
</head>
<body>

<!-- @incluye cabecera -->

<main id="principal" class="legal">
  <header class="legal__cab oscura">
    <div class="env">
      <h1>${p.h1}</h1>
    </div>
  </header>
  <div class="legal__texto clara">
    <div class="env">
${p.cuerpo.trim()}
    </div>
  </div>
</main>

<!-- @incluye pie -->

<!-- @incluye cookies -->

<!-- @incluye scripts -->
</body>
</html>
`;

// spec 002 §3.3 y CA-13: que no salga una description que luego falle en las pruebas
const descripciones = new Set();
for (const [slug, p] of Object.entries(paginas)) {
  const n = [...p.descripcion].length;
  if (n < 110 || n > 155) throw new Error(`${slug}: la descripcion tiene ${n} caracteres (van de 110 a 155)`);
  if (/booking/i.test(p.descripcion) || /\d\s?(€|euros?)/i.test(p.descripcion)) throw new Error(`${slug}: la descripcion no lleva precios ni «Booking»`);
  if (descripciones.has(p.descripcion)) throw new Error(`${slug}: la descripcion se repite`);
  descripciones.add(p.descripcion);
}

const dir = path.join(RAIZ, 'paginas');
fs.mkdirSync(dir, { recursive: true });
for (const [slug, p] of Object.entries(paginas)) {
  fs.writeFileSync(path.join(dir, `${slug}.src.html`), fuente(p));
  console.log(`paginas/${slug}.src.html`);
}
