/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   El titular y el NIF no aparecen en ninguna fuente: van como PENDIENTE visible. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<p class="aviso">PENDIENTE: nombre o razón social del titular y NIF/CIF (no aparecen en su web actual).</p>
<dl>
  <dt>Nombre comercial</dt><dd>Casa de Casal</dd>
  <dt>Domicilio</dt><dd>C/ Pedro Ballesteros, 17 · 15881 Lestedo, Boqueixón (A Coruña)</dd>
  <dt>Teléfono</dt><dd><a href="tel:+34698148323">698 148 323</a></dd>
  <dt>Correo</dt><dd><a href="mailto:info@casadecasal.com">info@casadecasal.com</a></dd>
</dl>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
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
<p>Las distancias, los tiempos de viaje y la hora a la que sale el sol son aproximados. Los enlaces a otras webs (Google Maps, WhatsApp, Booking.com) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, escríbenos o llámanos: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
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
<p>Una sola cosa: <code>casal-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>casal-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>Open-Meteo</b>: al llegar a la sección del Pico Sacro, la web pide a Open-Meteo el tiempo de ahora en la cumbre. Recibe tu dirección IP y no instala cookies.</li>
  <li><b>Librerías</b> (GSAP, Lenis y Three.js para el Pico en 3D): se descargan de cdnjs y jsDelivr, que reciben tu dirección IP. No instalan cookies. El relieve y la foto aérea del IGN van en esta misma web.</li>
</ul>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la portada.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme al Real Decreto 1112/2018, de 7 de septiembre, y a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1, foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. Las fotos de la portada se cambian también con las flechas del teclado, y el dibujo de la casa se recorre con el tabulador.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, escribe a <a href="mailto:info@casadecasal.com">info@casadecasal.com</a> o llama al <a href="tel:+34698148323">698 148 323</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${titulo} · Casa de Casal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    <a href="index.html" aria-label="Casa de Casal, a la portada"><img src="marca/logo-blanco-300.png" alt="" width="300" height="162"></a>
    <a class="volver" href="index.html">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
<style>
  .no-hay { background: var(--noche); color: var(--cal); min-height: 100svh; display: grid; place-items: center; text-align: center; padding: 24px; }
  .no { display: grid; gap: 22px; justify-items: center; max-width: 30em; }
  .no img { width: min(60vw, 300px); height: auto; }
  .no h1 { font-family: var(--letra-tit); font-weight: 400; font-size: clamp(2.4rem, 7vw, 3.6rem); line-height: 1; }
  .no p { color: var(--cal-3); }
</style>
  <main class="no">
    <img src="marca/tejado-oro-290.png" alt="" width="290" height="282">
    <h1>Bajo este tejado no hay nada.</h1>
    <p>La página que buscas no existe o ha cambiado de sitio.</p>
    <a class="btn btn--oro" href="./">Volver a la portada</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
