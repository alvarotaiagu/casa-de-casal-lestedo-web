/* ------------------------------------------------------------------
   Casa de Casal · Lestedo · «Bajo el tejado de la C»
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const hayGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino = matchMedia('(pointer: fine)').matches;
  // «con-movimiento» SOLO con GSAP y sin movimiento reducido: si no, los titulares partidos se quedarían escondidos
  const motion = hayGSAP && !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  if (hayGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    // el resize lo gestionamos nosotros (la barra del móvil no rehace nada)
    ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load', ignoreMobileResize: true });
  }

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const f = (n) => Math.round(n * 100) / 100;
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (padre, t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; padre.appendChild(e); return e; };
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => !fino && innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares partidos y entradas ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/([ \t\r\n]+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) Array.from(nodo.childNodes).forEach(envolver);
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  const vistos = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  if (motion) {
    $$('[data-partir]').forEach((h) => { partir(h); if (!h.closest('.hero')) vistos.observe(h); });
    $$('[data-revela]').forEach((el, i) => { el.style.setProperty('--d', i % 3); vistos.observe(el); });
    $$('.sec-cab').forEach((el) => vistos.observe(el));
  }

  /* ============ 2. Lenis ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); }
    else { const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); }; requestAnimationFrame(bucle); }
  }
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - 80;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };
  window.CASAL = { irA };

  /* ============ 3. el gablete de la portada: deslizar lo que hay bajo el tejado ============
     Gesto propio: arrastrar de lado (dedo o ratón). Con touch-action: pan-y,
     el dedo de arriba abajo sigue haciendo scroll. Flechas del teclado y botones. */
  const gablete = (function () {
    const caja = $('#gablete');
    if (!caja) return null;
    const fotos = $$('.gablete__foto', caja), puntos = $$('#gablete-puntos button'), pie = $('#gablete-pie');
    let i = 0;
    const preparar = () => fotos.forEach((fo) => fo.classList.add('lista'));
    if (document.readyState === 'complete') setTimeout(preparar, 300);
    else addEventListener('load', () => (window.requestIdleCallback ? requestIdleCallback(preparar, { timeout: 1500 }) : setTimeout(preparar, 300)));
    const ir = (n) => {
      preparar();
      i = (n + fotos.length) % fotos.length;
      fotos.forEach((fo, k) => fo.classList.toggle('on', k === i));
      puntos.forEach((p, k) => p.setAttribute('aria-current', k === i ? 'true' : 'false'));
      pie.textContent = $('figcaption', fotos[i]).textContent;
    };
    ir(0);
    $$('.gablete__btn').forEach((b) => b.addEventListener('click', () => ir(i + +b.dataset.dir)));
    puntos.forEach((p) => p.addEventListener('click', () => ir(+p.dataset.ir)));
    caja.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
    });
    // arrastre: la foto actual se aparta y la siguiente asoma; al soltar, decide por distancia
    let x0 = null, y0 = 0, dx = 0, id = null, lateral = false;
    caja.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; lateral = false;
    });
    caja.addEventListener('pointermove', (e) => {
      if (x0 === null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (!lateral && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) {
        lateral = true; caja.classList.add('arrastra');
        try { caja.setPointerCapture(id); } catch (er) {}
      }
      if (!lateral) return;
      const p = limitar(dx / caja.clientWidth, -1, 1), sig = fotos[(i + (dx < 0 ? 1 : -1) + fotos.length) % fotos.length];
      fotos.forEach((fo) => { if (fo !== fotos[i] && fo !== sig) fo.style.opacity = 0; });
      fotos[i].style.opacity = f(1 - Math.abs(p) * 0.9);
      sig.style.opacity = f(Math.abs(p) * 1.2);
    });
    const soltar = (e) => {
      if (x0 === null || (e && e.pointerId !== id)) return;
      caja.classList.remove('arrastra');
      fotos.forEach((fo) => { fo.style.opacity = ''; });
      if (lateral && Math.abs(dx) > Math.min(90, caja.clientWidth * 0.18)) ir(i + (dx < 0 ? 1 : -1));
      x0 = null; lateral = false;
    };
    caja.addEventListener('pointerup', soltar);
    caja.addEventListener('pointercancel', soltar);
    return { ir, actual: () => i };
  })();

  /* ============ 4. bajo el tejado: la casa en sección y los tipos ============ */
  (function seccion() {
    const caja = $('.seccion');
    if (!caja) return;
    const Z = {
      pequena: { n: 'Casa Pequena do Casal', p: 'Casita aparte · para dos', t: 'El antiguo cobertizo de juegos, hecho casita de 50 m². La cama de 1,60 duerme bajo la lareira, donde antes estaba el fuego. Cocina, suelo radiante y jardín propio con pérgola y barbacoa.', pr: '', foto: 'pequena-cama', ir: '#pequena', boton: 'Ver la Casa Pequena' },
      galeria: { n: 'Salón con galería', p: 'Primera planta · estancia común', t: 'Un rincón para el aperitivo mientras miras el valle del Ulla. Si lo pides, el desayuno llega en bandeja.', pr: '', foto: 'portada-galeria' },
      confort: { n: 'Confort', p: 'Primera planta · vistas al valle', t: 'Vistas al valle del Ulla desde la ventana, cama de 1,50, paredes de piedra y muebles tallados a mano.', pr: '68', foto: 'hab-confort', tipo: 'confort' },
      terraza: { n: 'Con terraza', p: 'Primera planta · terraza de 12 m²', t: 'La más luminosa: muebles blancos, detalles en verde y una terraza privada para las tardes de verano.', pr: '75', foto: 'hab-terraza', tipo: 'terraza' },
      torre: { n: 'La Torre', p: 'Primera planta · balcón', t: 'Asómate al balcón: una de las mejores vistas de la casa. Las dos camas de 1,05 se juntan en una de 2,10 × 1,90, y cabe una supletoria.', pr: '70', foto: 'hab-torre', w: 675, tipo: 'torre' },
      familiar: { n: 'Pico Sacro', p: 'Familiar · 2 adultos y 2 niños', t: 'Dos camas de matrimonio para quien viaja con niños pequeños. En la casa hay tronas, cunas de madera y un microondas en el comedor.', pr: '85', foto: 'hab-familiar', tipo: 'familiar' },
      comedor: { n: 'El comedor', p: 'Planta baja · hasta 30 personas', t: 'Tranquilo y amplio. Aquí se sirve el desayuno casero: pan de pueblo con tomate, bizcochos, queso de Arzúa, zumo recién exprimido y huevos de su corral.', pr: '', foto: 'comedor', ir: '#mesa', boton: 'Ver el desayuno' },
      chimenea: { n: 'Recibidor con chimenea', p: 'Planta baja · la entrada', t: 'La escalera de madera y la chimenea encendida en invierno. Al lado, la peña: una estancia cuyo suelo es la propia roca.', pr: '', foto: 'chimenea' },
      clasicas: { n: 'Clásicas', p: 'Planta baja · sin escaleras', t: 'Para quien prefiere no subir escaleras. Aquí está la habitación con baño adaptado. La opción más económica, con los mismos servicios.', pr: '58', foto: 'hab-clasica', tipo: 'clasica' },
    };
    const zonas = $$('.zona', caja), btn = $('#sp-reservar');
    let actual = null;
    const elegir = (g) => {
      zonas.forEach((z) => z.classList.toggle('activa', z === g));
      const d = Z[g.dataset.k];
      actual = d;
      const img = $('#sp-foto');
      img.src = `img/fotos/${d.foto}-480.jpg`;
      img.srcset = `img/fotos/${d.foto}-480.jpg 480w, img/fotos/${d.foto}-${d.w || 800}.jpg ${d.w || 800}w`;
      img.sizes = '(max-width: 899px) 92vw, 34vw';
      img.alt = '';
      $('#sp-nombre').textContent = d.n;
      $('#sp-planta').textContent = d.p;
      $('#sp-texto').textContent = d.t;
      $('#sp-precio').innerHTML = d.pr ? `<b>${d.pr} €</b> desde, por noche` : 'Estancia común';
      btn.hidden = !(d.tipo || d.ir);
      btn.textContent = d.tipo ? `Ver fechas de ${d.n}` : (d.boton || '');
    };
    zonas.forEach((g) => {
      g.addEventListener('click', () => elegir(g));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(g); } });
    });
    btn.addEventListener('click', () => {
      if (!actual) return;
      if (actual.tipo) reservarTipo(actual.tipo);
      else if (actual.ir) irA(actual.ir);
    });
    elegir($('.zona[data-k="torre"]'));
    // el tejado del dibujo se traza al llegar
    if (motion) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { caja.classList.add('es-trazada'); o.disconnect(); } }, { threshold: 0.3 }).observe(caja);
    else caja.classList.add('es-trazada');
  })();
  function reservarTipo(id) {
    if (window.CASALmotor) window.CASALmotor.elegirTipo(id);
    irA('#motor');
  }
  $$('[data-reservar]').forEach((b) => b.addEventListener('click', () => reservarTipo(b.dataset.reservar)));

  /* ============ 5. el Pico, hoy ============ */
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
    const fecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    svgEl(marcas, 'text', { x: f(xc + 14), y: f(yc - 14), 'font-weight': 600 }, 'Pico Sacro · 533 m');
    // el camino del sol hoy, de la salida a la puesta (cada 10 min)
    const arco = [];
    for (let m = 0; m < 24 * 60; m += 1) {   // cada minuto: las horas de «sale» y «se pone» cuadran con el texto
      const t = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, m));
      const p = S.solAhora(t);
      if (p.alt > -0.833) arco.push([f(xRumbo(p.az)), f(yAlt(p.alt)), t]);
    }
    if (arco.length > 1) {
      svgEl(marcas, 'polyline', { points: arco.filter((p, i) => i % 10 === 0 || i === arco.length - 1).map((p) => p[0] + ',' + p[1]).join(' '), fill: 'none', stroke: '#c07a2a', 'stroke-width': 1.5, 'stroke-dasharray': '3 6', opacity: 0.75 });
      const [xs] = arco[0], [xp] = arco[arco.length - 1];
      const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
      svgEl(marcas, 'text', { x: f(xs + 8), y: f(yCresta(xs) - 10), 'font-weight': 600 }, 'sale ' + hora.format(arco[0][2]));
      svgEl(marcas, 'text', { x: f(xp - 8), y: f(yCresta(xp) - 10), 'font-weight': 600, 'text-anchor': 'end' }, 'se pone ' + hora.format(arco[arco.length - 1][2]));
    }
    const az = S.rumbo(-0.833, S.decl(dHoy));
    // puntos cardinales, sobre la tierra
    const card = svgEl(svg, 'g', { 'font-family': 'Hanken Grotesk, sans-serif', 'font-size': 12, 'font-weight': 600, fill: '#c9d2d6', 'text-anchor': 'middle', 'letter-spacing': '.1em', 'aria-hidden': 'true' });
    [['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270]].forEach(([t, a]) => svgEl(card, 'text', { x: f(xRumbo(a)), y: 330 }, t));

    /* el cielo de ahora en Lestedo: luz según la altura real del sol, sol y luna en su sitio real, estrellas de noche */
    const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const mezcla = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
    const tramo = (tabla, h) => {           // interpola una tabla [altura del sol, colores…]
      if (h <= tabla[0][0]) return tabla[0].slice(1);
      for (let i = 1; i < tabla.length; i++) if (h <= tabla[i][0]) { const t = (h - tabla[i - 1][0]) / (tabla[i][0] - tabla[i - 1][0]); return tabla[i].slice(1).map((c, k) => mezcla(tabla[i - 1][k + 1], c, t)); }
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
    const nombreFase = (luz, fase) => (luz < 0.03 ? 'luna nueva' : luz > 0.97 ? 'luna llena' : fase < 0.5 ? (luz < 0.5 ? 'luna creciente' : 'luna creciente, casi llena') : (luz < 0.5 ? 'luna menguante' : 'luna menguante, recién pasada la llena'));
    const hhmm = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    const rumboTxt = (a) => ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(a / 45) % 8];
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
      const momento = sol.alt > 6 ? 'es de día' : sol.alt > 0 ? (manana ? 'acaba de amanecer' : 'atardece') : sol.alt > -6 ? (manana ? 'está amaneciendo' : 'anochece') : 'es de noche';
      const lunaTxt = `${nombreFase(luna.luz, luna.fase)} (${Math.round(luna.luz * 100)} % iluminada), ${luna.alt > 0 ? 'sobre el horizonte, hacia el ' + rumboTxt(luna.az) : 'bajo el horizonte'}`;
      $('#pico-cielo-txt').textContent = `Ahora, a las ${hhmm.format(ahora)}, en Lestedo ${momento}. ${lunaTxt[0].toUpperCase() + lunaTxt.slice(1)}.`;
      if (tres) tres.actualizar(ahora);
      return { solAlt: sol.alt, solVe, lunaVe, luz: luna.luz, fase: luna.fase, cielo: c0, estrellas: +estrellas.style.opacity };
    }
    window.__cielo = (fecha) => pintarCielo(fecha ? new Date(fecha) : new Date());
    pintarCielo(new Date());
    // cada minuto, solo mientras la sección se ve
    let reloj = 0;
    new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !reloj) { pintarCielo(new Date()); reloj = setInterval(() => pintarCielo(new Date()), 60000); }
      else if (!es[0].isIntersecting && reloj) { clearInterval(reloj); reloj = 0; }
    }).observe(svg);
    $('#pico-hora').textContent = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(S.salida(dHoy));
    const dif = az - S.PICO;
    $('#pico-rumbo').textContent = Math.abs(dif) < S.ANCHO ? 'justo por detrás del Pico.' : (dif > 0 ? 'a la derecha' : 'a la izquierda') + ' del Pico (rumbo ' + Math.round(az) + '°).';
    const tr = S.tramos(hoy.getFullYear()).map(([a, b]) => 'del ' + fecha.format(a) + ' al ' + fecha.format(b));
    $('#pico-tramos').textContent = 'Por detrás del Pico, ' + tr.join(' y ') + '.';

    // el tiempo de ahora en la cumbre (Open-Meteo), al llegar a la sección. Solo dato real: si no llega, una frase neutra
    const fuente = $('#pico-fuente'), dato = $('#pico-dato'), nubes = $('#pico-nubes'), lluvia = $('#pico-lluvia');
    for (let i = 0; i < 46; i++) { const lx = 30 + i * 17 + (i % 3) * 5, ly = 120 + (i * 37) % 120; svgEl(lluvia, 'line', { x1: lx, y1: ly, x2: lx - 6, y2: ly + 16 }); }
    nubes.style.opacity = 0.35;
    const pintar = (n, ll) => {
      nubes.style.opacity = f(n / 100);
      lluvia.style.opacity = ll ? 0.85 : 0;
      let r;
      if (ll && n >= 50) r = 'Cuando el Pico cubre el cabello, chicas del Ulla, poned el pañuelo.';
      else if (n >= 50) r = 'Cuando el Pico pone toquilla, agua tenemos, mucha o poquilla.';
      else if (n >= 20) r = 'El Pico asoma entre nubes: buen rato para subir, con chaqueta.';
      else if (S.solAhora(new Date()).alt < -6) r = 'Noche despejada sobre el Pico: su cima es un mirador de estrellas.';
      else r = 'Hoy el Pico está despejado: desde la cima se ven unos 30 km a la redonda.';
      $('#pico-refran').textContent = r;
      dato.textContent = `Nubes bajas en la cumbre: ${n} %${ll ? ' · está lloviendo' : ''}.`;
      ultimaNube = [n, ll];
      if (tres) tres.nubes(n, ll);
    };
    const ahora = async () => {
      try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
        const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.8072&longitude=-8.4469&current=cloud_cover_low,precipitation&timezone=Europe%2FMadrid', { signal: c.signal });
        clearTimeout(t);
        const j = await r.json();
        fuente.textContent = 'El Pico · dato de las ' + j.current.time.slice(11);   // Open-Meteo da tramos de 15 min
        pintar(Math.round(j.current.cloud_cover_low), j.current.precipitation > 0);
      } catch (e) {
        fuente.textContent = 'El Pico Sacro';
        dato.textContent = 'Ahora no llega el tiempo de la cumbre.';
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
        .then((m) => m.montar(vista, { S, colores: (alt) => tramo(CIELO, alt), lunaPath, movil: !fino }))
        .then((t) => {
          tres = t;
          vista.classList.add('con-3d');
          t.actualizar(new Date());
          if (ultimaNube) t.nubes(...ultimaNube);
          const mando3d = $('#pico-mando3d'), girar = $('#pico-girar'), pista = $('#pico-pista');
          mando3d.hidden = false; $('#pico-fuente3d').hidden = false;
          const pistas = (si) => (si ? (fino ? 'Arrastra para girar; la rueda acerca y aleja.' : 'Un dedo gira, dos dedos acercan.') : (fino ? 'Arrastra para girar el monte.' : 'Pulsa «Girar el monte» para moverlo con el dedo.'));
          pista.textContent = pistas(false);
          girar.addEventListener('click', () => { const si = girar.getAttribute('aria-pressed') !== 'true'; girar.setAttribute('aria-pressed', String(si)); girar.textContent = si ? 'Listo' : 'Girar el monte'; t.activar(si); pista.textContent = pistas(si); });
          $('#pico-volver').addEventListener('click', () => t.volver());
          window.__pico3d = t;
        })
        .catch((e) => { console.warn('El Pico en 3D no está disponible:', e); });
    }, { rootMargin: '600px 0px' }).observe(vista);

    // leyendas: resumidas de sus páginas del Pico Sacro y de «Nuestro camino»
    const L = [
      ['La Reina Lupa', 'Los discípulos del Apóstol pararon en este monte para pedirle a la Reina Lupa unos bueyes y un carro con que llevar su cuerpo. Ella, aliada de los romanos, los mandó al bosque donde vivía un dragón.'],
      ['El dragón del monte Ilicino', 'Este cuento podría haber acabado mal, pero el dragón cayó con las plegarias de los discípulos. La reina, al ver el milagro, se convirtió al cristianismo.'],
      ['El paso de la Reina Lupa', 'La cumbre está partida en dos por un corte vertical. Dicen que lo abrió un gigante con su espada; otros, que era la puerta del palacio de la reina.'],
      ['Las cuevas', 'Nadie sabe bien quién las hizo: unos dicen que los romanos, buscando oro, y otros que son naturales. A los niños les encanta la primera, porque se puede entrar un poco.'],
      ['Los mouros', 'A lo largo de los siglos el Pico ha sido el centro de muchas leyendas: desde gigantes que vivían en su interior hasta historias de moros escondidos en sus entrañas.'],
      ['Los refranes del tiempo', 'Cuando el Pico pone toquilla, agua tenemos, mucha o poquilla. En el valle del Ulla se mira al monte para saber si va a llover, y hay un refrán para cada nube.'],
    ];
    const lista = $('#leyendas-lista'), hoja = $('#leyendas-hoja');
    const elegir = (i, foco) => {
      $$('button', lista).forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      const [t, x] = L[i];
      $('#leyendas-cap').textContent = x[0];
      $('#leyendas-tit').textContent = t;
      $('#leyendas-txt').textContent = x.slice(1);
      $('#leyendas-txt').setAttribute('aria-label', x);
      if (motion) { hoja.classList.remove('entra'); void hoja.offsetWidth; hoja.classList.add('entra'); }
      if (foco) lista.children[i].focus();
    };
    L.forEach(([t], i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'leyenda-' + i; b.setAttribute('aria-controls', 'leyendas-hoja'); b.textContent = t;
      b.addEventListener('click', () => elegir(i));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); elegir((i + 1) % L.length, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); elegir((i + L.length - 1) % L.length, true); }
      });
      lista.appendChild(b);
    });
    elegir(0);
  })();

  /* ============ 6. dos casas en una: el anillo del año ============ */
  (function anyo() {
    const svg = $('#anyo-rueda');
    if (!svg) return;
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    // [nombre, desde (mes 0-11, con decimales), hasta (exclusivo), color, grupo]
    const V = [
      ['Habitaciones con desayuno', 3, 10, '#cfa865', 'casa'],
      ['La casa entera, hasta 22', 10, 15, '#f3eee4', 'casa'],
      ['Piscina de agua salada', 5, 8.5, '#7fb0a5', 'finca'],
      ['Camelias', 11, 16, '#c23b55', 'finca'],
      ['Glicinias del aparcamiento', 3, 5, '#a594d6', 'finca'],
      ['Hortensias', 5, 9, '#7d9ad6', 'finca'],
      ['Tomates y maracuyá', 5, 9, '#e0794a', 'finca'],
      ['Higos y manzanas', 7, 10, '#b4c46a', 'finca'],
      ['Kiwis y naranjas', 10, 14, '#d6a24a', 'finca'],
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
    MESES.forEach((m, i) => { const [x, y] = pol(204, i + 0.5); svgEl(svg, 'text', { x, y: f(+y + 4), 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Hanken Grotesk, sans-serif', 'font-weight': 600, fill: '#c9c2b4', 'letter-spacing': '.08em' }, m.slice(0, 3).toUpperCase()); });
    const centro = svgEl(svg, 'text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 30, 'font-family': 'Instrument Serif, Georgia, serif', fill: '#f3eee4' });
    const sub = svgEl(svg, 'text', { x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Hanken Grotesk, sans-serif', fill: '#c9c2b4' });
    const botones = $('#anyo-meses');
    const elegir = (m, desdeUsuario) => {
      realce.setAttribute('d', cuna(48, 192, m));
      centro.textContent = MESES[m];
      const habs = activo(V[0], m);
      sub.textContent = habs ? 'Habitaciones' : 'Casa entera';
      $('#anyo-mes').textContent = MESES[m];
      $('#anyo-modo').textContent = habs ? 'Habitaciones con desayuno, desde 58 € la noche' : 'La casa grande entera, hasta 22 personas: 675 € una noche, 1.190 € dos';
      const ul = $('#anyo-finca'); ul.textContent = '';
      V.filter((v) => v[4] === 'finca' && activo(v, m)).forEach((v) => {
        const li = document.createElement('li'); const i = document.createElement('i'); i.style.setProperty('--c', v[3]);
        li.append(i, v[0] + (v[0].startsWith('Piscina') && m === 8 ? ' (hasta el 15)' : '')); ul.appendChild(li);
      });
      if (!ul.children.length) { const li = document.createElement('li'); li.textContent = 'El jardín descansa: estanque, cascadas y huerta.'; ul.appendChild(li); }
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

  /* ============ 7. alrededores: una regla de minutos ============ */
  (function regla() {
    const caja = $('#regla'), lista = $('#regla-lista');
    if (!caja) return;
    // minutos en coche. «casa»: lo dice su web; el resto, OSRM (16-10-2026)
    const P = [
      ['Pico Sacro', 7, 'a sus pies'], ['Ponte Ulla', 7, 'el río Ulla'], ['Pazo de Oca', 12, 'el Versalles gallego'],
      ['Santiago', 15, 'según la casa'], ['Aeropuerto', 25, 'según la casa'], ['Fervenza do Toxa', 25, '30 m de caída'],
      ['Carboeiro', 27, 'monasterio románico'], ['Rianxo', 46, 'la playa más cercana'], ['A Coruña', 62, ''],
    ];
    const MAX = 65, W = 1000, H = 150, y = 92;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    caja.appendChild(svg);
    const xm = (m) => 20 + (m / MAX) * (W - 40);
    svgEl(svg, 'line', { x1: xm(0), y1: y, x2: xm(MAX), y2: y, stroke: '#1b222b', 'stroke-width': 1.5 });
    for (let m = 0; m <= 60; m += 10) {
      svgEl(svg, 'line', { x1: xm(m), y1: y - 5, x2: xm(m), y2: y + 5, stroke: '#1b222b' });
      svgEl(svg, 'text', { x: xm(m), y: y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'Hanken Grotesk, sans-serif', fill: '#565a5e' }, m ? m + ' min' : 'casa');
    }
    // casa: el tejado de su C en miniatura
    svgEl(svg, 'path', { d: `M${xm(0) - 9} ${y - 2} L${xm(0)} ${y - 12} L${xm(0) + 9} ${y - 2}`, fill: 'none', stroke: '#a57d3a', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    const usados = [];
    P.forEach(([n, m]) => {
      const x = xm(m);
      let nivel = 0;
      while (usados.some((u) => u.nivel === nivel && Math.abs(u.x - x) < 120)) nivel++;
      usados.push({ x, nivel });
      const ly = y - 18 - nivel * 22;
      svgEl(svg, 'circle', { cx: x, cy: y, r: 4.5, fill: '#7d581e' });
      svgEl(svg, 'line', { x1: x, y1: y - 5, x2: x, y2: ly + 4, stroke: '#7d581e', 'stroke-width': 1, opacity: 0.5 });
      svgEl(svg, 'text', { x: x + 4, y: ly, 'font-size': 14.5, 'font-family': 'Hanken Grotesk, sans-serif', 'font-weight': 600, fill: '#1b222b', stroke: '#f3eee4', 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, `${n} · ${m}′`);
    });
    P.forEach(([n, m, nota]) => {
      const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = n;
      const s = document.createElement('span'); s.textContent = m + ' min' + (nota ? ' · ' + nota : '');
      li.append(b, s); lista.appendChild(li);
    });
  })();

  /* ============ 8. cortina: el tejado se traza y la casa se abre desde la cumbrera ============ */
  const cortina = $('#cortina');
  const hero = $('#hero');
  function retirarCortina() {
    clearTimeout(window.__redCortina);
    if (cortina) cortina.hidden = true;
    raiz.classList.remove('cortina-activa');
    raiz.classList.add('cortina-fuera');
    if (lenis) lenis.start();
    if (hayGSAP) ScrollTrigger.refresh();
    mostrarCookies();
  }
  function abrirHero() {
    hero.classList.add('abierta');
    const h = $('.hero [data-partir]');
    if (h && motion) h.classList.add('es-visto');
  }
  function lanzarCortina() {
    // sin GSAP, con movimiento reducido o si el CDN tardó (> 2,5 s): fuera sin animar
    if (!cortina || !motion || performance.now() > 2500) { retirarCortina(); abrirHero(); return; }
    raiz.classList.add('cortina-activa');
    if (lenis) lenis.stop();
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

  /* ============ 9. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const claras = $$('.clara, .pico');
  const lectura = $('.cab__lectura');
  let pendienteCab = 0;
  const alScroll = () => {
    pendienteCab = 0;
    cab.classList.toggle('sc', scrollY > 24);
    // el tejado de la cabecera se dora al bajar: es el indicador de lectura
    const total = document.documentElement.scrollHeight - innerHeight;
    lectura.style.setProperty('--p', total > 0 ? f(limitar(scrollY / total, 0, 1)) : 0);
    const y = cab.offsetHeight / 2;
    cab.classList.toggle('es-clara', claras.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
    cab.classList.toggle('es-oscura', !cab.classList.contains('es-clara'));
  };
  addEventListener('scroll', () => { if (!pendienteCab) pendienteCab = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
      setTimeout(() => {
        const t = $(destino);
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }, 900);
    });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 10. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'casal-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  setTimeout(() => { if (raiz.classList.contains('cortina-fuera')) mostrarCookies(); }, 6600);

  /* ============ 11. barra fija en el móvil (solo con observadores) ============ */
  (function barraMovil() {
    const barra = $('#barra');
    if (!barra) return;
    const movil = matchMedia('(max-width: 999px)');
    const dentro = { hero: true, consulta: false, pie: false };
    const pintar = () => {
      const ver = movil.matches && !dentro.hero && !dentro.consulta && !dentro.pie && !document.body.classList.contains('menu') && ck.hidden;
      barra.classList.toggle('es-visible', ver);
      barra.setAttribute('aria-hidden', String(!ver));
      $$('a', barra).forEach((a) => { a.tabIndex = ver ? 0 : -1; });
      raiz.classList.toggle('con-barra', ver);
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { dentro[e.target.dataset.barra] = e.isIntersecting; }); pintar(); });
    [['hero', '.hero'], ['consulta', '#motor'], ['pie', '#pie']].forEach(([k, s]) => { const el = $(s); if (el) { el.dataset.barra = k; io.observe(el); } });
    const mo = new MutationObserver(pintar);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mo.observe(ck, { attributes: true, attributeFilter: ['hidden'] });
    movil.addEventListener('change', pintar);
    pintar();
  })();

  /* ============ 12. mapa de Google solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('42.80472,-8.46366 (Casa de Casal)') + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Casa de Casal en Lestedo';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 13. pie: el tejado se posa sobre la C ============ */
  (function pie() {
    const p = $('#pie');
    if (!motion) { p.classList.add('es-posado'); return; }
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { p.classList.add('es-posado'); o.disconnect(); } }, { threshold: 0.4 }).observe($('.pie__marca'));
  })();

  /* ============ 14. MANDO DE MAQUETA (no viaja al cliente) ============ */
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
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  // la cortina arranca al final: cuando se retira usa las cookies, la barra y la cabecera
  lanzarCortina();

  /* ============ 15. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => { anchoVista = innerWidth; altoVista = innerHeight; if (hayGSAP) ScrollTrigger.refresh(); }, 200);
  });
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
  window.__casal = { gablete };
})();
