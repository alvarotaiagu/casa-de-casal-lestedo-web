/* ------------------------------------------------------------------
   Casa de Casal · reserva.js
   Motor de reservas de DEMOSTRACIÓN con las dos casas de su año:
   - abril a octubre: habitaciones con desayuno, por tipo;
   - noviembre a marzo: la casa grande entera, hasta 22 personas.
   La ocupación se genera (siempre la misma para cada año); no hay
   servidor, no se envía ni se cobra nada. Al conectar un motor real
   solo cambian ocupadas() y confirmar.
   SUPUESTOS (van a los pendientes de la casa): cuántas habitaciones hay
   de cada tipo (2 clásicas, 4 confort y una de cada otra), precio por
   noche = el «desde» de su web (2022) todo el año, casa entera a 675 €
   una noche y 1.190 € dos (su portada, 2025) y 595 € cada noche más,
   cerrada las noches del 24, 25 y 31 de diciembre.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const raiz = document.getElementById('motor');
  if (!raiz) return;

  /* ---------- fechas ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const entre = (a, b) => Math.round((deClave(b) - deClave(a)) / 864e5);
  const hoy = clave(new Date());
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fEur = new Intl.NumberFormat('es-ES');
  const corta = (k) => fCorta.format(deClave(k));
  const larga = (k) => fLarga.format(deClave(k));
  const eur = (n) => fEur.format(n) + ' €';

  /* ---------- las dos casas ---------- */
  const TIPOS = [
    { id: 'clasica', nombre: 'Clásica', n: 2, plazas: 2, precio: 58, nota: 'Planta baja · baño adaptado' },
    { id: 'confort', nombre: 'Confort', n: 4, plazas: 2, precio: 68, nota: 'Vistas al valle · cama de 1,50' },
    { id: 'torre', nombre: 'La Torre', n: 1, plazas: 3, precio: 70, nota: 'Balcón · admite supletoria' },
    { id: 'terraza', nombre: 'Con terraza', n: 1, plazas: 2, precio: 75, nota: 'Terraza privada de 12 m²' },
    { id: 'familiar', nombre: 'Pico Sacro', n: 1, plazas: 4, precio: 85, nota: 'Familiar · 2 adultos y 2 niños' },
  ];
  const PLAZAS_ENTERA = 22;
  const precioEntera = (n) => (n <= 0 ? 0 : n === 1 ? 675 : 1190 + (n - 2) * 595);
  const esEntera = (k) => { const m = +k.slice(5, 7); return m >= 11 || m <= 3; };       // noviembre a marzo
  const cerrada = (k) => ['12-24', '12-25', '12-31'].includes(k.slice(5));
  const VENTANA = 12;

  /* ---------- ocupación de ejemplo ---------- */
  function azar(s) { return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const OCUP = new Map(TIPOS.map((t) => [t.id, new Map()]));   // tipo → (noche → habitaciones ocupadas)
  const ENTERA = new Set();                                    // noches con la casa entera alquilada
  (function generar() {
    const anios = new Set();
    for (let k = mas(hoy, -40); k <= mas(hoy, 400); k = mas(k, 1)) anios.add(+k.slice(0, 4));
    anios.forEach((y) => {
      TIPOS.forEach((t, i) => {
        const r = azar(y * 7919 + i * 104729), mapa = OCUP.get(t.id);
        for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) {
          if (esEntera(k)) continue;
          const d = deClave(k), dsem = d.getDay(), m = d.getMonth();
          const base = m === 7 ? 0.82 : m === 6 ? 0.6 : (dsem === 5 || dsem === 6) ? 0.55 : 0.18;
          let ocupadas = 0;
          for (let h = 0; h < t.n; h++) if (r() < base) ocupadas++;
          if (ocupadas) mapa.set(k, ocupadas);
        }
      });
      const r = azar(y * 31 + 5);
      for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) {
        if (!esEntera(k)) continue;
        if (deClave(k).getDay() === 5 && r() < 0.45) { ENTERA.add(k); ENTERA.add(mas(k, 1)); }
      }
      [`${y}-12-05`, `${y}-12-06`, `${y}-12-07`, `${y}-12-30`, `${y}-02-14`].forEach((k) => { if (r() < 0.75) ENTERA.add(k); });
    });
  })();
  const libresTipo = (id, k) => { const t = TIPOS.find((x) => x.id === id); return t.n - (OCUP.get(id).get(k) || 0); };
  const libresTipoRango = (id, a, b) => { let m = Infinity; for (let k = a; k < b; k = mas(k, 1)) m = Math.min(m, libresTipo(id, k)); return m === Infinity ? 0 : m; };
  const mismaCasa = (a, b) => { const e = esEntera(a); for (let k = a; k < b; k = mas(k, 1)) if (esEntera(k) !== e) return false; return true; };
  const nocheLibre = (k) => {
    if (k < hoy || cerrada(k)) return false;
    if (esEntera(k)) return !ENTERA.has(k);
    return enJuego().some((t) => libresTipo(t.id, k) > 0);
  };
  const rangoPosible = (a, b) => {
    if (!mismaCasa(a, b)) return false;
    for (let k = a; k < b; k = mas(k, 1)) if (!nocheLibre(k)) return false;
    if (!esEntera(a)) return enJuego().some((t) => libresTipoRango(t.id, a, b) > 0);
    return true;
  };

  /* ---------- estado ---------- */
  const b0 = deClave(hoy);
  const st = { y: b0.getFullYear(), m: b0.getMonth(), ini: null, fin: null, pers: 2, filtro: '', sel: {}, paso: 'fechas', msg: '', datos: {}, metodo: 'tarjeta', loc: '' };
  const minMes = st.y * 12 + st.m, maxMes = minMes + VENTANA - 1;
  const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + VENTANA, 0));
  const enJuego = () => (st.filtro ? TIPOS.filter((t) => t.id === st.filtro) : TIPOS);
  const noches = () => (st.ini && st.fin ? entre(st.ini, st.fin) : 0);
  const modoEntera = () => (st.ini ? esEntera(st.ini) : esEntera(clave(new Date(st.y, st.m, 15))));
  const plazasSel = () => TIPOS.reduce((s, t) => s + (st.sel[t.id] || 0) * t.plazas, 0);
  const habsSel = () => TIPOS.reduce((s, t) => s + (st.sel[t.id] || 0), 0);
  const cuenta = () => {
    const n = noches();
    if (!n) return { n, filas: [], total: 0 };
    if (modoEntera()) return { n, filas: [{ txt: `Casa grande entera · ${n} ${n === 1 ? 'noche' : 'noches'}`, total: precioEntera(n) }], total: precioEntera(n) };
    const filas = TIPOS.filter((t) => st.sel[t.id]).map((t) => ({ txt: `${st.sel[t.id]} × ${t.nombre} · ${n} ${n === 1 ? 'noche' : 'noches'}`, total: st.sel[t.id] * t.precio * n }));
    return { n, filas, total: filas.reduce((s, x) => s + x.total, 0) };
  };
  const listo = () => {
    if (noches() < 1) return false;
    if (modoEntera()) return st.pers >= 1 && st.pers <= PLAZAS_ENTERA;
    return habsSel() > 0 && plazasSel() >= st.pers && TIPOS.every((t) => !st.sel[t.id] || st.sel[t.id] <= libresTipoRango(t.id, st.ini, st.fin));
  };
  // propone habitaciones para el grupo: la del filtro primero, después las que más caben
  function proponer() {
    st.sel = {};
    if (!noches() || modoEntera()) return;
    const orden = TIPOS.slice().sort((a, b) => (a.id === st.filtro ? -1 : b.id === st.filtro ? 1 : 0) || a.precio - b.precio);
    for (const t of orden) {
      let libres = libresTipoRango(t.id, st.ini, st.fin);
      while (libres > 0 && plazasSel() < st.pers) { st.sel[t.id] = (st.sel[t.id] || 0) + 1; libres--; }
      if (plazasSel() >= st.pers) break;
    }
  }

  /* ---------- pintar ---------- */
  const DSEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const PASOS = [['fechas', 'Fechas'], ['datos', 'Tus datos'], ['pago', 'Anticipo'], ['hecho', 'Confirmación']];
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function mesHTML(y, m) {
    const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
    const off = (primero.getDay() + 6) % 7;
    const nombre = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    let h = `<div class="mes"><h4 class="mes__tit">${nombre[0].toUpperCase() + nombre.slice(1)}</h4><div class="dias" role="group" aria-label="${nombre}">`;
    h += DSEM.map((d) => `<span class="dsem" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < off; i++) h += '<span class="vacio"></span>';
    for (let d = 1; d <= dias; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const c = ['dia'], entera = esEntera(k);
      let dis = false, et = larga(k);
      if (entera) { c.push('entera'); et += ', casa entera'; }
      if (k < hoy || k > limite) { c.push('pasado'); dis = true; }
      else if (cerrada(k) && !(st.ini && !st.fin && k > st.ini && rangoPosible(st.ini, k))) { c.push('cerrado'); dis = true; et += ', cerrada'; }
      else if (!nocheLibre(k)) {
        if (st.ini && !st.fin && k > st.ini && rangoPosible(st.ini, k)) { c.push('solo-salida'); et += ', libre para salir'; }
        else { c.push('ocupado'); dis = true; et += entera ? ', alquilada' : ', completo'; }
      } else if (!entera) {
        const libres = enJuego().reduce((s, t) => s + libresTipo(t.id, k), 0);
        et += `, ${libres} ${libres === 1 ? 'habitación libre' : 'habitaciones libres'}`;
        if (!st.filtro && libres <= 2) c.push('pocas');
      } else et += ', libre';
      if (st.ini && k === st.ini) { c.push('ini'); et += ', llegada'; }
      if (st.fin && k === st.fin) { c.push('fin'); et += ', salida'; }
      if (st.ini && st.fin && k > st.ini && k < st.fin) c.push('rango');
      h += `<button type="button" class="${c.join(' ')}" data-k="${k}" aria-label="${et}"${dis ? ' aria-disabled="true" tabindex="-1"' : ''}${(k === st.ini || k === st.fin) ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    return h + '</div></div>';
  }

  function resumenFechas() {
    return `<div class="fechas"><div><small>Llegada</small><b>${st.ini ? corta(st.ini) : '—'}</b></div><div><small>Salida</small><b>${st.fin ? corta(st.fin) : '—'}</b></div></div>`;
  }

  function habsHTML() {
    const n = noches();
    if (!n) return '';
    return '<div class="motor__habs" role="group" aria-label="Habitaciones para estas fechas">' + TIPOS.map((t) => {
      const libres = libresTipoRango(t.id, st.ini, st.fin), v = st.sel[t.id] || 0;
      return `<div class="hab${v ? ' on' : ''}${libres ? '' : ' lleno'}" data-tipo="${t.id}">
        <span class="hab__n"><b>${t.nombre}</b><small>${t.nota} · ${libres ? `quedan ${libres}` : 'completa'}</small></span>
        <span class="hab__p">${eur(t.precio * n)}</span>
        <span class="hab__cont"><button type="button" data-menos="${t.id}" aria-label="Una ${t.nombre} menos"${v ? '' : ' disabled'}>−</button><output aria-live="polite" aria-label="${t.nombre}: ${v}">${v}</output><button type="button" data-mas="${t.id}" aria-label="Una ${t.nombre} más"${v < libres ? '' : ' disabled'}>+</button></span>
      </div>`;
    }).join('') + '</div>';
  }

  function panelFechas() {
    const c = cuenta(), ok = listo(), entera = modoEntera(), n = c.n;
    let d = '<div class="desglose">';
    if (!n) d += `<div class="nada">${st.ini ? 'Ahora, el día de salida.' : 'Elige el día de llegada en el calendario.'}</div>`;
    else if (!c.filas.length) d += '<div class="nada">Elige una o varias habitaciones.</div>';
    else {
      c.filas.forEach((x) => { d += `<div><span>${x.txt}</span><span>${eur(x.total)}</span></div>`; });
      d += `<div class="tot"><span>Total</span><span>${eur(c.total)}</span></div>`;
      d += `<div class="nota"><span>Anticipo del 25 %</span><span>${eur(Math.round(c.total * 0.25))}</span></div>`;
      const canc = mas(st.ini, -7);
      d += `<div class="nota"><span>Cancelación gratis</span><span>${canc >= hoy ? 'hasta el ' + corta(canc) : 'ya no'}</span></div>`;
    }
    d += '</div>';
    const maxPers = entera ? PLAZAS_ENTERA : (n ? TIPOS.reduce((s, t) => s + libresTipoRango(t.id, st.ini, st.fin) * t.plazas, 0) : 12);
    const aviso = !entera && n && habsSel() && plazasSel() < st.pers ? `<p class="motor__msg">Con estas habitaciones caben ${plazasSel()}: añade otra para ${st.pers}.</p>` : '';
    const ficha = entera ? `<div class="entera-ficha"><b>La casa grande, para ti</b><span>Las nueve habitaciones, los salones, el comedor para treinta y la finca. Hasta ${PLAZAS_ENTERA} personas.</span></div>` : '';
    return `<h3 id="motor-tit-paso" tabindex="-1">Tu estancia</h3>
      ${resumenFechas()}
      <div class="pers"><div><small>Personas</small><b aria-live="polite">${st.pers}</b></div>
        <button type="button" data-acc="menos" aria-label="Una persona menos"${st.pers <= 1 ? ' disabled' : ''}>−</button>
        <button type="button" data-acc="mas" aria-label="Una persona más"${st.pers >= maxPers ? ' disabled' : ''}>+</button></div>
      ${ficha}${entera ? '' : habsHTML()}
      ${aviso}
      ${d}
      <button type="button" class="btn btn--oro" data-acc="seguir" aria-disabled="${!ok}">Reservar</button>
      <p class="motor__fino">${entera ? 'Casa entera: 675 € una noche, 1.190 € dos. Navidad y fin de año, cerrada.' : 'Precio por habitación y noche, con desayuno.'}</p>`;
  }

  function panelDatos() {
    const c = cuenta(), v = st.datos;
    return `<h3 id="motor-tit-paso" tabindex="-1">Tus datos</h3>
      <p class="motor__fino">${corta(st.ini)} → ${corta(st.fin)} · ${c.n} ${c.n === 1 ? 'noche' : 'noches'} · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'} · <b>${eur(c.total)}</b></p>
      <form class="motor__form" id="motor-form" novalidate>
        <label for="m-nombre">Nombre y apellidos<input type="text" id="m-nombre" autocomplete="name" required value="${esc(v.nombre)}"></label>
        <label for="m-correo">Correo<input type="email" id="m-correo" autocomplete="email" required value="${esc(v.correo)}"></label>
        <label for="m-tel">Móvil<input type="tel" id="m-tel" autocomplete="tel" required value="${esc(v.tel)}"></label>
        <label for="m-nota">¿Algo que debamos saber? Alergias, hora de llegada… <span>(opcional)</span><textarea id="m-nota" rows="2">${esc(v.nota)}</textarea></label>
        <label class="check" for="m-ok"><input type="checkbox" id="m-ok" required${v.ok ? ' checked' : ''}><span>He leído la <a class="enlace" href="privacidad.html">política de privacidad</a> y acepto las condiciones de la reserva.</span></label>
        <p class="motor__msg" id="m-error" aria-live="assertive"></p>
        <button type="submit" class="btn btn--oro">Seguir al anticipo</button>
        <button type="button" class="btn btn--linea" data-acc="volver">Cambiar fechas</button>
      </form>`;
  }

  function panelPago() {
    const c = cuenta(), anticipo = Math.round(c.total * 0.25);
    return `<h3 id="motor-tit-paso" tabindex="-1">Anticipo</h3>
      ${resumenFechas()}
      <div class="desglose"><div><span>Total de la estancia</span><span>${eur(c.total)}</span></div><div class="tot"><span>Anticipo ahora (25 %)</span><span>${eur(anticipo)}</span></div><div class="nota"><span>El resto, en la casa</span><span>${eur(c.total - anticipo)}</span></div></div>
      <fieldset class="metodos"><legend>Cómo quieres pagar el anticipo</legend>
        <label class="metodo" for="m-tarjeta"><input type="radio" name="metodo" id="m-tarjeta" value="tarjeta"${st.metodo === 'tarjeta' ? ' checked' : ''}><span>Tarjeta<small>Te llega un código al móvil para confirmarlo con tu banco</small></span></label>
        <label class="metodo" for="m-bizum"><input type="radio" name="metodo" id="m-bizum" value="bizum"${st.metodo === 'bizum' ? ' checked' : ''}><span>Bizum<small>Con tu móvil</small></span></label>
        <label class="metodo" for="m-transf"><input type="radio" name="metodo" id="m-transf" value="transferencia"${st.metodo === 'transferencia' ? ' checked' : ''}><span>Transferencia<small>Tienes 4 días para hacerla</small></span></label>
      </fieldset>
      <button type="button" class="btn btn--oro" data-acc="pagar">Pagar ${eur(anticipo)} y reservar</button>
      <button type="button" class="btn btn--linea" data-acc="volver-datos">Volver a los datos</button>
      <p class="motor__fino">Demostración: aquí se abriría la pasarela de pago. No se cobra nada.</p>`;
  }

  function panelHecho() {
    const c = cuenta();
    const que = modoEntera() ? 'La casa grande entera' : TIPOS.filter((t) => st.sel[t.id]).map((t) => `${st.sel[t.id]} × ${t.nombre}`).join(', ');
    return `<div class="confirmacion">
      <h3 id="motor-tit-paso" tabindex="-1">Reserva hecha</h3>
      <p class="confirmacion__loc">${st.loc}</p>
      <p>${larga(st.ini)} → ${larga(st.fin)}<br>${que} · ${c.n} ${c.n === 1 ? 'noche' : 'noches'} · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'} · ${eur(c.total)}</p>
      <p>El día antes te mandamos la ubicación por WhatsApp. Te esperamos en Lestedo.</p>
      <p class="motor__fino">Demostración: no se ha enviado ni cobrado nada. En la web real te llegaría la confirmación por correo.</p>
      <button type="button" class="btn btn--linea" data-acc="otra">Hacer otra reserva</button>
    </div>`;
  }

  function pintar(foco) {
    const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
    const iPaso = PASOS.findIndex((p) => p[0] === st.paso);
    const pasos = '<ol class="motor__pasos">' + PASOS.map(([k, t], i) => `<li${i === iPaso ? ' aria-current="step"' : ''}${i < iPaso ? ' class="hecho"' : ''}>${t}</li>`).join('') + '</ol>';
    const panel = { fechas: panelFechas, datos: panelDatos, pago: panelPago, hecho: panelHecho }[st.paso]();
    const entera = modoEntera();
    const filtro = entera ? '' : '<div class="motor__filtro" role="group" aria-label="Ver la disponibilidad de">'
      + `<button type="button" class="chip" data-filtro="" aria-pressed="${!st.filtro}">Todas</button>`
      + TIPOS.map((t) => `<button type="button" class="chip" data-filtro="${t.id}" aria-pressed="${st.filtro === t.id}">${t.nombre}</button>`).join('') + '</div>';
    raiz.innerHTML = pasos + `<div class="motor__in">
      <div class="motor__cal"${st.paso !== 'fechas' ? ' inert' : ''}>
        <div class="motor__top"><h3>Disponibilidad</h3>
          <span class="motor__modo${entera ? ' entera' : ''}">${entera ? 'Casa entera · nov–mar' : 'Habitaciones · abr–oct'}</span>
          <button type="button" class="motor__nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' disabled' : ''}>‹</button>
          <button type="button" class="motor__nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' disabled' : ''}>›</button></div>
        ${filtro}
        <div class="motor__meses">${mesHTML(st.y, st.m)}${mesHTML(y2, m2)}</div>
        <div class="motor__ley"><span><i class="l-est"></i>Tu estancia</span><span><i class="l-ocu"></i>Completo o alquilada</span><span><i class="l-pocas"></i>Quedan pocas</span><span><i class="l-entera"></i>Casa entera</span></div>
        <p class="motor__msg" aria-live="polite">${st.msg}</p>
      </div>
      <div class="motor__res">${panel}</div></div>`;
    if (foco) { const el = typeof foco === 'string' ? raiz.querySelector(foco) : null; if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- acciones ---------- */
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.k) {
      if (b.getAttribute('aria-disabled') === 'true' || st.paso !== 'fechas') return;
      const k = b.dataset.k;
      st.msg = '';
      if (!st.ini || st.fin || k <= st.ini) {
        if (!nocheLibre(k)) return;
        st.ini = k; st.fin = null; st.sel = {};
        if (esEntera(k) && st.pers < 2) st.pers = 2;
      } else if (!mismaCasa(st.ini, k)) {
        st.msg = 'Tu estancia cruza el cambio de temporada (1 de abril o 1 de noviembre): esas fechas se reservan por teléfono.';
      } else if (!rangoPosible(st.ini, k)) {
        st.msg = esEntera(st.ini) ? 'La casa está alquilada o cerrada alguna noche entre medias: elige otra salida.' : st.filtro ? 'Esa habitación está ocupada alguna noche entre medias: elige otra salida u otra habitación.' : 'No queda ninguna habitación libre todas esas noches: elige otra salida.';
        if (nocheLibre(k)) { st.ini = k; st.fin = null; st.sel = {}; }
      } else { st.fin = k; proponer(); }
      pintar(`[data-k="${k}"]`);
      return;
    }
    if (b.dataset.filtro !== undefined) {
      st.filtro = b.dataset.filtro;
      if (st.ini && st.fin && !rangoPosible(st.ini, st.fin)) { st.sel = {}; st.msg = `${TIPOS.find((t) => t.id === st.filtro).nombre} no está libre todas esas noches: elige otras fechas u otra habitación.`; }
      else { st.msg = ''; if (st.fin) proponer(); }
      pintar(`[data-filtro="${st.filtro}"]`);
      return;
    }
    if (b.dataset.mas || b.dataset.menos) {
      const id = b.dataset.mas || b.dataset.menos;
      st.sel[id] = Math.max(0, (st.sel[id] || 0) + (b.dataset.mas ? 1 : -1));
      pintar(`[data-${b.dataset.mas ? 'mas' : 'menos'}="${id}"]:not(:disabled)`);
      return;
    }
    const a = b.dataset.acc;
    if (!a) return;
    let foco = `[data-acc="${a}"]:not(:disabled)`;
    if (a === 'prev') { if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
    else if (a === 'next') { if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
    else if (a === 'menos') { st.pers = Math.max(1, st.pers - 1); }
    else if (a === 'mas') { st.pers += 1; if (!modoEntera() && plazasSel() < st.pers) proponer(); }
    else if (a === 'seguir') {
      if (!listo()) st.msg = !st.ini ? 'Elige primero el día de llegada.' : !st.fin ? 'Falta el día de salida.' : !habsSel() ? 'Elige una habitación.' : `Las habitaciones elegidas son para ${plazasSel()}: añade otra.`;
      else { st.paso = 'datos'; st.msg = ''; foco = '#motor-tit-paso'; }
    }
    else if (a === 'volver') { guardarDatos(); st.paso = 'fechas'; foco = '#motor-tit-paso'; }
    else if (a === 'volver-datos') { st.paso = 'datos'; foco = '#motor-tit-paso'; }
    else if (a === 'pagar') {
      const r = raiz.querySelector('input[name="metodo"]:checked');
      st.metodo = r ? r.value : 'tarjeta';
      st.loc = 'CDC-' + st.ini.slice(2).replace(/-/g, '') + '-' + String((entre(st.ini, st.fin) * 37 + st.pers * 11 + habsSel() * 101 + (st.datos.nombre || '').length * 7) % 1000).padStart(3, '0');
      st.paso = 'hecho'; foco = '#motor-tit-paso';
    }
    else if (a === 'otra') { st.paso = 'fechas'; st.ini = st.fin = null; st.sel = {}; st.datos = {}; foco = '#motor-tit-paso'; }
    else return;
    pintar(foco);
    if (['seguir', 'volver', 'volver-datos', 'pagar', 'otra'].includes(a) && st.msg === '' && window.CASAL) {
      const r = raiz.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) window.CASAL.irA(raiz);
    }
  });

  function guardarDatos() {
    const v = (id) => { const el = raiz.querySelector('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    if (!raiz.querySelector('#m-nombre')) return;
    st.datos = { nombre: v('m-nombre'), correo: v('m-correo'), tel: v('m-tel'), nota: v('m-nota'), ok: v('m-ok') };
  }

  raiz.addEventListener('submit', (e) => {
    e.preventDefault();
    const fo = e.target, err = fo.querySelector('#m-error');
    guardarDatos();
    const campos = ['m-nombre', 'm-correo', 'm-tel'].map((id) => fo.querySelector('#' + id));
    campos.forEach((c) => c.removeAttribute('aria-invalid'));
    const falta = [];
    if (!st.datos.nombre.trim()) falta.push([campos[0], 'el nombre']);
    if (!/^\S+@\S+\.\S{2,}$/.test(st.datos.correo.trim())) falta.push([campos[1], 'un correo válido']);
    if (st.datos.tel.replace(/\D/g, '').length < 9) falta.push([campos[2], 'un móvil de al menos 9 cifras']);
    if (falta.length) {
      falta.forEach(([c]) => c.setAttribute('aria-invalid', 'true'));
      err.textContent = 'Falta ' + falta.map((x) => x[1]).join(', ') + '.';
      falta[0][0].focus();
      return;
    }
    if (!st.datos.ok) { err.textContent = 'Falta aceptar la política de privacidad.'; fo.querySelector('#m-ok').focus(); return; }
    st.paso = 'pago';
    pintar('#motor-tit-paso');
  });

  /* ---------- desde fuera: «Ver fechas» de un tipo y los meses del anillo ---------- */
  const primerFinde = (desde, cond) => {
    for (let k = mas(desde, 0), i = 0; i < 400; k = mas(k, 1), i++) if (deClave(k).getDay() === 5 && k > hoy && cond(k)) return k;
    return null;
  };
  function elegirTipo(id) {
    st.paso = 'fechas'; st.filtro = id; st.msg = '';
    if (st.ini && st.fin && !esEntera(st.ini) && libresTipoRango(id, st.ini, st.fin) > 0) { proponer(); pintar(); return; }
    // el próximo fin de semana de habitaciones en que esté libre
    const k = primerFinde(hoy, (x) => !esEntera(x) && mismaCasa(x, mas(x, 2)) && libresTipoRango(id, x, mas(x, 2)) > 0);
    st.ini = k; st.fin = k ? mas(k, 2) : null;
    if (k) { const d = deClave(k); st.y = d.getFullYear(); st.m = d.getMonth(); }
    if (!k) st.msg = 'Esta habitación solo se reserva de abril a octubre.';
    proponer(); pintar();
  }
  function irMes(m) {
    st.paso = 'fechas';
    let y = b0.getFullYear();
    if (y * 12 + m < minMes) y++;
    if (y * 12 + m + 1 > maxMes) { st.msg = 'Ese mes aún no está abierto a reservas.'; pintar(); return; }
    st.y = y; st.m = m; st.msg = '';
    // si la estancia elegida es de la otra casa, se suelta: el mes manda
    if (st.ini && esEntera(st.ini) !== esEntera(`${y}-${pad(m + 1)}-15`)) { st.ini = st.fin = null; st.sel = {}; }
    pintar();
  }

  // estado inicial de ejemplo: el próximo fin de semana libre, para 2
  const k0 = primerFinde(hoy, (k) => rangoPosible(k, mas(k, 2)));
  if (k0) { st.ini = k0; st.fin = mas(k0, 2); const d = deClave(k0); st.y = d.getFullYear(); st.m = d.getMonth(); if (st.y * 12 + st.m + 1 > maxMes) { st.y = b0.getFullYear(); st.m = b0.getMonth(); } proponer(); }
  pintar();

  window.CASALmotor = { elegirTipo, irMes };
  window.__motor = { st, TIPOS, libresTipo, libresTipoRango, esEntera, cerrada, ENTERA, precioEntera, cuenta, nocheLibre, rangoPosible };
})();
