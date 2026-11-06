/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea4.js (신규, 수산해양 S3-a)
 *   ocs : 해양융합과학과 → 조사선 정점 관측 (CTD 수온·염분 프로파일 → 수온약층 채수 → 투명도판 → 장비 퀴즈)
 *   nav : 조선해양공학과 → 컨테이너선 설계 · 복원성(GM, GZ) 계산 · 예인수조 파도 시험 (2라운드)
 * exp-sea2.js 의 공용 도구(dock, slider, quizFlow …)와 exp-sea-kit.js 를 가져다 써요.
 * 수치는 학습용으로 단순화한 값이에요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp } from './experience.js';
import { SEA_ENV, createSea, makeResearchShip, tagSprite, snd } from './exp-sea-kit.js';
import { h, btn, slider, dock, quizFlow, gauss, LAB_ENV } from './exp-sea2.js';

/* ═══════════════ 1. 해양융합과학과 — 정점 관측 ═══════════════ */
const OMAX = 60, KS = 0.3;   /* 최대 수심 60m, 3D 화면 축척 1m = 0.3 */
const tcol = (T) => `hsl(${Math.round(215 - 207 * clamp((T - 8) / 16, 0, 1))},85%,55%)`;
const mkProfile = (c) => ({ t0: 20 + c.rnd(0, 3), t1: 9 + c.rnd(0, 2), zt: Math.round(16 + c.rnd(0, 16)), w: 2.6 + c.rnd(0, 1.2), sec: Math.round((5 + c.rnd(0, 6)) * 2) / 2 });
const tempAt = (z, P) => P.t1 + (P.t0 - P.t1) / (1 + Math.exp((z - P.zt) / P.w));
const salAt = (z, P) => 31.4 + 2.2 * (1 - Math.exp(-z / (P.zt * 1.1)));

/* 바닷속 단면(수심 눈금 + 측정한 수온 색 띠) */
function makeSlab() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const paint = (samples) => {
    g.clearRect(0, 0, 128, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#7fd0ff'); gr.addColorStop(1, '#06213f');
    g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(0, 0, 128, 512);
    const bh = 512 / OMAX; g.globalAlpha = 0.85;
    samples.forEach((s) => { g.fillStyle = tcol(s.T); g.fillRect(40, (s.d - 1) * bh, 88, bh + 1); });
    g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,.55)'; g.fillStyle = '#ffffff'; g.font = '700 22px sans-serif'; g.textAlign = 'left'; g.lineWidth = 2;
    for (let z = 0; z <= OMAX; z += 10) { const y = Math.min(z * bh + 1, 511); g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); if (z < OMAX) g.fillText(z + 'm', 3, y + 22); }
    tex.needsUpdate = true;
  };
  paint([]);
  return { tex, paint };
}

/* 수온·염분 프로파일 그래프 (세로축 = 수심) */
function drawProfile(cv, S, mark, curD) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, L = 36, T0 = 6, B0 = 26, pw = W - L - 10, ph = H - T0 - B0;
  const X1 = (t) => L + ((t - 6) / 18) * pw, X2 = (s) => L + ((s - 30.5) / 3.5) * pw, Y = (d) => T0 + (d / OMAX) * ph;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(L, T0, pw, ph);
  g.font = '700 11px sans-serif'; g.fillStyle = '#9fb3c9'; g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.textAlign = 'right';
  [0, 20, 40, 60].forEach((d) => { g.fillText(d + 'm', L - 4, Y(d) + 4); g.beginPath(); g.moveTo(L, Y(d)); g.lineTo(L + pw, Y(d)); g.stroke(); });
  g.textAlign = 'center'; [8, 14, 20].forEach((t) => g.fillText(t + '℃', X1(t), H - 10));
  const ln = (col, fx, key) => { if (!S.length) return; g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); S.forEach((s, i) => { const x = fx(s[key]), y = Y(s.d); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); };
  ln('#ff9b4d', X1, 'T'); ln('#6dffb0', X2, 'S');
  if (mark != null) { g.setLineDash([5, 4]); g.strokeStyle = '#ffd34d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, Y(mark)); g.lineTo(L + pw, Y(mark)); g.stroke(); g.setLineDash([]); }
  g.fillStyle = '#ffffff'; g.fillRect(L - 3, Y(curD) - 1.5, 8, 3);
}

registerExperience('ocs', {
  icon: '🌊', title: '해양 정점 조사 · CTD와 채수',
  desc: '조사선 새동백호에서 CTD로 바닷속 수온·염분을 재고, 수온약층에서 바닷물을 채수하고, 투명도판으로 바닷물의 맑기를 재어 보세요. 해양과학자의 하루 현장 조사를 체험해요. (수치는 학습용 가상 값이에요)',
  tools: ['🚢 조사선 새동백호', '📡 CTD(수온·염분)', '🧪 채수기', '⚪ 투명도판(세키디스크)'],
  steps: ['윈치 슬라이더로 CTD를 바닥 가까이(58m)까지 내려 수온·염분 그래프를 완성해요', '수온이 가장 급하게 변하는 층(수온약층)에서 윈치를 멈추고 🧪 채수해요', '투명도판을 내려 안 보이는 깊이와 다시 보이는 깊이를 재요', '장비 퀴즈 4문제로 마무리해요'],
  env: SEA_ENV,
  build(c) {
    const { root, ui, cam } = c;
    const sea = createSea(c), P = mkProfile(c), slab = makeSlab();
    const ship = makeResearchShip(c); root.add(ship);
    const tg = tagSprite('조사 정점 ST-3 · 여수 연안', 'rgba(20,110,150,.9)', 9, 2); tg.position.set(0, 17, 0); root.add(tg);
    c.box(0.18, 0.18, 1.9, '#cdd3da', 0, 7.2, -13, ship);                                  /* A자 틀에서 뒤로 뻗은 붐 */
    const rig = new THREE.Group(); rig.position.set(0, 0, -13.9); ship.add(rig);          /* 바다 수면 = rig y 0 */
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(10, OMAX * KS), new THREE.MeshBasicMaterial({ map: slab.tex, transparent: true, depthTest: false, side: THREE.DoubleSide }));
    sm.rotation.y = Math.PI; sm.position.y = -(OMAX * KS) / 2; sm.renderOrder = 4; rig.add(sm);
    const bm = (col) => new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true });
    const part = (par, geo, col, x, y, z) => { const m = new THREE.Mesh(geo, bm(col)); m.position.set(x, y, z); m.renderOrder = 7; par.add(m); return m; };
    const cable = part(rig, new THREE.BoxGeometry(0.07, 1, 0.07), '#2b2f36', 0, 0, 0);
    const ros = new THREE.Group(); rig.add(ros);
    part(ros, new THREE.TorusGeometry(0.8, 0.07, 6, 20), '#eef2f6', 0, 0.55, 0).rotation.x = Math.PI / 2;
    part(ros, new THREE.TorusGeometry(0.8, 0.07, 6, 20), '#eef2f6', 0, -0.55, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; part(ros, new THREE.CylinderGeometry(0.17, 0.17, 1.0, 8), '#3da5ff', Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); }
    part(ros, new THREE.BoxGeometry(0.4, 0.9, 0.4), '#ffcc33', 0, -0.25, 0);
    const disk = new THREE.Group(); disk.visible = false; rig.add(disk);
    const dm = part(disk, new THREE.CylinderGeometry(1.0, 1.0, 0.1, 28), '#ffffff', 0, 0, 0);

    const dk = dock(c, '🔬 해양 정점 조사');
    const samples = [];
    let stage = 'cast', cur = 0, tgt = 0, lastN = 0, left = 300, ended = false, nextShown = false, fired = false, sub = 'down', d1 = 0;
    let bottlePts = 0, secPts = 0, quizRight = 0, cv = null, rd = null, sl = null, rdT = 0, dirty = false, b1 = null;

    const layout = () => {
      const top = 7.2, bot = stage === 'secchi' ? -cur * KS : -cur * KS + 0.62;
      ros.position.y = -cur * KS; disk.position.y = -cur * KS - 0.05;
      cable.scale.y = Math.max(0.1, top - bot); cable.position.y = (top + bot) / 2;
    };
    const mkChart = () => { cv = h('canvas', 'width:100%;flex:none;border-radius:8px;background:rgba(0,0,0,.18)', ''); cv.width = 340; cv.height = 190; dk.add(cv); dk.add(h('div', 'flex:none;font-size:.9em', '<span style="color:#ff9b4d">━ 수온(℃)</span> &nbsp; <span style="color:#6dffb0">━ 염분</span> &nbsp; <span style="color:#ffd34d">┄ 표시 수심</span>')); };
    const mkRead = () => { rd = h('div', 'flex:none;line-height:1.55;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.09)', ''); dk.add(rd); };

    /* ① CTD 프로파일 */
    const startCast = () => {
      stage = 'cast'; cur = tgt = 0; lastN = 0; samples.length = 0; slab.paint(samples); ros.visible = true; disk.visible = false; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>① CTD 관측 · 수온·염분 프로파일</b><br><small>윈치를 천천히 내리면 깊이별 수온과 염분이 기록돼요. 오른쪽 바닷속 단면에 수온이 색으로 칠해져요.</small>'));
      mkChart(); mkRead();
      sl = slider('⬇ 윈치 수심', 'm', 0, OMAX, 1, 0, (v) => { tgt = v; }, 0); dk.add(sl.el);
      drawProfile(cv, samples, null, 0); ui.hint('윈치 슬라이더를 오른쪽으로 끌어 CTD를 내려요 (바닥 가까이 58m까지)');
    };
    /* ② 수온약층 채수 */
    const startBottle = () => {
      stage = 'bottle'; fired = false; tgt = Math.round(cur); dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>② 수온약층 채수</b><br><small>그래프에서 수온선이 가장 급하게 꺾이는 깊이가 <b>수온약층</b>이에요. 윈치를 그 깊이에 멈추고 🧪 채수하세요. 영양염·플랑크톤 연구는 이 층의 물이 중요해요.</small>'));
      mkChart(); mkRead();
      sl = slider('⬆⬇ 채수 수심', 'm', 0, OMAX, 1, tgt, (v) => { tgt = v; }, 0); dk.add(sl.el);
      dk.add(btn('🧪 이 깊이에서 채수!', fire, 'background:#b5453a;text-align:center'));
      drawProfile(cv, samples, null, cur); ui.hint('수온이 가장 급하게 변하는 깊이에 멈추고 채수해요');
    };
    const fire = () => {
      if (fired || stage !== 'bottle') return;
      if (Math.abs(cur - tgt) > 0.6) { ui.pop('윈치가 멈춘 뒤에 채수해요', null, '#ffe9a0'); return; }
      fired = true; snd(c, 'ok'); const err = Math.abs(cur - P.zt); bottlePts = 30 * clamp(1 - (err - 2) / 10, 0, 1);
      drawProfile(cv, samples, P.zt, cur);
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(40,160,90,.22);line-height:1.6;flex:none', `<b>🧪 ${cur.toFixed(0)}m 채수 완료</b><br>🌡 ${tempAt(cur, P).toFixed(1)}℃ · 🧂 염분 ${salAt(cur, P).toFixed(2)}<br>수온약층은 약 <b>${P.zt}m</b> · 내 채수 오차 <b>${err.toFixed(0)}m</b> → <b>${bottlePts.toFixed(0)}/30점</b><br><small>${err <= 3 ? '정확해요! 수온약층 위아래는 물이 잘 섞이지 않아 영양염 농도가 크게 달라요.' : '수온선이 가장 급하게 꺾이는 곳이 수온약층이에요. 노란 점선이 정답 깊이예요.'}</small>`));
      dk.add(btn('⚪ 투명도 측정으로 ▶', startSecchi, 'background:#2a6bff;text-align:center'));
    };
    /* ③ 투명도판 */
    const startSecchi = () => {
      stage = 'secchi'; sub = 'down'; cur = tgt = 0; ros.visible = false; disk.visible = true; dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', '<b>③ 투명도판(세키디스크) 측정</b><br><small>흰 원판을 내려 처음 <b>안 보이는</b> 깊이를 기록하고, 다시 천천히 올려 <b>다시 보이는</b> 깊이를 기록해요. 두 깊이의 평균이 투명도예요.</small>'));
      mkRead();
      sl = slider('⬇ 투명도판 수심', 'm', 0, 20, 0.5, 0, (v) => { tgt = v; }, 1); dk.add(sl.el);
      b1 = btn('👁 안 보여요!', () => {
        d1 = cur; sub = 'up'; b1.remove(); snd(c, 'click'); ui.hint('이제 천천히 올려서, 원판이 다시 보이기 시작하는 깊이에서 눌러요');
        b1 = btn('👀 다시 보여요!', () => {
          const d2 = cur, avg = (d1 + d2) / 2, err = Math.abs(avg - P.sec); secPts = 25 * clamp(1 - (err - 0.7) / 3.5, 0, 1); b1.remove(); snd(c, 'ok');
          dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(40,160,90,.22);line-height:1.6;flex:none', `<b>⚪ 투명도 ${avg.toFixed(1)}m</b> (사라진 ${d1.toFixed(1)}m · 다시 보인 ${d2.toFixed(1)}m)<br>실제 투명도 <b>${P.sec.toFixed(1)}m</b> · 오차 ${err.toFixed(1)}m → <b>${secPts.toFixed(0)}/25점</b><br><small>투명도가 낮으면 플랑크톤·부유물이 많다는 뜻이고, 빛이 깊이 닿지 않아 광합성 층이 얕아져요.</small>`));
          dk.add(btn('📋 장비 퀴즈 ▶', startQuiz, 'background:#2a6bff;text-align:center'));
        }, 'background:#2a6bff;text-align:center'); dk.add(b1);
      }, 'background:#b5453a;text-align:center'); dk.add(b1);
      ui.hint('투명도판을 내려요. 원판이 안 보이는 순간 👁 버튼!');
    };
    /* ④ 장비 퀴즈 */
    const startQuiz = () => {
      stage = 'quiz'; disk.visible = false; dk.clear();
      quizFlow(dk, [
        { q: '바다 <b>표층의 식물·동물플랑크톤</b>을 채집하려면?', a: [['플랑크톤 네트', true, '아주 고운 그물로 물속 플랑크톤을 걸러 모아요.'], ['채니기', false, '채니기는 바닥의 퇴적물을 떠요.'], ['투명도판', false, '투명도판은 바닷물의 맑기를 재요.']] },
        { q: '<b>항만 바닥의 퇴적물과 저서생물</b>을 채취하려면?', a: [['채니기', true, '바닥 펄을 퍼 올려 퇴적물과 그 속의 생물을 조사해요.'], ['플랑크톤 네트', false, '이 그물은 물속에 떠다니는 플랑크톤용이에요.'], ['CTD', false, 'CTD는 물속의 수온·염분을 재는 장비예요.']] },
        { q: '<b>수심 20m의 바닷물을 병에 담아</b> 영양염을 분석하려면?', a: [['채수기', true, '원하는 깊이에서 닫혀 그 깊이의 물만 담아 와요.'], ['CTD만 내린다', false, 'CTD는 수온·염분 값을 재지만 물 시료를 담지는 못해요.'], ['투명도판', false, '투명도판은 맑기만 알려 줘요.']] },
        { q: '<b>깊이별 수온·염분</b>을 연속으로 재는 장비는?', a: [['CTD', true, 'Conductivity(전기전도도)·Temperature·Depth를 재요. 염분은 전기전도도로 계산해요.'], ['채니기', false, '채니기는 바닥 퇴적물을 떠요.'], ['플랑크톤 네트', false, '플랑크톤을 걸러 모으는 그물이에요.']] },
      ], (right) => { quizRight = right; endAll(); });
    };
    const endAll = () => { if (ended) return; ended = true; dk.el.style.display = 'none'; c.finish(20 * clamp(lastN / 58, 0, 1) + bottlePts + secPts + quizRight * 6.25); };

    const animScene = (dt, t) => {
      sea.update(0, 0, t); ship.position.y = Math.sin(t * 1.2) * 0.05 - 0.03; ship.rotation.z = Math.sin(t * 0.9) * 0.008;
      const v = 10; cur += clamp(tgt - cur, -v * dt, v * dt); layout();
      cam.to([15, 15, -44], [0, -5, -12]);
    };
    return {
      start() { startCast(); },
      idle(dt, t) { animScene(dt, t); },
      update(dt, t) {
        animScene(dt, t);
        if (ended) return;
        left -= dt; ui.timer(left); if (left <= 0) { endAll(); return; }
        if (stage === 'cast') {
          const n = Math.floor(cur + 1e-6);
          while (lastN < n && lastN < OMAX) { lastN++; samples.push({ d: lastN, T: tempAt(lastN, P) + gauss(0.04), S: salAt(lastN, P) + gauss(0.01) }); dirty = true; }
          if (dirty) { dirty = false; slab.paint(samples); if (cv) drawProfile(cv, samples, null, cur); }
          if (lastN >= 58 && !nextShown) { nextShown = true; snd(c, 'ok'); dk.add(btn('🧪 수온약층 채수로 ▶', startBottle, 'background:#2a6bff;text-align:center')); ui.hint('프로파일 완성! 다음 단계로 넘어가요'); }
        }
        if (stage === 'secchi') { const vis = cur < 0.7 * P.sec ? 1 : clamp((P.sec - cur) / (0.3 * P.sec), 0, 1); dm.material.opacity = vis; }
        rdT -= dt;
        if (rdT <= 0 && rd) {
          rdT = 0.1;
          if (stage === 'secchi') rd.innerHTML = `⬇ 투명도판 <b>${cur.toFixed(1)}m</b> ${sub === 'down' ? '· 내리는 중' : '· 올리는 중'}`;
          else { if (cv && stage === 'bottle') drawProfile(cv, samples, fired ? P.zt : null, cur); rd.innerHTML = `⬇ 수심 <b>${cur.toFixed(0)}m</b> · 🌡 <b>${tempAt(cur, P).toFixed(1)}℃</b> · 🧂 <b>${salAt(cur, P).toFixed(2)}</b>`; }
        }
      },
      dispose() { dk.dispose(); },
    };
  },
});

/* ═══════════════ 2. 조선해양공학과 — 선박 설계 · 복원성 시험 ═══════════════ */
const G9 = 9.81, SL = 180, SD = 16, CB = 0.7, RHO = 1.025;
/* 설계값 → 배수량·흘수·무게중심·GM·최대 복원 각도(φv) */
function calc(B, tiers, bal) {
  const mh = 0.23 * SL * B * SD, mo = 0.12 * SL * B * SD, mt = 0.22 * SL * B, mb = (bal / 100) * 0.10 * SL * B * SD;
  const M = mh + mo + mb + mt * tiers; let mom = mh * 0.55 * SD + mo * 0.40 * SD + mb * 1.2;
  for (let i = 1; i <= tiers; i++) mom += mt * (SD + 2.6 * (i - 0.5));
  const KG = mom / M, T = M / (RHO * SL * B * CB), KB = 0.53 * T, BM = 0.107 * B * B / T, GM = KB + BM - KG, fb = SD - T, k = 0.4 * B;
  const phiv = (0.30 + 0.12 * Math.max(GM, 0)) * clamp(fb / 5, 0.4, 1.3);
  return { M, KG, T, KB, BM, GM, fb, k, phiv, Tphi: GM > 0.05 ? (2 * Math.PI * k) / Math.sqrt(G9 * GM) : 99 };
}
const gzAt = (d, ph) => Math.max(d.GM, 0.05) * ph * (1 - Math.pow(ph / d.phiv, 2));
const NR = [
  { name: '컨테이너선 설계', tiers: 4, gmMin: 1.3, gmMax: 5.0, fbMin: 3.0, H: 3, Tw: 10, hw: 0.20, rollMax: 25, pts: [12, 12, 16], story: '🚢 <b>임무:</b> 컨테이너를 <b>4단 이상</b> 싣고도 바람·파도에 안전한 배를 설계해요. 컨테이너를 높이 쌓으면 무게중심(KG)이 올라가 복원성(GM)이 줄어요.' },
  { name: '태풍 항로 운항선', tiers: 5, gmMin: 1.8, gmMax: 4.5, fbMin: 3.5, H: 6, Tw: 11, hw: 0.32, rollMax: 30, pts: [14, 14, 17], story: '🌀 <b>임무:</b> 파고 6m·주기 11초의 높은 파도와 강한 측풍을 견디며 <b>5단 이상</b> 적재해요. 배의 횡동요 주기가 파도 주기와 비슷하면 크게 흔들려요.' },
];
const chip = (ok, t) => `<span style="color:${ok ? '#7dffa8' : '#ff8a80'}">${ok ? '✅' : '⚠'} ${t}</span>`;

function drawGZ(cv, d, hw) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, L = 34, T0 = 8, B0 = 20, pw = W - L - 8, ph = H - T0 - B0;
  const mx = Math.max(0.8, hw * 2.2, Math.max(d.GM, 0.05) * 0.385 * d.phiv * 1.3), mn = -mx * 0.45;
  const X = (deg) => L + (deg / 80) * pw, Y = (v) => T0 + ((mx - v) / (mx - mn)) * ph;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(L, T0, pw, ph);
  g.font = '700 11px sans-serif'; g.fillStyle = '#9fb3c9'; g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.textAlign = 'center';
  [0, 20, 40, 60, 80].forEach((a) => g.fillText(a + '°', X(a), H - 6));
  g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + pw, Y(0)); g.stroke(); g.textAlign = 'right'; g.fillText('0', L - 4, Y(0) + 4);
  const pts = []; for (let a = 0; a <= 80; a += 1) pts.push([a, clamp(gzAt(d, (a * Math.PI) / 180), mn, mx)]);
  g.beginPath(); g.moveTo(X(0), Y(0)); pts.forEach(([a, v]) => g.lineTo(X(a), Y(Math.max(0, v)))); g.lineTo(X(80), Y(0)); g.closePath(); g.fillStyle = 'rgba(95,227,255,.2)'; g.fill();
  g.strokeStyle = '#5fe3ff'; g.lineWidth = 2.5; g.beginPath(); pts.forEach(([a, v], i) => { if (i) g.lineTo(X(a), Y(v)); else g.moveTo(X(a), Y(v)); }); g.stroke();
  g.setLineDash([5, 4]); g.strokeStyle = '#ff8a80'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, Y(hw)); g.lineTo(L + pw, Y(hw)); g.stroke(); g.setLineDash([]);
  g.textAlign = 'left'; g.fillStyle = '#ff8a80'; g.fillText('바람이 미는 힘(레버)', L + 6, Y(hw) - 4);
  g.fillStyle = '#5fe3ff'; g.fillText('복원력 GZ(m)', L + 6, T0 + 12);
}

registerExperience('nav', {
  icon: '🚢', title: '선박 설계 · 복원성 시험수조',
  desc: '조선해양공학자가 되어 컨테이너선의 선폭·적재 단수·밸러스트를 설계하고, 복원력 곡선(GZ)을 읽은 뒤 예인수조에서 바람과 파도 시험으로 안전한지 확인해 보세요. (수치는 학습용으로 단순화했어요)',
  tools: ['📐 설계 슬라이더', '⚖ 복원력 곡선(GZ)', '🌊 예인수조 모형시험', '🧪 규정 점검표'],
  steps: ['선폭·컨테이너 단수·밸러스트를 조절해 흘수·건현·GM이 규정 안에 들게 해요', '복원력 곡선이 빨간 점선(바람의 힘)보다 충분히 위에 있는지 확인해요', '🌊 파도 시험! 전복하지 않고 크게 흔들리지 않아야 해요 (다시 설계 가능)', '2라운드(태풍 항로) 후 퀴즈 2문제로 마무리해요'],
  env: LAB_ENV,
  build(c) {
    const { root, ui, cam } = c;
    /* 시험수조 홀 */
    c.box(130, 0.5, 74, '#c9d5df', 0, -3.4, 0, root); c.box(130, 18, 0.5, '#e6eef5', 0, 6, -32, root);
    c.box(72, 0.4, 46, '#8ea9c0', 0, -3.0, 0, root);
    [-36, 36].forEach((x) => c.box(0.8, 3.4, 46, '#dfe9f2', x, -1.3, 0, root)); c.box(72, 3.4, 0.8, '#dfe9f2', 0, -1.3, -23, root);
    const paddle = c.box(0.8, 3, 44, '#566377', -35.6, -0.8, 0, root);
    const lab = tagSprite('예인수조 · 선박 모형시험', 'rgba(20,70,110,.9)', 9, 2); lab.position.set(0, 9, -20); root.add(lab);
    /* 물결 */
    const wGeo = new THREE.PlaneGeometry(70, 44, 42, 26); wGeo.rotateX(-Math.PI / 2);
    const wPos = wGeo.attributes.position, wx = new Float32Array(wPos.count); for (let i = 0; i < wPos.count; i++) wx[i] = wPos.getX(i);
    const water = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: '#3a95d4', transparent: true, opacity: 0.6, roughness: 0.25, flatShading: true, side: THREE.DoubleSide })); root.add(water);
    const setWave = (A, k, w, t) => { for (let i = 0; i < wPos.count; i++) wPos.setY(i, A * Math.sin(k * wx[i] - w * t)); wPos.needsUpdate = true; wGeo.computeVertexNormals(); };
    /* 모형선 (1유닛 = 10m, 선수 +z) */
    const rollG = new THREE.Group(); root.add(rollG); const shipG = new THREE.Group(); rollG.add(shipG);
    const shp = new THREE.Shape(); shp.moveTo(-0.5, -0.5); shp.lineTo(0.5, -0.5); shp.lineTo(0.5, 0.25); shp.quadraticCurveTo(0.3, 0.42, 0, 0.5); shp.quadraticCurveTo(-0.3, 0.42, -0.5, 0.25); shp.closePath();
    const hg = new THREE.ExtrudeGeometry(shp, { depth: 1, bevelEnabled: false }); hg.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hg, [new THREE.MeshStandardMaterial({ color: '#8d9aa8', roughness: 0.7, side: THREE.DoubleSide }), new THREE.MeshStandardMaterial({ color: '#2b3f66', roughness: 0.6, side: THREE.DoubleSide })]);
    hull.position.y = 1.6; shipG.add(hull);
    const CC = ['#d94a3d', '#2f6fed', '#e8b92f', '#3aa86a', '#8e5cf2', '#ff8a3d'], cons = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.26, 3.4), new THREE.MeshStandardMaterial({ color: CC[(i * 2 + j) % 6], roughness: 0.7 })); m.position.set(0, 1.6 + 0.13 + i * 0.26, -3.7 + j * 3.7); shipG.add(m); cons.push({ m, i }); }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1, 3.0, 2.2), new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6 })); bridge.position.set(0, 3.1, -7.4); shipG.add(bridge);
    c.cyl(0.5, 0.5, 0.9, '#e8602c', 0, 5.0, -7.9, shipG, 12);

    const dk = dock(c, '🚢 선박 설계실');
    const dsg = { B: 30, t: 2, b: 0 }, best = [{ tot: 0 }, { tot: 0 }], sim = { t: 0, ph: 0, v: 0, max: 0 };
    let ri = 0, phase = 'design', D = calc(30, 2, 0), left = 360, ended = false, tt = 0, testT = 0, capT = 0, capDir = 1, quizRight = 0, rdT = 0;
    let specEl = null, gz = null, prog = null, live = null;

    const applyShip = () => {
      hull.scale.set(dsg.B * 0.1, 1.6, 18); shipG.position.y = -D.T * 0.1;
      cons.forEach(({ m, i }) => { m.visible = i < dsg.t; m.scale.x = dsg.B * 0.1 * 0.78; }); bridge.scale.x = dsg.B * 0.1 * 0.7;
    };
    const refresh = () => {
      const R = NR[ri]; D = calc(dsg.B, dsg.t, dsg.b); applyShip();
      const gmOk = D.GM >= R.gmMin && D.GM <= R.gmMax, fbOk = D.fb >= R.fbMin;
      const tip = D.GM < R.gmMin ? '💡 GM 부족: 선폭 ↑ · 밸러스트 ↑ · 컨테이너 단수 ↓' : D.GM > R.gmMax ? '💡 GM이 너무 커서 급하게 흔들려요: 선폭 ↓ 또는 밸러스트 ↓' : !fbOk ? '💡 건현 부족: 밸러스트 ↓ 또는 단수 ↓' : '✔ 규정 범위예요! 🌊 파도 시험으로 확인해요';
      specEl.innerHTML = `배수량 <b>${(D.M / 1000).toFixed(1)}천t</b> · 흘수 <b>${D.T.toFixed(1)}m</b> · 건현 ${chip(fbOk, D.fb.toFixed(1) + 'm (≥' + R.fbMin + ')')}<br>무게중심 KG <b>${D.KG.toFixed(1)}m</b> · GM ${chip(gmOk, D.GM.toFixed(2) + 'm (' + R.gmMin + '~' + R.gmMax + ')')}<br>횡동요 주기 <b>${D.Tphi >= 99 ? '불안정' : D.Tphi.toFixed(0) + '초'}</b> · 적재 ${chip(dsg.t >= R.tiers, dsg.t + '단 (목표 ≥' + R.tiers + ')')}<br><small>${tip}</small>`;
      drawGZ(gz, D, R.hw);
    };
    const showDesign = () => {
      phase = 'design'; sim.ph = sim.v = 0; rollG.rotation.z = 0; rollG.position.y = 0; dk.clear(); const R = NR[ri];
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>🚢 설계 ${ri + 1}/2 · ${R.name}</b>`));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.6;flex:none', R.story));
      const sB = slider('↔ 선폭(B)', 'm', 22, 40, 1, dsg.B, (v) => { dsg.B = v; refresh(); }, 0);
      const sT = slider('📦 컨테이너 단수', '단', 0, 7, 1, dsg.t, (v) => { dsg.t = v; refresh(); }, 0);
      const sBa = slider('💧 밸러스트(이중저 탱크)', '%', 0, 100, 5, dsg.b, (v) => { dsg.b = v; refresh(); }, 0);
      specEl = h('div', 'line-height:1.6;flex:none;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.09)', '');
      gz = h('canvas', 'width:100%;flex:none;border-radius:8px;background:rgba(0,0,0,.18)', ''); gz.width = 340; gz.height = 150;
      dk.add(sB.el, sT.el, sBa.el, specEl, gz, btn('🌊 파도 시험 시작', startTest, 'background:#2a6bff;text-align:center'));
      refresh(); ui.hint('설계 슬라이더를 움직이면 배와 복원력 곡선이 바로 바뀌어요');
    };
    /* 파도 시험 */
    const startTest = () => {
      if (phase !== 'design') return;
      phase = 'test'; sim.t = 0; sim.ph = 0; sim.v = 0; sim.max = 0; testT = 0; dk.clear(); const R = NR[ri];
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>🌊 파도 시험 중</b><br><small>파고 ${R.H}m · 주기 ${R.Tw}초 · 측풍을 받아요</small>`));
      prog = h('div', 'flex:none;height:12px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden', '<div style="height:100%;width:0%;background:#5fe3ff"></div>');
      live = h('div', 'flex:none;line-height:1.6;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09)', '');
      dk.add(prog, live); ui.hint('배가 버티는지 지켜봐요!'); snd(c, 'go');
    };
    const stepSim = (dt) => {
      const R = NR[ri], GMe = Math.max(D.GM, 0.05), w = Math.sqrt(G9 * GMe) / D.k, lam = (G9 * R.Tw * R.Tw) / (2 * Math.PI), a0 = (Math.PI * R.H) / lam, ww = (2 * Math.PI) / R.Tw;
      const n = Math.ceil(dt / 0.02), s = dt / n;
      for (let i = 0; i < n; i++) {
        sim.t += s; const gust = Math.min(1, sim.t / 8), f = sim.ph * (1 - Math.pow(sim.ph / D.phiv, 2));
        const acc = -2 * 0.08 * w * sim.v - w * w * f + w * w * (a0 * Math.sin(ww * sim.t) + (R.hw / GMe) * gust);
        sim.v += acc * s; sim.ph += sim.v * s; sim.max = Math.max(sim.max, Math.abs(sim.ph));
        if (Math.abs(sim.ph) > D.phiv) return true;
      }
      return false;
    };
    const finishTest = (capsized) => {
      phase = 'result'; const R = NR[ri], maxDeg = (sim.max * 180) / Math.PI, gmOk = D.GM >= R.gmMin && D.GM <= R.gmMax, fbOk = D.fb >= R.fbMin;
      const survived = !capsized, rollOk = survived && maxDeg <= R.rollMax;
      const stab = R.pts[0] * (gmOk && fbOk ? 1 : D.GM > 0.5 ? 0.3 : 0), cargo = survived ? R.pts[1] * clamp(dsg.t / R.tiers, 0, 1) : 0;
      const wave = capsized ? 0 : rollOk ? R.pts[2] * clamp(1 - (maxDeg - 10) / R.rollMax, 0.4, 1) : R.pts[2] * 0.25, tot = stab + cargo + wave;
      if (tot > best[ri].tot) best[ri] = { stab, cargo, wave, tot };
      const sum = R.pts[0] + R.pts[1] + R.pts[2];
      dk.clear(); snd(c, capsized ? 'bad' : rollOk ? 'win' : 'bad');
      dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.7;flex:none', `<b>${capsized ? '🔄 전복!' : rollOk ? '✅ 시험 통과!' : '⚠ 너무 크게 흔들렸어요'}</b><br>최대 횡경사 <b>${maxDeg.toFixed(0)}°</b> (허용 ${R.rollMax}°)<br>규정 ${stab.toFixed(0)}/${R.pts[0]} · 적재 ${cargo.toFixed(0)}/${R.pts[1]} · 내항성 ${wave.toFixed(0)}/${R.pts[2]} → 이번 <b>${tot.toFixed(0)}/${sum}점</b> (최고 ${best[ri].tot.toFixed(0)})<br><small>${capsized ? '바람이 미는 힘을 이길 복원력이 모자랐어요. 복원력 곡선이 빨간 점선보다 충분히 위에 있어야 해요. GM을 키우거나 무게중심을 낮춰요.' : rollOk ? '복원력이 충분했어요. 조선해양공학자는 이런 모형시험으로 설계를 확정해요.' : '복원력은 있었지만 파도와 공진했어요. GM을 조금 바꿔 횡동요 주기를 파도 주기에서 멀어지게 해 보세요.'}</small>`));
      dk.add(btn('🔧 다시 설계', showDesign, 'background:#34506f;text-align:center'));
      dk.add(btn(ri < NR.length - 1 ? '🌀 다음 라운드(태풍) ▶' : '📋 마무리 퀴즈 ▶', () => { if (ri < NR.length - 1) { ri++; showDesign(); } else startQuiz(); }, 'background:#2a6bff;text-align:center'));
    };
    const startQuiz = () => {
      phase = 'quiz'; dk.clear();
      quizFlow(dk, [
        { q: 'GM(메타센터 높이)이 <b>너무 작으면</b> 왜 위험할까요?', a: [['복원력이 약해 작은 힘에도 크게 기울고 전복 위험이 커져요', true, 'GM이 작을수록 기울어진 배를 바로 세우는 힘(GZ)이 작아져요.'], ['선체가 무거워서 바로 가라앉아요', false, '가라앉는 것은 부력·건현 문제이고 GM과는 달라요.'], ['엔진 효율이 떨어져요', false, 'GM은 엔진 효율과 관계가 없어요.']] },
        { q: '컨테이너를 <b>높이 쌓을수록</b> 복원성이 나빠지는 이유와 대응은?', a: [['무게중심(KG)이 올라 GM이 줄어요 → 밸러스트로 아래쪽을 무겁게 해 KG를 낮춰요', true, 'GM = KB + BM − KG 이므로 KG를 낮추면 GM이 커져요.'], ['배수량이 줄어서예요 → 컨테이너를 더 쌓아요', false, '쌓을수록 배수량은 늘고 KG는 올라가요.'], ['선폭이 좁아져서예요 → 선수를 길게 해요', false, '선폭은 변하지 않아요. 선폭을 넓히면 BM이 커져 도움이 돼요.']] },
      ], (right) => { quizRight = right; endAll(); });
    };
    const endAll = () => { if (ended) return; ended = true; dk.el.style.display = 'none'; c.finish(best[0].tot + best[1].tot + quizRight * 7.5); };

    return {
      start() { showDesign(); },
      idle(dt, t) { cam.to([0, 8, 36], [0, 0.8, 0]); },
      update(dt, t) {
        cam.to([0, 8, 36], [0, 0.8, 0]); tt += dt;
        if (!ended) { left -= dt; ui.timer(left); if (left <= 0) { endAll(); return; } }
        const R = NR[ri];
        if (phase === 'test') {
          testT += dt; const cap = stepSim(dt * 3);
          const lam = (G9 * R.Tw * R.Tw) / (2 * Math.PI);
          setWave(R.H / 20, (2 * Math.PI * 10) / lam, (2 * Math.PI) / R.Tw, sim.t); paddle.position.x = -35.6 + Math.sin(sim.t * ((2 * Math.PI) / R.Tw)) * 0.25;
          rollG.rotation.z = -sim.ph; rollG.position.y = Math.sin(sim.t * ((2 * Math.PI) / R.Tw)) * (R.H / 20) * 0.6;
          if (prog) prog.firstChild.style.width = `${clamp(testT / 20, 0, 1) * 100}%`;
          rdT -= dt; if (rdT <= 0 && live) { rdT = 0.15; live.innerHTML = `횡경사 <b>${((sim.ph * 180) / Math.PI).toFixed(0)}°</b> · 최대 <b>${((sim.max * 180) / Math.PI).toFixed(0)}°</b><br><small>전복 한계 약 ${((D.phiv * 180) / Math.PI).toFixed(0)}°</small>`; }
          if (cap) { phase = 'cap'; capT = 0; capDir = Math.sign(sim.ph) || 1; ui.banner('🔄 전복!'); }
          else if (testT >= 20) finishTest(false);
        } else if (phase === 'cap') {
          capT += dt; const a = Math.min(1, capT / 1.2); rollG.rotation.z = -capDir * (D.phiv + a * (2.6 - D.phiv)); shipG.position.y -= dt * 0.5; setWave(R.H / 20, 0.4, 2, tt);
          if (capT > 1.8) finishTest(true);
        } else {
          setWave(0.04, 0.45, 1.8, tt); paddle.position.x = -35.6; if (phase === 'design') rollG.rotation.z = -Math.sin(tt * 0.8) * 0.02;
        }
      },
      dispose() { dk.dispose(); },
    };
  },
});