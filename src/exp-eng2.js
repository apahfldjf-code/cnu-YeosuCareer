/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng2.js (신규, E2-2) — 공학대학 설비 시공 체험 (E2-1 의 뒷부분)
 *   rac : 냉동공조공학과     → 냉동기기 4종 설치 → 냉매 배관 연결 → 팽창밸브 개도 조절 운전
 *   sad : 스마트응용설계공학과 → 플랜트 설비 설치 → 공정 배관 연결 → 시운전 순서 지키기
 * 필요: src/exp-kit.js (E2-1 에서 이미 추가됨)
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { assembler, pipe, link, glassBox, snd } from './exp-kit.js';

const SHOP = { sky: '#cfd8e3', fog: ['#cfd8e3', 40, 120], sunColor: '#ffffff', sunI: 1.4, hemi: ['#eef4ff', '#8c97a8', 0.95], sunPos: [20, 40, 25] };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ───────────── 공용: 배관 연결 도구 (접속구를 끌어서 다음 접속구에 놓기) ─────────────
 *  ports : [[x,z],..] 접속구 위치    y : 접속구 높이
 *  links : [[from,to,색],..] 반드시 이 순서대로 연결해야 함
 *  반환  : { k, miss, show(v), pulse(t), down(), move(), up() → 'ok'|'done'|'bad'|null }
 */
function connector(c, { ports, y, links, notes }) {
  const g = new THREE.Group(); g.visible = false; c.root.add(g);
  const P = ports.map(([x, z]) => V3(x, y, z));
  const ms = P.map((p) => {
    c.cyl(0.09, 0.09, 2.0, '#8a929d', p.x, y - 1.0, p.z, g, 8);
    const m = c.sph(0.38, '#ffffff', p.x, p.y, p.z, g);
    m.material.emissive = new THREE.Color('#ffd24d'); m.material.emissiveIntensity = 0.3; return m;
  });
  const pipes = links.map(([a, b, col]) => { const m = pipe(g, 0.13, col); m.visible = false; link(m, P[a], P[b]); return m; });
  const tmp = pipe(g, 0.13, '#ffffff'); tmp.visible = false;
  let k = 0, drag = -1, miss = 0;

  const find = () => {
    const h = c.pick(ms); if (h) { const i = ms.indexOf(h.object); if (i >= 0) return i; }
    const pt = c.at(y); if (!pt) return -1; let bi = -1, bd = 1.4;
    P.forEach((p, i) => { const d = Math.hypot(p.x - pt.x, p.z - pt.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  return {
    get k() { return k; }, get miss() { return miss; },
    show(v) { g.visible = v; },
    pulse(t) {
      const hl = miss >= 3 && k < links.length ? links[k] : null;   /* 3번 틀리면 다음 연결 위치를 반짝여 알려 줌 */
      ms.forEach((m, i) => {
        const on = hl && (i === hl[0] || i === hl[1]);
        m.material.emissiveIntensity = on ? 0.5 + 0.5 * Math.sin(t * 8) : 0.2 + 0.12 * Math.sin(t * 3 + i);
        m.scale.setScalar(on ? 1.25 : 1);
      });
    },
    down() { const i = find(); if (i < 0) return false; drag = i; return true; },
    move() {
      if (drag < 0) return; const pt = c.at(y); if (!pt) return;
      const B = V3(pt.x, y, pt.z); if (B.distanceTo(P[drag]) < 0.1) return; tmp.visible = true; link(tmp, P[drag], B);
    },
    up() {
      if (drag < 0) return null; const a = drag; drag = -1; tmp.visible = false;
      const b = find(); if (b < 0 || b === a) return null;
      const [f, t] = links[k];
      if (a === f && b === t) {
        pipes[k].visible = true; ms[a].material.color.set('#6ee7a0'); ms[b].material.color.set('#6ee7a0');
        snd(c, 'ok'); c.buzz(15); c.ui.pop('✔ ' + notes[k], P[a].clone().lerp(P[b], 0.5).add(V3(0, 0.8, 0)), '#a0ffb8');
        k++; return k >= links.length ? 'done' : 'ok';
      }
      miss++; snd(c, 'bad');
      c.ui.pop(a === t && b === f ? '방향이 반대예요! 흐름 방향을 확인해요' : '그 연결이 아니에요 · 설계도의 흐름을 다시 봐요', P[b], '#ff8a80');
      return 'bad';
    },
  };
}

/* ───────────────────────── 1. 냉동공조공학과 · 냉동 사이클 시공 → 운전 ───────────────────────── */
registerExperience('rac', {
  icon: '❄️', title: '냉동 사이클 시공·운전',
  desc: '압축기·응축기·팽창밸브·증발기를 설치하고 냉매 배관을 이은 뒤, 팽창밸브 개도를 맞춰 냉장실을 차갑게 만들어 보세요.',
  tools: ['❄️ 냉동기기 4종', '🔧 냉매 배관', '🌡 온도 계측'],
  steps: ['기기 4개를 끌어서 흰 그림자 위에 설치해요', '냉매가 흐르는 순서대로 접속구(●)를 끌어 배관을 이어요', '➖ ➕ 로 팽창밸브 개도를 조절해요', '냉장실을 1.5~6℃로 6초 유지하면 성공!'],
  env: SHOP,
  build(c) {
    const { root, ui, cam } = c;
    const PY = 2.5, SL = [[-4.5, -2.5], [4.5, -2.5], [4.5, 2.5], [-4.5, 2.5]];
    const opt = [5, 6, 7][Math.floor(Math.random() * 3)];            /* 이번 판의 적정 개도 */
    let phase = 'asm', tt = 0, ended = false, left = 60, open = 2, T = 28, hold = 0, acc = 0;

    c.ground('#8a929d', 40, -0.5); c.box(22, 0.5, 13, '#e1e5ea', 0, -0.25, 0.8);

    const mk = {
      comp() { const g = new THREE.Group(); c.box(2.4, 1.3, 1.8, '#d6453d', 0, 0.65, 0, g); c.cyl(0.6, 0.6, 0.9, '#9b2f22', -0.4, 1.75, 0, g, 18); c.box(0.5, 0.5, 0.5, '#2b2f3a', 0.8, 1.55, 0, g); return g; },
      cond() { const g = new THREE.Group(); c.box(3.2, 1.6, 1.3, '#47b5a2', 0, 0.8, 0, g); for (let i = -4; i <= 4; i++) c.box(0.05, 1.5, 1.34, '#2f8f80', i * 0.33, 0.8, 0, g); c.cyl(0.6, 0.6, 0.12, '#2b2f3a', 0, 1.66, 0, g, 18); return g; },
      valve() { const g = new THREE.Group(); c.cyl(0.35, 0.35, 1.3, '#e8b92f', 0, 0.65, 0, g, 16); c.sph(0.45, '#d6453d', 0, 1.45, 0, g); c.box(1.1, 0.14, 0.14, '#f2f2f2', 0, 1.45, 0, g); return g; },
      evap() { const g = new THREE.Group(); c.box(3.2, 1.2, 1.4, '#7fd0ff', 0, 0.6, 0, g); for (let i = -4; i <= 4; i++) c.box(0.05, 1.1, 1.44, '#3c9fd6', i * 0.33, 0.6, 0, g); return g; },
    };
    const asm = assembler(c, {
      title: '❄️ 냉동 기기', limit: { x: [-9.5, 9.5], z: [-5, 7.5] },
      parts: [
        { kind: 'comp', name: '압축기', hint: '냉매 가스를 눌러 고온·고압으로 만들어요', make: mk.comp, slot: [SL[0][0], 0, SL[0][1]], rest: [-6.6, 6.4], r: 1.7 },
        { kind: 'cond', name: '응축기', hint: '뜨거운 냉매가 열을 밖으로 버리며 액체가 돼요', make: mk.cond, slot: [SL[1][0], 0, SL[1][1]], rest: [-2.2, 6.4], r: 1.8 },
        { kind: 'valve', name: '팽창밸브', hint: '압력을 확 낮춰 냉매를 차갑게 만들어요', make: mk.valve, slot: [SL[2][0], 0, SL[2][1]], rest: [2.2, 6.4], r: 1.2 },
        { kind: 'evap', name: '증발기', hint: '냉매가 증발하며 주변의 열을 빼앗아요', make: mk.evap, slot: [SL[3][0], 0, SL[3][1]], rest: [6.6, 6.4], r: 1.8 },
      ],
      onComplete() { phase = 'trans'; tt = 0; asm.lock(true); ui.hint('설치 완료! 배관 작업을 준비해요…'); snd(c, 'win'); },
    });

    const cn = connector(c, {
      ports: SL, y: PY,
      links: [[0, 1, '#e0533d'], [1, 2, '#f2a93b'], [2, 3, '#4fb6ff'], [3, 0, '#9fd8ff']],
      notes: ['고온·고압 가스 이송', '열을 버리고 액체로', '차갑게 팽창', '저압 가스를 압축기로'],
    });

    /* 냉매 입자(운전 중 배관을 따라 순환) */
    const loop = SL.map(([x, z]) => V3(x, PY, z)), SEG = loop.map((p, i) => p.distanceTo(loop[(i + 1) % 4])), TOT = SEG.reduce((a, b) => a + b, 0);
    const COL = ['#e0533d', '#f2a93b', '#4fb6ff', '#9fd8ff'];
    const prt = Array.from({ length: 28 }, (_, i) => { const m = c.sph(0.17, COL[0], 0, -9, 0); m.visible = false; return { m, s: (i / 28) * TOT, seg: -1 }; });
    const place = (q) => {
      let s = q.s % TOT, i = 0; while (i < 3 && s > SEG[i]) { s -= SEG[i]; i++; }
      q.m.position.lerpVectors(loop[i], loop[(i + 1) % 4], s / SEG[i]);
      if (q.seg !== i) { q.seg = i; q.m.material.color.set(COL[i]); }
    };

    const bM = ui.button({ icon: '➖', label: '개도↓', size: 78, pos: { left: '30px', bottom: '50px' }, down: () => setOpen(-1) });
    const bP = ui.button({ icon: '➕', label: '개도↑', size: 78, pos: { left: '124px', bottom: '50px' }, down: () => setOpen(1) });
    [bM, bP].forEach((b) => b.show(false));
    const setOpen = (d) => { if (phase !== 'run' || ended) return; open = clamp(open + d, 0, 10); c.sfx.click(); stat(); };
    const pw = () => (open - opt >= 3 ? 0.1 : clamp(1 - Math.abs(open - opt) / 6, 0.1, 1));

    const pipePanel = () => ui.panel(`<b>🔧 배관 ${cn.k}/4</b><br><small>냉매 순환 설계도<br>① 저압 가스를 고온·고압으로 압축<br>② 열을 밖으로 버리며 액체로 응축<br>③ 압력을 낮춰 차갑게 팽창<br>④ 주변 열을 흡수하며 증발<br>→ 다시 ①로 순환</small>`);
    const stat = () => {
      const dd = open - opt;
      const msg = dd >= 3 ? '⚠ 액백! 액냉매가 압축기로 넘어와요 → 개도↓' : dd === 0 ? '🟢 적정 개도!' : Math.abs(dd) === 1 ? '🟡 거의 맞았어요 (한 칸 더 조절)' : dd < 0 ? '냉매가 부족해요 → 개도↑' : '냉매가 너무 많아요 → 개도↓';
      const ok = T >= 1.5 && T <= 6;
      ui.panel(`<b>❄️ 냉장실 운전</b><br>🌡 <b style="color:${ok ? '#8fffb0' : '#fff'}">${T.toFixed(1)}℃</b> (목표 1.5~6℃)<br>🔧 팽창밸브 개도 ${open}/10<br>${msg}<br>유지 ${hold.toFixed(1)} / 6초`);
    };
    const startPipe = () => {
      phase = 'pipe'; cn.show(true); cam.to([0, 14, 9], [0, 0.5, 0.3]);
      ui.hint('접속구(●)를 끌어서 다음 기기의 접속구에 이어요'); pipePanel();
    };
    const startRun = () => {
      phase = 'run'; [bM, bP].forEach((b) => b.show(true)); cam.to([0, 12.5, 9.5], [0, 1, 0.8]);
      glassBox(root, 3.6, 2.0, 2.4, SL[3][0], 1.0, SL[3][1]); prt.forEach((q) => { q.m.visible = true; });
      ui.timer(left); ui.hint('➖ ➕ 로 개도를 맞춰 냉장실을 1.5~6℃로 유지해요 (PC: ↑↓ 키)'); stat();
    };
    const end = (win) => {
      if (ended) return; ended = true; [bM, bP].forEach((b) => b.show(false));
      const miss = asm.miss + cn.miss, score = 25 - Math.min(15, miss * 3) + (win ? 55 + clamp(left / 4, 0, 20) : (hold / 6) * 35);
      ui.hint(win ? '🎉 냉장실이 알맞게 차가워졌어요!' : '⏱ 시간 종료'); c.finish(Math.round(Math.max(0, score)));
    };

    cam.set([0, 15, 13], [0, 0, 1.5]); cam.fov(50, true);
    return {
      start() { asm.panel(); ui.hint('기기를 끌어서 흰 그림자에 맞춰요'); },
      down(p) { if (phase === 'asm') asm.down(p); else if (phase === 'pipe') cn.down(); },
      move(p) { if (phase === 'asm') asm.move(p); else if (phase === 'pipe') cn.move(); },
      up() {
        if (phase === 'asm') { asm.up(); return; }
        if (phase !== 'pipe') return;
        const r = cn.up(); if (!r) return;
        if (r === 'done') { phase = 'trans2'; tt = 0; ui.panel(''); ui.hint('배관 완료! 시운전을 준비해요…'); snd(c, 'win'); } else pipePanel();
      },
      key(code) { if (code === 'ArrowUp' || code === 'KeyW') setOpen(1); else if (code === 'ArrowDown' || code === 'KeyS') setOpen(-1); },
      idle(dt, t) { asm.pulse(t); },
      update(dt, t) {
        asm.pulse(t); cn.pulse(t);
        if (phase === 'trans') { tt += dt; if (tt > 1.2) startPipe(); return; }
        if (phase === 'trans2') { tt += dt; if (tt > 1.2) startRun(); return; }
        if (phase !== 'run') return;
        const P = pw(); prt.forEach((q) => { q.s += dt * (0.8 + 5 * P); place(q); });
        if (ended) return;
        left -= dt; ui.timer(left);
        T = clamp(T + (30 - 28 * P - T) * Math.min(1, 0.25 * dt), -5, 40);
        hold = T >= 1.5 && T <= 6 ? hold + dt : Math.max(0, hold - dt);
        acc += dt; if (acc > 0.15) { acc = 0; stat(); }
        if (hold >= 6) end(true); else if (left <= 0) end(false);
      },
    };
  },
});

/* ───────────────────────── 2. 스마트응용설계공학과 · 플랜트 시공 → 시운전 ───────────────────────── */
registerExperience('sad', {
  icon: '📐', title: '플랜트 설비 시공·시운전',
  desc: '저장탱크·펌프·열교환기·반응기·분리탑을 설치하고 배관을 이은 뒤, 올바른 순서로 가동해 제품을 만들어 보세요.',
  tools: ['🏭 플랜트 설비 5종', '🛡 안전밸브', '🔧 공정 배관'],
  steps: ['설비 5개와 안전밸브를 흰 그림자 위에 설치해요', '공정 흐름 순서대로 접속구(●)를 끌어 배관을 이어요', '시운전: 원료가 흐르는 순서대로 설비를 한 번씩 눌러 가동해요', '순서가 틀리면 경보! 45초 안에 끝내요'],
  env: SHOP,
  build(c) {
    const { root, ui, cam } = c;
    const NM = ['저장탱크', '펌프', '열교환기', '반응기', '분리탑'], X = [-9, -4.5, 0, 4.5, 9], SZ = -1.2, PY = 4.2;
    const TXT = ['🚰 저장탱크 출구밸브 열기', '⚙ 펌프 기동', '🔥 열교환기에 스팀 공급', '🧪 반응기 가동', '🗼 분리탑 가동'];
    const WHY = ['', '밸브를 열기 전에 펌프를 돌리면 공회전(캐비테이션)이 생겨요!', '유체가 오기 전에 가열하면 설비가 과열돼요!', '원료가 가열되기 전엔 반응이 일어나지 않아요!', '반응 생성물이 오기 전엔 분리할 것이 없어요!'];
    let phase = 'asm', tt = 0, ended = false, left = 45, step = 0, wrong = 0, acc = 0;
    const lst = shuffle([0, 1, 2, 3, 4]);

    c.ground('#8a929d', 40, -0.5); c.box(26, 0.5, 12, '#e1e5ea', 0, -0.25, 0.5);

    const mk = {
      tank() { const g = new THREE.Group(); c.cyl(1.3, 1.3, 2.4, '#9fb2c8', 0, 1.2, 0, g, 24); c.cyl(1.36, 1.36, 0.12, '#6f7a88', 0, 2.4, 0, g, 24); c.box(0.12, 2.2, 0.3, '#d6453d', 1.35, 1.1, 0, g); return g; },
      pump() { const g = new THREE.Group(); c.box(2.6, 0.3, 1.4, '#555d6b', 0, 0.15, 0, g); const p = c.cyl(0.65, 0.65, 1.2, '#e0533d', 0.3, 0.95, 0, g, 18); p.rotation.z = Math.PI / 2; c.box(0.9, 0.9, 0.9, '#2b2f3a', -0.9, 0.85, 0, g); return g; },
      hx() { const g = new THREE.Group(); const s = c.cyl(0.7, 0.7, 3.0, '#f2b84b', 0, 1.1, 0, g, 20); s.rotation.z = Math.PI / 2; c.box(0.3, 0.6, 1.2, '#555d6b', -0.9, 0.3, 0, g); c.box(0.3, 0.6, 1.2, '#555d6b', 0.9, 0.3, 0, g); c.cyl(0.74, 0.74, 0.12, '#d99a2b', 0, 1.1, 0, g, 20).rotation.z = Math.PI / 2; return g; },
      reactor() { const g = new THREE.Group(); c.cyl(1.0, 1.0, 2.0, '#47b5a2', 0, 1.0, 0, g, 24); const d = c.sph(1.0, '#47b5a2', 0, 2.0, 0, g); d.scale.y = 0.6; c.cyl(0.08, 0.08, 0.7, '#cfd6df', 0, 2.8, 0, g, 8); c.box(0.5, 0.4, 0.5, '#2b2f3a', 0, 3.2, 0, g); return g; },
      tower() { const g = new THREE.Group(); c.cyl(0.8, 0.8, 3.6, '#c06bd8', 0, 1.8, 0, g, 24); [0.9, 1.8, 2.7].forEach((y) => c.cyl(0.86, 0.86, 0.12, '#8a4aa0', 0, y, 0, g, 24)); return g; },
      relief() { const g = new THREE.Group(); c.cyl(0.12, 0.12, 1.4, '#cfd6df', 0, 0.7, 0, g, 10); c.sph(0.4, '#d6453d', 0, 1.5, 0, g); c.box(0.6, 0.12, 0.12, '#f2f2f2', 0, 1.9, 0, g); return g; },
    };
    const asm = assembler(c, {
      title: '🏭 플랜트 설비', limit: { x: [-12, 12], z: [-5, 6.5] },
      parts: [
        { kind: 'tank', name: '저장탱크', hint: '원료를 모아 두는 큰 용기', make: mk.tank, slot: [X[0], 0, SZ], rest: [-10, 4.6], r: 1.6 },
        { kind: 'pump', name: '펌프', hint: '원료에 압력을 줘서 밀어 보내요', make: mk.pump, slot: [X[1], 0, SZ], rest: [-6, 4.6], r: 1.5 },
        { kind: 'hx', name: '열교환기', hint: '원료를 반응 온도까지 데워요', make: mk.hx, slot: [X[2], 0, SZ], rest: [-2, 4.6], r: 1.7 },
        { kind: 'reactor', name: '반응기', hint: '화학 반응이 일어나는 핵심 설비', make: mk.reactor, slot: [X[3], 0, SZ], rest: [2, 4.6], r: 1.4 },
        { kind: 'tower', name: '분리탑', hint: '생성물을 끓는점 차이로 성분별 분리', make: mk.tower, slot: [X[4], 0, SZ], rest: [6, 4.6], r: 1.3 },
        { kind: 'relief', name: '안전밸브', hint: '반응기 압력이 너무 높아지면 자동으로 열려요', make: mk.relief, slot: [6.7, 0, 1.4], rest: [10, 4.6], r: 1.0 },
      ],
      onComplete() { phase = 'trans'; tt = 0; asm.lock(true); ui.hint('설치 완료! 배관 작업을 준비해요…'); snd(c, 'win'); },
    });

    const cn = connector(c, {
      ports: X.map((x) => [x, SZ]), y: PY,
      links: [[0, 1, '#9fb2c8'], [1, 2, '#e0533d'], [2, 3, '#f2b84b'], [3, 4, '#47b5a2']],
      notes: ['원료를 펌프로', '가압해서 가열기로', '반응 온도로 가열', '생성물을 분리탑으로'],
    });

    /* 가동된 설비의 배관에 유체 입자 흐름 */
    const pts = X.map((x) => V3(x, PY, SZ)), SC = ['#9fb2c8', '#e0533d', '#f2b84b', '#47b5a2'];
    const flow = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { const m = c.sph(0.17, SC[i], 0, -9, 0); m.visible = false; flow.push({ m, i, j }); }

    const runPanel = () => ui.panel('<b>🏭 시운전 체크리스트</b><br><small>원료가 흐르는 순서대로 설비를 눌러요</small><br>' +
      lst.map((i) => (i < step ? `✅ <span style="opacity:.6">${TXT[i]}</span>` : `⬜ ${TXT[i]}`)).join('<br>') + `<br>🚨 경보 ${wrong}회`);
    const pipePanel = () => ui.panel(`<b>🔧 배관 ${cn.k}/4</b><br><small>공정 흐름 설계도<br>① 원료를 보관<br>② 압력을 높여 이송<br>③ 반응 온도로 가열<br>④ 화학 반응<br>⑤ 성분별로 분리</small>`);

    const startPipe = () => { phase = 'pipe'; cn.show(true); cam.to([0, 15, 11], [0, 1, 0]); ui.hint('접속구(●)를 끌어서 공정 흐름 순서대로 이어요'); pipePanel(); };
    const startRun = () => { phase = 'run'; cam.to([0, 13, 12], [0, 1, 0]); ui.timer(left); ui.hint('설비를 눌러 순서대로 가동해요 (잘못 누르면 경보!)'); runPanel(); };
    const end = (win) => {
      if (ended) return; ended = true;
      const miss = asm.miss + cn.miss, score = 25 - Math.min(15, miss * 3) - Math.min(15, wrong * 5) + (win ? 60 + clamp(left / 3, 0, 15) : step * 10);
      ui.hint(win ? '🎉 플랜트 가동 성공! 제품이 생산돼요' : '⏱ 시간 종료'); c.finish(Math.round(Math.max(0, score)));
    };
    const tapEq = (i) => {
      const at = asm.items[i].g.getWorldPosition(new THREE.Vector3()).add(V3(0, 3.6, 0));
      if (i === 5) { ui.pop('🛡 안전밸브: 압력이 높으면 자동으로 열려요', at, '#a0e8ff'); return; }
      if (i < step) { ui.pop('이미 가동 중이에요', at, '#ffe9a0'); return; }
      if (i === step) { step++; snd(c, 'ok'); c.buzz(15); ui.pop('✔ ' + TXT[i], at, '#a0ffb8'); runPanel(); if (step >= 5) end(true); return; }
      wrong++; snd(c, 'bad'); ui.flash(); c.buzz(30); ui.pop('🚨 ' + WHY[i], at, '#ff8a80'); runPanel();
    };

    cam.set([0, 16, 13], [0, 0.5, 0.5]); cam.fov(50, true);
    return {
      start() { asm.panel(); ui.hint('설비를 끌어서 흰 그림자에 맞춰요'); },
      down(p) {
        if (phase === 'asm') { asm.down(p); return; }
        if (phase === 'pipe') { cn.down(); return; }
        if (phase !== 'run' || ended) return;
        const h = c.pick(asm.items.map((q) => q.g)); if (!h) return;
        const i = asm.items.findIndex((q) => { let o = h.object; while (o) { if (o === q.g) return true; o = o.parent; } return false; });
        if (i >= 0) tapEq(i);
      },
      move(p) { if (phase === 'asm') asm.move(p); else if (phase === 'pipe') cn.move(); },
      up() {
        if (phase === 'asm') { asm.up(); return; }
        if (phase !== 'pipe') return;
        const r = cn.up(); if (!r) return;
        if (r === 'done') { phase = 'trans2'; tt = 0; ui.panel(''); ui.hint('배관 완료! 시운전을 준비해요…'); snd(c, 'win'); } else pipePanel();
      },
      idle(dt, t) { asm.pulse(t); },
      update(dt, t) {
        asm.pulse(t); cn.pulse(t);
        if (phase === 'trans') { tt += dt; if (tt > 1.2) startPipe(); return; }
        if (phase === 'trans2') { tt += dt; if (tt > 1.2) startRun(); return; }
        if (phase !== 'run') return;
        flow.forEach((q) => {
          q.m.visible = step > q.i; if (!q.m.visible) return;
          const u = (q.j / 6 + t * 0.35) % 1; q.m.position.lerpVectors(pts[q.i], pts[q.i + 1], u);
        });
        if (ended) return;
        left -= dt; ui.timer(left);
        acc += dt; if (acc > 0.5) { acc = 0; runPanel(); }
        if (left <= 0) end(false);
      },
    };
  },
});