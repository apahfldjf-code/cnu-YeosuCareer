/* ═══════════════════════════════════════════════════════════════
 * src/world.js  v2 (2단계) — 4개 월드: 캠퍼스 · 레이싱 · 축구 · FPS 훈련장
 * export buildWorlds(scene) → { worlds:{campus,race,soccer,fps}, sun, hemi }
 *
 * [game.js 계약 준수]
 *  공통  : id, root, env, spawn, limit, mapR, colliders[{x,z,r,h}], portals[{x,z,r,to,label}], dummies[{x,z,r,mesh}], update(dt,t)
 *  campus: booths[], kiosk, coins[], ballSpots[]
 *  race  : W{TRACK_R,TRACK_W,LIMIT}, pads[], coins[], kartSpawn, garage, ballSpots[]
 *  soccer: pitch{x,z,hw,hl}, ballSpots[]
 *  fps   : lootSpots[{x,z,tier}], droneSpots[{x,z,kind}]   kind = 'scout' | 'guard' | 'heavy'
 *
 * [참고] portals[].label 에는 "[E]" 를 넣지 않았습니다(game.js 가 붙인다고 가정).
 * [참고] FPS 월드 건물은 카메라 가림을 막기 위해 지붕 없는 "훈련용 모형 건물" 입니다.
 * [참고] 부스 NPC 는 createCharacter(look,{coat}) 를 씁니다 → core.js(3단계)가 이 시그니처와 tick(dt)를 유지해야 합니다.
 * [참고] 외부 에셋 없이 전부 코드(캔버스 텍스처 + 기본 도형)로 만듭니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { DEPTS, COLLEGES } from './data.js';
import { createCharacter } from './core.js';
import { makeJnuLogo, makePromoBoard } from './promo.js';
import { decorateAll } from './deco.js';
import { makeResearchShip } from './exp-sea-kit.js';
import { rbox, rcyl, rsph } from './round.js';
import { crownGeo, hillGeo, grassTexNew, scatterGrass, plazaPaving, lampPost, benchParts, deckTex } from './scenery.js';


const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const TAU = Math.PI * 2, HP = Math.PI / 2;
const rad = (d) => (d * Math.PI) / 180;
const mulberry = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const ringPick = (R, r0, r1) => () => { const r = r0 + R() * (r1 - r0), a = R() * TAU; return [r * Math.cos(a), r * Math.sin(a)]; };

/* ───────────── 공용 도우미 ───────────── */
/* 글씨 판 선명도: 크기별 슈퍼샘플링 + 텍스처 메모리 예산(넘으면 자동으로 낮춤) */
const TEX_BUDGET = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) ? 26e6 : 90e6; // 화소 수 상한
let texUsed = 0, texCount = 0;
function canvasTex(w, h, draw, ssForce) {
  const area = w * h;
  let ss = ssForce || (area <= 131072 ? 2 : area <= 524288 ? 1.5 : 1);        // 작은 판일수록 크게
  if (texUsed > TEX_BUDGET * 0.6) ss = Math.min(ss, 1.5);                      // 예산 60% 넘으면 1.5배까지
  if (texUsed > TEX_BUDGET) ss = 1;                                            // 예산 초과면 원래 크기
  ss = Math.min(ss, 2048 / Math.max(w, h));                                    // 한 변 2048 제한
  const cw = Math.round(w * ss), ch = Math.round(h * ss);
  texUsed += cw * ch; texCount++;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'); x.scale(cw / w, ch / h); x.imageSmoothingQuality = 'high'; draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  return t;
}
if (typeof window !== 'undefined') window.__tex = () => ({ textures: texCount, megaPixels: +(texUsed / 1e6).toFixed(1), budgetMP: TEX_BUDGET / 1e6 });
function rrect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function label(text, { bg = 'rgba(10,30,60,.85)', scale = 8 } = {}) {
  const t = canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = bg; rrect(x, 4, 4, w - 8, h - 8, 28); x.fill(); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let s = 54; do { x.font = `bold ${s}px ${FONT}`; s -= 2; } while (x.measureText(text).width > w - 40 && s > 20);
    x.fillText(text, w / 2, h / 2 + 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(scale, scale / 4, 1); return sp;
}
function emojiTex(ch) {
  return canvasTex(128, 128, (x) => { x.fillStyle = 'rgba(10,30,60,.8)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.font = '70px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70); }, 2);
}
const grassTex = (rep, base = '#6fae5b') => grassTexNew(rep, base, canvasTex);
function grassTexOld(rep, base = '#6fae5b') {
  const t = canvasTex(128, 128, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${130 + Math.random() * 50 | 0},${60 + Math.random() * 30 | 0},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
function kit(root, colliders) {
  const add = (o, cast = true) => { o.castShadow = cast; o.receiveShadow = true; root.add(o); return o; };
  const flat = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; root.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, cast = true) => { const m = new THREE.Mesh(rbox(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; return add(m, cast); };
  const col = (x, z, r, h = 3) => colliders.push({ x, z, r, h });
  return { add, flat, box, col };
}
function instanced(root, geo, mat, n, fill, cast = true) {
  const im = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); fill(o, i, im); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; root.add(im); return im;
}
const CROWD = ['#e0533d', '#4c8dd9', '#f2d34b', '#47b5a2', '#c06bd8', '#ffffff', '#ff9f43'];
function crowd(root, R, pts) {
  instanced(root, rsph(0.36, 8, 6), M('#ffffff'), pts.length, (o, i, im) => {
    o.position.set(pts[i][0], pts[i][1], pts[i][2]); o.scale.setScalar(0.85 + R() * 0.3); im.setColorAt(i, new THREE.Color(CROWD[(R() * CROWD.length) | 0]));
  }, false);
}
function trees(root, colliders, R, n, pick, accept, hue = 0.29) {
  const tr = new THREE.InstancedMesh(rcyl(0.25, 0.35, 2, 6), M('#7a5230'), n), cr = new THREE.InstancedMesh(crownGeo(), M('#ffffff', { roughness: 0.9, vertexColors: true }), n);
  tr.castShadow = cr.castShadow = true; tr.frustumCulled = cr.frustumCulled = false;
  const o = new THREE.Object3D(), c = new THREE.Color(); let k = 0, g = 0;
  while (k < n && g++ < n * 80) {
    const [x, z] = pick(); if (!accept(x, z)) continue;
    const s = 0.8 + R() * 0.7;
    o.rotation.set(0, R() * 6, 0); o.scale.setScalar(s);
    o.position.set(x, s, z); o.updateMatrix(); tr.setMatrixAt(k, o.matrix);
    o.position.set(x, 3 * s, z); o.updateMatrix(); cr.setMatrixAt(k, o.matrix);
    cr.setColorAt(k, c.setHSL(hue - 0.02 + R() * 0.07, 0.5, 0.26 + R() * 0.08));
    colliders.push({ x, z, r: 0.8, h: 5 }); k++;
  }
  tr.count = cr.count = k; root.add(tr, cr);
}
function hills(root, R, n, d0, d1, color) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3, d = d0 + R() * (d1 - d0), r = 40 + R() * 60, h = 25 + R() * 45;
        const m = new THREE.Mesh(hillGeo(), M(color, { roughness: 1 })); m.scale.set(r, h, r); m.position.set(Math.cos(a) * d, h / 2 - 3, Math.sin(a) * d); root.add(m);
  }
}
/* 하늘 돔 + 해 + 구름. 반환값은 매 프레임 호출할 함수 */
function sky(root, { stops, sunDir, glow = '#ffb060', clouds = 14, tint = '#ffffff', R }) {
  const tex = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([p, c]) => g.addColorStop(p, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(rsph(640, 32, 20), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.renderOrder = -10; dome.frustumCulled = false; root.add(dome);
  const sg = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.1, '#fff4cc'); g.addColorStop(0.3, glow + 'aa'); g.addColorStop(1, glow + '00'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sg, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  sun.scale.set(230, 230, 1); sun.position.copy(new THREE.Vector3(...sunDir).normalize().multiplyScalar(560)); sun.renderOrder = -9; root.add(sun);
  const ct = canvasTex(256, 128, (x) => { for (let i = 0; i < 14; i++) { const cx = 50 + R() * 156, cy = 50 + R() * 30, r = 22 + R() * 26, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } });
  const grp = new THREE.Group();
  for (let i = 0; i < clouds; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, color: tint, transparent: true, opacity: 0.55 + R() * 0.3, depthWrite: false, fog: false, toneMapped: false }));
    const a = R() * TAU, rr = 300 + R() * 220; m.position.set(Math.cos(a) * rr, 70 + R() * 110, Math.sin(a) * rr); m.scale.set(110 + R() * 120, 45 + R() * 35, 1); grp.add(m);
  }
  root.add(grp); return (dt) => { grp.rotation.y += dt * 0.003; };
}
/* 진로코인 */
function coinMaker(root, coins) {
  const cg = rcyl(0.55, 0.55, 0.12, 16); cg.rotateX(Math.PI / 2);
  const cm = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#a07800', metalness: 0.6, roughness: 0.3 });
  return (x, z) => { const m = new THREE.Mesh(cg, cm); m.position.set(x, 1.2, z); m.castShadow = true; root.add(m); coins.push({ mesh: m, x, z, got: false, ph: Math.random() * 6 }); };
}
const spinCoins = (coins, dt, t) => coins.forEach((c) => { if (!c.got) { c.mesh.rotation.y += dt * 3; c.mesh.position.y = 1.2 + Math.sin(t * 2 + c.ph) * 0.15; } });
/* 훈련용 오뚝이 샌드백 */
function dummy(root, colliders, x, z, color = '#e0533d') {
  const m = new THREE.Group(); m.position.set(x, 0, z);
  [[rcyl(0.65, 0.7, 0.18, 16), M('#444'), 0.09], [rcyl(0.42, 0.55, 1.5, 14), M(color), 1.0], [rsph(0.34, 14, 10), M('#f1e3c8'), 2.0]]
    .forEach(([g, mt, py]) => { const o = new THREE.Mesh(g, mt); o.position.y = py; o.castShadow = true; m.add(o); });
  const st = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), M('#ffffff')); st.rotation.x = HP; st.position.y = 1.2; m.add(st);
  root.add(m); colliders.push({ x, z, r: 0.7, h: 2.3 });
  return { x, z, r: 0.7, mesh: m, wob: 0, dir: 0 };
}
/* 월드 이동 포털 */
function makePortal(root, anims, { x, z, to, sign, color, label: text }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); root.add(g);
  const em = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }), dk = M('#2b3350');
  const base = new THREE.Mesh(rcyl(4, 4.3, 0.3, 40), dk); base.position.y = 0.15; base.receiveShadow = true; g.add(base);
  const rb = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.08, 6, 48), em); rb.rotation.x = HP; rb.position.y = 0.32; g.add(rb);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 12, 48), em); rg.position.y = 3.3; rg.castShadow = true; g.add(rg);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(rbox(0.7, 1.2, 0.7), dk); p.position.set(sx * 2.7, 0.9, 0); p.castShadow = true; g.add(p); }
  const sw = canvasTex(128, 128, (c) => {
    const gr = c.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, color + 'ff'); gr.addColorStop(0.6, color + '88'); gr.addColorStop(1, color + '11'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 5; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(64, 64, 14 + k * 13, k, k + 2.2); c.stroke(); }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.55, 40), new THREE.MeshBasicMaterial({ map: sw, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); disc.position.y = 3.3; g.add(disc);
  const l = label(sign, { bg: color, scale: 9 }); l.position.set(0, 7.3, 0); g.add(l);
  anims.push((dt, t) => { disc.rotation.z += dt * 1.6; disc.material.opacity = 0.7 + Math.sin(t * 3) * 0.15; em.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4; });
  return { x, z, r: 4, to, label: text };
}
/* ───── 광장 → 포털 돌길 : 돌길 + 바닥 화살표(체험명) + 옅은 발광 라인 + 입구 이정표 ───── */
const PATH = { r0: 23, r1: 96, w: 5, gateR: 27.5 };
let PATH_ASSET = null;
function pathAssets() {
  if (PATH_ASSET) return PATH_ASSET;
  const L = PATH.r1 - PATH.r0, R = mulberry(5), shade = [];
  for (let r = 0; r < 4; r++) { shade.push([]); for (let i = 0; i < 4; i++) shade[r].push(R()); }
  /* 돌길 타일: 한 장이 5m × 5m, 길이 방향으로 반복 */
  const stone = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8a8478'; x.fillRect(0, 0, w, h);
    const sw = w / 4, sh = h / 4;
    for (let r = 0; r < 4; r++) for (let i = -1; i < 4; i++) {
      const X = i * sw + (r % 2) * sw / 2, v = shade[r][(i + 4) % 4], c = 196 + ((v * 26) | 0);
      x.fillStyle = `rgb(${c},${c - 6},${c - 20})`; rrect(x, X + 3, r * sh + 3, sw - 6, sh - 6, 8); x.fill();
    }
    for (let k = 0; k < 260; k++) { x.fillStyle = `rgba(90,80,60,${0.05 + R() * 0.08})`; x.fillRect(R() * w, R() * h, 2, 2); }
    x.fillStyle = '#6a655a'; x.fillRect(0, 0, w, 6); x.fillRect(0, h - 6, w, 6);   // 양쪽 가장자리 돌
  });
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping; stone.repeat.set(L / PATH.w, 1);
  /* 발광 라인용 무늬: 길 방향으로 밝았다 흐려지는 띠(흘러가는 느낌), 폭 방향으로 가장자리가 부드럽게 */
  const glow = canvasTex(128, 16, (x, w, h) => {
    const gx = x.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,.35)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,.35)');
    x.fillStyle = gx; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in';
    const gy = x.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gy; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
  });
  glow.wrapS = glow.wrapT = THREE.RepeatWrapping; glow.repeat.set(L / 10, 1);
  const mat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  return (PATH_ASSET = { stone, glow, mat });
}
/* 바닥 화살표: 이름이 있으면 큰 화살표 + 체험명 판, 없으면 진행 방향 쐐기(>) 3개 */
function arrowDecal(color, text) {
  return canvasTex(256, 256, (x, w, h) => {
    x.lineJoin = 'round'; x.lineCap = 'round';
    if (text) {
      const cy = 72, s = 52;
      x.beginPath(); x.moveTo(w / 2, cy - s); x.lineTo(w / 2 + s * 0.95, cy + s * 0.25); x.lineTo(w / 2 + s * 0.42, cy + s * 0.25);
      x.lineTo(w / 2 + s * 0.42, cy + s * 0.9); x.lineTo(w / 2 - s * 0.42, cy + s * 0.9); x.lineTo(w / 2 - s * 0.42, cy + s * 0.25);
      x.lineTo(w / 2 - s * 0.95, cy + s * 0.25); x.closePath();
      x.fillStyle = color; x.fill(); x.lineWidth = 8; x.strokeStyle = 'rgba(255,255,255,.92)'; x.stroke();
      rrect(x, 14, 150, w - 28, 92, 22); x.fillStyle = 'rgba(10,30,60,.82)'; x.fill(); x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let sz = 46; do { x.font = `bold ${sz}px ${FONT}`; sz -= 2; } while (x.measureText(text).width > w - 60 && sz > 18);
      x.fillText(text, w / 2, 198);
    } else {
      [[190, 0.5], [130, 0.78], [70, 1]].forEach(([cy, al]) => {
        x.globalAlpha = al; x.beginPath(); x.moveTo(w * 0.18, cy + 34); x.lineTo(w / 2, cy - 22); x.lineTo(w * 0.82, cy + 34);
        x.lineWidth = 40; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke(); x.lineWidth = 24; x.strokeStyle = color; x.stroke();
      });
      x.globalAlpha = 1;
    }
  });
}
function makePath(root, anims, colliders, { deg, color, sign }) {
  const A = pathAssets(), a = rad(deg), L = PATH.r1 - PATH.r0, W = PATH.w, mid = (PATH.r0 + PATH.r1) / 2;
  const g = new THREE.Group(); g.rotation.y = -a; root.add(g);            // 로컬 +x = 포털 방향, +z = 진행 방향 기준 오른쪽
  const flatGeo = (len, wid) => { const geo = new THREE.PlaneGeometry(len, wid); geo.rotateX(-HP); return geo; };
  /* 돌길 */
  const road = new THREE.Mesh(flatGeo(L, W), A.mat); road.position.set(mid, 0.05, 0); road.receiveShadow = true; g.add(road);
  /* 양옆 옅은 발광 라인 (부드러운 빛 + 가는 선) */
  const halos = [], white = new THREE.Color('#ffffff');
  for (const s of [-1, 1]) {
    const hm = new THREE.MeshBasicMaterial({ map: A.glow, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    const hl = new THREE.Mesh(flatGeo(L, 1.1), hm); hl.position.set(mid, 0.06, s * (W / 2 + 0.05)); g.add(hl); halos.push(hm);
    const cm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(white, 0.55), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const cl = new THREE.Mesh(flatGeo(L, 0.1), cm); cl.position.set(mid, 0.065, s * (W / 2 + 0.05)); g.add(cl);
  }
  /* 바닥 화살표: 체험명 판(33·61·89m)과 쐐기(47·75m)를 번갈아 */
  const nameTex = arrowDecal(color, sign), chevTex = arrowDecal(color, '');
  const dGeo = new THREE.PlaneGeometry(4.4, 4.4); dGeo.rotateX(-HP); dGeo.rotateY(-HP);   // 글씨 위쪽 = 포털 방향
  const decals = [];
  [[33, true], [47, false], [61, true], [75, false], [89, true]].forEach(([r, named]) => {
    const dm = new THREE.MeshBasicMaterial({ map: named ? nameTex : chevTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
    const d = new THREE.Mesh(dGeo, dm); d.position.set(r, 0.07, 0); g.add(d); decals.push(dm);
  });
  /* 입구 이정표: 광장에서 돌길로 들어서는 자리의 문(門) + 체험명·거리 간판 */
  const GR = PATH.gateR, dark = M('#2b3350'), em = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(rbox(0.55, 5.6, 0.55), dark); post.position.set(GR, 2.8, s * 3.6); post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(rsph(0.4, 12, 8), em); cap.position.set(GR, 5.9, s * 3.6); g.add(cap);
    colliders.push({ x: Math.cos(a) * GR - Math.sin(a) * s * 3.6, z: Math.sin(a) * GR + Math.cos(a) * s * 3.6, r: 0.5, h: 5.6 });
  }
  const beam = new THREE.Mesh(rbox(0.5, 0.5, 7.7), em); beam.position.set(GR, 5.35, 0); g.add(beam);
  const sg = label(`${sign}  ▶`, { bg: color, scale: 10 }); sg.position.set(GR, 8.2, 0); g.add(sg);
  /* 움직임: 발광 띠가 포털 쪽으로 흐르고, 바닥 화살표가 차례로 반짝 */
  anims.push((dt, t) => {
    A.glow.offset.x = -t * 0.18;
    halos.forEach((m) => { m.opacity = 0.42 + Math.sin(t * 2.2) * 0.1; });
    decals.forEach((m, i) => { m.opacity = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3 - i * 0.9)); });
  });
}

/* 벽 한 줄(메시 + 충돌 원) */
function seg(root, colliders, x1, z1, x2, z2, mat, h = 3.6) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
  const m = new THREE.Mesh(rbox(L, h, 0.5), mat);
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(dz, dx); m.castShadow = m.receiveShadow = true; root.add(m);
  const n = Math.max(1, Math.ceil(L / 1.2));
  for (let i = 0; i <= n; i++) colliders.push({ x: x1 + (dx * i) / n, z: z1 + (dz * i) / n, r: 0.65, h });
}
/* 관중석 (local +z 가 앞쪽, ry 로 방향 지정) */
function stand(root, colliders, R, x, z, ry, len = 32, steps = 5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  const pts = [], mats = [M('#b9bfc9'), M('#d9433a')], c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < steps; i++) {
    const h = 1 + i * 1.1, zz = -i * 2.2, b = new THREE.Mesh(rbox(len, h, 2.2), mats[i % 2]);
    b.position.set(0, h / 2, zz); b.castShadow = b.receiveShadow = true; g.add(b);
    for (let k = 0; k < len / 1.5; k++) if (R() < 0.8) pts.push([-len / 2 + 0.8 + k * 1.5, h + 0.55, zz + 0.2]);
  }
  crowd(g, R, pts);
  const roof = new THREE.Mesh(rbox(len + 1, 0.3, steps * 2.2 + 1), M('#e8ebf0')); roof.position.set(0, steps * 1.1 + 4.2, -steps * 1.1 + 1); roof.castShadow = true; g.add(roof);
  for (const sx of [-len / 2, len / 2]) { const p = new THREE.Mesh(rbox(0.4, steps * 1.1 + 4.2, 0.4), M('#9aa5b5')); p.position.set(sx, (steps * 1.1 + 4.2) / 2, -steps * 2.2 + 1.6); g.add(p); }
  for (let lx = -len / 2; lx <= len / 2; lx += 3.5) colliders.push({ x: x + lx * c, z: z - lx * s, r: 2, h: 5 });
}

/* ═════════════════ 통합 생성 ═════════════════ */
export function buildWorlds(scene) {
  const sun = new THREE.DirectionalLight('#fff4e0', 1.5);
  sun.castShadow = true; sun.position.set(60, 90, 40); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 320;
  const hemi = new THREE.HemisphereLight('#ffffff', '#6b8f5a', 0.95);
  scene.add(sun, sun.target, hemi);
  return { worlds: { campus: buildCampus(scene), race: buildRace(scene), soccer: buildSoccer(scene), fps: buildFps(scene) }, sun, hemi };
}

/* ═════════════════ 1) 캠퍼스 (노을빛 바닷가) ═════════════════ */
function buildCampus(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], booths = [], coins = [], portals = [], dummies = [], anims = [], flags = [], R = mulberry(11);
  const { flat, box, col } = kit(root, colliders);
  const free = (x, z, pad = 2) => !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  const env = { sky: '#f4b88e', fog: ['#f4b88e', 130, 440], sunPos: [70, 45, -50], sunColor: '#ffc994', sunI: 2.1, hemi: ['#ffe0c4', '#58824c', 0.9] };
  anims.push(sky(root, { stops: [[0, '#3a58b0'], [0.17, '#6f84cc'], [0.3, '#c99ac0'], [0.4, '#f4a98e'], [0.47, '#fcc07a'], [0.5, '#f4b88e'], [1, '#f4b88e']], sunDir: env.sunPos, glow: '#ffb060', clouds: 22, tint: '#ffd9c4', R }));

  /* 섬 · 해변 · 바다 */
  flat(new THREE.CircleGeometry(122, 72), new THREE.MeshStandardMaterial({ map: grassTex(62), roughness: 1 }), 0);
  flat(new THREE.RingGeometry(121.5, 134, 72), M('#ead9aa', { roughness: 1 }), -0.03);
  flat(new THREE.RingGeometry(133.5, 139, 72), M('#cdb98a', { roughness: 1 }), -0.06);
  const wt = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#3a8fd4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.12})`; x.lineWidth = 1 + R() * 1.5; const px = R() * w, py = R() * h, l = 8 + R() * 22; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 3, px + l, py); x.stroke(); }
  });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(90, 90);
  flat(new THREE.CircleGeometry(700, 48), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.28, metalness: 0.15 }), -0.5);
  const foam = flat(new THREE.RingGeometry(138.5, 142, 72), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }), -0.42);
  anims.push((dt, t) => { wt.offset.x += dt * 0.004; wt.offset.y += dt * 0.002; foam.material.opacity = 0.35 + Math.sin(t * 1.3) * 0.15; });
  hills(root, R, 10, 330, 400, '#6c8aa8');

  /* 중앙 광장(나침반 문양) */
  const pz = canvasTex(512, 512, (x) => {
    x.fillStyle = '#efe6d2'; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill(); x.strokeStyle = '#c9a85a'; x.lineWidth = 6;
    for (const r of [240, 170, 120]) { x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); }
    x.fillStyle = '#d9b45a';
    for (let k = 0; k < 8; k++) { const L = k % 2 ? 120 : 230, wd = k % 2 ? 18 : 28; x.save(); x.translate(256, 256); x.rotate((k * Math.PI) / 4); x.beginPath(); x.moveTo(0, -L); x.lineTo(wd, 0); x.lineTo(0, 18); x.lineTo(-wd, 0); x.closePath(); x.fill(); x.restore(); }
    x.fillStyle = '#2a4f8a'; x.beginPath(); x.arc(256, 256, 26, 0, 7); x.fill();
  });
  flat(new THREE.CircleGeometry(24, 64), new THREE.MeshStandardMaterial({ map: pz, roughness: 0.9 }), 0.03);
  plazaPaving(flat, canvasTex);

  /* 단과대 구역 바닥 · 산책로 · 간판 · 깃발 */
  const CI = { eng: '⚙️', sea: '🐟', cul: '🏛️', cre: '🌈' }, bMat = {}, fasC = {};
  for (const [k, C] of Object.entries(COLLEGES)) {
    bMat[k] = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(128, 256, (x, w, h) => {
      x.fillStyle = C.color; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.moveTo(0, h); x.lineTo(w / 2, h - 50); x.lineTo(w, h); x.fill();
      x.fillStyle = '#fff'; x.font = '64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(CI[k], w / 2, 90); x.fillRect(14, 150, w - 28, 6);
    }) });
  }
  const fascia = (k) => fasC[k] || (fasC[k] = new THREE.MeshBasicMaterial({ map: canvasTex(512, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, COLLEGES[k].color); g.addColorStop(1, '#0f2547'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.font = '40px serif'; x.fillText(CI[k], 18, 34); x.font = `bold 32px ${FONT}`; x.fillText(k === 'cre' ? '창의융합학부 (직할)' : COLLEGES[k].name, 76, 34);

  }) }));
  for (const [cid, C] of Object.entries(COLLEGES)) {
    if (cid === 'cre') continue;
    const len = rad(C.a1 - C.a0);
    flat(new THREE.RingGeometry(30, 84, 48, 1, -rad(C.a1), len), M(C.ground, { polygonOffset: true, polygonOffsetFactor: -1 }), 0.02);
    for (const r of [37, 63]) flat(new THREE.RingGeometry(r - 1.5, r + 1.5, 48, 1, -rad(C.a1), len), M('#f3efe4', { polygonOffset: true, polygonOffsetFactor: -2 }), 0.04);
    const mid = rad((C.a0 + C.a1) / 2), s = label(C.name, { bg: C.color, scale: 15 }); s.position.set(Math.cos(mid) * 28, 8, Math.sin(mid) * 28); root.add(s);
    const n = Math.round((C.a1 - C.a0) / 8);
    for (let k = 0; k <= n; k++) {
      const a = rad(C.a0 + 2 + (k / n) * (C.a1 - C.a0 - 4)), fx = Math.cos(a) * 80, fz = Math.sin(a) * 80;
      const fg = new THREE.Group(); fg.position.set(fx, 0, fz); fg.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); root.add(fg);
      const pole = new THREE.Mesh(rcyl(0.08, 0.08, 7, 6), M('#e8e8e8')); pole.position.y = 3.5; pole.castShadow = true; fg.add(pole);
      const top = new THREE.Mesh(rsph(0.18, 8, 6), M('#ffd24a')); top.position.y = 7.1; fg.add(top);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), bMat[cid]); fl.position.set(0.8, 5.3, 0); fg.add(fl); flags.push(fl); col(fx, fz, 0.3, 7);
    }
  }

  /* 부스 */
  const markers = { todo: emojiTex('❗'), done: emojiTex('✅') };
  function makeBooth(d, i, x, z) {
    const C = COLLEGES[d.col], c3 = new THREE.Color(C.color).offsetHSL(((i % 6) - 2.5) * 0.012, 0, ((i % 3) - 1) * 0.035), cc = '#' + c3.getHexString();
    const g = new THREE.Group(); g.position.set(x, 0, z); const ry = Math.atan2(-x, -z); g.rotation.y = ry; root.add(g);
    const part = (geo, mat, px, py, pz, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
    const bm = (w, h, dd, mat, px, py, pz) => part(rbox(w, h, dd), mat, px, py, pz);
    bm(9, 0.25, 8, M('#f4f1ea'), 0, 0.12, 0); bm(7.6, 0.05, 6.6, M(cc), 0, 0.27, 0.2);
    for (const [sx, sz] of [[-4.2, -3.7], [4.2, -3.7], [-4.2, 3.7], [4.2, 3.7]]) bm(0.3, 5.2, 0.3, M('#ffffff'), sx, 2.85, sz);
    bm(9.8, 0.4, 8.6, M(cc), 0, 5.6, 0); bm(10, 0.12, 8.8, M('#ffffff'), 0, 5.86, 0);
    const panelTex = canvasTex(512, 256, (x2, w, h) => {
      const gr = x2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, cc); gr.addColorStop(1, '#10203a'); x2.fillStyle = gr; x2.fillRect(0, 0, w, h);
      x2.font = '96px serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(d.icon, 90, 120);
      x2.fillStyle = '#fff'; x2.textAlign = 'left'; x2.font = `bold 15px ${FONT}`; x2.fillText(d.col === 'cre' ? '대학 직할 학부' : C.name, 160, 40);
      let s = 40; do { x2.font = `bold ${s}px ${FONT}`; s -= 2; } while (x2.measureText(d.name).width > 330 && s > 18);
      x2.fillText(d.name, 160, 100); x2.font = `22px ${FONT}`; x2.fillStyle = '#ffe9a8'; x2.fillText('🎯 ' + d.job, 160, 160);
    });
    const plain = M('#dfe6f0'); bm(8.4, 3.2, 0.2, [plain, plain, plain, plain, new THREE.MeshBasicMaterial({ map: panelTex }), plain], 0, 3.3, -3.8);
    bm(5, 1.1, 1.1, M('#e9e4d8'), 0, 0.8, -1.4); bm(5.3, 0.12, 1.3, M(cc), 0, 1.4, -1.4);
    bm(1.5, 0.95, 0.1, new THREE.MeshStandardMaterial({ color: '#16202e', emissive: cc, emissiveIntensity: 0.9 }), -1.4, 2.1, -1.5);
    let tick = null;
    if (d.col === 'eng') { const gear = part(new THREE.TorusGeometry(0.42, 0.15, 8, 14), M('#f2b84b', { metalness: 0.5, roughness: 0.4 }), 1.3, 1.95, -1.4); tick = (dt) => { gear.rotation.z += dt; }; }
    else if (d.col === 'sea') {
      part(rbox(1.5, 0.8, 0.8), M('#7fd3ee', { transparent: true, opacity: 0.55 }), 1.3, 1.9, -1.4);
      const fg = new THREE.ConeGeometry(0.16, 0.5, 6); fg.rotateZ(-HP); const fish = part(fg, M('#ff8a3d'), 1.3, 1.9, -1.4);
      tick = (dt, t) => { fish.position.x = 1.3 + Math.sin(t * 1.6) * 0.45; fish.rotation.y = Math.cos(t * 1.6) > 0 ? 0 : Math.PI; };
    } else if (d.col === 'cul') {
      const gl = part(rsph(0.46, 18, 14), M('#4c8dd9', { emissive: '#1a3d80', emissiveIntensity: 0.5 }), 1.3, 2.0, -1.4);
            part(rcyl(0.08, 0.14, 0.3, 8), M('#8a6a3a'), 1.3, 1.58, -1.4); tick = (dt) => { gl.rotation.y += dt * 0.8; };
    } else if (d.col === 'cre') {
      const ico = part(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: '#b79bff', emissive: '#8e5cf2', emissiveIntensity: 1.1, roughness: 0.3 }), 1.3, 2.0, -1.4);
      tick = (dt) => { ico.rotation.y += dt; ico.rotation.x += dt * 0.6; };
    }
    part(rcyl(0.07, 0.07, 6.4, 6), M('#e8e8e8'), 5.2, 3.2, 3.9);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.6), bMat[d.col]); fl.position.set(5.9, 4.7, 3.9); g.add(fl);
    const look = { skin: '#f5c9a0', hair: ['#2b1b12', '#5a3a22', '#c9a24a'][i % 3], hairStyle: ['short', 'bob', 'long', 'pony'][i % 4], uniform: '#1f3b73', bag: '#e0a43a' };
    const npc = createCharacter(look, { coat: cc }); npc.group.position.set(0, 0.12, -2.6); g.add(npc.group);
   const name = label(d.name, { bg: cc, scale: 9 }); name.position.set(0, 7.6, 0); g.add(name);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markers.todo, transparent: true, depthWrite: false, fog: false })); marker.scale.set(1.8, 1.8, 1); marker.position.set(0, 11.2, 0); g.add(marker);
    const s = Math.sin(ry), c = Math.cos(ry);
    for (const lx of [-2.8, 0, 2.8]) col(x + lx * c - 2 * s, z - lx * s - 2 * c, 2.1, 6);
    const b = { dept: d, x, z, group: g, npc, npc, marker, my: 11.2, tick, done: false, setDone(f) { this.done = f; marker.material.map = f ? markers.done : markers.todo; marker.material.needsUpdate = true; if (f) npc.stopWave(); } };
    booths.push(b); return b;
  }
  const sectors = { eng: [], sea: [], cul: [] }; let gi = 0;
  DEPTS.forEach((d) => { if (sectors[d.col]) sectors[d.col].push(d); });
  for (const [cid, list] of Object.entries(sectors)) {
    const C = COLLEGES[cid], rings = [[42, []], [68, []]];
    list.forEach((d, i) => rings[i % 2][1].push(d));
    rings.forEach(([r, arr], ri) => arr.forEach((d, j) => { const t = (j + (ri === 0 ? 0.25 : 0.75)) / arr.length, a = rad(C.a0 + t * (C.a1 - C.a0)); makeBooth(d, gi++, r * Math.cos(a), r * Math.sin(a)); }));
  }
decorateAll(booths);

  /* 중앙 돔 — 전남대학교 로고가 회전해요 (창의융합학부는 아래에서 별도 부스로 분리) */
  (function makeDome() {
    const g = new THREE.Group(); g.position.set(0, 0, -12); root.add(g);
    const part = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    const disc = (r, c, y) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), M(c)); m.rotation.x = -HP; m.position.y = y; m.receiveShadow = true; g.add(m); };
    disc(11, '#e9f4ec', 0.05); disc(9.6, '#c9e4d1', 0.07);
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(8.6, 3), new THREE.MeshStandardMaterial({ color: '#d4efe0', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(8.66, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.5 })));
    const arch = M('#d9eee0', { metalness: 0.2 });
    for (const sx of [-2.6, 2.6]) part(rbox(0.9, 5.4, 0.9), arch, sx, 3.0, 8.5);
    part(new THREE.TorusGeometry(2.6, 0.45, 10, 32, Math.PI), arch, 0, 5.7, 8.5);
    const lb = label('전남대학교', { bg: '#0a8a3a', scale: 10 }); lb.position.set(0, 10.4, 8.5); g.add(lb);
    part(rcyl(0.9, 1.3, 1.6, 20), arch, 0, 0.8, 0);
    makeJnuLogo(g, { y: 4.9, r: 3.1, anims });
    for (let k = 0; k < 24; k++) { if (k >= 5 && k <= 7) continue; const a = (k / 24) * TAU; col(Math.cos(a) * 8.2, -12 + Math.sin(a) * 8.2, 1.1, 8); }
    col(0, -12, 1.8, 4); col(-2.6, -3.5, 0.5, 6); col(2.6, -3.5, 0.5, 6);
  })();

  /* 홍보영상 전광판 — 돔 오른쪽 (영상 링크는 src/promo.js 의 PROMO.url) */
  makePromoBoard(root, { x: 12, z: 1, w: 15, face: Math.atan2(0 - 18, 24 - (-14)), anims, col, label });

  /* 키오스크 */
  const kiosk = { x: 0, z: -1 };
  { const kg = new THREE.Group(); kg.position.set(kiosk.x, 0, kiosk.z); kg.rotation.y = Math.atan2(-kiosk.x, -kiosk.z); root.add(kg);
    const kb = new THREE.Mesh(rbox(2.6, 3, 0.8), M('#2a4f8a')); kb.position.y = 1.5; kb.castShadow = true; kg.add(kb);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), new THREE.MeshBasicMaterial({ map: canvasTex(256, 180, (x, w, h) => { x.fillStyle = '#0f2547'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd24a'; x.font = '56px serif'; x.textAlign = 'center'; x.fillText('📊', w / 2, 80); x.fillStyle = '#fff'; x.font = `bold 26px ${FONT}`; x.fillText('진로 리포트', w / 2, 130); }) })); scr.position.set(0, 1.9, 0.41); kg.add(scr);
    const l = label('📊 진로 리포트', { bg: '#2a4f8a', scale: 6 }); l.position.set(kiosk.x, 4.5, kiosk.z); root.add(l); col(kiosk.x, kiosk.z, 1.6, 3); }

  /* 펀치 연습장(샌드백) */
  [12, 16, 20].forEach((x, i) => dummies.push(dummy(root, colliders, x, 16, ['#e0533d', '#f2b84b', '#4c8dd9'][i])));
  { const l = label('🥊 펀치 연습장', { bg: '#c0503a', scale: 6 }); l.position.set(16, 4.4, 18); root.add(l); }

  /* 가로등 · 벤치 */
  for (let k = 0; k < 10; k++) {
    if (k === 8) continue;   // 306° 가로등: 축구 돌길 위
    const a = rad(18 + k * 36), lx = Math.cos(a) * 25.8, lz = Math.sin(a) * 25.8;
    lampPost(root, lx, lz, anims); col(lx, lz, 0.3, 4.6);
  }
  for (let k = 0; k < 6; k++) {
    if (k === 0) continue;   // 30° 벤치: FPS 돌길 위
    const a = rad(30 + k * 60), bx = Math.cos(a) * 28.5, bz = Math.sin(a) * 28.5, bg = new THREE.Group(), wd = M('#8a5a34');
    bg.position.set(bx, 0, bz); bg.rotation.y = Math.atan2(-bx, -bz); root.add(bg);
    benchParts(bg); col(bx, bz, 0.9, 1);
  }

  /* 해안 풍경: 시계탑 홀 */
  (function hall(x, z) {
    const g = new THREE.Group(), ry = Math.atan2(-x, -z), c = Math.cos(ry), s = Math.sin(ry); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const fac = canvasTex(512, 160, (cx) => { cx.fillStyle = '#f1e4cb'; cx.fillRect(0, 0, 512, 160); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = '#6f8fb8'; cx.fillRect(24 + i * 60, 20 + j * 66, 32, 46); cx.fillStyle = '#efe3c9'; cx.fillRect(38 + i * 60, 20 + j * 66, 3, 46); } });
    const plain = M('#f1e4cb'), part = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    part(rbox(22, 9, 10), [plain, plain, plain, plain, new THREE.MeshStandardMaterial({ map: fac, roughness: 0.8 }), plain], 0, 4.5, 0);
    const rg = new THREE.ConeGeometry(7.8, 4.5, 4); rg.rotateY(Math.PI / 4); const roof = part(rg, M('#b5543f'), 0, 11.25, 0); roof.scale.set(2, 1, 1);
    part(rbox(3.6, 15, 3.6), plain, 0, 7.5, 4.2);
    const clk = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (cx) => {
      cx.fillStyle = '#fffbe8'; cx.beginPath(); cx.arc(64, 64, 62, 0, 7); cx.fill(); cx.strokeStyle = '#333'; cx.lineWidth = 6; cx.stroke();
      cx.lineWidth = 7; cx.beginPath(); cx.moveTo(64, 64); cx.lineTo(64, 24); cx.moveTo(64, 64); cx.lineTo(92, 74); cx.stroke();
    }) })); clk.position.set(0, 12, 6.03); g.add(clk);
    const tr = part(new THREE.ConeGeometry(2.8, 3.4, 4), M('#4a5a78'), 0, 16.7, 4.2); tr.rotation.y = Math.PI / 4;
    for (let lx = -9; lx <= 9; lx += 3) col(x + lx * c, z - lx * s, 3.4, 9);
  })(Math.cos(rad(248)) * 104, Math.sin(rad(248)) * 104);

  /* 등대 · 요트 */
  (function lighthouse(a) {
    const x = Math.cos(a) * 131, z = Math.sin(a) * 131, g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const st = canvasTex(64, 128, (c, w) => { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d9433a'; c.fillRect(0, i * 32, w, 32); } });
    const body = new THREE.Mesh(rcyl(1.6, 2.6, 16, 20), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 })); body.position.y = 8; body.castShadow = true; g.add(body);
    const lamp = new THREE.Mesh(rcyl(1.7, 1.7, 2, 12), new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffcf70', emissiveIntensity: 1.6 })); lamp.position.y = 17; g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 12), M('#3a3f4c')); cap.position.y = 19.1; g.add(cap);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(4.5), M('#7d7a72', { roughness: 1 })); rock.scale.y = 0.5; g.add(rock);
    col(x, z, 4, 18);
  })(rad(335));
  const yachts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), a = R() * TAU, d = 175 + R() * 140; g.position.set(Math.cos(a) * d, -0.2, Math.sin(a) * d); g.rotation.y = R() * TAU;
    const hull = new THREE.Mesh(rbox(1.6, 0.8, 5), M('#ffffff')); hull.position.y = 0.4; g.add(hull);
    const mast = new THREE.Mesh(rcyl(0.06, 0.06, 7, 5), M('#cccccc')); mast.position.y = 4; g.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6.2, 3), new THREE.MeshStandardMaterial({ color: '#fff7ea', side: THREE.DoubleSide })); sail.scale.z = 0.05; sail.position.set(0, 4.2, -0.3); g.add(sail);
    root.add(g); yachts.push({ g, ph: R() * 6 });
  }
  anims.push((dt, t) => yachts.forEach((y) => { y.g.position.y = -0.2 + Math.sin(t * 1.2 + y.ph) * 0.18; y.g.rotation.z = Math.sin(t * 0.9 + y.ph) * 0.05; }));

  /* 포털 (다른 월드로) */
  [[188, 'race', '🏎️ 레이싱 서킷', '#ff6b3d'], [302, 'soccer', '🎣 낚시 항구', '#1fa3c9'], [29, 'fps', '🎯 FPS 훈련장', '#e04a5a']].forEach(([deg, to, text, color]) => {
    portals.push(makePortal(root, anims, { x: Math.cos(rad(deg)) * 100, z: Math.sin(rad(deg)) * 100, to, sign: text, color, label: `${text} 입장` }));
    makePath(root, anims, colliders, { deg, color, sign: text });
  });
  const portalFar = (x, z) => portals.every((p) => Math.hypot(p.x - x, p.z - z) > 12);

  /* 돌길 위(폭 ±7m)에는 나무를 심지 않아요 */
  const offPath = (x, z) => [188, 302, 29].every((d) => {
    const ca = Math.cos(rad(d)), sa = Math.sin(rad(d)), al = x * ca + z * sa, la = Math.abs(z * ca - x * sa);
    return !(al > 16 && al < 106 && la < 7);
  });

  /* 나무 */
  const bAcc = (x, z) => free(x, z, 4) && booths.every((b) => Math.hypot(b.x - x, b.z - z) > 9) && portalFar(x, z) && offPath(x, z);
  trees(root, colliders, R, 45, ringPick(R, 28, 86), bAcc);
  trees(root, colliders, R, 85, ringPick(R, 90, 116), (x, z) => free(x, z, 3) && portalFar(x, z) && offPath(x, z) && offPath(x, z) && Math.hypot(x - Math.cos(rad(248)) * 104, z - Math.sin(rad(248)) * 104) > 16);

  /* 코인 */
  scatterGrass(root, R, { tufts: 1800, flowers: 360, pick: ringPick(R, 87, 119), accept: (x, z) => free(x, z, 1) && portalFar(x, z) && offPath(x, z) });
  const addCoin = coinMaker(root, coins); let cn = 0, gd = 0;
  while (cn < 48 && gd++ < 3000) { const [x, z] = ringPick(R, 6, 108)(); if (!free(x, z, 2.5) || !portalFar(x, z)) continue; addCoin(x, z); cn++; }

  const ballSpots = [{ x: 10, z: 28, r: 2, kind: 'big' }, { x: -6, z: 30, r: 0.6, kind: '#ff7a59' }, { x: 6, z: 33, r: 0.6, kind: '#4db8ff' }, { x: 0, z: 36, r: 0.6, kind: '#4ddb8a' }];
  return {
    id: 'campus', root, env, spawn: { x: 0, z: 24, yaw: Math.PI }, limit: 116, mapR: 122, colliders, portals, dummies, booths, kiosk, coins, ballSpots,
    update(dt, t) {
      anims.forEach((f) => f(dt, t)); spinCoins(coins, dt, t);
      flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.18; });
      booths.forEach((b) => { b.marker.position.y = b.my + Math.sin(t * 3 + b.x) * 0.25; if (!b.done) b.npc.wave(t); if (b.npc.tick) b.npc.tick(dt); if (b.tick) b.tick(dt, t); });
    },
  };
}

/* ═════════════════ 2) 레이싱 서킷 (한낮) ═════════════════ */
function buildRace(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], pads = [], coins = [], portals = [], anims = [], R = mulberry(23);
  const W = { TRACK_R: 100, TRACK_W: 16, LIMIT: 150 }, TR = W.TRACK_R, TW = W.TRACK_W;
  const { flat, col } = kit(root, colliders);
  const free = (x, z, pad = 2) => !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  const env = { sky: '#8fcbff', fog: ['#cfe9ff', 120, 420], sunPos: [80, 110, 50], sunColor: '#fff6e0', sunI: 1.7, hemi: ['#ffffff', '#6b8f5a', 1.0] };
  anims.push(sky(root, { stops: [[0, '#2f7fe0'], [0.25, '#5aa6f0'], [0.42, '#a9d8ff'], [0.5, '#cfe9ff'], [1, '#cfe9ff']], sunDir: env.sunPos, glow: '#fff2b0', clouds: 16, R }));
  flat(new THREE.CircleGeometry(156, 72), new THREE.MeshStandardMaterial({ map: grassTex(70), roughness: 1 }), 0);
  flat(new THREE.CircleGeometry(600, 40), M('#5c9650'), -0.08);
  hills(root, R, 9, 320, 400, '#7aa0c4');

  /* 트랙 */
  flat(new THREE.RingGeometry(TR - TW / 2, TR + TW / 2, 128), M('#34373e', { roughness: 0.95 }), 0.03);
  for (const r of [TR - TW / 2 + 0.6, TR + TW / 2 - 0.6]) flat(new THREE.RingGeometry(r - 0.25, r + 0.25, 128), M('#ffffff'), 0.05);
  instanced(root, rbox(0.4, 0.05, 3), M('#f2d34b'), 80, (o, i) => { const a = (i / 80) * TAU; o.position.set(TR * Math.cos(a), 0.07, TR * Math.sin(a)); o.rotation.y = -a; }, false);
  const curbR = [TR - TW / 2 - 0.7, TR + TW / 2 + 0.7];
  instanced(root, rbox(1.4, 0.2, 5.4), M('#ffffff'), 240, (o, i, im) => {
    const k = (i / 2) | 0, a = (k / 120) * TAU, r = curbR[i % 2]; o.position.set(r * Math.cos(a), 0.1, r * Math.sin(a)); o.rotation.y = -a; im.setColorAt(i, new THREE.Color(k % 2 ? '#d63a3a' : '#ffffff'));
  }, false);
  const chk = canvasTex(128, 32, (x) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); } });
  flat(new THREE.PlaneGeometry(TW, 2), new THREE.MeshBasicMaterial({ map: chk }), 0.08).position.set(TR, 0.08, 0);
  for (const px of [TR - TW / 2 - 1.5, TR + TW / 2 + 1.5]) { const p = new THREE.Mesh(rbox(0.7, 9, 0.7), M('#dddddd')); p.position.set(px, 4.5, 0); p.castShadow = true; root.add(p); col(px, 0, 0.6, 9); }
  const banner = new THREE.Mesh(rbox(TW + 4, 1.6, 0.6), M('#222831')); banner.position.set(TR, 9.2, 0); banner.castShadow = true; root.add(banner);
  const ban = label('🏁 START / FINISH', { bg: '#222', scale: 14 }); ban.position.set(TR, 12, 0); root.add(ban);

  /* 부스트 패드 */
  const arrows = canvasTex(64, 128, (x, w, h) => { x.fillStyle = '#10213a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffd24a'; x.lineWidth = 8; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(8, 40 + k * 32); x.lineTo(32, 16 + k * 32); x.lineTo(56, 40 + k * 32); x.stroke(); } });
  for (const deg of [70, 160, 250, 340]) {
    const a = rad(deg), mat = new THREE.MeshBasicMaterial({ map: arrows, transparent: true });
    const m = flat(new THREE.PlaneGeometry(6, 8), mat, 0.09); m.rotation.z = Math.PI - a; m.position.x = TR * Math.cos(a); m.position.z = TR * Math.sin(a);
    pads.push({ x: m.position.x, z: m.position.z, mat });
  }

  /* 관중석 · 광고판 · 피트 구역 */
  stand(root, colliders, R, -124, 0, HP, 36, 5);
  stand(root, colliders, R, 0, 124, Math.PI, 30, 4);
  flat(new THREE.PlaneGeometry(18, 40), M('#8a8f99', { roughness: 0.95 }), 0.025).position.set(121, 0.025, -2);
  const ADC = ['#e0533d', '#2f6fed', '#f2b84b', '#0aa6b7', '#8e5cf2', '#ffffff'];
  instanced(root, rbox(8, 2.4, 0.4), M('#ffffff'), 70, (o, i, im) => { const a = (i / 70) * TAU; o.position.set(143 * Math.cos(a), 1.2, 143 * Math.sin(a)); o.rotation.y = -a + HP; im.setColorAt(i, new THREE.Color(ADC[i % ADC.length])); });
  const garage = { x: 118, z: -6 };
  { const gb = new THREE.Mesh(rbox(8, 6, 14), M('#d9433a')); gb.position.set(130, 3, -8); gb.castShadow = true; root.add(gb);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshBasicMaterial({ color: '#1b2230' })); door.position.set(125.98, 2.2, -8); door.rotation.y = -HP; root.add(door);
    const l = label('🏎️ 카트 차고 (E)', { bg: '#d9433a', scale: 12 }); l.position.set(124, 9, -8); root.add(l);
    for (const zz of [-13, -8, -3]) col(130, zz, 4.5, 6); }

  /* 포털 → 캠퍼스 */
  portals.push(makePortal(root, anims, { x: 116, z: 36, to: 'campus', sign: '🏫 캠퍼스', color: '#4c8dd9', label: '🏫 캠퍼스로 돌아가기' }));
  const nearFixed = (x, z) => Math.hypot(x - 116, z - 36) > 12 && !(x > 108 && Math.abs(z) < 40) && !(x < -105 && Math.abs(z) < 30) && !(z > 105 && Math.abs(x) < 25);
  trees(root, colliders, R, 90, ringPick(R, 10, 146), (x, z) => Math.abs(Math.hypot(x, z) - TR) > TW / 2 + 6 && free(x, z, 4) && nearFixed(x, z));

  /* 코인 */
  const addCoin = coinMaker(root, coins);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = TR + (i % 2 ? 4 : -4); addCoin(r * Math.cos(a), r * Math.sin(a)); }
  let cn = 0, gd = 0; while (cn < 24 && gd++ < 2000) { const [x, z] = ringPick(R, 8, 84)(); if (!free(x, z, 3)) continue; addCoin(x, z); cn++; }

  const ballSpots = [{ x: 116, z: 18, r: 2, kind: 'big' }, { x: 110, z: 24, r: 0.6, kind: '#ff7a59' }, { x: 122, z: 26, r: 0.6, kind: '#4db8ff' }];
  return {
    id: 'race', root, env, spawn: { x: 116, z: 8, yaw: -HP }, limit: W.LIMIT, mapR: 156, colliders, portals, W, pads, coins, ballSpots, garage,
    kartSpawn: { x: TR * Math.cos(-0.07), z: TR * Math.sin(-0.07), yaw: 0.07 },
    update(dt, t) { anims.forEach((f) => f(dt, t)); spinCoins(coins, dt, t); pads.forEach((p) => { p.mat.opacity = 0.65 + Math.sin(t * 6) * 0.3; }); },
  };
}

/* ═════════════════ 3) 낚시 항구 (낮) — 내부 id 는 'soccer' 그대로 둡니다 ═════════════════ */
function buildSoccer(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], portals = [], anims = [], R = mulberry(41), WY = -1.4;      // WY = 바닷물 높이(땅은 y=0)
  const { flat, box, col } = kit(root, colliders);
  const free = (x, z, pad = 2) => !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  const env = { sky: '#b6defa', fog: ['#cfe8ff', 110, 430], sunPos: [60, 90, 40], sunColor: '#fff1d6', sunI: 1.8, hemi: ['#e4f3ff', '#5a86a8', 1.0] };
  anims.push(sky(root, { stops: [[0, '#3f8fe8'], [0.25, '#6fb2f2'], [0.42, '#b6defa'], [0.5, '#d9efff'], [1, '#d9efff']], sunDir: env.sunPos, glow: '#fff2b0', clouds: 16, R }));

  /* ── 바다 + 바닥 ── */
  const wt = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#2f93d0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.13})`; x.lineWidth = 1 + R() * 1.6; const px = R() * w, py = R() * h, l = 8 + R() * 24; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 3, px + l, py); x.stroke(); }
  });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(90, 90);
  flat(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.25, metalness: 0.12, transparent: true, opacity: 0.86 }), WY);
  flat(new THREE.PlaneGeometry(1400, 1400), M('#c9b98a', { roughness: 1 }), -9);
  anims.push((dt) => { wt.offset.x += dt * 0.004; wt.offset.y += dt * 0.002; });

  /* ── 육지: 안벽(콘크리트) z -30~-4, 잔디 z -74~-30, 포털~안벽 보도 ── */
  const po = { polygonOffset: true, polygonOffsetFactor: -1 };
  flat(new THREE.PlaneGeometry(170, 26), M('#9aa3ad', { roughness: 0.95 }), 0).position.z = -17;
  const gt = grassTex(30, '#6fae5b'); gt.repeat.set(40, 12);
  flat(new THREE.PlaneGeometry(170, 44), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }), 0).position.z = -52;
  flat(new THREE.PlaneGeometry(6, 46), M('#c4beae', po), 0.02).position.z = -27;
  flat(new THREE.PlaneGeometry(170, 0.5), M('#e0b13a', po), 0.02).position.z = -5.2;
  box(170, 3, 1, M('#8f969f'), 0, -1.55, -4.5, 0, false);                            // 안벽 앞면

  /* ── 낚시 부두 A (폭 8m · 길이 66m, z -4~62) ── */
  const woodOld = canvasTex(128, 128, (x, w, h) => {
    for (let i = 0; i < 8; i++) { const v = 150 + ((R() * 30) | 0); x.fillStyle = `rgb(${v},${v - 38},${v - 78})`; x.fillRect(0, i * 16, w, 16); x.fillStyle = 'rgba(40,25,10,.55)'; x.fillRect(0, i * 16, w, 2); }
    for (let k = 0; k < 120; k++) { x.fillStyle = 'rgba(60,40,20,.15)'; x.fillRect(R() * w, R() * h, 8, 1); }
  }, 1);
  const wood = deckTex(canvasTex); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(1, 66 / 4);
  box(8, 3, 66, M('#ffffff', { map: wood, roughness: 0.9 }), 0, -1.5, 29, 0, false);
  /* 부두 C (새동백호 옆 작은 부두, z -4~34) */
  box(3, 3, 38, M('#9b7a52'), 24, -1.5, 15, 0, false);
  /* 말뚝 · 계선주 */
  const pil = []; for (let z = 0; z <= 60; z += 6) { pil.push([-3.8, z], [3.8, z]); }
  instanced(root, rcyl(0.3, 0.36, 8.4, 8), M('#6b5438'), pil.length, (o, i) => { o.position.set(pil[i][0], -3.6, pil[i][1]); }, false);
  const bol = []; for (let z = 4; z <= 60; z += 8) { bol.push([-3.3, z], [3.3, z]); }
  instanced(root, rcyl(0.22, 0.28, 0.5, 8), M('#2b2f36'), bol.length, (o, i) => { o.position.set(bol[i][0], 0.25, bol[i][1]); }, false);

  /* ── 난간(= 낮은 벽, 물에 빠지지 않게 충돌 포함) ── */
  const rail = M('#e9e4d8'), rope = M('#c9b27a');
  seg(root, colliders, -3.85, -3, -3.85, 62, rail, 0.9); seg(root, colliders, 3.85, -3, 3.85, 62, rail, 0.9); seg(root, colliders, -3.85, 62, 3.85, 62, rail, 0.9);
  seg(root, colliders, -80, -4.2, -63, -4.2, rail, 0.9); seg(root, colliders, -37, -4.2, -4.6, -4.2, rail, 0.9);
  seg(root, colliders, 4.6, -4.2, 21.5, -4.2, rail, 0.9); seg(root, colliders, 26.5, -4.2, 80, -4.2, rail, 0.9);
  seg(root, colliders, 22.7, -3, 22.7, 34, rail, 0.9); seg(root, colliders, 25.3, -3, 25.3, 34, rail, 0.9); seg(root, colliders, 22.7, 34, 25.3, 34, rail, 0.9);
  /* 부두 가로등 */
  for (const z of [10, 26, 42, 58]) for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(rcyl(0.08, 0.1, 3, 6), M('#2b2f3a')); p.position.set(sx * 3.85, 1.5, z); p.castShadow = true; root.add(p);
    const b = new THREE.Mesh(rsph(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffcf70', emissiveIntensity: 1.0 })); b.position.set(sx * 3.85, 3.1, z); root.add(b);
  }
  /* 부두 입구 문(門) */
  for (const sx of [-1, 1]) { box(0.6, 6.5, 0.6, M('#2b3350'), sx * 3.3, 3.25, 1); col(sx * 3.3, 1, 0.5, 6.5); }
  box(7.2, 0.6, 0.6, M('#2b3350'), 0, 6.4, 1);
  { const l = label('🎣 CNU 여수 낚시 항구', { bg: '#1f6fa5', scale: 12 }); l.position.set(0, 8.6, 1); root.add(l); }

  /* ── 갯바위 곶 (x -62~-38, z -4~28) ── */
  box(24, 3, 32, M('#7f7b70', { roughness: 1 }), -50, -1.52, 12, 0, false);
  flat(new THREE.PlaneGeometry(24, 32), M('#9a9486', { roughness: 1 }), 0).position.set(-50, 0, 12);
  const rk = [];
  for (let z = 1; z <= 29; z += 3.2) { if (z > 7 && z < 17) continue; rk.push([-62.4 + R() * 0.8, z, 1.3 + R() * 1.0, R() * 3]); }      // 서쪽(낚시터 틈 z 7~17)
  for (let z = 1; z <= 29; z += 3.2) rk.push([-37.6 - R() * 0.8, z, 1.3 + R() * 1.0, R() * 3]);                                         // 동쪽
  for (let x = -61; x <= -39; x += 3.2) { if (x > -55 && x < -45) continue; rk.push([x, 28.6 + R() * 0.8, 1.3 + R() * 1.0, R() * 3]); } // 북쪽(낚시터 틈 x -55~-45)
  rk.forEach(([x, z, s]) => col(x, z, s * 0.95, s));
  instanced(root, new THREE.DodecahedronGeometry(1, 0), M('#7d7a72', { roughness: 1, flatShading: true }), rk.length, (o, i) => { const [x, z, s, r] = rk[i]; o.position.set(x, s * 0.3, z); o.scale.set(s, s * 0.75, s); o.rotation.y = r; });
  seg(root, colliders, -62.2, 7.5, -62.2, 16.5, rope, 0.7); seg(root, colliders, -55, 28.4, -45, 28.4, rope, 0.7);

  /* ── 오두막 2채 (어종 도감 · 낚시 대회 — 기능은 F3에서) ── */
  function hut(x, z, color, text) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const p = (w, h, d, c, px, py, pz) => { const m = new THREE.Mesh(rbox(w, h, d), M(c)); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    p(9, 4, 6, color, 0, 2, 0); p(10.4, 0.5, 7.4, '#b5543f', 0, 4.25, 0); p(1.8, 2.6, 0.12, '#2b3350', 0, 1.3, 3.04); p(7, 0.12, 1.2, '#e9e4d8', 0, 3.4, 3.6);
    [-3, 3].forEach((dx) => { const w = p(1.8, 1.4, 0.12, '#bfe6ff', dx, 2.3, 3.04); w.material.emissive = new THREE.Color('#5aa0d0'); w.material.emissiveIntensity = 0.35; });
    const l = label(text, { bg: color, scale: 8 }); l.position.set(0, 7.3, 0); g.add(l);
    [-3, 0, 3].forEach((dx) => col(x + dx, z, 3.1, 4.5));
  }
  hut(-22, -14, '#2f7fb0', '🐟 어종 도감'); hut(22, -14, '#c0703a', '🏆 낚시 대회');
  /* 컨테이너 · 상자 */
  [[56, -12, '#d9433a'], [56, -17, '#2f6fed']].forEach(([x, z, c]) => { box(12, 2.7, 2.5, M(c, { roughness: 0.6, metalness: 0.3 }), x, 1.35, z); for (let i = -2; i <= 2; i++) col(x + i * 2.5, z, 1.6, 2.7); });
  { const l = label('🎣 노란 링 위에서 낚시! (F2 에서 낚싯대 연결)', { bg: '#1f6fa5', scale: 13 }); l.position.set(0, 4.6, -33); root.add(l); }

  /* ── 낚시터 10곳: [id, x, z, 바라보는 방향(yaw: 정면=(sin,cos)), 구역, 이름] ── */
  const SPOTS = [
    ['pier_end', 0, 59.4, 0, 'mid', '부두 끝'],
    ['pier_w1', -2.7, 22, -HP, 'mid', '부두 서쪽 1'], ['pier_w2', -2.7, 40, -HP, 'mid', '부두 서쪽 2'],
    ['pier_e1', 2.7, 31, HP, 'mid', '부두 동쪽 1'], ['pier_e2', 2.7, 48, HP, 'mid', '부두 동쪽 2'],
    ['quay_w', -30, -6.2, 0, 'near', '안벽 서쪽'], ['quay_e', 44, -6.2, 0, 'near', '안벽 동쪽'],
    ['rock_n', -50, 25.4, 0, 'rock', '갯바위 끝'], ['rock_w', -59.8, 12, -HP, 'rock', '갯바위 서쪽'],
    ['dock_c', 24, 31, 0, 'mid', '실습선 부두 끝'],
  ];
  const rings = [];
  SPOTS.forEach(([id, x, z, yaw, zone, name]) => {
    const c = zone === 'rock' ? '#ff9f43' : '#ffd34d';
    const rm = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 28), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    rm.rotation.x = -HP; rm.position.set(x, 0.06, z); root.add(rm); rings.push(rm);
    const bm = new THREE.Mesh(rcyl(0.1, 0.1, 2.6, 6, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); bm.position.set(x, 1.4, z); root.add(bm);
    const l = label('🎣 ' + name, { bg: '#1f6fa5', scale: 5 }); l.position.set(x, 3.1, z); root.add(l);
    const px = x + Math.cos(yaw) * 1.1, pz = z - Math.sin(yaw) * 1.1;
    const bk = new THREE.Mesh(rcyl(0.32, 0.25, 0.5, 10), M('#e0533d')); bk.position.set(px, 0.25, pz); bk.castShadow = true; root.add(bk);
    const ck = new THREE.Mesh(rbox(0.9, 0.5, 0.55), M('#2f6fed')); ck.position.set(x - Math.cos(yaw) * 1.1, 0.25, z + Math.sin(yaw) * 1.1); ck.rotation.y = yaw; ck.castShadow = true; root.add(ck);
  });
  anims.push((dt, t) => rings.forEach((r, i) => { r.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.12); }));

  /* ── 새동백호 정박 (exp-sea-kit 의 모델 재사용) ── */
  let ship = null;
  try {
    const hc = {
      box: (w, h, d, c, x, y, z, g) => { const m = new THREE.Mesh(rbox(w, h, d), M(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; (g || root).add(m); return m; },
      cyl: (rt, rb, h, c, x, y, z, g, s = 12) => { const m = new THREE.Mesh(rcyl(rt, rb, h, s), M(c)); m.position.set(x, y, z); m.castShadow = true; (g || root).add(m); return m; },
      sph: (r, c, x, y, z, g) => { const m = new THREE.Mesh(rsph(r, 16, 12), M(c)); m.position.set(x, y, z); m.castShadow = true; (g || root).add(m); return m; },
    };
    ship = makeResearchShip(hc); ship.position.set(17.5, WY, 14); root.add(ship);
    for (let z = 3; z <= 25; z += 3.5) col(17.5, z, 2.9, 6);
    const l = label('🚢 실습선 새동백호', { bg: '#0f3d73', scale: 9 }); l.position.set(17.5, 13.5, 14); root.add(l);
    anims.push((dt, t) => { ship.position.y = WY + Math.sin(t * 1.2) * 0.08; ship.rotation.x = Math.sin(t * 0.9) * 0.01; ship.rotation.z = Math.sin(t * 1.1) * 0.02; });
  } catch (e) { console.warn('[fishing] 새동백호 생성 실패', e); }

  /* ── 낚시 보트 (F4 에서 탑승·이동) ── */
  const skiff = new THREE.Group(); skiff.position.set(-7.6, WY + 0.05, 16); root.add(skiff);
  { const p = (geo, c, px, py, pz) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(px, py, pz); m.castShadow = true; skiff.add(m); return m; };
    p(rbox(2.2, 0.5, 5), '#1d3b73', 0, 0.25, 0); p(rbox(2.5, 0.5, 5.2), '#f4f6f8', 0, 0.75, 0);
    const bg = new THREE.ConeGeometry(1.25, 2.2, 4); bg.rotateY(Math.PI / 4); bg.rotateX(HP); p(bg, '#f4f6f8', 0, 0.62, 3.5);
    p(rbox(1.6, 1.1, 1.4), '#f4f6f8', 0, 1.55, -0.5); p(rbox(1.62, 0.5, 1.42), '#1b2836', 0, 1.65, -0.45);
    p(rbox(0.5, 0.8, 0.4), '#2b2f36', 0, 0.9, -2.7); p(rcyl(0.04, 0.04, 2.2, 6), '#cdd3da', 0.9, 1.9, 0.6);
    for (const sx of [-1, 1]) p(rcyl(0.05, 0.05, 0.8, 6), '#444a55', sx * 1.0, 1.35, 1.6);
    const l = label('🚤 낚시 보트', { bg: '#1f6fa5', scale: 6 }); l.position.set(0, 4, 0); skiff.add(l); }
  anims.push((dt, t) => { skiff.position.y = WY + 0.05 + Math.sin(t * 1.4 + 1) * 0.1; skiff.rotation.z = Math.sin(t * 1.2) * 0.03; });

  /* ── 물고기 그림자(수면 위를 천천히 돌며 헤엄) ── */
  const fsh = [];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: '#0b3358', transparent: true, opacity: 0.2 + R() * 0.12, depthWrite: false }));
    m.rotation.x = -HP; m.scale.set(0.9 + R() * 1.1, 0.35 + R() * 0.3, 1); g.add(m); g.position.y = WY + 0.03; root.add(g);
    fsh.push({ g, cx: -35 + R() * 80, cz: 24 + R() * 70, r: 5 + R() * 10, sp: (0.12 + R() * 0.16) * (R() < 0.5 ? 1 : -1), ph: R() * TAU });
  }
  anims.push((dt, t) => fsh.forEach((f) => {
    const a = f.ph + t * f.sp; f.g.position.x = f.cx + Math.cos(a) * f.r; f.g.position.z = f.cz + Math.sin(a) * f.r;
    f.g.rotation.y = Math.atan2(-Math.cos(a) * f.sp, -Math.sin(a) * f.sp);
  }));

  /* ── 갈매기 · 부표 · 먼 섬 · 등대섬 · 산 ── */
  const wm = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), gulls = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), wings = [];
    for (const s of [-1, 1]) { const pv = new THREE.Group(), wg = new THREE.PlaneGeometry(1.4, 0.45); wg.translate(s * 0.7, 0, 0); const m = new THREE.Mesh(wg, wm); m.rotation.x = -HP; pv.add(m); g.add(pv); wings.push([pv, s]); }
    const bd = new THREE.Mesh(rsph(0.22, 8, 6), wm); bd.scale.set(0.8, 0.8, 1.6); g.add(bd); root.add(g);
    gulls.push({ g, wings, cx: -10 + R() * 30, cz: 20 + R() * 50, r: 18 + R() * 28, h: 13 + R() * 9, sp: 0.18 + R() * 0.16, ph: R() * TAU });
  }
  anims.push((dt, t) => gulls.forEach((b) => {
    const a = b.ph + t * b.sp; b.g.position.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 1.2, b.cz + Math.sin(a) * b.r);
    b.g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)); b.wings.forEach(([pv, s]) => { pv.rotation.z = s * Math.sin(t * 7 + b.ph) * 0.55; });
  }));
  const bys = [[-14, 66], [16, 72], [-30, 90], [34, 96]].map(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, WY, z); root.add(g);
    const b = new THREE.Mesh(rcyl(0.4, 0.55, 0.9, 10), M(i % 2 ? '#e8602c' : '#e0533d')); b.position.y = 0.3; g.add(b);
    const tp = new THREE.Mesh(rcyl(0.3, 0.3, 0.4, 10), M('#ffffff')); tp.position.y = 0.95; g.add(tp);
    return { g, ph: R() * 6 };
  });
  anims.push((dt, t) => bys.forEach((b) => { b.g.position.y = WY + Math.sin(t * 1.5 + b.ph) * 0.12; b.g.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.08; }));
  [[-150, 150, 26], [140, 190, 30], [-60, 300, 24]].forEach(([x, z, r]) => { const m = new THREE.Mesh(rsph(r, 16, 10), M('#6e8f62', { roughness: 1 })); m.scale.y = 0.35; m.position.set(x, WY, z); root.add(m); });
  { const g = new THREE.Group(); g.position.set(96, 0, 72); root.add(g);
    const rkk = new THREE.Mesh(new THREE.DodecahedronGeometry(7), M('#7d7a72', { roughness: 1, flatShading: true })); rkk.scale.y = 0.6; rkk.position.y = WY + 1.5; g.add(rkk);
    const tw = new THREE.Mesh(rcyl(1.2, 1.7, 9, 14), M('#f1f1f1')); tw.position.y = 5; tw.castShadow = true; g.add(tw);
    const bd = new THREE.Mesh(rcyl(1.3, 1.3, 1.6, 14), M('#d6453d')); bd.position.y = 7.2; g.add(bd);
    const lp = new THREE.Mesh(rcyl(0.8, 0.8, 1.2, 12), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffcc55', emissiveIntensity: 0.9 })); lp.position.y = 9.2; g.add(lp);
    const cp = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.0, 12), M('#d6453d')); cp.position.y = 10.3; g.add(cp); }
  hills(root, R, 9, 330, 420, '#6c8aa8');

  /* ── 포털 → 캠퍼스 · 나무 ── */
  portals.push(makePortal(root, anims, { x: 0, z: -52, to: 'campus', sign: '🏫 캠퍼스', color: '#4c8dd9', label: '🏫 캠퍼스로 돌아가기' }));
  trees(root, colliders, R, 36, () => [(R() * 2 - 1) * 78, -36 - R() * 34], (x, z) => free(x, z, 4) && Math.hypot(x, z + 52) > 12 && Math.hypot(x, z) < 77, 0.29);

  /* ── game.js 가 읽는 값 (pitch 는 골이 나올 수 없는 값, 공 위치는 비움) ── */
  const fishing = {
    WY,
    spots: SPOTS.map(([id, x, z, yaw, zone, name]) => ({ id, x, z, yaw, zone, name, r: 2.6 })),
    hubs: [{ id: 'dex', x: -22, z: -9.4, label: '🐟 어종 도감' }, { id: 'comp', x: 22, z: -9.4, label: '🏆 낚시 대회' }],
    skiff: { group: skiff, x: -7.6, z: 16, yaw: 0 },
  };
  if (typeof window !== 'undefined') window.__fish = () => ({ colliders: colliders.length, spots: SPOTS.length, ship: !!ship, rocks: rk.length });
  return {
    id: 'soccer', root, env, spawn: { x: 0, z: -40, yaw: 0 }, limit: 80, mapR: 90, colliders, portals,
    pitch: { x: 0, z: -62, hw: 9999, hl: 9999 }, ballSpots: [], coins: [], dummies: [], fishing,
    update(dt, t) { anims.forEach((f) => f(dt, t)); },
  };
}

/* ═════════════════ 4) FPS 훈련장 (흐린 날 전술 훈련 시설) ═════════════════ */
function buildFps(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], portals = [], dummies = [], anims = [], lootSpots = [], droneSpots = [], R = mulberry(77);
  const { flat, col } = kit(root, colliders);
  const free = (x, z, pad = 2) => !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  const env = { sky: '#cfd9e2', fog: ['#cfd9e2', 50, 290], sunPos: [-50, 80, 30], sunColor: '#fff0dc', sunI: 1.6, hemi: ['#e6eef7', '#5d6b4a', 0.95] };
  anims.push(sky(root, { stops: [[0, '#7d93ad'], [0.25, '#9fb3c8'], [0.42, '#c6d3df'], [0.5, '#cfd9e2'], [1, '#cfd9e2']], sunDir: env.sunPos, glow: '#ffffff', clouds: 24, tint: '#f2f5f8', R }));
  flat(new THREE.CircleGeometry(124, 64), new THREE.MeshStandardMaterial({ map: grassTex(50, '#7b8c63'), roughness: 1 }), 0);
  flat(new THREE.CircleGeometry(600, 40), M('#56664a'), -0.08);
  hills(root, R, 12, 300, 380, '#7f8f86');
  const po = { polygonOffset: true, polygonOffsetFactor: -1 };
  flat(new THREE.PlaneGeometry(8, 236), M('#a79a82', po), 0.02);
  flat(new THREE.PlaneGeometry(8, 236), M('#a79a82', po), 0.02).rotation.z = HP;
  flat(new THREE.CircleGeometry(26, 48), M('#8c9096', { polygonOffset: true, polygonOffsetFactor: -2 }), 0.03);
  flat(new THREE.CircleGeometry(16, 40), M('#6a7aa0', { polygonOffset: true, polygonOffsetFactor: -2 }), 0.03).position.set(0, 0.03, 92);

  /* 외곽 콘크리트 방벽 */
  instanced(root, rbox(7.6, 2.6, 1.2), M('#9da3ab'), 96, (o, i) => { const a = (i / 96) * TAU; o.position.set(117.6 * Math.cos(a), 1.3, 117.6 * Math.sin(a)); o.rotation.y = -a + HP; });

  /* 건물(지붕 없는 훈련 모형) */
  const wallM = M('#c9c3b5'), wallD = M('#8d98a6');
  function house(x, z, w, d, doors, tier, mat = wallM) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, gap = 2.2;
    const flo = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M('#7d7f86')); flo.rotation.x = -HP; flo.position.set(x, 0.04, z); flo.receiveShadow = true; root.add(flo);
    const side = (ax, az, bx, bz, door) => {
      if (!door) return seg(root, colliders, ax, az, bx, bz, mat);
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      seg(root, colliders, ax, az, mx - ux * gap, mz - uz * gap, mat); seg(root, colliders, mx + ux * gap, mz + uz * gap, bx, bz, mat);
    };
    side(x0, z0, x1, z0, doors.includes('n')); side(x0, z1, x1, z1, doors.includes('s')); side(x0, z0, x0, z1, doors.includes('w')); side(x1, z0, x1, z1, doors.includes('e'));
    return { x, z, w, d, tier };
  }
  const crate = (x, z, s = 1.6) => { const m = new THREE.Mesh(rbox(s, s, s), M('#a9854f')); m.position.set(x, s / 2, z); m.rotation.y = R() * 3; m.castShadow = m.receiveShadow = true; root.add(m); col(x, z, s * 0.7, s); };
  function container(x, z, ry, color) {
    const m = new THREE.Mesh(rbox(12, 2.7, 2.5), M(color, { roughness: 0.6, metalness: 0.3 })); m.position.set(x, 1.35, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; root.add(m);
    for (let i = -2; i <= 2; i++) col(x + Math.cos(ry) * i * 2.5, z - Math.sin(ry) * i * 2.5, 1.6, 2.7);
  }
  const sand = M('#b5a67e');
  function bunker(cx, cz) {
    seg(root, colliders, cx - 5, cz - 3, cx + 5, cz - 3, sand, 1.2); seg(root, colliders, cx - 5, cz - 3, cx - 5, cz + 3, sand, 1.2); seg(root, colliders, cx + 5, cz - 3, cx + 5, cz + 3, sand, 1.2);
    lootSpots.push({ x: cx, z: cz - 0.5, tier: 2 });
  }
  function waterTower(x, z) {
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = new THREE.Mesh(rcyl(0.2, 0.2, 9, 6), M('#7a828c')); l.position.set(x + dx, 4.5, z + dz); l.castShadow = true; root.add(l); }
    const tk = new THREE.Mesh(rcyl(2.4, 2.4, 3.4, 16), M('#c7cdd6')); tk.position.set(x, 10.4, z); tk.castShadow = true; root.add(tk);
    const cp = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 16), M('#d9433a')); cp.position.set(x, 12.8, z); root.add(cp); col(x, z, 2.8, 12);
  }

  /* 본부 건물(최고 등급 아이템) */
  house(0, 0, 26, 18, 'ns', 3);
  seg(root, colliders, -5, -9, -5, -2, wallD); seg(root, colliders, 5, 9, 5, 2, wallD);
  [[-8, -4, 3], [8, -4, 3], [-8, 4, 3], [8, 4, 3], [0, 0, 2], [0, -6, 2]].forEach(([x, z, tier]) => lootSpots.push({ x, z, tier }));
  /* 마을 건물 8채 */
  [[-48, -30, 'ew', 2], [46, -34, 'ns', 2], [-60, 20, 'ns', 3], [58, 26, 'ew', 3], [-20, -62, 'ew', 2], [24, -64, 'ns', 2], [-24, 52, 'ns', 2], [30, 56, 'ew', 2]].forEach(([x, z, doors, tier]) => {
    house(x, z, 14, 10, doors, tier);
    lootSpots.push({ x: x - 3.5, z: z - 1.5, tier }, { x: x + 3.5, z: z + 1.5, tier: Math.max(1, tier - 1) }); crate(x + 4.5, z - 2.5);
  });
  /* 컨테이너 · 벙커 · 급수탑 */
  [[-30, 0, 0, '#d9433a'], [30, 6, 0.3, '#2f6fed'], [0, -34, HP, '#f2b84b'], [8, 36, 0.2, '#0aa6b7'], [-80, -50, 0.6, '#8e5cf2'], [78, -60, -0.4, '#d9433a'], [-85, 50, 1, '#2f6fed'], [84, 40, -0.8, '#f2b84b']]
    .forEach(([x, z, ry, c]) => { container(x, z, ry, c); lootSpots.push({ x: x + 2, z: z + 3.8, tier: 1 }); });
  [[0, 64], [-95, -10], [95, -8]].forEach(([x, z]) => bunker(x, z));
  waterTower(72, -8); waterTower(-74, -6);

  /* 포털 · 사격 연습장 */
  portals.push(makePortal(root, anims, { x: 0, z: 108, to: 'campus', sign: '🏫 캠퍼스', color: '#4c8dd9', label: '🏫 캠퍼스로 돌아가기' }));
  { const l = label('🎯 FPS 훈련장 · F 줍기 · I 가방', { bg: '#2b3350', scale: 15 }); l.position.set(0, 6.5, 98); root.add(l); }
  [-9, -3, 3, 9].forEach((x, i) => dummies.push(dummy(root, colliders, x, 84, ['#e0533d', '#f2b84b', '#4c8dd9', '#47b5a2'][i])));

  /* 엄폐물(상자) 무작위 + 낱개 아이템 */
  let k = 0, gd = 0;
  while (k < 26 && gd++ < 800) { const [x, z] = ringPick(R, 16, 108)(); if (!free(x, z, 3.5) || (z > 76 && Math.abs(x) < 30)) continue; crate(x, z); if (R() < 0.5) lootSpots.push({ x: x + 1.9, z: z + 0.6, tier: 1 }); k++; }
  k = 0; gd = 0;
  while (k < 14 && gd++ < 800) { const [x, z] = ringPick(R, 22, 105)(); if (!free(x, z, 3) || (z > 76 && Math.abs(x) < 30)) continue; lootSpots.push({ x, z, tier: 1 }); k++; }
  trees(root, colliders, R, 110, ringPick(R, 35, 114), (x, z) => free(x, z, 4) && !(z > 76 && Math.abs(x) < 28) && Math.hypot(x, z - 108) > 12, 0.3);

  /* 훈련 드론 배치 (중앙 = 대형, 중간 = 경계형, 외곽 = 정찰형) */
  [[30, 38, 5, 'heavy'], [50, 70, 9, 'guard'], [78, 100, 10, 'scout']].forEach(([r0, r1, n, kind]) => {
    for (let i = 0; i < n; i++) for (let tr = 0; tr < 60; tr++) {
      const a = (i / n) * TAU + R() * 0.4, r = r0 + R() * (r1 - r0), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if ((z > 76 && Math.abs(x) < 30) || !free(x, z, 4)) continue; droneSpots.push({ x, z, kind }); break;
    }
  });

  /* 아이템 위치 표식(등급 색 링 + 빛기둥) */
  const TC = { 1: '#4fbf6a', 2: '#4c8dd9', 3: '#b06cf0' }, rings = [];
  lootSpots.forEach((l) => {
    const c = TC[l.tier] || '#9aa5b5';
    const rm = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    rm.rotation.x = -HP; rm.position.set(l.x, 0.06, l.z); root.add(rm); rings.push(rm);
    const bm = new THREE.Mesh(rcyl(0.12, 0.12, 3.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); bm.position.set(l.x, 1.7, l.z); root.add(bm);
  });
  anims.push((dt, t) => rings.forEach((r, i) => { r.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.12); }));

  return {
    id: 'fps', root, env, spawn: { x: 0, z: 94, yaw: Math.PI }, limit: 116, mapR: 126, colliders, portals, dummies, lootSpots, droneSpots, coins: [], ballSpots: [],
    update(dt, t) { anims.forEach((f) => f(dt, t)); },
  };
}
