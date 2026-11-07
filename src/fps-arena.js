/* ═══════════════════════════════════════════════════════════════
 * src/fps-arena.js (신규) — FPS 훈련장 새 지형
 *
 * buildArena(scene, oldFpsWorld) → 기존 WS.fps 와 같은 형식의 월드 객체를 돌려줍니다.
 *   (race.js 의 buildCircuit 과 같은 방식으로 game.js 에서 교체: 패치 P5)
 *   구성: 중앙 요새 / 컨테이너 구역 / 격납고 폐허 / 사격장(표적 9) / 숲 / 급수탑 / 길 / 외곽 벽·산
 *   충돌은 기존 엔진과 같은 원형 충돌체(colliders)만 씁니다. 바닥은 평지입니다.
 *   고정 시드라 매번 같은 지형이 나옵니다. 이미지 파일은 쓰지 않습니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function label(text, color = '#ffffff', bg = 'rgba(10,30,60,.74)', w = 512, h = 128, k = 0.03) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; rrect(g, 4, 4, w - 8, h - 8, 28); g.fill();
  let fs = 64; const fam = '"Malgun Gothic","Noto Sans KR","Apple SD Gothic Neo",sans-serif';
  g.font = `800 ${fs}px ${fam}`; while (g.measureText(text).width > w - 56 && fs > 24) { fs -= 4; g.font = `800 ${fs}px ${fam}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(w * k, h * k, 1); return s;
}

export function buildArena(scene, old) {
  const root = new THREE.Group(); root.name = 'fps-arena'; scene.add(root);
  let seed = 20261107;
  const rnd = (a = 0, b = 1) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + (seed / 4294967296) * (b - a); };
  const colliders = [], lootSpots = [], droneSpots = [], dummies = [];
  const kinds = [...new Set(((old && old.droneSpots) || []).map((s) => s.kind).filter((k) => k != null))];
  const addCol = (x, z, r, h) => colliders.push({ x, z, r, h });

  const mats = {};
  const M = (c, r = 0.9, m = 0) => mats[c + '|' + r + '|' + m] || (mats[c + '|' + r + '|' + m] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
  const box = (x, y, z, w, h, d, mat, o = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry;
    m.castShadow = o.cast !== false; m.receiveShadow = true; (o.parent || root).add(m); return m;
  };
  const pad = (cx, cz, w, d, color) => box(cx, 0.03, cz, w, 0.06, d, M(color, 1), { cast: false });
  const free = (x, z, p) => colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + p);
  const pick = (cx, cz, rad, p = 1.6, tries = 50) => {
    for (let i = 0; i < tries; i++) {
      const a = rnd(0, 6.283), d = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) < 108 && free(x, z, p)) return { x, z };
    }
    return null;
  };

  /* ── 바닥 ── */
  {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#6f8f4e'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(60,90,40,${rnd(.08, .22)})` : v < 0.8 ? `rgba(150,170,100,${rnd(.06, .16)})` : `rgba(120,95,60,${rnd(.08, .2)})`;
      g.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 5), rnd(1, 5));
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(50, 50); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(170, 72), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  }
  const road = (x1, z1, x2, z2, w = 6) => {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    box((x1 + x2) / 2, 0.025, (z1 + z2) / 2, L, 0.05, w, M('#8c7b5e', 1), { ry: -Math.atan2(dz, dx), cast: false });
  };
  road(0, -104, 0, -18, 7); road(18, 0, 46, 24, 6); road(-18, 0, -44, 24, 6); road(0, 18, 0, 64, 6); road(0, -18, 46, -52, 6); road(0, -18, -40, -50, 6);

  /* ── 벽 / 사물 도우미 ── */
  const wall = (x1, z1, x2, z2, h, th, mat) => {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / (th * 0.9)));
    box((x1 + x2) / 2, h / 2, (z1 + z2) / 2, L, h, th, mat, { ry: -Math.atan2(dz, dx) });
    for (let i = 0; i <= n; i++) addCol(x1 + (dx * i) / n, z1 + (dz * i) / n, th * 0.72, h);
  };
  const CONC = M('#b4b7bc', 0.95), DARK = M('#2b3340', 0.8), SAND = M('#c9b27a', 1), EARTH = M('#7a6a4a', 1), WOOD = M('#8a6a44', 0.95);
  const crate = (x, z, s = 1.5, ry = 0) => {
    box(x, s / 2, z, s, s, s, M(rnd() < 0.5 ? '#a07a4a' : '#7a6a52', 0.95), { ry }); box(x, s / 2, z, s * 1.02, s * 0.12, s * 1.02, M('#5a4630', 1), { ry, cast: false });
    addCol(x, z, s * 0.62, s);
  };
  const barrel = (x, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), M(rnd() < 0.5 ? '#b8392e' : '#2f5fa0', 0.6, 0.2));
    m.position.set(x, 0.55, z); m.castShadow = true; root.add(m); addCol(x, z, 0.55, 1.1);
  };
  const CC = ['#c0553d', '#3f6fa8', '#4a8a5a', '#d0a238', '#8a8f99', '#7a4f9a'];
  const container = (x, z, ry, ci, y0 = 0, solid = true) => {
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; root.add(g);
    box(0, 1.25, 0, 6.2, 2.5, 2.5, M(CC[ci % CC.length], 0.7, 0.15), { parent: g });
    box(3.1, 1.25, 0, 0.12, 2.3, 2.3, DARK, { parent: g, cast: false });
    for (let i = -2; i <= 2; i++) box(i * 1.2, 1.25, 1.27, 0.12, 2.3, 0.05, M('#00000033'.slice(0, 7), 1), { parent: g, cast: false });
    if (solid) for (let i = -2; i <= 2; i++) addCol(x + i * 1.35 * Math.cos(ry), z - i * 1.35 * Math.sin(ry), 1.4, y0 + 2.5);
  };

  /* ── 중앙 요새 (0,0) ── */
  pad(0, 0, 44, 44, '#9a9fa6');
  const H = 3.4, T = 1.2, R = 18, GAP = 3.5;
  for (const s of [-1, 1]) {
    wall(-R, s * R, -GAP, s * R, H, T, CONC); wall(GAP, s * R, R, s * R, H, T, CONC);      // 남·북
    wall(s * R, -R, s * R, -GAP, H, T, CONC); wall(s * R, GAP, s * R, R, H, T, CONC);      // 서·동
    for (const t of [-1, 1]) {                                                              // 모서리 탑
      box(s * R, 4.2, t * R, 4.4, 8.4, 4.4, M('#8f949c', 0.9)); box(s * R, 8.5, t * R, 5, 0.4, 5, DARK);
      addCol(s * R, t * R, 2.9, 8.4);
    }
  }
  box(0, 7, 0, 6, 14, 6, M('#7d848f', 0.85)); addCol(0, 0, 4.4, 14);
  for (const y of [4, 8, 12]) box(0, y, 0, 6.06, 0.9, 6.06, DARK, { cast: false });
  box(0, 14.3, 0, 7, 0.6, 7, DARK);
  const beacon = new THREE.Group(); beacon.position.set(0, 15.2, 0); root.add(beacon);
  { const bm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: '#ff5a4a' })); beacon.add(bm); }
  [[-8, -9], [8, -9], [-9, 8], [9, 9], [-12, 0], [12, 1], [0, -11], [0, 12]].forEach(([x, z], i) => crate(x, z, i % 3 === 0 ? 1.8 : 1.4, rnd(0, 3)));
  // 출입구 바깥 모래주머니
  for (const [a, b, c, d] of [[-6, -24, -2, -24], [2, -24, 6, -24], [-6, 24, -2, 24], [2, 24, 6, 24], [24, -6, 24, -2], [24, 2, 24, 6], [-24, -6, -24, -2], [-24, 2, -24, 6]]) wall(a, b, c, d, 1.1, 0.9, SAND);

  /* ── 컨테이너 구역 (58,36) ── */
  const YX = 58, YZ = 36; pad(YX, YZ, 50, 46, '#8b8a82');
  [[-14, -10, 0, 0, 0], [-4, -10, 0, 1, 1], [8, -10, 1.5708, 2, 0], [-14, 0, 0, 3, 0], [0, 2, 1.5708, 4, 1], [10, 6, 0, 5, 1], [-10, 11, 1.5708, 0, 0], [2, 14, 0, 1, 0], [-17, 15, 0, 2, 0], [14, -1, 1.5708, 3, 0]]
    .forEach(([ox, oz, ry, ci, stack]) => {
      container(YX + ox, YZ + oz, ry, ci);
      if (stack) { container(YX + ox, YZ + oz, ry + 0.12, ci + 2, 2.5, false); colliders.slice(-5).forEach((c) => { c.h = 5; }); }
    });
  // 위 줄의 stack 컨테이너는 충돌체를 따로 만들지 않으므로, 아래 5개 충돌체 높이만 올림 (위 코드의 slice 로 처리)

  /* ── 격납고 폐허 (60,-64) ── */
  const HX = 60, HZ = -64; pad(HX, HZ, 44, 34, '#7c7f86');
  const HM = M('#9a9ea6', 0.9);
  wall(HX - 19, HZ - 16, HX + 19, HZ - 16, 8, 1, HM);
  wall(HX - 19, HZ - 16, HX - 19, HZ - 2, 8, 1, HM); wall(HX - 19, HZ + 3, HX - 19, HZ + 7, 3, 1, HM);
  wall(HX + 19, HZ - 16, HX + 19, HZ - 6, 8, 1, HM); wall(HX + 19, HZ, HX + 19, HZ + 12, 5, 1, HM);
  wall(HX - 14, HZ + 16, HX - 4, HZ + 16, 3, 1, HM); wall(HX + 6, HZ + 16, HX + 16, HZ + 16, 2, 1, HM);
  [[-6, -4], [-4.5, -3], [-5.5, -1.6], [12, -10], [13.2, -9], [10, 6]].forEach(([ox, oz]) => barrel(HX + ox, HZ + oz));
  { // 주차된 트럭
    const g = new THREE.Group(); g.position.set(HX - 2, 0, HZ + 6); g.rotation.y = 0.2; root.add(g);
    box(0, 1.9, 0, 7, 2.8, 2.6, M('#d9d9d4', 0.8), { parent: g }); box(4.3, 1.4, 0, 2.2, 2.2, 2.5, M('#c0553d', 0.7), { parent: g });
    for (let i = -2; i <= 3; i++) addCol(HX - 2 + i * 1.5 * Math.cos(0.2), HZ + 6 - i * 1.5 * Math.sin(0.2), 1.6, 3.3);
  }
  crate(HX + 4, HZ - 8, 1.6, 0.3); crate(HX + 5.8, HZ - 8.2, 1.4, 0.1); crate(HX - 12, HZ + 10, 1.5, 0.7);

  /* ── 사격장 (-60,40) ── */
  const RX = -60, RZ = 40; pad(RX, RZ, 36, 52, '#6e7178');
  wall(RX - 14, 22, RX + 14, 22, 1.1, 0.7, WOOD);                         // 사격선 카운터
  wall(RX - 14, 64, RX + 14, 64, 4, 3, EARTH);                            // 뒤 둔덕
  wall(RX - 16, 22, RX - 16, 64, 2, 2, EARTH); wall(RX + 16, 22, RX + 16, 64, 2, 2, EARTH);
  box(RX, 3.4, 20.2, 32, 0.3, 5, M('#4a5668', 0.8)); [-15, 15].forEach((o) => { box(RX + o, 1.7, 18.2, 0.4, 3.4, 0.4, WOOD); addCol(RX + o, 18.2, 0.4, 3.4); });
  const dummy = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.3, 12), M('#c9b27a', 0.9)); body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), M('#c9b27a', 0.9)); head.position.y = 1.65;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), M('#d83b2f', 0.6)); disc.rotation.x = Math.PI / 2; disc.position.set(0, 1.0, -0.4);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), M('#ffffff', 0.6)); dot.rotation.x = Math.PI / 2; dot.position.set(0, 1.0, -0.42);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 14), M('#3a3f48', 0.9)); base.position.y = 0.06;
    [body, head, disc, dot, base].forEach((m) => { m.castShadow = true; g.add(m); });
    dummies.push({ x, z, r: 0.55, mesh: g }); addCol(x, z, 0.5, 1.9);
  };
  [32, 42, 52].forEach((z) => [-10, 0, 10].forEach((o) => dummy(RX + o, z)));

  /* ── 급수탑 (-22,80) ── */
  { const g = new THREE.Group(); g.position.set(-22, 0, 80); root.add(g);
    [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 9, 6), M('#5a6270', 0.8)); l.position.set(a, 4.5, b); l.castShadow = true; g.add(l); });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4, 20), M('#a8b0ba', 0.7, 0.2)); tank.position.y = 11; tank.castShadow = true; g.add(tank);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.6, 20), M('#b8392e', 0.8)); roof.position.y = 13.8; g.add(roof);
    addCol(-22, 80, 2.8, 13); }

  /* ── 출발 지점 (0,-96) ── */
  pad(0, -96, 22, 16, '#8a8f98');
  const sign = label('아이템 위로 걸어가면 자동 장착!', '#fff5c8', 'rgba(20,50,90,.82)', 640, 128, 0.014); sign.position.set(0, 4.4, -90); root.add(sign);
  [-8, 8].forEach((o) => { box(o, 1.2, -90, 0.3, 2.4, 0.3, WOOD, { cast: false }); });

  /* ── 나무 · 바위 · 상자 흩뿌리기 (구조물 다음에 배치해야 겹치지 않음) ── */
  const TG = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6), CG = new THREE.ConeGeometry(1.9, 4.8, 7), CG2 = new THREE.ConeGeometry(1.4, 3.4, 7);
  const tree = (x, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const t = new THREE.Mesh(TG, M('#6b4a2c', 1)); t.position.y = 1.2;
    const c = new THREE.Mesh(CG, M(rnd() < 0.5 ? '#2f6b3a' : '#3a7a42', 1)); c.position.y = 4.3;
    const c2 = new THREE.Mesh(CG2, c.material); c2.position.y = 6.2;
    [t, c, c2].forEach((m) => { m.castShadow = true; g.add(m); }); root.add(g); addCol(x, z, 0.5 * s, 7 * s);
  };
  for (let i = 0; i < 44; i++) { const p = pick(-50, -55, 26, 3.2); if (p) tree(p.x, p.z, rnd(0.9, 1.4)); }
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, 6.283), d = rnd(96, 112), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z + 100) > 16 && free(x, z, 3)) tree(x, z, rnd(1, 1.5));
  }
  for (let i = 0; i < 10; i++) {
    const p = pick(0, 0, 100, 3); if (!p) continue;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(1.2, 2), 0), new THREE.MeshStandardMaterial({ color: '#8b9099', roughness: 1, flatShading: true }));
    m.position.set(p.x, 0.7, p.z); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); m.castShadow = true; root.add(m); addCol(p.x, p.z, 1.5, 1.8);
  }
  for (let i = 0; i < 16; i++) { const p = pick(0, 0, 100, 3.5); if (p) crate(p.x, p.z, 1.3 + rnd(0, 0.6), rnd(0, 3)); }

  /* ── 아이템 / 드론 자리 ── */
  const L = (cx, cz, rad, n, tier) => { for (let i = 0; i < n; i++) { const p = pick(cx, cz, rad, 1.3); if (p) lootSpots.push({ x: p.x, z: p.z, tier }); } };
  L(0, -92, 9, 4, 1);                                      // 출발 지점: 바로 무기를 쥘 수 있게
  L(0, 0, 14, 5, 3); L(0, 0, 16, 3, 2);                    // 중앙 요새
  L(YX, YZ, 22, 6, 2);                                     // 컨테이너 구역
  L(HX, HZ, 16, 4, 2); L(HX, HZ, 14, 2, 3);                // 격납고
  L(RX, RZ - 4, 14, 3, 1);                                 // 사격장
  L(-50, -55, 24, 5, 1); L(-50, -55, 22, 2, 2);            // 숲
  L(0, 0, 100, 5, 1);                                      // 외곽
  const D = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) { const p = pick(cx, cz, rad, 2.5); if (p) droneSpots.push({ x: p.x, z: p.z, ...(kinds.length ? { kind: kinds[droneSpots.length % kinds.length] } : {}) }); } };
  D(0, 0, 14, 3); D(YX, YZ, 20, 2); D(HX, HZ, 15, 2); D(RX, RZ + 10, 12, 1); D(-50, -55, 22, 2); D(0, 0, 80, 2);

  /* ── 귀환 포털 (0,-108) ── */
  const PCOL = '#c58bff', pg = new THREE.Group(); pg.position.set(0, 0, -108); root.add(pg);
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.4, 32), M('#232a3a', 0.6)); base.position.y = 0.2; pg.add(base); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 12, 48), new THREE.MeshBasicMaterial({ color: PCOL })); ring.position.y = 2.9; pg.add(ring);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: PCOL, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = 2.9; pg.add(glow);
  { const s = label('🌀 캠퍼스로 돌아가기', '#ffffff', 'rgba(70,30,110,.82)', 560, 128, 0.0125); s.position.y = 6.4; pg.add(s); }

  /* ── 구역 간판 · 산 · 외곽 벽 ── */
  const zones = [
    { name: '출발 지점', x: 0, z: -92, r: 14 }, { name: '중앙 요새', x: 0, z: 0, r: 26 }, { name: '컨테이너 구역', x: YX, z: YZ, r: 26 },
    { name: '격납고 폐허', x: HX, z: HZ, r: 24 }, { name: '사격장', x: RX, z: RZ, r: 24 }, { name: '숲', x: -50, z: -55, r: 28 },
  ];
  [['중앙 요새', 0, 19, 0], ['컨테이너 구역', YX, 8.5, YZ], ['격납고 폐허', HX, 10.5, HZ + 12], ['사격장', RX, 5.2, 18.5], ['숲', -50, 9, -38]].forEach(([n, x, y, z]) => {
    const s = label(n, '#ffffff', 'rgba(10,30,60,.74)', 400, 112, 0.04); s.position.set(x, y, z); root.add(s);
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283 + rnd(-0.1, 0.1), d = rnd(185, 215), s = rnd(0.9, 1.6);
    const m = new THREE.Mesh(new THREE.ConeGeometry(34 * s, 46 * s, 6), new THREE.MeshStandardMaterial({ color: '#6f8a77', roughness: 1, flatShading: true }));
    m.position.set(Math.cos(a) * d, 12 * s, Math.sin(a) * d); root.add(m);
  }
  { const w = new THREE.Mesh(new THREE.CylinderGeometry(122, 122, 8, 96, 1, true), new THREE.MeshStandardMaterial({ color: '#808792', roughness: 1, side: THREE.BackSide }));
    w.position.y = 4; w.receiveShadow = true; root.add(w); }

  return {
    id: 'fps', root,
    env: { sky: '#8fc7ff', fog: ['#bcd8ee', 90, 340], sunPos: [80, 120, 50], sunColor: '#fff1d6', sunI: 1.6, hemi: ['#cfe6ff', '#5d6b4a', 0.9] },
    spawn: { x: 0, z: -97, yaw: 0 }, limit: 116, mapR: 124,
    colliders, dummies, lootSpots, droneSpots, zones,
    portals: [{ x: 0, z: -108, r: 4.2, to: 'campus', label: '캠퍼스로 돌아가기' }],
    update(dt, t) {
      beacon.rotation.y += dt * 1.8; ring.rotation.z += dt * 0.8;
      glow.material.opacity = 0.22 + Math.sin(t * 2.4) * 0.08;
    },
  };
}