/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng1.js (신규, E2-1 앞부분) — 공학대학 조립·시공 체험
 *   mde : 기계설계공학과  → 기어 감속기 설계·조립 → 직결/감속 비교 시운전
 *   mse : 기계시스템공학과 → 자동차 엔진 조립 → 4행정 점화 타이밍 시동
 *   arc : 건축디자인학과   → 기둥·보·슬래브 시공 → 지진 진동 시험
 * (냉동공조 rac, 스마트응용설계 sad 는 다음 파일에서 이어집니다)
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp } from './experience.js';
import { assembler, gear, link, pipe, glassBox, snd } from './exp-kit.js';

const SHOP = { sky: '#cfd8e3', fog: ['#cfd8e3', 40, 120], sunColor: '#ffffff', sunI: 1.4, hemi: ['#eef4ff', '#8c97a8', 0.95], sunPos: [20, 40, 25] };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ───────────────────────── 1. 기계설계공학과 · 기어 감속기 ───────────────────────── */
registerExperience('mde', {
  icon: '⚙️', title: '기어 감속기 설계·조립',
  desc: '모터의 힘을 기어로 바꿔 무거운 상자를 끌어당기는 감속기를 조립하고, 감속기와 직결 구동의 차이를 직접 비교해 보세요.',
  tools: ['⚙️ 모터·기어·드럼 5종', '📊 시운전 계측기'],
  steps: ['흩어진 부품을 끌어서 흰 그림자 위에 맞춰 놓아요 (5개)', '조립이 끝나면 ⚡ 버튼을 누르고 있는 동안 모터가 돌아요', '⚙ 감속기 / 🔗 직결을 바꿔 가며 차이를 비교해요', '300kg 상자를 초록 선까지 끌어당기면 성공!'],
  env: SHOP,
  build(c) {
    const { root, ui, cam } = c;
    const START = 6.8, END = 2.7, AX = -0.6, PX = -3.2, MX = -5.5;
    let phase = 'asm', direct = false, tried = false, prog = 0, left = 50, acc = 0, tt = 0, ended = false;

    c.ground('#8a929d', 40, -0.5); c.box(22, 0.5, 11, '#e1e5ea', 0, -0.25, 0);
    c.cyl(0.18, 0.18, 1.5, '#9aa3ad', PX, 0.75, 0); c.cyl(0.18, 0.18, 2.4, '#9aa3ad', AX, 1.2, 0);
    const goal = c.box(0.12, 0.03, 2.6, '#3cd17a', END - 0.8, 0.02, 0); goal.visible = false;
    const crate = new THREE.Group(); c.box(1.6, 1.2, 1.6, '#c98a4b', 0, 0.6, 0, crate); c.box(1.64, 0.18, 1.64, '#e8d9b5', 0, 0.6, 0, crate);
    crate.position.set(START, 0, 0); crate.visible = false; root.add(crate);
    const rope = pipe(root, 0.06, '#caa56a'); rope.visible = false;
    const A = V3(AX + 0.75, 1.7, 0), B = V3(0, 1.1, 0);

    const mk = {
      motor() {
        const g = new THREE.Group();
        c.box(2.2, 1.6, 1.6, '#e0533d', 0, 0.8, 0, g); c.box(2.3, 0.2, 1.7, '#9b2f22', 0, 0.1, 0, g);
        const n = c.cyl(0.2, 0.2, 0.9, '#d8dde6', 1.5, 0.9, 0, g, 12); n.rotation.z = Math.PI / 2;
        const led = c.sph(0.1, '#3cd17a', -0.6, 1.68, 0, g); led.material = new THREE.MeshBasicMaterial({ color: '#3cd17a' });
        g.userData.led = led; return g;
      },
      pinion() { const g = new THREE.Group(); g.userData.spin = gear(c, 0.8, 10, '#f2b84b', 0.25, g); return g; },
      big() { const g = new THREE.Group(); g.userData.spin = gear(c, 1.6, 20, '#47b5a2', 0.25, g); return g; },
      drum() {
        const g = new THREE.Group(), s = new THREE.Group(); g.add(s); g.userData.spin = s;
        c.cyl(0.75, 0.75, 1.0, '#e8e2d2', 0, 0.5, 0, s, 24); c.cyl(1.0, 1.0, 0.1, '#2f8f80', 0, 0.05, 0, s, 24); c.cyl(1.0, 1.0, 0.1, '#2f8f80', 0, 0.95, 0, s, 24);
        c.box(0.1, 0.9, 0.28, '#d6453d', 0.76, 0.5, 0, s); return g;
      },
      grease() { const g = new THREE.Group(); c.cyl(0.42, 0.42, 0.8, '#e8b92f', 0, 0.4, 0, g, 16); c.cyl(0.44, 0.44, 0.2, '#d6453d', 0, 0.9, 0, g, 16); c.box(0.5, 0.3, 0.05, '#ffffff', 0, 0.42, 0.42, g); return g; },
    };

    const asm = assembler(c, {
      title: '⚙️ 감속기 부품', limit: { x: [-9, 9], z: [-4.5, 5.2] },
      parts: [
        { kind: 'motor', name: '모터', hint: '동력을 만들어 내요. 축이 기어 쪽을 향해요', make: mk.motor, slot: [MX, 0, 0], rest: [-7.0, 3.8], r: 1.8 },
        { kind: 'pinion', name: '소기어', hint: '모터 축에 연결되는 작은 톱니바퀴(입력)', make: mk.pinion, slot: [PX, 0.65, 0], rest: [-4.2, 3.8], r: 1.5 },
        { kind: 'big', name: '대기어', hint: '소기어와 맞물려 속도를 줄이고 힘을 키워요', make: mk.big, slot: [AX, 0.65, 0], rest: [-1.0, 3.8], r: 1.7 },
        { kind: 'drum', name: '출력 드럼', hint: '대기어 위에 얹어 밧줄을 감아요', make: mk.drum, slot: [AX, 1.2, 0], rest: [2.4, 3.8], r: 1.3 },
        { kind: 'grease', name: '윤활유', hint: '기어가 맞물리는 곳에 발라 마찰·마모를 줄여요', make: mk.grease, slot: [-2.4, 0, 1.9], rest: [5.2, 3.6], r: 1.1 },
      ],
      onComplete() { phase = 'trans'; tt = 0; asm.lock(true); ui.hint('조립 완료! 시운전을 준비해요…'); snd(c, 'win'); },
    });

    const motor = asm.items[0].g, led = motor.userData.led;
    const spin = (i) => asm.items[i].g.userData.spin;

    const go = ui.button({ icon: '⚡', label: '시동(누르는 동안)', size: 92, cls: 'grn', pos: { right: '30px', bottom: '50px' } });
    const bGear = ui.button({ icon: '⚙', label: '감속기', size: 64, pos: { right: '150px', bottom: '70px' }, down: () => { direct = false; showPanel(); } });
    const bDir = ui.button({ icon: '🔗', label: '직결', size: 64, pos: { right: '230px', bottom: '70px' }, down: () => { direct = true; showPanel(); } });
    [go, bGear, bDir].forEach((b) => b.show(false));

    const showPanel = () => {
      ui.panel('<b>📊 시운전 계측</b><br>구동: ' + (direct ? '🔗 <b>직결</b>(감속 없음)' : '⚙ <b>감속기 2:1</b>') +
        '<br>입력 1500rpm → 출력 ' + (direct ? '<span style="color:#ff8a80">정지(과부하)</span>' : '750rpm') +
        '<br>토크 ' + (direct ? '×1 — 300kg 상자엔 부족' : '×2 — 끌 수 있어요') +
        '<br>진행 ' + Math.round(prog * 100) + '%' + (tried ? '' : '<br><small>💡 🔗 직결로도 시험해 보면 보너스!</small>'));
    };
    const startTest = () => {
      phase = 'test'; [crate, rope, goal].forEach((o) => { o.visible = true; }); [go, bGear, bDir].forEach((b) => b.show(true));
      cam.to([1.0, 10.5, 11.5], [1.2, 0.8, 0]); ui.timer(left);
      ui.hint('⚡를 누르고 있으면 모터가 돌아요. 상자를 초록 선까지 끌어요!'); showPanel();
    };
    const end = (win) => {
      if (ended) return; ended = true;
      const score = 25 - Math.min(15, asm.miss * 5) + (win ? 55 + clamp(left / 5, 0, 10) : prog * 35) + (tried ? 10 : 0);
      ui.hint(win ? '🎉 300kg 상자를 끌어냈어요!' : '⏱ 시간 종료'); c.finish(Math.round(score));
    };

    cam.set([-0.8, 11, 12], [-0.8, 0.5, 0]); cam.fov(50, true);
    return {
      start() { asm.panel(); ui.hint('부품을 끌어서 흰 그림자에 맞춰요'); },
      down(p) { asm.down(p); }, move(p) { asm.move(p); }, up() { asm.up(); },
      idle(dt, t) { asm.pulse(t); },
      update(dt, t) {
        asm.pulse(t);
        if (phase === 'trans') { tt += dt; if (tt > 1.2) startTest(); return; }
        if (phase !== 'test' || ended) return;
        left -= dt; ui.timer(left);
        const run = go.held() || c.keys.has('Space'), stall = run && direct;
        if (run && !direct) {
          const w = 7 * dt; spin(1).rotation.y += w; spin(2).rotation.y -= w * 0.5; spin(3).rotation.y -= w * 0.5;
          prog = Math.min(1, prog + 0.05 * dt);
        }
        if (stall) tried = true;
        motor.position.x = MX + (stall ? (Math.random() - 0.5) * 0.07 : 0);
        led.material.color.set(stall ? '#ff4d4d' : (run ? '#ffd24d' : '#3cd17a'));
        crate.position.x = START - prog * (START - END); B.set(crate.position.x - 0.8, 1.1, 0); link(rope, A, B);
        acc += dt; if (acc > 0.2) { acc = 0; showPanel(); }
        if (prog >= 1) end(true); else if (left <= 0) end(false);
      },
    };
  },
});

/* ───────────────────────── 2. 기계시스템공학과 · 엔진 조립 → 4행정 시동 ───────────────────────── */
registerExperience('mse', {
  icon: '🚗', title: '자동차 엔진 조립·시동',
  desc: '엔진 부품을 알맞은 위치에 조립한 뒤, 4행정 사이클을 보며 정확한 타이밍에 점화해 시동을 걸어 보세요.',
  tools: ['🔩 엔진 부품 6종', '⚡ 점화 스위치'],
  steps: ['부품을 끌어서 흰 그림자 위에 맞춰 놓아요 (6개)', '조립이 끝나면 스타터가 엔진을 천천히 돌려요', '행정 표시를 보고 "압축 끝"에 ⚡ 점화!', '3번 성공하면 시동이 걸려요'],
  env: SHOP,
  build(c) {
    const { root, ui, cam } = c;
    const CX = -4.2, R = 0.55, L = 3.0, NAMES = ['흡입', '압축', '폭발', '배기'];
    let phase = 'asm', th = 0, w = 2.6, succ = 0, fails = 0, left = 70, running = false, runT = 0, flashT = 0, tt = 0, ended = false, sig = '';

    c.ground('#8a929d', 40, -0.5); c.box(24, 0.5, 11, '#e1e5ea', -1, -0.25, 0);
    glassBox(root, 3.0, 1.9, 3.2, CX, 0.95, 0); glassBox(root, 3.1, 1.9, 1.9, -1.35, 0.95, 0);
    c.box(1.8, 2.0, 3.0, '#5f6b7a', 1.1, 1.0, 0);
    const boom = c.sph(0.55, '#ffb347', 0.0, 0.9, 0); boom.visible = false;
    boom.material.emissive = new THREE.Color('#ff8a1f'); boom.material.emissiveIntensity = 1;

    const mk = {
      crank() {
        const g = new THREE.Group(), s = new THREE.Group(); g.add(s); g.userData.spin = s;
        c.cyl(0.28, 0.28, 1.7, '#9aa3ad', 0, 0.9, 0, s, 14); c.cyl(0.9, 0.9, 0.16, '#6f7a88', 0, 0.45, 0, s, 24); c.cyl(0.9, 0.9, 0.16, '#6f7a88', 0, 1.35, 0, s, 24);
        c.cyl(0.2, 0.2, 0.95, '#e0533d', R, 0.9, 0, s, 12); c.box(0.9, 0.2, 0.5, '#4b5563', -0.55, 0.45, 0, s); return g;
      },
      rod() { const g = new THREE.Group(); c.box(3.0, 0.28, 0.4, '#c8cdd6', 0, 0.2, 0, g); c.cyl(0.36, 0.36, 0.34, '#e0533d', -1.5, 0.2, 0, g, 16); c.cyl(0.3, 0.3, 0.34, '#e0533d', 1.5, 0.2, 0, g, 16); return g; },
      piston() { const g = new THREE.Group(); c.box(1.0, 1.2, 1.5, '#aab2bd', 0, 0.6, 0, g); c.box(0.08, 1.22, 1.54, '#2b2f3a', 0.3, 0.6, 0, g); c.box(0.08, 1.22, 1.54, '#2b2f3a', 0.42, 0.6, 0, g); return g; },
      plug() { const g = new THREE.Group(); c.box(0.5, 0.25, 0.5, '#9aa3ad', 0, 0.12, 0, g); c.cyl(0.2, 0.2, 0.9, '#f1f1f1', 0, 0.7, 0, g, 12); c.cyl(0.08, 0.08, 0.4, '#d6453d', 0, 1.35, 0, g, 8); return g; },
      valve(col) { return () => { const g = new THREE.Group(); c.cyl(0.09, 0.09, 1.5, '#cfd6df', 0, 0.75, 0, g, 8); c.cyl(0.42, 0.42, 0.12, col, 0, 0.06, 0, g, 18); c.cyl(0.26, 0.26, 0.7, col, 0, 0.5, 0, g, 12); return g; }; },
    };
    const SZ = { x: [-9.5, 8.5], z: [-4.5, 5.2] };
    const asm = assembler(c, {
      title: '🚗 엔진 부품', limit: SZ,
      parts: [
        { kind: 'crank', name: '크랭크축', hint: '피스톤의 직선운동을 회전운동으로 바꿔요', make: mk.crank, slot: [CX, 0, 0], rest: [-8.2, 3.8], r: 1.5 },
        { kind: 'rod', name: '커넥팅로드', hint: '피스톤과 크랭크축을 연결해요', make: mk.rod, slot: [CX + R + L / 2, 0.7, 0], rest: [-5.0, 3.8], r: 1.0 },
        { kind: 'piston', name: '피스톤', hint: '폭발 힘을 받아 앞뒤로 움직여요', make: mk.piston, slot: [CX + R + L, 0, 0], rest: [-1.8, 3.8], r: 1.0 },
        { kind: 'plug', name: '점화플러그', hint: '연료에 불꽃을 튀겨 폭발시켜요', make: mk.plug, slot: [1.1, 2.0, 0], rest: [0.8, 3.8], r: 0.7 },
        { kind: 'intake', name: '흡기밸브', hint: '신선한 공기·연료를 들여보내요', make: mk.valve('#47b5a2'), slot: [1.1, 2.0, -1.0], rest: [3.0, 3.8], r: 0.7 },
        { kind: 'exhaust', name: '배기밸브', hint: '탄 가스를 내보내요', make: mk.valve('#c06bd8'), slot: [1.1, 2.0, 1.0], rest: [5.2, 3.8], r: 0.7 },
      ],
      onComplete() { phase = 'trans'; tt = 0; asm.lock(true); ui.hint('조립 완료! 스타터를 돌려요…'); snd(c, 'win'); },
    });
    const crank = () => asm.items[0].g, rod = () => asm.items[1].g, pis = () => asm.items[2].g, inV = () => asm.items[4].g, exV = () => asm.items[5].g;

    const ign = ui.button({ icon: '⚡', label: '점화!', size: 96, cls: 'red', pos: { right: '30px', bottom: '50px' }, down: () => ignite() }); ign.show(false);

    const pose = () => {
      const a = th % (Math.PI * 2), px = CX + R * Math.cos(a), pz = R * Math.sin(a), xp = px + Math.sqrt(L * L - pz * pz);
      crank().userData.spin.rotation.y = -a;
      pis().position.set(xp, 0, 0);
      rod().position.set((px + xp) / 2, 0.7, pz / 2); rod().rotation.y = Math.atan2(pz, xp - px);
      boom.position.x = (xp + 0.7) / 2;
      const s = Math.floor((th % (Math.PI * 4)) / Math.PI);
      inV().position.y = 2.0 + (s === 0 ? 0.3 : 0); exV().position.y = 2.0 + (s === 3 ? 0.3 : 0);
      return s;
    };
    const end = (win) => {
      if (ended) return; ended = true;
      const score = 30 - Math.min(15, asm.miss * 5) + (win ? 55 + Math.max(0, 15 - fails * 3) : succ * 15);
      ui.hint(win ? '🎉 시동 걸림!' : '⏱ 시간 종료'); c.finish(Math.round(score));
    };
    function ignite() {
      if (phase !== 'test' || ended || running) return;
      const cyc = th % (Math.PI * 4), d = cyc - Math.PI * 2, s = Math.floor(cyc / Math.PI);
      if (Math.abs(d) <= 0.3) {
        succ++; flashT = 0.25; snd(c, 'ok'); ui.pop('🔥 점화 성공!', V3(1.1, 3.2, 0), '#ffd24d');
        if (succ >= 3) { running = true; runT = 0; ui.hint('엔진이 스스로 돌기 시작해요!'); }
      } else {
        fails++; snd(c, 'bad');
        const msg = s === 1 ? '너무 일러요! 아직 덜 압축됐어요(노킹)' : s === 2 ? '너무 늦었어요! 이미 내려가고 있어요' : `지금은 ${NAMES[s]} 행정이에요`;
        ui.pop(msg, V3(1.1, 3.2, 0), '#ff8a80');
      }
    }
    const refresh = (s) => {
      const cyc = th % (Math.PI * 4), d = cyc - Math.PI * 2, now = Math.abs(d) <= 0.3, near = s === 1 && d > -0.9 && !now;
      const k = `${s}|${now ? 2 : near ? 1 : 0}|${succ}|${fails}|${running}`; if (k === sig) return; sig = k;
      ui.panel('<b>🚗 4행정 시동</b><br>' + NAMES.map((n, i) => (i === s ? `<b style="color:#ffd24d">▶${n}</b>` : `<span style="opacity:.55">${n}</span>`)).join(' · ') +
        '<br>' + (running ? '🎉 <b>시동 걸림!</b>' : now ? '🟢 <b>지금!</b>' : near ? '🟡 곧 압축 끝…' : '⚪ 기다려요') +
        `<br>점화 성공 ${succ}/3 · 실패 ${fails}<br><small>피스톤이 헤드 쪽 끝에 닿는 순간(압축 끝)에 점화!</small>`);
    };

    cam.set([-1.5, 11.5, 12], [-1.5, 0.6, 0.3]); cam.fov(50, true);
    return {
      start() { asm.panel(); ui.hint('부품을 끌어서 흰 그림자에 맞춰요'); },
      down(p) { asm.down(p); }, move(p) { asm.move(p); }, up() { asm.up(); },
      key(code) { if (code === 'Space' || code === 'Enter') ignite(); },
      idle(dt, t) { asm.pulse(t); },
      update(dt, t) {
        asm.pulse(t);
        if (phase === 'trans') { tt += dt; if (tt > 1.2) { phase = 'test'; ign.show(true); cam.to([-1.5, 10.5, 10.5], [-1.5, 0.8, 0.2]); ui.timer(left); ui.hint('압축이 끝나는 순간에 ⚡ 점화!'); } return; }
        if (phase !== 'test') return;
        if (!ended) { left -= dt; ui.timer(left); }
        if (running) { w += (14 - w) * Math.min(1, dt * 2); runT += dt; if (runT > 3.2) end(true); }
        th += w * dt; const s = pose();
        if (flashT > 0) flashT -= dt;
        boom.visible = flashT > 0 || (running && s === 2);
        refresh(s);
        if (!ended && !running && left <= 0) end(false);
      },
    };
  },
});

/* ───────────────────────── 3. 건축디자인학과 · 시공 → 지진 시험 ───────────────────────── */
registerExperience('arc', {
  icon: '🏛️', title: '건축 시공 & 내진 시험',
  desc: '기초 위에 기둥·보·바닥을 차례로 세워 건물을 짓고, 진동 시험대에서 얼마나 튼튼한지 확인해 보세요.',
  tools: ['🏗 구조 부재(기둥·보·슬래브)', '🔶 X 가새(내진 보강재)', '🌋 진동 시험대'],
  steps: ['기둥 4개를 노란 표시 위에 세워요', '보 2개를 기둥 위에, 바닥 슬래브를 맨 위에 얹어요', '빈 곳을 드래그하거나 ◀ ▶ 버튼으로 화면을 돌려 가며 맞춰요', '옆면에 X 가새를 달면 더 튼튼해져요 (선택)', '✔ 시공 완료 → 진도 8까지 버텨 보세요'],
  env: { sky: '#bfe3ff', fog: ['#d6ecff', 60, 160], sunColor: '#fff4e0', sunI: 1.6, hemi: ['#dff1ff', '#8aa07a', 0.95], sunPos: [30, 50, 25] },
  build(c) {
    const { root, ui, cam } = c;
    let phase = 'build', I = 0, imax = 0, tol = 4.5, braces = 0, collapsed = false, ending = 0, ended = false, acc = 0, score = 0;
    c.ground('#9cc27f', 45, -0.3); c.box(8.6, 0.3, 6.4, '#8d9399', 0, -0.13, 0);
    [[-3, -2], [3, -2], [-3, 2], [3, 2]].forEach(([x, z]) => c.box(1.0, 0.03, 1.0, '#f2c94c', x, 0.03, z));
    const bld = new THREE.Group(); root.add(bld);

    const mk = {
      col() { const g = new THREE.Group(); c.box(0.55, 3.0, 0.55, '#cfc8bb', 0, 1.5, 0, g); return g; },
      beam() { const g = new THREE.Group(); c.box(6.6, 0.32, 0.5, '#b5ada0', 0, 0.16, 0, g); return g; },
      slab() { const g = new THREE.Group(); c.box(7.0, 0.3, 5.0, '#9fb2c8', 0, 0.15, 0, g); return g; },
      brace() { const g = new THREE.Group(); [-1, 1].forEach((k) => { const b = c.box(0.14, 0.14, 4.83, '#e0533d', 0, 1.65, 0, g); b.rotation.x = k * 0.594; }); return g; },
    };
    const col = (x, z, rx, rz) => ({ kind: 'col', name: '기둥', hint: '건물의 무게를 땅으로 전달해요', make: mk.col, slot: [x, 0, z], rest: [rx, rz], r: 1.0 });
    const beam = (z, rz) => ({ kind: 'beam', name: '보', hint: '기둥과 기둥을 이어 바닥 무게를 받쳐요', make: mk.beam, slot: [0, 3.0, z], rest: [0, rz], r: 1.6 });
    const brace = (x, rx, rz) => ({ kind: 'brace', name: 'X 가새', hint: '지진·바람의 옆힘을 막아 줘요 (선택)', make: mk.brace, slot: [x, 0, 0], rest: [rx, rz], r: 1.3, opt: true });

    const asm = assembler(c, {
      title: '🏗 시공 부재', parent: bld, limit: { x: [-12, 12], z: [-7, 5.5] },
      note: '기둥 → 보 → 슬래브 순서로! X 가새는 선택이에요',
      parts: [
        col(-3, -2, -8, -3.6), col(3, -2, -8, -1.2), col(-3, 2, -8, 1.2), col(3, 2, -8, 3.6),
        beam(-2, -5.6), beam(2, 5.0),
        { kind: 'slab', name: '바닥 슬래브', hint: '사람·가구의 무게를 받는 바닥판', make: mk.slab, slot: [0, 3.32, 0], rest: [9.5, 0], r: 2.2 },
        brace(-3, 9.2, -5.5), brace(3, 9.2, 5.0),
      ],
      onComplete() { ok.show(true); snd(c, 'win'); ui.hint('시공 완료! X 가새를 더 달아도 되고, 준비되면 ✔ 를 눌러요'); },
    });
    const ok = ui.button({ icon: '✔', label: '시공 완료·지진 시험', size: 92, cls: 'grn', pos: { right: '30px', bottom: '50px' }, down: () => startQuake() }); ok.show(false);

    /* ── 시점 돌리기(조립 중): 빈 곳 드래그 · ◀ ▶ 버튼(누르는 동안) · Q/E 키 · 🔝 위에서 보기 ── */
    const V = { yaw: 0, pitch: 0.65, cur: 0.65, dist: 19, top: false, drag: false }, TGT = [0, 1.5, 0];
    const vL = ui.button({ icon: '◀', label: '돌리기', size: 58, pos: { left: '16px', bottom: '70px' } });
    const vR = ui.button({ icon: '▶', label: '돌리기', size: 58, pos: { left: '82px', bottom: '70px' } });
    const vT = ui.button({ icon: '🔝', label: '위에서', size: 58, pos: { left: '148px', bottom: '70px' }, down: () => { V.top = !V.top; vT.label(V.top ? '옆에서' : '위에서'); } });
    const views = [vL, vR, vT]; views.forEach((b) => b.show(false));
    const orbit = (dt) => {
      if (phase !== 'build') return;
      const k = c.keys, turn = ((vR.held() || k.has('KeyE')) ? 1 : 0) - ((vL.held() || k.has('KeyQ')) ? 1 : 0);
      V.yaw += turn * 1.6 * dt; V.cur += ((V.top ? 1.38 : V.pitch) - V.cur) * Math.min(1, 8 * dt);
      const cp = Math.cos(V.cur), sp = Math.sin(V.cur);
      cam.set([TGT[0] + Math.sin(V.yaw) * cp * V.dist, TGT[1] + sp * V.dist, TGT[2] + Math.cos(V.yaw) * cp * V.dist], TGT);
    };
    /* 누른 곳에 부재가 있으면 끌기, 빈 곳이면 화면 회전 */
    const onPart = () => {
      if (c.pick(asm.items.map((q) => q.g))) return true;
      const pt = c.at(1.0); if (!pt) return false; const w = new THREE.Vector3();
      return asm.items.some((q) => { q.g.getWorldPosition(w); return Math.hypot(w.x - pt.x, w.z - pt.z) < 1.6; });
    };
    const placed = () => asm.items.filter((q) => q.slot >= 0);

    function startQuake() {
      if (phase !== 'build' || !asm.complete()) return;
      phase = 'quake'; asm.lock(true); ok.show(false); views.forEach((b) => b.show(false)); V.drag = false;
      braces = asm.items.filter((q) => q.kind === 'brace' && q.slot >= 0).length; tol = 4.5 + 2 * braces;
      cam.to([7, 8, 14], [0, 2, 0]); ui.hint('🌋 진동 시험 시작! 진도가 점점 커져요');
    }
    const showPanel = () => ui.panel(`<b>🌋 진동 시험</b><br>진도 <b>${I.toFixed(1)}</b> / 8<br>X 가새 ${braces}개` + (collapsed ? '<br><span style="color:#ff8a80">💥 붕괴!</span>' : ''));
    const finishQuake = (win) => {
      if (ended) return; ended = true; ending = 2.2; imax = win ? 8 : Math.min(8, imax);
      score = 30 - Math.min(15, asm.miss * 5) + 70 * Math.min(1, imax / 8);
      ui.hint(win ? '🎉 진도 8을 버텼어요!' : `💥 진도 ${imax.toFixed(1)}에서 무너졌어요`); showPanel();
    };

    orbit(0); cam.fov(50, true);
    return {
      start() { views.forEach((b) => b.show(true)); asm.panel(); ui.hint('기둥 4개를 노란 표시 위에 세워요 · 빈 곳을 드래그하면 화면이 돌아가요'); },
      down(p) { if (phase === 'build' && !onPart()) { V.drag = true; return; } asm.down(p); },
      move(p) { if (V.drag) { if (p.down) { V.yaw -= p.dx * 0.008; V.pitch = clamp(V.pitch + p.dy * 0.004, 0.3, 1.3); if (V.top) { V.top = false; vT.label('위에서'); } } return; } asm.move(p); },
      up() { if (V.drag) { V.drag = false; return; } asm.up(); },
      idle(dt, t) { asm.pulse(t); orbit(dt); },
      update(dt, t) {
        asm.pulse(t); orbit(dt);
        if (phase !== 'quake') return;
        if (ended) { ending -= dt; if (collapsed) fall(dt); if (ending <= 0 && ending > -50) { ending = -99; c.finish(Math.round(score)); } return; }
        I = Math.min(8, I + dt * 0.4); imax = I;
        const sway = 1 - 0.18 * braces;
        bld.position.x = Math.sin(t * 28) * 0.04 * (I / 8) * sway; bld.rotation.z = Math.sin(t * 9) * 0.012 * I * sway;
        acc += dt; if (acc > 0.15) { acc = 0; showPanel(); }
        if (I >= tol) {
          collapsed = true; imax = tol; I = tol; bld.position.x = 0; bld.rotation.z = 0;
          placed().forEach((q) => { q.vy = 0; q.vx = (Math.random() - 0.5) * 3; q.rz = (Math.random() - 0.5) * 3; q.rx = (Math.random() - 0.5) * 2; });
          snd(c, 'bad'); finishQuake(false);
        } else if (I >= 8) { bld.position.x = 0; bld.rotation.z = 0; snd(c, 'win'); finishQuake(true); }
      },
    };
    function fall(dt) {
      placed().forEach((q) => {
        const g = q.g; q.vy -= 14 * dt; g.position.y += q.vy * dt;
        if (g.position.y > 0.02) { g.position.x += q.vx * dt; g.rotation.z += q.rz * dt; g.rotation.x += q.rx * dt; } else { g.position.y = 0; q.vy = 0; }
      });
    }
  },
});