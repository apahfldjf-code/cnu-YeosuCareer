/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng1.js (신규, E2-1 앞부분) — 공학대학 조립·시공 체험
 *   mde : 기계설계공학과  → 기어 감속기 설계·조립 → 직결/감속 비교 시운전
 *   mse : 기계시스템공학과 → 자동차 엔진 조립 → 4행정 점화 타이밍 시동
 *   arc : 건축디자인학과   → 스케치 → 건축물 자동 생성 → 청사진(정면도·평면도)
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


/* ═══════════════ 3. 건축디자인학과 · 스케치 → 건축물 생성 → 청사진 ═══════════════
 * ① 캔버스에 건물 모양을 간단히 그리면
 * ② analyzeSketch() 가 윤곽(실루엣)·세로선·작은 네모 등을 읽어 건축 유형을 판별하고
 * ③ buildPrims() 가 유형에 맞는 부재 목록(prims)을 만들며
 * ④ 같은 prims 로 3D 모델(Three.js)과 청사진(2D 도면)을 함께 그려요 → 모델과 도면이 항상 일치!
 * ─────────────────────────────────────────────────────────────── */
const ARC_GN = 32; // 윤곽을 읽는 격자 해상도
const ARC_KINDS = {
  house: { name: '박공지붕 주택', icon: '🏠' },
  dome: { name: '돔 지붕 건축물', icon: '🕌' },
  tower: { name: '고층 타워', icon: '🏢' },
  stepped: { name: '계단식 단탑 건축', icon: '🏯' },
  temple: { name: '열주 신전', icon: '🏛️' },
  composite: { name: '복합 매스 빌딩', icon: '🏙️' },
  box: { name: '모던 박스 건물', icon: '🏬' },
};
const arcMed3 = (a) => a.map((v, i) => [a[Math.max(0, i - 1)], v, a[Math.min(a.length - 1, i + 1)]].sort((p, q) => p - q)[1]);
const arcWin = (a, r, f) => a.map((_, i) => f(...a.slice(Math.max(0, i - r), Math.min(a.length, i + r + 1))));
const arcOpen = (a, r) => arcWin(arcWin(a, r, Math.min), r, Math.max); // 폭 좁은 돌기(피뇨·안테나 등) 제거
const arcAvg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/** strokes: [[{x,y}...]...] (캔버스 좌표, y 아래로 증가) → 건축 해석 결과 또는 null */
function analyzeSketch(strokes) {
  const pts = strokes.flat();
  if (strokes.length < 1 || pts.length < 8) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 60 || bh < 60) return null;

  /* 1) 잉크를 격자에 옮기고, 열(column)마다 가장 높은 곳 = 윤곽(실루엣) 높이를 구해요 */
  const GN = ARC_GN, cw = bw / GN, ch = bh / GN;
  const grid = Array.from({ length: GN }, () => new Uint8Array(GN));
  const put = (x, y) => { const gx = clamp(Math.floor((x - x0) / cw), 0, GN - 1), gy = clamp(Math.floor((y1 - y) / ch), 0, GN - 1); grid[gx][gy] = 1; };
  for (const s of strokes) {
    for (let i = 0; i < s.length; i++) {
      put(s[i].x, s[i].y);
      if (i) { const a = s[i - 1], b = s[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (Math.min(cw, ch) * 0.5)); for (let k = 1; k < n; k++) put(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n); }
    }
  }
  let prof = [];
  for (let gx = 0; gx < GN; gx++) { let top = -1; for (let gy = GN - 1; gy >= 0; gy--) if (grid[gx][gy]) { top = gy; break; } prof.push(top < 0 ? 0 : (top + 1) / GN); }
  prof = arcMed3(prof);
  const act = prof.map((v) => v > 0.12), a = act.indexOf(true), b = act.lastIndexOf(true);
  if (a < 0 || b - a < 3) return null;
  let P = prof.slice(a, b + 1);
  const n = P.length, peak0 = Math.max(...P), bwB = (n / GN) * bw; // 건물이 차지하는 실제 폭(px)
  P = P.map((v) => v / peak0);
  const aspect = clamp((peak0 * bh) / bwB, 0.35, 5);

  /* 2) 획(stroke) 하나하나의 성격: 세로선 / 가로선 / 작은 닫힌 도형(창문) */
  const info = strokes.map((s) => {
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity, len = 0;
    s.forEach((p, i) => { if (p.x < sx0) sx0 = p.x; if (p.x > sx1) sx1 = p.x; if (p.y < sy0) sy0 = p.y; if (p.y > sy1) sy1 = p.y; if (i) len += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y); });
    const ends = Math.hypot(s[0].x - s[s.length - 1].x, s[0].y - s[s.length - 1].y);
    return { w: sx1 - sx0, h: sy1 - sy0, len, closed: len > 24 && ends < 0.18 * len, cy: (y1 - (sy0 + sy1) / 2) / bh, cx: (sx0 + sx1) / 2, cyP: (sy0 + sy1) / 2, sy1 };
  });
  const isV = (s) => !s.closed && s.h > 0.25 * bh && s.w < 0.25 * s.h && s.len < 1.35 * s.h;
  const isH = (s) => !s.closed && s.w > 0.45 * bwB && s.h < 0.2 * s.w && s.len < 1.35 * s.w && s.cy > 0.12 && s.cy < 0.92;
  const isW = (s) => s.closed && s.w > 6 && s.h > 6 && s.w < 0.3 * bwB && s.h < 0.3 * bh;
  const vcount = info.filter(isV).length, hcount = info.filter(isH).length, winCount = info.filter(isW).length;
  /* 그린 위치를 건물 좌표(u: 왼→오 0~1, v: 지면→최고점 0~1)로 바꿔 둬요 → 3D·도면에 그대로 반영 */
  const bx0 = x0 + a * cw, pk = peak0 * bh, uOf = (x) => clamp((x - bx0) / bwB, 0, 1), vOf = (y) => clamp((y1 - y) / pk, 0, 1);
  const colsU = info.filter(isV).map((s) => uOf(s.cx)).sort((p, q) => p - q);
  const bandsV = info.filter(isH).map((s) => vOf(s.cyP)).sort((p, q) => p - q);
  const shapes = info.filter(isW).map((s) => ({ u: uOf(s.cx), v0: vOf(s.sy1), w: s.w / bwB, h: s.h / pk }));
  const floorsHint = hcount >= 2 ? hcount + 1 : 0;

  /* 3) 윤곽 분석: 처마 높이(edgeH) · 평평한 구간(levels) · 좌우 대칭 */
  const Q = arcOpen(P, 2); // 좁은 돌기를 지운 윤곽: 지붕 모양 판별용
  const qmax = Math.max(...Q), edgeH = (Q[0] + Q[1] + Q[n - 1] + Q[n - 2]) / 4, roofness = qmax - edgeH;
  const levels = []; let st = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || Math.abs(Q[i] - Q[st]) > 0.6 / GN) {
      if (i - st >= 4) { const lv = arcAvg(Q.slice(st, i)); if (!levels.some((l) => Math.abs(l - lv) < 0.07)) levels.push(lv); }
      st = i;
    }
  }
  levels.sort((p, q) => p - q);
  let sym = 0; for (let i = 0; i < n >> 1; i++) sym += Math.abs(Q[i] - Q[n - 1 - i]); sym /= Math.max(1, n >> 1);
  const rc = []; Q.forEach((v, i) => { if (v > edgeH + 0.04) rc.push(i); });

  /* 4) 판별 */
  let kind = 'box', conf = 0.62, roofKind = 'flat', roofFrac = 1; const reasons = [];
  const roofFit = () => {
    const m = rc.length, lo = Math.min(...rc.map((q) => Q[q])), span = Math.max(0.01, qmax - lo); let eT = 0, eC = 0, eF = 0;
    for (let k = 0; k < m; k++) {
      const t = ((k + 0.5) / m) * 2 - 1, r = clamp((Q[rc[0] + k] - lo) / span, 0, 1.2);
      eT += (r - (1 - Math.abs(t))) ** 2; eC += (r - Math.sqrt(Math.max(0, 1 - t * t))) ** 2; eF += (r - 1) ** 2;
    }
    return { eT: eT / m, eC: eC / m, eF: eF / m, cen: (rc[0] + rc[m - 1]) / 2 / (n - 1) * 2 - 1 };
  };
  const fit = roofness > 0.12 && rc.length >= 3 ? roofFit() : null;

  if (vcount >= 4 && aspect < 1.7) {
    kind = 'temple'; conf = 0.8;
    reasons.push(`나란히 선 세로선 ${vcount}개 → 열주(기둥)로 해석`);
    if (fit && fit.eT < fit.eF) { roofKind = 'gable'; reasons.push('위쪽이 삼각형 → 박공(페디먼트) 지붕'); } else reasons.push('위쪽이 평평 → 수평 보(엔타블러처)');
  } else if (levels.length >= 3) {
    if (sym < 0.1) { kind = 'stepped'; conf = 0.78; reasons.push(`윤곽이 ${levels.length}단 계단 모양, 좌우 대칭 → 계단식 단탑`); }
    else { kind = 'composite'; conf = 0.72; reasons.push(`높이가 다른 덩어리 ${levels.length}개가 이어진 윤곽 → 매스 조합 빌딩`); }
  } else if (fit) {
    if (Math.abs(fit.cen) > 0.45) { kind = 'composite'; conf = 0.65; reasons.push('가장 높은 곳이 한쪽으로 치우침 → 비대칭 매스 구성'); }
    else if (fit.eF <= fit.eT && fit.eF <= fit.eC) { kind = 'stepped'; conf = 0.68; reasons.push('가운데가 단(段)처럼 솟은 윤곽 → 기단 + 탑'); }
    else if (fit.eT <= fit.eC) { kind = 'house'; roofKind = 'gable'; conf = clamp(0.6 + (fit.eC - fit.eT) * 3, 0.6, 0.95); reasons.push('윗부분이 직선으로 모이는 삼각형 → 박공지붕'); }
    else { kind = 'dome'; roofKind = 'dome'; conf = clamp(0.6 + (fit.eT - fit.eC) * 3, 0.6, 0.95); reasons.push('윗부분이 둥근 곡선 → 돔(둥근 지붕)'); }
    roofFrac = rc.length / n;
  } else if (aspect >= 1.8) {
    kind = 'tower'; conf = clamp(0.62 + (aspect - 1.8) * 0.1, 0.62, 0.92); reasons.push(`높이/폭 비율 ${aspect.toFixed(1)} → 고층 타워`);
  } else { kind = 'box'; conf = 0.66; reasons.push('윗면이 평평한 직육면체 윤곽 → 박스형 건물'); }

  if (floorsHint) reasons.push(`안쪽 가로선 ${hcount}개 → ${floorsHint}개 층으로 해석`);
  if (winCount >= 2) reasons.push(`작은 네모 ${winCount}개 → 창·문 위치로 반영`);
  reasons.push(`전체 비율 높이:폭 = ${aspect.toFixed(1)} : 1`);

  return { kind, name: ARC_KINDS[kind].name, icon: ARC_KINDS[kind].icon, conf, reasons, aspect, n, P, edgeH, levels, roofKind, roofFrac, vcount, hcount, winCount, floorsHint, rcA: rc.length ? rc[0] : -1, rcB: rc.length ? rc[rc.length - 1] : -1, colsU, bandsV, shapes };
}

/* ───────────── 그린 스케치 → 건축 부재(prims) : 윤곽선을 그대로 따라 지어요 ─────────────
 * prim 종류
 *   ext   : 윤곽 다각형 pts[[x,y]...] 를 깊이 d 만큼 밀어 올린 덩어리 (벽체·지붕)  ← 그린 실루엣 그대로
 *   lathe : 반지름-높이 곡선 pts[[r,y]...] 을 한 바퀴 돌린 덩어리 (돔 지붕)
 *   box / cyl : 창문·문·기둥·층 구분 띠 …  (그린 위치 그대로)
 * 좌표: x 오른쪽 · y 위 · z 정면(관람자 쪽)                                              */
const ARC_FH = 3.2; // 한 층 높이(m)
const ARC_WALL = { house: '#ece2d0', dome: '#efe7d8', tower: '#c4ccd6', stepped: '#e0cfae', temple: '#e6dfd0', composite: '#d7dde4', box: '#dfe3e8' };

function buildPrims(sp) {
  const prims = [], { P, n, aspect, edgeH } = sp, FH = ARC_FH, b = 0.25;
  const add = (o) => { prims.push(o); return o; };
  const roofKind = sp.roofKind, hasRoof = (roofKind === 'gable' || roofKind === 'dome') && sp.rcA >= 0 && sp.rcB - sp.rcA >= 2;

  /* 1) 실제 크기: 그린 비율(높이/폭)을 그대로 유지 */
  let W = aspect >= 1.8 ? 9 : aspect >= 1.1 ? 12 : 15, Ht = W * aspect;
  if (Ht > 36) { Ht = 36; W = Ht / aspect; }
  const D = roofKind === 'dome' ? W : clamp(W * 0.7, 6, 11);
  const xb = (i) => -W / 2 + (i / n) * W, xc = (i) => xb(i + 0.5);
  const colAt = (u) => clamp(Math.floor(clamp(u, 0, 0.9999) * n), 0, n - 1);
  const eave = hasRoof ? edgeH * Ht : Ht;                // 지붕이 시작되는 높이(처마)
  const topAt = (u) => Math.min(P[colAt(u)] * Ht, hasRoof ? eave : Infinity); // 그 위치에서 벽이 올라가는 높이

  /* 2) 벽체: 그린 실루엣을 따라 위로 쭉 밀어 올려요 (돔은 처마 높이까지만) */
  const hOf = (i) => (roofKind === 'dome' && hasRoof ? Math.min(P[i], edgeH) : P[i]) * Ht + b;
  const wall = [[xb(0), b], [xb(0), hOf(0)]];
  for (let i = 0; i < n; i++) {
    if (i && Math.abs(P[i] - P[i - 1]) > 0.07) wall.push([xb(i), hOf(i - 1)], [xb(i), hOf(i)]); // 단차는 수직으로
    wall.push([xc(i), hOf(i)]);
  }
  wall.push([xb(n), hOf(n - 1)], [xb(n), b]);
  add({ k: 'box', x: 0, y: 0, z: 0, w: W + 0.8, h: b, d: D + 0.8, col: '#9aa0a8' });
  add({ k: 'ext', pts: wall, x: 0, y: 0, z: 0, w: W, d: D, h: Math.max(...wall.map((q) => q[1])), col: ARC_WALL[sp.kind] || '#e6dfd0' });

  /* 3) 지붕: 박공 → 윤곽을 한 겹 더 입힘 / 돔 → 윤곽을 회전시켜 둥글게 */
  if (hasRoof && roofKind === 'gable') {
    const roof = [[xb(sp.rcA), eave + b]];
    for (let i = sp.rcA; i <= sp.rcB; i++) roof.push([xc(i), Math.max(P[i] * Ht, eave) + b + 0.28]);
    roof.push([xb(sp.rcB + 1), eave + b]);
    add({ k: 'ext', pts: roof, x: 0, y: 0, z: 0, w: W, d: D + 1.2, h: Math.max(...roof.map((q) => q[1])), col: '#b5543c', roof: true });
  } else if (hasRoof && roofKind === 'dome') {
    const cx = (xc(sp.rcA) + xc(sp.rcB)) / 2, rim = Math.min(W / 2, (xc(sp.rcB) - xc(sp.rcA)) / 2 + W / n);
    const prof = [];
    for (let i = sp.rcA; i <= sp.rcB; i++) if (xc(i) >= cx - 0.01) prof.push([Math.min(rim, Math.abs(xc(i) - cx)), Math.max(P[i] * Ht, eave) + b + 0.12]);
    prof.unshift([0, prof.length ? prof[0][1] : eave + b]); prof.push([rim, eave + b]);
    add({ k: 'lathe', pts: prof, x: cx, y: 0, z: 0, r: rim, h: Math.max(...prof.map((q) => q[1])), col: '#4f9d93', roof: true });
  }

  /* 4) 층 구분: 그린 가로선 위치에 띠(슬래브)를 둘러요 */
  const widthAt = (y) => { let lo = n, hi = -1; for (let i = 0; i < n; i++) if (P[i] * Ht + b >= y) { lo = Math.min(lo, i); hi = Math.max(hi, i); } return hi < 0 ? null : [xb(lo), xb(hi + 1)]; };
  const bandYs = sp.bandsV.map((v) => v * Ht * 1 + b).filter((y) => y > b + 1.2 && y < Ht + b - 0.8);
  bandYs.forEach((y) => { const w = widthAt(y); if (w) add({ k: 'box', x: (w[0] + w[1]) / 2, y: y - 0.09, z: 0, w: w[1] - w[0] + 0.3, h: 0.18, d: D + 0.3, col: '#8f98a5' }); });
  const bodyH = Math.max(3, Math.min(Ht, hasRoof ? eave : Ht));
  const floors = bandYs.length ? bandYs.length + 1 : clamp(Math.round(bodyH / FH), 1, 12);

  /* 5) 기둥: 그린 세로선 위치마다 원기둥 (3개 이상일 때 열주로 봐요) */
  let colTop = 0;
  if (sp.colsU.length >= 3) {
    const zc = D / 2 + 0.55, cr = clamp(W * 0.028, 0.3, 0.5), ch = Math.max(2.5, Math.min(...sp.colsU.map((u) => topAt(u))) - 0.4);
    sp.colsU.forEach((u) => { const x = -W / 2 + u * W; add({ k: 'cyl', x, y: b, z: zc, r: cr, h: ch, col: '#f3eee3' }); });
    colTop = ch + b; const x0 = -W / 2 + sp.colsU[0] * W, x1 = -W / 2 + sp.colsU[sp.colsU.length - 1] * W;
    add({ k: 'box', x: (x0 + x1) / 2, y: colTop, z: zc, w: x1 - x0 + 1.4, h: 0.45, d: 1.5, col: '#d9d1c1' });
  }

  /* 6) 창·문: 그린 작은 네모의 위치·크기 그대로. 하나도 없으면 층·폭에 맞춰 자동 배치 */
  const zf = D / 2 + 0.03;
  if (sp.shapes.length) {
    sp.shapes.forEach((q) => {
      const x = -W / 2 + q.u * W, w = clamp(q.w * W, 0.6, 3.2), h = clamp(q.h * Ht, 0.8, 3.4), y = b + q.v0 * Ht, top = topAt(q.u) + b;
      if (y + h > top + 0.2) return; // 건물 밖에 그린 건 무시
      const door = q.v0 < 0.1;
      add({ k: 'box', x, y: door ? b : y, z: zf, w: door ? Math.max(w, 1.3) : w, h: door ? Math.max(h, 2.2) : h, d: 0.1, col: door ? '#7a4a2b' : '#7fc4f2', win: !door, door });
    });
    if (!sp.shapes.some((q) => q.v0 < 0.1) && topAt(0.5) > 2.8 && !sp.shapes.some((q) => Math.abs(q.u - 0.5) < 0.12)) add({ k: 'box', x: 0, y: b, z: zf + 0.01, w: 1.5, h: 2.4, d: 0.1, col: '#7a4a2b', door: true }); // 문을 안 그렸으면 가운데에 기본 문
  } else {
    const cols = clamp(Math.floor(W / 2.8), 2, 6), fh = bodyH / floors;
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols, x = -W / 2 + u * W, y = b + f * fh + fh * 0.3, h = Math.min(1.5, fh * 0.5);
      if (f === 0 && Math.abs(u - 0.5) < 0.5 / cols + 0.01 && cols % 2 === 1) continue; // 가운데는 문 자리
      if (y + h > topAt(u) + b - 0.4) continue;
      add({ k: 'box', x, y, z: zf, w: Math.min(1.2, (W / cols) * 0.5), h, d: 0.08, col: '#7fc4f2', win: true });
    }
    if (topAt(0.5) > 2.8) add({ k: 'box', x: 0, y: b, z: zf + 0.01, w: 1.5, h: 2.4, d: 0.1, col: '#7a4a2b', door: true });
  }

  /* 7) 치수·층 높이 표 */
  let H = 0; prims.forEach((p) => { H = Math.max(H, p.y + p.h); });
  const bz = hasRoof && roofKind === 'gable' ? (D + 1.2) / 2 : D / 2, bzF = sp.colsU.length >= 3 ? D / 2 + 1.3 : bz;
  const meta = { W, D, floors, fh: bodyH / floors, base: b, H, bx: [-W / 2, W / 2], bz: [-bz, bzF] };
  meta.area = W * (bz + bzF); meta.gfa = meta.area * floors * 0.85;
  meta.levels = [{ h: b, label: 'GL' }, ...bandYs.map((y, i) => ({ h: y, label: `${i + 2}F` })), { h: H, label: 'ROOF' }];
  sp.reasons.push(`✔ 그린 윤곽선(${n}구간)을 그대로 따라 ${W.toFixed(0)}m × ${Ht.toFixed(0)}m 로 지었어요`);
  if (sp.colsU.length >= 3) sp.reasons.push(`✔ 그린 세로선 ${sp.colsU.length}개 위치에 기둥을 세웠어요`);
  if (sp.shapes.length) sp.reasons.push(`✔ 그린 창·문 ${sp.shapes.length}개를 그 자리에 달았어요`);
  if (bandYs.length) sp.reasons.push(`✔ 그린 층 구분선 ${bandYs.length}개를 따라 층을 나눴어요`);
  return { prims, meta };
}

/* ───────────── 청사진(2D 도면) : 같은 prims 로 정면도 + 평면도 + 표제란 ───────────── */
function drawBlueprint(g, CW, CH, model, sp) {
  const { prims, meta } = model, BG = '#0d3b8c', LN = '#e8f1ff';
  const round = (p) => p.k === 'cyl' || p.k === 'dome' || p.k === 'lathe';
  const ext = (p) => (round(p) ? [p.r, p.r] : [p.w / 2, p.d / 2]);

  /* 바탕 + 모눈 */
  const gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, '#0f4aa8'); gr.addColorStop(1, '#0a2f75');
  g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  for (let x = 0; x <= CW; x += 20) { g.strokeStyle = x % 100 === 0 ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.1)'; g.lineWidth = x % 100 === 0 ? 1 : 0.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke(); }
  for (let y = 0; y <= CH; y += 20) { g.strokeStyle = y % 100 === 0 ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.1)'; g.lineWidth = y % 100 === 0 ? 1 : 0.6; g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
  g.strokeStyle = LN; g.lineWidth = 2.2; g.strokeRect(14, 14, CW - 28, CH - 28); g.lineWidth = 0.8; g.strokeRect(20, 20, CW - 40, CH - 40);
  g.fillStyle = LN; g.font = 'bold 20px "Courier New", monospace'; g.textAlign = 'left'; g.fillText(`BLUEPRINT · 청사진  /  ${sp.icon} ${sp.name}`, 34, 50);
  g.font = '11px "Courier New", monospace'; g.fillStyle = 'rgba(232,241,255,.75)'; g.fillText('FRONT ELEVATION 정면도 · SITE PLAN 평면도', 34, 68);

  const text = (t, x, y, o = {}) => { g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); g.textAlign = o.al || 'center'; g.fillStyle = o.col || LN; g.font = o.font || '11px "Courier New", monospace'; g.fillText(t, 0, 0); g.restore(); };
  const line = (x0, y0, x1, y1, dash) => { g.beginPath(); g.setLineDash(dash || []); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); };
  const arrow = (x0, y0, x1, y1) => {
    line(x0, y0, x1, y1); const a = Math.atan2(y1 - y0, x1 - x0);
    [[x0, y0, 0], [x1, y1, Math.PI]].forEach(([x, y, o]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 * Math.cos(a + o + 0.4), y + 8 * Math.sin(a + o + 0.4)); g.lineTo(x + 8 * Math.cos(a + o - 0.4), y + 8 * Math.sin(a + o - 0.4)); g.closePath(); g.fillStyle = LN; g.fill(); });
  };

  /* ── 정면도 ── */
  const R = { x: 40, y: 86, w: 590, h: 500 }, W = meta.bx[1] - meta.bx[0], H = meta.H;
  const s = Math.min((R.w - 170) / W, (R.h - 140) / H), gy = R.y + R.h - 64, cx = R.x + R.w / 2 - 20, mx = (meta.bx[0] + meta.bx[1]) / 2;
  const X = (x) => cx + (x - mx) * s, Y = (y) => gy - y * s;
  g.save(); g.lineJoin = 'round';
  [...prims].sort((p, q) => p.z - q.z).forEach((p) => {
    const [hw] = ext(p); g.beginPath();
    if (p.k === 'ext') { p.pts.forEach((q, i) => (i ? g.lineTo(X(p.x + q[0]), Y(q[1])) : g.moveTo(X(p.x + q[0]), Y(q[1])))); g.closePath(); }
    else if (p.k === 'lathe') { p.pts.forEach((q, i) => (i ? g.lineTo(X(p.x + q[0]), Y(q[1])) : g.moveTo(X(p.x + q[0]), Y(q[1])))); for (let i = p.pts.length - 1; i >= 0; i--) g.lineTo(X(p.x - p.pts[i][0]), Y(p.pts[i][1])); g.closePath(); }
    else if (p.k === 'box' || p.k === 'cyl') g.rect(X(p.x - hw), Y(p.y + p.h), hw * 2 * s, p.h * s);
    else if (p.k === 'prism' || p.k === 'pyr') { g.moveTo(X(p.x - hw), Y(p.y)); g.lineTo(X(p.x + hw), Y(p.y)); g.lineTo(X(p.x), Y(p.y + p.h)); g.closePath(); }
    else if (p.k === 'dome') g.ellipse(X(p.x), Y(p.y), p.r * s, p.h * s, 0, Math.PI, Math.PI * 2);
    g.fillStyle = p.win ? 'rgba(170,215,255,.38)' : p.door ? 'rgba(255,255,255,.2)' : BG; g.fill();
    g.strokeStyle = LN; g.lineWidth = p.win || p.door ? 0.8 : 1.4; g.stroke();
    if (p.roof) { g.save(); g.clip(); g.strokeStyle = 'rgba(232,241,255,.35)'; g.lineWidth = 0.7; for (let k = -40; k < 80; k++) line(X(p.x - hw) + k * 7, Y(p.y), X(p.x - hw) + k * 7 + p.h * s, Y(p.y + p.h)); g.restore(); }
  });
  g.strokeStyle = LN; g.lineWidth = 2; line(R.x + 10, gy, R.x + R.w - 20, gy); // 지반선(GL)
  g.lineWidth = 0.8; for (let k = 0; k < 40; k++) line(R.x + 14 + k * 14, gy, R.x + 4 + k * 14, gy + 9);
  g.restore();

  /* 치수선 · 층 높이 표시 */
  g.strokeStyle = LN; g.lineWidth = 1;
  const dy = gy + 30; arrow(X(meta.bx[0]), dy, X(meta.bx[1]), dy); line(X(meta.bx[0]), gy + 6, X(meta.bx[0]), dy + 6); line(X(meta.bx[1]), gy + 6, X(meta.bx[1]), dy + 6);
  text(`${W.toFixed(1)} m`, cx, dy - 5, { font: 'bold 12px "Courier New", monospace' });
  const dx = X(meta.bx[0]) - 34; arrow(dx, gy, dx, Y(H)); line(dx - 6, Y(H), X(meta.bx[0]) - 4, Y(H));
  text(`${H.toFixed(1)} m`, dx - 7, (gy + Y(H)) / 2, { rot: -Math.PI / 2, font: 'bold 12px "Courier New", monospace' });
  const rx = X(meta.bx[1]) + 14;
  meta.levels.forEach((lv) => { const yy = Y(lv.h); g.strokeStyle = 'rgba(232,241,255,.7)'; line(X(meta.bx[1]) + 4, yy, rx + 30, yy, [5, 4]); text(`${lv.label} +${lv.h.toFixed(1)}`, rx + 34, yy + 4, { al: 'left', font: '10px "Courier New", monospace' }); });

  /* ── 평면도 ── */
  const PR = { x: 650, y: 86, w: 280, h: 260 }, PW = meta.bx[1] - meta.bx[0], PD = meta.bz[1] - meta.bz[0];
  const ps = Math.min((PR.w - 70) / PW, (PR.h - 80) / PD), pcx = PR.x + PR.w / 2, pcy = PR.y + PR.h / 2 - 6, pmx = mx, pmz = (meta.bz[0] + meta.bz[1]) / 2;
  const PX = (x) => pcx + (x - pmx) * ps, PZ = (z) => pcy + (z - pmz) * ps;
  g.strokeStyle = LN; g.lineWidth = 1; g.strokeRect(PR.x, PR.y, PR.w, PR.h);
  [...prims].filter((p) => !p.win && !p.door).sort((p, q) => p.y - q.y).forEach((p) => {
    const [hw, hd] = ext(p); g.beginPath();
    if (round(p)) g.arc(PX(p.x), PZ(p.z), p.r * ps, 0, Math.PI * 2); else g.rect(PX(p.x - hw), PZ(p.z - hd), hw * 2 * ps, hd * 2 * ps);
    g.fillStyle = BG; g.fill(); g.strokeStyle = LN; g.lineWidth = p.k === 'cyl' && p.r < 0.6 ? 0.9 : 1.3; g.stroke();
    if (p.k === 'prism') line(PX(p.x), PZ(p.z - hd), PX(p.x), PZ(p.z + hd));
    if (p.k === 'pyr') { line(PX(p.x - hw), PZ(p.z - hd), PX(p.x + hw), PZ(p.z + hd)); line(PX(p.x + hw), PZ(p.z - hd), PX(p.x - hw), PZ(p.z + hd)); }
    if (p.k === 'dome' || p.k === 'lathe') { g.beginPath(); g.arc(PX(p.x), PZ(p.z), p.r * ps * 0.45, 0, Math.PI * 2); g.stroke(); }
    if (p.k === 'ext' && p.roof) line(PX(p.x - hw), PZ(p.z), PX(p.x + hw), PZ(p.z)); // 용마루
  });
  text('PLAN 평면도', PR.x + 8, PR.y + 16, { al: 'left', font: 'bold 12px "Courier New", monospace' });
  const pdx = PZ(meta.bz[1]) + 20; arrow(PX(meta.bx[0]), pdx, PX(meta.bx[1]), pdx); text(`${PW.toFixed(1)} m`, pcx, pdx + 14);
  text(`${PD.toFixed(1)} m`, PX(meta.bx[1]) + 20, PZ(pmz), { rot: Math.PI / 2 }); arrow(PX(meta.bx[1]) + 8, PZ(meta.bz[0]), PX(meta.bx[1]) + 8, PZ(meta.bz[1]));
  g.strokeStyle = LN; g.beginPath(); g.arc(PR.x + PR.w - 30, PR.y + 34, 14, 0, Math.PI * 2); g.stroke(); line(PR.x + PR.w - 30, PR.y + 52, PR.x + PR.w - 30, PR.y + 16); text('N', PR.x + PR.w - 30, PR.y + 12);

  /* ── 표제란 ── */
  const TB = { x: 650, y: 380, w: 280, h: 206 }; g.strokeStyle = LN; g.lineWidth = 1.6; g.strokeRect(TB.x, TB.y, TB.w, TB.h);
  const rows = [['도면명', '건축 스케치 → 청사진'], ['건물 유형', `${sp.icon} ${sp.name}`], ['규모', `지상 ${meta.floors}층 · 높이 ${H.toFixed(1)} m`], ['건축면적', `${meta.area.toFixed(0)} m²`], ['연면적(추정)', `${meta.gfa.toFixed(0)} m²`], ['스케치 해석', `신뢰도 ${Math.round(sp.conf * 100)}%`], ['축척', '개략 1/100 (체험용)'], ['설계', '건축디자인학과 체험']];
  g.lineWidth = 0.8; rows.forEach((r, i) => { const yy = TB.y + 10 + i * 24; if (i) line(TB.x, yy - 6 + 0, TB.x + TB.w, yy - 6); text(r[0], TB.x + 8, yy + 12, { al: 'left', col: 'rgba(232,241,255,.7)', font: '10px "Courier New", monospace' }); text(r[1], TB.x + 92, yy + 12, { al: 'left', font: 'bold 11px "Courier New", monospace' }); });
  text(new Date().toISOString().slice(0, 10), TB.x + TB.w - 8, TB.y + TB.h - 8, { al: 'right', col: 'rgba(232,241,255,.6)', font: '10px "Courier New", monospace' });
}

/* ───────────── 스케치 도구 UI(DOM) · 예시 · 3D 부재 생성 ───────────── */
const arcPts = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
/* 예시 스케치(0~1 비율 좌표, y 는 아래로 증가) */
const ARC_SAMPLES = {
  '🏠 주택': [[[.3, .9], [.3, .55], [.7, .55], [.7, .9], [.3, .9]], [[.26, .57], [.5, .25], [.74, .57], [.26, .57]], [[.46, .9], [.46, .72], [.54, .72], [.54, .9], [.46, .9]], [[.34, .62], [.34, .7], [.41, .7], [.41, .62], [.34, .62]], [[.59, .62], [.59, .7], [.66, .7], [.66, .62], [.59, .62]]],
  '🕌 돔': [[[.25, .9], [.25, .55], [.75, .55], [.75, .9], [.25, .9]], arcPts(.5, .55, .25, .3, Math.PI, 2 * Math.PI), [[.48, .25], [.48, .15], [.52, .15], [.52, .25]]],
  '🏢 타워': [[[.42, .92], [.42, .1], [.58, .1], [.58, .92], [.42, .92]], [[.42, .3], [.58, .3]], [[.42, .5], [.58, .5]], [[.42, .7], [.58, .7]]],
  '🏯 계단탑': [[[.2, .9], [.2, .7], [.32, .7], [.32, .52], [.42, .52], [.42, .36], [.58, .36], [.58, .52], [.68, .52], [.68, .7], [.8, .7], [.8, .9], [.2, .9]]],
  '🏛️ 신전': [[[.15, .9], [.85, .9]], [[.15, .5], [.5, .25], [.85, .5], [.15, .5]], ...[0, 1, 2, 3, 4, 5].map((i) => [[.22 + i * .112, .5], [.22 + i * .112, .86]])],
  '🏙️ 빌딩군': [[[.15, .9], [.15, .6], [.3, .6], [.3, .4], [.45, .4], [.45, .7], [.6, .7], [.6, .3], [.75, .3], [.75, .55], [.85, .55], [.85, .9], [.15, .9]]],
};
const ARC_CSS = `
.arc-ov{position:fixed;left:50%;top:60px;transform:translateX(-50%);width:min(94vw,820px);max-height:calc(100vh - 76px);overflow:auto;z-index:2147483000;pointer-events:auto;box-sizing:border-box;background:rgba(17,24,39,.94);color:#fff;border-radius:14px;padding:10px 12px;box-shadow:0 10px 40px rgba(0,0,0,.45);font:14px/1.4 system-ui,sans-serif}
.arc-ov canvas{display:block;width:100%;height:auto;border-radius:10px;touch-action:none}
.arc-ov canvas.pen{cursor:crosshair;background:#fbfaf5}
.arc-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0 2px}
.arc-live{margin-left:auto;font-size:13px;color:#ffd24d}
.arc-btn{border:0;border-radius:10px;padding:8px 12px;background:#2c3a55;color:#fff;font:inherit;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.arc-btn:hover{background:#3a4b6e}.arc-btn:active{transform:scale(.96)}
.arc-btn.sm{padding:5px 9px;font-size:13px}.arc-btn.pri{background:#2f9e6a;font-weight:700}.arc-btn.pri:hover{background:#38b27a}
.arc-dock{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:96vw}
.arc-dock .arc-btn{box-shadow:0 4px 14px rgba(0,0,0,.35);background:rgba(17,24,39,.92)}.arc-dock .arc-btn.pri{background:#2f9e6a}
.arc-side{display:contents}
.arc-btn{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.arc-ov canvas.bp{touch-action:pan-x pan-y pinch-zoom}
@media (pointer:coarse){.arc-btn{min-height:44px;padding:10px 14px}.arc-btn.sm{min-height:40px;padding:8px 11px;font-size:14px}}
@media (max-height:620px) and (orientation:landscape){
.arc-ov{left:8px;top:54px;transform:none;width:calc(100vw - 16px);max-height:calc(100vh - 62px);padding:8px 10px}
.arc-ov.sk{display:grid;grid-template-columns:auto minmax(170px,1fr);grid-template-rows:auto auto;gap:6px 12px;align-content:start;overflow:hidden}
.arc-ov.sk .arc-row:first-child{grid-column:1;grid-row:1;margin:0}
.arc-ov.sk canvas{grid-column:1;grid-row:2;width:auto;height:min(calc(100vh - 120px),calc((100vw - 240px)*.6))}
.arc-ov.sk .arc-side{display:flex;flex-direction:column;gap:6px;grid-column:2;grid-row:1 / span 2;overflow-y:auto;min-height:0}
.arc-ov.sk .arc-side .arc-row{margin:0}
.arc-ov.sk .arc-side .arc-row:last-child{margin-top:auto}
.arc-ov.sk .arc-side .arc-row:last-child .arc-btn.pri{flex:1 1 100%}
.arc-ov.sk .arc-btn{min-height:38px;padding:6px 10px}
.arc-ov.sk .arc-btn.sm{min-height:34px;padding:4px 8px;font-size:13px}
.arc-ov.bpv{overflow:auto;-webkit-overflow-scrolling:touch}
.arc-ov.bpv canvas{width:auto;height:calc(100vh - 124px)}
.arc-dock{left:8px;transform:none;justify-content:flex-start;max-width:64vw;bottom:8px;gap:6px}
.arc-dock .arc-btn{min-height:40px;padding:6px 10px;font-size:13px}
}
`;

const arcEl = (tag, cls, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; e.setAttribute('data-arc-sk', '1'); if (parent) parent.appendChild(e); return e; };
const arcClean = () => document.querySelectorAll('[data-arc-sk]').forEach((n) => n.remove());

/* 3D 부재: 단위 지오메트리를 한 번만 만들고, 메시마다 scale 로 크기를 줘요 */
let ARC_G = null;
const arcGeos = () => ARC_G || (ARC_G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 28),
  pyr: (() => { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(Math.PI / 4); return g; })(),
  dome: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  prism: (() => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })(),
});
const arcMesh = (p) => {
  if (p.k === 'ext' || p.k === 'lathe') { /* 그린 윤곽 그대로의 지오메트리 (m 단위 직접 생성) */
    let geo;
    if (p.k === 'ext') {
      const sh = new THREE.Shape(); p.pts.forEach((q, i) => (i ? sh.lineTo(q[0], q[1]) : sh.moveTo(q[0], q[1])));
      geo = new THREE.ExtrudeGeometry(sh, { depth: p.d, bevelEnabled: false }); geo.translate(0, 0, -p.d / 2);
    } else { geo = new THREE.LatheGeometry(p.pts.map((q) => new THREE.Vector2(q[0], q[1])), 40); }
    const mt = new THREE.MeshStandardMaterial({ color: p.col, roughness: 0.82, metalness: 0.04, side: THREE.DoubleSide });
    const mm = new THREE.Mesh(geo, mt); mm.position.set(p.x, 0, p.z); mm.userData.bs = [1, 1, 1]; mm.scale.set(0.001, 0.001, 0.001); return mm;
  }
  const mat = new THREE.MeshStandardMaterial(p.win ? { color: p.col, emissive: '#6fb7ff', emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.3 } : { color: p.col, roughness: 0.82, metalness: 0.04, side: p.k === 'dome' ? THREE.DoubleSide : THREE.FrontSide });
  const m = new THREE.Mesh(arcGeos()[p.k], mat);
  const [sx, sy, sz, py] = p.k === 'cyl' ? [p.r, p.h, p.r, p.y + p.h / 2] : p.k === 'dome' ? [p.r, p.h, p.r, p.y] : p.k === 'prism' ? [p.w, p.h, p.d, p.y] : [p.w, p.h, p.d, p.y + p.h / 2];
  m.position.set(p.x, py, p.z); m.userData.bs = [sx, sy, sz]; m.scale.set(0, 0, 0); return m;
};
const arcBack = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

registerExperience('arc', {
  icon: '🏛️', title: '스케치로 짓는 건축 & 청사진',
  desc: '건물의 모양을 간단히 그리면 그림의 취지를 읽어 비슷한 건축물을 3D로 지어 주고, 설계 도면(청사진)까지 만들어 줘요.',
  tools: ['✏️ 스케치 캔버스', '🏗 자동 시공(3D 생성)', '📘 청사진(정면도·평면도)'],
  steps: ['캔버스에 건물을 그려요 (외곽선만 대충 그려도 돼요) — 예시 버튼도 있어요', '지붕 모양·기둥·창문·층 구분선을 그리면 더 닮게 지어져요', '🏗 건축하기 → 건물이 아래층부터 올라가요 (드래그로 돌려 보기)', '📘 청사진에서 정면도·평면도·치수를 확인하고 💾 저장해요'],
  env: { sky: '#bfe3ff', fog: ['#d6ecff', 80, 200], sunColor: '#fff4e0', sunI: 1.6, hemi: ['#dff1ff', '#8aa07a', 0.95], sunPos: [30, 50, 25] },
  build(c) {
    const { root, ui, cam } = c;
    const CW = 800, CHT = 480, DUR = 2.8;
    let phase = 'draw', model = null, spec = null, T = 0, bpViewed = false, redraws = 0, ended = false, built = 0;
    let yaw = 0.6, pitch = 0.42, dist = 24, TGT = [0, 4, 0], drag = false, auto = true, turn = 0, meshes = [];

    /* ── 건설 부지 ── */
    c.ground('#9cc27f', 60, -0.3); c.box(26, 0.3, 22, '#b9b4a6', 0, -0.15, 0); c.box(60, 0.05, 5, '#6c727b', 0, -0.02, 17);
    [[-12, -10], [12, -10], [-12, 10], [12, 10]].forEach(([x, z]) => c.box(0.5, 0.06, 0.5, '#f2c94c', x, 0.04, z));
    [[-20, -8], [-24, 4], [21, -12], [25, 3], [-17, -18], [18, -19]].forEach(([x, z]) => { c.cyl(0.28, 0.28, 1.6, '#7a5a3a', x, 0.8, z); c.sph(1.3, '#4f9a58', x, 2.5, z); });
    const gen = new THREE.Group(); root.add(gen);
    cam.set([0, 9, 28], [0, 2, 0]); cam.fov(50, true);

    /* ── DOM: 스케치 패널 · 청사진 패널 · 하단 버튼 ── */
    arcClean();
    const style = arcEl('style', '', ARC_CSS); /* 화면에는 start()(시작하기 이후)에서 붙여요 */
    const ov = arcEl('div', 'arc-ov sk');
    const head = arcEl('div', 'arc-row', '<b>✏️ 건물 모양을 간단히 그려 보세요</b>', ov); head.style.marginTop = '0';
    const live = arcEl('span', 'arc-live', '아직 그린 선이 없어요', head);
    const cv = arcEl('canvas', 'pen', null, ov); cv.width = CW; cv.height = CHT;
    const g = cv.getContext('2d');
    const side = arcEl('div', 'arc-side', null, ov);
    const rowS = arcEl('div', 'arc-row', '<span style="opacity:.7">예시 불러오기</span>', side);
    const rowB = arcEl('div', 'arc-row', '', side);
    const bUndo = arcEl('button', 'arc-btn', '↩ 되돌리기', rowB), bClear = arcEl('button', 'arc-btn', '🧹 지우기', rowB);
    const bBuild = arcEl('button', 'arc-btn pri', '🏗 건축하기', rowB); bBuild.style.marginLeft = 'auto';

    const ov2 = arcEl('div', 'arc-ov bpv'); ov2.style.display = 'none'; ov2.style.padding = '8px';
    const bpCv = arcEl('canvas', 'bp', null, ov2); bpCv.width = 1920; bpCv.height = 1280;

    const dock = arcEl('div', 'arc-dock');
    let mounted = false;
    const mount = () => { if (mounted || ended) return; mounted = true; document.head.appendChild(style); [ov, ov2, dock].forEach((n) => document.body.appendChild(n)); setUI(); };
    const dRedo = arcEl('button', 'arc-btn', '✏️ 다시 그리기', dock), dL = arcEl('button', 'arc-btn', '◀', dock), dR = arcEl('button', 'arc-btn', '▶', dock);
    const dBp = arcEl('button', 'arc-btn pri', '📘 청사진 보기', dock), d3d = arcEl('button', 'arc-btn pri', '🧱 3D로 보기', dock);
    const dSave = arcEl('button', 'arc-btn', '💾 도면 저장', dock), dZoom = arcEl('button', 'arc-btn', '🔍 확대', dock), dOk = arcEl('button', 'arc-btn pri', '✔ 체험 완료', dock);
    const setUI = () => {
      const show = (el, v) => { el.style.display = v ? '' : 'none'; };
      ov.style.display = phase === 'draw' ? '' : 'none'; ov2.style.display = phase === 'bp' ? '' : 'none';
      dock.style.display = phase === 'draw' ? 'none' : '';
      show(dRedo, phase !== 'gen'); show(dL, phase === 'view' || phase === 'gen'); show(dR, phase === 'view' || phase === 'gen');
      show(dBp, phase === 'view'); show(d3d, phase === 'bp'); show(dSave, phase === 'bp'); show(dZoom, phase === 'bp'); show(dOk, phase === 'bp' || (phase === 'view' && bpViewed));
    };

    /* ── 스케치 캔버스 ── */
    const strokes = []; let cur = null;
    const redraw = () => {
      g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, CW, CHT);
      g.strokeStyle = 'rgba(70,110,170,.13)'; g.lineWidth = 1; for (let x = 0; x <= CW; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CHT); g.stroke(); } for (let y = 0; y <= CHT; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
      g.strokeStyle = 'rgba(70,110,170,.45)'; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(10, CHT * 0.92); g.lineTo(CW - 10, CHT * 0.92); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(70,110,170,.5)'; g.font = '12px system-ui'; g.fillText('지면', 14, CHT * 0.92 - 6);
      if (!strokes.length) { g.fillStyle = 'rgba(30,58,95,.35)'; g.font = '20px system-ui'; g.textAlign = 'center'; g.fillText('여기에 건물을 그려 보세요 (예: 네모 + 삼각 지붕)', CW / 2, CHT / 2); g.textAlign = 'left'; }
      g.strokeStyle = '#1e3a5f'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      strokes.forEach((s) => { g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y); g.stroke(); });
    };
    const recognize = () => { const sp = analyzeSketch(strokes); live.textContent = strokes.length ? (sp ? `${sp.icon} ${sp.name} 같아요 (${Math.round(sp.conf * 100)}%)` : '조금 더 크게 그려 주세요') : '아직 그린 선이 없어요'; return sp; };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * CW) / r.width, y: ((e.clientY - r.top) * CHT) / r.height }; };
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'mousedown'].forEach((ev) => cv.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })); /* 게임 쪽 입력 처리에 가로채이지 않게 */
    cv.addEventListener('pointerdown', (e) => { if (phase !== 'draw') return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } cur = [pos(e)]; strokes.push(cur); redraw(); });
    cv.addEventListener('pointermove', (e) => { if (!cur) return; const p = pos(e), l = cur[cur.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 2) { cur.push(p); redraw(); } });
    const endStroke = () => { if (!cur) return; if (cur.length < 2) strokes.pop(); cur = null; redraw(); recognize(); };
    ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, endStroke));
    Object.keys(ARC_SAMPLES).forEach((name) => {
      const b = arcEl('button', 'arc-btn sm', name, rowS);
      b.onclick = () => { strokes.length = 0; ARC_SAMPLES[name].forEach((s) => strokes.push(s.map(([x, y]) => ({ x: x * CW, y: y * CHT })))); redraw(); recognize(); };
    });
    bUndo.onclick = () => { strokes.pop(); redraw(); recognize(); };
    bClear.onclick = () => { strokes.length = 0; redraw(); recognize(); };
    redraw();

    /* ── 건축(3D 생성) ── */
    const clearGen = () => { [...gen.children].forEach((m) => { gen.remove(m); m.material.dispose(); }); meshes = []; };
    const panelInfo = () => {
      const m = model.meta;
      ui.panel(`<b>${spec.icon} ${spec.name}</b> · 신뢰도 ${Math.round(spec.conf * 100)}%<br><small>${spec.reasons.map((r) => '• ' + r).join('<br>')}</small><br>지상 ${m.floors}층 · 높이 ${m.H.toFixed(1)}m · 건축면적 ${m.area.toFixed(0)}㎡`);
    };
    const doBuild = () => {
      const sp = recognize();
      if (!sp) { ui.hint('건물 모양이 보이게 조금 더 크게 그려 주세요!'); snd(c, 'bad'); return; }
      spec = sp; model = buildPrims(sp); built++;
      clearGen();
      const order = model.prims.map((p, i) => [p, i]).sort((a, b) => a[0].y - b[0].y || a[1] - b[1]);
      order.forEach(([p], i) => { const m = arcMesh(p); m.userData.delay = (i / order.length) * (DUR - 0.45); gen.add(m); meshes.push(m); });
      const m = model.meta; dist = clamp(Math.max(m.W, m.D, m.H) * 1.9, 18, 70); TGT = [0, m.H * 0.4, 0]; yaw = 0.6; pitch = 0.42; auto = true;
      T = 0; phase = 'gen'; snd(c, 'ok'); setUI(); panelInfo(); ui.hint('🏗 시공 중… 기초 → 골조 → 지붕 → 창호 순서로 올라가요');
    };
    bBuild.onclick = doBuild;

    const showBp = () => {
      const bg = bpCv.getContext('2d'); bg.setTransform(2, 0, 0, 2, 0, 0); drawBlueprint(bg, 960, 640, model, spec); bpZoom(false);
      phase = 'bp'; bpViewed = true; setUI(); ui.hint('📘 청사진 완성! 💾 로 저장하거나 ✔ 로 체험을 마쳐요');
    };
    const redo = () => { phase = 'draw'; redraws++; clearGen(); setUI(); ui.panel('<b>✏️ 다시 그려요</b><br><small>지붕·기둥·창문·층 구분선을 더하면 더 닮게 지어져요</small>'); ui.hint('수정해서 다시 🏗 건축하기!'); };
    dBp.onclick = showBp; dRedo.onclick = redo;
    d3d.onclick = () => { phase = 'view'; setUI(); ui.hint('드래그로 돌려 보세요'); };
    dSave.onclick = () => { const a = document.createElement('a'); a.href = bpCv.toDataURL('image/png'); a.download = `blueprint-${spec.kind}.png`; a.click(); };
    const hold = (b, dir) => { b.addEventListener('pointerdown', (e) => { e.preventDefault(); turn = dir; auto = false; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { if (turn === dir) turn = 0; })); };
    hold(dL, -1); hold(dR, 1);
    let bpZ = false;
    const bpZoom = (v) => { bpZ = v; bpCv.style.width = v ? '1500px' : ''; bpCv.style.maxWidth = v ? 'none' : ''; bpCv.style.height = v ? 'auto' : ''; dZoom.textContent = v ? '🔍 맞춤' : '🔍 확대'; ov2.scrollTo(0, 0); };
    dZoom.onclick = () => bpZoom(!bpZ);

    const cleanup = () => { arcClean(); style.remove(); };
    const done = () => {
      if (ended || !spec) return; ended = true;
      const score = Math.round(clamp(30 + spec.conf * 25 + Math.min(15, spec.reasons.length * 4) + (bpViewed ? 25 : 0) + (redraws > 0 ? 5 : 0), 0, 100));
      cleanup(); ui.hint('🎉 설계 완료!'); c.finish(score);
    };
    dOk.onclick = done;

    const orbit = (dt) => {
      if (phase !== 'gen' && phase !== 'view') return;
      const k = c.keys, t2 = turn + ((k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0));
      if (t2) auto = false; yaw += t2 * 1.6 * dt; if (auto && !drag) yaw += 0.15 * dt;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      cam.set([TGT[0] + Math.sin(yaw) * cp * dist, TGT[1] + sp * dist, TGT[2] + Math.cos(yaw) * cp * dist], TGT);
    };
    const reveal = () => meshes.forEach((m) => { const e = clamp(arcBack(clamp((T - m.userData.delay) / 0.45, 0, 1)), 0, 1.15), b = m.userData.bs; m.scale.set(b[0] * e, b[1] * e, b[2] * e); });

    setUI(); dock.style.display = 'none';
    ui.panel('<b>✏️ 스케치 → 건축 → 청사진</b><br><small>• 윤곽(지붕 모양)이 가장 중요해요<br>• 세로선 여러 개 = 기둥, 작은 네모 = 창문<br>• 안쪽 가로선 = 층 구분</small>');
    return {
      start() { mount(); redraw(); ui.hint('건물 모양을 그리거나 예시 버튼을 눌러 보세요 ✏️'); },
      down() { if (phase === 'view' || phase === 'gen') { drag = true; auto = false; } },
      move(p) { if (drag && p.down) { yaw -= p.dx * 0.008; pitch = clamp(pitch + p.dy * 0.004, 0.12, 1.3); } },
      up() { drag = false; },
      idle(dt) { orbit(dt); },
      update(dt) {
        orbit(dt);
        if (phase !== 'gen') return;
        T += dt; reveal();
        if (T >= DUR) { meshes.forEach((m) => m.scale.set(...m.userData.bs)); phase = 'view'; snd(c, 'win'); setUI(); ui.hint('🎉 시공 완료! 드래그로 돌려 보고 📘 청사진을 열어 보세요'); }
      },
      dispose: cleanup, destroy: cleanup,
    };
  },
});
