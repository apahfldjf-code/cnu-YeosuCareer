/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea1.js (수산해양 S1-fix) — 전체 교체본
 *   mfm : 해양생산관리학과 → 실습선 새동백호 승선 · 부표 항로 항해 · 어장 트롤 예인 · 양망
 *   kcg : 해양경찰학과     → 해경 함정 승선 · 122 신고 출동 · 표류자 4명 구조 · 구조 후 조치 판단
 * [수정] ① 승선하면 배 위 이름표(승선 박스)를 모두 숨겨요
 *        ② 선석마다 방파제로 나뉘고 뱃머리가 바다를 향해서 직진 출항해요 (exp-sea-kit.js 의 buildPort 교체 필요)
 *        ③ 출항 항로·부표·암초 위치를 선석 기준으로 다시 잡았어요
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import {
  SEA_ENV, ENGINE, KN, tagSprite, makeResearchShip, makeCoastGuard, makeTug, buildPort, createSea,
  buoy, reef, guide, helm, netRig, snd, wrapA, headingDeg, bearingDeg, pad3,
} from './exp-sea-kit.js';

const INFO = { sae: ['실습선 새동백호', '해양생산관리학과'], kcg: ['해양경찰 함정', '해양경찰학과'], tug: ['예인선', '항만 작업선'] };

/* 항구 + 정박한 배 3척 + 내 아바타 */
function setup(c, mission) {
  const sea = createSea(c), port = buildPort(c);
  const ships = { sae: makeResearchShip(c), kcg: makeCoastGuard(c), tug: makeTug(c) };
  const tags = [];
  Object.keys(ships).forEach((k) => {
    const s = ships[k], m = port.moor[k]; s.position.set(m.x, 0, m.z); s.rotation.y = m.h; c.root.add(s);
    const tag = tagSprite(`${INFO[k][0]}\n${k === mission ? '⚓ 눌러서 승선' : INFO[k][1]}`, k === mission ? 'rgba(10,150,170,.92)' : 'rgba(55,65,85,.82)');
    tag.position.set(0, s.userData.tagY, 0); s.add(tag); tags.push(tag);
  });
  const ship = ships[mission], cw = ship.userData.crew;
  const av = c.avatar(0, 0, 0); ship.add(av.group); av.group.position.set(cw[0], cw[1], cw[2]); av.group.rotation.y = 0; av.wave(0);
  const which = (obj) => { let o = obj; while (o) { for (const k in ships) if (ships[k] === o) return k; o = o.parent; } return null; };
  const ambient = (t) => Object.keys(ships).forEach((k, i) => { if (k !== mission) { ships[k].position.y = Math.sin(t * 1.2 + i * 2) * 0.08 - 0.05; ships[k].rotation.z = Math.sin(t * 0.9 + i) * 0.02; } });
  /* 승선하면 이름표(승선 박스)를 전부 숨겨요 */
  const hideTags = () => tags.forEach((t) => { t.visible = false; });
  return { sea, port, ships, ship, av, which, ambient, hideTags };
}
/* 항구 전경: 바다 쪽(북쪽)에서 선석을 내려다봐요 */
const portCam = (c, t) => c.cam.to([-4 + Math.sin(t * 0.25) * 26, 22, 64], [-4, 3, 2]);

/* ═══════════════ 1. 해양생산관리학과 — 새동백호 항해·어업 ═══════════════ */
registerExperience('mfm', {
  icon: '⚓', title: '새동백호 · 항해와 어업 실습',
  desc: '3,000톤급 실습선 새동백호의 항해사가 되어 부표 항로로 출항하고, 어장에서 트롤 어구를 끌어 어획까지 마치는 하루 실습을 체험해 보세요.',
  tools: ['🚢 실습선 새동백호', '🧭 키잡이·엔진 텔레그래프', '🎣 트롤 어구'],
  steps: ['1번 선석의 새동백호를 눌러(또는 ⚓ 버튼) 승선해요', '▲ 로 엔진을 올려 정면 바다로 직진 출항! 이후 ◀▶ 키잡이로 1→5번 부표를 순서대로 통과해요', '어장의 초록 항로 안에서 엔진 미속~반속으로 70m를 끌어요 (속도·항로를 벗어나면 그물이 엉켜요)', '배를 세우고 🎣 양망! 어획물을 확인해요'],
  env: SEA_ENV,
  build(c) {
    const { root, ui } = c;
    const W = setup(c, 'sae'), ship = W.ship, av = W.av;
    const WP = [[-14, 72], [62, 92], [30, 160], [-40, 215], [-75, 252]];
    const LANE = { x0: -75, x1: -145, z: 252, hw: 8 };
    /* 선석 정면(x=-28, z<40)은 비워 두고 암초는 항로 중간에 배치 */
    const reefs = [[24, 82, 6], [46, 126, 7], [-5, 188, 7], [-57, 233, 5], [90, 70, 7], [-60, 120, 9], [-100, 190, 8], [0, 250, 6]].map(([x, z, r]) => reef(c, root, x, z, r)).concat(W.port.islands);
    const bu = WP.map((p, i) => buoy(c, root, i + 1, p[0], p[1], i === 4 ? '#2a9d4a' : '#e8602c'));
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(70, LANE.hw * 2), new THREE.MeshBasicMaterial({ color: '#35e08d', transparent: true, opacity: 0.2, depthWrite: false }));
    lane.rotation.x = -Math.PI / 2; lane.position.set((LANE.x0 + LANE.x1) / 2, 0.08, LANE.z); root.add(lane);
    for (let i = 0; i <= 7; i++) for (const s of [-1, 1]) c.cyl(0.25, 0.3, 1.4, '#f2c94c', LANE.x0 - i * 10, 0.7, LANE.z + s * LANE.hw, root, 8);
    const net = netRig(ship), gd = guide(c);
    const hm = helm(c, ship, { reefs, walls: W.port.walls, onHit: () => { /* 감점은 hm.S.hits 로 계산 */ } });
    const S = hm.S, TOP = new THREE.Vector3(0, 6, 0);

    let phase = 'port', left = 180, wp = 0, tow = 0, tangle = 0, torn = 0, armed = false, hauled = false, ended = false, hudT = 0, dist = 0;
    const boardBtn = ui.button({ icon: '⚓', label: '승선', size: 92, cls: 'grn', pos: { right: '28px', bottom: '46px' }, down: () => board() }); boardBtn.show(false);
    const haulBtn = ui.button({ icon: '🎣', label: '양망', size: 92, cls: 'red', pos: { right: '124px', bottom: '60px' }, down: () => haul() }); haulBtn.show(false);

    const hud = () => {
      const base = `<b>⚓ 새동백호 항해</b><br>🧭 선수 ${pad3(headingDeg(S.hdg))}° · 🚢 ${KN(S.speed)}노트<br>⚙ 엔진 ${'▮'.repeat(S.thr)}${'▯'.repeat(3 - S.thr)} ${ENGINE[S.thr]}`;
      if (phase === 'sail') ui.panel(`${base}<br>📍 부표 ${wp}/5 · 다음까지 ${Math.round(dist)}m<br>⚠ 충돌 ${S.hits}회`);
      else if (phase === 'trawl') ui.panel(`${base}<br>🎣 예인 ${Math.round(tow * 100)}% · 그물 상태 ${100 - Math.round(tangle)}%<br>${armed ? '✅ 투하 중' : '↩ 출발 지점(5번 부표)으로 돌아가요'}`);
      else if (phase === 'port') ui.panel('<b>📋 오늘의 실습</b><br>① 부표 5개 항로 통과<br>② 어장에서 그물 예인<br>③ 양망·어획 확인');
    };
    const board = () => {
      if (phase !== 'port') return;
      phase = 'sail'; boardBtn.show(false); W.hideTags(); av.group.rotation.y = 0; av.stopWave(); hm.on(true); snd(c, 'go');
      bu[0].active(true); ui.banner('⚓ 출항!'); ui.hint('▲ 엔진을 올려 정면 바다로 직진! 방파제를 벗어나면 1번 부표로 · 암초(빨간 깃발) 주의'); hud();
    };
    const startTrawl = () => {
      phase = 'trawl'; armed = true; net.visible = true; tow = 0; tangle = 0;
      ui.banner('🎣 어장 도착! 그물 투하'); snd(c, 'ok'); ui.hint('초록 항로 안에서 엔진 미속~반속(1~2단)으로 끌어요. 전속은 그물이 터져요!');
    };
    const haul = () => {
      if (phase !== 'trawl' || !hauled) return;
      if (S.speed > 2.2) { ui.pop('배를 세운 뒤 양망해요!', ship.position.clone().add(TOP), '#ffe9a0'); return; }
      phase = 'haul'; haulBtn.show(false); hm.on(false); net.visible = false; snd(c, 'win');
      const q = 1 - torn * 0.2, fish = [['고등어', '🐟', 40], ['갈치', '🐟', 25], ['참조기', '🐠', 18], ['오징어', '🦑', 22], ['새우', '🦐', 12]].map(([n, e, b]) => [n, e, Math.round(b * q * c.rnd(0.7, 1.3))]);
      ui.panel(`<b>🎣 오늘의 어획</b><br>${fish.map(([n, e, k]) => `${e} ${n} ${k}kg`).join('<br>')}<br><small>항해사는 항해 안전과 어획물 처리를 함께 책임져요</small>`);
      ui.hint('양망 완료! 잠시 후 결과가 나와요'); end();
    };
    const end = () => {
      if (ended) return; ended = true; hm.on(false); gd.hide(); haulBtn.show(false);
      const nav = wp * 8, tw = hauled ? 35 * clamp(1 - torn * 0.35, 0.3, 1) : 25 * tow, safe = clamp(15 - S.hits * 3, 0, 15), tm = hauled ? 10 * clamp(left / 60, 0, 1) : 0;
      c.finish(nav + tw + safe + tm);
    };
    const ambient = (dt, t) => { W.ambient(t); W.sea.update(S.x, S.z, t); hm.update(dt, t); };

    return {
      start() { boardBtn.show(true); ui.hint('1번 선석의 새동백호를 눌러 승선해요! (오른쪽 아래 ⚓ 버튼도 돼요)'); hud(); },
      down() {
        if (phase !== 'port') return; const h = c.pick(Object.values(W.ships)); if (!h) return; const k = W.which(h.object);
        if (k === 'sae') board(); else if (k) ui.pop(k === 'kcg' ? '해양경찰 함정은 해양경찰학과 체험에서 타요' : '항만 작업선이에요', h.point, '#ffe9a0');
      },
      key(code) {
        if (phase === 'port') { if (code === 'KeyE' || code === 'Enter' || code === 'Space') board(); return; }
        if (code === 'KeyW' || code === 'ArrowUp') hm.step(1); else if (code === 'KeyS' || code === 'ArrowDown') hm.step(-1); else if (code === 'KeyE' || code === 'Space') haul();
      },
      idle(dt, t) { ambient(dt, t); portCam(c, t); },
      update(dt, t) {
        ambient(dt, t);
        if (phase === 'port') { portCam(c, t); return; }
        if (ended) return;
        left -= dt; ui.timer(left); hm.chase();
        if (phase === 'sail') {
          const p = WP[wp], dx = p[0] - S.x, dz = p[1] - S.z; dist = Math.hypot(dx, dz);
          gd.set(wrapA(Math.atan2(dx, dz) - S.hdg), `${wp + 1}번 부표 · ${Math.round(dist)}m · 방위 ${pad3(bearingDeg(dx, dz))}°`);
          bu[wp].beam.scale.x = bu[wp].beam.scale.z = 1 + Math.sin(t * 4) * 0.12;
          if (dist < 13) { bu[wp].done(); wp++; snd(c, 'ok'); ui.pop(`✔ ${wp}번 부표 통과`, ship.position.clone().add(TOP), '#a0ffb8'); if (wp >= 5) startTrawl(); else bu[wp].active(true); }
        } else if (phase === 'trawl') {
          const gx = S.x - LANE.x0, gz = S.z - LANE.z;
          if (!armed && Math.hypot(gx, gz) < 14) { armed = true; tangle = 0; ui.banner('🎣 그물 재투하!'); }
          const tx = armed && !hauled ? LANE.x1 : LANE.x0, tz = LANE.z;
          gd.set(wrapA(Math.atan2(tx - S.x, tz - S.z) - S.hdg), armed ? `예인 종점까지 ${Math.round(Math.max(0, S.x - LANE.x1))}m` : '출발 지점(5번 부표)으로 복귀');
          net.visible = armed && !hauled;
          if (armed && !hauled) {
            const inLane = S.x < LANE.x0 + 6 && S.x > LANE.x1 - 6 && Math.abs(S.z - LANE.z) < LANE.hw, okSpd = S.speed > 2.5 && S.speed < 9.5;
            const started = S.x < LANE.x0 - 4;
            if (inLane && okSpd) { tow = Math.max(tow, clamp((LANE.x0 - S.x) / (LANE.x0 - LANE.x1), 0, 1)); tangle = Math.max(0, tangle - dt * 8); }
            else if (S.speed >= 9.5) { tangle += dt * 30; }
            else if (started && !inLane) { tangle += dt * 14; }
            if (tangle >= 100) { torn++; armed = false; tow = 0; tangle = 0; left -= 8; ui.banner('⚠ 그물이 엉켰어요!'); snd(c, 'bad'); ui.hint('출발 지점으로 돌아가 다시 투하해요 (시간 -8초)'); }
            else if (tow >= 1) { hauled = true; ui.banner('🎣 양망 준비!'); haulBtn.show(true); ui.hint('엔진을 낮춰 배를 세운 뒤 🎣 양망 버튼을 눌러요'); snd(c, 'ok'); }
          }
        }
        hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); }
        if (left <= 0) end();
      },
      dispose() { hm.dispose(); },
    };
  },
});

/* ═══════════════ 2. 해양경찰학과 — 표류자 구조 출동 ═══════════════ */
registerExperience('kcg', {
  icon: '🚔', title: '해양경찰 함정 · 표류자 구조 출동',
  desc: '122 신고가 들어왔어요! 해양경찰 함정을 몰고 출동해 전복된 어선에서 표류 중인 4명을 안전하게 구조해 보세요.',
  tools: ['🚔 해양경찰 함정', '🧭 방위·거리 지시기', '🛟 구명환 투척'],
  steps: ['2번 선석의 해양경찰 함정을 눌러(또는 ⚓ 버튼) 승선해요', '▲ 로 엔진을 올려 정면 바다로 직진 출항! 화면 위 화살표를 따라 표류자(주황 신호)에게 출동해요', '표류자 22m 안에서 속도를 3노트 이하로 줄이고 🛟 구명환을 던져요', '빠른 속도로 지나가면 파도가 표류자를 밀어요 — 4명을 구한 뒤 구조 후 조치를 판단해요'],
  env: SEA_ENV,
  build(c) {
    const { root, ui } = c;
    const W = setup(c, 'kcg'), ship = W.ship, av = W.av;
    const reefs = [[-82, 128, 6], [-52, 162, 5], [102, 190, 6], [40, 100, 7], [-30, 80, 6], [60, 230, 7], [-30, 210, 6], [8, 150, 5]].map(([x, z, r]) => reef(c, root, x, z, r)).concat(W.port.islands);
    /* 전복된 어선 */
    const bt = new THREE.Group(); bt.position.set(-65, -0.1, 149); bt.rotation.z = 0.35; root.add(bt);
    c.box(5.5, 1.3, 2.2, '#c9ced6', 0, 0, 0, bt); c.box(5.6, 0.2, 0.5, '#d94a3d', 0, -0.7, 0, bt);

    const mkPerson = (x, z) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 8, 18), new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      c.sph(0.3, '#f2c9a0', 0, 0.5, 0, g); c.cyl(0.3, 0.34, 0.42, '#ff7a1a', 0, 0.16, 0, g, 12);
      const arms = new THREE.Group(); arms.position.set(0, 0.4, 0); g.add(arms); c.box(0.12, 0.7, 0.12, '#f2c9a0', 0.42, 0.35, 0, arms); c.box(0.12, 0.7, 0.12, '#f2c9a0', -0.42, 0.35, 0, arms);
      const lamp = c.sph(0.12, '#ff3b30', 0.7, 1.85, 0.3, g); lamp.material.emissive = new THREE.Color('#ff3b30'); lamp.material.emissiveIntensity = 1; c.cyl(0.03, 0.03, 1.8, '#ffffff', 0.7, 0.9, 0.3, g, 6);
      const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 14, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); flare.position.y = 7; g.add(flare);
      return { g, arms, vx: c.rnd(-0.4, 0.4), vz: c.rnd(-0.4, 0.4), state: 'float' };
    };
    const persons = [[-68, 145], [-62, 153], [88, 205], [28, 262]].map(([x, z]) => mkPerson(x, z)), TOTAL = persons.length;
    const gd = guide(c);
    const hm = helm(c, ship, { reefs, walls: W.port.walls });
    const S = hm.S, TOP = new THREE.Vector3(0, 6, 0), RANGE = 22;

    let phase = 'port', left = 130, rescued = 0, mistakes = 0, washCd = 0, hudT = 0, ended = false, lastHint = '', quiz = null, nearD = 0;
    const throws = [];
    const boardBtn = ui.button({ icon: '⚓', label: '승선', size: 92, cls: 'grn', pos: { right: '28px', bottom: '46px' }, down: () => board() }); boardBtn.show(false);
    const rescueBtn = ui.button({ icon: '🛟', label: '구조', size: 88, cls: 'red', pos: { right: '108px', bottom: '70px' }, down: () => rescue() }); rescueBtn.show(false);

    const nearest = () => { let best = null, bd = 1e9; persons.forEach((p) => { if (p.state !== 'float') return; const d = Math.hypot(p.g.position.x - S.x, p.g.position.z - S.z); if (d < bd) { bd = d; best = p; } }); nearD = bd; return best; };
    const hud = () => {
      const n = nearest();
      ui.panel(`<b>🚔 구조 출동</b><br>🧭 선수 ${pad3(headingDeg(S.hdg))}° · 🚢 ${KN(S.speed)}노트<br>⚙ 엔진 ${'▮'.repeat(S.thr)}${'▯'.repeat(3 - S.thr)} ${ENGINE[S.thr]}<br>🆘 구조 ${rescued}/${TOTAL}${n ? ` · 최근접 ${Math.round(nearD)}m` : ''}<br>⚠ 충돌 ${S.hits} · 위험 운항 ${mistakes}`);
    };
    const board = () => {
      if (phase !== 'port') return;
      phase = 'sail'; boardBtn.show(false); rescueBtn.show(true); W.hideTags(); av.group.rotation.y = 0; av.stopWave(); hm.on(true); snd(c, 'go');
      ui.banner('🆘 122 신고 접수! 출동!'); lastHint = ''; hud();
    };
    const rescue = () => {
      if (phase !== 'sail') return; const p = nearest();
      if (!p) { ui.pop('구조할 사람이 없어요', null, '#ffe9a0'); return; }
      if (nearD > RANGE) { ui.pop(`너무 멀어요 (${RANGE}m 이내로)`, ship.position.clone().add(TOP), '#ffe9a0'); return; }
      if (S.speed > 3.2) { mistakes++; snd(c, 'bad'); ui.pop('속도가 너무 빨라요! 3노트 이하로', ship.position.clone().add(TOP), '#ff8a80'); return; }
      p.state = 'thrown'; snd(c, 'swing');
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 8, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })); m.rotation.x = Math.PI / 2; root.add(m);
      throws.push({ m, a: ship.position.clone().setY(6), p, t: 0 });
    };
    const finishAll = (okQuiz) => {
      if (ended) return; ended = true; hm.on(false); gd.hide(); rescueBtn.show(false);
      const rs = (60 * rescued) / TOTAL, tm = rescued === TOTAL ? 15 * clamp(left / 130, 0, 1) : 0, safe = clamp(15 - 5 * mistakes - 4 * S.hits, 0, 15);
      c.finish(rs + tm + safe + (okQuiz ? 10 : 0));
    };
    const report = () => {
      phase = 'report'; hm.on(false); gd.hide(); rescueBtn.show(false); ui.hint(''); ui.banner('🚑 전원 구조 완료!');
      const items = shuffle([['저체온 예방: 젖은 옷을 벗기고 담요로 보온한 뒤, 상황실과 의료기관에 인계한다', true], ['곧장 최고속도로 귀항해, 도착 후에 상태를 확인한다', false], ['구조 기록 사진만 남기고 현장을 철수한다', false]]);
      setTimeout(() => { if (!ended) quiz = ui.ask('📻 구조된 4명이 추위에 떨고 있어요.<br>구조 직후 가장 먼저 할 조치는?', items.map((x) => x[0]), (i) => { finishAll(items[i][1]); }); }, 1500);
    };
    const ambient = (dt, t) => {
      W.ambient(t); W.sea.update(S.x, S.z, t); hm.update(dt, t);
      persons.forEach((p, i) => {
        if (p.state === 'done') return; const g = p.g.position;
        if (p.state === 'float') { g.x += p.vx * dt; g.z += p.vz * dt; p.vx *= 0.995; p.vz *= 0.995; }
        g.y = Math.sin(t * 1.5 + i) * 0.1 - 0.15; p.arms.rotation.z = Math.sin(t * 6 + i) * 0.4;
      });
    };

    return {
      start() { boardBtn.show(true); ui.hint('2번 선석의 해양경찰 함정을 눌러 승선해요! (오른쪽 아래 ⚓ 버튼도 돼요)'); ui.panel('<b>📋 출동 임무</b><br>① 승선·출동<br>② 표류자 4명 구조<br>③ 구조 후 조치 판단'); },
      down() {
        if (phase !== 'port') return; const h = c.pick(Object.values(W.ships)); if (!h) return; const k = W.which(h.object);
        if (k === 'kcg') board(); else if (k) ui.pop(k === 'sae' ? '실습선은 해양생산관리학과 체험에서 타요' : '항만 작업선이에요', h.point, '#ffe9a0');
      },
      key(code) {
        if (phase === 'port') { if (code === 'KeyE' || code === 'Enter' || code === 'Space') board(); return; }
        if (code === 'KeyW' || code === 'ArrowUp') hm.step(1); else if (code === 'KeyS' || code === 'ArrowDown') hm.step(-1); else if (code === 'KeyE' || code === 'Space') rescue();
      },
      idle(dt, t) { ambient(dt, t); portCam(c, t); },
      update(dt, t) {
        ambient(dt, t);
        if (phase === 'port') { portCam(c, t); return; }
        if (ended) return;
        if (phase === 'sail') {
          left -= dt; ui.timer(left); hm.chase(); washCd = Math.max(0, washCd - dt);
          const n = nearest();
          if (n) {
            const dx = n.g.position.x - S.x, dz = n.g.position.z - S.z;
            gd.set(wrapA(Math.atan2(dx, dz) - S.hdg), `표류자 ${Math.round(nearD)}m · 방위 ${pad3(bearingDeg(dx, dz))}°`);
            const hint = nearD <= RANGE ? (S.speed <= 3.2 ? '🛟 구조 가능! 구조 버튼을 눌러요' : '속도를 3노트 이하로 줄여요 (▼)') : (S.thr === 0 && S.z < 20 ? '▲ 엔진을 올려 정면 바다로 직진 출항!' : '화살표 방향의 주황 신호를 향해 출동!');
            if (hint !== lastHint) { lastHint = hint; ui.hint(hint); }
          }
          persons.forEach((p) => {   /* 고속 접근 시 항적 파도가 표류자를 밀어요 */
            if (p.state !== 'float') return; const dx = p.g.position.x - S.x, dz = p.g.position.z - S.z, d = Math.hypot(dx, dz) || 1;
            if (S.speed > 5.5 && d < 16) { p.vx += (dx / d) * 1.2 * dt * S.speed * 0.2; p.vz += (dz / d) * 1.2 * dt * S.speed * 0.2; if (washCd <= 0) { washCd = 2.5; mistakes++; snd(c, 'bad'); ui.pop('⚠ 파도가 표류자를 밀어요! 감속', p.g.position, '#ff8a80'); } }
          });
          for (let i = throws.length - 1; i >= 0; i--) {
            const T = throws[i]; T.t += dt / 0.8; const k = Math.min(1, T.t), b = T.p.g.position;
            T.m.position.set(T.a.x + (b.x - T.a.x) * k, T.a.y + (0.3 - T.a.y) * k + Math.sin(k * Math.PI) * 5, T.a.z + (b.z - T.a.z) * k); T.m.rotation.z += dt * 8;
            if (T.t >= 1) { root.remove(T.m); T.m.geometry.dispose(); T.p.state = 'done'; T.p.g.visible = false; rescued++; snd(c, 'ok'); ui.pop(`🛟 구조 ${rescued}/${TOTAL}`, b, '#a0ffb8'); throws.splice(i, 1); lastHint = ''; if (rescued >= TOTAL) report(); }
          }
          hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); }
          if (left <= 0 && phase === 'sail') finishAll(false);
        }
      },
      dispose() { hm.dispose(); },
    };
  },
});