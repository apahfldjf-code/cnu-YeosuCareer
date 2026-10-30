/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea-kit.js (신규, 수산해양 S1) — 바다 무대 공용 도구
 *  - createSea     : 끝없이 이어지는 바다
 *  - buildPort     : 여수캠퍼스 선박실습센터 항구 (부두·창고·크레인·방파제·등대·산·섬)
 *  - makeResearchShip : 실습선 새동백호   /  makeCoastGuard : 해양경찰 함정  /  makeTug : 예인선
 *  - helm          : 조타 시스템 (키잡이 ◀▶ + 엔진 텔레그래프 ▲▼, 암초·부두 충돌, 항적)
 *  - buoy / reef / guide / netRig : 부표 · 암초 · 방향 지시기 · 트롤 어구
 * 한글 글자는 모두 canvas 로 직접 그려서 깨지지 않아요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { engine } from './core.js';

export const lim = (v, a, b) => Math.max(a, Math.min(b, v));
export const snd = (c, n) => { try { if (c.sfx && typeof c.sfx[n] === 'function') c.sfx[n](); } catch (e) { /* 무시 */ } };
export const vib = (c, ms) => { try { if (typeof c.buzz === 'function') c.buzz(ms); } catch (e) { /* 무시 */ } };
export const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/* 방위: 정면(+z)=북(000°), 오른쪽으로 돌수록 커져요 */
export const headingDeg = (h) => ((((-h * 180) / Math.PI) % 360) + 360) % 360;
export const bearingDeg = (dx, dz) => headingDeg(Math.atan2(dx, dz));
export const pad3 = (v) => String(Math.round(v) % 360).padStart(3, '0');
export const ENGINE = ['정지', '미속', '반속', '전속'];
export const KN = (v) => Math.round(v * 0.9);
export const SEA_ENV = { sky: '#9fd4ff', fog: ['#cfe8ff', 120, 430], sunColor: '#fff1d6', sunI: 1.7, hemi: ['#e4f3ff', '#4f7fa6', 1.0], sunPos: [60, 90, 40] };

/* ───────── 글자 텍스처 ───────── */
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
export function textTex(text, w, h, o = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  if (o.bg) { g.fillStyle = o.bg; if (o.round) { rr(g, 2, 2, w - 4, h - 4, o.round); g.fill(); } else g.fillRect(0, 0, w, h); }
  const lines = String(text).split('\n'); let fs = o.size || Math.floor(h / (lines.length + 0.5));
  const F = (s) => `800 ${s}px "Malgun Gothic","Noto Sans KR",sans-serif`;
  g.font = F(fs);
  while (fs > 10 && Math.max(...lines.map((l) => g.measureText(l).width)) > w * 0.92) { fs -= 2; g.font = F(fs); }
  g.fillStyle = o.color || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.18));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function tagSprite(text, bg, w = 14, h = 3.6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, 512, Math.round((512 * h) / w), { bg, round: 28 }), transparent: true, depthTest: false }));
  s.scale.set(w, h, 1); s.renderOrder = 10; return s;
}
function hullText(parent, text, pw, ph, x, y, z, side, o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: textTex(text, Math.round(pw * 110), Math.round(ph * 110), o), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.position.set(x, y, z); m.rotation.y = side === 'P' ? Math.PI / 2 : side === 'S' ? -Math.PI / 2 : Math.PI; parent.add(m); return m;
}

/* ───────── 바다 ───────── */
export function createSea(c) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#2a79b5'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, l = 10 + Math.random() * 32, a = 0.05 + Math.random() * 0.13;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1 + Math.random() * 2;
    for (const dx of [0, -256]) for (const dy of [0, -256]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + l / 2, y + dy - 4, x + dx + l, y + dy); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 60); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; c.root.add(m);
  return { mesh: m, update(px, pz, t) { m.position.set(Math.round(px / 20) * 20, 0, Math.round(pz / 20) * 20); tex.offset.set(t * 0.012, t * 0.007); } };
}

/* ───────── 선체 만들기 (위에서 본 모양을 뽑아 올림) ───────── */
function hullGeo(L, B, depth, bow) {
  const w = B / 2, s = new THREE.Shape();
  s.moveTo(-w, -L / 2); s.lineTo(w, -L / 2); s.lineTo(w, L / 2 - bow);
  s.quadraticCurveTo(w * 0.6, L / 2 - bow * 0.3, 0, L / 2);
  s.quadraticCurveTo(-w * 0.6, L / 2 - bow * 0.3, -w, L / 2 - bow); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(Math.PI / 2);   /* 위로 뽑은 방향이 아래(−y)로, 뱃머리가 +z 로 */
  return geo;
}
function hull(g, L, B, depth, bow, col, y) {
  const m = new THREE.Mesh(hullGeo(L, B, depth, bow), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }));
  m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}

/* ───────── 실습선 새동백호 (뱃머리 +z) ───────── */
export function makeResearchShip(c) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const L = 26, B = 5.6, W = B / 2, FB = 2.2, WH = '#f6f8fa', DK = '#1b2836', OR = '#e8602c';
  hull(g, L - 0.6, B - 0.6, 1.4, 6, '#1b2f55', 0);
  hull(g, L, B, FB, 7, '#f4f6f8', FB);
  [1, -1].forEach((s) => { c.box(0.05, 0.14, 16, '#2b66c9', s * (W + 0.01), 0.4, -1.5, g); c.box(0.1, 0.8, 17, '#e9edf1', s * (W - 0.12), FB + 0.4, -4, g); });
  c.box(B - 0.7, 0.06, 8.6, '#2f7d4a', 0, FB + 0.03, -8.4, g);                  /* 뒷갑판(초록) */
  /* 상부 구조 */
  c.box(4.6, 2.2, 9, WH, 0, FB + 1.1, 1.5, g); c.box(4.62, 0.4, 6.5, DK, 0, FB + 1.2, 1.9, g);
  c.box(4.2, 2.0, 6.5, WH, 0, FB + 3.2, 2.4, g); c.box(4.22, 0.4, 5.5, DK, 0, FB + 3.3, 2.7, g);
  c.box(3.7, 1.7, 3.4, WH, 0, FB + 5.05, 3.9, g); c.box(3.74, 0.62, 3.44, DK, 0, FB + 5.3, 3.9, g);
  c.sph(1.25, '#ffffff', 0, 7.7, 0.3, g); c.sph(0.55, '#ffffff', 1.1, 8.6, 3.2, g);
  c.box(1.8, 2.6, 2.4, '#1d3b73', 0, 5.7, -2.0, g); c.box(1.82, 0.5, 2.42, WH, 0, 6.2, -2.0, g);
  c.cyl(0.1, 0.12, 4, '#cdd3da', 0, 10.1, 3.6, g, 8); c.box(2.4, 0.1, 0.1, '#cdd3da', 0, 11.2, 3.6, g);
  /* 뒷부분 A자 틀 · 윈치 */
  [1, -1].forEach((s) => c.cyl(0.12, 0.12, 5, OR, s * 2.0, FB + 2.5, -12.2, g, 8));
  c.box(4.3, 0.25, 0.25, OR, 0, FB + 5, -12.2, g);
  c.cyl(0.6, 0.6, 2.8, '#586270', 0, FB + 0.7, -6.8, g, 14).rotation.z = Math.PI / 2;
  /* 구명정 */
  [1, -1].forEach((s) => { c.box(0.9, 0.7, 3.0, OR, s * 2.45, 4.9, 1.0, g); c.box(0.1, 1.6, 0.1, '#aab2bd', s * 2.45, 3.8, 0.2, g); c.box(0.1, 1.6, 0.1, '#aab2bd', s * 2.45, 3.8, 1.8, g); });
  c.cyl(0.5, 0.5, 0.8, '#7b8594', 0, FB + 0.4, 9.5, g, 10);
  /* 선체 글자 */
  [['P', 1], ['S', -1]].forEach(([sd, s]) => {
    hullText(g, '전남대학교', 7.0, 1.2, s * (W + 0.02), 1.15, 1.0, sd, { color: '#143a78' });
    hullText(g, 'SAE DONG BAEK  새동백호', 5.9, 0.8, s * (W + 0.02), 1.0, -9.6, sd, { color: '#143a78' });
  });
  hullText(g, 'SAE DONG BAEK\n새동백호', 4.2, 1.4, 0, 1.2, -L / 2 - 0.02, 'B', { color: '#143a78' });
  g.userData = { len: L, beam: B, deckY: FB, hitR: 5, crew: [0, FB + 0.06, -9.6], cam: { d: 30, h: 15, la: 16 }, wakeZ: L / 2 - 2, tagY: 15, name: '새동백호' };
  return g;
}

/* ───────── 해양경찰 함정 ───────── */
function stripeTex() {
  const w = 512, h = 128, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  [['#d8232a', 0], ['#f6c200', 70], ['#0d3b8e', 140]].forEach(([col, x]) => { g.fillStyle = col; g.beginPath(); g.moveTo(x + 40, 0); g.lineTo(x + 110, 0); g.lineTo(x + 70, h); g.lineTo(x, h); g.closePath(); g.fill(); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeCoastGuard(c) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const L = 24, B = 4.8, W = B / 2, FB = 1.9, WH = '#f6f8fa', DK = '#1b2836';
  hull(g, L - 0.6, B - 0.5, 1.3, 6.5, '#14233f', 0);
  hull(g, L, B, FB, 6.5, '#f4f6f8', FB);
  c.box(4.0, 1.8, 9, WH, 0, FB + 0.9, 0.5, g); c.box(4.02, 0.4, 7.5, DK, 0, FB + 1.1, 0.9, g);
  c.box(3.5, 1.6, 4, WH, 0, FB + 2.6, 2.0, g); c.box(3.54, 0.55, 4.04, DK, 0, 4.75, 2.0, g);
  c.cyl(0.09, 0.11, 5, '#cdd3da', 0, 7.8, 1.6, g, 8); c.box(2.2, 0.12, 0.4, '#444a55', 0, 9.6, 1.6, g);
  const bar = c.box(1.2, 0.15, 0.3, '#2a6bff', 0, 5.4, 0.4, g); bar.material.emissive = new THREE.Color('#2a6bff'); bar.material.emissiveIntensity = 0.8;
  c.box(1.5, 1.6, 2, '#8d97a5', 0, 4.5, -2.5, g);
  c.box(3.4, 1.9, 3.2, WH, 0, FB + 0.95, -6.0, g);                              /* 격납고 */
  c.box(4.4, 0.08, 5, '#6b7585', 0, FB + 0.04, -9.6, g);                       /* 헬기 갑판 */
  const H = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: textTex('H', 128, 128, { color: '#f6c200', size: 110 }), transparent: true })); H.rotation.x = -Math.PI / 2; H.position.set(0, FB + 0.1, -9.6); g.add(H);
  c.cyl(0.12, 0.16, 0.8, '#d8232a', 0, FB + 0.4, 8.0, g, 8); c.cyl(0.08, 0.08, 1.0, '#d8232a', 0, FB + 0.95, 8.3, g, 8).rotation.x = 1.2;   /* 소방 물대포 */
  [1, -1].forEach((s) => { c.box(0.9, 0.6, 3.4, '#ff7a1a', s * 2.45, 3.0, 0, g); c.box(0.1, 1.2, 0.1, '#aab2bd', s * 2.4, 2.4, -1.4, g); c.box(0.1, 1.2, 0.1, '#aab2bd', s * 2.4, 2.4, 1.4, g); });
  [['P', 1], ['S', -1]].forEach(([sd, s]) => {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: stripeTex(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    st.position.set(s * (W + 0.02), 0.95, 2.4); st.rotation.y = sd === 'P' ? Math.PI / 2 : -Math.PI / 2; g.add(st);
    hullText(g, 'KOREA COAST GUARD', 9, 0.9, s * (W + 0.02), 1.0, -6.2, sd, { color: '#0d3b8e' });
  });
  hullText(g, '해양경찰\n122', 3.4, 1.3, 0, 1.0, -L / 2 - 0.02, 'B', { color: '#0d3b8e' });
  g.userData = { len: L, beam: B, deckY: FB, hitR: 4.6, crew: [0, FB + 0.08, -9.6], cam: { d: 26, h: 13, la: 14 }, wakeZ: L / 2 - 2, tagY: 12.5, name: '해양경찰 함정' };
  return g;
}

/* ───────── 예인선(항구 장식) ───────── */
export function makeTug(c) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const L = 10, B = 3.6, FB = 1.3;
  hull(g, L - 0.4, B - 0.4, 1.0, 3, '#202833', 0); hull(g, L, B, FB, 3, '#c0392b', FB);
  c.box(2.4, 1.4, 3.2, '#f4f6f8', 0, FB + 0.7, -0.6, g); c.box(2.0, 1.0, 2.2, '#f4f6f8', 0, FB + 1.9, -0.4, g); c.box(2.02, 0.4, 2.22, '#1b2836', 0, FB + 2.0, -0.4, g);
  c.cyl(0.4, 0.5, 1.5, '#c0392b', 0, FB + 2.95, -1.8, g, 10); c.sph(0.35, '#222831', 0, FB - 0.1, L / 2 - 0.1, g);
  g.userData = { len: L, beam: B, deckY: FB, hitR: 2.5, crew: [0, FB, -3], cam: { d: 16, h: 9, la: 8 }, wakeZ: L / 2 - 1, tagY: 8, name: '예인선' };
  return g;
}

/* ───────── 항구 ───────── */
export function buildPort(c) {
  const g = new THREE.Group(); c.root.add(g);
  const PIERS = [-40, -16, 8, 32], PIER_END = 38, PL = PIER_END + 12, PZ = (PIER_END - 12) / 2;

  /* 육지·부두 앞 가장자리(z=-12) */
  c.box(800, 2, 70, '#aab2bd', 0, 0.5, -47, g);
  c.box(800, 2, 300, '#7a9a6a', 0, 0.5, -232, g);
  c.box(800, 0.12, 0.7, '#e0b13a', 0, 1.56, -12.5, g);
  for (let x = -120; x <= 120; x += 8) c.cyl(0.35, 0.42, 0.6, '#2b2f36', x, 1.8, -13.4, g, 10);

  /* 칸막이 방파제(돌출 부두): 선석 사이마다 1개, 끝에 항로등 */
  PIERS.forEach((px, i) => {
    c.box(3, 2, PL, '#aab2bd', px, 0.5, PZ, g);
    c.box(0.35, 0.05, PL, '#e0b13a', px, 1.53, PZ, g);
    [1, -1].forEach((s) => c.box(0.25, 0.7, PL - 4, '#2b2f36', px + s * 1.6, 0.7, PZ, g));
    const col = i % 2 ? '#3ddc84' : '#ff5a4d';
    c.cyl(0.1, 0.1, 3.4, '#666b75', px, 3.2, PIER_END - 1, g, 6);
    const lamp = c.sph(0.45, col, px, 5.0, PIER_END - 1, g); lamp.material.emissive = new THREE.Color(col); lamp.material.emissiveIntensity = 0.9;
    for (let z = -4; z <= PIER_END - 4; z += 10) c.cyl(0.3, 0.36, 0.5, '#2b2f36', px, 1.75, z, g, 8);
  });

  /* 선석 표지판 */
  [[-28, '1번 선석\n실습선'], [-4, '2번 선석\n해양경찰'], [20, '3번 선석\n예인선']].forEach(([bx, txt]) => {
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ map: textTex(txt, 512, 192, { bg: '#0f3d73', round: 22 }) }));
    sg.position.set(bx, 11, -17); g.add(sg);
    [-3, 3].forEach((dx) => c.cyl(0.12, 0.12, 9, '#666b75', bx + dx, 6.2, -17.1, g, 6));
  });

  /* 창고·건물 */
  [[-70, 26, 16, 9, '#8497ae'], [-34, 24, 14, 8, '#e9eef4'], [10, 26, 16, 11, '#91a6bd'], [70, 24, 14, 8, '#d9c9a3'], [-100, 18, 12, 7, '#c5d0dc']].forEach(([x, w, d, h, col]) => {
    c.box(w, h, d, col, x, 1.5 + h / 2, -48, g); c.box(w + 0.6, 0.5, d + 0.6, '#4a5568', x, 1.5 + h + 0.25, -48, g);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ map: textTex('선박실습센터', 700, 120, { bg: '#0f3d73', round: 18 }) }));
  sign.position.set(-34, 8, -40.9); g.add(sign);

  /* 컨테이너 야적장 */
  const cc = ['#d94a3d', '#2f6fed', '#e8b92f', '#3aa86a', '#8e5cf2', '#ff8a3d'];
  for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 3; iz++) for (let h = 0; h <= (ix + iz) % 3; h++) c.box(2.7, 1.2, 1.2, cc[(ix * 3 + iz + h) % 6], 64 + ix * 3, 2.1 + h * 1.2, -20 - iz * 1.4, g);

  /* 겐트리 크레인 */
  [-3, 3].forEach((dx) => { [-24, -16].forEach((z) => c.box(0.7, 14, 0.7, '#d94a3d', 48 + dx, 8.5, z, g)); c.box(0.8, 0.9, 34, '#d94a3d', 48 + dx, 15.5, -9, g); });
  c.box(6.8, 0.9, 0.9, '#d94a3d', 48, 15.5, -20, g); c.box(2.6, 1.2, 1.1, '#2f6fed', 48, 11, -4, g); c.box(0.08, 4, 0.08, '#333', 48, 13.2, -4, g);

  /* 외곽 방파제 + 등대 (동쪽) */
  c.box(12, 2.6, 58, '#9a9fa7', 101, 0.3, 16, g);
  c.cyl(1.2, 1.6, 8, '#f1f1f1', 101, 5.6, 44, g, 12); c.cyl(1.25, 1.25, 1.6, '#d6453d', 101, 8.6, 44, g, 12);
  const lamp = c.cyl(0.8, 0.8, 1.2, '#ffe08a', 101, 10, 44, g, 12); lamp.material.emissive = new THREE.Color('#ffcc55'); lamp.material.emissiveIntensity = 0.9;
  c.cyl(0.1, 1.1, 1.0, '#d6453d', 101, 11.1, 44, g, 12);

  /* 먼 산 · 섬 */
  [[-260, -230, 90, 60], [-120, -260, 110, 75], [60, -250, 100, 55], [200, -240, 95, 65], [320, -120, 80, 50], [-330, -100, 85, 55]].forEach(([x, z, r, h], i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshStandardMaterial({ color: i % 2 ? '#4d7a57' : '#5b8a63', roughness: 1, flatShading: true })); m.position.set(x, h / 2 - 2, z); g.add(m);
  });
  const isl = [[-240, 40, 28], [210, 150, 30], [-120, 330, 24]];
  isl.forEach(([x, z, r]) => {
    const m = c.sph(r, '#6e8f62', x, 0, z, g); m.scale.y = 0.35;
    const k = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, r * 0.6, 6), new THREE.MeshStandardMaterial({ color: '#8a8f98', roughness: 1, flatShading: true })); k.position.set(x + r * 0.2, r * 0.3, z); g.add(k);
  });

  return {
    g, islands: isl.map(([x, z, r]) => ({ x, z, r: r * 0.95 })),
    walls: [{ x0: -400, x1: 400, z0: -400, z1: -12 }]
      .concat(PIERS.map((px) => ({ x0: px - 1.5, x1: px + 1.5, z0: -13, z1: PIER_END })))
      .concat([{ x0: 95, x1: 107, z0: -13, z1: 45 }]),
    /* 뱃머리 +z(북쪽, 바다 쪽)로 정박 — 고물이 부두 앞(z=-12)에 닿을 듯 말 듯 */
    moor: { sae: { x: -28, z: 2, h: 0 }, kcg: { x: -4, z: 1, h: 0 }, tug: { x: 20, z: -6, h: 0 } },
  };
}

/* ───────── 부표 · 암초 · 방향 지시기 ───────── */
export function buoy(c, parent, n, x, z, col = '#e8602c') {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  c.cyl(0.55, 0.85, 1.3, col, 0, 0.45, 0, g, 12); c.cyl(0.4, 0.4, 0.5, '#f4f4f4', 0, 1.3, 0, g, 12); c.cyl(0.12, 0.12, 2.2, '#444444', 0, 2.5, 0, g, 6);
  const lamp = c.sph(0.35, '#ffe08a', 0, 3.8, 0, g); lamp.material.emissive = new THREE.Color('#ffcc55'); lamp.material.emissiveIntensity = 0.9;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(String(n), 128, 128, { bg: 'rgba(10,30,60,.82)', round: 40 }), transparent: true, depthTest: false }));
  sp.scale.set(3.2, 3.2, 1); sp.position.y = 6.3; sp.renderOrder = 10; g.add(sp);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 30; g.add(beam);
  return {
    g, x, z, beam,
    active(v) { beam.material.opacity = v ? 0.24 : 0; sp.material.opacity = 1; },
    done() { beam.material.opacity = 0; sp.material.opacity = 0.35; lamp.material.emissive.set('#33dd77'); },
  };
}
export function reef(c, parent, x, z, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: '#5d6672', roughness: 0.95, flatShading: true }));
  m.scale.set(1, 0.55, 1); m.position.y = 0.2; m.castShadow = true; g.add(m);
  const foam = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.5, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.12; g.add(foam);
  c.cyl(0.12, 0.12, 3.2, '#d94a3d', r * 0.6, 1.6, 0, g, 6); c.box(0.9, 0.5, 0.06, '#d94a3d', r * 0.6 + 0.45, 2.9, 0, g);
  return { x, z, r: r * 0.9 };
}
export function guide(c) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;top:calc(60px + env(safe-area-inset-top,0px));left:calc(50% - var(--rw,0px)/2);transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:5px 14px;border-radius:14px;background:rgba(10,30,60,.72);font-weight:800;font-size:calc(14px*var(--xs,1));pointer-events:none;white-space:nowrap';
  const a = document.createElement('span'); a.style.cssText = 'display:inline-block;font-size:24px;color:#ffd34d'; a.textContent = '▲';
  const t = document.createElement('span'); d.append(a, t); c.ui.layer.append(d);
  return {
    set(rel, text) { d.style.display = 'flex'; a.style.transform = `rotate(${-rel}rad)`; t.textContent = text; },
    hide() { d.style.display = 'none'; },
  };
}

/* ───────── 트롤 어구 (뒷갑판 A자 틀에서 끌려가는 그물) ───────── */
export function netRig(ship) {
  const U = ship.userData, g = new THREE.Group(); g.visible = false; ship.add(g);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const line = (a, b) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: '#2b2f36' }));
    const d = new THREE.Vector3().subVectors(b, a), len = Math.max(0.001, d.length());
    m.scale.set(1, len, 1); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m);
  };
  const tip1 = V(-2, U.deckY + 5, -12.2), tip2 = V(2, U.deckY + 5, -12.2), f1 = V(-2.8, 0.2, -25), f2 = V(2.8, 0.2, -25), tail = V(0, 0.15, -35);
  line(tip1, f1); line(tip2, f2); line(f1, f2); line(f1, tail); line(f2, tail);
  [f1, f2, tail].forEach((p, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(i < 2 ? 0.42 : 0.3, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.6 })); s.position.copy(p); g.add(s); });
  return g;
}

/* ───────── 조타 시스템 ─────────
 * helm(c, ship, { reefs:[{x,z,r}], walls:[{x0,x1,z0,z1}], limit, speeds, onHit })
 *  ◀▶ 키잡이(키·A/D)   ▲▼ 엔진 텔레그래프(W/S 한 단계씩)   → S.speed / S.hdg / S.x / S.z */
export function helm(c, ship, o = {}) {
  const { ui, cam, keys } = c, U = ship.userData;
  const S = { x: ship.position.x, z: ship.position.z, hdg: ship.rotation.y, speed: 0, thr: 0, rud: 0, hits: 0, on: false, cd: 0 };
  const SPD = o.speeds || [0, 4, 8, 13], reefs = o.reefs || [], walls = o.walls || [], limit = o.limit || 330;
  const step = (d) => { if (!S.on) return; S.thr = lim(S.thr + d, 0, 3); snd(c, 'click'); vib(c, 10); };
  const mk = (icon, label, pos, cb) => { const b = ui.button({ icon, label, size: 64, pos, down: cb }); b.show(false); return b; };
  const L = mk('◀', '좌현', { left: '16px', bottom: '46px' }), R = mk('▶', '우현', { left: '92px', bottom: '46px' });
  const UP = mk('▲', '가속', { right: '26px', bottom: '122px' }, () => step(1)), DN = mk('▼', '감속', { right: '26px', bottom: '46px' }, () => step(-1));

  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(-(U.beam / 2 + 1.2), -14); ws.lineTo(U.beam / 2 + 1.2, -14); ws.closePath();
  const wg = new THREE.ShapeGeometry(ws); wg.rotateX(Math.PI / 2);
  const wk = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  wk.position.set(0, 0.12, U.wakeZ); ship.add(wk);

  const probes = [[0.38 * U.len, 2.3], [0, U.beam / 2 + 0.2], [-0.35 * U.len, 2.3]];
  const bump = (k) => {
    S.speed *= k; if (S.cd > 0) return; S.cd = 1.2; S.hits++; snd(c, 'bump'); vib(c, 60);
    ui.pop('쿵! 충돌 ⚠', ship.position.clone().add(new THREE.Vector3(0, 6, 0)), '#ff8a80'); if (o.onHit) o.onHit(S.hits);
  };
  const resolve = () => {
    let any = false;
    for (const [off, pr] of probes) {
      for (const r of reefs) {
        const px = S.x + Math.sin(S.hdg) * off, pz = S.z + Math.cos(S.hdg) * off, dx = px - r.x, dz = pz - r.z, m = r.r + pr, d2 = dx * dx + dz * dz;
        if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001, k = (m - d) / d; S.x += dx * k; S.z += dz * k; any = true; }
      }
      for (const w of walls) {
        const px = S.x + Math.sin(S.hdg) * off, pz = S.z + Math.cos(S.hdg) * off;
        const qx = lim(px, w.x0, w.x1), qz = lim(pz, w.z0, w.z1), dx = px - qx, dz = pz - qz, d2 = dx * dx + dz * dz;
        if (d2 < pr * pr) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (pr - d) / d; S.x += dx * k; S.z += dz * k; }
          else { const a = px - w.x0, b = w.x1 - px, e = pz - w.z0, f = w.z1 - pz, m = Math.min(a, b, e, f); if (m === a) S.x -= a + pr; else if (m === b) S.x += b + pr; else if (m === e) S.z -= e + pr; else S.z += f + pr; }
          any = true;
        }
      }
    }
    return any;
  };

  return {
    S, step,
    on(v) { S.on = v; [L, R, UP, DN].forEach((b) => b.show(v)); try { if (v) engine.start(); else engine.stop(); } catch (e) { /* 무시 */ } },
    park(x, z, h) { S.x = x; S.z = z; S.hdg = h; },
    update(dt, t) {
      S.cd = Math.max(0, S.cd - dt);
      if (S.on) {
        const tn = (L.held() || keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (R.held() || keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
        S.rud += (tn - S.rud) * Math.min(1, 3 * dt);
        S.speed += (SPD[S.thr] - S.speed) * Math.min(1, 0.7 * dt);
        S.hdg += S.rud * 0.8 * Math.min(1, 0.22 + S.speed / 5) * dt;
        S.x += Math.sin(S.hdg) * S.speed * dt; S.z += Math.cos(S.hdg) * S.speed * dt;
        if (resolve()) bump(0.4);
        const rr2 = Math.hypot(S.x, S.z); if (rr2 > limit) { S.x *= limit / rr2; S.z *= limit / rr2; S.speed *= 0.97; }
        try { engine.set(S.speed * 1.1); } catch (e) { /* 무시 */ }
      }
      ship.position.set(S.x, Math.sin(t * 1.3) * 0.12 - 0.05, S.z);
      ship.rotation.set(Math.sin(t * 0.9) * 0.012, S.hdg, -S.rud * S.speed * 0.01 + Math.sin(t * 1.1) * 0.025);
      wk.material.opacity = 0.55 * lim(S.speed / 10, 0, 1); wk.scale.set(0.6 + S.speed / 20, 1, 0.4 + S.speed / 13);
    },
    chase() {
      const sx = Math.sin(S.hdg), cz = Math.cos(S.hdg), k = U.cam;
      cam.to([S.x - sx * k.d, k.h, S.z - cz * k.d], [S.x + sx * k.la, 1.5, S.z + cz * k.la]);
    },
    dispose() { try { engine.stop(); } catch (e) { /* 무시 */ } },
  };
}