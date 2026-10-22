/* ═══════════════════════════════════════════════════════════════
 * src/exp-pilot.js (신규, E1 단계) — 프레임워크 시험용 체험 3종
 *   mmd : 문화콘텐츠학부 멀티미디어전공 → 관광 홍보 사진 촬영 (드래그로 카메라 조준 + 줌 + 셔터)
 *   log : 물류교통학과               → 항만 컨테이너 선적·수량 검수 (끌어서 싣기 → 수량 확인)
 *   mtr : 메카트로닉스공학과         → 로봇 부품 조립 → 리모컨으로 조종해 화물 배달
 * 다른 학과 체험도 같은 방식으로 registerExperience 로 추가합니다. (E2~E4)
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { randomLook } from './core.js';

/* ───────────────────────── 1. 문화콘텐츠 · 촬영 ───────────────────────── */
registerExperience('mmd', {
  icon: '📷', title: '관광 홍보 사진 촬영',
  desc: '여수 관광 홍보팀의 촬영 감독이 되어, 촬영 목록의 피사체 3가지를 가장 멋진 구도로 찍어 보세요.',
  tools: ['📷 카메라', '🔍 줌 렌즈'],
  steps: ['화면을 드래그해 카메라 방향을 돌려요', '🔍로 확대하고 피사체를 화면 가운데에 놓아요', '📸 버튼으로 촬영! 가운데에 크게 담을수록 고득점', '더 좋은 컷이 나오면 다시 찍어 덮어쓸 수 있어요'],
  env: { sky: '#ffb089', fog: ['#ffc7a1', 70, 200], sunColor: '#ffb070', sunI: 1.6, hemi: ['#ffd9b8', '#6d7f9a', 0.85], sunPos: [60, 28, -40] },
  build(c) {
    const { root, ui, cam, camera } = c;
    c.ground('#d8c4a2', 22);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(170, 40), c.mat('#2f6fa3', { roughness: 0.3 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.35; root.add(sea);
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#ffd9a0', fog: false }));
    sunDisc.position.set(130, 40, -85); sunDisc.lookAt(0, 1.7, 0); root.add(sunDisc);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.cyl(0.18, 0.2, 1.1, '#f2c94c', Math.sin(a) * 20.6, 0.55, Math.cos(a) * 20.6); }

    /* 등대 */
    const lh = new THREE.Group(); const la = (-40 * Math.PI) / 180; lh.position.set(Math.sin(la) * 46, 0, Math.cos(la) * 46); root.add(lh);
    c.cyl(5.5, 6.5, 1.4, '#7b8594', 0, 0.5, 0, lh);
    let y = 1.2;
    [['#f5f5f5', 2.8, 2.5, 3.6], ['#d6453d', 2.5, 2.2, 3.2], ['#f5f5f5', 2.2, 1.95, 3.2], ['#d6453d', 1.95, 1.75, 2.8]].forEach(([col, rb, rt, h]) => { c.cyl(rt, rb, h, col, 0, y + h / 2, 0, lh); y += h; });
    c.cyl(2.4, 2.4, 0.35, '#566070', 0, y + 0.17, 0, lh); y += 0.35;
    const lamp = c.cyl(1.0, 1.0, 1.7, '#ffe08a', 0, y + 0.85, 0, lh); lamp.material.emissive = new THREE.Color('#ffcc55'); lamp.material.emissiveIntensity = 0.8; y += 1.7;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 20), c.mat('#d6453d')); roof.position.y = y + 0.65; roof.castShadow = true; lh.add(roof);

    /* 모델(걷는 사람) */
    const model = c.avatar(0, 12, 0, randomLook());

    /* 요트 */
    const yacht = new THREE.Group(); root.add(yacht);
    c.box(6, 1.1, 2.2, '#f4f4f4', 0, 0.2, 0, yacht); c.box(6.2, 0.2, 2.4, '#d6453d', 0, 0.78, 0, yacht); c.cyl(0.1, 0.12, 7, '#d0d0d0', 0.3, 4.2, 0, yacht);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(3.2, 0); sh.lineTo(0, 6.2); sh.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.9 })); sail.position.set(0.4, 1.3, 0); yacht.add(sail);
    const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(-2.4, 0); sh2.lineTo(0, 4.6); sh2.closePath();
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(sh2), new THREE.MeshStandardMaterial({ color: '#ffd9c0', side: THREE.DoubleSide, roughness: 0.9 })); jib.position.set(0.2, 1.3, 0); yacht.add(jib);

    const subs = [
      { name: '🗼 등대 전경', obj: lh, tgt: 0.5, sc: -1 },
      { name: '🧑 모델 인물컷', obj: model.group, tgt: 0.38, sc: -1 },
      { name: '⛵ 움직이는 요트', obj: yacht, tgt: 0.2, sc: -1 },
    ];

    /* 뷰파인더 */
    const vf = document.createElement('div');
    vf.style.cssText = 'position:absolute;inset:14% 12%;border:2px solid rgba(255,255,255,.85);border-radius:6px;pointer-events:none';
    const ln = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;background:rgba(255,255,255,.3);' + css; vf.append(d); };
    ln('left:33.3%;top:0;bottom:0;width:1px'); ln('left:66.6%;top:0;bottom:0;width:1px'); ln('top:33.3%;left:0;right:0;height:1px'); ln('top:66.6%;left:0;right:0;height:1px');
    ln('left:calc(50% - 14px);top:50%;width:28px;height:2px;background:rgba(255,255,255,.9)'); ln('top:calc(50% - 14px);left:50%;height:28px;width:2px;background:rgba(255,255,255,.9)');
    ui.layer.append(vf);

    const fovs = [60, 38, 22]; let zi = 0, yaw = 0, pitch = 0.04, left = 75, ended = false;
    const setCam = () => { const cp = Math.cos(pitch); cam.set([0, 1.7, 0], [Math.sin(yaw) * cp * 10, 1.7 + Math.sin(pitch) * 10, Math.cos(yaw) * cp * 10]); };
    cam.fov(60, true); setCam();
    const refresh = () => ui.panel('<b>🎞 촬영 목록</b><br>' + subs.map((s) => `${s.sc >= 0 ? '✅' : '⬜'} ${s.name} ${s.sc >= 0 ? s.sc + '점' : ''}`).join('<br>'));

    const judge = (s) => {
      const bx = new THREE.Box3().setFromObject(s.obj), ct = bx.getCenter(new THREE.Vector3()), pc = ct.clone().project(camera);
      const top = new THREE.Vector3(ct.x, bx.max.y, ct.z).project(camera), bot = new THREE.Vector3(ct.x, bx.min.y, ct.z).project(camera);
      if (pc.z > 1 || Math.abs(pc.x) > 1 || Math.abs(pc.y) > 1) return null;
      const dist = Math.hypot(pc.x, pc.y), frac = Math.abs(top.y - bot.y) / 2;
      const f = clamp(1 - dist / 0.55, 0, 1), sz = frac < s.tgt ? frac / s.tgt : frac > 0.95 ? 0.6 : 1;
      return { sc: Math.round(100 * (0.6 * f + 0.4 * sz)) };
    };
    const shoot = () => {
      if (ended) return; camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); ui.flash(); c.sfx.click(); c.buzz(25);
      let best = null, bi = -1;
      subs.forEach((s, i) => { const r = judge(s); if (r && r.sc >= 35 && (!best || r.sc > best.sc)) { best = r; bi = i; } });
      if (!best) { ui.pop('피사체가 안 보여요 😅', null, '#ffd0d0'); return; }
      const s = subs[bi];
      if (best.sc <= s.sc) { ui.pop(`이미 ${s.sc}점 컷이 있어요`, null, '#ffe9a0'); return; }
      s.sc = best.sc; refresh(); c.sfx.ok();
      ui.pop(`📸 ${best.sc}점! ${best.sc >= 85 ? '완벽한 구도' : best.sc >= 65 ? '좋은 구도' : '더 가운데·크게!'}`, null, '#fff3a0');
      if (subs.every((x) => x.sc >= 0)) { endBtn.show(true); ui.hint('3컷 완성! 더 좋은 컷으로 다시 찍거나 ✔를 눌러 마쳐요'); }
    };
    const end = () => { if (ended) return; ended = true; vf.remove(); c.finish(subs.reduce((a, s) => a + Math.max(0, s.sc), 0) / subs.length); };
    const zoom = () => { zi = (zi + 1) % fovs.length; cam.fov(fovs[zi]); zb.label(`x${[1, 1.6, 2.7][zi]}`); c.sfx.click(); };

    const shut = ui.button({ icon: '📸', label: '촬영', size: 88, cls: 'red', pos: { right: '28px', bottom: '36px' }, down: shoot });
    const zb = ui.button({ icon: '🔍', label: 'x1', size: 62, pos: { right: '130px', bottom: '40px' }, down: zoom });
    const endBtn = ui.button({ icon: '✔', label: '촬영종료', size: 70, cls: 'grn', pos: { right: '28px', bottom: '140px' }, down: end });
    [shut, zb, endBtn].forEach((b) => b.show(false));

    const animate = (t) => {
      const a = 0.26 + 0.42 * Math.sin(t * 0.22), sg = Math.cos(t * 0.22) >= 0 ? 1 : -1;
      model.group.position.set(Math.sin(a) * 12, 0, Math.cos(a) * 12); model.group.rotation.y = Math.atan2(Math.cos(a) * sg, -Math.sin(a) * sg); model.walk(t * 1.2, 1);
      const b = 0.9 + 0.38 * Math.sin(t * 0.12 + 1), vx = Math.cos(b) * Math.cos(t * 0.12 + 1), vz = -Math.sin(b) * Math.cos(t * 0.12 + 1);
      yacht.position.set(Math.sin(b) * 55, 0, Math.cos(b) * 55); yacht.rotation.y = Math.atan2(-vz, vx); yacht.position.y = Math.sin(t * 1.3) * 0.12;
    };
    return {
      start() { [shut, zb].forEach((b) => b.show(true)); refresh(); ui.hint('화면을 드래그해 카메라를 돌려요 (PC: 스페이스=촬영, Z=줌)'); },
      move(p) { if (!p.down) return; const s = 0.0042 * (fovs[zi] / 60); yaw -= p.dx * s; pitch = clamp(pitch - p.dy * s, -0.5, 0.6); setCam(); },
      update(dt, t) { if (ended) return; left -= dt; ui.timer(left); animate(t); setCam(); if (left <= 0) end(); },
      idle(dt, t) { animate(t); setCam(); },
      key(code) { if (code === 'Space' || code === 'Enter') shoot(); else if (code === 'KeyZ') zoom(); },
      dispose() { vf.remove(); },
    };
  },
});

/* ───────────────────────── 2. 물류교통 · 항만 선적·검수 ───────────────────────── */
const CC = { blue: ['#2f6fed', '파랑', '🔵'], red: ['#d94a3d', '빨강', '🔴'], yellow: ['#e8b92f', '노랑', '🟡'], green: ['#3aa86a', '초록', '🟢'] };
registerExperience('log', {
  icon: '🚢', title: '항만 컨테이너 선적·검수',
  desc: '선적서를 보고 컨테이너를 배에 실은 뒤, 실제로 실린 수량이 맞는지 검수하는 항만 물류 담당자가 되어 보세요.',
  tools: ['🧾 선적서', '🏗 크레인 조작'],
  steps: ['컨테이너를 손가락(마우스)으로 끌어 배 위 칸에 놓아요', '실린 컨테이너를 톡 누르면 다시 내려요', '선적서와 같은 9개를 싣고 ✔ 선적 완료!', '마지막에 실제 수량을 눈으로 세어 검수해요'],
  env: { sky: '#9fd3ff', fog: ['#bfe3ff', 70, 180], sunColor: '#fff4e0', sunI: 1.5, hemi: ['#dff1ff', '#7a8f9a', 0.95], sunPos: [20, 60, 30] },
  build(c) {
    const { root, ui, cam } = c, need = { blue: 4, red: 3, yellow: 2 };
    c.ground('#2f7fb5', 90, -0.9);
    c.box(32, 0.8, 30, '#9aa3ad', -10, -0.4, 0);
    for (let i = -6; i <= 6; i++) c.cyl(0.25, 0.3, 0.7, '#f2c94c', 6.2, 0.35, i * 2.2);
    /* 배 */
    c.box(14, 2.4, 6.4, '#24406e', 15, 0.6, 0); c.box(13.6, 0.12, 6.0, '#c8cdd6', 15, 1.86, 0);
    c.box(2, 3.2, 5.2, '#f0f0f0', 21, 3.4, 0); c.box(2.05, 0.6, 4.6, '#2a3b55', 21, 4.1, 0); c.box(0.3, 1.2, 0.3, '#d6453d', 21, 5.6, 0);
    /* 크레인(장식) */
    c.box(0.8, 10, 0.8, '#c9433a', 7.2, 5, -9); c.box(0.8, 10, 0.8, '#c9433a', 7.2, 5, -12); c.box(15, 0.6, 0.6, '#c9433a', 14, 10, -10.5);
    const slots = []; for (let r = -1; r <= 1; r++) for (let q = -1; q <= 1; q++) { slots.push(new THREE.Vector3(15 + q * 3.2, 2.4, r * 1.5)); c.box(2.7, 0.05, 1.2, '#9aa5b5', 15 + q * 3.2, 1.95, r * 1.5); }
    const occ = Array(9).fill(null);

    const mkCont = (col) => {
      const g = new THREE.Group(), dk = new THREE.Color(CC[col][0]).multiplyScalar(0.7);
      c.box(2.6, 1.2, 1.1, CC[col][0], 0, 0, 0, g);
      for (const s of [-1, 1]) c.box(0.08, 1.0, 0.9, dk, s * 1.3, 0, 0, g);
      for (let i = -2; i <= 2; i++) c.box(0.06, 1.22, 1.12, dk, i * 0.5, 0, 0, g);
      g.userData.cont = true; return g;
    };
    const cols = shuffle([...Array(5).fill('blue'), ...Array(4).fill('red'), ...Array(3).fill('yellow'), ...Array(3).fill('green')]);
    const conts = cols.map((col, i) => {
      const g = mkCont(col), home = new THREE.Vector3(-20 + (i % 5) * 3.5, 0.6, -2.7 + Math.floor(i / 5) * 2.7); g.position.copy(home); root.add(g);
      return { g, col, home, slot: -1 };
    });
    cam.set([2, 23, 16], [2, 0, -1]); cam.fov(48, true);

    let phase = 'load', drag = null, el = 0, tLoad = 0;
    const find = (o) => { let x = o; while (x && !x.userData.cont) x = x.parent; return x ? conts.find((k) => k.g === x) : null; };
    const loaded = () => occ.filter(Boolean).length;
    const upd = () => { const n = loaded(); fin.show(n === 9); ui.hint(n === 9 ? '9칸이 다 찼어요! ✔ 선적 완료를 눌러요' : `선적 ${n}/9 · 컨테이너를 끌어서 배에 실어요 (실린 것을 톡 누르면 내려요)`); };
    const home = (k) => { k.g.position.copy(k.home); k.slot = -1; upd(); };
    const drop = (k) => {
      const g = k.g.position;
      if (g.x > 8.5 && g.x < 21.5 && Math.abs(g.z) < 3.6) {
        let bi = -1, bd = 1e9; slots.forEach((s, i) => { if (occ[i]) return; const d = Math.hypot(s.x - g.x, s.z - g.z); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0) { occ[bi] = k; k.slot = bi; g.copy(slots[bi]); c.sfx.pickup(); c.buzz(15); ui.pop('+1', g); upd(); return; }
        ui.pop('배가 가득 찼어요', g, '#ffd0d0');
      }
      home(k);
    };
    const manifest = '<b>🧾 선적서</b><br>' + Object.keys(need).map((k) => `<span style="color:${CC[k][0]}">■</span> ${CC[k][1]} ${need[k]}개`).join('<br>') + '<br><small>※ 🟢초록은 이번 화물이 아니에요</small>';

    const check = () => {
      phase = 'check'; fin.show(false); drag = null; tLoad = el; ui.hint('');
      const got = { blue: 0, red: 0, yellow: 0, green: 0 }; occ.forEach((k) => { if (k) got[k.col]++; });
      let match = 0; for (const k in need) match += Math.min(need[k], got[k]);
      cam.to([15, 12, 10], [15, 2, 0]);
      const diff = Object.keys(need).filter((k) => got[k] !== need[k]), keys = Object.keys(need);
      const qc = diff.length ? diff[Math.floor(Math.random() * diff.length)] : keys[Math.floor(Math.random() * keys.length)], ans = got[qc];
      let opts = shuffle([...new Set([ans, ans + 1, Math.max(0, ans - 1), ans + 2, Math.max(0, ans - 2)])]).slice(0, 4); if (!opts.includes(ans)) opts[0] = ans; shuffle(opts);
      ui.ask(`🧾 검수 시간!<br>선적서에는 ${CC[qc][2]} ${CC[qc][1]} <b>${need[qc]}개</b>라고 적혀 있어요.<br>실제로 배에 실린 ${CC[qc][2]} ${CC[qc][1]}은 몇 개일까요?`, opts.map((n) => n + '개'), (i) => {
        const ok = opts[i] === ans;
        const sc = (60 * match) / 9 + 10 * clamp(1 - (tLoad - 30) / 60, 0, 1) + (ok ? 30 : 0);
        ui.panel('<b>📋 검수 결과</b><br>' + keys.map((k) => `${CC[k][2]} ${CC[k][1]}: 선적서 ${need[k]} / 실제 ${got[k]} ${got[k] === need[k] ? '✔' : '⚠'}`).join('<br>') + (got.green ? `<br>🟢 초록 ${got.green}개 잘못 실림 ⚠` : ''));
        ui.pop(ok ? '검수 정답! ✔' : `실제는 ${ans}개였어요`, null, ok ? '#a0ffb8' : '#ffd0d0'); c.finish(sc);
      });
    };
    const fin = ui.button({ icon: '✔', label: '선적 완료', size: 86, cls: 'grn', pos: { right: '28px', bottom: '40px' }, down: check }); fin.show(false);

    return {
      start() { ui.panel(manifest); upd(); },
      down(p) {
        if (phase !== 'load') return; const h = c.pick(conts.map((k) => k.g)); if (!h) return; const k = find(h.object); if (!k) return;
        const pt = c.at(2.2); if (!pt) return; drag = { k, sx: p.x, sy: p.y, moved: false, ox: k.g.position.x - pt.x, oz: k.g.position.z - pt.z };
      },
      move(p) {
        if (!drag || !p.down) return;
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) { drag.moved = true; if (drag.k.slot >= 0) { occ[drag.k.slot] = null; drag.k.slot = -1; upd(); } c.sfx.click(); }
        if (drag.moved) { const pt = c.at(2.2); if (pt) drag.k.g.position.set(pt.x + drag.ox, 2.2, pt.z + drag.oz); }
      },
      up() {
        if (!drag) return; const d = drag; drag = null;
        if (!d.moved) { if (d.k.slot >= 0) { occ[d.k.slot] = null; home(d.k); c.sfx.click(); } return; }
        drop(d.k);
      },
      update(dt) { if (phase === 'load') { el += dt; ui.score(`⏱ ${Math.floor(el)}초`); } },
    };
  },
});

/* ───────────────────────── 3. 메카트로닉스 · 로봇 조립 → 리모컨 조종 ───────────────────────── */
registerExperience('mtr', {
  icon: '🤖', title: '로봇 조립 & 리모컨 조종',
  desc: '흩어진 부품을 조립해 로봇을 완성하고, 리모컨으로 직접 조종해 화물을 배달해 보세요.',
  tools: ['🔧 로봇 부품 5종', '🎮 리모컨'],
  steps: ['부품을 끌어서 로봇의 흰 홈에 맞춰 놓아요 (5개)', '조립이 끝나면 리모컨 ▲▼◀▶로 로봇을 조종해요', '🦾 버튼으로 📦를 집어 초록 구역에 내려놓아요', '60초 안에 3개를 배달하면 최고 점수!'],
  env: { sky: '#cfe3f5', fog: ['#cfe3f5', 50, 150], sunColor: '#ffffff', sunI: 1.5, hemi: ['#e8f2ff', '#8c97a8', 0.95], sunPos: [25, 45, 30] },
  build(c) {
    const { root, ui, cam } = c; const dark = '#2b2f3a';
    const MK = {
      wheel() { const g = new THREE.Group(), a = new THREE.Group(); a.rotation.z = Math.PI / 2; g.add(a); c.cyl(0.65, 0.65, 0.45, dark, 0, 0, 0, a); c.cyl(0.28, 0.28, 0.5, '#d8dde6', 0, 0, 0, a); return g; },
      battery() { const g = new THREE.Group(); c.box(0.9, 0.5, 1.2, '#3fbf6f', 0, 0, 0, g); c.box(0.2, 0.12, 0.2, '#f2c94c', -0.2, 0.3, 0.3, g); c.box(0.2, 0.12, 0.2, '#f2c94c', 0.2, 0.3, 0.3, g); return g; },
      board() { const g = new THREE.Group(); c.box(1.5, 0.12, 1.1, '#1f9e8f', 0, 0, 0, g); c.box(0.4, 0.1, 0.4, '#222', -0.35, 0.1, 0.1, g); c.box(0.3, 0.1, 0.5, '#222', 0.3, 0.1, -0.1, g); c.box(0.9, 0.04, 0.06, '#e8c34a', 0, 0.07, 0.42, g); return g; },
      arm() { const g = new THREE.Group(); c.cyl(0.35, 0.4, 0.4, '#7a8499', 0, 0.2, 0, g); const l = c.box(0.3, 0.3, 1.1, '#f2a93b', 0, 0.75, 0.45, g); l.rotation.x = -0.35; c.box(0.12, 0.14, 0.5, '#e8e8e8', -0.2, 0.9, 1.05, g); c.box(0.12, 0.14, 0.5, '#e8e8e8', 0.2, 0.9, 1.05, g); return g; },
    };
    const SPEC = [
      { kind: 'wheel', name: '바퀴', mk: MK.wheel, at: [-1.45, 0.65, 0.5], rest: [-6.5, 1.45, 1.8] },
      { kind: 'wheel', name: '바퀴', mk: MK.wheel, at: [1.45, 0.65, 0.5], rest: [6.5, 1.45, 2.4] },
      { kind: 'bat', name: '배터리', mk: MK.battery, at: [0, 0.85, -0.9], rest: [-5.2, 1.05, -2.8] },
      { kind: 'brd', name: '제어 보드', mk: MK.board, at: [0, 0.66, 0.45], rest: [5.2, 0.86, -2.7] },
      { kind: 'arm', name: '로봇 팔', mk: MK.arm, at: [0, 0.6, 1.2], rest: [0, 0.8, 3.7] },
    ];
    c.ground('#8e99a8', 40);
    const table = c.box(20, 0.8, 11, '#a9774a', 0, 0.4, 0);
    const rob = new THREE.Group(); rob.position.y = 0.8; root.add(rob);
    c.box(2.4, 0.5, 3.4, '#3b6fe0', 0, 0.35, 0, rob); c.box(2.0, 0.08, 0.3, '#f2f2f2', 0, 0.62, -1.5, rob);
    c.box(0.3, 0.2, 0.1, '#ffe27a', -0.7, 0.4, 1.72, rob); c.box(0.3, 0.2, 0.1, '#ffe27a', 0.7, 0.4, 1.72, rob);

    const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    const socks = SPEC.map((s) => {
      const gh = s.mk(); gh.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = o.receiveShadow = false; } });
      gh.position.set(s.at[0], s.at[1], s.at[2]); rob.add(gh); return { s, gh, filled: false };
    });
    const parts = SPEC.map((s) => { const g = s.mk(); g.userData.part = true; g.position.set(s.rest[0], s.rest[1], s.rest[2]); root.add(g); return { s, g, snapped: false }; });

    /* 시운전 무대(조립 후 표시) */
    const arena = new THREE.Group(); arena.visible = false; root.add(arena);
    const ZONE = { x: -6, z: -10 };
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 40), new THREE.MeshBasicMaterial({ color: '#3cd17a', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(ZONE.x, 0.03, ZONE.z); arena.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: '#3cd17a', transparent: true, opacity: 0.25, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.set(ZONE.x, 0.02, ZONE.z); arena.add(disc);
    c.cyl(0.08, 0.08, 3, '#dddddd', ZONE.x + 3.2, 1.5, ZONE.z, arena); c.box(1.2, 0.7, 0.05, '#3cd17a', ZONE.x + 3.8, 2.7, ZONE.z, arena);
    const obs = [];
    [[-2, 6], [3, -3], [-8, -1], [5, 4]].forEach(([x, z]) => { c.cyl(0.9, 0.9, 2.4, '#d6453d', x, 1.2, z, arena); c.cyl(0.92, 0.92, 0.5, '#f5f5f5', x, 1.4, z, arena); obs.push({ x, z, r: 0.9 }); });
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.cyl(0.3, 0.3, 1, '#f2c94c', Math.sin(a) * 16, 0.5, Math.cos(a) * 16, arena); }
    const pk = [[-9, 5], [7, 9], [9, -4]].map(([x, z]) => {
      const g = new THREE.Group(); c.box(1.1, 1.1, 1.1, '#c98a4b', 0, 0, 0, g); c.box(1.12, 1.12, 0.22, '#e8d9b5', 0, 0, 0, g); g.position.set(x, 0.55, z); g.visible = false; root.add(g);
      return { g, done: false, held: false };
    });

    /* 리모컨 버튼 */
    const mkPad = (icon, left, bottom) => { const b = ui.button({ icon, size: 64, pos: { left: left + 'px', bottom: bottom + 'px' } }); b.show(false); return b; };
    const pad = { up: mkPad('▲', 90, 130), dn: mkPad('▼', 90, 28), lf: mkPad('◀', 20, 79), rt: mkPad('▶', 160, 79) };
    const grabBtn = ui.button({ icon: '🦾', label: '집기/놓기', size: 88, cls: 'grn', pos: { right: '30px', bottom: '50px' }, down: () => grab() }); grabBtn.show(false);

    cam.set([0, 9.5, 10.5], [0, 1.2, 0]); cam.fov(50, true);
    let phase = 'asm', drag = null, count = 0, tt = 0, left = 60, hdg = 0, vel = 0, delivered = 0, carry = null;
    const OFF = [[-1.1, -0.6], [1.1, -0.6], [0, 0.9]];

    const asmPanel = () => ui.panel(`<b>🔧 조립 현황 ${count}/5</b><br>${SPEC.map((s, i) => `${socks[i].filled ? '✅' : '⬜'} ${s.name}`).join('<br>')}`);
    const trySnap = (q, d) => {
      rob.updateMatrixWorld(true); let best = null, bd = 1.9, wrong = false;
      for (const s of socks) {
        if (s.filled) continue; const w = rob.localToWorld(new THREE.Vector3(s.s.at[0], s.s.at[1], s.s.at[2])), dist = Math.hypot(w.x - q.g.position.x, w.z - q.g.position.z);
        if (s.s.kind === q.s.kind) { if (dist < bd) { bd = dist; best = s; } } else if (dist < 1.5) wrong = true;
      }
      if (best) {
        best.filled = true; best.gh.visible = false; q.snapped = true; rob.add(q.g); q.g.position.set(best.s.at[0], best.s.at[1], best.s.at[2]); q.g.rotation.set(0, 0, 0); q.sock = best;
        count++; c.sfx.ok(); c.buzz(20); ui.pop(`${q.s.name} 장착! ✔`, rob.localToWorld(new THREE.Vector3(best.s.at[0], 1.2, best.s.at[2])), '#a0ffb8'); asmPanel();
        if (count === 5) { phase = 'trans'; tt = 0; ui.hint('조립 완료! 시운전을 준비해요…'); c.sfx.win(); } else ui.hint('좋아요! 다음 부품을 끌어서 맞춰요');
        return;
      }
      if (wrong) { ui.pop('그 자리는 다른 부품이에요', q.g.position, '#ffd0d0'); c.sfx.bump(); }
      const pt = c.at(q.s.rest[1]);
      q.g.position.set(pt ? clamp(pt.x + d.ox, -9, 9) : q.s.rest[0], q.s.rest[1], pt ? clamp(pt.z + d.oz, -5, 5) : q.s.rest[2]);
    };

    const grab = () => {
      if (phase !== 'drive') return; c.buzz(15);
      if (carry) {
        const fx = rob.position.x + Math.sin(hdg) * 2.6, fz = rob.position.z + Math.cos(hdg) * 2.6, b = carry; carry = null; b.held = false;
        root.add(b.g); b.g.position.set(fx, 0.55, fz); b.g.rotation.set(0, hdg, 0); c.sfx.click();
        if (Math.hypot(fx - ZONE.x, fz - ZONE.z) < 3.0) {
          b.done = true; b.g.position.set(ZONE.x + OFF[delivered][0], 0.55, ZONE.z + OFF[delivered][1]); delivered++; c.sfx.ok(); ui.pop('배달 완료! 📦', b.g.position, '#a0ffb8'); drivePanel();
          if (delivered === 3) endDrive();
        }
      } else {
        const fx = rob.position.x + Math.sin(hdg) * 2.2, fz = rob.position.z + Math.cos(hdg) * 2.2; let best = null, bd = 2.4;
        pk.forEach((b) => { if (b.done || b.held) return; const d = Math.hypot(b.g.position.x - fx, b.g.position.z - fz); if (d < bd) { bd = d; best = b; } });
        if (!best) { ui.pop('앞에 📦가 없어요', null, '#ffe9a0'); return; }
        best.held = true; carry = best; rob.add(best.g); best.g.position.set(0, 1.35, 1.8); best.g.rotation.set(0, 0, 0); c.sfx.pickup();
      }
    };
    const drivePanel = () => ui.panel(`<b>📦 배달 ${delivered}/3</b><br>🟩 초록 구역에 놓아요`);
    const endDrive = () => { if (phase === 'end') return; phase = 'end'; Object.values(pad).forEach((b) => b.show(false)); grabBtn.show(false); c.finish(30 + 20 * delivered + (delivered === 3 ? Math.min(10, left / 6) : 0)); };
    const startDrive = () => {
      phase = 'drive'; table.visible = false; rob.position.set(0, 0, 0); rob.rotation.y = 0; arena.visible = true; pk.forEach((b) => { b.g.visible = true; });
      Object.values(pad).forEach((b) => b.show(true)); grabBtn.show(true); cam.fov(55, true); ui.hint('리모컨 ▲▼◀▶ (PC: WASD, E=집기/놓기)'); drivePanel(); left = 60;
    };
    const drive = (dt) => {
      left -= dt; ui.timer(left); if (left <= 0) { endDrive(); return; }
      const k = c.keys, f = pad.up.held() || k.has('KeyW') || k.has('ArrowUp'), b = pad.dn.held() || k.has('KeyS') || k.has('ArrowDown'), l = pad.lf.held() || k.has('KeyA') || k.has('ArrowLeft'), r = pad.rt.held() || k.has('KeyD') || k.has('ArrowRight');
      const fw = (f ? 1 : 0) - (b ? 1 : 0), tn = (l ? 1 : 0) - (r ? 1 : 0);
      vel += (fw * 5.5 - vel) * Math.min(1, 6 * dt); hdg += tn * 2.2 * dt;
      rob.position.x += Math.sin(hdg) * vel * dt; rob.position.z += Math.cos(hdg) * vel * dt;
      for (const o of obs) { const dx = rob.position.x - o.x, dz = rob.position.z - o.z, m = o.r + 1.4, d2 = dx * dx + dz * dz; if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; rob.position.x = o.x + (dx / d) * m; rob.position.z = o.z + (dz / d) * m; vel *= 0.5; } }
      const rr = Math.hypot(rob.position.x, rob.position.z); if (rr > 14.5) { rob.position.x *= 14.5 / rr; rob.position.z *= 14.5 / rr; }
      rob.rotation.y = hdg; parts.forEach((q) => { if (q.s.kind === 'wheel') q.g.rotation.x += (vel * dt) / 0.65; });
      const sx = Math.sin(hdg), cz = Math.cos(hdg), px = rob.position.x, pz = rob.position.z;
      cam.to([px - sx * 9, 7.5, pz - cz * 9], [px + sx * 3, 1, pz + cz * 3]);
    };

    return {
      start() { asmPanel(); ui.hint('부품을 끌어서 로봇의 흰 홈에 맞춰요'); },
      down(p) {
        if (phase !== 'asm') return; const free = parts.filter((q) => !q.snapped); let q = null;
        const h = c.pick(free.map((x) => x.g)); if (h) { let o = h.object; while (o && !o.userData.part) o = o.parent; q = free.find((x) => x.g === o) || null; }
        if (!q) { const pt0 = c.at(1.0); if (pt0) { let bd = 1.8; free.forEach((x) => { const d = Math.hypot(x.g.position.x - pt0.x, x.g.position.z - pt0.z); if (d < bd) { bd = d; q = x; } }); } }
        if (!q) return; const pt = c.at(2.4); if (!pt) return;
        drag = { q, ox: q.g.position.x - pt.x, oz: q.g.position.z - pt.z }; q.g.position.y = 2.4; c.sfx.click(); ui.hint(`${q.s.name}을(를) 로봇의 흰 홈으로 옮겨요`);
      },
      move(p) { if (!drag || !p.down) return; const pt = c.at(2.4); if (pt) drag.q.g.position.set(clamp(pt.x + drag.ox, -9, 9), 2.4, clamp(pt.z + drag.oz, -5, 5)); },
      up() { if (!drag) return; const d = drag; drag = null; trySnap(d.q, d); },
      key(code) { if (code === 'KeyE' || code === 'Enter') grab(); },
      update(dt, t) {
        ghostMat.opacity = 0.25 + 0.2 * Math.sin(t * 4);
        if (phase === 'trans') { tt += dt; rob.rotation.y += dt * 3; if (tt > 1.5) startDrive(); } else if (phase === 'drive') drive(dt);
      },
      idle(dt, t) { ghostMat.opacity = 0.25 + 0.2 * Math.sin(t * 4); },
    };
  },
});