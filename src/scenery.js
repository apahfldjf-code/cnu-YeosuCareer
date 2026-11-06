/* ═══════════════════════════════════════════════════════════════
 * src/scenery.js (신규, Q3) — 풍경 정교화 (이미지·모델 파일 없음, 전부 코드로 생성)
 *
 *  crownGeo()        나무 잎덩이(덩이 6개 + 불규칙 + 위아래 명암)
 *  hillGeo()         울퉁불퉁한 산
 *  grassTexNew()     풀잎·얼룩이 있는 잔디 무늬
 *  scatterGrass()    입체 풀포기 + 들꽃 (바깥 잔디밭)
 *  plazaPaving()     광장 보도블록 줄눈 (투명 덧판)
 *  lampPost()        받침·기둥·등갓·빛무리가 있는 가로등
 *  benchParts()      나무 판 + 쇠 프레임 벤치
 *  deckTex()         부두 널판(이음새·나뭇결·못)
 *
 *  끄기   주소 뒤 ?scn=0  → 나무·산·풀포기만 예전 모양으로 (문제 확인용)
 *  라이선스  외부 자료 없이 자체 작성
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { rbox, rcyl, rsph } from './round.js';
import { isTouch } from './input.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lcg = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const OFF = (() => { try { return new URLSearchParams(location.search).get('scn') === '0'; } catch (e) { return false; } })();

/* 인덱스 없는 지오메트리들을 하나로 합침 (위치만) */
function mergeGeos(list) {
  const gs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; gs.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3); let o = 0;
  gs.forEach((g) => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return out;
}
function paintByHeight(geo, y0, y1, c0, c1) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1);
    col[i * 3] = c0[0] + (c1[0] - c0[0]) * t; col[i * 3 + 1] = c0[1] + (c1[1] - c0[1]) * t; col[i * 3 + 2] = c0[2] + (c1[2] - c0[2]) * t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/* ───────────── 나무 잎덩이 ───────────── */
let _crown = null;
export function crownGeo() {
  if (_crown) return _crown;
  if (OFF) {
    const g = new THREE.IcosahedronGeometry(1.7, 0);
    paintByHeight(g, -1, 1, [1, 1, 1], [1, 1, 1]); return (_crown = g);
  }
  /* [x, y, z, 반지름, 세분화] — 가운데 큰 덩이 + 주변 덩이 */
  const blobs = [[0, 0, 0, 1.45, 1], [1.0, -0.35, 0.45, 0.95, 0], [-0.95, -0.3, 0.5, 1.0, 0], [0.25, -0.3, -1.0, 1.0, 0], [0.1, 0.95, -0.05, 0.95, 0], [-0.35, 0.5, 0.95, 0.8, 0]];
  const g = mergeGeos(blobs.map(([x, y, z, r, d]) => { const b = new THREE.IcosahedronGeometry(r, d); b.translate(x, y, z); return b; }));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.10 * Math.sin(x * 3.1 + z * 2.3) + 0.08 * Math.sin(y * 4.7 + x * 1.9);   /* 위치에 따라 연속 → 틈이 안 생김 */
    p.setXYZ(i, x * d * 0.92, y * d * 0.86, z * d * 0.92);
  }
  g.computeVertexNormals();
  paintByHeight(g, -1.3, 1.9, [0.50, 0.62, 0.55], [1.0, 1.0, 0.82]);   /* 아래는 어둡고 위는 밝게 */
  return (_crown = g);
}

/* ───────────── 산 ───────────── */
export function hillGeo() {
  if (OFF) return new THREE.ConeGeometry(1, 1, 7);
  const g = new THREE.ConeGeometry(1, 1, 18, 7, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y + 0.5, a = Math.atan2(z, x);
    const f = 1 + 0.20 * Math.sin(a * 3 + t * 4) + 0.12 * Math.sin(a * 7 - t * 6.5) + 0.07 * Math.sin(a * 13 + t * 9);
    p.setXYZ(i, x * f, y + 0.05 * Math.sin(a * 5 + t * 3) * t * (1 - t) * 4, z * f);
  }
  g.computeVertexNormals(); return g;
}

/* ───────────── 잔디 무늬 (canvasTex 는 world.js 것을 넘겨받음) ───────────── */
export function grassTexNew(rep, base, canvasTex) {
  const t = canvasTex(256, 256, (x, w, h) => {
    const R = lcg(1234);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    const wrap = (fn) => { for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) fn(dx * w, dy * h); };   /* 가장자리에서 이어지게 */
    for (let i = 0; i < 28; i++) {                                    /* 큰 얼룩(밝은 곳·마른 곳) */
      const cx = R() * w, cy = R() * h, r = 22 + R() * 34, dry = R() < 0.3;
      wrap((ox, oy) => {
        const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        g.addColorStop(0, dry ? 'rgba(190,175,90,.16)' : (R() < 0.5 ? 'rgba(255,255,200,.09)' : 'rgba(20,60,20,.12)')); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
      });
    }
    x.lineCap = 'round';
    for (let i = 0; i < 760; i++) {                                   /* 풀잎 */
      const px = R() * w, py = R() * h, L = 5 + R() * 8, a = (R() - 0.5) * 0.8, dark = R() < 0.5;
      x.strokeStyle = dark ? `rgba(25,70,28,${0.22 + R() * 0.2})` : `rgba(200,235,120,${0.18 + R() * 0.2})`; x.lineWidth = 0.8 + R() * 1.1;
      wrap((ox, oy) => { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.sin(a) * L, py + oy - Math.cos(a) * L); x.stroke(); });
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}

/* ───────────── 입체 풀포기 · 들꽃 ───────────── */
let _tuft = null;
function tuftGeo() {
  if (_tuft) return _tuft;
  const R = lcg(7), list = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.ConeGeometry(0.055 + R() * 0.02, 0.45 + R() * 0.3, 3, 1, true);
    g.translate(0, g.parameters.height / 2, 0); g.rotateZ((R() - 0.5) * 0.6); g.rotateY(R() * TAU); g.translate((R() - 0.5) * 0.22, 0, (R() - 0.5) * 0.22);
    list.push(g);
  }
  const m = mergeGeos(list); m.computeVertexNormals(); paintByHeight(m, 0, 0.7, [0.42, 0.42, 0.42], [1, 1, 1]);
  return (_tuft = m);
}
export function scatterGrass(root, R, { tufts = 1500, flowers = 300, pick, accept }) {
  if (OFF) return;
  const k = isTouch ? 0.5 : 1, nT = Math.round(tufts * k), nF = Math.round(flowers * k), o = new THREE.Object3D(), c = new THREE.Color();
  const mt = new THREE.InstancedMesh(tuftGeo(), new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, side: THREE.DoubleSide }), nT);
  let i = 0, g = 0;
  while (i < nT && g++ < nT * 40) {
    const [x, z] = pick(); if (!accept(x, z)) continue;
    o.position.set(x, 0, z); o.rotation.set(0, R() * TAU, 0); o.scale.set(0.8 + R() * 0.8, 0.7 + R() * 1.0, 0.8 + R() * 0.8); o.updateMatrix();
    mt.setMatrixAt(i, o.matrix); mt.setColorAt(i, c.setHSL(0.24 + R() * 0.08, 0.45 + R() * 0.2, 0.30 + R() * 0.14)); i++;
  }
  mt.count = i; mt.instanceMatrix.needsUpdate = true; if (mt.instanceColor) mt.instanceColor.needsUpdate = true;
  mt.frustumCulled = false; mt.receiveShadow = true; root.add(mt);

  const fg = new THREE.IcosahedronGeometry(0.1, 0); fg.scale(1, 0.6, 1);
  const mf = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), nF);
  const PAL = ['#ffffff', '#ffe14d', '#ff8fb3', '#c9a6ff', '#ff7a59'];
  i = 0; g = 0;
  while (i < nF && g++ < nF * 40) {
    const [x, z] = pick(); if (!accept(x, z)) continue;
    o.position.set(x, 0.14, z); o.rotation.set(0, R() * TAU, 0); o.scale.setScalar(0.8 + R() * 0.7); o.updateMatrix();
    mf.setMatrixAt(i, o.matrix); mf.setColorAt(i, c.set(PAL[(R() * PAL.length) | 0])); i++;
  }
  mf.count = i; mf.instanceMatrix.needsUpdate = true; if (mf.instanceColor) mf.instanceColor.needsUpdate = true;
  mf.frustumCulled = false; root.add(mf);
}

/* ───────────── 광장 보도블록 (투명 덧판: 줄눈 + 블록별 색 차이) ───────────── */
export function plazaPaving(flat, canvasTex) {
  const S = 1024, C = S / 2;
  const tex = canvasTex(S, S, (x) => {
    const R = lcg(99);
    x.clearRect(0, 0, S, S);
    x.lineWidth = 2.2; x.strokeStyle = 'rgba(90,75,55,.38)';
    for (let i = 0; r0For(i) < C - 8; i++) {
      const r0 = r0For(i), r1 = r0 + 32, n = Math.max(6, Math.round((TAU * (r0 + 16)) / 52)), off = (i % 2) * (TAU / n / 2);
      for (let j = 0; j < n; j++) {
        const a0 = off + (j * TAU) / n, a1 = a0 + TAU / n;
        x.beginPath(); x.arc(C, C, r0, a0, a1); x.arc(C, C, Math.min(r1, C - 6), a1, a0, true); x.closePath();
        const v = R(); x.fillStyle = v < 0.5 ? `rgba(120,100,70,${0.03 + R() * 0.07})` : `rgba(255,250,235,${0.04 + R() * 0.08})`; x.fill(); x.stroke();
      }
    }
    x.lineWidth = 8; x.strokeStyle = 'rgba(120,95,60,.5)'; x.beginPath(); x.arc(C, C, C - 5, 0, TAU); x.stroke();
  }, 1);
  function r0For(i) { return 43 + i * 32; }
  const m = flat(new THREE.CircleGeometry(24, 64), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 0.035);
  return m;
}

/* ───────────── 가로등 ───────────── */
let _halo = null;
function haloTex() {
  if (_halo) return _halo;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,190,.95)'); gr.addColorStop(0.25, 'rgba(255,214,130,.45)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (_halo = t);
}
let _lampMats = null;
export function lampPost(root, x, z, anims) {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  const M = _lampMats || (_lampMats = {
    dark: new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.55, metalness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: '#8a7a52', roughness: 0.4, metalness: 0.7 }),
    bulb: new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffcf70', emissiveIntensity: 1.6 }),
  });
  const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  part(rcyl(0.38, 0.5, 0.35, 12), M.dark, 0.175);
  part(rcyl(0.22, 0.3, 0.5, 12), M.dark, 0.6);
  part(rcyl(0.07, 0.11, 3.6, 10), M.dark, 2.65);
  part(rcyl(0.16, 0.16, 0.12, 12), M.brass, 1.2);
  part(rcyl(0.3, 0.2, 0.18, 12), M.brass, 4.55);
  part(rsph(0.32, 12, 10), M.bulb, 4.85);
  part(new THREE.ConeGeometry(0.5, 0.35, 8), M.dark, 5.32);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6, toneMapped: false }));
  halo.scale.setScalar(3.2); halo.position.y = 4.85; g.add(halo);
  const ph = x * 0.37 + z * 0.19;
  if (anims) anims.push((dt, t) => { halo.material.opacity = 0.55 + Math.sin(t * 1.7 + ph) * 0.08; });
  return g;
}

/* ───────────── 벤치 ───────────── */
let _benchMats = null;
export function benchParts(g) {
  const M = _benchMats || (_benchMats = {
    wood: new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.5, metalness: 0.5 }),
  });
  const add = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  for (const zz of [-0.24, -0.08, 0.08, 0.24]) add(rbox(2.4, 0.07, 0.14), M.wood, 0, 0.56, zz);            /* 앉는 판 */
  [0.8, 0.96, 1.12].forEach((y, i) => add(rbox(2.4, 0.12, 0.05), M.wood, 0, y, -0.34 - i * 0.03, -0.12));    /* 등받이 */
  for (const sx of [-1.05, 1.05]) {
    add(rbox(0.08, 0.56, 0.08), M.iron, sx, 0.28, 0.24); add(rbox(0.08, 0.56, 0.08), M.iron, sx, 0.28, -0.24);   /* 다리 */
    add(rbox(0.08, 0.07, 0.6), M.iron, sx, 0.8, -0.02);                                                          /* 팔걸이 */
    add(rbox(0.08, 0.62, 0.08), M.iron, sx, 0.9, -0.34, -0.12);                                                  /* 등받이 기둥 */
    add(rbox(0.08, 0.26, 0.08), M.iron, sx, 0.68, 0.22);                                                         /* 팔걸이 받침 */
  }
}

/* ───────────── 부두 널판 ───────────── */
export function deckTex(canvasTex) {
  return canvasTex(512, 512, (x, w, h) => {
    const R = lcg(55), n = 8, ph = h / n;
    for (let i = 0; i < n; i++) {
      const v = 138 + R() * 40, y0 = i * ph;
      x.fillStyle = `rgb(${v | 0},${(v * 0.74) | 0},${(v * 0.5) | 0})`; x.fillRect(0, y0, w, ph);
      for (let k = 0; k < 40; k++) {
        const y = y0 + 4 + R() * (ph - 8);
        x.strokeStyle = `rgba(60,35,15,${0.05 + R() * 0.1})`; x.lineWidth = 0.6 + R() * 1.2;
        x.beginPath(); x.moveTo(R() * w * 0.3, y); x.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 4, w * 0.6, y + (R() - 0.5) * 4, w * (0.7 + R() * 0.3), y + (R() - 0.5) * 3); x.stroke();
      }
      x.fillStyle = 'rgba(30,18,8,.72)'; x.fillRect(0, y0, w, 4);               /* 이음새 */
      x.fillStyle = 'rgba(255,230,190,.12)'; x.fillRect(0, y0 + 4, w, 2);       /* 윗면 모서리 빛 */
      for (const nx of [18, w - 18]) { x.fillStyle = 'rgba(35,30,28,.8)'; x.beginPath(); x.arc(nx, y0 + ph / 2, 3.4, 0, TAU); x.fill(); }   /* 못 */
    }
  });
}