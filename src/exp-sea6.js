/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea6.js (신규, 수산해양 F2)
 * fsh : 수산생명의학과 → 어병 진단 클리닉 개선판 (exp-sea3.js 의 fsh 를 덮어써요)
 *  - 어종별 몸 모델: 넙치(납작·두 눈 쏠림·지느러미 테두리) / 우럭(방추형·가시 등지느러미)
 *  - 비늘 무늬·옆줄·아가미뚜껑·가슴/꼬리 지느러미
 *  - 해부 연출: 메스가 배 쪽 피부를 따라 절개 → 피부를 걷어내고 → 아가미뚜껑을 열어요
 *  - 장기 모양 개선 + 모바일용 장기 선택 버튼 + 이상 장기 현미경/PCR 화면
 *  - 넙치는 부레가 없어서 사례 3(VHS)의 정답 장기를 부레 → 신장으로 바로잡았어요
 * exp-sea2.js 공용 도구(h, btn, dock, quizFlow)를 그대로 써요. 증상·수치는 학습용으로 단순화한 사례예요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { tagSprite, snd } from './exp-sea-kit.js';
import { h, btn, dock, quizFlow, LAB_ENV } from './exp-sea2.js';

/* ───────── 공용 도우미 ───────── */
const V2 = (x, y) => new THREE.Vector2(x, y);
const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const stdMat = (col, rough, extra) => new THREE.MeshStandardMaterial({ color: col, roughness: rough === undefined ? 0.5 : rough, ...(extra || {}) });

const mkTex = (w, hh, rx, ry, draw) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  draw(cv.getContext('2d'), w, hh);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
/* 비늘 + 얼룩 무늬 (흰 바탕 → 정점 색과 곱해져요) */
const skinTex = (blot, seed, dens) => mkTex(512, 512, 1 / 8, 1 / 8, (g, W, H) => {
  const r = rng(seed);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < dens; i++) {
    const rr = 6 + r() * 22, x = rr + r() * (W - 2 * rr), y = rr + r() * (H - 2 * rr);
    g.fillStyle = blot; g.globalAlpha = 0.12 + r() * 0.28;
    g.beginPath(); g.ellipse(x, y, rr, rr * (0.5 + r() * 0.6), r() * 3.14, 0, 6.2832); g.fill();
  }
  g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1.2;
  const sz = 16;
  for (let row = -2; row * sz * 0.5 < H + sz; row++) for (let col = -1; col * sz < W + sz; col++) {
    const x = col * sz + (((row % 2) + 2) % 2 ? sz / 2 : 0), y = row * sz * 0.5;
    g.beginPath(); g.arc(x, y, sz * 0.55, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
});
/* 지느러미 줄(기조) 무늬 */
const finTex = (horiz) => mkTex(64, 64, 1, 1, (g, W, H) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2;
  for (let i = 0; i < 8; i++) { g.beginPath(); if (horiz) { g.moveTo(0, i * 8 + 4); g.lineTo(W, i * 8 + 4); } else { g.moveTo(i * 8 + 4, 0); g.lineTo(i * 8 + 4, H); } g.stroke(); }
});
/* 윤곽의 위(+1)/아래(-1) 가장자리 높이 함수 */
const edgeFn = (pts, sgn) => {
  const a = pts.filter((p) => p.y * sgn > 0.02).sort((p, q) => p.x - q.x);
  return (x) => {
    if (!a.length) return 0; if (x <= a[0].x) return a[0].y;
    for (let i = 1; i < a.length; i++) if (x <= a[i].x) { const p = a[i - 1], q = a[i]; return p.y + (q.y - p.y) * (x - p.x) / Math.max(1e-6, q.x - p.x); }
    return a[a.length - 1].y;
  };
};
/* 평면(윗면이 +y) 모양 */
const flatGeo = (pts) => { const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.rotateX(-Math.PI / 2); return g; };
/* 등은 짙게, 배는 밝게 (정점 색) */
const colorize = (geo, back, belly, y0, y1) => {
  const p = geo.attributes.position, n = p.count, arr = new Float32Array(n * 3);
  const cb = new THREE.Color(back), cl = new THREE.Color(belly), t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const k = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1);
    t.copy(cl).lerp(cb, Math.pow(k, 0.8));
    arr[i * 3] = t.r; arr[i * 3 + 1] = t.g; arr[i * 3 + 2] = t.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
};
/* 몸 가장자리를 따라 펼쳐지는 지느러미(톱니 모양) */
const fringe = (edge, sgn, x0, x1, n, hf, zg) => {
  const base = [], outer = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, u = i / n, e = edge(x);
    base.push(V2(x, e - sgn * 0.2));
    outer.push(V2(x, e + sgn * hf(u) * (i % 2 ? 1 : zg(u))));
  }
  return base.concat(outer.reverse());
};
const ellPts = (cx, cy, rx, ry, n) => Array.from({ length: n || 20 }, (_, i) => { const a = (i / (n || 20)) * Math.PI * 2; return V2(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); });

/* ───────── 어종 설계 (x: 머리→꼬리, y: 등(+)→배(-), 단위 임의) ───────── */
const SPEC = {
  rock: {
    ctrl: [[-5.2, 0], [-4.8, 0.55], [-4, 1.15], [-3, 1.6], [-1.6, 1.95], [0, 1.95], [1.8, 1.6], [3.4, 1.0], [4.6, 0.55], [5.1, 0.45], [5.1, -0.45], [4.6, -0.55], [3.4, -0.95], [1.8, -1.55], [0, -1.9], [-1.6, -1.8], [-3, -1.45], [-4, -0.85], [-4.9, -0.45]],
    th: 1.5, bT: 0.3, bS: 0.26, back: '#4d4a3c', belly: '#c6c0a6', blot: '#25231c', dens: 70, fin: '#5a5441',
    notch: [-2.3, 3.1, 0.25], opr: { hx: -3.5, w: 1.15, oy: 0.1, hh: 1.1 },
    eyes: [[-4.05, 0.55, 0.36]], mouth: [-5.05, -3.95, -0.1],
    lat: [[-1.2, 0.85], [0.5, 0.75], [2.3, 0.55], [4.2, 0.2], [5.0, 0.0]],
  },
  flat: {
    ctrl: [[-4.8, 0], [-4.2, 0.9], [-3, 1.8], [-1.4, 2.5], [0.5, 2.7], [2.4, 2.3], [3.8, 1.5], [4.8, 0.7], [5.2, 0.35], [5.2, -0.35], [4.8, -0.7], [3.8, -1.5], [2.4, -2.3], [0.5, -2.7], [-1.4, -2.5], [-3, -1.8], [-4.2, -0.9]],
    th: 0.62, bT: 0.13, bS: 0.12, back: '#86724c', belly: '#a08d65', blot: '#33261a', dens: 120, fin: '#8a744c',
    notch: [-2.9, 0.9, -0.35], opr: { hx: -3.9, w: 1.0, oy: -0.05, hh: 0.95 },
    eyes: [[-4.25, 0.35, 0.24], [-3.95, 0.68, 0.24]], mouth: [-4.6, -4.0, -0.12],
    lat: [[-3.4, 0.1], [-2.2, 0.9], [0, 1.3], [2.2, 0.9], [4.4, 0.15]],
  },
};

const makeFish = (sp) => {
  const S = SPEC[sp], g = new THREE.Group(), TOP = S.th;
  const pts = new THREE.CatmullRomCurve3(S.ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal').getPoints(220).slice(0, -1).map((p) => V2(p.x, p.y));
  const ys = pts.map((p) => p.y), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const tex = skinTex(S.blot, sp === 'rock' ? 11 : 23, S.dens);
  const bodyMat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.42, metalness: 0.1 });
  const vent = edgeFn(pts, -1), dors = edgeFn(pts, 1);

  /* 몸통 (윤곽을 둥글게 부풀린 입체) */
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: S.th - 2 * S.bT, bevelEnabled: true, bevelThickness: S.bT, bevelSize: S.bS, bevelSegments: 5, curveSegments: 1, steps: 1 });
  colorize(geo, S.back, S.belly, yMin, yMax); geo.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(geo, bodyMat); body.position.y = S.bT; g.add(body);

  /* 절개 구역(배 쪽 피부) */
  const [xa, xb, yc] = S.notch;
  const np = [V2(xa, yc), V2(xb, yc)];
  for (let i = 0; i <= 12; i++) { const x = xb - ((xb - xa) * i) / 12; np.push(V2(x, vent(x))); }
  const ctr = np.reduce((a, p) => a.add(p), V2(0, 0)).multiplyScalar(1 / np.length);
  const shrink = (poly, k) => poly.map((p) => V2(ctr.x + (p.x - ctr.x) * k, ctr.y + (p.y - ctr.y) * k));
  const lay = (geo2, mat, y) => { const m = new THREE.Mesh(geo2, mat); m.position.y = y; g.add(m); return m; };
  lay(flatGeo(np), stdMat('#efc5b6', 0.55), TOP + 0.02);                       /* 잘린 근육 테두리 */
  lay(flatGeo(shrink(np, 0.9)), stdMat('#8f3b40', 0.5), TOP + 0.04);            /* 체강 바닥 */
  const fluid = lay(flatGeo(shrink(np, 0.86)), stdMat('#f3dc8c', 0.1, { transparent: true, opacity: 0.5, depthWrite: false }), TOP + 0.07); fluid.visible = false;

  /* 걷어낼 피부 덮개 (등 쪽 경계선을 축으로 접혀요) */
  const fg = new THREE.ShapeGeometry(new THREE.Shape(np)); colorize(fg, S.back, S.belly, yMin, yMax); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, yc);
  const flap = new THREE.Group(); flap.position.set(0, TOP + 0.09, -yc); g.add(flap);
  flap.add(new THREE.Mesh(fg, bodyMat));
  const under = new THREE.Mesh(fg, stdMat('#e8b0a4', 0.6, { side: THREE.BackSide })); under.position.y = -0.006; flap.add(under);

  /* 아가미뚜껑 (앞쪽 경계선을 축으로 열려요) */
  const OP = S.opr, ops = [V2(OP.hx, OP.oy - OP.hh)];
  for (let i = 1; i <= 16; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 16; ops.push(V2(OP.hx + OP.w * Math.cos(a), OP.oy + OP.hh * Math.sin(a))); }
  const og = new THREE.ShapeGeometry(new THREE.Shape(ops)); colorize(og, S.back, S.belly, yMin, yMax); og.rotateX(-Math.PI / 2); og.translate(-OP.hx, 0, 0);
  const oper = new THREE.Group(); oper.position.set(OP.hx, TOP + 0.12, 0); g.add(oper);
  oper.add(new THREE.Mesh(og, bodyMat));
  const ou = new THREE.Mesh(og, stdMat('#d49a96', 0.5, { side: THREE.BackSide })); ou.position.y = -0.006; oper.add(ou);
  oper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ops.slice(1).map((p) => new THREE.Vector3(p.x - OP.hx, 0.012, -p.y))), 32, 0.035, 6), stdMat('#3a372c', 0.6)));
  const chamber = lay(flatGeo(ops), stdMat('#7a2a32', 0.6), TOP + 0.04);

  /* 눈 · 입 · 옆줄 */
  const eyes = S.eyes.map(([x, y, r]) => {
    const e = new THREE.Group(); e.position.set(x, TOP + 0.04, -y);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), stdMat('#d8b552', 0.25)); ball.scale.y = 0.65; e.add(ball);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), stdMat('#0b0b0d', 0.1)); pu.position.y = r * 0.22; pu.scale.y = 0.7; e.add(pu);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); sh.position.set(-r * 0.2, r * 0.55, -r * 0.2); e.add(sh);
    g.add(e); return e;
  });
  const [m0, m1, my] = S.mouth;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(m1 - m0, 0.04, 0.07), stdMat('#201810', 0.7)); mouth.position.set((m0 + m1) / 2, TOP + 0.03, -my); g.add(mouth);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(S.lat.map(([x, y]) => new THREE.Vector3(x, TOP + 0.015, -y))), 40, 0.03, 6), stdMat('#2d2a20', 0.6)));

  /* 지느러미 */
  const fy = S.th * 0.45, finV = finTex(false), finH = finTex(true);
  const addFin = (poly, t2, y) => {
    const m = new THREE.Mesh(flatGeo(poly), new THREE.MeshStandardMaterial({ color: S.fin, map: t2, side: THREE.DoubleSide, transparent: true, opacity: 0.93, roughness: 0.7, depthWrite: false }));
    m.position.y = y; g.add(m); return m;
  };
  if (sp === 'rock') {
    addFin(fringe(dors, 1, -2.6, 3.2, 28, (u) => (u < 0.55 ? 1.0 : 0.62), (u) => (u < 0.55 ? 0.5 : 0.9)), finV, fy);        /* 가시 등지느러미 */
    addFin(fringe(vent, -1, 1.4, 3.5, 12, () => 0.7, () => 0.85), finV, fy);
    addFin([V2(4.9, 0.4), V2(5.7, 1.45), V2(6.3, 1.55), V2(6.7, 1.0), V2(6.55, 0), V2(6.7, -1.0), V2(6.3, -1.55), V2(5.7, -1.45), V2(4.9, -0.4)], finH, fy);
    addFin(ellPts(-1.55, 0.7, 0.85, 0.4), finH, TOP + 0.04);
    const e1 = vent(-1.8), e2 = vent(-0.9);
    addFin([V2(-1.8, e1 + 0.25), V2(-0.9, e2 + 0.25), V2(-1.35, Math.min(e1, e2) - 0.95)], finV, fy);
  } else {
    addFin(fringe(dors, 1, -3.3, 4.7, 36, () => 0.58, () => 0.82), finV, fy);
    addFin(fringe(vent, -1, -2.9, 4.7, 36, () => 0.58, () => 0.82), finV, fy);
    addFin([V2(4.9, 0.4), V2(5.6, 1.0), V2(6.3, 1.0), V2(6.6, 0.4), V2(6.6, -0.4), V2(6.3, -1.0), V2(5.6, -1.0), V2(4.9, -0.4)], finH, fy);
    addFin(ellPts(-2.3, 0.65, 0.55, 0.28), finH, TOP + 0.04);
  }

  /* 겉으로 보이는 증상 (출혈 반점·궤양·점액) */
  const rr = rng(sp === 'rock' ? 7 : 19);
  const scatter = (n, inFlap) => {
    const out = []; let guard = 0;
    while (out.length < n && guard++ < 500) {
      const x = -3 + rr() * 8, y = vent(x) + 0.25 + rr() * Math.max(0.1, dors(x) - vent(x) - 0.5);
      const inNotch = x > xa - 0.05 && x < xb + 0.05 && y < yc + 0.05, inOp = x > OP.hx - 0.05 && x < OP.hx + OP.w + 0.05;
      const ok = inFlap ? (x > xa + 0.25 && x < xb - 0.25 && y < yc - 0.15 && y > vent(x) + 0.2) : (!inNotch && !inOp && x > -3.2 && x < 4.6);
      if (ok) out.push([x, y, 0.06 + rr() * 0.09]);
    }
    return out;
  };
  const sg = (list, col, opts, y, parent, zoff, rs) => {
    const grp = new THREE.Group(); grp.visible = false; const m = stdMat(col, 0.4, opts || {});
    list.forEach(([x, yy, r]) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r * rs, 10), m); d.rotation.x = -Math.PI / 2; d.position.set(x, y, -yy + zoff); grp.add(d); });
    parent.add(grp); return grp;
  };
  const mu = { transparent: true, opacity: 0.42, depthWrite: false };
  const signs = {
    bleedB: sg(scatter(14, false), '#c9202c', null, TOP + 0.03, g, 0, 1), bleedF: sg(scatter(6, true), '#c9202c', null, 0.015, flap, yc, 1),
    bleed2B: sg(scatter(9, false), '#c9202c', null, TOP + 0.03, g, 0, 0.8), bleed2F: sg(scatter(4, true), '#c9202c', null, 0.015, flap, yc, 0.8),
    mucB: sg(scatter(8, false), '#ffffff', mu, TOP + 0.035, g, 0, 4.5), mucF: sg(scatter(4, true), '#ffffff', mu, 0.02, flap, yc, 4.5),
  };
  const ulcer = new THREE.Group(); ulcer.visible = false; ulcer.position.set(1.4, TOP + 0.035, -1.15);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18), stdMat('#ecd2c2', 0.5)); ring.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 18), stdMat('#7e1f29', 0.45)); core.rotation.x = -Math.PI / 2; core.position.y = 0.006;
  ulcer.add(ring, core); g.add(ulcer); signs.ulcer = ulcer;

  /* 절개선 + 메스 */
  const cp = [V2(xb, vent(xb)), V2(xb, yc), V2(xa, yc), V2(xa, vent(xa))], segLen = []; let total = 0;
  for (let i = 1; i < cp.length; i++) { const l = cp[i].distanceTo(cp[i - 1]); segLen.push(l); total += l; }
  const at = (p) => {
    let d = clamp(p, 0, 1) * total;
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i] || i === segLen.length - 1) { const k = clamp(d / segLen[i], 0, 1); return { x: cp[i].x + (cp[i + 1].x - cp[i].x) * k, y: cp[i].y + (cp[i + 1].y - cp[i].y) * k, dx: cp[i + 1].x - cp[i].x, dy: cp[i + 1].y - cp[i].y }; }
      d -= segLen[i];
    }
    return { x: cp[3].x, y: cp[3].y, dx: 0, dy: -1 };
  };
  const INC_N = 40, incMat = stdMat('#4a0f18', 0.6), inc = [];
  for (let j = 0; j < INC_N; j++) {
    const a = at(j / INC_N), b = at((j + 1) / INC_N), len = Math.hypot(b.x - a.x, b.y - a.y) + 0.02;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.09), incMat);
    m.position.set((a.x + b.x) / 2, TOP + 0.13, -(a.y + b.y) / 2); m.rotation.y = Math.atan2(b.y - a.y, b.x - a.x); m.visible = false; g.add(m); inc.push(m);
  }
  const scalpel = new THREE.Group(); scalpel.visible = false;
  const steel = stdMat('#dfe6ee', 0.18, { metalness: 0.85 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.14), steel); blade.position.set(0.21, 0, 0); scalpel.add(blade);
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 10), stdMat('#2b3340', 0.4, { metalness: 0.5 }));
  const ang = 0.75; hd.rotation.z = ang - Math.PI / 2; hd.position.set(0.42 + Math.cos(ang) * 1.2, Math.sin(ang) * 1.2, 0); scalpel.add(hd);
  g.add(scalpel);

  const vm = (xa + xb) / 2;
  return { g, TOP, flap, oper, chamber, fluid, eyes, signs, inc, INC_N, scalpel, at, nx: vm, nz: -(yc + vent(vm)) / 2 };
};

/* ═══════════════ 수산생명의학과 — 어병 진단 클리닉 (F2) ═══════════════ */
const INFO = {
  gill: ['아가미', '물속 산소를 받아들이고 이산화탄소를 내보내요'],
  heart: ['심장', '피를 온몸으로 보내는 펌프예요 (1심방 1심실)'],
  liver: ['간', '영양분 저장·해독·담즙 생산을 맡아요'],
  stomach: ['위', '먹이를 1차로 소화해요'],
  intestine: ['장', '영양분을 흡수해요'],
  spleen: ['비장', '낡은 적혈구를 거르고 면역을 도와요'],
  kidney: ['신장(콩팥)', '노폐물을 거르고 면역세포를 만드는 기관이에요'],
  gonad: ['생식소(난소·정소)', '알과 정자를 만들어요'],
  swim: ['부레', '공기 주머니로 물속에서 뜨는 깊이를 조절해요'],
};
const CASES = [
  { sp: 'flat', pat: '🐟 양식 넙치 · 수조에서 폐사 직전', fact: '🐟 넙치: 두 눈이 몸 한쪽(왼쪽)으로 몰려 있고, 부레가 없어요.',
    sym: ['수면 가까이에서 입을 뻐끔거려요 (산소는 충분한데도!)', '아가미 뚜껑을 쉴 새 없이 여닫아요', '몸을 수조 벽에 자꾸 비벼요'],
    ext: '몸 표면에 끈적한 점액이 많고, 아가미 쪽이 창백해 보여요.', organ: 'gill',
    find: '아가미 판이 창백하고 점액이 많아요. 아가미를 현미경으로 보니 아주 작은 기생충(흡충류)이 붙어 있어요.',
    micro: { kind: 'fluke', cap: '🔬 아가미 조직 (현미경)' },
    diag: { q: '아가미에서 작은 기생충이 발견됐어요. 가장 알맞은 진단은?', a: [['아가미 기생충(흡충류) 감염', true, '기생충이 아가미를 손상시켜 산소 흡수가 어려워지고, 호흡곤란과 몸을 비비는 행동이 나타나요.'], ['바이러스성 출혈성 패혈증', false, '출혈 소견이 없고, 기생충이 직접 확인됐어요.'], ['사료 속 비타민 부족', false, '영양 결핍이 아가미에 기생충을 만들지는 않아요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['담수욕(민물 목욕)으로 기생충을 떨어뜨리고, 수조·그물을 소독해 재감염을 막는다', true, '바닷물고기의 아가미 기생충은 민물에 약해 담수욕이 흔히 쓰여요. (시간·수질은 전문가 지도에 따라요)'], ['항바이러스제를 사료에 섞어 먹인다', false, '원인이 바이러스가 아니라서 효과가 없어요.'], ['병든 물고기를 그대로 시장에 출하한다', false, '질병을 퍼뜨리고 식품 안전에도 문제가 돼요.']] } },
  { sp: 'rock', pat: '🐟 양식 우럭 · 수온이 오른 여름', fact: '🐟 우럭(조피볼락): 부레가 있고, 등지느러미 가시가 날카로워요.',
    sym: ['몸 표면에 붉은 출혈 반점과 궤양이 있어요', '배가 부풀고 움직임이 둔해요', '수온이 25℃를 넘은 뒤 폐사가 늘었어요'],
    ext: '옆구리에 붉은 점(출혈 반점)이 흩어져 있고, 한 곳은 피부가 헐었어요(궤양).', organ: 'liver',
    find: '간이 붓고 표면에 붉은 점 출혈이 있어요. 복강에는 맑은 액체(복수)가 고여 있고, 배양 검사에서 세균(비브리오속)이 자랐어요.',
    micro: { kind: 'bact', cap: '🔬 간 조직 도말 · 염색 (현미경)' },
    diag: { q: '간 비대·복수·세균 배양 양성이에요. 가장 알맞은 진단은?', a: [['세균성 감염(비브리오증)', true, '고수온기에 세균이 늘어 패혈증이 생기면 간·복강에 이런 변화가 나타나요.'], ['아가미 기생충 감염', false, '이번 사례는 아가미가 아니라 간과 복강에 이상이 있어요.'], ['단순 저산소증', false, '저산소증은 출혈 반점·복수·세균 검출로 이어지지 않아요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['진단에 따라 처방받은 수산용 항생제를 정해진 용법·휴약 기간을 지켜 쓰고, 사육 밀도·수질을 개선한다', true, '항생제는 반드시 전문가 처방이 필요하고, 휴약 기간을 지켜야 식품 안전을 지킬 수 있어요.'], ['시중 항생제를 아무거나 많이 섞어 먹인다', false, '내성균이 생기고 약 성분이 몸에 남을 위험이 커요.'], ['수온 변화를 무시하고 사료만 늘린다', false, '아픈 물고기는 먹지 못하고, 남은 사료는 수질만 나빠져요.']] } },
  { sp: 'flat', pat: '🐟 양식 넙치 · 수온이 낮은 초봄', fact: '🐟 넙치는 부레가 없어서, 등뼈 아래쪽 신장(콩팥)이 중요한 검사 부위예요.',
    sym: ['눈이 튀어나오고 아가미가 창백해요', '며칠 만에 수조의 폐사 수가 빠르게 늘어요', '항생제를 먹여도 소용이 없었어요'],
    ext: '눈이 튀어나왔고(안구 돌출), 몸 곳곳에 붉은 점 출혈이 있어요.', organ: 'kidney',
    find: '신장(콩팥)이 부어 거무스름하고 표면에 붉은 점 출혈이 보여요. 세균 배양에서는 아무 균도 자라지 않았고, 유전자 검사(PCR)에서 바이러스 양성이에요.',
    micro: { kind: 'pcr', cap: '🧬 PCR 검사 결과 (바이러스 유전자)' },
    diag: { q: '세균은 안 자라고 바이러스 검사가 양성이에요. 가장 알맞은 진단은?', a: [['바이러스성 출혈성 패혈증(VHS)', true, '세균이 없고 항생제가 듣지 않으며 바이러스 검사가 양성이면 바이러스병이에요.'], ['비브리오증(세균)', false, '세균 배양에서 균이 자라지 않았어요.'], ['아가미 기생충 감염', false, '기생충은 발견되지 않았어요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['치료약이 없으므로 병든 개체를 격리하고 이동을 제한하며, 시설·장비를 소독하고 관할 기관에 신고한다', true, '바이러스병은 확산을 막는 방역이 가장 중요해요. 법정 전염병은 신고 의무가 있어요.'], ['항생제를 2배로 늘려 투여한다', false, '항생제는 바이러스에 효과가 없고 내성만 키워요.'], ['폐사어를 이웃 양식장에 나눠 준다', false, '병원체를 퍼뜨리는 위험한 행동이에요.']] } },
];

/* 장기 위치 [x, z, 크기] — 어종마다 달라요 (넙치는 부레 없음) */
const LAY = {
  rock: { gill: [-2.9, -0.1, 1], heart: [-1.7, 1.15, 1], liver: [-0.6, 0.9, 1], stomach: [0.55, 0.95, 1], intestine: [2.0, 1.0, 1], gonad: [2.25, 0.4, 0.8], swim: [0.55, 0.3, 1], spleen: [0.3, 0.6, 1], kidney: [0.6, -0.05, 1] },
  flat: { gill: [-3.4, 0.05, 0.75], heart: [-2.5, 1.05, 0.75], liver: [-1.55, 1.25, 0.75], stomach: [-0.55, 1.25, 0.75], intestine: [-0.05, 1.9, 0.75], gonad: [0.15, 0.85, 0.7], spleen: [-1.0, 0.7, 0.75], kidney: [-0.7, 0.12, 0.75] },
};

registerExperience('fsh', {
  icon: '🐟', title: '어병 진단 클리닉 · 해부와 처방',
  desc: '수산질병관리사가 되어 아픈 물고기의 겉모습과 증상을 살피고, 메스로 해부해 이상 장기를 찾아 병을 진단한 뒤 알맞은 처방과 방역 조치를 결정해 보세요. 이상 장기는 현미경·검사 화면으로 확인해요. (사례는 학습용으로 단순화했어요)',
  tools: ['🩺 진료 차트', '🔪 메스·해부 트레이', '🔬 현미경·PCR', '🧪 처방·방역'],
  steps: ['진료 차트와 물고기 겉모습(점액·출혈 반점·눈)을 살펴요', '🔪 해부 시작! 메스가 배 쪽 피부를 절개하고 아가미뚜껑이 열려요', '몸 속 장기를 누르거나 아래 버튼으로 골라 이상 소견이 있는 장기를 찾아요 (틀리면 감점)', '현미경·검사 결과를 보고 병명을 진단하고, 알맞은 처방·방역 조치를 골라요 (3마리 환자)'],
  env: LAB_ENV,
  build(c) {
    const { root, ui, cam } = c;
    const SX = -0.75, Y0 = 0.6;
    cam.set([0.3, 12.8, 8.8], [0.3, 0.8, 0.5]); cam.fov(50, true);

    /* ── 실험실 · 해부 트레이 ── */
    c.box(44, 0.4, 28, '#c9d5df', 5, -0.2, 0, root); c.box(44, 13, 0.5, '#e6eef5', 5, 6.5, -10, root);
    c.box(18, 0.5, 10.4, '#b9c6d2', 0, -0.05, 0, root);
    c.box(15.8, 0.24, 8.6, '#c4ccd6', 0, 0.32, 0, root);
    c.box(15.8, 0.3, 0.3, '#aeb8c4', 0, 0.55, -4.3, root); c.box(15.8, 0.3, 0.3, '#aeb8c4', 0, 0.55, 4.3, root);
    c.box(0.3, 0.3, 8.6, '#aeb8c4', -7.9, 0.55, 0, root); c.box(0.3, 0.3, 8.6, '#aeb8c4', 7.9, 0.55, 0, root);
    c.box(14.4, 0.16, 7.6, '#3a5a52', 0, 0.52, 0, root);
    c.box(2.2, 0.4, 1.8, '#2d3a4b', -10.5, 0.2, -4, root); c.cyl(0.25, 0.25, 2.6, '#2d3a4b', -11, 1.5, -4, root, 8);
    const tube = c.cyl(0.3, 0.3, 2.2, '#566377', -10.5, 2.4, -4, root, 10); tube.rotation.z = 0.5;
    const lab = tagSprite('검사실 · 현미경', 'rgba(20,70,110,.9)', 5.2, 1.3); lab.position.set(-10.5, 4.6, -4); root.add(lab);

    /* ── 두 어종 ── */
    const FS = { flat: makeFish('flat'), rock: makeFish('rock') };
    Object.keys(FS).forEach((k) => { FS[k].g.position.set(SX, Y0, 0); FS[k].g.visible = false; root.add(FS[k].g); });

    /* ── 장기 ── */
    const ORG = new THREE.Group(); ORG.position.x = SX; root.add(ORG);
    const M = (col, r, ex) => new THREE.MeshStandardMaterial({ color: col, roughness: r === undefined ? 0.38 : r, ...(ex || {}) });
    const ell = (par, r, col, sx, sy, sz, x, y, z, rough) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), M(col, rough === undefined ? 0.35 : rough)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); par.add(m); return m; };
    const hit = (par, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.scale.set(sx, sy, sz); m.position.set(x, y, z); par.add(m); };
    const O = {};
    const mk = (id) => { const g = new THREE.Group(); g.userData.oid = id; g.visible = false; ORG.add(g); O[id] = { g, on: false, sw: [1, 1, 1] }; return O[id]; };
    const dot = (par, x, y, z, r, col) => { const d = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), M(col, 0.3)); d.position.set(x, y, z); par.add(d); };

    { const o = mk('gill'), g = o.g; o.mat = M('#d6404a', 0.5); const bone = M('#eadccf', 0.4);
      for (let k = 0; k < 4; k++) {
        const ax = k * 0.3 - 0.45; const arch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.0), bone); arch.position.set(ax, 0.1, 0); g.add(arch);
        for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.07), o.mat); f.position.set(ax + 0.17, 0.1, -0.9 + i * 0.165); g.add(f); }
      }
      o.mucus = new THREE.Group(); g.add(o.mucus);
      for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(c.rnd(0.1, 0.2), 8, 6), M('#ffffff', 0.2, { transparent: true, opacity: 0.7 })); s.position.set(c.rnd(-0.5, 0.5), 0.2, c.rnd(-0.9, 0.9)); s.scale.y = 0.5; o.mucus.add(s); }
      o.mucus.visible = false; hit(g, 0.75, 0.35, 1.1, 0, 0.1, 0); }
    { const o = mk('heart'), g = o.g; ell(g, 0.3, '#b3202f', 1.05, 0.8, 1.1, 0, 0.25, 0); ell(g, 0.2, '#8e1a28', 1, 0.8, 1, -0.3, 0.25, -0.05); ell(g, 0.13, '#e8dad2', 1, 0.8, 1, 0.3, 0.25, 0.12); hit(g, 0.55, 0.35, 0.5, 0, 0.2, 0); }
    { const o = mk('liver'), g = o.g; o.parts = [ell(g, 0.7, '#9c3a2a', 1.5, 0.5, 0.95, 0, 0.28, 0), ell(g, 0.45, '#9c3a2a', 1.3, 0.5, 0.8, 0.55, 0.26, 0.35), ell(g, 0.4, '#9c3a2a', 1.2, 0.48, 0.7, -0.5, 0.25, 0.4)];
      o.spots = new THREE.Group(); g.add(o.spots);
      for (let i = 0; i < 10; i++) { const x = c.rnd(-0.8, 0.8), z = c.rnd(-0.45, 0.45), q = Math.max(0, 1 - (x / 1.05) ** 2 - (z / 0.665) ** 2); dot(o.spots, x, 0.28 + 0.35 * Math.sqrt(q) + 0.01, z, 0.06, '#d81e2a'); }
      o.spots.visible = false; hit(g, 1.0, 0.4, 0.65, 0, 0.25, 0.1); }
    { const o = mk('stomach'), g = o.g; ell(g, 0.55, '#e5a89d', 1.35, 0.6, 0.85, 0, 0.26, 0); ell(g, 0.28, '#d9958a', 1, 0.6, 0.9, 0.85, 0.22, 0.15); hit(g, 0.8, 0.35, 0.5, 0.2, 0.22, 0.05); }
    { const o = mk('intestine'), g = o.g;
      [-0.15, 0.25].forEach((zo, q) => { const path = []; for (let i = 0; i <= 10; i++) path.push(new THREE.Vector3(-1.0 + i * 0.2 + q * 0.1, 0.17 + (i % 2) * 0.05, zo + (i % 2 ? 0.2 : -0.2))); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 60, 0.1, 8), M('#e9b7a8', 0.35))); });
      hit(g, 1.1, 0.3, 0.55, 0.05, 0.2, 0.05); }
    { const o = mk('spleen'), g = o.g; ell(g, 0.22, '#5a1a2a', 1.4, 0.55, 0.8, 0, 0.18, 0); hit(g, 0.35, 0.3, 0.3, 0, 0.18, 0); }
    { const o = mk('kidney'), g = o.g; o.parts = [ell(g, 0.5, '#6a2630', 3.0, 0.3, 0.3, 0, 0.14, 0, 0.45)];
      o.spots = new THREE.Group(); g.add(o.spots);
      for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), M('#e0242f', 0.3)); d.rotation.x = -Math.PI / 2; d.position.set(-1.2 + i * 0.3, 0.3, (i % 2 ? 0.05 : -0.05)); o.spots.add(d); }
      o.spots.visible = false; hit(g, 1.5, 0.3, 0.3, 0, 0.15, 0); }
    { const o = mk('gonad'), g = o.g; ell(g, 0.5, '#f0c25a', 1.9, 0.55, 0.7, 0, 0.25, 0); hit(g, 0.9, 0.3, 0.4, 0, 0.25, 0); }
    { const o = mk('swim'), g = o.g; ell(g, 0.7, '#eaf2f7', 2.2, 0.45, 0.5, 0, 0.28, 0, 0.15); hit(g, 1.4, 0.35, 0.4, 0, 0.28, 0); }

    /* ── 현미경 / 검사 화면 (왼쪽 아래 원형 창) ── */
    const micro = (() => {
      const wrap = h('div', 'position:absolute;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(70px + env(safe-area-inset-bottom,0px));width:min(30vw,38vh,190px);display:none;flex-direction:column;align-items:center;gap:4px;pointer-events:none;z-index:5');
      const cv = h('canvas', 'width:100%;aspect-ratio:1;border-radius:50%;border:3px solid #cfe3f5;box-shadow:0 0 0 3px rgba(0,0,0,.45),0 4px 14px rgba(0,0,0,.5);background:#111');
      const cap = h('div', 'font-size:calc(12px*var(--xs,1));font-weight:800;color:#fff;background:rgba(8,20,38,.85);padding:3px 8px;border-radius:8px;text-align:center');
      cv.width = 240; cv.height = 240; wrap.append(cv, cap); c.ui.layer.append(wrap);
      const g = cv.getContext('2d'); let kind = '', age = 0, acc = 0, on = false;
      const draw = (t) => {
        const W = 240, R = 120; g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(R, R, R, 0, 6.2832); g.clip();
        if (kind === 'fluke') {
          const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, '#f6d9d9'); bg.addColorStop(1, '#ecc3c8'); g.fillStyle = bg; g.fillRect(0, 0, W, W);
          g.fillStyle = 'rgba(205,90,110,.55)'; for (let i = 0; i < 9; i++) g.fillRect(i * 28 - 4, 0, 11, W);
          [[70, 70, 0.5], [150, 120, -0.4], [95, 170, 0.9], [180, 60, 0.2], [60, 140, -0.9]].forEach(([x, y, a], i) => {
            g.save(); g.translate(x, y + Math.sin(t * 2 + i) * 3); g.rotate(a + Math.sin(t * 1.5 + i) * 0.12);
            g.fillStyle = '#f3d27a'; g.strokeStyle = '#8a6a1e'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, 6.2832); g.fill(); g.stroke();
            g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(-18, -3, 2, 0, 6.2832); g.fill(); g.beginPath(); g.arc(-18, 3, 2, 0, 6.2832); g.fill();
            g.strokeStyle = '#3a2a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, -4); g.lineTo(31, -7); g.moveTo(24, 4); g.lineTo(31, 7); g.moveTo(26, 0); g.lineTo(33, 0); g.stroke();
            g.restore();
          });
        } else if (kind === 'bact') {
          g.fillStyle = '#f4e8ef'; g.fillRect(0, 0, W, W); const r = rng(5);
          for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * W, rad = 18 + r() * 14; g.fillStyle = 'rgba(190,150,200,.35)'; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(110,70,140,.55)'; g.beginPath(); g.arc(x + 2, y, rad * 0.4, 0, 6.2832); g.fill(); }
          g.strokeStyle = '#c2185b'; g.lineWidth = 4; g.lineCap = 'round';
          for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * W, a = r() * 6.28 + Math.sin(t * 0.8 + i) * 0.04; g.beginPath(); g.arc(x, y, 6 + r() * 3, a, a + 2.1); g.stroke(); }
        } else {
          g.fillStyle = '#0e1a2b'; g.fillRect(0, 0, W, W);
          g.strokeStyle = 'rgba(160,200,240,.18)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(30, 30 + i * 30); g.lineTo(210, 30 + i * 30); g.stroke(); }
          g.strokeStyle = '#8fb3d6'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 30); g.lineTo(30, 200); g.lineTo(212, 200); g.stroke();
          const prog = clamp(age * 0.45, 0, 1);
          const curve = (col, f) => { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 40 * prog; i++) { const x = 30 + i * 4.4, y = 200 - f(i); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); };
          g.setLineDash([5, 4]); g.strokeStyle = '#ffd34d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(30, 150); g.lineTo(210, 150); g.stroke(); g.setLineDash([]);
          curve('#ff5a5f', (x) => 8 + 120 / (1 + Math.exp(-(x - 21) / 2.4)));
          curve('#9aa7b5', (x) => 8 + Math.sin(x * 1.3) * 1.5);
          g.textAlign = 'left'; g.font = '700 13px sans-serif';
          g.fillStyle = '#ff9a9d'; g.fillText('양성 (바이러스 검출)', 56, 74); g.fillStyle = '#c3ccd6'; g.fillText('음성 대조', 100, 188); g.fillStyle = '#ffd34d'; g.fillText('기준선', 150, 144);
          g.fillStyle = '#8fb3d6'; g.font = '700 11px sans-serif'; g.fillText('증폭 횟수 →', 88, 212);
        }
        g.restore();
      };
      return {
        show(k, text) { kind = k; age = 0; acc = 1; on = true; cap.textContent = text; wrap.style.display = 'flex'; },
        hide() { on = false; wrap.style.display = 'none'; },
        tick(dt, t) { if (!on) return; age += dt; acc += dt; if (acc > 0.1) { acc = 0; draw(t); } },
        remove() { wrap.remove(); },
      };
    })();

    /* 표현 다듬기: 검사 소견(find)과 처치·방역 정답 문구를 사례별로 덮어써요 */
    const WORDS = [
      { find: '현미경으로 아가미를 보니 작은 기생충이 붙어 있어요.', treat: '전문가와 함께 기생충에 맞는 치료법을 고르고, 수조를 관리해 다시 감염되지 않게 해요.' },
      { find: '검사에서 병을 일으킨 세균이 확인됐어요.', treat: '전문가가 정한 약을 사용하고, 물고기를 출하하기 전에는 정해진 기다림 기간을 지켜요.' },
      { find: '검사에서 출혈성 질병을 일으키는 바이러스가 확인됐어요.', treat: '병든 물고기를 다른 곳으로 옮기지 않고, 담당 기관에 알린 뒤 시설을 소독해요.' },
    ];
    const fixCase = (k) => {
      const o = CASES[k], w = WORDS[k]; if (!w) return o;
      return { ...o, find: w.find, treat: { ...o.treat, a: o.treat.a.map((x) => (x[1] ? [w.treat, x[1], x[2]] : x)) } };
    };

    /* ── 진행 상태 ── */
    const dk = dock(c, '🩺 어병 진단 클리닉');
    const order = shuffle([0, 1, 2]);
    let ci = 0, phase = 'idle', left = 330, ended = false, oPts = 0, dPts = 0, tPts = 0;
    let cs = null, F = null, view = 'wide', orgCam = null, cutP = 0, peelP = 0, opP = 0, orgOn = false;
    let cutBtn = null, msgEl = null, chipRow = null, chips = {};
    const wrong = new Set(), flashQ = [];
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

    const place = (sp) => {
      Object.keys(O).forEach((id) => {
        const o = O[id], L = LAY[sp][id]; o.on = !!L;
        if (L) { o.g.position.set(L[0], Y0 + FS[sp].TOP + 0.06, L[1]); o.g.scale.set(L[2] * o.sw[0], L[2] * o.sw[1], L[2] * o.sw[2]); }
      });
    };
    const resetFish = () => {
      Object.keys(FS).forEach((k) => { const X = FS[k]; X.flap.rotation.x = 0; X.oper.rotation.z = 0; X.inc.forEach((m) => { m.visible = false; }); X.scalpel.visible = false; });
      Object.keys(O).forEach((id) => { O[id].g.visible = false; });
      orgOn = false;
    };
    const applyCase = (k) => {
      const sp = CASES[k].sp, X = FS[sp];
      Object.keys(FS).forEach((key) => { const Y = FS[key]; Y.g.visible = Y === X; Object.keys(Y.signs).forEach((s) => { Y.signs[s].visible = false; }); Y.fluid.visible = false; Y.eyes.forEach((e) => { e.scale.setScalar(1); e.position.y = Y.TOP + 0.04; }); });
      O.gill.mat.color.set('#d6404a'); O.gill.mucus.visible = false;
      O.liver.parts.forEach((m) => m.material.color.set('#9c3a2a')); O.liver.spots.visible = false; O.liver.sw = [1, 1, 1];
      O.kidney.parts[0].material.color.set('#6a2630'); O.kidney.spots.visible = false; O.kidney.sw = [1, 1, 1];
      if (k === 0) { O.gill.mat.color.set('#eac7c7'); O.gill.mucus.visible = true; X.signs.mucB.visible = true; X.signs.mucF.visible = true; }
      else if (k === 1) { O.liver.sw = [1.22, 1.4, 1.15]; O.liver.parts.forEach((m) => m.material.color.set('#c28a4a')); O.liver.spots.visible = true; X.fluid.visible = true; X.signs.bleedB.visible = true; X.signs.bleedF.visible = true; X.signs.ulcer.visible = true; }
      else { O.gill.mat.color.set('#e2bfc0'); O.kidney.sw = [1, 1.9, 1.9]; O.kidney.parts[0].material.color.set('#7c1622'); O.kidney.spots.visible = true; X.signs.bleed2B.visible = true; X.signs.bleed2F.visible = true; X.eyes.forEach((e) => { e.scale.setScalar(1.55); e.position.y = X.TOP + 0.14; }); }
      place(sp);
    };
    const flash = (g) => { g.traverse((m) => { if (m.material && m.material.emissive) m.material.emissive.setRGB(0.5, 0.45, 0.1); }); flashQ.push({ g, t: 0.5 }); };

    const showCase = () => {
      const k = order[ci]; cs = fixCase(k); micro.hide(); resetFish(); applyCase(k); F = FS[cs.sp];
      phase = 'obs'; view = 'wide'; wrong.clear(); chips = {}; chipRow = null; msgEl = null; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>📋 진료 차트 ${ci + 1}/3</b><br>${cs.pat}`));
      dk.add(h('div', 'flex:none;font-size:.92em;color:#cfe3f5;line-height:1.5', cs.fact));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.65;flex:none', '<b>🩺 임상 증상</b><br>' + cs.sym.map((s) => '• ' + s).join('<br>')));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.65;flex:none', `<b>🔍 겉모습 관찰</b><br>${cs.ext}`));
      cutBtn = btn('🔪 해부 시작 (메스로 절개)', doCut, 'background:#b5453a'); dk.add(cutBtn); ui.hint('겉모습과 증상을 읽고 🔪 해부를 시작해요');
    };
    const doCut = () => { if (phase !== 'obs') return; phase = 'cut'; cutP = 0; F.scalpel.visible = true; cutBtn.remove(); snd(c, 'swing'); view = 'notch'; ui.hint('메스가 배 쪽 피부를 따라 절개해요…'); };
    const openFind = () => {
      phase = 'find'; view = 'notch';
      msgEl = h('div', 'line-height:1.55;color:#ffd9a0;flex:none', '🔎 증상과 관련된 장기를 골라 보세요. 몸 속 장기를 직접 누르거나, 아래 버튼을 눌러도 돼요.');
      chipRow = h('div', 'display:flex;flex-wrap:wrap;gap:6px;flex:none');
      Object.keys(LAY[cs.sp]).forEach((id) => {
        const b = h('button', 'flex:1 1 28%;min-height:44px;border:0;border-radius:10px;background:#2f4a68;color:#fff;font:inherit;font-weight:800;padding:4px 6px;cursor:pointer', INFO[id][0].replace(/\(.*\)/, ''));
        b.onclick = () => choose(id, null); chips[id] = b; chipRow.append(b);
      });
      dk.add(msgEl, chipRow); ui.hint('이상 소견이 있는 장기를 찾아요 (틀리면 감점)');
    };
    const choose = (id, pt) => {
      if (phase !== 'find' || !O[id] || !O[id].on) return;
      const o = O[id], inf = INFO[id]; flash(o.g);
      const wp = new THREE.Vector3(); o.g.getWorldPosition(wp); wp.y += 0.5; const at = pt || wp;
      if (id === cs.organ) { ui.pop(`⚠ ${inf[0]} 이상 발견!`, at, '#a0ffb8'); onFound(id); return; }
      wrong.add(id); snd(c, 'bad'); ui.pop(`${inf[0]} — ${inf[1]}`, at, '#ffe9a0');
      if (msgEl) msgEl.innerHTML = `❌ ${inf[0]}은(는) 이번 증상의 원인 장기가 아니에요. (오답 ${wrong.size}회)`;
      if (chips[id]) { chips[id].style.opacity = '0.45'; chips[id].textContent = '✕ ' + INFO[id][0].replace(/\(.*\)/, ''); }
    };
    const onFound = (id) => {
      phase = 'diag'; oPts += clamp(10 - 3 * wrong.size, 0, 10); snd(c, 'ok');
      if (chipRow) { chipRow.remove(); chipRow = null; } if (msgEl) { msgEl.remove(); msgEl = null; }
      const wp = new THREE.Vector3(); O[id].g.getWorldPosition(wp); view = 'organ'; orgCam = { p: [wp.x + 0.3, wp.y + 5.2, wp.z + 4.2], l: [wp.x, wp.y, wp.z] };
      micro.show(cs.micro.kind, cs.micro.cap);
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(40,160,90,.22);line-height:1.6;flex:none', `<b>🔬 검사 소견</b><br>${cs.find}`));
      dk.add(btn('🧪 진단·처방 결정 ▶', () => {
        quizFlow(dk, [{ ...cs.diag, after: (ok) => { if (ok) dPts += 12; } }, { ...cs.treat, after: (ok) => { if (ok) tPts += 34 / 3; } }], () => { ci++; if (ci < 3) showCase(); else endAll(); });
      }, 'background:#2a6bff;text-align:center'));
      ui.hint('현미경·검사 소견을 보고 진단해요');
    };
    const endAll = () => { if (ended) return; ended = true; micro.hide(); dk.el.style.display = 'none'; c.finish(oPts + dPts + tPts); };

    const camTick = () => {
      if (view === 'organ' && orgCam) cam.to(orgCam.p, orgCam.l);
      else if (view === 'notch' && F) { const nx = SX + F.nx, nz = F.nz, ty = Y0 + F.TOP; cam.to([nx, ty + 7.4, nz + 5.2], [nx, ty - 0.3, nz]); }
      else cam.to([0.3, 12.8, 8.8], [0.3, 0.8, 0.5]);
    };

    return {
      start() { showCase(); },
      down() {
        if (phase !== 'find') return;
        const list = Object.keys(O).filter((id) => O[id].on).map((id) => O[id].g);
        const hp = c.pick(list); if (!hp) return;
        let o = hp.object; while (o && !(o.userData && o.userData.oid)) o = o.parent; if (!o) return;
        choose(o.userData.oid, hp.point);
      },
      idle() { camTick(); },
      update(dt, t) {
        camTick(); micro.tick(dt, t);
        for (let i = flashQ.length - 1; i >= 0; i--) {
          const f = flashQ[i]; f.t -= dt;
          if (f.t <= 0) { f.g.traverse((m) => { if (m.material && m.material.emissive) m.material.emissive.setRGB(0, 0, 0); }); flashQ.splice(i, 1); }
        }
        if (!F) return;
        if (phase === 'cut') {
          cutP = Math.min(1, cutP + dt / 2.6);
          const n = Math.floor(cutP * F.INC_N); F.inc.forEach((m, i) => { m.visible = i < n; });
          const p = F.at(cutP);
          F.scalpel.position.set(p.x, F.TOP + 0.17, -p.y); F.scalpel.rotation.y = Math.atan2(-p.dy, -p.dx);
          if (cutP >= 1) { phase = 'peel'; peelP = 0; F.scalpel.visible = false; snd(c, 'go'); ui.hint('절개한 피부를 걷어내요…'); }
        } else if (phase === 'peel') {
          peelP = Math.min(1, peelP + dt / 1.5); F.flap.rotation.x = -ease(peelP) * 2.95;
          if (peelP > 0.45 && !orgOn) { orgOn = true; Object.keys(O).forEach((id) => { if (O[id].on && id !== 'gill') O[id].g.visible = true; }); }
          if (peelP >= 1) { phase = 'oper'; opP = 0; O.gill.g.visible = true; ui.hint('아가미뚜껑을 열어요…'); }
        } else if (phase === 'oper') {
          opP = Math.min(1, opP + dt / 1.0); F.oper.rotation.z = ease(opP) * 1.95;
          if (opP >= 1) openFind();
        }
        if (!ended && (phase === 'obs' || phase === 'cut' || phase === 'peel' || phase === 'oper' || phase === 'find')) { left -= dt; ui.timer(left); if (left <= 0) endAll(); }
      },
      dispose() { dk.dispose(); micro.remove(); },
    };
  },
});