/* ------------------------------------------------------------------
   Casa de Casal · sol.js
   El sol visto desde la finca (NOAA simplificada). Casa: 42,8047 N,
   8,4637 O, 255 m. Pico Sacro: cumbre a 533 m, 1,4 km al rumbo 78,6°,
   unos 10,5° por encima del horizonte. Con la cumbre ±4°, el sol sale
   por detrás del Pico a finales de abril–mediados de mayo y en agosto.
   ------------------------------------------------------------------ */
window.SOL = (function () {
  'use strict';
  const rad = Math.PI / 180, lat = 42.8047, lon = -8.4637;
  const PICO = 78.6, ELEV = 10.5, ANCHO = 4;
  const decl = (d) => {
    const n = d.getTime() / 864e5 + 2440587.5 - 2451545, M = (357.5291 + 0.98560028 * n) % 360;
    const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad), L = (M + C + 282.9372) % 360;
    return Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  };
  // rumbo (desde el norte) del sol de la mañana cuando está a «h» grados de altura
  const rumbo = (h, dec) => {
    const cH = (Math.sin(h * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
    const H = -Math.acos(Math.max(-1, Math.min(1, cH)));
    return (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat * rad) - Math.tan(dec) * Math.cos(lat * rad)) / rad + 180) % 360;
  };
  // hora de salida con el horizonte plano
  const salida = (d) => {
    const J = d.getTime() / 864e5 + 2440587.5, n = Math.ceil(J - 2451545 + 0.0008), Js = n - lon / 360;
    const M = (357.5291 + 0.98560028 * Js) % 360, C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    const L = (M + C + 180 + 102.9372) % 360, Jt = 2451545 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    const sd = Math.sin(L * rad) * Math.sin(23.4397 * rad), cd = Math.cos(Math.asin(sd));
    const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sd) / (Math.cos(lat * rad) * cd)) / rad;
    return new Date((Jt - w / 360 - 2440587.5) * 864e5);
  };
  // tramos del año en que el sol asoma por detrás de la cumbre
  const tramos = (y) => {
    const r = []; let ini = null, ant = null;
    for (let i = 0; i < 367; i++) {
      const d = new Date(Date.UTC(y, 0, 1 + i, 12));
      if (d.getUTCFullYear() !== y) break;
      const dentro = Math.abs(rumbo(ELEV, decl(d)) - PICO) < ANCHO;
      if (dentro && !ini) ini = d;
      if (!dentro && ini) { r.push([ini, ant]); ini = null; }
      ant = d;
    }
    return r;
  };
  /* ---- posición real ahora (sol y luna), fórmulas de SunCalc (V. Agafonkin) ---- */
  const e = rad * 23.4397, J1970 = 2440588, J2000 = 2451545;
  const dias = (fecha) => fecha.valueOf() / 864e5 - 0.5 + J1970 - J2000;
  const ar = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const de = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const sideral = (d) => rad * (280.16 + 360.9856235 * d) - rad * -lon;
  const altAz = (H, dec) => {
    const phi = rad * lat;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / rad + 180 + 360) % 360,
    };
  };
  const solCoords = (d) => {
    const M = rad * (357.5291 + 0.98560028 * d);
    const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
    return { dec: de(L, 0), ra: ar(L, 0) };
  };
  const lunaCoords = (d) => {
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
    return { ra: ar(l, b), dec: de(l, b), dist: 385001 - 20905 * Math.cos(M) };
  };
  const solAhora = (fecha) => { const d = dias(fecha), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); };
  const lunaAhora = (fecha) => {
    const d = dias(fecha), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  };
  return { decl, rumbo, salida, tramos, solAhora, lunaAhora, PICO, ELEV, ANCHO };
})();
