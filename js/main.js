/* ------------------------------------------------------------------
   Casa de Casal · Lestedo · «Bajo el tejado de la C»
   Solo la portada (spec 001 §3.1.4 bis): cortina, gablete, dibujo de la
   casa, el Pico, el anillo del año, el mapa de Google, el mando de
   maqueta y el resize. Lo común (cabecera, menú, cookies, carrusel,
   leyendas, regla…) está en comun.js, que se carga antes.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const C = window.CASAL;
  if (!C) return;
  const { t, mayus, $, $$, f, limitar, svgEl, hayGSAP, fino, motion, irA, R, idioma } = C;   // t(): todo texto que pinta (spec 001 §3.1.11)
  const raiz = document.documentElement;
  // datos de temporada (datos/casa.json): la construcción los pone en la página (spec 001 §3.3, PD-8)
  const CASA = (() => { try { return JSON.parse($('#datos-casa').textContent); } catch (e) { return null; } })();
  const precioDesde = (tipo) => (CASA && tipo ? CASA.precios.desde[tipo] : null);
  const fEntero = new Intl.NumberFormat(idioma, { useGrouping: 'always' });   // punto de miles también con cuatro cifras, como en su web

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => !fino && innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. el gablete de la portada: el carrusel de comun.js bajo el tejado ============ */
  const cajaGablete = $('#gablete');
  const gablete = cajaGablete ? C.carrusel(cajaGablete, {
    fotos: $$('.gablete__foto', cajaGablete),
    puntos: $$('#gablete-puntos button'),
    pie: $('#gablete-pie'),
    botones: $$('.gablete__btn'),
  }) : null;

  /* ============ 1 bis. el carrusel de las estancias (spec 001 §3.4.2): el mismo componente ============
     El pie y los puntos vienen en el HTML; sin JavaScript, la hoja de estilos
     lo deja en una fila con scroll lateral. */
  const cajaEstancias = $('#estancias');
  const estancias = cajaEstancias ? C.carrusel(cajaEstancias, {
    fotos: $$('.estancias__foto', cajaEstancias),
    puntos: $$('#estancias-puntos button'),
    pie: $('#estancias-pie'),
    botones: $$('.estancias__btn'),
  }) : null;

  /* ============ 2. bajo el tejado: lo que hay detrás de cada ventana ============
     Los datos son los de datos/habitaciones.json, que la construcción pone en
     la página (PD-8). El panel de La Torre ya viene pintado en el HTML (sin
     JavaScript se ve ese); al tocar otra ventana se pinta el suyo con el
     mismo marcado que scripts/lib/habitaciones.mjs. Los textos del JSON no
     pasan por t() (los traduce la 004 en el propio JSON). */
  (function seccion() {
    const caja = $('.seccion'), panel = $('#seccion-panel');
    if (!caja) return;
    // el tejado del dibujo se traza al llegar, haya o no datos para el panel
    if (motion) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { caja.classList.add('es-trazada'); o.disconnect(); } }, { threshold: 0.3 }).observe(caja);
    else caja.classList.add('es-trazada');
    const H = (() => { try { return JSON.parse($('#datos-habitaciones').textContent); } catch (e) { return null; } })();
    if (!panel || !H) return;
    const zonas = $$('.zona', caja);
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const pintarPanel = (k) => {
      const z = H.zonas[k];
      const [a0, a1] = z.anchos, foto = (w) => `${R}img/fotos/${z.foto}-${w}.jpg`;
      let s = `<div class="seccion__ficha" data-zona="${esc(k)}"><img id="sp-foto" src="${foto(a0)}" srcset="${foto(a0)} ${a0}w, ${foto(a1)} ${a1}w" sizes="(max-width: 899px) 92vw, 34vw" alt="" width="${a0}" height="${z.alto}" loading="lazy">`
        + `<p class="eti" id="sp-planta">${esc(z.planta)}</p><h3 id="sp-nombre">${esc(z.titulo)}</h3>`;
      // una zona sin habitaciones ni frase no abre un panel vacío (spec 001 §9)
      if (z.frase.trim()) s += `<p id="sp-texto">${esc(z.frase)}</p>`;
      else if (!z.habitaciones.length) s += `<p id="sp-texto">${t('Pronto, con sus fotos')}</p>`;
      if (z.habitaciones.length) {
        s += `<ul class="seccion__habs">${z.habitaciones.map((x) => `<li><b>${esc(x.nombre)}</b>${x.cama ? `<span>${esc(x.cama)}</span>` : ''}${x.frase ? `<span>${esc(x.frase)}</span>` : ''}</li>`).join('')}</ul>`;
      }
      // un «Ver fechas» por tipo, con su «desde» de datos/casa.json
      // sin el «desde» de casa.json no hay precio ni botón (nada de «0 €»)
      const tipos = [...new Set(z.habitaciones.map((x) => x.tipo))].filter((tp) => precioDesde(tp) != null);
      if (tipos.length || z.boton) {
        s += `<div class="seccion__acc">${tipos.map((tp) => `<p class="seccion__precio">${t('<b>{precio} €</b> desde, por noche', { precio: fEntero.format(precioDesde(tp)) })}</p>`
          + `<button type="button" class="btn btn--oro" data-tipo="${esc(tp)}">${t('Ver fechas de {nombre}', { nombre: esc(H.tipos[tp]) })}</button>`).join('')}`
          + `${z.boton ? `<button type="button" class="btn btn--oro" data-ir="${esc(z.boton.ir)}">${esc(z.boton.texto)}</button>` : ''}</div>`;
      }
      panel.innerHTML = s + '</div>';
    };
    const marcar = (g) => zonas.forEach((z) => z.classList.toggle('activa', z === g));
    const elegir = (g) => { marcar(g); if (H.zonas[g.dataset.k]) pintarPanel(g.dataset.k); };
    zonas.forEach((g) => {
      g.addEventListener('click', () => elegir(g));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(g); } });
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tipo) reservarTipo(b.dataset.tipo);
      else if (b.dataset.ir) irA(b.dataset.ir);
    });
    // la zona que trae pintada el HTML, encendida
    const ficha = $('.seccion__ficha', panel);
    const g0 = ficha && $(`[data-k="${ficha.dataset.zona}"]`, caja);
    if (g0) marcar(g0);
  })();
  function reservarTipo(id) {
    if (window.CASALmotor) window.CASALmotor.elegirTipo(id);
    irA('#motor');
  }
  // las fichas de los tipos están en /tu-habitacion/: su «Ver fechas» llega con ?tipo=…#reserva (lo lee reserva.js)

  /* ============ 3. el Pico, hoy ============ */
  (function pico() {
    const svg = $('#pico-dibujo');
    if (!svg || !window.SOL) return;
    const S = window.SOL;
    let tres = null, ultimaNube = null;     // el Pico en 3D, si carga (abajo)
    /* Panorámica desde la finca, de este a oeste pasando por el sur: el Pico Sacro a la izquierda, en su rumbo real (78,6°).
       x: 2,96 px por grado de rumbo (45° a 315°). y: altura sobre el horizonte, 12,5 px/grado hasta 12° y 1,75 px/grado
       por encima, para que el Pico (10,5° de altura aparente) se vea y el sol de mediodía (hasta 70°) quepa. */
    const xRumbo = (az) => (az - 45) * (800 / 270);
    // más cielo por arriba para llenar el mismo hueco que el 3D (más alto en el móvil)
    const altoVista = innerWidth < 700 ? 680 : 460, arriba = 340 - altoVista;
    svg.setAttribute('viewBox', `0 ${arriba} 800 ${altoVista}`);
    const fondoCielo = $('#pico-cielo-fondo'); fondoCielo.setAttribute('y', arriba); fondoCielo.setAttribute('height', altoVista);
    const yAlt = (alt) => (alt <= 12 ? 292 - alt * 12.5 : 142 - (alt - 12) * 1.75);
    // perfil (rumbo, altura aparente): el Pico con su paso de la Reina Lupa; el resto, lomas del valle del Ulla (estilizadas)
    const PERFIL = [[40, 1.2], [50, 1.8], [57, 2.8], [63, 4.3], [68, 6.2], [72, 8.1], [75, 9.6], [77.2, 10.4], [78, 9.3], [78.9, 9.3], [79.6, 10.6], [81.5, 10.2], [84, 8.8], [88, 6.6], [93, 4.6], [99, 3.1], [107, 2.2], [118, 1.6], [132, 1.9], [148, 2.5], [165, 1.7], [182, 1.3], [198, 2.1], [214, 2.8], [232, 2.0], [250, 2.6], [268, 1.7], [286, 2.3], [304, 1.6], [320, 1.4]];
    const pts = PERFIL.map(([a, h]) => [f(xRumbo(a)), f(yAlt(h))]);
    $('#pico-monte').setAttribute('d', 'M' + pts.map((p) => p.join(' ')).join(' L') + ' L820 340 L-20 340 Z');
    const yCresta = (x) => { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return 290; };
    // la capilla de San Sebastián, en la cumbre
    const xc = xRumbo(77.6), yc = yAlt(10.4);
    $('#pico-capilla').setAttribute('transform', `translate(${f(xc - 384)} ${f(yc - 80)})`);
    // nubes: una «toquilla» en la cumbre y dos bandas más altas
    const nubesG = $('#pico-nubes'); nubesG.textContent = '';
    [[xc, yc + 4, 70, 14], [xc + 40, yc + 30, 90, 13], [xc - 30, yc + 26, 60, 11], [330, 150, 170, 16], [600, 120, 190, 18]].forEach(([cx, cy, rx, ry]) => svgEl(nubesG, 'ellipse', { cx: f(cx), cy: f(cy), rx, ry }));
    const marcas = $('#pico-marcas');
    const hoy = new Date(), dHoy = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12));
    const fecha = new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    svgEl(marcas, 'text', { x: f(xc + 14), y: f(yc - 14), 'font-weight': 600 }, t('Pico Sacro · 533 m'));
    // el camino del sol hoy, de la salida a la puesta (cada 10 min)
    const arco = [];
    for (let m = 0; m < 24 * 60; m += 1) {   // cada minuto: las horas de «sale» y «se pone» cuadran con el texto
      const cuando = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, m));
      const p = S.solAhora(cuando);
      if (p.alt > -0.833) arco.push([f(xRumbo(p.az)), f(yAlt(p.alt)), cuando]);
    }
    const hora = new Intl.DateTimeFormat(idioma, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    if (arco.length > 1) {
      svgEl(marcas, 'polyline', { points: arco.filter((p, i) => i % 10 === 0 || i === arco.length - 1).map((p) => p[0] + ',' + p[1]).join(' '), fill: 'none', stroke: '#c07a2a', 'stroke-width': 1.5, 'stroke-dasharray': '3 6', opacity: 0.75 });
      const [xs] = arco[0], [xp] = arco[arco.length - 1];
      svgEl(marcas, 'text', { x: f(xs + 8), y: f(yCresta(xs) - 10), 'font-weight': 600 }, t('sale {hora}', { hora: hora.format(arco[0][2]) }));
      svgEl(marcas, 'text', { x: f(xp - 8), y: f(yCresta(xp) - 10), 'font-weight': 600, 'text-anchor': 'end' }, t('se pone {hora}', { hora: hora.format(arco[arco.length - 1][2]) }));
    }
    const az = S.rumbo(-0.833, S.decl(dHoy));
    // puntos cardinales, sobre la tierra
    const card = svgEl(svg, 'g', { 'font-family': 'Hanken Grotesk, sans-serif', 'font-size': 12, 'font-weight': 600, fill: '#c9d2d6', 'text-anchor': 'middle', 'letter-spacing': '.1em', 'aria-hidden': 'true' });
    [[t('E'), 90], [t('SE'), 135], [t('S'), 180], [t('SO'), 225], [t('O'), 270]].forEach(([x, a]) => svgEl(card, 'text', { x: f(xRumbo(a)), y: 330 }, x));

    /* el cielo de ahora en Lestedo: luz según la altura real del sol, sol y luna en su sitio real, estrellas de noche */
    const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const mezcla = (a, b, x) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * x).toString(16).padStart(2, '0')).join('');
    const tramo = (tabla, h) => {           // interpola una tabla [altura del sol, colores…]
      if (h <= tabla[0][0]) return tabla[0].slice(1);
      for (let i = 1; i < tabla.length; i++) if (h <= tabla[i][0]) { const x = (h - tabla[i - 1][0]) / (tabla[i][0] - tabla[i - 1][0]); return tabla[i].slice(1).map((c, k) => mezcla(tabla[i - 1][k + 1], c, x)); }
      return tabla[tabla.length - 1].slice(1);
    };
    const CIELO = [[-18, '#070c16', '#0e1729', '#18233a'], [-8, '#142038', '#2b3550', '#5a4a64'], [-2, '#2f4a6e', '#8b7a8f', '#e39b6a'], [4, '#7fa0be', '#e7c9a5', '#f3b77a'], [12, '#a9c4d4', '#e9e2cf', '#f2d8a8'], [30, '#9fc0d6', '#dfe7e6', '#eef0e6']];
    // monte, primer plano, segundo plano, capilla, letras del dibujo, nubes
    const TIERRA = [[-10, '#1d2420', '#10201a', '#0a1712', '#8f99a3', '#c9d2d6', '#5d6774'], [4, '#58625a', '#2c4636', '#1c3327', '#ece6d8', '#4b5953', '#f7f8f7']];
    const estrellas = $('#pico-estrellas');
    for (let i = 0; i < 90; i++) { const sx = (i * 137.5) % 800, sy = arriba + (i * 61.3) % (240 - arriba); svgEl(estrellas, 'circle', { cx: f(sx), cy: f(sy), r: i % 7 === 0 ? 1.6 : 0.9, opacity: f(0.35 + ((i * 29) % 10) / 15) }); }
    const solG = $('#pico-sol'), lunaG = $('#pico-luna');
    const enCuadro = (px, py) => px > -20 && px < 820 && py > arriba;
    const lunaPath = (r, luz, fase) => {
      const crece = fase < 0.5, rx = f(r * Math.abs(2 * luz - 1));
      const s1 = crece ? 1 : 0, s2 = crece ? (luz > 0.5 ? 1 : 0) : (luz > 0.5 ? 0 : 1);
      return `M0 ${-r} A${r} ${r} 0 0 ${s1} 0 ${r} A${rx} ${r} 0 0 ${s2} 0 ${-r} Z`;
    };
    const nombreFase = (luz, fase) => (luz < 0.03 ? t('luna nueva') : luz > 0.97 ? t('luna llena') : fase < 0.5 ? (luz < 0.5 ? t('luna creciente') : t('luna creciente, casi llena')) : (luz < 0.5 ? t('luna menguante') : t('luna menguante, recién pasada la llena')));
    const rumboTxt = (a) => [t('norte'), t('noreste'), t('este'), t('sureste'), t('sur'), t('suroeste'), t('oeste'), t('noroeste')][Math.round(a / 45) % 8];
    function pintarCielo(ahora) {
      const sol = S.solAhora(ahora), luna = S.lunaAhora(ahora);
      const [c0, c1, c2] = tramo(CIELO, sol.alt);
      $('#cielo-0').setAttribute('stop-color', c0); $('#cielo-1').setAttribute('stop-color', c1); $('#cielo-2').setAttribute('stop-color', c2);
      const [monte, f1, f2, capilla, texto, nube] = tramo(TIERRA, sol.alt);
      $('#pico-monte').setAttribute('fill', monte); $('#pico-fondo-1').setAttribute('fill', f1); $('#pico-fondo-2').setAttribute('fill', f2);
      $('#pico-capilla').setAttribute('fill', capilla); marcas.setAttribute('fill', texto); $('#pico-nubes').setAttribute('fill', nube);
      const noche = limitar((-sol.alt - 2) / 10, 0, 1);
      estrellas.style.opacity = f(noche * noche);
      const sx = xRumbo(sol.az), sy = yAlt(sol.alt), solVe = sol.alt > -1.5 && enCuadro(sx, sy);
      solG.toggleAttribute('hidden', !solVe);   // en SVG, .hidden no quita el atributo
      if (solVe) { solG.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`); $('#sol-disco').setAttribute('fill', mezcla('#e0703a', '#f0b858', limitar(sol.alt / 8, 0, 1))); }
      const lx = xRumbo(luna.az), ly = yAlt(luna.alt), lunaVe = luna.alt > -1 && enCuadro(lx, ly) && luna.luz > 0.03;
      lunaG.toggleAttribute('hidden', !lunaVe);
      if (lunaVe) { lunaG.setAttribute('transform', `translate(${f(lx)} ${f(ly)})`); $('#luna-luz').setAttribute('d', lunaPath(11, luna.luz, luna.fase)); $('#luna-disco').setAttribute('opacity', f(0.25 + 0.6 * noche)); }
      const manana = sol.az < 180;
      const momento = sol.alt > 6 ? t('es de día') : sol.alt > 0 ? (manana ? t('acaba de amanecer') : t('atardece')) : sol.alt > -6 ? (manana ? t('está amaneciendo') : t('anochece')) : t('es de noche');
      const fase = nombreFase(luna.luz, luna.fase), pct = Math.round(luna.luz * 100);
      const lunaTxt = luna.alt > 0
        ? t('{fase} ({pct} % iluminada), sobre el horizonte, hacia el {rumbo}', { fase, pct, rumbo: rumboTxt(luna.az) })
        : t('{fase} ({pct} % iluminada), bajo el horizonte', { fase, pct });
      $('#pico-cielo-txt').textContent = t('Ahora, a las {hora}, en Lestedo {momento}. {luna}.', { hora: hora.format(ahora), momento, luna: mayus(lunaTxt) });
      if (tres) tres.actualizar(ahora);
      return { solAlt: sol.alt, solVe, lunaVe, luz: luna.luz, fase: luna.fase, cielo: c0, estrellas: +estrellas.style.opacity };
    }
    window.__cielo = (x) => pintarCielo(x ? new Date(x) : new Date());
    pintarCielo(new Date());
    // cada minuto, solo mientras la sección se ve
    let reloj = 0;
    new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !reloj) { pintarCielo(new Date()); reloj = setInterval(() => pintarCielo(new Date()), 60000); }
      else if (!es[0].isIntersecting && reloj) { clearInterval(reloj); reloj = 0; }
    }).observe(svg);
    $('#pico-hora').textContent = hora.format(S.salida(dHoy));
    const dif = az - S.PICO;
    const grados = Math.round(az);
    $('#pico-rumbo').textContent = Math.abs(dif) < S.ANCHO ? t('justo por detrás del Pico.') : dif > 0 ? t('a la derecha del Pico (rumbo {grados}°).', { grados }) : t('a la izquierda del Pico (rumbo {grados}°).', { grados });
    const tr = S.tramos(hoy.getFullYear()).map(([a, b]) => t('del {desde} al {hasta}', { desde: fecha.format(a), hasta: fecha.format(b) }));
    $('#pico-tramos').textContent = t('Por detrás del Pico, {tramos}.', { tramos: new Intl.ListFormat(idioma, { type: 'conjunction' }).format(tr) });

    // el tiempo de ahora en la cumbre (Open-Meteo), al llegar a la sección. Solo dato real: si no llega, una frase neutra
    const fuente = $('#pico-fuente'), dato = $('#pico-dato'), nubes = $('#pico-nubes'), lluvia = $('#pico-lluvia');
    for (let i = 0; i < 46; i++) { const lx = 30 + i * 17 + (i % 3) * 5, ly = 120 + (i * 37) % 120; svgEl(lluvia, 'line', { x1: lx, y1: ly, x2: lx - 6, y2: ly + 16 }); }
    nubes.style.opacity = 0.35;
    const pintar = (n, ll) => {
      nubes.style.opacity = f(n / 100);
      lluvia.style.opacity = ll ? 0.85 : 0;
      let r;
      if (ll && n >= 50) r = t('Cuando el Pico cubre el cabello, chicas del Ulla, poned el pañuelo.');
      else if (n >= 50) r = t('Cuando el Pico pone toquilla, agua tenemos, mucha o poquilla.');
      else if (n >= 20) r = t('El Pico asoma entre nubes: buen rato para subir, con chaqueta.');
      else if (S.solAhora(new Date()).alt < -6) r = t('Noche despejada sobre el Pico: su cima es un mirador de estrellas.');
      else r = t('Hoy el Pico está despejado: desde la cima se ven unos 30 km a la redonda.');
      $('#pico-refran').textContent = r;
      dato.textContent = ll ? t('Nubes bajas en la cumbre: {n} % · está lloviendo.', { n }) : t('Nubes bajas en la cumbre: {n} %.', { n });
      ultimaNube = [n, ll];
      if (tres) tres.nubes(n, ll);
    };
    const ahora = async () => {
      try {
        const c = new AbortController(); const x = setTimeout(() => c.abort(), 8000);
        const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.8072&longitude=-8.4469&current=cloud_cover_low,precipitation&timezone=Europe%2FMadrid', { signal: c.signal });
        clearTimeout(x);
        const j = await r.json();
        fuente.textContent = t('El Pico · dato de las {hora}', { hora: j.current.time.slice(11) });   // Open-Meteo da tramos de 15 min
        pintar(Math.round(j.current.cloud_cover_low), j.current.precipitation > 0);
      } catch (e) {
        fuente.textContent = t('El Pico Sacro');
        dato.textContent = t('Ahora no llega el tiempo de la cumbre.');
      }
    };
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); ahora(); } }, { rootMargin: '300px 0px' }).observe(svg);

    // el Pico en 3D con datos del IGN: se carga al acercarse y solo si el navegador puede; si no, sigue el dibujo
    const vista = $('#pico-vista');
    const puede3D = (() => { try { const cv = document.createElement('canvas'); return !!(cv.getContext('webgl2') || cv.getContext('webgl')); } catch (e) { return false; } })() && !(navigator.connection && navigator.connection.saveData);
    if (puede3D && vista) new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      import('./pico3d.js')
        .then((m) => m.montar(vista, { S, colores: (alt) => tramo(CIELO, alt), lunaPath, movil: !fino, raiz: R, t }))
        .then((t3) => {
          tres = t3;
          vista.classList.add('con-3d');
          t3.actualizar(new Date());
          if (ultimaNube) t3.nubes(...ultimaNube);
          const mando3d = $('#pico-mando3d'), girar = $('#pico-girar'), pista = $('#pico-pista');
          mando3d.hidden = false; $('#pico-fuente3d').hidden = false;
          const pistas = (si) => (si ? (fino ? t('Arrastra para girar; la rueda acerca y aleja.') : t('Un dedo gira, dos dedos acercan.')) : (fino ? t('Arrastra para girar el monte.') : t('Pulsa «Girar el monte» para moverlo con el dedo.')));
          pista.textContent = pistas(false);
          girar.addEventListener('click', () => { const si = girar.getAttribute('aria-pressed') !== 'true'; girar.setAttribute('aria-pressed', String(si)); girar.textContent = si ? t('Listo') : t('Girar el monte'); t3.activar(si); pista.textContent = pistas(si); });
          $('#pico-volver').addEventListener('click', () => t3.volver());
          // 2D ↔ 3D: el dibujo enseña el arco del sol de hoy y los puntos cardinales; el 3D, el terreno real
          const modo = $('#pico-modo'), volverB = $('#pico-volver'), fuente3d = $('#pico-fuente3d');
          modo.addEventListener('click', () => {
            const dibujo = vista.classList.contains('con-3d');   // si ahora se ve el 3D, se pasa al dibujo
            vista.classList.toggle('con-3d', !dibujo);
            modo.setAttribute('aria-pressed', String(dibujo));
            modo.textContent = dibujo ? t('Ver en 3D') : t('Ver el dibujo');
            girar.hidden = volverB.hidden = fuente3d.hidden = dibujo;
            if (dibujo && girar.getAttribute('aria-pressed') === 'true') girar.click();
            pista.textContent = dibujo ? t('El dibujo: el camino del sol de hoy, de este a oeste.') : pistas(false);
            if (!dibujo) t3.actualizar(new Date());
          });
          window.__pico3d = t3;
        })
        .catch((e) => { console.warn('El Pico en 3D no está disponible:', e); });
    }, { rootMargin: '600px 0px' }).observe(vista);
    // las leyendas del Pico están en /pico-sacro-v2/ (el panel de comun.js)
  })();

  /* ============ 4. dos casas en una: el anillo del año ============ */
  (function anyo() {
    const svg = $('#anyo-rueda');
    if (!svg) return;
    if (!CASA) return;
    // los doce meses en el idioma de la página, con mayúscula («Enero»); las tres primeras letras, en el anillo y los botones
    const fMes = new Intl.DateTimeFormat(idioma, { month: 'long', timeZone: 'UTC' });
    const MESES = Array.from({ length: 12 }, (x, m) => mayus(fMes.format(Date.UTC(2001, m, 15))));
    // «MM-DD» → mes 0-11 con decimales, redondeado a 0,05: el principio de un día
    // (06-01 → 5) o, con `fin`, su final (09-20 → 8,65; 10-31 → 10)
    const mesDecimal = (mmdd, fin) => {
      const [m, d] = mmdd.split('-').map(Number);
      const dias = new Date(2001, m, 0).getDate();
      return Math.round((m - 1 + (fin ? d : d - 1) / dias) * 20) / 20;
    };
    // [desde, hasta (exclusivo)]; si cruza el año, hasta pasa de 12
    const tramo = ({ desde, hasta }) => { const a = mesDecimal(desde), b = mesDecimal(hasta, true); return [a, b <= a ? b + 12 : b]; };
    const T = CASA.temporadas, E = CASA.precios.entera;
    const desdeMin = Math.min(...Object.values(CASA.precios.desde));
    // [nombre, desde (mes 0-11, con decimales), hasta (exclusivo), color, grupo]
    const V = [
      [t('Habitaciones con desayuno'), ...tramo(T.habitaciones), '#cfa865', 'casa'],
      [t('La casa entera, hasta {plazas}', { plazas: E.plazas }), ...tramo(T.entera), '#f3eee4', 'casa'],
      [t('Piscina de agua salada'), ...tramo(CASA.piscina), '#7fb0a5', 'finca'],
      [t('Camelias'), 11, 16, '#c23b55', 'finca'],
      [t('Hortensias'), 5, 9, '#7d9ad6', 'finca'],
      [t('Tomates y maracuyá'), 5, 9, '#e0794a', 'finca'],
      [t('Higos y manzanas'), 7, 10, '#b4c46a', 'finca'],
      [t('Kiwis y naranjas'), 10, 14, '#d6a24a', 'finca'],
    ];
    const activo = (v, m) => { const c = m + 0.5; return (c >= v[1] && c < v[2]) || (c + 12 >= v[1] && c + 12 < v[2]); };
    const cx = 220, cy = 220;
    const pol = (r, mes) => { const a = (mes / 12) * 2 * Math.PI - Math.PI / 2; return [f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a))]; };
    const arco = (r, a0, a1) => { const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 6 ? 1 : 0} 1 ${x1} ${y1}`; };
    const cuna = (r0, r1, m) => { const a = pol(r1, m), b = pol(r1, m + 1), c = pol(r0, m + 1), d = pol(r0, m); return `M${a} A${r1} ${r1} 0 0 1 ${b} L${c} A${r0} ${r0} 0 0 0 ${d} Z`; };
    const realce = svgEl(svg, 'path', { fill: 'rgba(243,238,228,.1)' });
    V.forEach((v, i) => {
      const r = 180 - i * 14;
      svgEl(svg, 'circle', { cx, cy, r, fill: 'none', stroke: 'rgba(243,238,228,.07)', 'stroke-width': 9 });
      svgEl(svg, 'path', { d: arco(r, v[1], v[2]), fill: 'none', stroke: v[3], 'stroke-width': 9, 'stroke-linecap': 'round' });
    });
    MESES.forEach((m, i) => { const [x, y] = pol(204, i + 0.5); svgEl(svg, 'text', { x, y: f(+y + 4), 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Hanken Grotesk, sans-serif', 'font-weight': 600, fill: '#c9c2b4', 'letter-spacing': '.08em' }, m.slice(0, 3).toLocaleUpperCase(idioma)); });
    const centro = svgEl(svg, 'text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 30, 'font-family': 'Instrument Serif, Georgia, serif', fill: '#f3eee4' });
    const sub = svgEl(svg, 'text', { x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Hanken Grotesk, sans-serif', fill: '#c9c2b4' });
    const botones = $('#anyo-meses');
    const elegir = (m, desdeUsuario) => {
      realce.setAttribute('d', cuna(48, 192, m));
      centro.textContent = MESES[m];
      const habs = activo(V[0], m);
      sub.textContent = habs ? t('Habitaciones') : t('Casa entera');
      $('#anyo-mes').textContent = MESES[m];
      $('#anyo-modo').textContent = habs
        ? t('Habitaciones con desayuno, desde {precio} € la noche', { precio: fEntero.format(desdeMin) })
        : t('La casa grande entera, hasta {plazas} personas: {una} € una noche, {dos} € dos', { plazas: E.plazas, una: fEntero.format(E.una), dos: fEntero.format(E.dos) });
      const ul = $('#anyo-finca'); ul.textContent = '';
      V.filter((v) => v[4] === 'finca' && activo(v, m)).forEach((v) => {
        const li = document.createElement('li'); const i = document.createElement('i'); i.style.setProperty('--c', v[3]);
        li.append(i, v[0]); ul.appendChild(li);
      });
      if (!ul.children.length) { const li = document.createElement('li'); li.textContent = t('El jardín descansa: estanque, cascadas y huerta.'); ul.appendChild(li); }
      $$('button', botones).forEach((b, i) => b.setAttribute('aria-pressed', String(i === m)));
      if (desdeUsuario && window.CASALmotor) window.CASALmotor.irMes(m);
    };
    MESES.forEach((n, m) => {
      const s = svgEl(svg, 'path', { d: cuna(48, 192, m), class: 'sector', 'aria-hidden': 'true' });
      s.addEventListener('click', () => elegir(m, true));
      const b = document.createElement('button'); b.type = 'button'; b.textContent = n.slice(0, 3); b.setAttribute('aria-label', n);
      b.addEventListener('click', () => elegir(m, true)); botones.appendChild(b);
    });
    elegir(new Date().getMonth(), false);
  })();

  /* ============ 5. cortina: el tejado se traza y la casa se abre desde la cumbrera ============
     Una vez por sesión (spec 001 §3.1.7): si el script del <head> ya puso
     cortina-fuera (marca en sessionStorage o llegada con ancla), no se ve. */
  const cortina = $('#cortina');
  const hero = $('#hero');
  const MARCA_CORTINA = 'cdc-cortina';
  function retirarCortina() {
    clearTimeout(window.__redCortina);
    if (cortina) cortina.hidden = true;
    const vista = raiz.classList.contains('cortina-activa');   // solo cuenta como vista la que se animó (no una llegada con ancla)
    raiz.classList.remove('cortina-activa');
    raiz.classList.add('cortina-fuera');
    if (vista) try { sessionStorage.setItem(MARCA_CORTINA, '1'); } catch (e) {}   // si falla, la próxima vez sale otra vez, como antes
    if (C.lenis) C.lenis.start();
    if (hayGSAP) ScrollTrigger.refresh();
    C.mostrarCookies();
    C.anclar();
  }
  function abrirHero() {
    if (hero) hero.classList.add('abierta');
    const h = $('.hero [data-partir]');
    if (h && motion) h.classList.add('es-visto');
  }
  function lanzarCortina() {
    // ya vista en esta sesión, con ancla, sin GSAP, con movimiento reducido o si el CDN tardó (> 2,5 s): fuera sin animar
    if (!cortina || raiz.classList.contains('cortina-fuera') || !motion || performance.now() > 2500) { retirarCortina(); abrirHero(); return; }
    raiz.classList.add('cortina-activa');
    if (C.lenis) C.lenis.stop();
    const tejado = $('.cortina__tejado', cortina), entero = $('.cortina__entero', cortina), logo = $('#cortina-logo');
    const listo = Promise.race([Promise.all([tejado, entero].map((im) => im.decode ? im.decode().catch(() => {}) : Promise.resolve())), new Promise((r) => setTimeout(r, 1200))]);
    listo.then(() => {
      const est = { p: 0 };
      gsap.timeline({ onComplete: retirarCortina })
        .fromTo(tejado, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power2.inOut' })
        .fromTo(entero, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, '-=0.15')
        .add(abrirHero, '+=0.35')
        .to(logo, { yPercent: -30, opacity: 0, duration: 0.8, ease: 'expo.in' }, '<')
        .to(est, { p: 1, duration: 1.25, ease: 'expo.inOut', autoRound: false, onUpdate: () => cortina.style.setProperty('--p', f(est.p)) }, '<0.1');
    });
  }

  /* ============ 6. el mapa de Google al pedirlo está en comun.js (spec 002: también en /contactar/) ============ */

  /* ============ 7. MANDO DE MAQUETA (no viaja al cliente) ============ */
  const mando = $('#mando');
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === raiz.classList.contains('densidad-sobria'))));
    botones.forEach((b) => b.addEventListener('click', () => {
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (hayGSAP) ScrollTrigger.refresh();
    }));
    pintarMando();
    C.verMando();
  }
  /* fin del MANDO DE MAQUETA */

  // la cortina arranca al final: cuando se retira usa las cookies, la barra y la cabecera
  lanzarCortina();

  /* ============ 8. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => { anchoVista = innerWidth; altoVista = innerHeight; if (hayGSAP) ScrollTrigger.refresh(); }, 200);
  });
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
  window.__casal = { gablete, estancias };
})();
