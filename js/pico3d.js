/* ------------------------------------------------------------------
   Casa de Casal · pico3d.js
   El Pico Sacro y la finca en 3D con datos reales del IGN (relieve MDT05
   y ortofoto PNOA, CC BY 4.0) y el cielo de ahora: el sol ilumina desde
   su posición real (las sombras caen según la hora), de noche la luna
   con su fase y las estrellas, y las nubes bajas del dato de la cumbre.
   Se carga solo al acercarse a la sección; si falla, sigue el dibujo.
   ------------------------------------------------------------------ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const EXAG = 1.6;                       // altura exagerada ×1,6 (se dice en el pie)
const RAD = Math.PI / 180;
const dir = (az, alt) => new THREE.Vector3(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

function lienzoTextura(lado, dibujar) {
  const c = document.createElement('canvas'); c.width = c.height = lado;
  dibujar(c.getContext('2d'), lado);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function montar(caja, { S, colores, lunaPath, movil }) {
  const base = 'img/terreno/', n = movil ? 192 : 256;
  const [meta, buf, foto] = await Promise.all([
    fetch(base + 'terreno.json').then((r) => r.json()),
    fetch(base + `alturas-${n}.bin`).then((r) => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync(base + (movil ? 'foto-1024.jpg' : 'foto-1536.jpg')),
  ]);
  const alturas = new Uint16Array(buf);
  foto.colorSpace = THREE.SRGBColorSpace; foto.anisotropy = 4;

  const lienzo = document.createElement('canvas');
  lienzo.className = 'pico__lienzo';
  lienzo.setAttribute('aria-hidden', 'true');
  caja.prepend(lienzo);
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !movil, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.5 : 1.75));   // tope de DPR
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, 10, 40000);
  const yDe = (h) => (h - meta.min) * EXAG;

  /* terreno: fila 0 = norte (−z), columnas de oeste a este (+x) */
  const geo = new THREE.PlaneGeometry(meta.ancho, meta.alto, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, yDe(alturas[i] / 10));
  geo.computeVertexNormals();
  const terreno = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: foto, roughness: 1, metalness: 0 }));
  terreno.castShadow = terreno.receiveShadow = true;
  escena.add(terreno);
  // suelo más allá del recorte, para que el borde se funda en la niebla
  // sin mapeo de tonos, igual que la cúpula: lejos se confunde con el pie del cielo y no se ve costura
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshBasicMaterial({ color: 0x5f7a72, toneMapped: false, fog: false }));
  suelo.rotateX(-Math.PI / 2); suelo.position.y = -2; escena.add(suelo);

  /* la casa: una chincheta dorada; el Pico: su cumbre */
  const [cx, cz] = meta.casa.xz, [px, pz] = meta.pico.xz;
  const yCasa = yDe(meta.casa.h), yPico = yDe(meta.pico.h);
  const chincheta = new THREE.Group();
  const oro = new THREE.MeshStandardMaterial({ color: 0xcfa865, emissive: 0x3a2a10, roughness: 0.4, metalness: 0.3 });
  const punta = new THREE.Mesh(new THREE.ConeGeometry(14, 46, 20), oro); punta.rotation.x = Math.PI; punta.position.y = 23;
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 14), oro); cabeza.position.y = 56;
  chincheta.add(punta, cabeza); chincheta.position.set(cx, yCasa, cz); chincheta.traverse((o) => { o.castShadow = true; });
  escena.add(chincheta);

  /* cielo: cúpula con degradado (los mismos colores que el dibujo) */
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,   // mismos colores que el dibujo, en sRGB
    uniforms: { cA: { value: new THREE.Color() }, cM: { value: new THREE.Color() }, cB: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 cA; uniform vec3 cM; uniform vec3 cB; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.18 ? mix(cM, cA, smoothstep(0.18, 0.9, h)) : mix(cB, cM, smoothstep(-0.02, 0.18, h)); gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  escena.add(cielo);
  escena.fog = new THREE.Fog(0xffffff, 3400, 9500);   // bruma: da profundidad y esconde el borde del recorte

  /* estrellas */
  const nE = 700, ePos = new Float32Array(nE * 3);
  for (let i = 0; i < nE; i++) {
    const a = (i * 137.508) * RAD, h = Math.asin(((i * 0.618) % 1) * 0.95 + 0.04);
    ePos.set([Math.cos(h) * Math.sin(a) * 18000, Math.sin(h) * 18000, -Math.cos(h) * Math.cos(a) * 18000], i * 3);
  }
  const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const estrellas = new THREE.Points(eGeo, new THREE.PointsMaterial({ color: 0xf3eee4, size: movil ? 1.6 : 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  escena.add(estrellas);

  /* sol y luna como discos en la cúpula, en su dirección real */
  const solTex = lienzoTextura(128, (g, l) => { const r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.18, 'rgba(255,214,140,1)'); r.addColorStop(0.32, 'rgba(255,200,120,.45)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
  const sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: solTex, fog: false, depthWrite: false, transparent: true }));
  sol.scale.set(2600, 2600, 1); escena.add(sol);
  let lunaClave = '';
  const lunaMat = new THREE.SpriteMaterial({ fog: false, depthWrite: false, transparent: true });
  const luna = new THREE.Sprite(lunaMat); luna.scale.set(900, 900, 1); escena.add(luna);
  const pintarLuna = (luz, fase) => {
    const clave = luz.toFixed(2) + fase.toFixed(2);
    if (clave === lunaClave) return; lunaClave = clave;
    if (lunaMat.map) lunaMat.map.dispose();
    lunaMat.map = lienzoTextura(128, (g, l) => {
      g.translate(l / 2, l / 2);
      g.fillStyle = 'rgba(42,52,68,.55)'; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f1ead6'; g.shadowColor = 'rgba(241,234,214,.6)'; g.shadowBlur = 14; g.fill(new Path2D(lunaPath(50, luz, fase)));
    });
    lunaMat.needsUpdate = true;
  };

  /* nubes bajas: manchas suaves alrededor de la cumbre («toquilla») */
  const nubeTex = lienzoTextura(128, (g, l) => { const r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
  const nubes = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.SpriteMaterial({ map: nubeTex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(m); const a = i * 0.83, r = 90 + (i % 6) * 60;
    s.position.set(px + Math.cos(a) * r, yPico - 70 + (i % 5) * 26, pz + Math.sin(a) * r);   // la «toquilla»: un anillo bajo la cumbre
    s.scale.set(420 + (i % 3) * 140, 170 + (i % 2) * 70, 1);
    escena.add(s); nubes.push(s);
  }

  /* luces */
  const luzSol = new THREE.DirectionalLight(0xffffff, 2);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(movil ? 1024 : 2048, movil ? 1024 : 2048);
  Object.assign(luzSol.shadow.camera, { left: -2900, right: 2900, top: 2900, bottom: -2900, near: 100, far: 14000 });
  luzSol.shadow.bias = -0.0004; luzSol.shadow.normalBias = 3;
  const luzLuna = new THREE.DirectionalLight(0x9fb4d8, 0);
  const hemi = new THREE.HemisphereLight(0xbfd4e0, 0x2b3a2c, 0.6);
  escena.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi);

  /* cámara: desde detrás de la casa, mirando al Pico (como el dibujo) */
  const objetivo0 = new THREE.Vector3((cx + px) / 2, yDe(430), (cz + pz) / 2);
  const atras = new THREE.Vector3(cx - px, 0, cz - pz).normalize();
  const camara0 = new THREE.Vector3(cx, yCasa, cz).addScaledVector(atras, movil ? 1500 : 2100).add(new THREE.Vector3(0, movil ? 330 : 380, 0));
  if (movil) { cam.fov = 46; cam.updateProjectionMatrix(); }
  cam.position.copy(camara0);
  const controles = new OrbitControls(cam, lienzo);
  controles.target.copy(objetivo0);
  Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 700, maxDistance: 6500, maxPolarAngle: 1.42, rotateSpeed: 0.6, zoomSpeed: 0.8 });

  /* rótulos en HTML sobre el lienzo */
  const rotulos = [
    { txt: 'Casa de Casal', p: new THREE.Vector3(cx, yCasa + 90, cz), clase: 'casa' },
    { txt: 'Pico Sacro · 533 m', p: new THREE.Vector3(px, yPico + 60, pz), clase: '' },
  ].map((r) => { const e = document.createElement('span'); e.className = 'pico__rotulo ' + r.clase; e.textContent = r.txt; caja.appendChild(e); return { ...r, e }; });
  const v = new THREE.Vector3();
  const colocarRotulos = () => {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    rotulos.forEach((r) => {
      v.copy(r.p).project(cam);
      const fuera = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      r.e.hidden = fuera;
      if (!fuera) r.e.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    });
  };

  /* dibujar solo cuando hace falta */
  let raf = 0, interactua = false;
  const render = () => { renderer.render(escena, cam); colocarRotulos(); };
  const pedir = () => { if (!raf) raf = requestAnimationFrame(paso); };
  function paso() { raf = 0; const cambia = controles.update(); render(); if (cambia || interactua) pedir(); }
  controles.addEventListener('start', () => { interactua = true; pedir(); });
  controles.addEventListener('end', () => { interactua = false; pedir(); });
  controles.addEventListener('change', pedir);
  const medir = () => { const w = caja.clientWidth, h = caja.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); render(); };
  new ResizeObserver(medir).observe(caja);

  /* el cielo de ahora */
  let nubesN = 0, nubesLluvia = false, estado = {};
  function actualizar(fecha) {
    const s = S.solAhora(fecha), l = S.lunaAhora(fecha);
    const [a, m, b] = colores(s.alt);
    // bruma de las lomas lejanas: el color del cielo bajo mezclado con un verde azulado; el pie de la cúpula es igual, sin costura
    const bruma = new THREE.Color(m).lerp(new THREE.Color(0x5f7a72), 0.5).lerp(new THREE.Color(b), 0.15);
    cielo.material.uniforms.cA.value.set(a); cielo.material.uniforms.cM.value.set(m); cielo.material.uniforms.cB.value.copy(bruma);
    escena.fog.color.copy(bruma); suelo.material.color.copy(bruma);
    const dia = lim((s.alt + 4) / 14, 0, 1), noche = lim((-s.alt - 2) / 10, 0, 1);
    estado.noche = noche;
    const dS = dir(s.az, s.alt);
    luzSol.position.copy(dS).multiplyScalar(7000); luzSol.target.position.set(0, 0, 0);
    luzSol.intensity = s.alt > -1 ? 3.2 * lim((s.alt + 1) / 12, 0, 1) : 0;
    luzSol.color.setHSL(0.09 - 0.03 * (1 - lim(s.alt / 20, 0, 1)), 0.8 - 0.6 * lim(s.alt / 25, 0, 1), 0.62);
    sol.position.copy(dS).multiplyScalar(17000); sol.visible = s.alt > -2;
    const dL = dir(l.az, l.alt);
    luzLuna.position.copy(dL).multiplyScalar(7000);
    luzLuna.intensity = l.alt > 0 ? (0.25 + 0.75 * l.luz) * noche : 0;
    luna.position.copy(dL).multiplyScalar(17000); luna.visible = l.alt > -1 && l.luz > 0.03;
    if (luna.visible) pintarLuna(l.luz, l.fase);
    hemi.intensity = 0.3 + 0.6 * dia;
    hemi.color.set(noche > 0.5 ? 0x5a6f99 : m); hemi.groundColor.set(noche > 0.5 ? 0x141c18 : 0x2b3a2c);
    renderer.toneMappingExposure = 0.75 + 0.35 * dia;
    estrellas.material.opacity = noche * noche;
    pintarNubes();
    estado = { solAlt: s.alt, luzSol: luzSol.intensity, luzLuna: luzLuna.intensity, luna: luna.visible, estrellas: estrellas.material.opacity, fase: l.fase, noche };
    render();
    return estado;
  }
  function pintarNubes(nN, ll) {
    if (nN !== undefined) { nubesN = nN; nubesLluvia = ll; }
    const noche = estado.noche || 0, tono = nubesLluvia ? 0.62 : 1 - 0.55 * noche;
    nubes.forEach((s, i) => { s.material.opacity = lim((nubesN / 100) * 1.1 - i / 40, 0, 0.9); s.material.color.setScalar(tono); });
    render();
  }
  const volver = () => { cam.position.copy(camara0); controles.target.copy(objetivo0); controles.update(); render(); };
  const activar = (si) => { controles.enableZoom = si; lienzo.style.touchAction = si ? 'none' : 'pan-y'; controles.enabled = si || !movil; };
  activar(false);
  medir();
  return { actualizar, nubes: pintarNubes, volver, activar, estado: () => estado, fuente: meta.fuente };
}
