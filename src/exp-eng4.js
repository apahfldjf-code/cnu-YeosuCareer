/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng4.js (신규, E2-3b) — 공학대학 조기취업형 계약학과 체험
 *   sec : 스마트전기제어공학과 → 제어반 배선(자기유지 회로) 시운전 + PLC 타이머 컨베이어 자동화
 *   ict : 스마트ICT융합공학과  → IoT 데이터 흐름 구축 + 관제센터 이상 징후 탐지
 *   dig : 디지털융합정보학과   → 3D 대시보드 데이터 분석(드릴다운)으로 재구매율 하락 원인 찾기
 * 필요: experience.js, exp-kit.js(pipe, link), exp-eng3.js(tag)
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, rnd, shuffle } from './experience.js';
import { pipe, link } from './exp-kit.js';
import { tag } from './exp-eng3.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const LAB = { sky: '#dfe7f1', fog: ['#dfe7f1', 50, 150], sunColor: '#ffffff', sunI: 1.35, hemi: ['#f2f6ff', '#8c97a8', 1.0], sunPos: [18, 40, 22] };
const kill = (root, g) => { root.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); };
const ancestor = (o, key) => { let x = o; while (x && !(key in x.userData)) x = x.parent; return x || null; };
const lit = (m, on) => { m.color.set(on ? '#ffd23a' : '#2b2f3a'); m.emissive.set(on ? '#b07a00' : '#000000'); };

/* 꺾은선 그래프 간판(스프라이트): draw(기록[], 제목, 상태) */
function gsp(parent, w, h) {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = Math.round(320 * h / w);
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(w, h, 1); sp.renderOrder = 9; parent.add(sp);
  sp.userData.draw = (hist, title, st) => {
    const W = cv.width, H = cv.height, lo = 40, hi = 105, Y = (v) => H - 10 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (H * 0.72 - 10);
    g.clearRect(0, 0, W, H);
    g.fillStyle = st === 'down' ? 'rgba(120,30,30,.92)' : st === 'check' ? 'rgba(110,90,20,.92)' : 'rgba(12,28,56,.92)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; [55, 70].forEach((v) => { g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(W, Y(v)); g.stroke(); });
    g.strokeStyle = 'rgba(255,100,80,.85)'; g.lineWidth = 2; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(0, Y(85)); g.lineTo(W, Y(85)); g.stroke(); g.setLineDash([]);
    if (hist.length > 1) {
      const last = hist[hist.length - 1]; g.strokeStyle = last >= 85 ? '#ff9b80' : '#6de3ff'; g.lineWidth = 3; g.beginPath();
      hist.forEach((v, i) => { const x = (i / 29) * W, y = Y(v); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    }
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(H * 0.16)}px "Malgun Gothic","Noto Sans KR",sans-serif`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText(title, 10, 8, W - 20);
    tex.needsUpdate = true;
  };
  return sp;
}

/* ───────────────────────── 1. 스마트전기제어공학과 · 제어반 배선 + PLC 컨베이어 ───────────────────────── */
registerExperience('sec', {
  icon: '🎛️', title: 'PLC 제어반 배선·컨베이어 자동화',
  desc: '공장 설비를 움직이는 제어 회로를 직접 배선해 모터를 돌리고, 컨베이어 자동화 라인의 PLC 타이머를 조정해 불량 없이 많이 옮겨 보세요.',
  tools: ['🔴🟢 스위치·릴레이 부품 5종', '🧲 릴레이 자기유지 회로', '⏱ PLC 타이머(TON)'],
  steps: ['부품을 끌어서 제어 회로의 빈 칸 4곳에 놓아요', '🟢 기동 · 🔴 정지를 눌러 모터를 시험해요 (손을 떼도 계속 돌아야 해요)', '컨베이어 라인에서 ➖ ➕로 PLC 타이머 시간을 맞춰요', '로봇 팔이 집기 전에 컨베이어가 출발하면 상자를 놓쳐요!'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c, CY = 4.0, GR = 2.2, SPD = 3.2, SPX = -9, SENS = 3, ENDX = 8.6, GAP = 3.0;
    let phase = 'wire', drag = null, rewires = 0, tt = 0, left = 45, relay = false, startP = false, stopP = false, fanW = 0, sig = '', lastRelay = null, lastPlc = '', T = {};
    const resetT = () => { T = { on: false, hold: false, stop: false, ht: 0, warn: false, sd: 0, sw: false, sd2: 0, sw2: false }; };
    resetT();
    c.ground('#aeb8c4', 32);
    const s1 = new THREE.Group(), s2 = new THREE.Group(); s2.visible = false; root.add(s1, s2);

    /* ── 1단계 무대: 배선판 ── */
    c.box(21, 0.6, 9.8, '#3d4a5c', 0, 0.3, -2, s1); c.box(20, 0.12, 8.8, '#eaf0f6', 0, 0.66, -2, s1); c.box(20.6, 0.4, 3.4, '#6b7a8e', 0, 0.2, 5.8, s1);
    const wm = () => new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.6 });
    const W0 = wm(), W1 = wm(), WB = wm(), WC = wm(), WJ = wm(), WD = wm(); lit(W0, true);
    const mkWire = (x1, z1, x2, z2, m) => { const w = new THREE.Mesh(new THREE.BoxGeometry(Math.max(Math.abs(x2 - x1), 0.18), 0.08, Math.max(Math.abs(z2 - z1), 0.18)), m); w.position.set((x1 + x2) / 2, 0.8, (z1 + z2) / 2); s1.add(w); };
    mkWire(-8.5, -5.2, -8.5, 1.2, W0); mkWire(-8.5, -2, -6.2, -2, W0);
    mkWire(-3.8, -2, -2.4, -2, W1); mkWire(-2.4, -4.2, -2.4, 0.2, W1);
    mkWire(-2.4, -4.2, -1.2, -4.2, WB); mkWire(1.2, -4.2, 2.4, -4.2, WB);
    mkWire(-2.4, 0.2, -1.2, 0.2, WC); mkWire(1.2, 0.2, 2.4, 0.2, WC);
    mkWire(2.4, -4.2, 2.4, 0.2, WJ); mkWire(2.4, -2, 4.3, -2, WJ);
    mkWire(6.7, -2, 8.5, -2, WD); mkWire(8.5, -5.2, 8.5, 1.2, WD); mkWire(8.5, -2, 12.2, -2, WD);
    /* 모터 */
    c.box(3.4, 0.7, 3.4, '#3d4a5c', 13.5, 0.35, -2, s1);
    const body = c.cyl(1.0, 1.0, 2.4, '#2f6fed', 13.2, 1.7, -2, s1); body.rotation.z = Math.PI / 2;
    const fan = new THREE.Group(); fan.position.set(14.8, 1.7, -2); s1.add(fan);
    c.box(0.12, 2.6, 0.45, '#e8ecf2', 0, 0, 0, fan); c.box(0.12, 0.45, 2.6, '#e8ecf2', 0, 0, 0, fan);
    const tMotor = tag(s1, '', 3.8, 0.8); tMotor.position.set(13.5, 4.4, -2);
    /* 슬롯 */
    const SLOT = [[-5, -2], [0, -4.2], [0, 0.2], [5.5, -2]], SN = ['① 직렬', '② 병렬(위)', '② 병렬(아래)', '③ 출력'];
    const slotMesh = SLOT.map(([x, z], i) => {
      const m = c.box(2.5, 0.1, 1.5, '#ffffff', x, 0.8, z, s1); m.material.transparent = true; m.material.depthWrite = false;
      const t = tag(s1, SN[i], 2.4, 0.6, '#fff', 'rgba(40,60,90,.78)'); t.position.set(x, 1.9, z); return m;
    });
    /* 부품 */
    const PD = [
      { kind: 'nc', n: '정지(b접점)', ic: '🔴', col: '#d6453d' }, { kind: 'no', n: '기동(a접점)', ic: '🟢', col: '#3aa86a' },
      { kind: 'r1', n: '릴레이 접점', ic: '🔁', col: '#f2b84b' }, { kind: 'coil', n: '릴레이 코일 R1', ic: '🧲', col: '#4c8dd9' }, { kind: 'lamp', n: '표시등', ic: '💡', col: '#c06bd8' },
    ];
    const mkPart = (d) => {
      const g = new THREE.Group(); g.userData.part = true; c.box(2.0, 0.5, 1.3, '#2b2f3a', 0, 0, 0, g);
      g.userData.top = c.cyl(0.45, 0.45, 0.35, d.col, 0, 0.4, 0, g, 20);
      const t = tag(g, `${d.ic} ${d.n}`, 3.4, 0.7); t.position.set(0, 1.5, 0); return g;
    };
    const parts = PD.map((d, i) => { const g = mkPart(d), rest = [i * 4 - 8, 0.65, 5.8]; g.position.set(rest[0], rest[1], rest[2]); s1.add(g); return { d, g, rest, slot: -1, top: g.userData.top }; });
    const occ = [null, null, null, null];
    const toRest = (q) => { q.slot = -1; q.g.position.set(q.rest[0], q.rest[1], q.rest[2]); };

    /* ── 회로 시뮬레이션 (a접점·b접점·릴레이 자기유지) ── */
    const part = (i) => (occ[i] ? occ[i].d.kind : null);
    const hasKind = (k) => occ.some((q) => q && q.d.kind === k);
    const cond = (i) => { const k = part(i); if (!k) return false; return k === 'nc' ? !stopP : k === 'no' ? startP : k === 'r1' ? relay : true; };
    const simulate = () => {
      const a = cond(0), b = cond(1), d2 = cond(2), e = cond(3), par = b || d2, path = a && par && e;
      relay = path && hasKind('coil');
      lit(W1, a); lit(WB, a && b); lit(WC, a && d2); lit(WJ, a && par); lit(WD, path);
      parts.forEach((q) => { const k = q.d.kind, on = q.slot >= 0 && (k === 'coil' || k === 'r1' ? relay : k === 'lamp' ? path : false); q.top.material.emissive.set(on ? q.d.col : '#000000'); });
      if (relay !== lastRelay) { lastRelay = relay; tMotor.userData.set(relay ? '⚙️ 모터 가동 중' : '⚙️ 모터 정지', '#fff', relay ? 'rgba(30,120,70,.92)' : 'rgba(60,70,90,.9)'); }
    };

    /* ── 버튼 ── */
    const bOk = ui.button({ icon: '▶', label: '시운전', size: 86, cls: 'grn', pos: { right: '30px', bottom: '40px' }, down: () => toTest() });
    const bStart = ui.button({ icon: '🟢', label: '기동', size: 84, cls: 'grn', pos: { right: '30px', bottom: '40px' } });
    const bStop = ui.button({ icon: '🔴', label: '정지', size: 84, cls: 'red', pos: { right: '130px', bottom: '40px' } });
    const bRe = ui.button({ icon: '🔧', label: '배선수정', size: 64, pos: { right: '30px', bottom: '140px' }, down: () => backToWire() });
    const bMinus = ui.button({ icon: '➖', label: 'T 줄이기', size: 80, pos: { right: '130px', bottom: '40px' }, down: () => adj(-0.5) });
    const bPlus = ui.button({ icon: '➕', label: 'T 늘리기', size: 80, pos: { right: '30px', bottom: '40px' }, down: () => adj(0.5) });
    [bOk, bStart, bStop, bRe, bMinus, bPlus].forEach((b) => b.show(false));

    const refresh = () => {
      const n = occ.filter(Boolean).length;
      ui.panel(`<b>🔧 제어 회로 배선 ${n}/4</b><br><small>🟢 a접점: 평소 끊김 · 누르면 연결<br>🔴 b접점: 평소 연결 · 누르면 끊김<br>🧲 코일에 전류가 흐르면 🔁 릴레이 접점이 닫혀요</small>`);
      bOk.show(phase === 'wire' && n === 4);
    };
    const testPanel = () => ui.panel(`<b>🔌 시운전</b><br>${T.on ? '✅' : '⬜'} ① 🟢 기동 → 모터가 돌아요<br>${T.hold ? '✅' : '⬜'} ② 손을 떼도 계속 돌아요 (자기유지)<br>${T.stop ? '✅' : '⬜'} ③ 🔴 정지 → 모터가 멈춰요`);
    const drop = (q) => {
      let bi = -1, bd = 2.6; SLOT.forEach(([x, z], i) => { const d = Math.hypot(x - q.g.position.x, z - q.g.position.z); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { toRest(q); c.sfx.click(); refresh(); return; }
      const o = occ[bi]; if (o) toRest(o);
      occ[bi] = q; q.slot = bi; q.g.position.set(SLOT[bi][0], 1.15, SLOT[bi][1]); c.sfx.pickup(); c.buzz(15); refresh();
    };
    const toTest = () => {
      if (phase !== 'wire' || !occ.every(Boolean)) return;
      phase = 'test'; resetT(); relay = false; bOk.show(false); [bStart, bStop, bRe].forEach((b) => b.show(true)); testPanel(); c.sfx.go();
      ui.hint('🟢 기동을 누르고 있다가 손을 떼 보세요 (PC: Z=기동, X=정지)');
    };
    const backToWire = () => {
      if (phase !== 'test') return; phase = 'wire'; rewires++; relay = false; resetT(); [bStart, bStop, bRe].forEach((b) => b.show(false)); refresh();
      ui.hint(rewires >= 2 ? '💡 힌트: 🔴 정지(b접점)는 맨 앞 직렬, 🟢 기동과 🔁 릴레이 접점은 병렬(②)에, 🧲 코일은 출력(③)에' : '손을 떼도 계속 돌려면 전류가 계속 흐르는 길(자기유지)이 필요해요');
    };
    const whyNot = () => {
      if (!hasKind('coil')) return '🧲 릴레이 코일이 회로에 없어요. 전류가 코일을 지나야 릴레이가 작동해요';
      if (!hasKind('no')) return '🟢 기동 스위치가 회로에 없어요';
      if (!hasKind('nc')) return '🔴 정지 스위치(b접점)가 회로에 없어요';
      return '전류가 코일까지 못 가고 있어요 · 🔴 정지는 평소 연결(b접점)이라 맨 앞 직렬 칸, 💡 표시등은 코일이 아니에요';
    };
    const testStep = (dt) => {
      if (startP && relay && !T.on) { T.on = true; testPanel(); ui.hint('모터가 돌아요! 이제 🟢에서 손을 떼 보세요'); }
      if (T.on && !T.hold) {
        if (!startP) {
          if (relay) { T.ht += dt; if (T.ht >= 1.0) { T.hold = true; testPanel(); c.sfx.ok(); ui.hint('손을 떼도 계속 돌아요! 자기유지 성공 · 이제 🔴 정지를 눌러 봐요'); } }
          else { T.ht = 0; if (!T.warn) { T.warn = true; ui.hint('손을 떼니 멈췄어요 😮 병렬(②)에 릴레이 접점을 두어 전류가 계속 흐르는 길을 만들어요'); } }
        } else T.warn = false;
      }
      if (T.hold && !T.stop) {
        if (stopP && !relay) { T.stop = true; testPanel(); phase = 'trans'; tt = 0; c.sfx.win(); ui.banner('✅ 제어 회로 완성!'); ui.hint('이제 이 모터로 컨베이어 자동화 라인을 운전해요'); [bStart, bStop, bRe].forEach((b) => b.show(false)); }
        else if (stopP && relay) { T.sd2 += dt; if (T.sd2 > 1.5 && !T.sw2) { T.sw2 = true; ui.hint('정지를 눌러도 안 멈춰요 · 🔴 정지(b접점)는 맨 앞 직렬 칸에 두어야 전류를 끊을 수 있어요'); } } else { T.sd2 = 0; T.sw2 = false; }
      }
      if (startP && !relay && !T.on) { T.sd += dt; if (T.sd > 1.5 && !T.sw) { T.sw = true; ui.hint(whyNot()); } } else if (!startP) { T.sd = 0; T.sw = false; }
    };

    /* ── 2단계 무대: 컨베이어 + 로봇 팔 + PLC 타이머 ── */
    c.box(20.4, 0.5, 2.6, '#555e6b', -0.5, 0.5, 0, s2); c.box(0.4, 0.5, 2.2, '#3d4a5c', -9, 0.25, 0, s2); c.box(0.4, 0.5, 2.2, '#3d4a5c', 8, 0.25, 0, s2);
    const stripes = []; for (let i = 0; i < 11; i++) stripes.push(c.box(0.2, 0.02, 2.4, '#3a4250', -10 + i * 2, 0.77, 0, s2));
    c.cyl(0.12, 0.12, 1.6, '#9aa5b5', SENS, 1.3, 1.9, s2); c.box(0.45, 0.3, 0.3, '#d6453d', SENS, 2.15, 1.9, s2);
    const beam = c.box(0.05, 0.05, 3.2, '#ff4040', SENS, 1.5, 0.3, s2);
    const tSens = tag(s2, '👁 센서', 2.4, 0.6); tSens.position.set(SENS, 3.0, 1.9);
    c.cyl(0.4, 0.5, 3.4, '#7a8499', SENS, 1.7, -3.6, s2);
    const arm = new THREE.Group(); arm.position.set(SENS, 3.4, -3.6); arm.rotation.x = -0.45; s2.add(arm);
    c.box(0.5, 0.5, 3.6, '#f2a93b', 0, 0, 1.8, arm); c.box(0.9, 0.25, 0.9, '#e8e8e8', 0, -0.05, 3.6, arm);
    const tArm = tag(s2, '🦾 로봇 팔', 2.6, 0.6); tArm.position.set(SENS, 5.6, -3.6);
    c.box(3.2, 0.3, 3.0, '#a9774a', 7.2, 0.15, -3.6, s2);
    const tPlc = tag(s2, '', 4.6, 0.8); tPlc.position.set(-4, 3.2, -2);
    const cv = { boxes: [], stopped: false, spawnCd: 0, arm: { busy: false, t: 0, tc: 0, box: null }, deliv: 0, lost: 0, Tset: 1.0, warned: false };
    const theta = (t) => { const f = t / CY, S = (k) => k * k * (3 - 2 * k), dn = 0.37, up = -0.45; if (f < 0.3) return up + (dn - up) * S(f / 0.3); if (f < 0.55) return dn; if (f < 0.85) return dn + (up - dn) * S((f - 0.55) / 0.3); return up; };
    const spawn = () => {
      const g = new THREE.Group(); c.box(1.2, 1.2, 1.2, '#c98a4b', 0, 0, 0, g); c.box(1.22, 0.2, 1.22, '#e8d9b5', 0, 0.2, 0, g); g.position.set(SPX, 1.35, 0); s2.add(g);
      cv.boxes.push({ g, x: SPX, h: false, att: false, lost: false });
    };
    const deliver = (b) => {
      cv.deliv++; const i = cv.deliv - 1; b.g.scale.setScalar(0.66); b.g.position.set(7.2 + ((i % 3) - 1) * 1.0, 0.7 + Math.floor(i / 3) * 0.8, -3.6); if (i >= 12) b.g.visible = false;
      cv.boxes = cv.boxes.filter((x) => x !== b); c.sfx.ok(); ui.pop('📦 +1', V3(b.g.position.x, b.g.position.y + 1.5, b.g.position.z), '#a0ffb8');
    };
    const adj = (d) => { if (phase !== 'conv') return; cv.Tset = clamp(Math.round((cv.Tset + d) * 2) / 2, 0.5, 8); c.sfx.click(); };
    const startConv = () => {
      phase = 'conv'; s1.visible = false; s2.visible = true; [bOk, bStart, bStop, bRe].forEach((b) => b.show(false)); bMinus.show(true); bPlus.show(true);
      cam.set([2, 12, 13], [1, 0.5, -0.8]); cam.fov(50, true); left = 45; sig = ''; ui.hint('➕ ➖ 로 PLC 타이머 T를 조정해요 · 상자가 센서에서 멈춘 뒤 T초 후에 컨베이어가 다시 출발해요');
    };
    const endConv = () => {
      if (phase === 'end') return; phase = 'end'; bMinus.show(false); bPlus.show(false); ui.timer(null);
      const s1sc = clamp(40 - 6 * rewires, 16, 40), s2sc = clamp(cv.deliv * 6 - cv.lost * 3, 0, 60);
      ui.panel(`<b>📋 결과</b><br>🔧 회로 시운전 ${s1sc}/40 (배선 수정 ${rewires}번)<br>📦 완료 ${cv.deliv} · ❌ 놓침 ${cv.lost} → ${s2sc}/60`);
      ui.hint(cv.lost > 3 ? '타이머가 짧으면 팔이 집기 전에 컨베이어가 출발해요. 하지만 너무 길면 생산이 느려져요' : '타이머를 알맞게 맞추면 불량 없이 많이 옮길 수 있어요');
      c.finish(s1sc + s2sc);
    };
    const convUpdate = (dt) => {
      left -= dt; ui.timer(left); if (left <= 0) { endConv(); return; }
      const a = cv.arm; cv.spawnCd -= dt;
      if (a.busy) {
        a.t += dt;
        if (a.t >= GR && a.box && !a.box.att) { a.box.att = true; c.sfx.pickup(); }
        if (a.t >= CY) { deliver(a.box); a.box = null; a.busy = false; a.t = 0; }
      }
      if (cv.stopped && a.busy) {
        a.tc += dt;
        if (a.tc >= cv.Tset) {
          cv.stopped = false;
          if (a.t < GR) { const b = a.box; b.lost = true; a.box = null; a.busy = false; a.t = 0; if (!cv.warned) { cv.warned = true; ui.hint('🔔 로봇 팔이 집기 전에 컨베이어가 출발해 상자를 놓쳤어요! ➕로 T를 늘려요'); } }
        }
      }
      if (!cv.stopped) {
        if (cv.spawnCd <= 0 && cv.boxes.every((b) => b.att || b.x > SPX + GAP)) { spawn(); cv.spawnCd = 0.8; }
        cv.boxes.forEach((b) => { if (!b.att) b.x += SPD * dt; });
      }
      const hit = cv.boxes.filter((b) => !b.att && !b.h && !b.lost && b.x >= SENS).sort((p, q) => q.x - p.x)[0];
      if (hit) {
        hit.x = SENS;
        if (!a.busy) { hit.h = true; a.busy = true; a.t = 0; a.tc = 0; a.box = hit; cv.stopped = true; c.sfx.click(); } else cv.stopped = true;
      } else if (cv.stopped && !a.busy) cv.stopped = false;
      cv.boxes.slice().forEach((b) => { if (b.lost && b.x > ENDX) { cv.lost++; ui.pop('❌ 놓침', null, '#ffd0d0'); c.sfx.bump(); kill(s2, b.g); cv.boxes = cv.boxes.filter((x) => x !== b); } });
      arm.rotation.x += ((a.busy ? theta(a.t) : -0.45) - arm.rotation.x) * Math.min(1, 12 * dt);
      cv.boxes.forEach((b) => { if (b.att) b.g.position.set(SENS, 3.4 - 3.6 * Math.sin(arm.rotation.x) - 0.8, -3.6 + 3.6 * Math.cos(arm.rotation.x)); else b.g.position.x = b.x; });
      if (!cv.stopped) stripes.forEach((s) => { s.position.x += SPD * dt; if (s.position.x > 9.5) s.position.x -= 22; });
      const waiting = cv.stopped; beam.material.color.set(waiting ? '#4dff88' : '#ff4040');
      const plc = `PLC ${cv.stopped ? '■ 정지' : '▶ 가동'} · T=${cv.Tset.toFixed(1)}초`;
      if (plc !== lastPlc) { lastPlc = plc; tPlc.userData.set(plc, '#fff', cv.stopped ? 'rgba(160,100,30,.92)' : 'rgba(30,120,70,.92)'); }
      const k = `${cv.Tset}|${cv.deliv}|${cv.lost}`;
      if (k !== sig) { sig = k; ui.panel(`<b>⏱ PLC 타이머(TON) T = ${cv.Tset.toFixed(1)}초</b><br>📦 완료 ${cv.deliv} · ❌ 놓침 ${cv.lost}<br><small>상자가 센서에서 멈추면 T초 뒤 컨베이어가 출발해요.<br>로봇 팔이 상자를 집을 시간이 필요해요.</small>`); }
    };
    const pulse = (t) => slotMesh.forEach((m, i) => { m.material.opacity = occ[i] ? 0.15 : 0.4 + 0.22 * Math.sin(t * 4); });

    cam.set([0, 19, 10], [0, 0, 0.5]); cam.fov(50, true); simulate();
    return {
      start() { refresh(); ui.hint('부품을 끌어서 ①~③ 빈 칸에 놓아요 · 놓은 부품은 다시 끌어 바꿀 수 있어요'); },
      down(p) {
        if (phase !== 'wire') return; let q = null; const h = c.pick(parts.map((x) => x.g));
        if (h) { const o = ancestor(h.object, 'part'); q = parts.find((x) => x.g === o) || null; }
        if (!q) { const pt0 = c.at(0.9); if (pt0) { let bd = 1.7; parts.forEach((x) => { const d = Math.hypot(x.g.position.x - pt0.x, x.g.position.z - pt0.z); if (d < bd) { bd = d; q = x; } }); } }
        if (!q) return; const pt = c.at(2.2); if (!pt) return;
        drag = { q, sx: p.x, sy: p.y, moved: false, ox: q.g.position.x - pt.x, oz: q.g.position.z - pt.z };
      },
      move(p) {
        if (!drag || !p.down) return; const d = drag;
        if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 8) { d.moved = true; if (d.q.slot >= 0) { occ[d.q.slot] = null; d.q.slot = -1; refresh(); } c.sfx.click(); }
        if (d.moved) { const pt = c.at(2.2); if (pt) d.q.g.position.set(clamp(pt.x + d.ox, -15, 15), 2.2, clamp(pt.z + d.oz, -7, 8)); }
      },
      up() {
        if (!drag) return; const d = drag; drag = null;
        if (!d.moved) { if (d.q.slot >= 0) { occ[d.q.slot] = null; toRest(d.q); c.sfx.click(); refresh(); } return; }
        drop(d.q);
      },
      key(code) {
        if (phase === 'wire' && code === 'Enter') toTest();
        else if (phase === 'conv') { if (code === 'ArrowUp' || code === 'Equal') adj(0.5); else if (code === 'ArrowDown' || code === 'Minus') adj(-0.5); }
      },
      update(dt, t) {
        if (phase === 'wire' || phase === 'test' || phase === 'trans') {
          startP = phase === 'test' && (bStart.held() || c.keys.has('KeyZ')); stopP = phase === 'test' && (bStop.held() || c.keys.has('KeyX'));
          simulate(); fanW += ((relay ? 14 : 0) - fanW) * Math.min(1, 3 * dt); fan.rotation.x += fanW * dt; pulse(t);
          if (phase === 'test') testStep(dt); else if (phase === 'trans') { tt += dt; if (tt >= 1.8) startConv(); }
        } else if (phase === 'conv') convUpdate(dt);
      },
      idle(dt, t) { pulse(t); },
    };
  },
});

/* ───────────────────────── 2. 스마트ICT융합공학과 · IoT 데이터 흐름 + 관제센터 ───────────────────────── */
registerExperience('ict', {
  icon: '📶', title: 'IoT 스마트팩토리 관제센터',
  desc: '센서의 데이터가 클라우드와 AI를 거쳐 설비를 제어하기까지의 흐름을 직접 구축하고, 관제센터에서 그래프를 읽어 고장 나기 전에 설비를 점검해 보세요.',
  tools: ['🌡️ 센서·게이트웨이·클라우드', '🧠 AI 분석', '📈 실시간 그래프 관제'],
  steps: ['흩어진 5개 설비를 데이터가 흘러가는 순서대로 눌러요', '관제센터에서 4대 설비의 온도 그래프를 지켜봐요', '꾸준히 오르는 설비를 눌러 점검 출동! (잠깐 튀는 값은 노이즈예요)', '너무 늦으면 설비가 멈추고, 헛출동은 감점이에요'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c, NM = ['A', 'B', 'C', 'D'];
    let phase = 'net', prog = 0, mistakes = 0, ft = 0, left = 52, sig = '', endT = -1;
    c.ground('#aeb8c4', 34);
    const s1 = new THREE.Group(), m1 = new THREE.Group(); m1.visible = false; root.add(s1, m1);

    /* ── 1단계: 데이터 흐름 구축 ── */
    const ST = [
      { k: '센서', ic: '🌡️', info: '센서가 온도·진동을 측정' }, { k: '게이트웨이', ic: '📡', info: '게이트웨이로 데이터 전송' }, { k: '클라우드', ic: '☁️', info: '클라우드 서버에 저장' },
      { k: 'AI', ic: '🧠', info: 'AI가 이상 징후 분석' }, { k: '제어', ic: '🛠️', info: '설비 자동 제어·알림 전송' },
    ];
    const mkSt = (i) => {
      const g = new THREE.Group(); g.userData.si = i;
      if (i === 0) { c.box(2.4, 1.2, 2.4, '#5f6b7a', 0, 0.6, 0, g); c.cyl(0.25, 0.25, 1.0, '#9aa5b5', 0.7, 1.7, 0.7, g); c.sph(0.35, '#e0533d', 0.7, 2.35, 0.7, g); }
      else if (i === 1) { c.box(2.2, 1.0, 1.6, '#47b5a2', 0, 0.5, 0, g); for (let k = 0; k < 3; k++) c.cyl(0.07, 0.07, 1.8, '#dfe6ee', -0.7 + k * 0.7, 1.9, 0, g, 8); }
      else if (i === 2) { for (let k = 0; k < 3; k++) { c.box(2.0, 0.8, 1.6, '#cfd8e6', 0, 0.4 + k * 0.9, 0, g); c.box(0.2, 0.12, 0.05, '#4be37a', 0.7, 0.4 + k * 0.9, 0.82, g); } }
      else if (i === 3) { c.cyl(0.9, 1.1, 0.8, '#3d4a5c', 0, 0.4, 0, g); c.sph(0.95, '#d58cf0', 0, 1.8, 0, g); }
      else { c.box(2.4, 1.4, 1.8, '#f2b84b', 0, 0.7, 0, g); c.cyl(0.35, 0.35, 0.7, '#d6453d', 0.6, 1.75, 0, g); c.cyl(0.18, 0.18, 0.15, '#3aa86a', -0.5, 1.45, 0.6, g); }
      const t = tag(g, `${ST[i].ic} ${ST[i].info}`, 5.6, 1.0); t.position.set(0, 4.2, 0); return g;
    };
    const glow = (g, on) => g.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.set(on ? '#3a6a30' : '#000000'); });
    const P5 = shuffle([[-12, 2], [-6, -5], [0, 3], [6, -5], [12, 2]]);
    const stations = ST.map((s, i) => { const g = mkSt(i); g.position.set(P5[i][0], 0, P5[i][1]); s1.add(g); return { g, i, pos: V3(P5[i][0], 1.8, P5[i][1]) }; });
    const beams = [], packet = c.sph(0.38, '#fff27a', 0, -9, 0, s1); packet.material.emissive = new THREE.Color('#ffcc33'); packet.visible = false;
    const netPanel = () => ui.panel(`<b>📶 데이터 흐름 ${prog}/5</b><br>${ST.map((s, i) => (i < prog ? `✅ ${i + 1}. ${s.ic} ${s.k}` : `⬜ ${i + 1}. ?`)).join('<br>')}<br><small>데이터가 처음 만들어지는 곳부터 눌러요</small>`);
    const tapNet = (st) => {
      if (st.i === prog) {
        glow(st.g, true); if (prog > 0) { const b = pipe(root, 0.12, '#ffffff'); link(b, stations[prog - 1].pos, st.pos); beams.push(b); }
        st.g.scale.setScalar(1); prog++; c.sfx.ok(); c.buzz(15); ui.pop(`${prog}단계 ✔`, st.pos.clone().add(V3(0, 3, 0)), '#a0ffb8'); netPanel();
        if (prog === 5) { phase = 'flow'; ft = 0; packet.visible = true; ui.hint('데이터가 흘러가요…'); c.sfx.win(); }
      } else {
        mistakes++; c.sfx.bump(); ui.pop('아직 이 단계가 아니에요', st.pos.clone().add(V3(0, 3, 0)), '#ffd0d0');
        ui.hint(mistakes >= 2 ? '💡 반짝이는 설비가 다음 순서예요' : '데이터는 만들어지고 → 전달되고 → 저장되고 → 분석되고 → 조치로 이어져요');
      }
    };

    /* ── 2단계: 관제센터 ── */
    const gtag = (txt, col) => ({ txt, col });
    const MS = [0, 1, 2, 3].map((i) => {
      const g = new THREE.Group(); g.userData.mi = i; g.position.set(-9.6 + i * 6.4, 0, 0); m1.add(g);
      c.box(4, 2.4, 3, '#5f6b7a', 0, 1.2, 0, g); c.box(4.2, 0.3, 3.2, '#3d4a5c', 0, 2.55, 0, g);
      const lamp = c.sph(0.3, '#4be37a', 1.5, 2.95, 1.1, g), gr = gsp(g, 5.4, 3.0); gr.position.set(0, 5.6, 0);
      const tg = tag(g, '', 3.6, 0.8); tg.position.set(0, 0.6, 2.8);
      return { g, lamp, gr, tg, i, base: 58 + i * 3, w: 0, hist: [], temp: 58 + i * 3, state: 'run', fault: false, tf: 0, pause: 0, spike: 0, last: '' };
    });
    const mon = { t: 0, acc: 0, next: [7, 17, 27, 37].map((v) => v + rnd(-1.5, 1.5)), fi: 0, fixed: 0, broke: 0, falseN: 0, pts: 0, spikeCd: 3, done: 0 };
    const syncM = (m) => {
      const k = m.state; if (k === m.last) return; m.last = k;
      m.lamp.material.color.set(k === 'run' ? '#4be37a' : k === 'check' ? '#f2c94c' : '#e0533d');
      m.tg.userData.set(k === 'run' ? `설비 ${NM[m.i]} ✅ 정상` : k === 'check' ? `설비 ${NM[m.i]} 🔍 점검 중` : `설비 ${NM[m.i]} 💥 정지 · 눌러서 수리`, '#fff', k === 'run' ? 'rgba(30,120,70,.9)' : k === 'check' ? 'rgba(150,120,20,.9)' : 'rgba(150,40,40,.92)');
    };
    const sample = () => MS.forEach((m) => {
      m.w = m.w * 0.8 + rnd(-2, 2); let v = m.base + m.w;
      if (m.state === 'down') v = 100 + rnd(-0.5, 0.5); else { if (m.fault) v += m.tf * 2.6; if (m.spike > 0) { v += 14; m.spike--; } }
      m.temp = v; m.hist.push(v); if (m.hist.length > 30) m.hist.shift();
      m.gr.userData.draw(m.hist, `설비 ${NM[m.i]} · ${Math.round(v)}℃`, m.state);
    });
    const monPanel = () => {
      const k = `${mon.fixed}|${mon.broke}|${mon.falseN}`; if (k === sig) return; sig = k;
      ui.panel(`<b>🏭 관제센터</b><br>🔧 조치 ${mon.fixed} · 💥 고장 ${mon.broke} · 🔍 헛출동 ${mon.falseN}<br><small>그래프가 꾸준히 오르는 설비를 눌러요.<br>점선(85℃)을 넘기 전에 잡을수록 고득점!</small>`);
    };
    const startMon = () => {
      phase = 'mon'; s1.visible = false; m1.visible = true; cam.set([0, 10, 17], [0, 3.2, 0]); cam.fov(50, true); left = 52; sig = ''; MS.forEach((m) => { syncM(m); });
      for (let k = 0; k < 6; k++) sample(); ui.banner('🌐 IoT 데이터 흐름 완성!'); ui.hint('그래프가 꾸준히 오르는 설비를 눌러 점검 출동! 잠깐 튀는 값은 노이즈예요'); monPanel();
    };
    const endMon = () => {
      if (phase === 'end') return; phase = 'end'; ui.timer(null);
      const s1sc = clamp(25 - 4 * mistakes, 5, 25), s2sc = clamp(mon.pts - 6 * mon.falseN, 0, 75);
      ui.panel(`<b>📋 결과</b><br>📶 데이터 흐름 구축 ${s1sc}/25<br>🏭 관제 ${s2sc}/75<br><small>조치 ${mon.fixed} · 고장 ${mon.broke} · 헛출동 ${mon.falseN}</small>`);
      ui.hint(mon.broke ? '이상 징후는 값이 한 번 튀는 것보다 꾸준한 상승 추세를 봐야 해요' : '추세를 읽고 미리 대응하는 것이 스마트팩토리의 핵심이에요'); c.finish(s1sc + s2sc);
    };
    const tapMon = (m) => {
      const pos = m.g.position.clone().add(V3(0, 3.6, 0));
      if (m.state === 'down') { m.state = 'check'; m.pause = 4; m.hist = []; m.w = 0; ui.pop('🔧 수리 중…', pos, '#ffe9a0'); c.sfx.click(); syncM(m); return; }
      if (m.state === 'check') return;
      if (m.fault) {
        const v = m.temp, pt = v < 80 ? 19 : v < 92 ? 11 : 5; mon.pts += pt; mon.fixed++; mon.done++; m.fault = false; m.tf = 0; m.spike = 0; m.state = 'check'; m.pause = 2.5;
        ui.pop(`🔧 조치 성공! +${pt}${v < 80 ? ' (조기 발견)' : ''}`, pos, '#a0ffb8'); c.sfx.ok(); c.buzz(20);
      } else { mon.falseN++; m.state = 'check'; m.pause = 3; ui.pop('이상 없음 😅 −6', pos, '#ffd0d0'); c.sfx.bump(); }
      syncM(m); monPanel();
    };
    const monUpdate = (dt) => {
      left -= dt; ui.timer(left); mon.t += dt; mon.acc += dt;
      if (mon.fi < 4 && mon.t >= mon.next[mon.fi]) {
        const cand = MS.filter((m) => m.state === 'run' && !m.fault);
        if (cand.length) { const m = cand[Math.floor(Math.random() * cand.length)]; m.fault = true; m.tf = 0; mon.fi++; }
      }
      mon.spikeCd -= dt;
      if (mon.spikeCd <= 0) { const cand = MS.filter((m) => m.state === 'run' && m.spike === 0); if (cand.length) cand[Math.floor(Math.random() * cand.length)].spike = Math.random() < 0.3 ? 2 : 1; mon.spikeCd = rnd(3, 5.5); }
      MS.forEach((m) => {
        if (m.fault) m.tf += dt;
        if (m.pause > 0) { m.pause -= dt; if (m.pause <= 0) { m.state = 'run'; syncM(m); } }
        if (m.fault && m.temp >= 98 && m.state === 'run') { m.state = 'down'; m.fault = false; mon.broke++; mon.done++; syncM(m); monPanel(); c.sfx.bump(); c.buzz(30); ui.pop('💥 설비 정지!', m.g.position.clone().add(V3(0, 3.6, 0)), '#ffd0d0'); }
      });
      if (mon.acc >= 0.5) { mon.acc = 0; sample(); }
      if (mon.done >= 4 && endT < 0) endT = 1.2;
      if (endT >= 0) { endT -= dt; if (endT <= 0) endMon(); }
      if (left <= 0) endMon();
    };

    cam.set([0, 21, 17], [0, 0, -0.5]); cam.fov(50, true); netPanel();
    const hintPulse = (t) => { if (phase === 'net' && mistakes >= 2 && prog < 5) stations[prog].g.scale.setScalar(1 + 0.07 * Math.sin(t * 6)); };
    return {
      start() { ui.hint('데이터가 만들어지는 곳부터 순서대로 눌러요'); },
      down() {
        if (phase === 'net') { const h = c.pick(stations.map((s) => s.g)); if (!h) return; const o = ancestor(h.object, 'si'); const st = o && stations.find((s) => s.g === o); if (st) tapNet(st); }
        else if (phase === 'mon') { const h = c.pick(MS.map((m) => m.g)); if (!h) return; const o = ancestor(h.object, 'mi'); const m = o && MS.find((x) => x.g === o); if (m) tapMon(m); }
      },
      update(dt, t) {
        hintPulse(t);
        if (phase === 'flow') {
          ft += dt; const u = Math.min(4, (ft / 3.2) * 4), sg = Math.min(3, Math.floor(u)), f = u - sg, a = stations[sg].pos, b = stations[sg + 1].pos;
          packet.position.set(a.x + (b.x - a.x) * f, 2.4 + Math.sin(f * Math.PI) * 1.2, a.z + (b.z - a.z) * f);
          if (ft >= 3.4) { packet.visible = false; startMon(); }
        } else if (phase === 'mon') monUpdate(dt);
      },
      idle(dt, t) { hintPulse(t); },
    };
  },
});

/* ───────────────────────── 3. 디지털융합정보학과 · 데이터 분석 대시보드 ───────────────────────── */
registerExperience('dig', {
  icon: '📊', title: '데이터 분석 · 재구매율 하락 원인 찾기',
  desc: '쇼핑몰의 재구매율이 3개월째 떨어지고 있어요. 고객군·상품·채널로 데이터를 쪼개 보며 원인 구간을 찾고, 알맞은 조치를 결정해 보세요.',
  tools: ['📊 3D 막대 대시보드', '👥🛍️📱 분석 기준(필터)', '📌 분석 보고서'],
  steps: ['👥 고객군 · 🛍️ 상품 · 📱 채널 기준으로 막대를 비교해요', '하락이 큰 막대 묶음을 눌러 그 그룹만 자세히 들여다봐요', '3가지 기준을 모두 좁히면 📌 보고서를 낼 수 있어요', '원인 구간을 맞히고 알맞은 조치를 골라요'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c, AGE = ['10대', '20대', '30대', '40대+'], PRD = ['의류', '뷰티', '식품'], CHN = ['앱', '웹'];
    const DIMS = [{ k: 'age', n: '고객군', ic: '👥', list: AGE }, { k: 'prd', n: '상품', ic: '🛍️', list: PRD }, { k: 'ch', n: '채널', ic: '📱', list: CHN }];
    const MCOL = ['#a9c8f5', '#5f9bea', '#2f5fc4'], SC = 0.13;
    let phase = 'an', viewDim = 'age', actions = 0, resets = 0;
    const filt = { age: -1, prd: -1, ch: -1 };

    /* 데이터 생성: 4×3×2 = 24칸 · 7·8·9월 재구매율(%) */
    const AB = [30, 38, 42, 40], PB = [0, 2, 4], CB = [3, 0];
    const ca = Math.floor(rnd(0, 4)), cp = Math.floor(rnd(0, 3)), cc = Math.floor(rnd(0, 2));
    let da, dp, dc; do { da = Math.floor(rnd(0, 4)); dp = Math.floor(rnd(0, 3)); dc = Math.floor(rnd(0, 2)); } while (da === ca && dp === cp && dc === cc);
    const cells = AGE.map((_, a) => PRD.map((__, p) => CHN.map((___, h) => {
      const base = 22 + AB[a] * 0.55 + PB[p] + CB[h]; let d1 = 0, d2 = 0;
      if (a === ca && p === cp && h === cc) { d1 = 8; d2 = 17; } else if (a === da && p === dp && h === dc) { d1 = 2.5; d2 = 7; }
      return [base + rnd(-0.7, 0.7), base + rnd(-0.7, 0.7) - d1, base + rnd(-0.7, 0.7) - d2];
    })));
    const series = (dk, ci) => {
      const acc = [0, 0, 0]; let n = 0;
      for (let a = 0; a < 4; a++) for (let p = 0; p < 3; p++) for (let h = 0; h < 2; h++) {
        const v = { age: a, prd: p, ch: h }; if (v[dk] !== ci) continue;
        if (['age', 'prd', 'ch'].some((k) => k !== dk && filt[k] >= 0 && v[k] !== filt[k])) continue;
        const r = cells[a][p][h]; for (let m = 0; m < 3; m++) acc[m] += r[m]; n++;
      }
      return acc.map((x) => x / n);
    };
    const isFinal = () => filt.age >= 0 && filt.prd >= 0 && filt.ch >= 0;
    const comboName = (a, p, h) => `${AGE[a]} · ${PRD[p]} · ${CHN[h]}`;

    /* 3D 대시보드 */
    c.box(24, 0.3, 7.5, '#e6ebf2', 0, -0.15, 0); c.box(24, 0.1, 0.1, '#9aa5b5', 0, 0.02, -3.6);
    const title = tag(root, '📊 쇼핑몰 재구매율(%) · 7월 → 9월', 9, 1.0); title.position.set(0, 9.2, -2);
    const CL = [0, 1, 2, 3].map((ci) => {
      const g = new THREE.Group(); g.userData.ci = ci; root.add(g);
      c.box(4.2, 0.2, 2.4, '#cfd8e6', 0, 0.1, 0, g);
      const bars = [0, 1, 2].map((m) => c.box(1.0, 1, 1.6, MCOL[m], (m - 1) * 1.15, 0.7, 0, g));
      const vt = [0, 1, 2].map((m) => { const t = tag(g, '', 1.2, 0.6, '#fff', 'rgba(10,30,60,.75)'); t.position.set((m - 1) * 1.15, 2, 0); return t; });
      const tg = tag(g, '', 4.6, 0.9); tg.position.set(0, 0.35, 2.7);
      return { g, bars, vt, tg, cur: [0, 0, 0], tgt: [0, 0, 0] };
    });
    const place = (n) => CL.forEach((k, i) => { k.g.visible = i < n; k.g.position.set(i < n ? (i - (n - 1) / 2) * 5.6 : 100, 0, 0); });
    const dName = () => (isFinal() ? '최종 구간' : DIMS.find((d) => d.k === viewDim).n);
    const filterText = () => { const t = DIMS.filter((d) => filt[d.k] >= 0).map((d) => d.list[filt[d.k]]); return t.length ? t.join(' › ') : '전체'; };
    const panel = () => ui.panel(`<b>📊 재구매율 분석</b><br>필터: ${filterText()}<br>비교 기준: ${dName()}<br><span style="color:#a9c8f5">■</span> 7월 <span style="color:#5f9bea">■</span> 8월 <span style="color:#2f5fc4">■</span> 9월<br><small>9월 하락폭이 크면 🟧·🟥 표시돼요</small>`);
    const refreshChart = () => {
      const list = isFinal() ? [{ name: comboName(filt.age, filt.prd, filt.ch), s: cells[filt.age][filt.prd][filt.ch] }] : DIMS.find((d) => d.k === viewDim).list.map((nm, i) => ({ name: nm, s: series(viewDim, i) }));
      place(list.length);
      list.forEach((it, i) => {
        const k = CL[i], d = it.s[2] - it.s[0]; k.tgt = it.s.map((v) => v * SC);
        k.tg.userData.set(`${it.name}  ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%p`, '#fff', d <= -5 ? 'rgba(190,50,45,.92)' : d <= -1.5 ? 'rgba(200,125,25,.92)' : 'rgba(40,60,90,.88)');
        k.vt.forEach((t, m) => t.userData.set(it.s[m].toFixed(1)));
      });
      panel();
    };

    /* 버튼 */
    const dimBtns = DIMS.map((d, i) => ui.button({ icon: d.ic, label: d.n, size: 68, pos: { left: (16 + i * 76) + 'px', bottom: '96px' }, down: () => pickDim(i) }));
    const bReset = ui.button({ icon: '↺', label: '처음부터', size: 68, pos: { left: (16 + 3 * 76) + 'px', bottom: '96px' }, down: () => resetAll() });
    const bRep = ui.button({ icon: '📌', label: '보고서', size: 86, cls: 'grn', pos: { right: '30px', bottom: '40px' }, down: () => report() });
    [...dimBtns, bReset, bRep].forEach((b) => b.show(false));
    const nextDim = () => { const d = DIMS.find((x) => filt[x.k] < 0); return d ? d.k : null; };
    const pickDim = (i) => {
      if (phase !== 'an') return; const k = DIMS[i].k;
      if (isFinal() || filt[k] >= 0) { ui.pop('이미 고른 기준이에요', null, '#ffe9a0'); return; }
      viewDim = k; actions++; c.sfx.click(); refreshChart();
    };
    const resetAll = () => { if (phase !== 'an') return; filt.age = filt.prd = filt.ch = -1; viewDim = 'age'; actions++; resets++; bRep.show(false); c.sfx.click(); refreshChart(); ui.hint('처음부터 다시 쪼개 봐요'); };
    const tapCluster = (ci) => {
      if (phase !== 'an' || isFinal() || !CL[ci].g.visible) return;
      filt[viewDim] = ci; actions++; c.sfx.click(); c.buzz(12); const nx = nextDim();
      if (nx) { viewDim = nx; ui.hint(`${filterText()} 안에서 다음 기준을 비교해요`); } else { bRep.show(true); ui.hint('3가지 기준을 모두 좁혔어요 · 하락 폭을 확인하고 📌 보고서를 제출해요'); }
      refreshChart();
    };
    const finish = (rep, act) => {
      phase = 'end'; [...dimBtns, bReset, bRep].forEach((b) => b.show(false));
      const bonus = clamp(20 - (actions - 3) * 4, 0, 20), s = rep ? 55 + bonus + act : 15 + act;
      ui.panel(`<b>📋 결과</b><br>📌 원인 구간: ${comboName(ca, cp, cc)}<br>분석 보고 ${rep ? '정답 ✅' : '오답 ❌'} · 탐색 횟수 ${actions}번 (${rep ? '효율 +' + bonus : '효율 점수 없음'})<br>조치 선택 +${act}`);
      c.finish(s);
    };
    const report = () => {
      if (phase !== 'an' || !isFinal()) return; phase = 'ask';
      const a2 = (ca + 1 + Math.floor(rnd(0, 3))) % 4, p2 = (cp + 1 + Math.floor(rnd(0, 2))) % 3, h2 = 1 - cc;
      const opts = shuffle([{ a: ca, p: cp, h: cc, ok: true }, { a: a2, p: cp, h: cc }, { a: ca, p: p2, h: cc }, { a: ca, p: cp, h: h2 }]);
      ui.ask('📌 분석 보고서<br>재구매율 하락의 원인 구간은 어디일까요?', opts.map((o) => comboName(o.a, o.p, o.h)), (i) => {
        const rep = !!opts[i].ok; c.sfx[rep ? 'ok' : 'bump'](); ui.pop(rep ? '정확해요! ✔' : `원인은 ${comboName(ca, cp, cc)}`, null, rep ? '#a0ffb8' : '#ffd0d0');
        const good = `「${comboName(ca, cp, cc)}」 구간의 구매 과정(결제·쿠폰·배송)을 점검해 문제를 고치고 해당 고객에게 안내해요`;
        const acts = shuffle([{ t: good, v: 25 }, { t: '전체 상품 가격을 일괄 인하해요', v: 8 }, { t: '모든 채널의 광고 예산을 2배로 늘려요', v: 5 }]);
        setTimeout(() => ui.ask('🎯 원인 구간을 찾았어요!<br>가장 알맞은 조치는 무엇일까요?', acts.map((a) => a.t), (j) => {
          const act = acts[j].v; ui.hint(act === 25 ? '데이터로 찾은 원인에 맞춰 조치하는 것이 분석가의 일이에요' : '원인을 모른 채 전체에 쓰는 대책은 비용만 커져요'); finish(rep, act);
        }), 900);
      });
    };

    cam.set([0, 10, 15.5], [0, 2.6, 0]); cam.fov(50, true); refreshChart();
    return {
      start() { [...dimBtns, bReset].forEach((b) => b.show(true)); ui.hint('막대 묶음 중 9월에 많이 떨어진 곳을 눌러 더 자세히 들여다봐요'); },
      down() {
        if (phase !== 'an') return; const h = c.pick(CL.map((k) => k.g)); if (!h) return;
        const o = ancestor(h.object, 'ci'); if (o) tapCluster(o.userData.ci);
      },
      update(dt) {
        const k = Math.min(1, 8 * dt);
        CL.forEach((cl) => cl.bars.forEach((b, m) => {
          cl.cur[m] += (cl.tgt[m] - cl.cur[m]) * k; const h = Math.max(0.02, cl.cur[m]);
          b.scale.y = h; b.position.y = 0.2 + h / 2; cl.vt[m].position.y = 0.2 + h + 0.6;
        }));
      },
      idle(dt) { const k = Math.min(1, 8 * dt); CL.forEach((cl) => cl.bars.forEach((b, m) => { cl.cur[m] += (cl.tgt[m] - cl.cur[m]) * k; const h = Math.max(0.02, cl.cur[m]); b.scale.y = h; b.position.y = 0.2 + h / 2; cl.vt[m].position.y = 0.2 + h + 0.6; })); },
    };
  },
});