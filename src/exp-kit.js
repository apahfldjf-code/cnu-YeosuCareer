/* ═══════════════════════════════════════════════════════════════
 * src/exp-kit.js (신규, E2-1) — 3D 조립 체험 공용 도구
 *  - assembler : 부품을 끌어서 흰 그림자(슬롯)에 끼우는 조립대
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
 * cfg.parts[]: { kind, name, hint, make(), slot:[x,y,z], rest:[x,z], r(끼움 반경), opt(선택 부품) }
 *   - 같은 kind 부품은 서로 바꿔 끼울 수 있어요 (기둥 4개처럼)
 *   - make() 는 '바닥에 놓았을 때의 모양'을 만들고, 끼우면 slot 위치로 올라갑니다
 * cfg.onComplete : 필수 부품을 모두 끼웠을 때 한 번 호출
 */
export function assembler(c, cfg) {
  const { root, ui } = c, parent = cfg.parent || root, area = cfg.limit || { x: [-9, 9], z: [-4, 5] };
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
  const slots = [], items = [];
  let drag = null, miss = 0, locked = false, fired = false;

  cfg.parts.forEach((s, i) => {
    const g = s.make(); g.position.set(s.rest[0], 0, s.rest[1]); g.userData.part = i; parent.add(g);
    const gh = s.make(); gh.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } });
    gh.position.set(s.slot[0], s.slot[1], s.slot[2]); parent.add(gh);
    slots.push({ kind: s.kind, x: s.slot[0], y: s.slot[1], z: s.slot[2], r: s.r || 1.6, gh, taken: false });
    items.push({ i, s, kind: s.kind, g, slot: -1 });
  });

  const need = () => cfg.parts.filter((s) => !s.opt).length;
  const have = () => items.filter((q) => !q.s.opt && q.slot >= 0).length;
  const complete = () => have() >= need();
  const find = (o) => { let n = o; while (n && n.userData.part === undefined) n = n.parent; return n ? items[n.userData.part] : null; };
  const pt3 = (x, z) => new THREE.Vector3(x, 2.4, z);

  const panel = () => {
    const rows = items.map((q) => `${q.slot >= 0 ? '✅' : (q.s.opt ? '➕' : '⬜')} ${q.s.name}${q.s.opt ? ' <small>(선택)</small>' : ''}`).join('<br>');
    ui.panel(`<b>${cfg.title || '🔧 부품'}</b><br>${rows}<br><small>${cfg.note || '부품을 끌어 흰 그림자 위에 놓아요'}</small>`);
  };

  return {
    items, slots, panel, complete,
    get miss() { return miss; },
    lock(v) { locked = v; },
    pulse(t) { ghostMat.opacity = 0.22 + 0.18 * Math.sin(t * 4); },
    down() {
      if (locked) return;
      const free = items.filter((q) => q.slot < 0); if (!free.length) return;
      let q = null; const h = c.pick(free.map((x) => x.g)); if (h) q = find(h.object);
      if (!q || q.slot >= 0) {
        q = null; const p0 = c.at(0.8);
        if (p0) { let bd = 1.8; free.forEach((x) => { const d = Math.hypot(x.g.position.x - p0.x, x.g.position.z - p0.z); if (d < bd) { bd = d; q = x; } }); }
      }
      if (!q) return; const pt = c.at(2.4); if (!pt) return;
      drag = { q, ox: q.g.position.x - pt.x, oz: q.g.position.z - pt.z }; q.g.position.y = 2.4;
      snd(c, 'click'); ui.hint(`${q.s.name} — ${q.s.hint}`);
    },
    move(p) {
      if (!drag || !p.down) return; const pt = c.at(2.4); if (!pt) return;
      drag.q.g.position.set(lim(pt.x + drag.ox, area.x[0], area.x[1]), 2.4, lim(pt.z + drag.oz, area.z[0], area.z[1]));
    },
    up() {
      if (!drag) return; const q = drag.q; drag = null; const P = q.g.position;
      let best = -1, bd = 1e9, wrong = -1;
      slots.forEach((s, j) => {
        if (s.taken) return; const d = Math.hypot(P.x - s.x, P.z - s.z); if (d > s.r) return;
        if (s.kind === q.kind) { if (d < bd) { bd = d; best = j; } } else wrong = j;
      });
      if (best >= 0) {
        const s = slots[best]; s.taken = true; s.gh.visible = false; q.slot = best; q.g.position.set(s.x, s.y, s.z);
        snd(c, 'ok'); vib(c, 25); ui.pop('✔ 장착!', pt3(s.x, s.z), '#7CFC9A'); panel();
        if (!fired && complete()) { fired = true; if (cfg.onComplete) cfg.onComplete(); }
      } else {
        if (wrong >= 0) { miss++; snd(c, 'bad'); vib(c, 60); ui.pop('그 자리는 다른 부품이에요', pt3(P.x, P.z), '#ff8a80'); } else snd(c, 'click');
        q.g.position.set(q.s.rest[0], 0, q.s.rest[1]);
      }
    },
  };
}