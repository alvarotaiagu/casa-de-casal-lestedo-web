/* ------------------------------------------------------------------
   Casa de Casal · comun.js
   Lo que llevan todas las páginas (spec 001 §3.1.4 bis): t(), cabecera,
   menú, indicador de lectura, anclas, cookies, barra del móvil, pie y las
   piezas que se reutilizan (carrusel, panel de leyendas, regla de
   minutos, PD-7, y el mapa de Google al pedirlo, spec 002). Lo propio de
   la portada está en main.js.
   Cada módulo empieza comprobando que existe su elemento: si no, nada.
   Deja en window.CASAL lo que usan main.js y reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const R = raiz.dataset.raiz || './';            // raíz relativa de la página: toda ruta propia empieza aquí
  const idioma = raiz.lang || 'es';
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

  /* ============ t(): todo texto que pinta el JS (spec 001 §3.1.11, PD-6) ============
     t('Quedan {n} habitaciones', { n }) busca la clave en window.CASAL_T (el
     diccionario del idioma, que pone la 004) y, si no está, devuelve la clave:
     con el castellano, el mismo texto. Cambia cada {hueco} por su valor (los
     números y fechas llegan ya formateados con Intl). El HTML de una frase va
     entero en la clave. */
  function t(clave, huecos) {
    const dic = window.CASAL_T;
    // una entrada que no es texto (un fallo del diccionario) no rompe la página: sale la clave
    let s = dic && Object.prototype.hasOwnProperty.call(dic, clave) && typeof dic[clave] === 'string' ? dic[clave] : clave;
    if (huecos) s = s.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(huecos, k) ? String(huecos[k]) : m));
    return s;
  }
  // primera letra en mayúscula, según el idioma de la página (por punto de código, no por unidad UTF-16)
  const mayus = (s) => { if (!s) return s; const [p] = s; return p.toLocaleUpperCase(idioma) + s.slice(p.length); };

  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  /* ============ titulares partidos y entradas ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/([ \t\r\n]+)/).forEach((x) => {
          if (!x.trim()) { frag.appendChild(document.createTextNode(x)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = x;
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
  if (motion) {
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    // el hero de la portada lo abre main.js con la cortina; el de otra página, el observador
    $$('[data-partir]').forEach((h) => { partir(h); if (!(h.closest('.hero') && $('#cortina'))) vistos.observe(h); });
    $$('[data-revela]').forEach((el, i) => { el.style.setProperty('--d', i % 3); vistos.observe(el); });
    $$('.sec-cab').forEach((el) => vistos.observe(el));
  }

  /* ============ Lenis (solo si la página lo carga) ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((x) => lenis.raf(x * 1000)); }
    else { const bucle = (x) => { lenis.raf(x); requestAnimationFrame(bucle); }; requestAnimationFrame(bucle); }
  }
  // lo que tapa la cabecera: el scroll-padding-top de la hoja de estilos
  const margenCab = () => parseFloat(getComputedStyle(raiz).scrollPaddingTop) || 80;
  const irA = (sel, inmediato) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - margenCab();
    if (lenis) lenis.scrollTo(y, inmediato ? { immediate: true, force: true } : { duration: 1.1 });
    else scrollTo({ top: y, behavior: inmediato || quieto ? 'auto' : 'smooth' });
  };

  /* ============ llegar con ancla desde otra página (../#finca) ============
     El navegador salta a la sección al cargar, pero lo que pinta el JS por
     encima (el motor, el anillo, la regla) la empuja hacia abajo. Al terminar
     de cargar, y otra vez al irse la cortina, se vuelve a colocar bajo la
     cabecera, salvo que la persona ya se haya movido. */
  let seMovio = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => addEventListener(ev, () => { seMovio = true; }, { once: true, passive: true }));
  const anclar = () => {
    if (seMovio || location.hash.length < 2) return;
    let el = null;
    try { el = $(decodeURIComponent(location.hash)); } catch (e) { return; }
    if (el) irA(el, true);
  };
  if (document.readyState === 'complete') anclar(); else addEventListener('load', anclar);

  /* ============ carrusel: deslizar fotos (dedo, ratón, flechas y botones) ============
     Gesto propio: arrastrar de lado. Con touch-action: pan-y, el dedo de
     arriba abajo sigue haciendo scroll. Lo usan el gablete de la portada y
     las estancias de «La casa». Las fotos que no se ven no tienen la clase
     «lista» hasta que carga la página (la hoja de estilos las deja en
     display: none, así que su loading="lazy" no las pide antes): al cargar
     solo se descarga la primera. Si alguien pasa de foto antes, se preparan
     en ese momento. */
  function carrusel(caja, { fotos, puntos = [], pie = null, botones = [] }) {
    if (!caja || !fotos.length) return null;
    let i = 0;
    const preparar = () => fotos.forEach((fo) => fo.classList.add('lista'));
    if (document.readyState === 'complete') setTimeout(preparar, 300);
    else addEventListener('load', () => (window.requestIdleCallback ? requestIdleCallback(preparar, { timeout: 1500 }) : setTimeout(preparar, 300)));
    const ir = (n, inicio) => {
      if (!inicio) preparar();
      i = (n + fotos.length) % fotos.length;
      fotos.forEach((fo, k) => {
        fo.classList.toggle('on', k === i);
        // el lector de pantalla lee solo la foto que se ve (su pie lo anuncia aria-live)
        if (k === i) fo.removeAttribute('aria-hidden'); else fo.setAttribute('aria-hidden', 'true');
      });
      puntos.forEach((p, k) => p.setAttribute('aria-current', k === i ? 'true' : 'false'));
      const cap = $('figcaption', fotos[i]);
      if (pie && cap) pie.textContent = cap.textContent;
    };
    ir(0, true);
    botones.forEach((b) => b.addEventListener('click', () => ir(i + +b.dataset.dir)));
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
        lateral = true; caja.classList.add('arrastra'); preparar();
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
  }

  /* ============ panel de leyendas con teclado (pestañas) ============
     Las seis leyendas están en el HTML de /pico-sacro-v2/ (spec 002): una
     pestaña y una hoja por leyenda, la primera visible y las demás hidden.
     Aquí solo se manejan las pestañas; sin JS se leen una detrás de otra. */
  (function leyendas() {
    const lista = $('#leyendas-lista'), hojas = $('#leyendas-hojas');
    if (!lista || !hojas) return;
    const tabs = $$('button', lista);
    const paneles = tabs.map((b) => document.getElementById(b.getAttribute('aria-controls')));
    if (!tabs.length || paneles.some((p) => !p)) return;
    const elegir = (i, foco) => {
      tabs.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      paneles.forEach((p, j) => { p.hidden = i !== j; });
      const hoja = paneles[i];
      if (motion) { hoja.classList.remove('entra'); void hoja.offsetWidth; hoja.classList.add('entra'); }
      if (foco) tabs[i].focus();
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => elegir(i));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); elegir((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); elegir((i + tabs.length - 1) % tabs.length, true); }
      });
    });
    elegir(0);
  })();

  /* ============ alrededores: una regla de minutos (PD-7: en /entorno/) ============
     Los sitios y sus minutos llegan en <script id="datos-alrededores">, que
     la construcción saca de datos/alrededores.json (PD-8). Los nombres y las
     frases vienen de los datos: no pasan por t(). La lista accesible ya va
     en el HTML (<!--alrededores:lista-->). */
  (function regla() {
    const caja = $('#regla');
    if (!caja) return;
    let datos = null;
    try { datos = JSON.parse($('#datos-alrededores').textContent); } catch (e) { return; }
    // de más cerca a más lejos, como la lista de antes: los pisos no dependen del orden del JSON
    const P = datos.sitios.map((s) => [s.nombre, s.minutos]).sort((a, b) => a[1] - b[1]);
    const MAX = Math.max(65, ...P.map((p) => p[1] + 3)), W = 1000;
    const xm = (m) => 20 + (m / MAX) * (W - 40);
    // cada etiqueta sube un piso si choca con otra del mismo; con muchos sitios
    // cerca de la casa hay más pisos y la regla crece hacia arriba
    const usados = [];
    P.forEach(([n, m]) => {
      const x = xm(m);
      let nivel = 0;
      while (usados.some((u) => u.nivel === nivel && Math.abs(u.x - x) < 120)) nivel++;
      usados.push({ x, nivel, n, m });
    });
    const pisos = Math.max(3, ...usados.map((u) => u.nivel));
    const y = 92 + (pisos - 3) * 22, H = y + 58;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    caja.style.height = H + 'px';
    caja.appendChild(svg);
    svgEl(svg, 'line', { x1: xm(0), y1: y, x2: xm(MAX), y2: y, stroke: '#1b222b', 'stroke-width': 1.5 });
    for (let m = 0; m < MAX; m += 10) {
      svgEl(svg, 'line', { x1: xm(m), y1: y - 5, x2: xm(m), y2: y + 5, stroke: '#1b222b' });
      svgEl(svg, 'text', { x: xm(m), y: y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'Hanken Grotesk, sans-serif', fill: '#565a5e' }, m ? t('{m} min', { m }) : t('casa'));
    }
    // casa: el tejado de su C en miniatura
    svgEl(svg, 'path', { d: `M${xm(0) - 9} ${y - 2} L${xm(0)} ${y - 12} L${xm(0) + 9} ${y - 2}`, fill: 'none', stroke: '#a57d3a', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    usados.forEach(({ x, nivel, n, m }) => {
      const ly = y - 18 - nivel * 22;
      svgEl(svg, 'circle', { cx: x, cy: y, r: 4.5, fill: '#7d581e' });
      svgEl(svg, 'line', { x1: x, y1: y - 5, x2: x, y2: ly + 4, stroke: '#7d581e', 'stroke-width': 1, opacity: 0.5 });
      svgEl(svg, 'text', { x: x + 4, y: ly, 'font-size': 14.5, 'font-family': 'Hanken Grotesk, sans-serif', 'font-weight': 600, fill: '#1b222b', stroke: '#f3eee4', 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, t('{sitio} · {m}′', { sitio: n, m }));
    });
  })();

  /* ============ cabecera: el tejado se dora al leer ============ */
  const cab = $('#cab');
  if (cab) {
    const claras = $$('.clara, .pico');
    const lectura = $('.cab__lectura');
    let pendienteCab = 0;
    const alScroll = () => {
      pendienteCab = 0;
      cab.classList.toggle('sc', scrollY > 24);
      // el tejado de la cabecera se dora al bajar: es el indicador de lectura
      if (lectura) {
        const total = raiz.scrollHeight - innerHeight;
        lectura.style.setProperty('--p', total > 0 ? f(limitar(scrollY / total, 0, 1)) : 0);
      }
      const y = cab.offsetHeight / 2;
      cab.classList.toggle('es-clara', claras.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; }));
      cab.classList.toggle('es-oscura', !cab.classList.contains('es-clara'));
    };
    addEventListener('scroll', () => { if (!pendienteCab) pendienteCab = requestAnimationFrame(alScroll); }, { passive: true });
    alScroll();
  }

  /* ============ menú del móvil y anclas de la propia página ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    if (!btnMenu || !menu) return;
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  if (btnMenu && menu) {
    btnMenu.addEventListener('click', () => {
      const abierto = document.body.classList.toggle('menu');
      btnMenu.setAttribute('aria-expanded', String(abierto));
      menu.setAttribute('aria-hidden', String(!abierto));
      if (lenis) abierto ? lenis.stop() : lenis.start();
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });
  }
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
      setTimeout(() => {
        const x = $(destino);
        if (!x.hasAttribute('tabindex')) x.setAttribute('tabindex', '-1');
        x.focus({ preventScroll: true });
      }, 900);
    });
  });

  /* ============ cookies: un solo aviso y una sola marca para toda la web ============
     En la portada sale al retirarse la cortina (main.js llama a
     CASAL.mostrarCookies); en las demás páginas, al cargar. */
  const ck = $('#cookies');
  const LLAVE = 'casal-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  // el mando de maqueta (solo en la portada con ?revision) se aparta mientras están las cookies
  const verMando = () => { const mando = $('#mando'); if (mando && ck && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !!ck && !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  if (ck) {
    const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
    const si = $('#ck-si'), no = $('#ck-no'), abrir = $('#abrir-cookies');
    if (si) si.addEventListener('click', () => cerrarCk('si'));
    if (no) no.addEventListener('click', () => cerrarCk('no'));
    if (abrir) abrir.addEventListener('click', () => { ck.hidden = false; verMando(); if (si) si.focus(); });
    if (!$('#cortina')) mostrarCookies();
    // la red de seguridad del <head> retira la cortina a los 6,5 s si main.js no llega
    else setTimeout(() => { if (raiz.classList.contains('cortina-fuera')) mostrarCookies(); }, 6600);
  }

  /* ============ barra fija en el móvil (solo con observadores) ============ */
  (function barraMovil() {
    const barra = $('#barra');
    if (!barra) return;
    const movil = matchMedia('(max-width: 999px)');
    const dentro = { hero: false, consulta: false, pie: false };
    const pintar = () => {
      const ver = movil.matches && !dentro.hero && !dentro.consulta && !dentro.pie && !document.body.classList.contains('menu') && (!ck || ck.hidden);
      barra.classList.toggle('es-visible', ver);
      barra.setAttribute('aria-hidden', String(!ver));
      $$('a', barra).forEach((a) => { a.tabIndex = ver ? 0 : -1; });
      raiz.classList.toggle('con-barra', ver);
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { dentro[e.target.dataset.barra] = e.isIntersecting; }); pintar(); });
    [['hero', '.hero'], ['consulta', '#motor'], ['pie', '#pie']].forEach(([k, s]) => { const el = $(s); if (el) { el.dataset.barra = k; dentro[k] = k === 'hero'; io.observe(el); } });
    const mo = new MutationObserver(pintar);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (ck) mo.observe(ck, { attributes: true, attributeFilter: ['hidden'] });
    movil.addEventListener('change', pintar);
    pintar();
  })();

  /* ============ mapa de Google solo al pedirlo (portada y /contactar/, spec 002) ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const punto = '42.80472,-8.46366';
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(`${punto} (${t('Casa de Casal')})`) + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = t('Mapa con Casa de Casal en Lestedo');
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ pie: el tejado se posa sobre la C ============ */
  (function pie() {
    const p = $('#pie'), marca = $('.pie__marca');
    if (!p) return;
    if (!motion || !marca) { p.classList.add('es-posado'); return; }
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { p.classList.add('es-posado'); o.disconnect(); } }, { threshold: 0.4 }).observe(marca);
  })();

  window.CASAL = {
    t, mayus, idioma, R, $, $$, f, limitar, svgEl, hayGSAP, quieto, fino, motion,
    get lenis() { return lenis; },
    irA, anclar, carrusel, mostrarCookies, verMando,
  };
})();
