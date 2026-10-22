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

const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const TAU = Math.PI * 2, HP = Math.PI / 2;
const rad = (d) => (d * Math.PI) / 180;
const mulberry = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const ringPick = (R, r0, r1) => () => { const r = r0 + R() * (r1 - r0), a = R() * TAU; return [r * Math.cos(a), r * Math.sin(a)]; };

/* ───────────── 공용 도우미 ───────────── */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
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
  return canvasTex(128, 128, (x) => { x.fillStyle = 'rgba(10,30,60,.8)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.font = '70px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70); });
}
function grassTex(rep, base = '#6fae5b') {
  const t = canvasTex(128, 128, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${130 + Math.random() * 50 | 0},${60 + Math.random() * 30 | 0},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
function kit(root, colliders) {
  const add = (o, cast = true) => { o.castShadow = cast; o.receiveShadow = true; root.add(o); return o; };
  const flat = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; root.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; return add(m, cast); };
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
  instanced(root, new THREE.SphereGeometry(0.36, 8, 6), M('#ffffff'), pts.length, (o, i, im) => {
    o.position.set(pts[i][0], pts[i][1], pts[i][2]); o.scale.setScalar(0.85 + R() * 0.3); im.setColorAt(i, new THREE.Color(CROWD[(R() * CROWD.length) | 0]));
  }, false);
}
function trees(root, colliders, R, n, pick, accept, hue = 0.29) {
  const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), M('#7a5230'), n), cr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0), M('#ffffff', { roughness: 0.9 }), n);
  tr.castShadow = cr.castShadow = true; tr.frustumCulled = cr.frustumCulled = false;
  const o = new THREE.Object3D(), c = new THREE.Color(); let k = 0, g = 0;
  while (k < n && g++ < n * 80) {
    const [x, z] = pick(); if (!accept(x, z)) continue;
    const s = 0.8 + R() * 0.7;
    o.rotation.set(0, R() * 6, 0); o.scale.setScalar(s);
    o.position.set(x, s, z); o.updateMatrix(); tr.setMatrixAt(k, o.matrix);
    o.position.set(x, 3 * s, z); o.updateMatrix(); cr.setMatrixAt(k, o.matrix);
    cr.setColorAt(k, c.setHSL(hue - 0.02 + R() * 0.07, 0.5, 0.17 + R() * 0.07));
    colliders.push({ x, z, r: 0.8, h: 5 }); k++;
  }
  tr.count = cr.count = k; root.add(tr, cr);
}
function hills(root, R, n, d0, d1, color) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3, d = d0 + R() * (d1 - d0), r = 40 + R() * 60, h = 25 + R() * 45;
    const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 7), M(color, { roughness: 1 })); m.scale.set(r, h, r); m.position.set(Math.cos(a) * d, h / 2 - 3, Math.sin(a) * d); root.add(m);
  }
}
/* 하늘 돔 + 해 + 구름. 반환값은 매 프레임 호출할 함수 */
function sky(root, { stops, sunDir, glow = '#ffb060', clouds = 14, tint = '#ffffff', R }) {
  const tex = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([p, c]) => g.addColorStop(p, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(640, 32, 20), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
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
  const cg = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16); cg.rotateX(Math.PI / 2);
  const cm = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#a07800', metalness: 0.6, roughness: 0.3 });
  return (x, z) => { const m = new THREE.Mesh(cg, cm); m.position.set(x, 1.2, z); m.castShadow = true; root.add(m); coins.push({ mesh: m, x, z, got: false, ph: Math.random() * 6 }); };
}
const spinCoins = (coins, dt, t) => coins.forEach((c) => { if (!c.got) { c.mesh.rotation.y += dt * 3; c.mesh.position.y = 1.2 + Math.sin(t * 2 + c.ph) * 0.15; } });
/* 훈련용 오뚝이 샌드백 */
function dummy(root, colliders, x, z, color = '#e0533d') {
  const m = new THREE.Group(); m.position.set(x, 0, z);
  [[new THREE.CylinderGeometry(0.65, 0.7, 0.18, 16), M('#444'), 0.09], [new THREE.CylinderGeometry(0.42, 0.55, 1.5, 14), M(color), 1.0], [new THREE.SphereGeometry(0.34, 14, 10), M('#f1e3c8'), 2.0]]
    .forEach(([g, mt, py]) => { const o = new THREE.Mesh(g, mt); o.position.y = py; o.castShadow = true; m.add(o); });
  const st = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), M('#ffffff')); st.rotation.x = HP; st.position.y = 1.2; m.add(st);
  root.add(m); colliders.push({ x, z, r: 0.7, h: 2.3 });
  return { x, z, r: 0.7, mesh: m, wob: 0, dir: 0 };
}
/* 월드 이동 포털 */
function makePortal(root, anims, { x, z, to, sign, color, label: text }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); root.add(g);
  const em = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }), dk = M('#2b3350');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 0.3, 40), dk); base.position.y = 0.15; base.receiveShadow = true; g.add(base);
  const rb = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.08, 6, 48), em); rb.rotation.x = HP; rb.position.y = 0.32; g.add(rb);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 12, 48), em); rg.position.y = 3.3; rg.castShadow = true; g.add(rg);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.7), dk); p.position.set(sx * 2.7, 0.9, 0); p.castShadow = true; g.add(p); }
  const sw = canvasTex(128, 128, (c) => {
    const gr = c.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, color + 'ff'); gr.addColorStop(0.6, color + '88'); gr.addColorStop(1, color + '11'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 5; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(64, 64, 14 + k * 13, k, k + 2.2); c.stroke(); }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.55, 40), new THREE.MeshBasicMaterial({ map: sw, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); disc.position.y = 3.3; g.add(disc);
  const l = label(sign, { bg: color, scale: 9 }); l.position.set(0, 7.3, 0); g.add(l);
  anims.push((dt, t) => { disc.rotation.z += dt * 1.6; disc.material.opacity = 0.7 + Math.sin(t * 3) * 0.15; em.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4; });
  return { x, z, r: 4, to, label: text };
}
/* 벽 한 줄(메시 + 충돌 원) */
function seg(root, colliders, x1, z1, x2, z2, mat, h = 3.6) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, 0.5), mat);
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(dz, dx); m.castShadow = m.receiveShadow = true; root.add(m);
  const n = Math.max(1, Math.ceil(L / 1.2));
  for (let i = 0; i <= n; i++) colliders.push({ x: x1 + (dx * i) / n, z: z1 + (dz * i) / n, r: 0.65, h });
}
/* 관중석 (local +z 가 앞쪽, ry 로 방향 지정) */
function stand(root, colliders, R, x, z, ry, len = 32, steps = 5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  const pts = [], mats = [M('#b9bfc9'), M('#d9433a')], c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < steps; i++) {
    const h = 1 + i * 1.1, zz = -i * 2.2, b = new THREE.Mesh(new THREE.BoxGeometry(len, h, 2.2), mats[i % 2]);
    b.position.set(0, h / 2, zz); b.castShadow = b.receiveShadow = true; g.add(b);
    for (let k = 0; k < len / 1.5; k++) if (R() < 0.8) pts.push([-len / 2 + 0.8 + k * 1.5, h + 0.55, zz + 0.2]);
  }
  crowd(g, R, pts);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.3, steps * 2.2 + 1), M('#e8ebf0')); roof.position.set(0, steps * 1.1 + 4.2, -steps * 1.1 + 1); roof.castShadow = true; g.add(roof);
  for (const sx of [-len / 2, len / 2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, steps * 1.1 + 4.2, 0.4), M('#9aa5b5')); p.position.set(sx, (steps * 1.1 + 4.2) / 2, -steps * 2.2 + 1.6); g.add(p); }
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
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.font = '40px serif'; x.fillText(CI[k], 18, 34); x.font = `bold 32px ${FONT}`; x.fillText(COLLEGES[k].name, 76, 34);
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
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), M('#e8e8e8')); pole.position.y = 3.5; pole.castShadow = true; fg.add(pole);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), M('#ffd24a')); top.position.y = 7.1; fg.add(top);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), bMat[cid]); fl.position.set(0.8, 5.3, 0); fg.add(fl); flags.push(fl); col(fx, fz, 0.3, 7);
    }
  }

  /* 부스 */
  const markers = { todo: emojiTex('❗'), done: emojiTex('✅') };
  function makeBooth(d, i, x, z) {
    const C = COLLEGES[d.col], c3 = new THREE.Color(C.color).offsetHSL(((i % 6) - 2.5) * 0.012, 0, ((i % 3) - 1) * 0.035), cc = '#' + c3.getHexString();
    const g = new THREE.Group(); g.position.set(x, 0, z); const ry = Math.atan2(-x, -z); g.rotation.y = ry; root.add(g);
    const part = (geo, mat, px, py, pz, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
    const bm = (w, h, dd, mat, px, py, pz) => part(new THREE.BoxGeometry(w, h, dd), mat, px, py, pz);
    bm(9, 0.25, 8, M('#f4f1ea'), 0, 0.12, 0); bm(7.6, 0.05, 6.6, M(cc), 0, 0.27, 0.2);
    for (const [sx, sz] of [[-4.2, -3.7], [4.2, -3.7], [-4.2, 3.7], [4.2, 3.7]]) bm(0.3, 5.2, 0.3, M('#ffffff'), sx, 2.85, sz);
    bm(9.8, 0.4, 8.6, M(cc), 0, 5.6, 0); bm(10, 0.12, 8.8, M('#ffffff'), 0, 5.86, 0);
    part(new THREE.PlaneGeometry(9.4, 1.2), fascia(d.col), 0, 6.55, 4.36, false);
    const panelTex = canvasTex(512, 256, (x2, w, h) => {
      const gr = x2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, cc); gr.addColorStop(1, '#10203a'); x2.fillStyle = gr; x2.fillRect(0, 0, w, h);
      x2.font = '96px serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(d.icon, 90, 120);
      x2.fillStyle = '#fff'; x2.textAlign = 'left'; x2.font = `bold 15px ${FONT}`; x2.fillText(C.name, 160, 40);
      let s = 40; do { x2.font = `bold ${s}px ${FONT}`; s -= 2; } while (x2.measureText(d.name).width > 330 && s > 18);
      x2.fillText(d.name, 160, 100); x2.font = `22px ${FONT}`; x2.fillStyle = '#ffe9a8'; x2.fillText('🎯 ' + d.job, 160, 160);
    });
    const plain = M('#dfe6f0'); bm(8.4, 3.2, 0.2, [plain, plain, plain, plain, new THREE.MeshBasicMaterial({ map: panelTex }), plain], 0, 3.3, -3.8);
    bm(5, 1.1, 1.1, M('#e9e4d8'), 0, 0.8, -1.4); bm(5.3, 0.12, 1.3, M(cc), 0, 1.4, -1.4);
    bm(1.5, 0.95, 0.1, new THREE.MeshStandardMaterial({ color: '#16202e', emissive: cc, emissiveIntensity: 0.9 }), -1.4, 2.1, -1.5);
    let tick = null;
    if (d.col === 'eng') { const gear = part(new THREE.TorusGeometry(0.42, 0.15, 8, 14), M('#f2b84b', { metalness: 0.5, roughness: 0.4 }), 1.3, 1.95, -1.4); tick = (dt) => { gear.rotation.z += dt; }; }
    else if (d.col === 'sea') {
      part(new THREE.BoxGeometry(1.5, 0.8, 0.8), M('#7fd3ee', { transparent: true, opacity: 0.55 }), 1.3, 1.9, -1.4);
      const fg = new THREE.ConeGeometry(0.16, 0.5, 6); fg.rotateZ(-HP); const fish = part(fg, M('#ff8a3d'), 1.3, 1.9, -1.4);
      tick = (dt, t) => { fish.position.x = 1.3 + Math.sin(t * 1.6) * 0.45; fish.rotation.y = Math.cos(t * 1.6) > 0 ? 0 : Math.PI; };
    } else if (d.col === 'cul') {
      const gl = part(new THREE.SphereGeometry(0.46, 18, 14), M('#4c8dd9', { emissive: '#1a3d80', emissiveIntensity: 0.5 }), 1.3, 2.0, -1.4);
      part(new THREE.CylinderGeometry(0.08, 0.14, 0.3, 8), M('#8a6a3a'), 1.3, 1.58, -1.4); tick = (dt) => { gl.rotation.y += dt * 0.8; };
    }
    part(new THREE.CylinderGeometry(0.07, 0.07, 6.4, 6), M('#e8e8e8'), 5.2, 3.2, 3.9);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.6), bMat[d.col]); fl.position.set(5.9, 4.7, 3.9); g.add(fl);
    const look = { skin: '#f5c9a0', hair: ['#2b1b12', '#5a3a22', '#c9a24a'][i % 3], hairStyle: ['short', 'bob', 'long', 'pony'][i % 4], uniform: '#1f3b73', bag: '#e0a43a' };
    const npc = createCharacter(look, { coat: cc }); npc.group.position.set(0, 0.12, -2.6); g.add(npc.group);
    const name = label(d.name, { bg: cc, scale: 9 }); name.position.set(0, 7.6, 0); g.add(name);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markers.todo, transparent: true, depthWrite: false, fog: false })); marker.scale.set(1.8, 1.8, 1); marker.position.set(0, 9.8, 0); g.add(marker);
    const s = Math.sin(ry), c = Math.cos(ry);
    for (const lx of [-2.8, 0, 2.8]) col(x + lx * c - 2 * s, z - lx * s - 2 * c, 2.1, 6);
    const b = { dept: d, x, z, group: g, npc, marker, my: 9.8, tick, done: false, setDone(f) { this.done = f; marker.material.map = f ? markers.done : markers.todo; marker.material.needsUpdate = true; if (f) npc.stopWave(); } };
    booths.push(b); return b;
  }
  const sectors = { eng: [], sea: [], cul: [] }; let gi = 0;
  DEPTS.forEach((d) => { if (sectors[d.col]) sectors[d.col].push(d); });
  for (const [cid, list] of Object.entries(sectors)) {
    const C = COLLEGES[cid], rings = [[42, []], [68, []]];
    list.forEach((d, i) => rings[i % 2][1].push(d));
    rings.forEach(([r, arr], ri) => arr.forEach((d, j) => { const t = (j + (ri === 0 ? 0.25 : 0.75)) / arr.length, a = rad(C.a0 + t * (C.a1 - C.a0)); makeBooth(d, gi++, r * Math.cos(a), r * Math.sin(a)); }));
  }

  /* 창의융합학부 — 유리 돔 */
  (function makeDome() {
    const d = DEPTS.find((q) => q.col === 'cre'), C = COLLEGES.cre, g = new THREE.Group(); g.position.set(0, 0, -12); root.add(g);
    const part = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    const disc = (r, c, y) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), M(c)); m.rotation.x = -HP; m.position.y = y; m.receiveShadow = true; g.add(m); };
    disc(11, '#ebe5f8', 0.05); disc(9.6, '#cdbff0', 0.07);
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(8.6, 3), new THREE.MeshStandardMaterial({ color: '#d8caff', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(8.66, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.5 })));
    const lav = M('#b9a4f5', { metalness: 0.2 });
    for (const sx of [-2.6, 2.6]) part(new THREE.BoxGeometry(0.9, 5.4, 0.9), lav, sx, 3.0, 8.5);
    part(new THREE.TorusGeometry(2.6, 0.45, 10, 32, Math.PI), lav, 0, 5.7, 8.5);
    const logo = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, fog: false, map: canvasTex(128, 128, (x) => {
      const gr = x.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#7b5cf2'); gr.addColorStop(1, '#4cc3ff'); x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.font = 'bold 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('C', 64, 70);
    }) })); logo.scale.set(3, 3, 1); logo.position.set(0, 7.5, 8.9); g.add(logo);
    const lb = label('창의융합학부', { bg: C.color, scale: 10 }); lb.position.set(0, 10.4, 8.5); g.add(lb);
    const orbM = new THREE.MeshStandardMaterial({ color: '#b79bff', emissive: '#8e5cf2', emissiveIntensity: 1.2, roughness: 0.3 });
    const orb = part(new THREE.SphereGeometry(1.3, 24, 16), orbM, 0, 3.6, 0), r1 = part(new THREE.TorusGeometry(2.2, 0.08, 8, 40), orbM, 0, 3.6, 0), r2 = part(new THREE.TorusGeometry(2.7, 0.06, 8, 40), orbM, 0, 3.6, 0);
    part(new THREE.CylinderGeometry(0.9, 1.3, 1.6, 20), lav, 0, 0.8, 0);
    anims.push((dt, t) => { orb.rotation.y += dt; r1.rotation.x += dt * 0.7; r2.rotation.y += dt * 0.5; orb.position.y = 3.6 + Math.sin(t * 1.5) * 0.2; });
    const npc = createCharacter({ skin: '#f5c9a0', hair: '#5a3a22', hairStyle: 'pony', uniform: '#1f3b73', bag: '#e0a43a' }, { coat: C.color }); npc.group.position.set(0, 0.06, 6.4); g.add(npc.group);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markers.todo, transparent: true, depthWrite: false, fog: false })); marker.scale.set(1.8, 1.8, 1); marker.position.set(0, 12.6, 8.5); g.add(marker);
    for (let k = 0; k < 24; k++) { if (k >= 5 && k <= 7) continue; const a = (k / 24) * TAU; col(Math.cos(a) * 8.2, -12 + Math.sin(a) * 8.2, 1.1, 8); }
    col(0, -12, 1.8, 4); col(-2.6, -3.5, 0.5, 6); col(2.6, -3.5, 0.5, 6);
    booths.push({ dept: d, x: 0, z: -3.5, group: g, npc, marker, my: 12.6, tick: null, done: false, setDone(f) { this.done = f; marker.material.map = f ? markers.done : markers.todo; marker.material.needsUpdate = true; if (f) npc.stopWave(); } });
  })();

  /* 키오스크 */
  const kiosk = { x: -12, z: 10 };
  { const kg = new THREE.Group(); kg.position.set(kiosk.x, 0, kiosk.z); kg.rotation.y = Math.atan2(-kiosk.x, -kiosk.z); root.add(kg);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 0.8), M('#2a4f8a')); kb.position.y = 1.5; kb.castShadow = true; kg.add(kb);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), new THREE.MeshBasicMaterial({ map: canvasTex(256, 180, (x, w, h) => { x.fillStyle = '#0f2547'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd24a'; x.font = '56px serif'; x.textAlign = 'center'; x.fillText('📊', w / 2, 80); x.fillStyle = '#fff'; x.font = `bold 26px ${FONT}`; x.fillText('진로 리포트', w / 2, 130); }) })); scr.position.set(0, 1.9, 0.41); kg.add(scr);
    const l = label('📊 진로 리포트', { bg: '#2a4f8a', scale: 6 }); l.position.set(kiosk.x, 4.5, kiosk.z); root.add(l); col(kiosk.x, kiosk.z, 1.6, 3); }

  /* 펀치 연습장(샌드백) */
  [12, 16, 20].forEach((x, i) => dummies.push(dummy(root, colliders, x, 16, ['#e0533d', '#f2b84b', '#4c8dd9'][i])));
  { const l = label('🥊 펀치 연습장', { bg: '#c0503a', scale: 6 }); l.position.set(16, 4.4, 18); root.add(l); }

  /* 가로등 · 벤치 */
  for (let k = 0; k < 10; k++) {
    const a = rad(18 + k * 36), lx = Math.cos(a) * 25.8, lz = Math.sin(a) * 25.8;
    box(0.18, 4.4, 0.18, M('#2b2f3a'), lx, 2.2, lz);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffcf70', emissiveIntensity: 1.5 })); bulb.position.set(lx, 4.6, lz); root.add(bulb); col(lx, lz, 0.3, 4.6);
  }
  for (let k = 0; k < 6; k++) {
    const a = rad(30 + k * 60), bx = Math.cos(a) * 28.5, bz = Math.sin(a) * 28.5, bg = new THREE.Group(), wd = M('#8a5a34');
    bg.position.set(bx, 0, bz); bg.rotation.y = Math.atan2(-bx, -bz); root.add(bg);
    [[new THREE.BoxGeometry(2.4, 0.18, 0.7), 0, 0.55, 0], [new THREE.BoxGeometry(2.4, 0.6, 0.12), 0, 0.95, -0.3], [new THREE.BoxGeometry(0.15, 0.55, 0.6), -1.0, 0.27, 0], [new THREE.BoxGeometry(0.15, 0.55, 0.6), 1.0, 0.27, 0]].forEach(([geo, px, py, pz]) => { const m = new THREE.Mesh(geo, wd); m.position.set(px, py, pz); m.castShadow = true; bg.add(m); });
    col(bx, bz, 0.9, 1);
  }

  /* 해안 풍경: 시계탑 홀 */
  (function hall(x, z) {
    const g = new THREE.Group(), ry = Math.atan2(-x, -z), c = Math.cos(ry), s = Math.sin(ry); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const fac = canvasTex(512, 160, (cx) => { cx.fillStyle = '#f1e4cb'; cx.fillRect(0, 0, 512, 160); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = '#6f8fb8'; cx.fillRect(24 + i * 60, 20 + j * 66, 32, 46); cx.fillStyle = '#efe3c9'; cx.fillRect(38 + i * 60, 20 + j * 66, 3, 46); } });
    const plain = M('#f1e4cb'), part = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    part(new THREE.BoxGeometry(22, 9, 10), [plain, plain, plain, plain, new THREE.MeshStandardMaterial({ map: fac, roughness: 0.8 }), plain], 0, 4.5, 0);
    const rg = new THREE.ConeGeometry(7.8, 4.5, 4); rg.rotateY(Math.PI / 4); const roof = part(rg, M('#b5543f'), 0, 11.25, 0); roof.scale.set(2, 1, 1);
    part(new THREE.BoxGeometry(3.6, 15, 3.6), plain, 0, 7.5, 4.2);
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 16, 20), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 })); body.position.y = 8; body.castShadow = true; g.add(body);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2, 12), new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffcf70', emissiveIntensity: 1.6 })); lamp.position.y = 17; g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 12), M('#3a3f4c')); cap.position.y = 19.1; g.add(cap);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(4.5), M('#7d7a72', { roughness: 1 })); rock.scale.y = 0.5; g.add(rock);
    col(x, z, 4, 18);
  })(rad(335));
  const yachts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), a = R() * TAU, d = 175 + R() * 140; g.position.set(Math.cos(a) * d, -0.2, Math.sin(a) * d); g.rotation.y = R() * TAU;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 5), M('#ffffff')); hull.position.y = 0.4; g.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 5), M('#cccccc')); mast.position.y = 4; g.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6.2, 3), new THREE.MeshStandardMaterial({ color: '#fff7ea', side: THREE.DoubleSide })); sail.scale.z = 0.05; sail.position.set(0, 4.2, -0.3); g.add(sail);
    root.add(g); yachts.push({ g, ph: R() * 6 });
  }
  anims.push((dt, t) => yachts.forEach((y) => { y.g.position.y = -0.2 + Math.sin(t * 1.2 + y.ph) * 0.18; y.g.rotation.z = Math.sin(t * 0.9 + y.ph) * 0.05; }));

  /* 포털 (다른 월드로) */
  [[188, 'race', '🏎️ 레이싱 서킷', '#ff6b3d'], [302, 'soccer', '⚽ 축구 스타디움', '#2fbf71'], [29, 'fps', '🎯 FPS 훈련장', '#e04a5a']].forEach(([deg, to, text, color]) => {
    portals.push(makePortal(root, anims, { x: Math.cos(rad(deg)) * 100, z: Math.sin(rad(deg)) * 100, to, sign: text, color, label: `${text} 입장` }));
  });
  const portalFar = (x, z) => portals.every((p) => Math.hypot(p.x - x, p.z - z) > 12);

  /* 나무 */
  const bAcc = (x, z) => free(x, z, 4) && booths.every((b) => Math.hypot(b.x - x, b.z - z) > 9) && portalFar(x, z);
  trees(root, colliders, R, 45, ringPick(R, 28, 86), bAcc);
  trees(root, colliders, R, 85, ringPick(R, 90, 116), (x, z) => free(x, z, 3) && portalFar(x, z) && Math.hypot(x - Math.cos(rad(248)) * 104, z - Math.sin(rad(248)) * 104) > 16);

  /* 코인 */
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
  instanced(root, new THREE.BoxGeometry(0.4, 0.05, 3), M('#f2d34b'), 80, (o, i) => { const a = (i / 80) * TAU; o.position.set(TR * Math.cos(a), 0.07, TR * Math.sin(a)); o.rotation.y = -a; }, false);
  const curbR = [TR - TW / 2 - 0.7, TR + TW / 2 + 0.7];
  instanced(root, new THREE.BoxGeometry(1.4, 0.2, 5.4), M('#ffffff'), 240, (o, i, im) => {
    const k = (i / 2) | 0, a = (k / 120) * TAU, r = curbR[i % 2]; o.position.set(r * Math.cos(a), 0.1, r * Math.sin(a)); o.rotation.y = -a; im.setColorAt(i, new THREE.Color(k % 2 ? '#d63a3a' : '#ffffff'));
  }, false);
  const chk = canvasTex(128, 32, (x) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); } });
  flat(new THREE.PlaneGeometry(TW, 2), new THREE.MeshBasicMaterial({ map: chk }), 0.08).position.set(TR, 0.08, 0);
  for (const px of [TR - TW / 2 - 1.5, TR + TW / 2 + 1.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), M('#dddddd')); p.position.set(px, 4.5, 0); p.castShadow = true; root.add(p); col(px, 0, 0.6, 9); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(TW + 4, 1.6, 0.6), M('#222831')); banner.position.set(TR, 9.2, 0); banner.castShadow = true; root.add(banner);
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
  instanced(root, new THREE.BoxGeometry(8, 2.4, 0.4), M('#ffffff'), 70, (o, i, im) => { const a = (i / 70) * TAU; o.position.set(143 * Math.cos(a), 1.2, 143 * Math.sin(a)); o.rotation.y = -a + HP; im.setColorAt(i, new THREE.Color(ADC[i % ADC.length])); });
  const garage = { x: 118, z: -6 };
  { const gb = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 14), M('#d9433a')); gb.position.set(130, 3, -8); gb.castShadow = true; root.add(gb);
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

/* ═════════════════ 3) 축구 스타디움 (해질녘) ═════════════════ */
function buildSoccer(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], portals = [], anims = [], R = mulberry(37), pitch = { x: 0, z: 0, hw: 22, hl: 34 };
  const { flat, col } = kit(root, colliders);
  const env = { sky: '#d9a8a8', fog: ['#d9a8a8', 100, 340], sunPos: [-70, 38, 50], sunColor: '#ffd2a0', sunI: 1.5, hemi: ['#cfd8ff', '#4a6a4a', 1.0] };
  anims.push(sky(root, { stops: [[0, '#2b3f94'], [0.2, '#5a6cc0'], [0.36, '#c28fc0'], [0.46, '#ffb98a'], [0.5, '#d9a8a8'], [1, '#d9a8a8']], sunDir: env.sunPos, glow: '#ffa860', clouds: 14, tint: '#ffd0d0', R }));
  flat(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ map: grassTex(40, '#5fa352'), roughness: 1 }), 0);
  flat(new THREE.CircleGeometry(600, 40), M('#3d6a3a'), -0.08);
  flat(new THREE.RingGeometry(44, 58, 72), M('#c0503a', { polygonOffset: true, polygonOffsetFactor: -1 }), 0.02);
  for (const r of [47, 50.5, 54]) flat(new THREE.RingGeometry(r - 0.12, r + 0.12, 72), M('#ffffff', { polygonOffset: true, polygonOffsetFactor: -2 }), 0.03);

  /* 경기장 라인 */
  const pt = canvasTex(440, 680, (x, w, h) => {
    for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#4f9a4a' : '#5aa754'; x.fillRect(0, (i * h) / 10, w, h / 10 + 1); }
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(8, 8, w - 16, h - 16);
    x.beginPath(); x.moveTo(8, h / 2); x.lineTo(w - 8, h / 2); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 60, 0, 7); x.stroke();
    for (const top of [8, h - 8 - 120]) { x.strokeRect(w / 2 - 130, top, 260, 120); }
    for (const top of [8, h - 8 - 50]) { x.strokeRect(w / 2 - 70, top, 140, 50); }
  });
  flat(new THREE.PlaneGeometry(pitch.hw * 2, pitch.hl * 2), new THREE.MeshBasicMaterial({ map: pt }), 0.05);

  /* 골대 */
  const wm = M('#ffffff');
  for (const sgn of [-1, 1]) {
    const gg = new THREE.Group(); gg.position.set(pitch.x, 0, sgn * pitch.hl); root.add(gg);
    for (const dx of [-4, 4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4), wm); post.position.set(dx, 1.2, 0); post.castShadow = true; gg.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 0.2), wm); bar.position.set(0, 2.4, 0); gg.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); net.position.set(0, 1.2, sgn * 1.5); gg.add(net);
    for (const dx of [-4, 4]) { col(pitch.x + dx, sgn * pitch.hl, 0.18, 2.4); col(pitch.x + dx, sgn * (pitch.hl + 3), 0.18, 2.4); }
  }
  for (const [cx, cz] of [[-22, -34], [22, -34], [-22, 34], [22, 34]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), wm); p.position.set(cx, 0.8, cz); root.add(p); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ color: '#e0533d', side: THREE.DoubleSide })); f.position.set(cx + 0.25, 1.4, cz); root.add(f); }

  /* 스타디움 관중석(원형 볼) · 조명탑 · 전광판 */
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(100, 80, 14, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#7d8794', roughness: 0.9, side: THREE.DoubleSide }));
  bowl.position.y = 7; bowl.receiveShadow = true; root.add(bowl);
  instanced(root, new THREE.SphereGeometry(0.4, 8, 6), M('#ffffff'), 520, (o, i, im) => {
    const r = 82 + R() * 16, a = R() * TAU; o.position.set(Math.cos(a) * r, ((r - 80) / 20) * 14 + 0.6, Math.sin(a) * r); o.scale.setScalar(0.85 + R() * 0.3); im.setColorAt(i, new THREE.Color(CROWD[(R() * CROWD.length) | 0]));
  }, false);
  for (const deg of [45, 135, 225, 315]) {
    const x = Math.cos(rad(deg)) * 66, z = Math.sin(rad(deg)) * 66, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); root.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 22, 8), M('#9aa5b5')); pole.position.y = 11; pole.castShadow = true; g.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff2b0', emissiveIntensity: 1.6 })); lamp.position.set(0, 22.5, 0.5); g.add(lamp);
    col(x, z, 0.9, 22);
  }
  for (const sz of [-1, 1]) { const l = label('⚽ JNU 여수 스타디움', { bg: '#1f3b73', scale: 20 }); l.position.set(0, 13, sz * 70); root.add(l); }
  for (const sx of [-1, 1]) { // 벤치
    const b = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 10), M('#3a4a68')); b.position.set(sx * 28, 0.8, 0); b.castShadow = true; root.add(b);
    for (const zz of [-3.5, 0, 3.5]) col(sx * 28, zz, 1.8, 1.6);
  }

  /* 포털 → 캠퍼스 */
  portals.push(makePortal(root, anims, { x: 0, z: -56, to: 'campus', sign: '🏫 캠퍼스', color: '#4c8dd9', label: '🏫 캠퍼스로 돌아가기' }));
  const ballSpots = [{ x: 0, z: 0, r: 0.75, kind: 'soccer' }, { x: -8, z: 8, r: 0.75, kind: 'soccer' }, { x: 8, z: -8, r: 0.75, kind: 'soccer' }, { x: 0, z: 14, r: 2, kind: 'big' }];
  return {
    id: 'soccer', root, env, spawn: { x: 0, z: -43, yaw: 0 }, limit: 78, mapR: 84, colliders, portals, pitch, ballSpots, coins: [],
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
  instanced(root, new THREE.BoxGeometry(7.6, 2.6, 1.2), M('#9da3ab'), 96, (o, i) => { const a = (i / 96) * TAU; o.position.set(117.6 * Math.cos(a), 1.3, 117.6 * Math.sin(a)); o.rotation.y = -a + HP; });

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
  const crate = (x, z, s = 1.6) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), M('#a9854f')); m.position.set(x, s / 2, z); m.rotation.y = R() * 3; m.castShadow = m.receiveShadow = true; root.add(m); col(x, z, s * 0.7, s); };
  function container(x, z, ry, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(12, 2.7, 2.5), M(color, { roughness: 0.6, metalness: 0.3 })); m.position.set(x, 1.35, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; root.add(m);
    for (let i = -2; i <= 2; i++) col(x + Math.cos(ry) * i * 2.5, z - Math.sin(ry) * i * 2.5, 1.6, 2.7);
  }
  const sand = M('#b5a67e');
  function bunker(cx, cz) {
    seg(root, colliders, cx - 5, cz - 3, cx + 5, cz - 3, sand, 1.2); seg(root, colliders, cx - 5, cz - 3, cx - 5, cz + 3, sand, 1.2); seg(root, colliders, cx + 5, cz - 3, cx + 5, cz + 3, sand, 1.2);
    lootSpots.push({ x: cx, z: cz - 0.5, tier: 2 });
  }
  function waterTower(x, z) {
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), M('#7a828c')); l.position.set(x + dx, 4.5, z + dz); l.castShadow = true; root.add(l); }
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 16), M('#c7cdd6')); tk.position.set(x, 10.4, z); tk.castShadow = true; root.add(tk);
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
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); bm.position.set(l.x, 1.7, l.z); root.add(bm);
  });
  anims.push((dt, t) => rings.forEach((r, i) => { r.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.12); }));

  return {
    id: 'fps', root, env, spawn: { x: 0, z: 94, yaw: Math.PI }, limit: 116, mapR: 126, colliders, portals, dummies, lootSpots, droneSpots, coins: [], ballSpots: [],
    update(dt, t) { anims.forEach((f) => f(dt, t)); },
  };
}