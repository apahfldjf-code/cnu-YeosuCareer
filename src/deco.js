/* ═══════════════════════════════════════════════════════════════
 * src/deco.js (신규)
 *  - decorateAll(booths) : 모든 부스 지붕 위에 학과에 맞는 3D 모션 장식을 하나씩 올려요.
 *  - 단과대학 간판(512×64 가로 간판)은 자동으로 숨겨서 학과명이 가려지지 않게 해요.
 *  - 장식은 스스로 애니메이션해요 (world.js 의 update 를 고칠 필요 없음).
 *  - 위치·크기 조절: 아래 DECO 값만 바꾸면 돼요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* x: 부스 중심에서 옆으로(+오른쪽), y: 지붕 높이, z: 앞뒤, size: 장식 최대 높이 */
export const DECO = { x: 0, y: 8.7, z: 0.0, size: 1.4, hideSign: false };

/* ───────── 도우미 ───────── */
const M = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.15, ...(o || {}) });
const G = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i === undefined ? 0.7 : i, roughness: 0.4 });
const mesh = (p, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); p.add(m); return m; };
const box = (p, w, h, d, mat, x, y, z) => mesh(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (p, rt, rb, h, mat, x, y, z, seg) => mesh(p, new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat, x, y, z);
const sph = (p, r, mat, x, y, z, sx, sy, sz) => { const m = mesh(p, new THREE.SphereGeometry(r, 16, 12), mat, x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
const pivot = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); p.add(g); return g; };
const textTex = (txt, bg, fg) => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const x = cv.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
  x.fillStyle = fg; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 68);
  const t = new THREE.CanvasTexture(cv); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t;
};
const mkGear = (p, R, n, mat, x, y) => {
  const pv = pivot(p, x, y, 0);
  cyl(pv, R, R, 0.2, mat, 0, 0, 0, 24).rotation.x = Math.PI / 2;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const tt = box(pv, R * 0.38, R * 0.38, 0.2, mat, Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08, 0); tt.rotation.z = a; }
  cyl(pv, R * 0.3, R * 0.3, 0.24, M('#2f3b4d'), 0, 0, 0, 12).rotation.x = Math.PI / 2;
  return pv;
};
const crossShape = (p, mat, s, x, y, z) => { box(p, s, s * 0.32, 0.1, mat, x, y, z); box(p, s * 0.32, s, 0.1, mat, x, y, z); };

/* ───────── 장식 모형 (각 함수는 매 프레임 호출될 tick(t) 를 돌려줘요) ───────── */
const K = {
  gear(g) {
    const a = mkGear(g, 0.5, 10, M('#9aa7b8', { metalness: 0.6 }), -0.25, 0.1);
    const b = mkGear(g, 0.32, 7, M('#ff9f43', { metalness: 0.4 }), 0.52, -0.25);
    return (t) => { a.rotation.z = t * 0.9; b.rotation.z = -t * 0.9 * (10 / 7); };
  },
  robot(g) {
    const m = M('#e8edf5'), o = M('#ff7a2f');
    cyl(g, 0.45, 0.5, 0.18, m, 0, -0.6, 0);
    const j1 = pivot(g, 0, -0.5, 0); cyl(j1, 0.15, 0.15, 0.5, o, 0, 0.25, 0);
    const j2 = pivot(j1, 0, 0.5, 0); box(j2, 0.14, 0.8, 0.14, m, 0, 0.4, 0);
    const j3 = pivot(j2, 0, 0.8, 0); box(j3, 0.12, 0.5, 0.12, o, 0, 0.25, 0);
    const gr = pivot(j3, 0, 0.5, 0); box(gr, 0.4, 0.06, 0.1, m, 0, 0, 0);
    const f1 = box(gr, 0.06, 0.22, 0.1, o, -0.17, 0.12, 0), f2 = box(gr, 0.06, 0.22, 0.1, o, 0.17, 0.12, 0);
    return (t) => {
      j1.rotation.y = Math.sin(t * 0.8) * 1.0; j2.rotation.z = Math.sin(t * 1.2) * 0.5 - 0.2; j3.rotation.z = Math.sin(t * 1.6 + 1) * 0.7;
      const k = 0.17 - 0.08 * (Math.sin(t * 3) * 0.5 + 0.5); f1.position.x = -k; f2.position.x = k;
    };
  },
  flask(g) {
    const gl = M('#cfeaff', { transparent: true, opacity: 0.35, roughness: 0.1 });
    cyl(g, 0.14, 0.55, 0.9, gl, 0, 0, 0, 20); cyl(g, 0.14, 0.14, 0.4, gl, 0, 0.65, 0, 16);
    cyl(g, 0.38, 0.5, 0.3, M('#27c28b', { transparent: true, opacity: 0.85 }), 0, -0.3, 0, 20);
    const bs = []; for (let i = 0; i < 4; i++) bs.push(sph(g, 0.06, M('#d8fff0', { transparent: true, opacity: 0.8 }), 0, -0.2, 0));
    return (t) => bs.forEach((b, i) => { const u = (t * 0.4 + i * 0.25) % 1; b.position.set(Math.sin(i * 2.3 + t) * 0.18, -0.2 + u * 0.95, Math.cos(i * 1.7) * 0.1); b.scale.setScalar(1 - u * 0.5); });
  },
  bolt(g) {
    const s = new THREE.Shape(); s.moveTo(0.12, 0.8); s.lineTo(-0.35, -0.05); s.lineTo(-0.03, -0.05); s.lineTo(-0.15, -0.8); s.lineTo(0.37, 0.15); s.lineTo(0.05, 0.15); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }); geo.translate(0, 0, -0.09);
    const mat = G('#ffd23f', 0.6), r = pivot(g, 0, 0, 0); mesh(r, geo, mat, 0, 0, 0);
    return (t) => { r.rotation.y = t * 1.0; mat.emissiveIntensity = 0.5 + 0.5 * Math.abs(Math.sin(t * 4)); };
  },
  monitor(g) {
    const r = pivot(g, 0, 0, 0); box(r, 1.3, 0.9, 0.1, M('#1f2530'), 0, 0.1, 0); box(r, 1.18, 0.76, 0.02, G('#1d6fd6', 0.45), 0, 0.1, 0.06);
    box(r, 0.1, 0.25, 0.1, M('#1f2530'), 0, -0.45, 0); box(r, 0.5, 0.05, 0.3, M('#1f2530'), 0, -0.6, 0);
    const ls = []; for (let i = 0; i < 4; i++) ls.push(box(r, 0.8, 0.07, 0.02, G('#9dffb0', 0.8), -0.1, 0.35 - i * 0.18, 0.08));
    return (t) => { r.rotation.y = Math.sin(t * 0.8) * 0.6; ls.forEach((l, i) => { const w = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7)); l.scale.x = w; l.position.x = -0.55 + (0.8 * w) / 2; }); };
  },
  building(g) {
    const r = pivot(g, 0, 0, 0), fl = [], cs = ['#7f93b3', '#6d83a6', '#5b7399', '#4a6389'];
    for (let i = 0; i < 4; i++) { const w = 1 - i * 0.14; const f = box(r, w, 0.28, w * 0.8, M(cs[i]), 0, -0.5 + i * 0.3, 0); box(f, w * 1.01, 0.07, w * 0.81, G('#ffe9a0', 0.6), 0, 0, 0); fl.push(f); }
    box(r, 0.04, 0.4, 0.04, M('#c33'), 0, 0.85, 0);
    return (t) => { r.rotation.y = t * 0.6; fl.forEach((f, i) => { f.scale.y = 0.9 + 0.12 * Math.sin(t * 2 + i); }); };
  },
  crane(g) {
    const y = M('#ffc21a'); cyl(g, 0.45, 0.5, 0.12, M('#555'), 0, -0.75, 0); box(g, 0.14, 1.6, 0.14, y, 0, 0.05, 0);
    const jib = pivot(g, 0, 0.85, 0); box(jib, 1.5, 0.1, 0.1, y, 0.35, 0, 0); box(jib, 0.3, 0.2, 0.2, M('#666'), -0.55, -0.05, 0);
    const tr = pivot(jib, 0.6, 0, 0); const ln = cyl(tr, 0.012, 0.012, 1, M('#222'), 0, -0.5, 0, 6); const hk = box(tr, 0.2, 0.15, 0.15, M('#c33'), 0, -0.9, 0);
    return (t) => { jib.rotation.y = t * 0.5; tr.position.x = 0.7 + 0.35 * Math.sin(t * 1.2); const L = 0.7 + 0.3 * Math.sin(t * 1.8); ln.scale.y = L; ln.position.y = -L / 2; hk.position.y = -L - 0.05; };
  },
  turbine(g) {
    cyl(g, 0.05, 0.1, 1.5, M('#f1f4f7'), 0, -0.1, 0); const hub = pivot(g, 0, 0.7, 0.08); sph(hub, 0.09, M('#ddd'), 0, 0, 0);
    for (let i = 0; i < 3; i++) { const b = pivot(hub, 0, 0, 0); b.rotation.z = (i * Math.PI * 2) / 3; box(b, 0.1, 0.8, 0.03, M('#fff'), 0, 0.45, 0); }
    return (t) => { hub.rotation.z = -t * 2.2; };
  },
  chip(g) {
    const r = pivot(g, 0, 0, 0); box(r, 1, 0.12, 1, M('#1f3a2e'), 0, 0, 0); const core = box(r, 0.5, 0.14, 0.5, G('#ffd23f', 0.5), 0, 0.01, 0);
    for (let i = 0; i < 6; i++) { const u = -0.4 + i * 0.16; box(r, 0.1, 0.05, 0.14, M('#c9cdd3'), u, 0, 0.55); box(r, 0.1, 0.05, 0.14, M('#c9cdd3'), u, 0, -0.55); box(r, 0.14, 0.05, 0.1, M('#c9cdd3'), 0.55, 0, u); box(r, 0.14, 0.05, 0.1, M('#c9cdd3'), -0.55, 0, u); }
    r.rotation.x = -0.6;
    return (t) => { r.rotation.y = t * 0.8; core.material.emissiveIntensity = 0.3 + 0.5 * Math.abs(Math.sin(t * 3)); };
  },
  snow(g) {
    const r = pivot(g, 0, 0, 0), m = G('#bfeaff', 0.5);
    for (let i = 0; i < 3; i++) { const a = pivot(r, 0, 0, 0); a.rotation.z = (i * Math.PI) / 3; box(a, 1.3, 0.1, 0.06, m, 0, 0, 0); [-1, 1].forEach((s) => { const b = box(a, 0.3, 0.06, 0.05, m, s * 0.42, 0.1, 0); b.rotation.z = 0.7 * s; const c = box(a, 0.3, 0.06, 0.05, m, s * 0.42, -0.1, 0); c.rotation.z = -0.7 * s; }); }
    return (t) => { r.rotation.z = t * 0.6; };
  },
  dna(g) {
    const r = pivot(g, 0, 0, 0), a = M('#ff5d8f'), b = M('#3fb6ff');
    for (let i = 0; i < 16; i++) {
      const ang = i * 0.5, y = -0.8 + i * 0.105, cx = Math.cos(ang) * 0.3, cz = Math.sin(ang) * 0.3;
      sph(r, 0.07, a, cx, y, cz); sph(r, 0.07, b, -cx, y, -cz);
      const p = pivot(r, 0, y, 0); p.rotation.y = -ang; cyl(p, 0.022, 0.022, 0.6, M('#e8e8f0'), 0, 0, 0, 6).rotation.z = Math.PI / 2;
    }
    return (t) => { r.rotation.y = t * 1.2; };
  },
  cross(g) {
    const r = pivot(g, 0, 0, 0); box(r, 1.0, 1.0, 0.08, M('#ffffff'), 0, 0, 0); crossShape(r, G('#e63946', 0.5), 0.8, 0, 0, 0.06);
    return (t) => { const k = 1 + 0.14 * Math.max(0, Math.sin(t * 5)); r.scale.set(k, k, 1); r.rotation.y = Math.sin(t * 0.8) * 0.5; };
  },
  fish(g, med) {
    const r = pivot(g, 0, 0, 0), o = M('#ff8a3d');
    sph(r, 0.6, o, 0, 0, 0, 1, 0.55, 0.35);
    [-1, 1].forEach((s) => { sph(r, 0.09, M('#fff'), 0.38, 0.1, 0.2 * s); sph(r, 0.05, M('#111'), 0.44, 0.1, 0.23 * s); });
    const tl = pivot(r, -0.55, 0, 0); const tc = mesh(tl, new THREE.ConeGeometry(0.28, 0.45, 3), o, -0.2, 0, 0); tc.rotation.z = -Math.PI / 2; tc.scale.z = 0.3;
    mesh(r, new THREE.ConeGeometry(0.15, 0.3, 3), M('#ff6a1a'), 0, 0.33, 0).scale.z = 0.3;
    if (med) crossShape(r, G('#e63946', 0.5), 0.45, 0, 0.85, 0);
    return (t) => { r.rotation.y = Math.sin(t * 0.9) * 0.6; r.position.y = Math.sin(t * 2) * 0.06; tl.rotation.y = Math.sin(t * 6) * 0.5; };
  },
  fishmed(g) { return K.fish(g, true); },
  trawler(g) {
    const r = pivot(g, 0, 0, 0);
    box(r, 1.5, 0.3, 0.55, M('#2d6fa8'), 0, -0.3, 0); box(r, 0.5, 0.35, 0.4, M('#f4f6f8'), 0.35, -0.02, 0); box(r, 0.52, 0.08, 0.42, M('#2a3a4a'), 0.35, 0.02, 0);
    const bm = pivot(r, -0.45, -0.1, 0); cyl(bm, 0.03, 0.03, 0.9, M('#888'), 0, 0.45, 0, 6);
    const net = mesh(bm, new THREE.ConeGeometry(0.28, 0.7, 8, 1, true), M('#2fd18b', { transparent: true, opacity: 0.6, side: THREE.DoubleSide }), -0.2, 0.15, 0); net.rotation.z = 0.5;
    return (t) => { r.rotation.z = Math.sin(t * 1.5) * 0.08; r.position.y = Math.sin(t * 1.8) * 0.04; bm.rotation.z = Math.sin(t * 0.9) * 0.25; };
  },
  ship(g, coast) {
    const r = pivot(g, 0, 0, 0), s = new THREE.Shape();
    s.moveTo(-1, 0.25); s.lineTo(0.9, 0.25); s.lineTo(1.25, 0.35); s.lineTo(0.8, -0.2); s.lineTo(-0.95, -0.2); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }); hg.translate(0, 0, -0.25);
    mesh(r, hg, M(coast ? '#f4f6f8' : '#f8fafc'), 0, -0.2, 0);
    box(r, 1.7, 0.07, 0.52, M(coast ? '#d6322e' : '#1f5fae'), -0.05, -0.12, 0);
    box(r, 0.6, 0.35, 0.38, M('#f4f6f8'), 0.1, 0.18, 0); box(r, 0.62, 0.1, 0.4, M('#2a3a4a'), 0.1, 0.22, 0);
    cyl(r, 0.03, 0.03, 0.6, M('#999'), 0.1, 0.65, 0, 6);
    let lamp = null;
    if (coast) { lamp = G('#3a8dff', 1.0); sph(r, 0.07, lamp, 0.1, 0.98, 0); box(r, 0.5, 0.02, 0.4, M('#3a4452'), -0.6, 0.06, 0); }
    else { const cr = M('#ff7a2f'); box(r, 0.06, 0.5, 0.06, cr, -0.85, 0.2, 0.15); box(r, 0.06, 0.5, 0.06, cr, -0.85, 0.2, -0.15); box(r, 0.06, 0.06, 0.4, cr, -0.85, 0.45, 0); cyl(r, 0.08, 0.1, 0.35, M('#1f5fae'), -0.2, 0.3, 0, 10); }
    return (t) => { r.rotation.z = Math.sin(t * 1.4) * 0.06; r.rotation.x = Math.sin(t * 1.1) * 0.05; if (lamp) lamp.emissiveIntensity = Math.sin(t * 7) > 0 ? 1.4 : 0.15; };
  },
  coast(g) { return K.ship(g, true); },
  engine(g) {
    const m = M('#6f7c8e', { metalness: 0.6 }), pm = M('#d0d6de', { metalness: 0.7 });
    box(g, 1.3, 0.6, 0.55, m, 0, -0.2, 0); const ps = [];
    for (let i = 0; i < 3; i++) ps.push(cyl(g, 0.14, 0.14, 0.5, pm, -0.4 + i * 0.4, 0.3, 0));
    const fw = pivot(g, 0.85, -0.2, 0); cyl(fw, 0.32, 0.32, 0.12, M('#2a2f38'), 0, 0, 0, 20).rotation.x = Math.PI / 2; box(fw, 0.5, 0.06, 0.14, G('#ff7a2f', 0.3), 0, 0, 0);
    return (t) => { ps.forEach((c, i) => { c.position.y = 0.3 + 0.12 * Math.sin(t * 5 + i * 2.1); }); fw.rotation.z = -t * 2.5; };
  },
  drone(g) {
    const r = pivot(g, 0, 0, 0); box(r, 0.5, 0.14, 0.5, M('#2b3340'), 0, 0, 0); sph(r, 0.07, G('#3fe0ff', 0.9), 0, -0.1, 0.25);
    const rs = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const a = box(r, 0.6, 0.04, 0.04, M('#444'), sx * 0.3, 0.02, sz * 0.3); a.rotation.y = Math.atan2(sz, sx) * -1 + (sx * sz > 0 ? 0 : 0); const p = pivot(r, sx * 0.55, 0.1, sz * 0.55); box(p, 0.5, 0.015, 0.06, M('#9fb4c8'), 0, 0, 0); rs.push(p); });
    return (t) => { rs.forEach((p, i) => { p.rotation.y = t * 25 * (i % 2 ? 1 : -1); }); r.position.y = Math.sin(t * 2) * 0.1; r.rotation.z = Math.sin(t * 1.3) * 0.1; r.rotation.y = t * 0.5; };
  },
  globe(g, v) {
    const r = pivot(g, 0, 0, 0);
    sph(r, 0.55, M('#2e7bd6'), 0, 0, 0);
    mesh(r, new THREE.SphereGeometry(0.57, 12, 8), new THREE.MeshBasicMaterial({ color: '#bfe3ff', wireframe: true, transparent: true, opacity: 0.5 }), 0, 0, 0);
    const tilt = pivot(g, 0, 0, 0); tilt.rotation.x = 0.5;
    mesh(tilt, new THREE.TorusGeometry(0.95, 0.015, 6, 48), M('#ffffff', { transparent: true, opacity: 0.6 }), 0, 0, 0).rotation.x = Math.PI / 2;
    const orb = pivot(tilt, 0, 0, 0);
    if (v === 'ocean') { sph(orb, 0.1, M('#e63946'), 0.95, 0, 0); box(orb, 0.04, 0.2, 0.04, M('#fff'), 0.95, 0.15, 0); }
    else if (v === 'biz') box(orb, 0.3, 0.15, 0.15, M('#ff7a2f'), 0.95, 0, 0);
    else sph(orb, 0.09, G('#ffd23f', 0.6), 0.95, 0, 0);
    return (t) => { r.rotation.y = t * 0.7; orb.rotation.y = -t * 1.1; };
  },
  globeocean(g) { return K.globe(g, 'ocean'); },
  globebiz(g) { return K.globe(g, 'biz'); },
  compass(g) {
    cyl(g, 0.7, 0.7, 0.12, M('#f1f4f7'), 0, 0, 0, 32).rotation.x = Math.PI / 2;
    mesh(g, new THREE.TorusGeometry(0.7, 0.06, 8, 32), M('#c9a24a', { metalness: 0.7 }), 0, 0, 0);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(g, 0.04, i % 3 ? 0.08 : 0.16, 0.02, M('#333'), Math.sin(a) * 0.55, Math.cos(a) * 0.55, 0.07).rotation.z = -a; }
    const nd = pivot(g, 0, 0, 0.1); mesh(nd, new THREE.ConeGeometry(0.1, 0.55, 4), M('#e63946'), 0, 0.27, 0); const w = mesh(nd, new THREE.ConeGeometry(0.1, 0.55, 4), M('#f4f4f4'), 0, -0.27, 0); w.rotation.z = Math.PI;
    return (t) => { nd.rotation.z = Math.sin(t * 0.7) * 2.2 + t * 0.3; };
  },
  bubble(g) {
    const r = pivot(g, 0, 0, 0); box(r, 1.4, 0.9, 0.15, M('#ffffff'), 0, 0.1, 0); const tail = mesh(r, new THREE.ConeGeometry(0.2, 0.35, 3), M('#ffffff'), -0.4, -0.5, 0); tail.rotation.z = Math.PI;
    const tx = textTex('ABC', '#ffffff', '#2f6fed'), pm = new THREE.MeshBasicMaterial({ map: tx });
    mesh(r, new THREE.PlaneGeometry(1.3, 0.65), pm, 0, 0.1, 0.085); const back = mesh(r, new THREE.PlaneGeometry(1.3, 0.65), pm, 0, 0.1, -0.085); back.rotation.y = Math.PI;
    return (t) => { r.rotation.y = Math.sin(t * 0.8) * 0.5; r.position.y = Math.sin(t * 2) * 0.07; };
  },
  torii(g) {
    const r = pivot(g, 0, 0, 0), red = M('#d62828');
    [-1, 1].forEach((s) => cyl(r, 0.07, 0.08, 1.4, red, s * 0.5, 0, 0, 10));
    box(r, 1.5, 0.1, 0.16, M('#1b1b1b'), 0, 0.72, 0); box(r, 1.35, 0.1, 0.12, red, 0, 0.6, 0); box(r, 1.1, 0.07, 0.1, red, 0, 0.3, 0);
    return (t) => { r.rotation.y = Math.sin(t * 0.8) * 0.6; };
  },
  lantern(g) {
    const sw = pivot(g, 0, 0.7, 0), gold = M('#e8b923', { metalness: 0.6 });
    cyl(sw, 0.02, 0.02, 0.2, M('#555'), 0, 0.1, 0, 6);
    sph(sw, 0.5, G('#d62828', 0.45), 0, -0.45, 0, 1, 0.85, 1); cyl(sw, 0.22, 0.22, 0.1, gold, 0, -0.04, 0); cyl(sw, 0.22, 0.22, 0.1, gold, 0, -0.86, 0);
    cyl(sw, 0.015, 0.015, 0.35, M('#d62828'), 0, -1.08, 0, 6); sph(sw, 0.06, gold, 0, -1.28, 0);
    return (t) => { sw.rotation.z = Math.sin(t * 1.5) * 0.15; sw.rotation.y = t * 0.5; };
  },
  container(g) {
    const cs = ['#e63946', '#2f6fed', '#ff9f1c'];
    box(g, 0.95, 0.4, 0.45, M(cs[0]), -0.3, -0.5, 0); box(g, 0.95, 0.4, 0.45, M(cs[1]), 0.3, -0.5, 0); box(g, 0.95, 0.4, 0.45, M(cs[2]), 0, -0.1, 0);
    const top = box(g, 0.7, 0.35, 0.4, M('#2fb58a'), 0, 0.3, 0); const ln = cyl(g, 0.012, 0.012, 1, M('#222'), 0, 0.9, 0, 6);
    return (t) => { const y = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.5)); top.position.y = y; const L = 1.4 - (y + 0.18); ln.scale.y = L; ln.position.y = 1.4 - L / 2; };
  },
  cart(g) {
    const r = pivot(g, 0, 0, 0), bl = M('#2f6fed', { transparent: true, opacity: 0.85 });
    box(r, 0.9, 0.08, 0.55, bl, 0, -0.2, 0); box(r, 0.9, 0.35, 0.04, bl, 0, -0.02, 0.27); box(r, 0.9, 0.35, 0.04, bl, 0, -0.02, -0.27); box(r, 0.04, 0.35, 0.55, bl, 0.45, -0.02, 0); box(r, 0.04, 0.35, 0.55, bl, -0.45, -0.02, 0);
    box(r, 0.04, 0.5, 0.04, M('#555'), -0.5, 0.2, 0); box(r, 0.04, 0.04, 0.55, M('#555'), -0.5, 0.45, 0);
    const ws = [-0.3, 0.3].flatMap((x) => [-0.2, 0.2].map((z) => { const p = pivot(r, x, -0.35, z); cyl(p, 0.1, 0.1, 0.06, M('#222'), 0, 0, 0, 12).rotation.x = Math.PI / 2; return p; }));
    const it = [box(r, 0.2, 0.2, 0.2, M('#ff9f1c'), -0.15, 0.2, 0), box(r, 0.2, 0.28, 0.2, M('#e63946'), 0.15, 0.24, 0)];
    return (t) => { ws.forEach((p) => { p.rotation.z = -t * 3; }); r.rotation.y = Math.sin(t * 0.7) * 0.5; it.forEach((m, i) => { m.position.y = 0.2 + 0.06 * Math.abs(Math.sin(t * 3 + i * 1.5)); }); };
  },
  camera(g) {
    const r = pivot(g, 0, 0, 0), dk = M('#2b2f3a'); box(r, 1, 0.55, 0.4, dk, 0, 0, 0); box(r, 0.3, 0.12, 0.2, dk, -0.25, 0.33, 0);
    cyl(r, 0.22, 0.22, 0.35, M('#555'), 0, 0, 0.3, 20).rotation.x = Math.PI / 2; cyl(r, 0.15, 0.15, 0.05, G('#3a8dff', 0.3), 0, 0, 0.5, 20).rotation.x = Math.PI / 2;
    const fl = G('#ffffff', 0.2); box(r, 0.2, 0.1, 0.05, fl, 0.3, 0.2, 0.2);
    return (t) => { r.rotation.y = Math.sin(t * 0.8) * 0.7; fl.emissiveIntensity = t % 1.5 < 0.12 ? 2.5 : 0.2; };
  },
  clapper(g) {
    const r = pivot(g, 0, 0, 0); box(r, 1.2, 0.7, 0.06, M('#1b1b1b'), 0, -0.1, 0);
    for (let i = 0; i < 4; i++) box(r, 0.2, 0.06, 0.07, M('#fff'), -0.45 + i * 0.3, -0.4, 0.01);
    const hg = pivot(r, -0.6, 0.3, 0.05); for (let i = 0; i < 6; i++) box(hg, 0.2, 0.18, 0.07, M(i % 2 ? '#fff' : '#1b1b1b'), 0.1 + i * 0.2, 0.09, 0);
    return (t) => { hg.rotation.z = Math.max(0, Math.sin(t * 3)) * 0.55; r.rotation.y = Math.sin(t * 0.8) * 0.5; };
  },
  book(g) {
    const r = pivot(g, 0, 0, 0), cv = M('#a0522d'), pg = M('#fffdf5');
    [-1, 1].forEach((s) => { const c = box(r, 0.7, 0.95, 0.06, cv, s * 0.36, 0, -0.05); c.rotation.y = -s * 0.3; const p = box(r, 0.66, 0.88, 0.05, pg, s * 0.35, 0, 0); p.rotation.y = -s * 0.3; });
    const fp = pivot(r, 0, 0, 0.04); box(fp, 0.64, 0.86, 0.02, pg, 0.33, 0, 0);
    return (t) => { fp.rotation.y = -(0.1 + (Math.PI - 0.2) * ((t * 0.5) % 1)); r.position.y = Math.sin(t * 1.6) * 0.05; };
  },
  star(g) {
    const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.3 : 0.72, x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
    s.closePath(); const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }); geo.translate(0, 0, -0.08);
    const r = pivot(g, 0, 0, 0); mesh(r, geo, G('#ffd23f', 0.5), 0, 0, 0);
    const orbs = ['#ff5d8f', '#3fb6ff', '#6be28f'].map((c, i) => { const p = pivot(g, 0, 0, 0); p.rotation.y = (i * Math.PI * 2) / 3; sph(p, 0.11, G(c, 0.7), 1.0, 0, 0); return p; });
    return (t) => { r.rotation.y = t * 1.1; orbs.forEach((p, i) => { p.rotation.y = t * 1.4 + (i * Math.PI * 2) / 3; }); };
  },
  coin(g) {
    const r = pivot(g, 0, 0, 0), gold = M('#f2b92b', { metalness: 0.8, roughness: 0.3 });
    cyl(r, 0.6, 0.6, 0.12, gold, 0, 0, 0, 28).rotation.x = Math.PI / 2; mesh(r, new THREE.TorusGeometry(0.45, 0.03, 6, 28), M('#c98f12', { metalness: 0.8 }), 0, 0, 0.07);
    box(r, 0.1, 0.55, 0.04, M('#c98f12', { metalness: 0.8 }), 0, 0, 0.07);
    return (t) => { r.rotation.y = t * 2; };
  },
};

/* ───────── 학과 → 장식 연결 ───────── */
const ID_KIND = {
  mtr: 'robot', mde: 'gear', pcm: 'flask',
  mar: 'engine', aqu: 'fish', fsh: 'fishmed', smf: 'drone', ocs: 'globeocean', fbi: 'dna', mfm: 'trawler', kcg: 'coast', nav: 'ship', sea: 'compass',
  eng2: 'bubble', jpn: 'torii', chn: 'lantern', gbs: 'globebiz', log: 'container', eco: 'cart', mmd: 'camera', ctm: 'clapper', cre: 'star',
};
const NAME_KIND = [
  [/메카트로닉스|로봇/, 'robot'], [/기계|설계/, 'gear'], [/화학|소재|고분자/, 'flask'], [/전기|전자|전력|제어/, 'bolt'],
  [/컴퓨터|소프트웨어|정보|통신|인공지능|데이터/, 'monitor'], [/건축|디자인|실내/, 'building'], [/토목|건설|도시/, 'crane'],
  [/환경|에너지|신재생|태양/, 'turbine'], [/반도체|디스플레이/, 'chip'], [/냉동|공조|설비/, 'snow'],
  [/의공|의료|보건|간호/, 'cross'], [/바이오|생명|식품/, 'dna'], [/조선|선박|해양/, 'ship'],
  [/물류|무역/, 'container'], [/경영|경제|회계|금융|비즈니스/, 'coin'], [/문화콘텐츠|영상|미디어|멀티미디어/, 'camera'],
  [/영어/, 'bubble'], [/일본/, 'torii'], [/중국/, 'lantern'], [/창의|융합/, 'star'],
];
const COL_KIND = { eng: 'gear', sea: 'fish', cul: 'book', cre: 'star' };
const kindOf = (d) => ID_KIND[d.id] || ((NAME_KIND.find(([re]) => re.test(d.name || '')) || [])[1]) || COL_KIND[d.col] || 'star';

/* ───────── 부스에 올리기 + 자체 애니메이션 ───────── */
const live = []; let raf = 0;
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const loop = (now) => {
  const t = now / 1000;
  for (let i = live.length - 1; i >= 0; i--) {
    const L = live[i]; if (!L.holder.parent) { live.splice(i, 1); continue; }
    if (shown(L.holder)) L.tick(t + L.ph);
  }
  raf = live.length ? requestAnimationFrame(loop) : 0;
};

export function decorateBooth(booth, idx) {
  const g = booth && booth.group, d = booth && booth.dept;
  if (!g || !d || g.userData.__deco) return 0;
  g.userData.__deco = true;
  let hid = 0;
  if (DECO.hideSign) g.traverse((o) => { /* 단과대학 가로 간판 = 512×64 캔버스 */
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const im = o.material.map && o.material.map.image;
    if (im && im.width === 512 && im.height === 64) { o.visible = false; hid++; }
  });
  const kind = kindOf(d), holder = new THREE.Group(), inner = new THREE.Group();
  const tick = (K[kind] || K.star)(inner) || (() => {});
  const bb = new THREE.Box3().setFromObject(inner), sz = bb.getSize(new THREE.Vector3());
  const s = Math.min(DECO.size / Math.max(0.01, sz.y), (DECO.size * 1.15) / Math.max(0.01, Math.max(sz.x, sz.z)));
  inner.scale.setScalar(s); inner.position.y = 0.12 - bb.min.y * s;
  const col = (d.col && ({ eng: '#2f6fed', sea: '#0aa6b7', cul: '#e0803a', cre: '#8e5cf2' })[d.col]) || '#888';
  mesh(holder, new THREE.CylinderGeometry(0.62, 0.7, 0.12, 20), M(col, { roughness: 0.6 }), 0, 0.06, 0);
  holder.add(inner); holder.position.set(DECO.x, DECO.y, DECO.z); g.add(holder);
  live.push({ holder, tick, ph: (idx || 0) * 0.37 });
  return hid;
}

export function decorateAll(booths) {
  let n = 0;
  (booths || []).forEach((b, i) => { decorateBooth(b, i); n++; });
  if (live.length && !raf) raf = requestAnimationFrame(loop);
  console.log(`[deco] 장식 ${n}개 설치`);
}
export function stopDecos() { live.length = 0; if (raf) cancelAnimationFrame(raf); raf = 0; }