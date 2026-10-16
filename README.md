# Casa de Casal · Lestedo · «Bajo el tejado de la C»

Web nueva para Casa de Casal (C/ Pedro Ballesteros 17 · 15881 Lestedo, Boqueixón), casa rural de Patricia. **Publicada** el 2026-10-16 en https://alvarotaiagu.github.io/casa-de-casal-lestedo-web/ (repo público `alvarotaiagu/casa-de-casal-lestedo-web`, Pages sobre la rama `master`), con `noindex` en todas las páginas.

- **Datos y fuentes:** `../casa-de-casal-lestedo-bocetos/DATOS-CASA-DE-CASAL.md` (su WordPress leído por la API, Booking, la ficha de Google, OSM). Tablero de direcciones: https://claude.ai/artifact/1cymMsPZZhyTAFfMXdmNTT
- **Decisión (2026-10-16, «elijo tu recomendación»):** dirección A «Bajo el tejado de la C», con «El Pico, hoy» de B, el anillo del año de C junto al calendario, y «Los papeles de la casa» de D como opcional. Solo castellano. Fotos de su web y de Booking, **ninguna generada con IA**. Motor de reservas de demostración.
- **Ojo, cambio respecto al tablero:** la maqueta A usaba una foto nocturna que **no es de Casa de Casal**: es de *A Cantaruxa Maruxa* (Mondariz), sacada de su página «hoteles con encanto», donde Patricia recomienda otros alojamientos. En esa página hay más fotos ajenas (Torre do Río, Cristosende, Lar de Donas, Casa Piñeiro, Casona de Labrada, Casa Camino): no se usa ninguna, y `verificar.mjs` lo comprueba. Por eso la portada es de día, con el azul noche como fondo de marca.

## Concepto

Su logo es una «C» enorme cuyo brazo de arriba es un **tejado**. La web vive bajo ese tejado:

1. **Cortina:** fondo cal. El brazo del tejado (la pieza recortada de su propio PNG, no un redibujo) se traza de izquierda a derecha, aparece el resto del logo y la pantalla se abre **desde la cumbrera**: el borde que se levanta tiene forma de tejado a dos aguas.
2. **Portada:** «Nueve habitaciones bajo un mismo tejado». La foto vive en un **gablete** (silueta de casa) con su alero dorado. **Gesto propio:** se desliza de lado (dedo o ratón; `touch-action: pan-y` deja hacer scroll) entre cuatro vistas: la casa desde el prado, el Pico Sacro, el salón con galería y el estanque. Flechas del teclado, botones y puntos con forma de tejado.
3. **La casa:** la casa de la abuela de Patricia, su cita, la línea de fechas (s. XVII–XVIII, 2001, 2020, 2021) y cinco fotos con gablete. **Opcional:** «Los papeles de la casa» (los monjes de San Martín Pinario, cita literal suya).
4. **Bajo el tejado:** la casa dibujada de frente (esquema, no plano); cada ventana es una habitación o estancia y abre su panel con foto, planta y precio «desde». Debajo, los cinco tipos con «Ver fechas» (abre el motor filtrado), los **nombres de las habitaciones** que aparecen en sus archivos (Os Mouros, A Coruxa, O Régulo, El Encanto, Peregrino) y la **Casa Pequena do Casal**.
5. **La finca y la mesa:** estanque, piscina, glicinias, hórreo; lista de la finca; el desayuno con su lista literal.
6. **El Pico, hoy:** el monte dibujado desde la finca (silueta estilizada, no su perfil real). Sin deslizador ni botones (quitados el 16-10 a petición de Álvaro): solo el dato real y, si no llega, una frase neutra. **Dato en vivo real:** al acercarse, pide a Open-Meteo las nubes bajas y la lluvia de ahora en la cumbre y saca el refrán que toca («Cuando el Pico pone toquilla…»). **El sol de hoy** sale en su rumbo real; el texto dice los días en que sale justo por detrás del Pico (24 abr–13 may y 31 jul–19 ago, cálculo en `js/sol.js`). Seis leyendas resumidas de sus páginas, con capitular.
7. **Dos casas en una:** el anillo de los doce meses (temporadas de la casa, piscina, floraciones y frutales). Elegir un mes lleva el calendario a ese mes.
8. **Reserva (motor de DEMOSTRACIÓN, `js/reserva.js`):** de abril a octubre, habitaciones por tipo (cuántas quedan, contador por tipo, propuesta automática para el grupo); de noviembre a marzo, la casa entera hasta 22 (675 € una noche, 1.190 € dos). Cerrada el 24, 25 y 31 de diciembre. Pasos: fechas → datos → **anticipo del 25 %** (tarjeta, Bizum o transferencia) → confirmación `CDC-…`. Cancelación gratis hasta 7 días antes. **No envía, guarda ni cobra nada** y lo dice.
9. **Alrededores:** regla de minutos en coche (en móvil, lista) y el aviso para peregrinos: Vía de la Plata a 300 m, no el Camino Francés, y el otro Lestedo de Palas de Rei.
10. **Opiniones:** 9,6 en Booking con sus notas por apartado y tres frases literales sin nombre.
11. **Cómo llegar:** sus indicaciones literales; mapa de Google solo al pedirlo.
12. **Pie:** el tejado baja y **se posa sobre la C**. En la cabecera, el tejado se dora de izquierda a derecha según se lee (indicador de lectura) y en el pie queda completo.

### Nivel §5 bis

| Obligatoria | Cómo se cumple |
|---|---|
| Romper la fórmula | **Fuera:** cursor propio, imanes, marquesinas, pila sticky. **Propias:** cortina desde la cumbrera, gablete deslizable, la casa en sección, el Pico con su tiempo, el anillo del año, la regla de minutos. |
| Gesto táctil del hero | Deslizar de lado el gablete (probado con toques reales por CDP; el dedo vertical hace scroll). |
| El objeto se completa en el pie | El tejado de la cabecera se dora con la lectura; en el pie se posa sobre la C. |
| Foco con la forma del motivo | Contorno de 2 px y, encima de botones y chips, la cumbrera del tejado (`::before` con `clip-path`). |
| Rendimiento medido | Ver abajo. |

**Menú opcional elegido: dato en vivo** (nubes y lluvia de ahora en la cumbre, y el sol de hoy). Solo guarda en el navegador la marca del aviso de cookies; Open-Meteo y Google Fonts constan en la página de cookies.

### Paleta y letras

| Token | Color | De dónde sale |
|---|---|---|
| `--noche` | `#121a24` | fondo oscuro que acompaña al oro |
| `--oro` | `#a57d3a` | el oro de su logo, **medido** en el PNG (4,7:1 sobre noche) |
| `--oro-claro` | `#cfa865` | texto y detalles sobre noche |
| `--oro-texto` | `#7d581e` | el oro para texto sobre cal (5,5:1) |
| `--cal` | `#f3eee4` | fondos claros |
| `--niebla` / `--pino` | `#eef2f1` / `#1c3327` | la sección del Pico |

`verificar.mjs` mide 17 parejas de contraste; todas pasan 4,5:1. **Letras:** `Instrument Serif` (titulares, con cursiva en oro) y `Hanken Grotesk` (texto).

## Logo

**Su PNG de 2021, sin redibujar** (`../casa-de-casal-lestedo-bocetos/ref/logo/`). `python -I scripts/marca.py` lo recorta y saca: versiones en oro, blanco y negro; **el brazo del tejado suelto** (`tejado-oro*.png`, la segunda pieza más grande del PNG) y el logo **sin** ese brazo (`logo-oro-sin-tejado-840.png`), que juntos dan el logo exacto; versiones ligeras con paleta (1–19 KB); favicons con la «C» (media luna + tejado) sobre azul noche; `img/og.jpg`. **Pedir el vector.**

## Cómo se trabaja

- **Edita siempre los `*.src.html`.** `node construir.mjs` genera los `.html` (`<img data-foto>` → `<picture>` AVIF/WebP/JPG) y pone `?v=<huella>` a CSS y JS.
- **Legales y 404:** `node scripts/legales.mjs` y después `node construir.mjs`.
- **Fotos:** `scripts/fotos-lista.json` + `node scripts/fotos.mjs` (lee de la carpeta de bocetos; nunca amplía; `aq`/`wq` para la calidad propia de la portada).
- **`node verificar.mjs [--capturas]`** (puerto 8781): archivos y marcadores, ninguna foto de otros alojamientos, cortina (fotogramas a medias, sin CDN, CDN lento, sin JS, movimiento reducido), gablete (ratón, teclado, toque real de lado y vertical), las nueve zonas del dibujo, «Ver fechas», el Pico (tiempo simulado y caído, refranes, sol, leyendas con teclado), anillo → calendario, motor (casa entera 1 y 2 noches, cruce de temporada, Navidad cerrada, clásica 2 noches, validación, anticipo, localizador), cookies en 4 pasos, cabecera e indicador, regla sin etiquetas pisadas, pie, móvil a 360/375/390/768, barra del navegador (0 `refresh`), densidades, foco, fotos no ampliadas, contraste y legales. **139/139** el 2026-10-16.
- **`node scripts/rendimiento.mjs`** (puerto 8783) y `node scripts/_capturas.mjs [esc|mov]` (puerto 8779, capturas en `pruebas/`).

### Quitar la sección opcional

Borra el bloque entre `<!-- OPCIONAL «Los papeles de la casa»` y `<!-- fin OPCIONAL «Los papeles de la casa» -->`. No hay que tocar nada más.

## Mando de densidades (solo con `?revision`)

- **«Bajo el tejado»:** fotos con gablete, alero dorado que se traza sobre cada titular, mapa y «papeles» con forma de casa.
- **«Sobria»:** fotos rectas y sin aleros. **Añade** la tabla «Las habitaciones, de un vistazo».

### Receta de borrado del mando

1. En `index.src.html`: el bloque `<!-- MANDO DE MAQUETA` … `<!-- fin del MANDO DE MAQUETA -->` y, en el script del `<head>`, el `try { … }` de `// MANDO DE MAQUETA`.
2. En `js/main.js`: el bloque `14. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
3. Opcional: `.mando` en `css/estilos.css`.
4. `node construir.mjs`.

## Rendimiento (2026-10-16)

Pixel 7 emulado, 4G lento (1,6 Mbps, 150 ms), CPU ×4, 3 pasadas: **LCP 2,0–2,3 s** (la foto de la portada, precargada, en 800 px con tope de densidad), 20 peticiones, 908 KB (incluye las otras tres fotos del carrusel, que esperan a que cargue la página), tareas largas de 130–260 ms en el arranque. Antes de ajustarlo daba 4,4 s: las cuatro fotos del carrusel bajaban a la vez y los logos PNG pesaban 230 KB.

## Fotos

De su WordPress (`/wp-json/wp/v2/media`, hasta 2560 px; hay una sesión de **Xaime Cortizo, julio de 2022**) y de Booking (máx. 1280 px). **Asignación foto ↔ habitación:**
- **Por nombre de archivo (suyo):** Os Mouros, A Coruxa, O Régulo, El Encanto, Peregrino.
- **Por confirmar:** las de los tipos (La Torre = el balcón con vino de Booking; con terraza = la terraza con columpio; Pico Sacro = la de techo de madera; confort = el armario tallado). Su web también tiene «baño de la habitación con balcón La Torre».

## Pendientes para la casa

Las preguntas para Patricia, en `PENDIENTES.md` (fuera del repo). Las que bloquean publicar:

- [ ] **Titular y NIF** para aviso legal y privacidad (van como PENDIENTE visible).
- [ ] **Casa entera:** 22 personas a 675 € (portada, 2025) o 23 a 550 € (2022). Mínimo de noches y precio de la tercera noche (el motor supone 595 €).
- [ ] **Habitaciones:** cuántas hay de cada tipo (el motor supone 2 clásicas, 4 confort, La Torre, con terraza y Pico Sacro), sus nombres y qué foto es de cuál; precios de este año y si hay temporadas (el motor usa el «desde» de 2022 todo el año).
- [ ] **Cenas:** la web dice «Las cenas caseras se piden con antelación». ¿Las siguen dando? ¿Qué días?
- [ ] **Casa Pequena:** ¿se reserva por noches? Hoy la web solo ofrece preguntar por WhatsApp.
- [ ] **Historia:** siglo XVII o XVIII (la web dice «más de dos siglos») y permiso para contar lo de los monjes.
- [ ] **Logo en vector** y **originales de las fotos** (Cortizo) y alguna de invierno.
- [ ] **Dirección:** C/ Pedro Ballesteros 17 (su web) frente a Rúa de Pedralta 17 (OSM).
- [ ] **Pico Sacro al amanecer:** comprobar desde la finca que se ve salir el sol por detrás.
- [ ] Opiniones: tres frases literales de Booking, sin nombre. Pedir permiso si se quieren con nombre.

## Para publicar

`noindex` en todas las páginas mientras no venda. `?v=<huella>` ya lo pone `construir.mjs`; avisar de Ctrl+F5. Fuera del repo: `pruebas/` y `PENDIENTES.md`. Las fotos salen de la carpeta de bocetos, que no se sube.
