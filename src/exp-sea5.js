/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea5.js (수산해양 S3-b · 검수 완료본)
 *   fbi : 해양바이오식품학과 → 수산식품 가공·품질관리 라인 (원료 선별 → 가열 살균 → 냉각·위생 퀴즈 → 금속검출기 감도 설정)
 *   sea : 해양수산자율전공계열 → 배를 골라 타고 6개 현장을 돌며 "이 일은 어느 학과?" 탐색 항해
 * exp-sea2.js 의 공용 도구(dock, slider, quizFlow …)와 exp-sea-kit.js 를 가져다 써요.
 * 수치·기준은 학습용으로 단순화한 값이에요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { SEA_ENV, ENGINE, KN, createSea, makeResearchShip, makeCoastGuard, makeTug, buildPort, reef, buoy, guide, helm, tagSprite, snd, wrapA, headingDeg, pad3 } from './exp-sea-kit.js';
import { h, btn, slider, dock, quizFlow, gauss, LAB_ENV } from './exp-sea2.js';

/* ═══════════════ 1. 해양바이오식품학과 — 가공·품질관리 라인 ═══════════════ */
const beltTex = () => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const g = cv.getContext('2d');
  g.fillStyle = '#39424f'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#566377'; g.fillRect(0, 0, 6, 32); g.fillRect(32, 0, 6, 32);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(55, 1); return t;
};
const CAMS = { sel: [[-28, 9, 15], [-28, 1.5, 0]], oven: [[-6, 8, 14], [-6, 2.5, -2]], chill: [[16, 8, 14], [16, 2.5, -1]], metal: [[38, 8, 14], [38, 2.5, 0]] };
const VBELT = 3.2;
const PASS_X = -17, GONE_X = -14; /* 선별 구간 끝: 이 선을 넘으면 '통과'로 판정하고, 조금 뒤 화면에서 지워요 */

registerExperience('fbi', {
  icon: '🍤', title: '수산식품 가공·품질관리 라인',
  desc: '식품 연구원이 되어 수산물 가공 라인을 책임져요. 상한 원료와 이물을 골라내고, 가열 살균 조건을 찾고, 냉각·위생 기준을 지키고, 금속검출기 감도를 맞춰 안전한 제품을 내보내세요. (기준은 학습용으로 단순화했어요)',
  tools: ['🐟 원료 선별 컨베이어', '🔥 가열 살균 오븐', '❄ 급속 냉각기', '🧲 금속검출기'],
  steps: ['컨베이어 위의 변질 수산물·이물만 눌러 골라내요 (정상품을 누르면 감점)', '오븐 온도·시간을 정해 중심온도 85℃를 1분 이상 유지하되 품질은 지켜요', '냉각·보관·표시 기준 퀴즈 3문제를 풀어요', '금속검출기 감도를 정해 40개 제품을 검사해요 (놓치면 큰 감점)'],
  env: LAB_ENV,
  build(c) {
    const { root, ui, cam } = c;
    c.box(150, 0.4, 50, '#cfd8e0', 0, -0.2, 0, root); c.box(150, 16, 0.5, '#e8eff5', 0, 8, -12, root);
    const btx = beltTex();
    const belt = new THREE.Mesh(new THREE.BoxGeometry(110, 0.4, 3.4), new THREE.MeshStandardMaterial({ map: btx, roughness: 0.9 })); belt.position.set(3, 1.0, 0); root.add(belt);
    [1.9, -1.9].forEach((z) => c.box(110, 0.5, 0.25, '#9aa6b4', 3, 1.35, z, root));
    for (let x = -48; x <= 54; x += 8) c.box(0.5, 1.0, 3.0, '#586270', x, 0.5, 0, root);
    [['① 원료 선별', -28], ['② 가열 살균', -6], ['③ 급속 냉각', 16], ['④ 금속 검사', 38]].forEach(([t, x]) => { const s = tagSprite(t, 'rgba(20,70,110,.9)', 7, 1.6); s.position.set(x, 7.6, 0); root.add(s); });
    /* 오븐 */
    const oven = new THREE.Group(); oven.position.set(-6, 0, -4); root.add(oven);
    c.box(8, 5, 4.4, '#c9d1da', 0, 2.5, 0, oven); c.box(8.2, 0.5, 4.6, '#7b8696', 0, 5.1, 0, oven); c.cyl(0.3, 0.3, 2, '#9aa6b4', 3, 6.1, 0, oven, 10);
    const door = c.box(6, 3.2, 0.2, '#555d69', 0, 2.7, 2.25, oven); door.material.emissive = new THREE.Color('#ff6a1a'); door.material.emissiveIntensity = 0.05;
    const puffs = []; for (let i = 0; i < 6; i++) { const p = c.sph(0.5, '#ffffff', 3, 7, 0, oven); p.material.transparent = true; p.material.opacity = 0; puffs.push(p); }
    /* 급속 냉각기 */
    const chill = new THREE.Group(); chill.position.set(16, 0, -4); root.add(chill);
    c.box(8, 5, 4.4, '#d9f1ff', 0, 2.5, 0, chill); c.box(8.2, 0.5, 4.6, '#9bb9cc', 0, 5.1, 0, chill);
    const cdoor = c.box(6, 3.2, 0.2, '#9ad6ff', 0, 2.7, 2.25, chill); cdoor.material.emissive = new THREE.Color('#66ccff'); cdoor.material.emissiveIntensity = 0.5;
    const snow = []; for (let i = 0; i < 12; i++) { const s = c.sph(0.12, '#ffffff', c.rnd(-3, 3), c.rnd(0.5, 5), c.rnd(1, 2.6), chill); snow.push(s); }
    /* 금속검출기 */
    [-2.4, 2.4].forEach((z) => c.box(0.8, 3.8, 0.8, '#2f6fed', 37, 3.1, z, root)); c.box(0.9, 0.9, 5.6, '#2f6fed', 37, 5.0, 0, root);
    const lamp = c.sph(0.35, '#f2c94c', 37, 5.8, 0, root); lamp.material.emissive = new THREE.Color('#f2c94c'); lamp.material.emissiveIntensity = 0.8;

    const mkFish = (kind) => {
      const g = new THREE.Group();
      if (kind === 'junk') {
        if (Math.random() < 0.5) { const b = c.box(0.9, 0.08, 0.7, '#2fa3ff', 0, 0.06, 0, g); b.material.transparent = true; b.material.opacity = 0.75; }
        else { c.box(0.5, 0.12, 0.9, '#f2c94c', 0, 0.08, 0, g); c.box(0.12, 0.1, 0.4, '#f2c94c', 0.25, 0.1, -0.5, g); }
      } else {
        const good = kind === 'good', col = good ? '#a9c4dd' : '#a08f66';
        const body = c.sph(0.55, col, 0, 0.35, 0, g); body.scale.set(1.7, 0.65, 0.7);
        c.cyl(0.45, 0, 0.6, col, -1.15, 0.35, 0, g, 4).rotation.z = Math.PI / 2;
        c.sph(0.13, good ? '#ffffff' : '#c8c8c8', 0.7, 0.5, 0.34, g); c.sph(0.07, good ? '#111111' : '#7d7d7d', 0.8, 0.52, 0.38, g);
        if (good) c.sph(0.12, '#d6404a', 0.45, 0.35, 0.32, g); else for (let i = 0; i < 3; i++) c.sph(0.1, '#5a4a2a', -0.3 + i * 0.35, 0.55, 0.2, g);
      }
      /* 보이지 않는 터치 영역 — 납작한 이물도 손가락으로 쉽게 눌러요 */
      const hit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(-0.2, 0.5, 0); g.add(hit);
      return g;
    };

    const dk = dock(c, '🍤 해양식품 가공 라인');
    let stage = 'sel', left = 360, ended = false, quizRight = 0, rdT = 0, info = null;
    const sel = { on: false, t: 0, next: 0, spawned: 0, ok: 0, fp: 0, miss: 0, pts: 0, queue: shuffle([...Array(9).fill('good'), ...Array(4).fill('bad'), ...Array(3).fill('junk')]) };
    const items = [];
    const ov = { T: 90, m: 2, run: false, t: 0, To: 90, dur: 2, pts: [], above: 0, over: 0, max: 10, last: 0, att: 0, best: 0, nextShown: false };
    const mt = { run: false, t: 0, next: 0, spawned: 0, thr: 2.2, caught: 0, missed: 0, fp: 0, att: 0, best: 0, list: [], lampT: 0, finishShown: false };
    const mitems = []; let cv = null, runBtn = null;

    /* ① 원료 선별 */
    const startSel = () => {
      stage = 'sel'; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>① 원료 수산물 선별</b><br><small>컨베이어를 지나는 것 중 <b>상한 수산물과 이물</b>만 눌러 빼내요.</small>'));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.65;flex:none', '🟢 <b>정상</b>: 맑고 까만 눈 · 은빛 몸 · 붉은 아가미<br>🔴 <b>변질</b>: 흐린 회색 눈 · 누런 갈색 몸 · 검은 반점<br>⚠ <b>이물</b>: 비닐·장갑 조각'));
      info = h('div', 'flex:none;line-height:1.6;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.09)', '');
      info.innerHTML = '준비됐어요. <b>▶ 선별 시작</b>을 누르면 컨베이어가 움직여요.<br><small>제거해야 할 것: 변질 수산물 · 이물</small>';
      /* 버튼 요소를 직접 들고 있다가 숨겨요 (dock 내부 구조에 기대지 않아요) */
      const runB = btn('▶ 선별 시작 (총 16개)', () => {
        if (sel.on) return;
        sel.on = true; sel.t = 0; sel.next = 0; runB.style.display = 'none'; ui.hint('불량품·이물을 눌러 빼내요! 정상품은 누르지 마세요');
      }, 'background:#2a6bff;text-align:center');
      dk.add(info); dk.add(runB); ui.hint('선별 시작 버튼을 눌러요');
    };
    const finishSel = () => {
      sel.on = false; sel.pts = 20 * clamp((sel.ok - 0.8 * sel.fp - 0.6 * sel.miss) / 7, 0, 1); snd(c, 'ok');
      ui.hint('선별 완료! 결과를 확인하고 다음 단계로 넘어가요');
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(40,160,90,.22);line-height:1.6;flex:none', `<b>📋 선별 결과</b><br>✔ 제거 ${sel.ok}/7 · ✖ 정상품 오제거 ${sel.fp} · ⚠ 통과 ${sel.miss}<br>→ <b>${sel.pts.toFixed(0)}/20점</b><br><small>HACCP의 첫 단계는 원료 검수예요. 변질·이물이 라인에 들어가면 뒤 공정이 아무리 좋아도 안전을 보장하기 어려워요.</small>`));
      dk.add(btn('🔥 가열 살균으로 ▶', startOven, 'background:#2a6bff;text-align:center'));
    };
    /* ② 가열 살균 */
    const drawHeat = () => {
      const g = cv.getContext('2d'), W = 340, H = 170, L = 38, T0 = 8, B0 = 22, pw = W - L - 8, ph = H - T0 - B0; /* 논리 크기 340×170, 실제 해상도는 2배 */
      g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      const X = (m) => L + (m / 8) * pw, Y = (t) => T0 + ((140 - t) / 130) * ph;
      g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(L, T0, pw, ph);
      g.font = '700 12px "Malgun Gothic","Noto Sans KR",sans-serif'; g.fillStyle = '#9fb3c9'; g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.textAlign = 'right';
      [20, 60, 100, 140].forEach((t) => { g.fillText(t + '℃', L - 4, Y(t) + 4); g.beginPath(); g.moveTo(L, Y(t)); g.lineTo(L + pw, Y(t)); g.stroke(); });
      g.textAlign = 'center'; [0, 2, 4, 6, 8].forEach((m) => g.fillText(m + '분', X(m), H - 6));
      g.setLineDash([5, 4]); g.strokeStyle = '#ffd34d'; g.beginPath(); g.moveTo(L, Y(85)); g.lineTo(L + pw, Y(85)); g.stroke(); g.setLineDash([]); g.textAlign = 'left'; g.fillStyle = '#ffd34d'; g.fillText('살균 기준 85℃', L + 6, Y(85) - 4);
      if (ov.pts.length) { g.strokeStyle = '#ff9b4d'; g.lineWidth = 2.5; g.beginPath(); ov.pts.forEach((p, i) => { if (i) g.lineTo(X(p.t), Y(p.T)); else g.moveTo(X(p.t), Y(p.T)); }); g.stroke(); }
    };
    const startOven = () => {
      stage = 'oven'; dk.clear(); ov.nextShown = false;
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>② 가열 살균</b><br><small>어묵 속 <b>중심온도 85℃를 1분 이상</b> 유지해야 안전해요. 하지만 너무 오래·세게 가열하면 맛과 식감(품질)이 떨어져요. 최대 3번 시험할 수 있어요.</small>'));
      cv = h('canvas', 'width:100%;flex:none;border-radius:8px;background:rgba(0,0,0,.18)', ''); cv.width = 680; cv.height = 340; dk.add(cv);
      const sO = slider('🔥 오븐 온도', '℃', 70, 140, 5, ov.T, (v) => { ov.T = v; }, 0), sM = slider('⏱ 가열 시간', '분', 1, 8, 0.5, ov.m, (v) => { ov.m = v; }, 1);
      info = h('div', 'flex:none;line-height:1.6;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.09)', '시험 전이에요. 온도와 시간을 정하고 ▶ 가열을 눌러요.');
      runBtn = btn('▶ 가열 시작', runOven, 'background:#b5453a;text-align:center');
      [sO.el, sM.el, info, runBtn].forEach((e) => dk.add(e));
      ov.pts = []; drawHeat(); ui.hint('오븐 온도와 가열 시간을 정해요');
    };
    const runOven = () => {
      if (ov.run || ov.att >= 3) return;
      ov.run = true; ov.t = 0; ov.last = 0; ov.pts = []; ov.above = 0; ov.over = 0; ov.max = 10; ov.To = ov.T; ov.dur = ov.m; ov.att++; runBtn.style.opacity = '0.5'; snd(c, 'go');
    };
    const ovenDone = () => {
      ov.run = false; const sterile = ov.above >= 1.0, Q = clamp(100 - 0.6 * ov.over, 0, 100);
      const p = sterile ? 18 + 12 * clamp((Q - 50) / 45, 0, 1) : 4 * clamp(ov.max / 85, 0, 1); if (p > ov.best) ov.best = p;
      info.innerHTML = `<b>${sterile ? '✅ 살균 충족' : '⚠ 살균 부족'}</b> · 85℃ 이상 <b>${ov.above.toFixed(1)}분</b> · 최고 ${ov.max.toFixed(0)}℃<br>품질 지수 <b>${Q.toFixed(0)}</b> ${Q < 75 ? '(과열로 식감 저하)' : ''}<br>이번 ${p.toFixed(0)}/30점 · 최고 <b>${ov.best.toFixed(0)}</b> · 남은 시험 ${3 - ov.att}회<br><small>${!sterile ? '중심온도가 85℃에 오래 머물지 못했어요. 온도나 시간을 올려요.' : Q < 75 ? '안전하지만 너무 세게 가열했어요. 온도를 낮추고 시간을 조절해 보세요.' : '안전과 품질을 모두 지켰어요!'}</small>`;
      snd(c, sterile ? 'ok' : 'bad'); runBtn.style.opacity = ov.att >= 3 ? '0.3' : '1';
      if (!ov.nextShown) { ov.nextShown = true; dk.add(btn('❄ 냉각·위생 퀴즈로 ▶', startChill, 'background:#2a6bff;text-align:center')); }
    };
    /* ③ 냉각·위생 퀴즈 */
    const startChill = () => {
      stage = 'chill'; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>③ 급속 냉각 · 보관 · 표시</b><br><small>가열이 끝난 제품은 빨리 식혀 포장해야 해요.</small>'));
      quizFlow(dk, [
        { q: '가열 살균 뒤 식품을 <b>상온에 그냥 두면 안 되는</b> 이유는?', a: [['세균이 빠르게 늘어나는 위험온도대(약 5~60℃)에 오래 머물기 때문', true, '그래서 가열 후에는 급속 냉각해 위험온도대를 빨리 통과시켜요.'], ['색이 변해 예뻐 보이지 않기 때문', false, '색보다 식중독균 증식이 핵심 문제예요.'], ['포장지가 녹기 때문', false, '포장지가 아니라 식품 안전의 문제예요.']] },
        { q: '<b>냉동 수산식품</b>의 보관 온도 기준으로 가장 알맞은 것은?', a: [['영하 18℃ 이하', true, '냉동식품은 -18℃ 이하로 보관·유통해요.'], ['영상 4℃', false, '4℃는 냉장 온도예요. 냉동이 아니에요.'], ['영상 15℃', false, '실온에 가까워 세균이 늘어나요.']] },
        { q: '<b>새우·오징어·고등어</b>가 들어간 제품의 라벨에서 꼭 해야 할 일은?', a: [['알레르기 유발 원재료로 표시한다', true, '알레르기를 일으킬 수 있는 원재료는 포장지에 반드시 표시해요.'], ['제품 이름만 크게 쓴다', false, '이름만으로는 알레르기 환자를 보호할 수 없어요.'], ['원재료 표시를 생략한다', false, '표시하지 않으면 알레르기 환자에게 위험해요.']] },
      ], (right) => { quizRight = clamp(Number(right) || 0, 0, 3); startMetal(); });
    };
    /* ④ 금속검출기 */
    const startMetal = () => {
      stage = 'metal'; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>④ 금속검출기 감도 설정</b><br><small>제품에 섞인 <b>금속 조각</b>(1.2~3.2mm)을 찾아내요. 정상 제품도 소금기 때문에 약 0.4 정도의 신호가 나와요. 검출 한계를 너무 높이면 금속이 통과하고, 너무 낮으면 정상품이 버려져요. 최대 2번 검사할 수 있어요.</small>'));
      const sT = slider('🧲 검출 한계', 'mm', 0.3, 3.0, 0.1, mt.thr, (v) => { mt.thr = v; }, 1);
      info = h('div', 'flex:none;line-height:1.6;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.09)', '검사 전이에요.');
      runBtn = btn('▶ 40개 검사 시작', runMetal, 'background:#b5453a;text-align:center');
      [sT.el, info, runBtn].forEach((e) => dk.add(e)); ui.hint('검출 한계를 정하고 검사를 시작해요');
    };
    const runMetal = () => {
      if (mt.run || mt.att >= 2) return;
      mt.run = true; mt.t = 0; mt.next = 0; mt.spawned = 0; mt.caught = mt.missed = mt.fp = 0; mt.att++; runBtn.style.opacity = '0.5';
      mt.list = shuffle([...Array(8).fill(1), ...Array(32).fill(0)]).map((v) => (v ? 1.2 + c.rnd(0, 2.0) : 0)); snd(c, 'go');
    };
    const metalDone = () => {
      mt.run = false; const p = clamp(25 - 4 * mt.missed - 0.8 * mt.fp, 0, 25); if (p > mt.best) mt.best = p; snd(c, mt.missed ? 'bad' : 'ok'); runBtn.style.opacity = mt.att >= 2 ? '0.3' : '1';
      info.innerHTML = `🧲 금속 검출 <b>${mt.caught}/8</b> · ⚠ 놓침 <b>${mt.missed}</b> · ✖ 정상품 오검출 <b>${mt.fp}</b><br>이번 ${p.toFixed(0)}/25점 · 최고 <b>${mt.best.toFixed(0)}</b> · 남은 검사 ${2 - mt.att}회<br><small>${mt.missed ? '금속이 소비자에게 갈 뻔했어요! 검출 한계를 낮춰요.' : mt.fp > 3 ? '금속은 다 잡았지만 정상품이 많이 버려졌어요. 한계를 조금 올려 균형을 찾아요.' : '금속은 모두 잡고 정상품 손실도 적어요. 훌륭한 설정이에요!'}</small>`;
      if (!mt.finishShown) { mt.finishShown = true; dk.add(btn('🏁 라인 점검 마치기', endAll, 'background:#2a6bff;text-align:center')); }
    };
    const endAll = () => {
      if (ended) return; ended = true; dk.el.style.display = 'none';
      c.finish(sel.pts + ov.best + quizRight * 5 + mt.best + 10 * clamp(left / 150, 0, 1));
    };
    const spawnCan = (m) => {
      const g = new THREE.Group(); c.cyl(0.5, 0.5, 0.8, '#d9dde3', 0, 0.4, 0, g, 16); c.cyl(0.52, 0.52, 0.4, '#d94a3d', 0, 0.4, 0, g, 16);
      g.position.set(26, 1.2, 0); root.add(g); mitems.push({ g, m, chk: false, rej: false });
    };

    const anim = (dt, t) => {
      if ((stage === 'sel' && sel.on) || (stage === 'metal' && mt.run)) btx.offset.x -= dt * (VBELT / 2);
      const k = CAMS[stage === 'done' ? 'metal' : stage]; cam.to(k[0], k[1]);
      door.material.emissiveIntensity = ov.run ? clamp((ov.To - 70) / 70, 0.15, 1) : 0.05;
      puffs.forEach((p, i) => { const f = ((t * 0.5 + i / 6) % 1); p.position.y = 7 + f * 3; p.material.opacity = ov.run ? 0.5 * (1 - f) : 0; });
      snow.forEach((s, i) => { s.position.y = 0.6 + ((t * 0.3 + i * 0.37) % 1) * 4.4; });
      mt.lampT -= dt; if (mt.lampT <= 0) { lamp.material.color.set('#f2c94c'); lamp.material.emissive.set('#f2c94c'); }
    };
    return {
      start() { startSel(); },
      idle(dt, t) { anim(dt, t); },
      down() {
        if (stage !== 'sel' || !sel.on) return;
        const hit = c.pick(items.filter((i) => !i.rej).map((i) => i.g)); if (!hit) return;
        let o = hit.object; while (o && !o.userData.itm) o = o.parent; if (!o) return; const it = o.userData.itm;
        it.rej = true;
        if (it.kind === 'good') { sel.fp++; snd(c, 'bad'); ui.pop('✖ 정상품이에요!', hit.point, '#ff8a80'); }
        else { sel.ok++; snd(c, 'ok'); ui.pop(it.kind === 'junk' ? '✔ 이물 제거' : '✔ 변질 수산물 제거', hit.point, '#a0ffb8'); }
      },
      update(dt, t) {
        anim(dt, t); if (ended) return;
        left -= dt; ui.timer(left); if (left <= 0) { endAll(); return; }
        if (stage === 'sel' && sel.on) {
          sel.t += dt;
          if (sel.spawned < sel.queue.length && sel.t >= sel.next) { const kind = sel.queue[sel.spawned++]; sel.next += 1.25; const g = mkFish(kind); g.position.set(-44, 1.2, c.rnd(-0.5, 0.5)); g.scale.setScalar(1.3); root.add(g); const it = { g, kind, rej: false, done: false }; g.userData.itm = it; items.push(it); }
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i], p = it.g.position;
            if (it.rej) { p.z += 7 * dt; p.y += 2 * dt; it.g.rotation.z += 5 * dt; if (p.z > 8) { root.remove(it.g); items.splice(i, 1); } }
            else {
              p.x += VBELT * dt;
              if (p.x > PASS_X && !it.done) { it.done = true; if (it.kind !== 'good') { sel.miss++; snd(c, 'bad'); ui.pop('⚠ 불량품이 통과했어요', p, '#ff8a80'); } }
              if (p.x > GONE_X) { root.remove(it.g); items.splice(i, 1); }
            }
          }
          rdT -= dt; if (rdT <= 0 && info) { rdT = 0.3; info.innerHTML = `✔ 제거 <b>${sel.ok}</b> · ✖ 오제거 <b>${sel.fp}</b> · ⚠ 통과 <b>${sel.miss}</b> · 남은 ${sel.queue.length - sel.spawned + items.filter((i) => !i.rej).length}개`; }
          if (sel.spawned >= sel.queue.length && items.length === 0) finishSel();
        }
        if (stage === 'oven' && ov.run) {
          ov.t += dt / 1.3; const tm = Math.min(ov.t, ov.dur), T = ov.To - (ov.To - 10) * Math.exp(-tm / 1.5), dm = tm - ov.last; ov.last = tm;
          if (T >= 85) ov.above += dm; ov.over += Math.max(0, T - 90) * dm; ov.max = Math.max(ov.max, T); ov.pts.push({ t: tm, T }); drawHeat();
          info.innerHTML = `중심온도 <b>${T.toFixed(0)}℃</b> · 85℃ 이상 ${ov.above.toFixed(1)}분 · ${tm.toFixed(1)}/${ov.dur}분`;
          if (ov.t >= ov.dur) ovenDone();
        }
        if (stage === 'metal' && mt.run) {
          mt.t += dt; if (mt.spawned < mt.list.length && mt.t >= mt.next) { spawnCan(mt.list[mt.spawned++]); mt.next += 0.34; }
          for (let i = mitems.length - 1; i >= 0; i--) {
            const it = mitems[i], p = it.g.position;
            if (it.rej) { p.z += 6 * dt; p.y += 2 * dt; it.g.rotation.z += 5 * dt; if (p.z > 8) { root.remove(it.g); mitems.splice(i, 1); } continue; }
            p.x += VBELT * dt;
            if (!it.chk && p.x >= 37) {
              it.chk = true; const sig = 0.4 + it.m + gauss(0.3), det = sig > mt.thr; mt.lampT = 0.35;
              lamp.material.color.set(det ? '#ff3b30' : '#35e08d'); lamp.material.emissive.set(det ? '#ff3b30' : '#35e08d');
              if (det) { it.rej = true; if (it.m > 0) mt.caught++; else mt.fp++; snd(c, 'bad'); }
              else if (it.m > 0) { mt.missed++; ui.pop('⚠ 금속 이물 통과!', p, '#ff8a80'); }
            }
            if (p.x > 50) { root.remove(it.g); mitems.splice(i, 1); }
          }
          if (info) info.innerHTML = `검사 ${Math.min(mt.spawned, 40)}/40 · 🧲 검출 ${mt.caught} · ⚠ 놓침 ${mt.missed} · ✖ 오검출 ${mt.fp}`;
          if (mt.spawned >= mt.list.length && mitems.length === 0) metalDone();
        }
      },
      dispose() { dk.dispose(); },
    };
  },
});

/* ═══════════════ 2. 해양수산자율전공계열 — 오션 커리어 탐색 항해 ═══════════════ */
const DESC = {
  nav: '선박·해양구조물을 설계하고 건조', mar: '선박 엔진·동력장치를 운전·정비', kcg: '바다의 치안·구조·안전 업무', fsh: '물고기 질병을 진단·치료·예방',
  smf: 'AI·빅데이터로 어족자원을 평가·관리', mfm: '실습선에서 항해·어업 기술 습득', aqu: '수산생물을 기르는 스마트 양식', ocs: '바다 생물·화학·물리·지질 조사와 해양환경 해석', fbi: '해양 자원으로 식품을 개발하고 품질·안전 분석',
};
const DNAME = { nav: '조선해양공학과', mar: '기관시스템공학과', kcg: '해양경찰학과', fsh: '수산생명의학과', smf: '스마트수산자원관리학과', mfm: '해양생산관리학과', aqu: '양식생물학과', ocs: '해양융합과학과', fbi: '해양바이오식품학과' };
const JOBS = {
  nav: ['🏗', '조선소 도크', '막 진수를 마친 컨테이너선이 시운전을 기다려요.', '선박·해양구조물을 설계하고 건조하는 일'],
  mar: ['⚙', '선박 기관실', '엔진 소리가 이상하다는 선장의 연락이 왔어요.', '선박 엔진·동력장치를 운전·정비하는 일'],
  kcg: ['🚔', '해상 순찰 구역', '해상 상황실에 신고가 들어왔어요.', '바다의 치안·구조·안전을 지키는 일'],
  fsh: ['🐟', '양식장 가두리', '물고기들이 힘없이 수면 가까이 떠올라 있어요.', '물고기 질병을 진단·치료·예방하는 일'],
  smf: ['📈', '자원조사 해역', '올해 어획 한도를 정해야 하는 시기예요.', '수산 데이터를 AI로 분석해 자원을 관리하는 일'],
  mfm: ['⚓', '원양 조업 해역', '실습선이 어장에 도착했어요.', '실습선에서 항해·어업 기술을 익히는 일'],
};
const POS = [[-75, 115], [-45, 185], [10, 232], [75, 200], [92, 128], [25, 122]];
const NM = { sae: '실습선 새동백호', kcg: '해양경찰 함정', tug: '예인선' };
const SHK = { sae: 'mfm', kcg: 'kcg', tug: 'mar' };

registerExperience('sea', {
  icon: '🧭', title: '오션 커리어 탐색 항해 · 6개 현장',
  desc: '항구의 배 중 하나를 골라 타고 바다 위 6개 현장을 돌아보세요. 현장에서 하는 일을 보고 어느 학과에서 배우는지 맞히고, 얼마나 마음에 드는지 기록하면 나에게 어울리는 학과가 나와요.',
  tools: ['🚢 마음에 드는 배 선택', '📍 6개 현장 부표', '🧭 방위 지시기', '📝 관심도 기록'],
  steps: ['항구의 배 중 마음에 드는 한 척을 눌러 승선해요', '◀▶ 키잡이 · ▲▼ 엔진으로 번호 부표(현장)를 찾아가요. 암초 주의!', '현장에서 하는 일을 보고 어느 학과인지 고르고 😍/🙂/😕 로 관심도를 기록해요', '6곳을 모두 돌면 나에게 어울리는 학과를 알려 줘요'],
  env: SEA_ENV,
  build(c) {
    const { root, ui, cam } = c;
    const sea = createSea(c), port = buildPort(c);
    const ships = { sae: makeResearchShip(c), kcg: makeCoastGuard(c), tug: makeTug(c) }, tags = [];
    Object.keys(ships).forEach((k) => {
      const s = ships[k], m = port.moor[k]; s.position.set(m.x, 0, m.z); s.rotation.y = m.h; root.add(s);
      const tg = tagSprite(`${NM[k]}\n⚓ 눌러서 승선`, 'rgba(10,150,170,.92)'); tg.position.set(0, s.userData.tagY, 0); s.add(tg); tags.push(tg);
    });
    const reefs = [[-25, 110, 5], [-10, 170, 6], [45, 170, 6], [50, 235, 5], [-70, 160, 6], [120, 170, 6]].map(([x, z, r]) => reef(c, root, x, z, r)).concat(port.islands);
    const ST = shuffle(Object.keys(JOBS)).map((k, i) => {
      const [x, z] = POS[i], J = JOBS[k], bu = buoy(c, root, i + 1, x, z, '#e8602c'); bu.active(true);
      const tg = tagSprite(`${J[0]} ${J[1]}`, 'rgba(20,70,110,.9)', 11, 2.4); tg.position.set(x, 10, z); root.add(tg);
      return { i, k, x, z, icon: J[0], place: J[1], scene: J[2], job: J[3], buoy: bu, done: false };
    });
    const gd = guide(c), dk = dock(c, '🧭 오션 커리어 탐색');
    const interest = {};
    /* 제한 시간은 '항해 중'에만 줄어요 (현장 카드를 읽는 동안은 멈춤) */
    let phase = 'port', left = 420, hm = null, S = null, ship = null, shipKey = '', done = 0, score = 0, ended = false, hudT = 0, info = null;
    const boardBtn = ui.button({ icon: '⚓', label: '승선', size: 92, cls: 'grn', pos: { right: '28px', bottom: '46px' }, down: () => board('sae') }); boardBtn.show(false);

    const which = (obj) => { let o = obj; while (o) { for (const k in ships) if (ships[k] === o) return k; o = o.parent; } return null; };
    const hud = () => {
      if (!info || !S) return;
      info.innerHTML = `🧭 선수 ${pad3(headingDeg(S.hdg))}° · 🚢 ${KN(S.speed)}노트 · ⚙ ${ENGINE[S.thr]}<br>⚠ 충돌 ${S.hits}회 · 방문 ${done}/6<br>` + ST.map((s) => `${s.done ? '✅' : '⬜'} ${s.i + 1}번 ${s.done ? s.icon + ' ' + s.place : '현장'}`).join('<br>');
    };
    const showSail = () => {
      dk.clear(); dk.add(h('div', 'font-size:1.05em;flex:none', '<b>🧭 탐색 항해</b><br><small>화면 위 화살표가 가장 가까운 현장을 가리켜요. 현장에 가까이(16m) 가면 자동으로 정지해요.</small>'));
      info = h('div', 'flex:none;line-height:1.6;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09)', ''); dk.add(info); hud();
    };
    const board = (k) => {
      if (phase !== 'port') return;
      phase = 'sail'; shipKey = k; ship = ships[k]; tags.forEach((t) => { t.visible = false; }); boardBtn.show(false);
      const av = c.avatar(0, 0, 0); ship.add(av.group); const cw = ship.userData.crew; av.group.position.set(cw[0], cw[1], cw[2]); av.group.rotation.y = 0;
      interest[SHK[k]] = (interest[SHK[k]] || 0) + 1;
      hm = helm(c, ship, { reefs, walls: port.walls }); S = hm.S; hm.on(true); snd(c, 'go');
      showSail(); ui.banner(`⚓ ${NM[k]} 출항!`); ui.hint('◀▶ 키잡이 · ▲▼ 엔진 · 번호 부표를 찾아가요');
    };
    const openStation = (s) => {
      phase = 'card'; hm.on(false); S.thr = 0; S.speed = 0; gd.hide(); score += 5; snd(c, 'ok');
      dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>${s.icon} ${s.place} · ${s.i + 1}번 현장</b>`));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.65;flex:none', `📍 ${s.scene}<br><br>🧑‍🔧 <b>오늘의 일</b><br>${s.job}`));
      const wrong = shuffle(Object.keys(DNAME).filter((k) => k !== s.k)).slice(0, 2);
      quizFlow(dk, [{
        q: '이 일은 어느 학과에서 배울까요?',
        a: [[DNAME[s.k], true, `${DNAME[s.k]}에서 ${DESC[s.k]}하는 방법을 배워요.`], ...wrong.map((k) => [DNAME[k], false, `${DNAME[k]}는 '${DESC[k]}'을(를) 배우는 학과예요.`])],
        after: (ok) => { if (ok) score += 10; },
      }], () => rate(s));
    };
    const rate = (s) => {
      dk.clear(); dk.add(h('div', 'font-size:1.05em;flex:none', `<b>📝 ${s.icon} ${s.place}</b><br>이 일, 나와 잘 맞을 것 같나요? (정답은 없어요!)`));
      [['😍 재밌어요!', 2], ['🙂 보통이에요', 1], ['😕 잘 모르겠어요', 0]].forEach(([t, v]) => dk.add(btn(t, () => {
        interest[s.k] = (interest[s.k] || 0) + v; s.done = true; s.buoy.done(); done++; snd(c, 'ok');
        if (done >= 6) summary(); else { phase = 'sail'; hm.on(true); showSail(); ui.hint('다음 번호 부표를 찾아가요'); }
      }, 'background:#34506f;text-align:center')));
    };
    const summary = () => {
      phase = 'sum'; hm.on(false); gd.hide(); snd(c, 'win');
      const top = Object.entries(interest).sort((a, b) => b[1] - a[1]).filter((e) => e[1] > 0).slice(0, 2);
      dk.clear(); dk.add(h('div', 'font-size:1.05em;flex:none', '<b>🎓 탐색 결과</b>'));
      dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.75;flex:none', (top.length ? top.map(([k, v], i) => `${i ? '🥈' : '🥇'} <b>${DNAME[k]}</b><br><small>${DESC[k]} · 관심 점수 ${v}</small>`).join('<br>') : '아직 마음에 드는 학과를 못 찾았어요. 괜찮아요!') + `<br><br><small>처음 고른 배: ${NM[shipKey]}<br>이 밖에도 양식생물학과·해양융합과학과·해양바이오식품학과 부스가 있어요. 해양수산자율전공계열은 1학년 동안 다양한 전공을 경험한 뒤 학과를 선택해요.</small>`));
      dk.add(btn('🏁 탐색 마치기', endAll, 'background:#2a6bff;text-align:center'));
    };
    const endAll = () => {
      if (ended) return; ended = true; if (hm) hm.on(false); gd.hide(); dk.el.style.display = 'none';
      c.finish(score + (done > 0 && S ? clamp(10 - 2 * S.hits, 0, 10) : 0));
    };
    const ambient = (dt, t) => {
      Object.keys(ships).forEach((k, i) => { if (k !== shipKey) { ships[k].position.y = Math.sin(t * 1.2 + i * 2) * 0.08 - 0.05; ships[k].rotation.z = Math.sin(t * 0.9 + i) * 0.02; } });
      sea.update(S ? S.x : 0, S ? S.z : 0, t); if (hm) hm.update(dt, t);
    };
    const portCam = (t) => cam.to([-4 + Math.sin(t * 0.25) * 14, 22, 70], [-4, 2, -10]);

    return {
      start() { boardBtn.show(true); ui.hint('마음에 드는 배를 눌러 승선해요! (오른쪽 아래 ⚓ 버튼은 새동백호)'); dk.clear(); dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.7;flex:none', '<b>📋 오늘의 탐색</b><br>① 마음에 드는 배를 골라 승선<br>② 번호 부표 6곳 방문<br>③ 현장의 일 ↔ 학과 맞히기<br>④ 나에게 어울리는 학과 확인')); },
      down() {
        if (phase !== 'port') return; const hit = c.pick(Object.values(ships)); if (!hit) return; const k = which(hit.object); if (k) board(k);
      },
      key(code) {
        if (phase === 'port') { if (code === 'KeyE' || code === 'Enter' || code === 'Space') board('sae'); return; }
        if (phase === 'sail' && hm) { if (code === 'KeyW' || code === 'ArrowUp') hm.step(1); else if (code === 'KeyS' || code === 'ArrowDown') hm.step(-1); }
      },
      idle(dt, t) { ambient(dt, t); portCam(t); },
      update(dt, t) {
        ambient(dt, t);
        if (phase === 'port') { portCam(t); return; }
        if (ended) return;
        if (hm) hm.chase();
        if (phase === 'sail') {
          left -= dt; ui.timer(left); if (left <= 0) { endAll(); return; }
          let near = null, nd = 1e9;
          ST.forEach((s) => { if (s.done) return; const d = Math.hypot(s.x - S.x, s.z - S.z); if (d < nd) { nd = d; near = s; } });
          if (near) {
            gd.set(wrapA(Math.atan2(near.x - S.x, near.z - S.z) - S.hdg), `${near.i + 1}번 현장 · ${Math.round(nd)}m`);
            if (nd < 16) { openStation(near); return; }
          }
          hudT -= dt; if (hudT <= 0) { hudT = 0.3; hud(); }
        }
      },
      dispose() { if (hm) hm.dispose(); dk.dispose(); },
    };
  },
});