/* ═══════════════════════════════════════════════════════════════
 * src/npc.js (신규) — 캠퍼스를 돌아다니며 부스를 체험하는 NPC
 *
 *  · 부스 앞(카운터 앞 3자리)에 서서 직원과 마주 보고 체험 → 🎉 → 다음 부스
 *  · 광장에서 수다·사진, 진로 리포트 키오스크 이용
 *  · 친구 무리(앞 NPC를 따라다님), 플레이어가 가까이 오면 손 인사
 *  · 인원은 기기에 따라 자동 결정(폰 저화질 10 / 폰 18 / PC 30). 사용자가 바꾸는 메뉴는 없음. 직접 고정하려면 CFG.FORCE
 *
 *  조절은 아래 CFG 숫자만 바꾸면 돼요.
 *  점검(콘솔): __npc()
 *  ※ 캠퍼스 월드에서만 보이고 움직여요. 플레이어와는 부딪히지 않고 지나가요(서로 피해서 걸어요).
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createCharacter, randomLook } from './core.js';
import { isTouch } from './input.js';

const CFG = {
  LEVELS: [0, 10, 18, 30],          // 끄기 / 적게 / 보통 / 많이 (명수)
  LABELS: ['끄기', '적게', '보통', '많이'],
  NAMES: true,                       // 머리 위 닉네임 (false 로 끄기)
  NAME_Y: 2.7,                       // 이름표 높이(머리·머리모양에 안 가리게). 더 올리려면 숫자↑
  BUBBLE_Y: 3.4,                     // 말풍선 높이(이름표 위)
  SPEED: [1.5, 2.4],                 // 걷는 속도(m/초)
  DRAW: isTouch ? 60 : 95,           // 이 거리보다 멀면 그리지 않음
  LZ: 1.5,                           // 카운터에서 떨어진 거리(부스 앞쪽)
  SLOT_X: [-2, 0, 2],                // 부스 앞 3자리의 좌우 위치
  FORCE: null,                       // null = 기기 자동 / 0=끄기 1=적게 2=보통 3=많이 로 고정
};
const NAME_POOL = ['하늘', '바다', '솔이', '민준', '서연', '도윤', '지우', '하준', '예린', '시우', '유나', '현우', '채원', '지호', '수아',
  '은우', '다온', '태양', '나래', '준서', '소율', '이든', '가람', '보라', '단비', '윤슬', '푸른', '해든', '별이', '파랑', '동백', '여울'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

let root = null, cols = [], kiosk = null, limit = 110, spawnP = { x: 0, z: 0 }, BS = [], level = 0, qual = 'high', shadowOn = false;
const npcs = [];
let nameBag = [];
const takeName = () => { if (!nameBag.length) nameBag = NAME_POOL.slice().sort(() => Math.random() - 0.5); return nameBag.pop(); };
const free = (x, z, pad = 1) => {
  if (Math.hypot(x, z) > limit - 6) return false;
  for (let i = 0; i < cols.length; i++) { const c = cols[i], r = c.r + pad, dx = c.x - x, dz = c.z - z; if (dx * dx + dz * dz < r * r) return false; }
  return true;
};

/* ───────── 말풍선 · 이름표 텍스처 ───────── */
const bubbleCache = {};
function bubbleTexture(ch) {
  if (bubbleCache[ch]) return bubbleCache[ch];
  const cv = document.createElement('canvas'); cv.width = cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.93)'; g.beginPath(); g.arc(48, 44, 38, 0, 7); g.fill();
  g.beginPath(); g.moveTo(36, 76); g.lineTo(48, 92); g.lineTo(60, 76); g.closePath(); g.fill();
  g.font = '48px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 48, 46);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; bubbleCache[ch] = t; return t;
}
function nameTexture(text) {
  const w = 256, h = 64, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(10,30,60,.74)'; g.beginPath(); g.moveTo(14, 4); g.arcTo(w - 4, 4, w - 4, h - 4, 14); g.arcTo(w - 4, h - 4, 4, h - 4, 14); g.arcTo(4, h - 4, 4, 4, 14); g.arcTo(4, 4, w - 4, 4, 14); g.closePath(); g.fill();
  g.font = '700 30px "Malgun Gothic","Noto Sans KR",sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const mkSprite = (map, w, h, y) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w, h, 1); s.position.y = y; s.renderOrder = 5; return s;
};

/* ───────── 목적지 정하기 ───────── */
function setTarget(n, kind, x, z, fx, fz) { n.tk = kind; n.tx = x; n.tz = z; n.fx = fx; n.fz = fz; n.dw = null; }
function release(n) {
  if (n.bi >= 0 && BS[n.bi] && BS[n.bi].slots[n.si] === n) BS[n.bi].slots[n.si] = null;
  n.bi = -1; n.si = -1; n.tk = null;
}
function claim(n, k) {
  const bs = BS[k]; if (!bs) return false;
  const si = bs.slots.indexOf(null); if (si < 0) return false;
  for (let tries = 0; tries < 4; tries++) {
    const lz = CFG.LZ + tries * 0.45, lx = CFG.SLOT_X[si] + (tries ? rnd(-0.5, 0.5) : 0);
    const x = bs.b.x + lx * bs.c + lz * bs.s, z = bs.b.z - lx * bs.s + lz * bs.c;
    if (!free(x, z, 0.7)) continue;
    bs.slots[si] = n; n.bi = k; n.si = si;
    setTarget(n, 'booth', x, z, bs.b.x + lx * 0.3 * bs.c - 1.4 * bs.s, bs.b.z - lx * 0.3 * bs.s - 1.4 * bs.c);
    return true;
  }
  return false;
}
function pickBooth(n) {
  if (!BS.length) return false;
  if (n.seen.size >= Math.max(1, BS.length - 4)) n.seen.clear();
  let best = -1, bw = -1e9;
  for (let k = 0; k < BS.length; k++) {
    const bs = BS[k]; if (n.seen.has(k) || bs.fails >= 6 || bs.slots.indexOf(null) < 0) continue;
    const d = Math.hypot(bs.b.x - n.x, bs.b.z - n.z), w = Math.random() + (d < 50 ? 0.5 : 0) - d / 400;
    if (w > bw) { bw = w; best = k; }
  }
  if (best < 0) return false;
  if (!claim(n, best)) { BS[best].fails++; return false; }
  return true;
}
function pickHang(n) {
  for (let k = 0; k < 14; k++) {
    const a = rnd(0, 6.283), r = rnd(5, 22), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z, 1.4)) continue;
    setTarget(n, 'hang', x, z, x + rnd(-5, 5), z + rnd(-5, 5)); return true;
  }
  return false;
}
function pickKiosk(n) {
  if (!kiosk) return false;
  for (let k = 0; k < 8; k++) {
    const a = rnd(0, 6.283), x = kiosk.x + Math.cos(a) * 2.6, z = kiosk.z + Math.sin(a) * 2.6;
    if (!free(x, z, 0.8)) continue;
    setTarget(n, 'kiosk', x, z, kiosk.x, kiosk.z); return true;
  }
  return false;
}
function startWalk(n) {
  n.state = 'walk'; n.speed = rnd(CFG.SPEED[0], CFG.SPEED[1]); n.stuck = 0; n.sx = n.x; n.sz = n.z; n.st = 1.3;
}
function think(n) {
  release(n);
  const L = n.leader;
  if (L && L.active && n.wait < 3) {
    if (L.tk === 'booth' && L.bi >= 0 && L.bi !== n.lastBi && claim(n, L.bi)) { n.wait = 0; startWalk(n); return; }
    if (L.tk === 'hang' && (L.state === 'walk' || L.state === 'arrive' || L.state === 'act')) {
      for (let k = 0; k < 6; k++) {
        const x = L.tx + rnd(-2, 2), z = L.tz + rnd(-2, 2);
        if (Math.hypot(x - L.tx, z - L.tz) > 1.1 && free(x, z, 1)) { setTarget(n, 'hang', x, z, L.tx, L.tz); n.wait = 0; startWalk(n); return; }
      }
    }
    n.wait += 0.5; n.state = 'idle'; n.t = 0.5; return;
  }
  n.wait = 0;
  const r = Math.random();
  const order = r < 0.72 ? [pickBooth, pickHang] : r < 0.88 ? [pickHang, pickBooth] : r < 0.95 && kiosk ? [pickKiosk, pickBooth] : [pickBooth, pickHang];
  for (const f of order) if (f(n)) { startWalk(n); return; }
  n.state = 'idle'; n.t = 1.5;
}
function giveUp(n) {
  if (n.bi >= 0) { BS[n.bi].fails++; n.seen.add(n.bi); }
  release(n); n.state = 'idle'; n.t = rnd(0.3, 1);
}
function arrive(n) {
  n.state = 'arrive'; n.t = rnd(0.9, 1.5); n.vx = n.vz = 0;
  if (n.tk === 'booth' && n.bi >= 0) BS[n.bi].fails = Math.max(0, BS[n.bi].fails - 2);
}
function beginAct(n) {
  n.state = 'act'; n.bt = 0; n.bk = 0; n.react = 0;
  if (n.tk === 'booth' && n.bi >= 0) {
    const ic = BS[n.bi].b.dept.icon || '🎓'; n.cyc = [ic, '❓', ic, '💡', ic, '😮']; n.t = rnd(8, 15);
  } else if (n.tk === 'kiosk') { n.cyc = ['📊', '📄', '📊']; n.t = rnd(5, 8); }
  else { n.cyc = ['💬', '😄', '📷', '💬', '🎵']; n.t = rnd(5, 11); }
}
function finish(n) {
  if (n.bi >= 0) { n.lastBi = n.bi; n.seen.add(n.bi); }
  release(n); n.state = 'idle'; n.t = rnd(0.2, 0.8);
}
function endAct(n) {
  if (n.tk === 'booth' && Math.random() < 0.6) { n.state = 'cheer'; n.t = 1.2; n.jt = 0; n.cb = pick(['🎉', '👍', '😆', '⭐']); return; }
  finish(n);
}

/* ───────── 걷기 (충돌체 피하기 · 막히면 우회) ───────── */
function walkStep(n, dt, px, pz) {
  const dT = Math.hypot(n.tx - n.x, n.tz - n.z);
  if (dT < 1.0) { arrive(n); return 0; }
  if (n.dw) { n.dw.t -= dt; if (n.dw.t <= 0) n.dw = null; }
  n.st -= dt;
  if (n.st <= 0) {
    n.st = 1.3;
    const mv = Math.hypot(n.x - n.sx, n.z - n.sz); n.sx = n.x; n.sz = n.z;
    if (mv < 0.4) {
      n.stuck++; n.side = -n.side;
      if (n.stuck >= 3) { if (dT < 3.2) { arrive(n); return 0; } giveUp(n); return 0; }
      for (let k = 0; k < 6; k++) {
        const a = rnd(0, 6.283), r = rnd(4, 8), x = n.x + Math.cos(a) * r, z = n.z + Math.sin(a) * r;
        if (free(x, z, 1)) { n.dw = { x, z, t: 1.8 }; break; }
      }
    } else n.stuck = 0;
  }
  const gx = n.dw ? n.dw.x : n.tx, gz = n.dw ? n.dw.z : n.tz;
  let sx = gx - n.x, sz = gz - n.z; const sl = Math.hypot(sx, sz) || 1e-3; sx /= sl; sz /= sl;
  const zk = clamp(dT / 5, 0.12, 1); let ax = 0, az = 0;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]; if ((c.h || 3) < 0.5) continue;
    const ox = c.x - n.x, oz = c.z - n.z, zone = c.r + 0.5 + 1.3 * zk;
    if (ox > zone || ox < -zone || oz > zone || oz < -zone) continue;
    const d = Math.hypot(ox, oz); if (d >= zone || d < 1e-3) continue;
    const w = (zone - d) / zone, ux = -ox / d, uz = -oz / d, ahead = (ox * sx + oz * sz) / d;
    if (ahead < -0.2) { ax += ux * w * 0.5; az += uz * w * 0.5; }
    else { ax += (ux * 1.3 - uz * n.side * 1.7) * w; az += (uz * 1.3 + ux * n.side * 1.7) * w; }
  }
  for (let i = 0; i < npcs.length; i++) {
    const o = npcs[i]; if (o === n || !o.active) continue;
    const ox = n.x - o.x, oz = n.z - o.z, d2 = ox * ox + oz * oz;
    if (d2 < 1.44 && d2 > 1e-4) { const d = Math.sqrt(d2), w = (1.2 - d) / 1.2; ax += (ox / d) * w * 1.3; az += (oz / d) * w * 1.3; }
  }
  const pdx = n.x - px, pdz = n.z - pz, pd2 = pdx * pdx + pdz * pdz;
  if (pd2 < 2.56 && pd2 > 1e-4) { const d = Math.sqrt(pd2), w = (1.6 - d) / 1.6; ax += (pdx / d) * w * 1.6; az += (pdz / d) * w * 1.6; }
  const sp = n.speed * (dT < 2.2 ? clamp(dT / 2.2, 0.4, 1) : 1);
  let vx = sx + ax, vz = sz + az; const vl = Math.hypot(vx, vz) || 1; vx = (vx / vl) * sp; vz = (vz / vl) * sp;
  const k = Math.min(1, 6 * dt); n.vx += (vx - n.vx) * k; n.vz += (vz - n.vz) * k;
  n.x += n.vx * dt; n.z += n.vz * dt;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]; if ((c.h || 3) < 0.5) continue;
    const ox = n.x - c.x, oz = n.z - c.z, m = c.r + 0.45, d2 = ox * ox + oz * oz;
    if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; n.x = c.x + (ox / d) * m; n.z = c.z + (oz / d) * m; }
  }
  const rr = Math.hypot(n.x, n.z); if (rr > limit - 5) { n.x *= (limit - 5) / rr; n.z *= (limit - 5) / rr; }
  return Math.hypot(n.vx, n.vz);
}

/* ───────── 한 프레임 ───────── */
function step(n, dt, t, px, pz, cam) {
  n.t -= dt; n.rc -= dt;
  const pd = Math.hypot(px - n.x, pz - n.z);
  let tYaw = n.yaw, bub = null, wave = false, jump = 0;

  switch (n.state) {
    case 'idle':
      n.vx *= 0.8; n.vz *= 0.8;
      if (n.t <= 0) think(n);
      break;
    case 'walk': {
      const sp = walkStep(n, dt, px, pz);
      if (n.state === 'walk' && sp > 0.15) tYaw = Math.atan2(n.vx, n.vz);
      break;
    }
    case 'arrive':
      n.vx = n.vz = 0; tYaw = Math.atan2(n.fx - n.x, n.fz - n.z);
      if (n.tk === 'booth') { wave = true; bub = '👋'; }
      if (n.t <= 0) beginAct(n);
      break;
    case 'act': {
      n.vx = n.vz = 0;
      tYaw = Math.atan2(n.fx - n.x, n.fz - n.z) + Math.sin(t * 1.3 + n.ph) * (n.tk === 'booth' ? 0.1 : 0.5);
      n.bt -= dt; if (n.bt <= 0) { n.bt = rnd(1.8, 2.8); n.bk++; }
      bub = n.cyc[n.bk % n.cyc.length];
      if (n.react > 0) { n.react -= dt; tYaw = Math.atan2(px - n.x, pz - n.z); bub = '👋'; wave = true; }
      else if (n.rc <= 0 && pd < 4.5 && Math.random() < dt * 0.9) { n.react = 1.8; n.rc = rnd(25, 45); }
      if (n.t <= 0) endAct(n);
      break;
    }
    case 'cheer':
      n.vx = n.vz = 0; n.jt += dt; bub = n.cb;
      jump = Math.abs(Math.sin(n.jt * 8)) * 0.28 * Math.max(0, 1 - n.jt / 1.2);
      if (n.t <= 0) finish(n);
      break;
    default: n.state = 'idle'; n.t = 0.5;
  }

  n.yaw = lerpAngle(n.yaw, tYaw, Math.min(1, (n.state === 'walk' ? 8 : 5) * dt));

  /* 부스 바닥(살짝 높은 단) 위에서는 직원과 같은 높이 */
  let ty = 0;
  if (n.bi >= 0 && BS[n.bi]) {
    const bs = BS[n.bi], dx = n.x - bs.b.x, dz = n.z - bs.b.z, lx = dx * bs.c - dz * bs.s, lz = dx * bs.s + dz * bs.c;
    if (Math.abs(lx) < 4.4 && lz > -3.9 && lz < 3.9) ty = 0.12;
  }
  n.y += (ty - n.y) * Math.min(1, 10 * dt);
  n.g.position.set(n.x, n.y + jump, n.z); n.g.rotation.y = n.yaw;

  const dxc = n.x - cam.x, dzc = n.z - cam.z, dc = Math.hypot(dxc, dzc), vis = dc < CFG.DRAW;
  n.g.visible = vis;
  if (vis) {
    if (wave) { n.ch.wave(t + n.ph); n.waving = true; }
    else {
      if (n.waving) { n.ch.stopWave(); n.waving = false; }
      n.ch.walk(t * 0.8 + n.ph, clamp(Math.hypot(n.vx, n.vz) / 3.4, 0, 1));
    }
    n.ch.tick(dt);
    const d3 = Math.hypot(dc, cam.y - 1.5);
    const nf = CFG.NAMES ? clamp((d3 - 3.2) / 2, 0, 1) * clamp((17 - d3) / 5, 0, 1) : 0;
    n.ns.visible = nf > 0.02; n.ns.material.opacity = nf;
    if (bub !== n.bch) { n.bch = bub; if (bub) { n.bs.material.map = bubbleTexture(bub); n.bs.material.needsUpdate = true; } }
    const bf = bub ? clamp((d3 - 2.2) / 2, 0, 1) * clamp((26 - d3) / 6, 0, 1) : 0;
    n.bs.visible = bf > 0.02; n.bs.material.opacity = bf;
  }
}

/* ───────── 만들기 · 켜고 끄기 ───────── */
function respawn(n) {
  for (let k = 0; k < 20; k++) {
    let x, z;
    if (Math.random() < 0.5 && BS.length) {
      const bs = pick(BS), lx = rnd(-3, 3), lz = rnd(4.6, 7);
      x = bs.b.x + lx * bs.c + lz * bs.s; z = bs.b.z - lx * bs.s + lz * bs.c;
    } else { const a = rnd(0, 6.283), r = rnd(6, 26); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (!free(x, z, 1.2) || Math.hypot(x - spawnP.x, z - spawnP.z) < 7) continue;
    n.x = x; n.z = z; break;
  }
  if (!n.x && !n.z) { n.x = 14; n.z = 10; }
  n.y = 0; n.vx = n.vz = 0; n.yaw = rnd(0, 6.283); n.state = 'idle'; n.t = rnd(0, 2.5); n.wait = 0; n.react = 0; n.dw = null; n.tk = null; n.bi = -1; n.si = -1;
  if (n.waving) { try { n.ch.stopWave(); } catch (e) { /* 무시 */ } n.waving = false; }
  n.g.position.set(n.x, 0, n.z);
}
function activate(n, on) {
  if (n.active === on) return;
  n.active = on; n.g.visible = on;
  if (on) respawn(n); else release(n);
}
function makeNpc(i) {
  let ch;
  try { ch = createCharacter(randomLook()); } catch (e) { console.warn('[npc] 캐릭터 생성 실패', e); return null; }
  const g = ch.group; g.scale.setScalar(rnd(0.93, 1.04));
  if (!shadowOn) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const name = takeName();
  const ns = mkSprite(nameTexture(name), 1.9, 0.48, CFG.NAME_Y); ns.visible = false; ns.material.opacity = 0;
  const bs = mkSprite(bubbleTexture('💬'), 0.8, 0.8, CFG.BUBBLE_Y); bs.visible = false; bs.material.opacity = 0;
  g.add(ns, bs); g.visible = false; root.add(g);
  const n = {
    i, ch, g, name, ns, bs, active: false, x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, state: 'idle', t: 0, tk: null, tx: 0, tz: 0, fx: 0, fz: 0,
    bi: -1, si: -1, lastBi: -1, seen: new Set(), dw: null, side: Math.random() < 0.5 ? 1 : -1, stuck: 0, st: 1.3, sx: 0, sz: 0, speed: 2, wait: 0,
    rc: rnd(0, 15), react: 0, waving: false, bch: null, bt: 0, bk: 0, cyc: ['💬'], cb: '🎉', jt: 0, ph: rnd(0, 6.28), err: 0, leader: null, followers: 0,
  };
  if (npcs.length && Math.random() < 0.4) {
    const p0 = npcs[npcs.length - 1], Lr = p0.leader || p0;
    if (Lr.followers < 2) { n.leader = Lr; Lr.followers++; }
  }
  return n;
}
function setLevel(l) {
  level = clamp(l | 0, 0, CFG.LEVELS.length - 1);
  const want = CFG.LEVELS[level];
  while (npcs.length < want) { const n = makeNpc(npcs.length); if (!n) break; npcs.push(n); }
  npcs.forEach((n, i) => activate(n, i < want));
}

/* ───────── game.js 에서 쓰는 함수 ───────── */
export function initNpcs(world, opts = {}) {
  try {
    root = world.root; cols = world.colliders || []; kiosk = world.kiosk || null; limit = world.limit || 110; spawnP = world.spawn || { x: 0, z: 0 };
    qual = opts.quality || 'high'; shadowOn = qual === 'high' && !isTouch;
    BS = (world.booths || []).map((b) => { const ry = Math.atan2(-b.x, -b.z); return { b, s: Math.sin(ry), c: Math.cos(ry), slots: [null, null, null], fails: 0 }; });
    let l = CFG.FORCE;
    if (typeof l !== 'number' || !(l >= 0 && l < CFG.LEVELS.length)) l = isTouch ? (qual === 'low' ? 1 : 2) : 3;
    setLevel(l);
    console.info(`[npc] 생성 ${npcs.length}명 · 활성 ${npcs.filter((n) => n.active).length}명 · 부스 ${BS.length}개 · 충돌체 ${cols.length}개`);
  } catch (e) { console.warn('[npc] 시작 실패', e); }
}
export function tickNpcs(dt, t, px, pz, cam) {
  if (!npcs.length) return;
  dt = Math.min(dt, 0.05);
  for (const n of npcs) {
    if (!n.active) continue;
    try { step(n, dt, t, px, pz, cam); } catch (e) { if (!tickNpcs.warned) { tickNpcs.warned = true; console.warn('[npc] 프레임 오류(첫 1건)', e); } if (++n.err > 3) { console.warn('[npc] 오류로 제외', n.name, e); activate(n, false); } }
  }
}

/* 점검용: 콘솔에서 __npc() */
window.__npc = () => {
  const st = {}; let vis = 0;
  npcs.forEach((n) => { if (!n.active) return; st[n.state] = (st[n.state] || 0) + 1; if (n.g.visible) vis++; });
  return { level: CFG.LABELS[level], made: npcs.length, active: npcs.filter((n) => n.active).length, visible: vis, states: st, booths: BS.length, banned: BS.filter((b) => b.fails >= 6).length, shadow: shadowOn };
};