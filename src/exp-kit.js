/* ═══════════════════════════════════════════════════════════════
 * src/exp-kit.js (E2-1 → U3 타점 통일판) — 3D 조립 체험 공용 도구
 *  - assembler : 부품을 끌어서 흰 그림자(슬롯)에 끼우는 조립대
 *      · 끄는 동안 부품을 '윤곽(슬롯)과 같은 높이'에서 움직여서, 화면에서 보이는 위치 = 붙는 위치
 *      · 붙는 범위는 모든 부품이 같은 기준: 부품 크기 × 0.6 을 화면 픽셀로 환산(46~110px)
 *      · 윤곽에 가까워지면 초록으로 켜져요 → 그 상태에서 놓으면 붙어요
 *      · 집은 지점을 유지(튀지 않음). 터치에서는 손가락에 가리지 않게 살짝 떠올라요(최대 44px)
 *  - gear / link / pipe / glassBox : 모양 만들기 도우미
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const lim = (v, a, b) => Math.max(a, Math.min(b, v));
export const snd = (c, n) => { try { if (c.sfx && typeof c.sfx[n] === 'function') c.sfx[n](); } catch (e) { /* 소리 실패는 무시 */ } };
export const vib = (c, ms) => { try { if (typeof c.buzz === 'function') c.buzz(ms); } catch (e) { /* 무시 */ } };

/* 톱니바퀴 — 반환한 그룹의 rotation.y 를 돌리면 회전합니다 */
export function gear(c, r, teeth, col, y, parent) {
  const g = new THREE.Group(); g.position.y = y; parent.add(g);
  c.cyl(r, r, 0.5, col, 0, 0, 0, g, 28);
  const tw = Math.min(0.36, ((Math.PI * 2 * r) / teeth) * 0.5);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = c.box(tw, 0.5, 0.22, col, Math.sin(a) * (r + 0.03), 0, Math.cos(a) * (r + 0.03), g);
    t.rotation.y = a;
  }
  c.cyl(0.22, 0.22, 0.7, '#cfd6df', 0, 0, 0, g, 12);
  return g;
}

/* 높이 1짜리 실린더를 두 점 사이에 맞춰 늘립니다 (밧줄·배관용) */
export function link(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a), len = Math.max(0.001, d.length());
  mesh.scale.set(1, len, 1);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
export function pipe(parent, r, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }));
  m.castShadow = true; parent.add(m); return m;
}

/* 반투명 유리 상자 + 테두리 (엔진 블록 단면 등) */
export function glassBox(parent, w, h, d, x, y, z, color = '#9fb6cc', op = 0.22) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op, roughness: 0.2, depthWrite: false }));
  m.position.set(x, y, z); parent.add(m);
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: '#dfeaf5' })));
  return m;
}

/* ───────── 조립대 ─────────
 * cfg.parts[]: { kind, name, hint, make(), slot:[x,y,z], rest:[x,z], r(예전 값 · 이제 쓰지 않아요), opt(선택 부품) }
 *   - 같은 kind 부품은 서로 바꿔 끼울 수 있어요 (기둥 4개처럼)
 *   - make() 는 '바닥에 놓았을 때의 모양'을 만들고, 끼우면 slot 위치로 올라갑니다
 * cfg.onComplete : 필수 부품을 모두 끼웠을 때 한 번 호출
 * cfg.snapK      : (선택) 붙는 범위 배율, 기본 0.6
 */
export function assembler(c, cfg) {
  const { root, ui, camera, ptr } = c, parent = cfg.parent || root, area = cfg.limit || { x: [-9, 9], z: [-4, 5] };
  const SNAP_K = cfg.snapK || 0.6;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const slots = [], items = [];
  const rc = new THREE.Raycaster(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), V = new THREE.Vector3(), N2 = new THREE.Vector2();
  let drag = null, miss = 0, locked = false, fired = false;

  /* 로컬 좌표 → 화면(NDC) / 화면 픽셀 거리 / 1 단위당 픽셀 */
  const proj = (x, y, z) => { parent.updateWorldMatrix(true, false); V.set(x, y, z); parent.localToWorld(V); V.project(camera); return { x: V.x, y: V.y }; };
  const pxd = (a, b) => Math.hypot((a.x - b.x) * innerWidth * 0.5, (a.y - b.y) * innerHeight * 0.5);
  const ppu = (x, y, z) => {
    V.set(x, y, z); parent.localToWorld(V);
    const d = Math.max(1, camera.position.distanceTo(V));
    return innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d);
  };
  const snapPx = (q, s) => lim(SNAP_K * q.size * ppu(s.x, s.y, s.z), 46, 110);

  cfg.parts.forEach((s, i) => {
    const g = s.make(); g.position.set(s.rest[0], 0, s.rest[1]); g.userData.part = i; parent.add(g);
    parent.updateWorldMatrix(true, true);
    const sz = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    const size = Math.max(sz.x, sz.z, sz.y * 0.7, 0.8);
    const gm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
    const gh = s.make(); gh.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
    gh.position.set(s.slot[0], s.slot[1], s.slot[2]); parent.add(gh);
    slots.push({ kind: s.kind, x: s.slot[0], y: s.slot[1], z: s.slot[2], r: s.r || 1.6, gh, mat: gm, near: false, taken: false });
    items.push({ i, s, kind: s.kind, g, slot: -1, size });
  });

  const need = () => cfg.parts.filter((s) => !s.opt).length;
  const have = () => items.filter((q) => !q.s.opt && q.slot >= 0).length;
  const complete = () => have() >= need();
  const find = (o) => { let n = o; while (n && n.userData.part === undefined) n = n.parent; return n ? items[n.userData.part] : null; };

  const paint = (s, on) => {
    if (s.near === on) return; s.near = on;
    s.mat.color.set(on ? '#7CFC9A' : '#ffffff'); s.mat.opacity = on ? 0.6 : 0.3; s.gh.scale.setScalar(on ? 1.05 : 1);
  };

  /* 화면의 한 점(nx, ny)에 부품을 놓아요. 높이는 가장 가까운 같은 종류 슬롯의 높이 */
  const place = (q, nx, ny) => {
    const P = { x: nx, y: ny }; let bj = -1, bd = 1e9;
    slots.forEach((s, j) => { if (s.taken || s.kind !== q.kind) return; const d = pxd(proj(s.x, s.y, s.z), P); if (d < bd) { bd = d; bj = j; } });
    const sy = bj >= 0 ? slots[bj].y : Math.max(q.g.position.y, 1);
    V.set(0, sy, 0); parent.localToWorld(V); pl.constant = -V.y;
    N2.set(nx, ny); rc.setFromCamera(N2, camera);
    if (rc.ray.intersectPlane(pl, V)) { parent.worldToLocal(V); q.g.position.set(lim(V.x, area.x[0], area.x[1]), sy, lim(V.z, area.z[0], area.z[1])); }
    slots.forEach((s, j) => paint(s, j === bj && bd < snapPx(q, s)));
  };

  const panel = () => {
    const rows = items.map((q) => `${q.slot >= 0 ? '✅' : (q.s.opt ? '➕' : '⬜')} ${q.s.name}${q.s.opt ? ' <small>(선택)</small>' : ''}`).join('<br>');
    ui.panel(`<b>${cfg.title || '🔧 부품'}</b><br>${rows}<br><small>${cfg.note || '부품을 끌어 흰 그림자 위에 놓아요 (초록으로 켜지면 붙어요)'}</small>`);
  };

  return {
    items, slots, panel, complete,
    get miss() { return miss; },
    lock(v) { locked = v; },
    pulse(t) { slots.forEach((s) => { if (s.taken) return; s.mat.opacity = s.near ? 0.55 + 0.15 * Math.sin(t * 9) : 0.22 + 0.18 * Math.sin(t * 4); }); },
    down() {
      if (locked) return;
      const free = items.filter((q) => q.slot < 0); if (!free.length) return;
      camera.updateMatrixWorld(true);
      const P = { x: ptr.nx, y: ptr.ny }; let q = null;
      const h = c.pick(free.map((x) => x.g)); if (h) q = find(h.object);
      if (!q || q.slot >= 0) {
        q = null; let bd = 70; /* 화면에서 70px 안의 가장 가까운 부품 */
        free.forEach((x) => { const d = pxd(proj(x.g.position.x, x.g.position.y, x.g.position.z), P); if (d < bd) { bd = d; q = x; } });
      }
      if (!q) return;
      const p0 = proj(q.g.position.x, q.g.position.y, q.g.position.z);
      drag = { q, ox: p0.x - P.x, oy: p0.y - P.y, lift: 0 };
      place(q, p0.x, p0.y);
      snd(c, 'click'); ui.hint(`${q.s.name} — ${q.s.hint}`);
    },
    move(p) {
      if (!drag || !p || !p.down) return;
      camera.updateMatrixWorld(true);
      if (coarse && drag.lift < 44) drag.lift += 4;
      place(drag.q, ptr.nx + drag.ox, ptr.ny + drag.oy + (drag.lift * 2) / innerHeight);
    },
    up() {
      if (!drag) return; const q = drag.q; drag = null; camera.updateMatrixWorld(true);
      slots.forEach((s) => paint(s, false));
      const pp = proj(q.g.position.x, q.g.position.y, q.g.position.z);
      let best = -1, bd = 1e9, wrong = -1;
      slots.forEach((s, j) => {
        if (s.taken) return; const d = pxd(pp, proj(s.x, s.y, s.z)); if (d > snapPx(q, s)) return;
        if (s.kind === q.kind) { if (d < bd) { bd = d; best = j; } } else wrong = j;
      });
      const wpos = (x, y, z) => parent.localToWorld(new THREE.Vector3(x, y, z));
      if (best >= 0) {
        const s = slots[best]; s.taken = true; s.gh.visible = false; q.slot = best; q.g.position.set(s.x, s.y, s.z);
        snd(c, 'ok'); vib(c, 25); ui.pop('✔ 장착!', wpos(s.x, s.y + 1, s.z), '#7CFC9A'); panel();
        if (!fired && complete()) { fired = true; if (cfg.onComplete) cfg.onComplete(); }
      } else {
        if (wrong >= 0) { miss++; snd(c, 'bad'); vib(c, 60); ui.pop('그 자리는 다른 부품이에요', wpos(q.g.position.x, q.g.position.y + 1, q.g.position.z), '#ff8a80'); } else snd(c, 'click');
        q.g.position.set(q.s.rest[0], 0, q.s.rest[1]);
      }
    },
  };
}