/* ═══════════════════════════════════════════════════════════════
 * src/race.js (신규, R1+R2) — 레이싱 고도화
 *
 *  1) buildCircuit(scene) : 곡선 서킷 월드 (직선·커브·헤어핀, 약 915m)
 *       - 기존 buildRace 와 같은 형식의 월드를 돌려줍니다. game.js 가 WS.race 를 이걸로 바꿔요.
 *       - 실패하면 null → 기존 원형 서킷을 그대로 씁니다.
 *  2) Kart : 드리프트 · 미니터보(3단계) · 노면(도로/연석/잔디) · 아날로그 조향
 *  3) KartFx : 스키드 마크 · 먼지 · 드리프트 불꽃 · 부스트 불꽃
 *  4) RaceRun : 카운트다운 · 랩 · 체크포인트(지름길 방지) · AI 카트 3대 · 순위
 *
 * 조절 숫자
 *   TW      도로 폭(16)            LIMIT  월드 한계 반경(170)
 *   makeTrack 안의 22  = 코너에서 AI 가 버티는 가로 가속도(클수록 AI 가 코너를 빨리 돎)
 *   Kart.update 안의 DRIFT_LV = 미니터보 단계 시간, TURBO = 부스트 지속 시간
 *   RaceRun 의 SKILL = 쉬움/보통/어려움 AI 속도 배율
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { makeKartMesh } from './core.js';
import { rbox, rcyl, rsph } from './round.js';

const HP = Math.PI / 2, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const lerpAngle = (a, b, k) => a + wrapA(b - a) * k;
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ───────────── 코스 제어점 (x, z) — 시계 반대 방향, 출발은 x=100 에서 +z 쪽 ───────────── */
const CTRL = [
  [100, -75], [100, -10], [100, 45], [86, 90], [52, 114], [8, 121], [-32, 108], [-48, 80],
  [-22, 58], [14, 48], [40, 28], [38, 0], [14, -12], [-25, -14], [-70, -12], [-104, -14],
  [-124, -38], [-104, -60], [-66, -62], [-28, -64], [8, -84], [40, -108], [76, -108], [96, -98],
];
const TW = 16, LIMIT = 170;

function crPoint(p0, p1, p2, p3, u) {            // 구심 Catmull-Rom (alpha 0.5)
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), t = t1 + (t2 - t1) * u;
  const mix = (a, b, ta, tb) => { const w0 = (tb - t) / (tb - ta), w1 = (t - ta) / (tb - ta); return [w0 * a[0] + w1 * b[0], w0 * a[1] + w1 * b[1]]; };
  const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
  const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
  return mix(B1, B2, t1, t2);
}

function makeTrack() {
  const n = CTRL.length, dense = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 60; k++) dense.push(crPoint(CTRL[(i + n - 1) % n], CTRL[i], CTRL[(i + 1) % n], CTRL[(i + 2) % n], k / 60));
  const m = dense.length, cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) { const a = dense[i], b = dense[(i + 1) % m]; cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const L = cum[m], N = Math.round(L / 4), ds = L / N;
  const px = new Float64Array(N), pz = new Float64Array(N);
  for (let k = 0, j = 0; k < N; k++) {
    const s = k * ds; while (j < m - 1 && cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % m], f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    px[k] = a[0] + (b[0] - a[0]) * f; pz[k] = a[1] + (b[1] - a[1]) * f;
  }
  const tx = new Float64Array(N), tz = new Float64Array(N), nx = new Float64Array(N), nz = new Float64Array(N), yaw = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N, x = px[b] - px[a], z = pz[b] - pz[a], l = Math.hypot(x, z) || 1;
    tx[i] = x / l; tz[i] = z / l; nx[i] = tz[i]; nz[i] = -tx[i]; yaw[i] = Math.atan2(tx[i], tz[i]);   // n = 왼쪽
  }
  const kap = new Float64Array(N), rad = new Float64Array(N), vcap = new Float64Array(N), vlim = new Float64Array(N);
  for (let i = 0; i < N; i++) kap[i] = wrapA(yaw[(i + 1) % N] - yaw[(i + N - 1) % N]) / (2 * ds);
  for (let i = 0; i < N; i++) {
    let s = 0; for (let o = -2; o <= 2; o++) s += kap[(i + o + N) % N];
    rad[i] = 1 / Math.max(Math.abs(s / 5), 1e-4);
    vcap[i] = Math.min(36, Math.sqrt(22 * rad[i])); vlim[i] = vcap[i];
  }
  for (let pass = 0; pass < 2; pass++) for (let k = N - 1; k >= -N; k--) {            // 코너 앞에서 미리 감속
    const i = ((k % N) + N) % N, nx_ = (i + 1) % N;
    vlim[i] = Math.min(vlim[i], Math.sqrt(vlim[nx_] * vlim[nx_] + 2 * 20 * ds));
  }
  let sLine = 0, bd = 1e18;
  for (let i = 0; i < N; i++) { const d = (px[i] - 100) ** 2 + pz[i] ** 2; if (d < bd) { bd = d; sLine = i; } }

  const T = { px, pz, tx, tz, nx, nz, yaw, rad, vlim, N, ds, L, sLine, h: -1 };
  /* 가장 가까운 중심선 위치. hint+win 이면 그 주변만 검사(지름길 방지·빠름) */
  T.locate = (x, z, hint = -1, win = 0) => {
    let best = 0, bd2 = 1e18;
    if (win > 0 && hint >= 0) {
      for (let o = -win; o <= win; o++) { const i = (((hint + o) % N) + N) % N, dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz; if (d < bd2) { bd2 = d; best = i; } }
    } else for (let i = 0; i < N; i++) { const dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz; if (d < bd2) { bd2 = d; best = i; } }
    let bi = best, bf = 0, bdist = 1e18;
    for (const a of [(best + N - 1) % N, best]) {
      const b = (a + 1) % N, sx = px[b] - px[a], sz = pz[b] - pz[a];
      const f = clamp(((x - px[a]) * sx + (z - pz[a]) * sz) / (sx * sx + sz * sz || 1), 0, 1);
      const d = Math.hypot(x - (px[a] + sx * f), z - (pz[a] + sz * f));
      if (d < bdist) { bdist = d; bi = a; bf = f; }
    }
    return { i: bi, s: (bi + bf) * ds, d: bdist };
  };
  /* 중심선 s(m) 지점, lat = 왼쪽(+)/오른쪽(-) 가로 이동 */
  T.at = (s, lat = 0) => {
    const u = (((s % L) + L) % L) / ds; let i = Math.floor(u); const f = u - i; i %= N; const j = (i + 1) % N;
    const x = px[i] + (px[j] - px[i]) * f, z = pz[i] + (pz[j] - pz[i]) * f;
    let a = tx[i] + (tx[j] - tx[i]) * f, b = tz[i] + (tz[j] - tz[i]) * f; const l = Math.hypot(a, b) || 1; a /= l; b /= l;
    return { x: x + b * lat, z: z - a * lat, yaw: Math.atan2(a, b), i };
  };
  return T;
}

/* ───────────── 그리기 도우미 ───────────── */
function canvasTex(w, h, fn, rep = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function noiseTex(base, spread, size = 128, dots = 1400) {
  return canvasTex(size, size, (x) => {
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    for (let i = 0; i < dots; i++) { const v = (Math.random() * 2 - 1) * spread; x.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`; x.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  }, true);
}
function label(text, { bg = '#222', fg = '#fff', scale = 10 } = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.moveTo(30, 6); g.arcTo(506, 6, 506, 122, 30); g.arcTo(506, 122, 6, 122, 30); g.arcTo(6, 122, 6, 6, 30); g.arcTo(6, 6, 506, 6, 30); g.closePath(); g.fill();
  g.font = '700 54px "Malgun Gothic","Noto Sans KR",sans-serif'; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(scale, scale / 4, 1); return s;
}

/* ═════════════════ 1) 곡선 서킷 월드 ═════════════════ */
export function buildCircuit(scene) {
  const T = makeTrack(), rnd = mulberry(23);
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const colliders = [], pads = [], coins = [], portals = [], anims = [], updaters = [];
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.02, ...o });
  const po = (m, n) => { m.polygonOffset = true; m.polygonOffsetFactor = -n; m.polygonOffsetUnits = -n; return m; };
  const add = (geo, mat, x, y, z, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; root.add(o); return o; };
  const flat = (geo, mat, y = 0) => { geo.rotateX(-HP); const o = new THREE.Mesh(geo, mat); o.position.y = y; o.receiveShadow = true; root.add(o); return o; };
  const col = (x, z, r, h = 4) => colliders.push({ x, z, r, h });
  const free = (x, z, pad = 2) => !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  const dummy = new THREE.Object3D();
  const inst = (geo, mat, n, fn, cast = false) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); fn(dummy, i, im); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; root.add(im); return im;
  };
  const N = T.N;
  const env = { sky: '#8fcbff', fog: ['#cfe9ff', 120, 420], sunPos: [80, 110, 50], sunColor: '#fff6e0', sunI: 1.7, hemi: ['#ffffff', '#6b8f5a', 1.0] };

  /* 지면 */
  const gt = noiseTex('#5f9f52', 34, 128, 1800); gt.repeat.set(70, 70);
  flat(new THREE.CircleGeometry(190, 72), M('#ffffff', { map: gt, roughness: 1 }), 0);
  flat(new THREE.CircleGeometry(700, 40), M('#5c9650'), -0.08);

  /* 리본(도로·선) */
  const ribbon = (o0, o1, y, mat, vlen = 16) => {
    const pos = new Float32Array((N + 1) * 6), nor = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
    for (let i = 0; i <= N; i++) {
      const j = i % N, k = i * 6;
      pos[k] = T.px[j] + T.nx[j] * o0; pos[k + 1] = y; pos[k + 2] = T.pz[j] + T.nz[j] * o0;
      pos[k + 3] = T.px[j] + T.nx[j] * o1; pos[k + 4] = y; pos[k + 5] = T.pz[j] + T.nz[j] * o1;
      nor[k + 1] = 1; nor[k + 4] = 1;
      uv[i * 4] = 0; uv[i * 4 + 1] = (i * T.ds) / vlen; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = (i * T.ds) / vlen;
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    mat.side = THREE.DoubleSide; const o = new THREE.Mesh(g, mat); o.receiveShadow = true; o.frustumCulled = false; root.add(o); return o;
  };
  const at = noiseTex('#3a3d45', 40, 128, 2200);
  ribbon(-TW / 2, TW / 2, 0.03, po(M('#ffffff', { map: at, roughness: 0.95 }), 1));
  const white = () => po(new THREE.MeshBasicMaterial({ color: '#ffffff' }), 2);
  ribbon(TW / 2 - 0.85, TW / 2 - 0.35, 0.05, white()); ribbon(-(TW / 2 - 0.35), -(TW / 2 - 0.85), 0.05, white());
  inst(new THREE.BoxGeometry(0.4, 0.05, 3), po(new THREE.MeshBasicMaterial({ color: '#f2d34b' }), 2), Math.floor(N / 2), (o, k) => {
    const i = k * 2; o.position.set(T.px[i], 0.07, T.pz[i]); o.rotation.y = T.yaw[i];
  });
  /* 연석 (빨강/흰 교대) */
  inst(new THREE.BoxGeometry(1.4, 0.2, 4.2), M('#ffffff'), N * 2, (o, k, im) => {
    const i = k >> 1, side = k & 1 ? 1 : -1, off = side * (TW / 2 + 0.7);
    o.position.set(T.px[i] + T.nx[i] * off, 0.1, T.pz[i] + T.nz[i] * off); o.rotation.y = T.yaw[i];
    im.setColorAt(k, new THREE.Color(i % 2 ? '#d63a3a' : '#ffffff'));
  });

  /* 출발선 · 게이트 */
  const S0 = T.sLine * T.ds, sp0 = T.at(S0, 0);
  const chk = canvasTex(128, 32, (x) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); } });
  const ck = flat(new THREE.PlaneGeometry(TW, 2), po(new THREE.MeshBasicMaterial({ map: chk }), 3), 0.08);
  ck.position.set(sp0.x, 0.08, sp0.z); ck.rotation.y = sp0.yaw; ck.userData.noDetail = true;
  for (const sd of [-1, 1]) {
    const p = T.at(S0, sd * (TW / 2 + 1.5)), post = add(rbox(0.7, 9, 0.7), M('#dddddd'), p.x, 4.5, p.z); col(p.x, p.z, 0.6, 9);
  }
  const bn = add(rbox(TW + 4, 1.6, 0.6), M('#222831'), sp0.x, 9.2, sp0.z); bn.rotation.y = sp0.yaw;
  const bl = label('🏁 START / FINISH', { bg: '#222', scale: 14 }); bl.position.set(sp0.x, 12, sp0.z); root.add(bl);

  /* 부스트 패드 4개 (직선 구간) */
  const arrow = canvasTex(128, 128, (x) => {
    x.fillStyle = 'rgba(255,196,40,.82)'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#fff7c2'; for (let k = 0; k < 3; k++) { const y = 14 + k * 36; x.beginPath(); x.moveTo(64, y); x.lineTo(104, y + 30); x.lineTo(90, y + 38); x.lineTo(64, y + 16); x.lineTo(38, y + 38); x.lineTo(24, y + 30); x.closePath(); x.fill(); }
  });
  [40, 118, 160, 180].forEach((off) => {
    const p = T.at((T.sLine + off) * T.ds, 0), mat = po(new THREE.MeshBasicMaterial({ map: arrow, transparent: true, opacity: 0.9, depthWrite: false }), 3);
    const m = flat(new THREE.PlaneGeometry(6, 8), mat, 0.09); m.position.set(p.x, 0.09, p.z); m.rotation.y = p.yaw + Math.PI; m.userData.noDetail = true;
    pads.push({ x: p.x, z: p.z, mat });
  });

  /* 구역 제한(나무·광고판이 못 들어가는 곳) */
  const inR = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const blocked = (x, z) => inR(x, z, 104, 142, -30, 52) || inR(x, z, 110, 142, -76, -28) || inR(x, z, 68, 94, -72, -32) || Math.hypot(x - 116, z - 36) < 14;

  /* 피트 · 차고 · 포털 */
  { const f = flat(new THREE.PlaneGeometry(18, 40), M('#8a8f99', { roughness: 0.95 }), 0.025); f.position.set(121, 0.025, -2); }
  add(rbox(8, 6, 14), M('#d9433a'), 130, 3, -8);
  { const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshBasicMaterial({ color: '#1b2230' })); door.position.set(125.98, 2.2, -8); door.rotation.y = -HP; root.add(door);
    const gl = label('🏎️ 레이싱 센터', { bg: '#b8322b', scale: 11 }); gl.position.set(126, 8.2, -8); root.add(gl); }
  [-13, -9, -5, -1].forEach((z) => col(130, z, 4.2, 6));
  const garage = { x: 118, z: -6 };
  { const g = new THREE.Group(); g.position.set(116, 0, 36); root.add(g);
    add(rcyl(3.4, 3.6, 0.3, 24), M('#222a3a'), 116, 0.15, 36);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.3, 10, 36), new THREE.MeshStandardMaterial({ color: '#4db8ff', emissive: '#4db8ff', emissiveIntensity: 1.2 }));
    ring.position.y = 3.2; g.add(ring); g.rotation.y = HP;
    const sw = canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, '#4db8ffff'); gr.addColorStop(0.6, '#4db8ff88'); gr.addColorStop(1, '#4db8ff11'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 5; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(64, 64, 14 + k * 13, k, k + 2.2); c.stroke(); } });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.5, 36), new THREE.MeshBasicMaterial({ map: sw, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.y = 3.2; g.add(disc);
    const pl = label('🏫 캠퍼스로', { bg: '#4db8ff', scale: 9 }); pl.position.set(116, 7.4, 36); root.add(pl);
    anims.push((dt, t) => { disc.rotation.z += dt * 1.6; disc.material.opacity = 0.7 + Math.sin(t * 3) * 0.15; });
    portals.push({ x: 116, z: 36, r: 4, to: 'campus', label: '캠퍼스로 돌아가기' }); }

  /* 관중석 2곳 (관중 포함) */
  const stand = (x, z, yaw, len, rows) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), to = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cos0(yaw, lx, lz)];
    function cos0() { return cy; }
    const spots = [], pal = ['#e0533d', '#2f6fed', '#f2b84b', '#0aa6b7', '#8e5cf2', '#ffffff', '#ff8fb1'];
    for (let r = 0; r < rows; r++) {
      const [bx, bz] = to(0, -r * 1.6), h = (r + 1) * 0.9, step = add(new THREE.BoxGeometry(len, h, 1.6), M(r % 2 ? '#9aa3b0' : '#aab3c0'), bx, h / 2, bz); step.rotation.y = yaw;
      for (let k = -len / 2 + 1; k < len / 2 - 0.5; k += 1.15) if (rnd() > 0.2) { const [wx, wz] = to(k, -r * 1.6); spots.push([wx, h + 0.45, wz, pal[(rnd() * pal.length) | 0]]); }
    }
    inst(new THREE.BoxGeometry(0.5, 0.9, 0.5), M('#ffffff'), spots.length, (o, i, im) => { const s = spots[i]; o.position.set(s[0], s[1], s[2]); o.rotation.y = yaw; im.setColorAt(i, new THREE.Color(s[3])); });
    for (let k = -len / 2 + 2; k <= len / 2 - 1; k += 3.5) { const [wx, wz] = to(k, -2); col(wx, wz, 3.2, 6); }
  };
  stand(124, -52, -HP, 34, 5);
  stand(82, -52, HP, 30, 4);

  /* 광고판 (직선 구간 바깥쪽) */
  { const ADC = ['#e0533d', '#2f6fed', '#f2b84b', '#0aa6b7', '#8e5cf2', '#ffffff'], spots = [];
    for (let i = 0; i < N; i += 6) {
      if (T.rad[i] < 80) continue; const side = (i / 6) & 1 ? 1 : -1, off = side * (TW / 2 + 14), x = T.px[i] + T.nx[i] * off, z = T.pz[i] + T.nz[i] * off;
      if (blocked(x, z)) continue; spots.push([x, z, T.yaw[i]]);
    }
    inst(new THREE.BoxGeometry(8, 2.4, 0.4), M('#ffffff'), spots.length, (o, i, im) => { const s = spots[i]; o.position.set(s[0], 1.2, s[1]); o.rotation.y = s[2]; im.setColorAt(i, new THREE.Color(ADC[i % ADC.length])); }, true);
    spots.forEach((s) => col(s[0], s[1], 3, 2.4)); }

  /* 타이어 방벽 (코너 바깥쪽) */
  { const tires = [];
    for (let i = 0; i < N && tires.length < 90; i += 2) if (T.rad[i] < 30) {
      const side = wrapA(T.yaw[(i + 1) % N] - T.yaw[(i + N - 1) % N]) > 0 ? -1 : 1, off = side * (TW / 2 + 3.4);
      tires.push([T.px[i] + T.nx[i] * off, T.pz[i] + T.nz[i] * off]);
    }
    inst(rcyl(0.8, 0.8, 1.3, 10), M('#ffffff'), tires.length, (o, i, im) => { o.position.set(tires[i][0], 0.65, tires[i][1]); im.setColorAt(i, new THREE.Color(i % 2 ? '#d63a3a' : '#f2f2f2')); }, true);
    tires.forEach((t) => col(t[0], t[1], 0.9, 1.3)); }

  /* 코인: 도로 위 28개(좌우 번갈아) + 들판 20개 */
  const coinGeo = rcyl(0.7, 0.7, 0.16, 16); coinGeo.rotateZ(HP);
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#a77a00', emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.35 });
  const addCoin = (x, z) => { const m = new THREE.Mesh(coinGeo, coinMat); m.position.set(x, 1.2, z); m.castShadow = true; root.add(m); coins.push({ x, z, mesh: m, got: false }); };
  for (let k = 0; k < 28; k++) { const p = T.at((k / 28) * T.L, k % 2 ? 4 : -4); addCoin(p.x, p.z); }
  for (let tries = 0, n = 0; tries < 800 && n < 20; tries++) {
    const a = rnd() * TAU, r = 15 + rnd() * (LIMIT - 30), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (T.locate(x, z).d < TW / 2 + 4 || blocked(x, z) || !free(x, z, 2)) continue; addCoin(x, z); n++;
  }
  anims.push((dt) => { coins.forEach((c) => { c.mesh.rotation.y += dt * 3; }); });

  /* 나무 90그루 (건물·관중석을 다 만든 뒤에 심어요) */
  { const spots = [];
    for (let tries = 0; tries < 2000 && spots.length < 90; tries++) {
      const a = rnd() * TAU, r = 20 + rnd() * (LIMIT - 28), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (T.locate(x, z).d < TW / 2 + 9 || blocked(x, z) || !free(x, z, 3)) continue;
      spots.push([x, z, 0.8 + rnd() * 0.7]); col(x, z, 0.9, 6);
    }
    inst(rcyl(0.35, 0.45, 2.4, 7), M('#7a5230'), spots.length, (o, i) => { o.position.set(spots[i][0], 1.2 * spots[i][2], spots[i][1]); o.scale.setScalar(spots[i][2]); }, true);
    inst(new THREE.IcosahedronGeometry(2.2, 0), M('#3f8a3a', { flatShading: true }), spots.length, (o, i) => { o.position.set(spots[i][0], 4.2 * spots[i][2], spots[i][1]); o.scale.setScalar(spots[i][2]); }, true); }

  /* 먼 산 · 구름 */
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + rnd() * 0.3, r = 330 + rnd() * 90, h = 40 + rnd() * 50; add(new THREE.ConeGeometry(60 + rnd() * 50, h, 6), M('#7aa0c4', { flatShading: true }), Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r, false); }
  { const cm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false }), cl = [];
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cm); const a = rnd() * TAU, r = 160 + rnd() * 260; m.position.set(Math.cos(a) * r, 110 + rnd() * 80, Math.sin(a) * r); m.scale.set(30 + rnd() * 20, 8, 18 + rnd() * 10); root.add(m); cl.push(m); }
    anims.push((dt) => { cl.forEach((m) => { m.position.x += dt * 2; if (m.position.x > 450) m.position.x = -450; }); }); }

  /* 월드 객체 (game.js 가 기대하는 모양 그대로) */
  const surface = (x, z) => {
    let l = T.locate(x, z, T.h, 40); if (l.d > 30) l = T.locate(x, z);
    T.h = l.i; return l.d < TW / 2 ? 0 : l.d < TW / 2 + 1.5 ? 1 : 2;
  };
  const W = { TRACK_R: 100, TRACK_W: TW, LIMIT, track: T, surface, onTrack: (x, z) => surface(x, z) < 2 };
  const ks = T.at(S0 - 6, 0);
  return {
    id: 'race', root, env, spawn: { x: 116, z: 8, yaw: -HP }, limit: LIMIT, mapR: 176, colliders, portals, W, pads, coins, ballSpots: [], garage,
    kartSpawn: { x: ks.x, z: ks.z, yaw: ks.yaw }, updaters,
    update(dt, t) {
      anims.forEach((f) => f(dt, t)); updaters.forEach((f) => f(dt, t));
      pads.forEach((p) => { p.mat.opacity = 0.65 + Math.sin(t * 6) * 0.3; });
    },
  };
}

/* ═════════════════ 2) 카트 (드리프트 · 미니터보 · 노면) ═════════════════ */
const DRIFT_LV = [0.7, 1.4, 2.2];          // 파랑/주황/보라 단계에 필요한 드리프트 시간(초)
const TURBO = [0, 0.55, 1.0, 1.5];         // 단계별 부스트 지속 시간(초)

export class Kart {
  constructor(scene) {
    this.group = makeKartMesh('#e0533d'); scene.add(this.group);
    this.x = 110; this.z = -12; this.yaw = -Math.PI / 2; this.ang = this.yaw; this.v = 0;
    this.active = false; this.boost = 0; this.frozen = false; this.roll = 0; this.wheelSpin = 0;
    this.drift = 0; this.driftT = 0; this.mt = 0; this.driftLock = false; this.hopT = 0; this.slip = 0; this.surf = 0; this.camYaw = this.yaw;
    this.onEvent = null;
    this.sync();
  }
  sync() {
    const hop = this.hopT > 0 ? Math.sin(Math.PI * (1 - this.hopT / 0.25)) * 0.4 : 0;
    this.group.position.set(this.x, hop, this.z); this.group.rotation.y = this.yaw; this.group.rotation.z = this.roll;
  }
  stopDrift() { this.drift = 0; this.driftT = 0; this.mt = 0; this.driftLock = false; }
  reset() { this.stopDrift(); this.boost = 0; this.slip = 0; }
  place(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.ang = yaw; this.camYaw = yaw; this.v = 0; this.reset(); this.sync(); }
  endDrift(cancel) {
    if (!cancel && this.mt > 0) { this.boost = Math.max(this.boost, TURBO[this.mt]); if (this.onEvent) this.onEvent('turbo', this.mt); }
    this.drift = 0; this.driftT = 0; this.mt = 0;
  }
  /* inp: { up, down, brake, drift, steer(-1~1, 왼쪽이 +) } 또는 { left, right } */
  update(dt, inp, colliders, W, onBump) {
    const surf = W.surface ? W.surface(this.x, this.z) : (Math.abs(Math.hypot(this.x, this.z) - W.TRACK_R) < W.TRACK_W / 2 + 1.5 ? 0 : 2);
    this.surf = surf;
    let maxF = 38 * (surf === 0 ? 1 : surf === 1 ? 0.96 : 0.5);
    const boosting = this.boost > 0; if (boosting) { this.boost -= dt; maxF = 56; }
    const steer = this.frozen ? 0 : (Number.isFinite(inp.steer) ? inp.steer : (inp.left ? 1 : 0) - (inp.right ? 1 : 0));
    if (!this.frozen) {
      if (inp.up) this.v += (this.v < maxF ? (boosting ? 40 : 26) : 0) * dt;
      else if (inp.down) this.v -= (this.v > 0 ? 42 : 14) * dt;
      else this.v *= Math.exp(-0.9 * dt);
      if (inp.brake) this.v *= Math.exp(-3 * dt);
    } else this.v *= Math.exp(-3 * dt);
    if (surf === 2) this.v *= Math.exp(-0.55 * dt);
    if (this.v > maxF) this.v -= (this.v - maxF) * Math.min(1, 2.5 * dt);
    if (this.v < -12) this.v = -12;
    const spd = Math.abs(this.v);

    /* 드리프트: 버튼을 누른 채 코너 → 시간이 쌓일수록 단계↑ → 버튼을 떼면 미니터보 */
    if (!inp.drift) this.driftLock = false;
    if (this.drift === 0) {
      if (!this.frozen && inp.drift && !this.driftLock && spd > 14 && this.v > 0 && Math.abs(steer) > 0.25 && surf < 2) {
        this.drift = steer > 0 ? 1 : -1; this.driftT = 0; this.mt = 0; this.hopT = 0.25; if (this.onEvent) this.onEvent('drift', 0);
      }
    } else if (!inp.drift || spd < 10 || this.v < 0 || this.frozen || surf === 2) {
      this.endDrift(false); this.driftLock = !!inp.drift;
    } else {
      this.driftT += dt;
      const lv = this.driftT > DRIFT_LV[2] ? 3 : this.driftT > DRIFT_LV[1] ? 2 : this.driftT > DRIFT_LV[0] ? 1 : 0;
      if (lv !== this.mt) { this.mt = lv; if (this.onEvent) this.onEvent('charge', lv); }
      this.v *= Math.exp(-0.12 * dt);
    }
    if (this.hopT > 0) this.hopT -= dt;

    /* 회전 / 진행 방향(ang)은 차 방향(yaw)을 느리게 따라가요 → 드리프트 때 미끄러짐 */
    let rate = (2.1 - Math.min(1, spd / 40) * 0.8) * Math.min(1, spd / 6), sEff = steer;
    if (this.drift) { sEff = clamp(this.drift * 0.85 + steer * 0.65, -1.5, 1.5); rate *= 1.05; }
    this.yaw += sEff * rate * dt * (this.v >= 0 ? 1 : -1);
    const grip = this.drift ? 2.2 : surf === 2 ? 6 : 14;
    this.ang = lerpAngle(this.ang, this.yaw, Math.min(1, grip * dt));
    this.slip = wrapA(this.yaw - this.ang);
    this.x += Math.sin(this.ang) * this.v * dt; this.z += Math.cos(this.ang) * this.v * dt;

    for (const c of colliders) {
      const dx = this.x - c.x, dz = this.z - c.z, min = c.r + 1.5;
      if (dx * dx + dz * dz < min * min) {
        const d = Math.hypot(dx, dz) || 0.0001; this.x = c.x + (dx / d) * min; this.z = c.z + (dz / d) * min;
        if (Math.abs(this.v) > 6 && onBump) onBump();
        this.v *= -0.3; this.ang = this.yaw; if (this.drift) this.endDrift(true);
      }
    }
    const r2 = Math.hypot(this.x, this.z);
    if (r2 > W.LIMIT - 2) { this.x *= (W.LIMIT - 2) / r2; this.z *= (W.LIMIT - 2) / r2; this.v *= 0.5; }

    this.roll += ((-steer * Math.min(1, spd / 40) * 0.12 - this.drift * 0.09) - this.roll) * Math.min(1, 8 * dt);
    this.wheelSpin += (this.v * dt) / 0.38;
    this.group.userData.wheels.forEach((w, i) => { w.rotation.x = this.wheelSpin; if (i < 2) w.rotation.y = steer * 0.4; });
    this.camYaw = lerpAngle(this.yaw, this.ang, 0.6);
    this.sync();
    return surf < 2;
  }
}

/* ═════════════════ 3) 효과: 스키드 마크 · 먼지 · 불꽃 ═════════════════ */
export class KartFx {
  constructor(kart, world) {
    this.k = kart; if (!world || !world.updaters) return;
    const root = world.root, M = 300;
    this.M = M; this.si = 0; this.last = [null, null]; this.d = new THREE.Object3D();
    const g = new THREE.PlaneGeometry(0.34, 1.1); g.rotateX(-HP);
    this.skid = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#0b0c0f', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), M);
    this.skid.frustumCulled = false; this.skid.userData.noDetail = true;
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < M; i++) this.skid.setMatrixAt(i, z);
    root.add(this.skid);
    const P = 140; this.P = P; this.pi = 0;
    this.pos = new Float32Array(P * 3).fill(0); this.col = new Float32Array(P * 3); this.vel = new Float32Array(P * 3);
    this.life = new Float32Array(P); this.max = new Float32Array(P).fill(1); this.base = new Float32Array(P * 3); this.grav = new Float32Array(P);
    for (let i = 0; i < P; i++) this.pos[i * 3 + 1] = -999;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 1, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.1, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pts.frustumCulled = false; this.pts.userData.noDetail = true; root.add(this.pts);
    world.updaters.push((dt) => this.update(dt));
  }
  emit(x, y, z, vx, vy, vz, c, life, grav) {
    const i = this.pi, o = i * 3; this.pi = (i + 1) % this.P;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.base[o] = c[0]; this.base[o + 1] = c[1]; this.base[o + 2] = c[2]; this.life[i] = this.max[i] = life; this.grav[i] = grav;
  }
  update(dt) {
    if (!this.skid) return; const k = this.k, r = Math.random;
    if (k.active) {
      const sy = Math.sin(k.yaw), cy = Math.cos(k.yaw), wh = (lx, lz) => [k.x + lx * cy + lz * sy, k.z - lx * sy + lz * cy];
      const ws = [wh(-0.88, -0.95), wh(0.88, -0.95)], spd = Math.abs(k.v);
      const skidding = k.surf < 2 && spd > 9 && (k.drift !== 0 || Math.abs(k.slip) > 0.28);
      ws.forEach((w, i) => {
        if (skidding) {
          const L = this.last[i];
          if (!L || Math.hypot(w[0] - L[0], w[1] - L[1]) > 0.7) {
            this.d.position.set(w[0], 0.07, w[1]); this.d.rotation.set(0, k.ang, 0); this.d.updateMatrix(); this.skid.setMatrixAt(this.si, this.d.matrix);
            this.si = (this.si + 1) % this.M; this.skid.instanceMatrix.needsUpdate = true; this.last[i] = w;
          }
        } else this.last[i] = null;
        if (spd > 8 && k.surf === 2 && r() < 0.5) this.emit(w[0], 0.3, w[1], (r() - 0.5) * 2, 1.5 + r(), (r() - 0.5) * 2, [0.45, 0.4, 0.25], 0.6, 2);
        if (k.drift && r() < 0.6) this.emit(w[0], 0.3, w[1], (r() - 0.5) * 1.5, 1 + r(), (r() - 0.5) * 1.5, [0.5, 0.5, 0.52], 0.5, 0);
        if (k.drift && k.mt > 0) {
          const c = [[0.3, 0.7, 1], [1, 0.6, 0.2], [0.8, 0.35, 1]][k.mt - 1];
          this.emit(w[0], 0.25, w[1], (r() - 0.5) * 5, 2 + r() * 3, (r() - 0.5) * 5, c, 0.28, 12);
        }
      });
      if (k.boost > 0) { const b = wh(0, -1.7); this.emit(b[0], 0.7, b[1], -Math.sin(k.yaw) * 6 + (r() - 0.5), 0.5, -Math.cos(k.yaw) * 6 + (r() - 0.5), [1, 0.55, 0.15], 0.3, 0); }
    }
    const P = this.P;
    for (let i = 0; i < P; i++) {
      if (this.life[i] <= 0) continue; this.life[i] -= dt; const o = i * 3;
      if (this.life[i] <= 0) { this.pos[o + 1] = -999; this.col[o] = this.col[o + 1] = this.col[o + 2] = 0; continue; }
      this.vel[o + 1] -= this.grav[i] * dt; this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const f = this.life[i] / this.max[i]; this.col[o] = this.base[o] * f; this.col[o + 1] = this.base[o + 1] * f; this.col[o + 2] = this.base[o + 2] * f;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}

/* ═════════════════ 4) 레이스 진행 (랩 · 체크포인트 · AI) ═════════════════ */
const SKILL = [0.84, 0.92, 1.0];
const AICOL = ['#4c8dd9', '#47b5a2', '#c06bd8'];

export class RaceRun {
  constructor({ world, kart, laps = 3, level = 1, sfx, toast }) {
    const T = world.W.track; if (!T) throw new Error('track 없음');
    this.w = world; this.T = T; this.kart = kart; this.laps = laps; this.sfx = sfx; this.toast = toast;
    this.L = T.L; this.S0 = T.sLine * T.ds;
    this.state = 'cd'; this.cd = 3; this.t = 0; this.goT = 0; this.lap = 0; this.lapT = []; this.lapStart = 0; this.rank = 4;
    this.wrong = 0; this.offT = 0; this.off = false; this.bumpCd = 0;
    world.coins.forEach((c) => { c.got = false; c.mesh.visible = true; });
    const g = T.at(this.S0 - 6, 0); kart.place(g.x, g.z, g.yaw); kart.frozen = true;
    const loc = T.locate(kart.x, kart.z); this.idx = loc.i; this.sLast = loc.s;
    this.prog = this.wrapHalf(loc.s - this.S0);
    const sk = SKILL[level] ?? 0.92, per = [0.99, 1.0, 0.96], gaps = [[9, -4.2], [9, 4.2], [14, 0]];
    this.ai = gaps.map(([gap, lat], i) => {
      const m = makeKartMesh(AICOL[i]); world.root.add(m); const p = T.at(this.S0 - gap, lat); m.position.set(p.x, 0, p.z); m.rotation.y = p.yaw;
      return { m, gap, lat0: lat, off: lat, skill: sk * per[i], prog: -gap, v: 0, ph: Math.random() * 6, fin: null, x: p.x, z: p.z, col: AICOL[i] };
    });
  }
  wrapHalf(d) { const L = this.L; while (d > L / 2) d -= L; while (d < -L / 2) d += L; return d; }
  liveRank() { return 1 + this.ai.filter((a) => a.prog > this.prog).length; }
  update(dt) {
    const out = { cd: '', info: '', done: false };
    if (this.state === 'done') return out;
    const k = this.kart, T = this.T, L = this.L;
    if (this.state === 'cd') {
      const before = Math.ceil(this.cd); this.cd -= dt; const n = Math.ceil(this.cd);
      if (n !== before && n > 0) this.sfx.beep();
      out.cd = n > 0 ? String(n) : 'GO!'; out.info = '🏁 출발 준비!';
      if (this.cd <= 0) { this.state = 'run'; k.frozen = false; this.sfx.go(); this.goT = 0.7; }
      return out;
    }
    this.t += dt; if (this.goT > 0) { this.goT -= dt; out.cd = 'GO!'; }
    this.bumpCd = Math.max(0, this.bumpCd - dt);

    /* 내 위치: 마지막 위치 주변 ±30칸 안에서만 찾아요 → 코스를 가로질러 지름길로 갈 수 없어요 */
    const loc = T.locate(k.x, k.z, this.idx, 30);
    this.off = loc.d > 26;
    if (!this.off) {
      this.offT = 0;
      const d = this.wrapHalf(loc.s - this.sLast);
      if (Math.abs(d) < 40) { this.prog += d; this.sLast = loc.s; this.idx = loc.i; }
      this.wrong = d < -0.02 && k.v > 3 ? this.wrong + dt : Math.max(0, this.wrong - dt * 2);
    } else {
      this.offT += dt;
      if (this.offT > 5) {                                  // 오래 코스 밖이면 마지막 위치로 되돌려요
        const p = T.at(this.sLast, 0); k.place(p.x, p.z, p.yaw); this.offT = 0; this.toast('코스로 되돌려 놨어요');
      }
    }
    const lapDone = Math.floor(this.prog / L);
    if (lapDone > this.lap && lapDone >= 1) {
      this.lap = lapDone; this.lapT.push(this.t - this.lapStart); this.lapStart = this.t; this.sfx.ok();
      this.toast(`랩 ${this.lap} 완료 ⏱ ${this.lapT[this.lapT.length - 1].toFixed(1)}초`);
      if (this.lap >= this.laps) {
        this.state = 'done'; k.frozen = true; this.rank = 1 + this.ai.filter((a) => a.fin != null).length; out.done = true; return out;
      }
    }

    /* AI: 중심선을 따라 달리되, 코너 앞에서는 속도를 줄여요 */
    this.ai.forEach((a) => {
      const u = ((((this.S0 + a.prog) % L) + L) % L) / T.ds, i = Math.floor(u) % T.N;
      let target = T.vlim[i] * a.skill; const gap = a.prog - this.prog;
      if (gap > 80) target *= 0.93; else if (gap < -80) target *= 1.06;       // 너무 앞서면 살짝 느리게, 뒤처지면 살짝 빠르게
      a.v += clamp(target - a.v, -26 * dt, 15 * dt); a.prog += a.v * dt;
      a.off += ((a.lat0 + Math.sin(this.t * 0.5 + a.ph) * 1.6) - a.off) * Math.min(1, 1.5 * dt);
      const p = T.at(this.S0 + a.prog, a.off); a.x = p.x; a.z = p.z; a.m.position.set(p.x, 0, p.z); a.m.rotation.y = p.yaw;
      a.m.userData.wheels.forEach((w) => { w.rotation.x += (a.v * dt) / 0.38; });
      if (a.fin == null && a.prog >= this.laps * L) a.fin = this.t;
      const dx = k.x - a.x, dz = k.z - a.z, dd = Math.hypot(dx, dz);
      if (dd < 2.7 && dd > 0.01) {                                              // 부딪히면 살짝 밀려나요
        k.x += (dx / dd) * (2.7 - dd) * 0.7; k.z += (dz / dd) * (2.7 - dd) * 0.7; k.v *= 0.985; a.v *= 0.99;
        if (this.bumpCd <= 0) { this.sfx.bump(); this.bumpCd = 0.4; }
      }
    });

    out.info = `🏁 랩 ${Math.min(this.laps, Math.max(0, this.lap) + 1)}/${this.laps} · ⏱ ${this.t.toFixed(1)}초 · 순위 ${this.liveRank()}/4`
      + (this.wrong > 1.2 ? ' · ↩ 역주행!' : '') + (this.off ? ' · ⚠ 코스로 돌아가요' : '');
    return out;
  }
  result() { return { T: this.t, rank: this.rank, lapT: this.lapT.slice() }; }
  dispose() { this.ai.forEach((a) => a.m.parent && a.m.parent.remove(a.m)); this.kart.frozen = false; }
}
