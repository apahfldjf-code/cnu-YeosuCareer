/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea3.js (신규, 수산해양 S2-b)
 *   fsh : 수산생명의학과     → 어병 진단 클리닉 (증상 관찰 → 해부로 이상 장기 찾기 → 진단 → 처방·방역)
 *   smf : 스마트수산자원관리학과 → AI 자원 평가 · 12년간 어획량(TAC) 결정
 * exp-sea2.js 의 공용 도구(dock, slider, quizFlow …)를 가져다 써요. 증상·수치는 학습용으로 단순화한 사례예요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { SEA_ENV, createSea, makeResearchShip, makeTug, buoy, tagSprite, snd, vib } from './exp-sea-kit.js';
import { h, btn, slider, dock, quizFlow, gauss, LAB_ENV } from './exp-sea2.js';

/* ═══════════════ 1. 수산생명의학과 — 어병 진단 클리닉 ═══════════════ */
const INFO = {
  gill: ['아가미', '물속 산소를 받아들이고 이산화탄소를 내보내요'], heart: ['심장', '피를 온몸으로 보내는 펌프예요 (1심방 1심실)'],
  liver: ['간', '영양분 저장·해독·담즙 생산을 맡아요'], stomach: ['위', '먹이를 1차로 소화해요'], intestine: ['장', '영양분을 흡수해요'],
  gonad: ['생식소(난소·정소)', '알과 정자를 만들어요'], swim: ['부레', '공기 주머니로 물속에서 뜨는 깊이를 조절해요'],
};
const CASES = [
  { pat: '🐟 양식 넙치 · 수조에서 폐사 직전', sym: ['수면 가까이에서 입을 뻐끔거려요 (산소는 충분한데도!)', '아가미 뚜껑을 쉴 새 없이 여닫아요', '몸을 수조 벽에 자꾸 비벼요'], organ: 'gill',
    find: '아가미 판이 창백하고 점액이 많아요. 아가미를 현미경으로 보니 아주 작은 기생충(흡충류)이 붙어 있어요.',
    diag: { q: '아가미에서 작은 기생충이 발견됐어요. 가장 알맞은 진단은?', a: [['아가미 기생충(흡충류) 감염', true, '기생충이 아가미를 손상시켜 산소 흡수가 어려워지고, 호흡곤란과 몸을 비비는 행동이 나타나요.'], ['바이러스성 출혈성 패혈증', false, '출혈 소견이 없고, 기생충이 직접 확인됐어요.'], ['사료 속 비타민 부족', false, '영양 결핍이 아가미에 기생충을 만들지는 않아요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['담수욕(민물 목욕)으로 기생충을 떨어뜨리고, 수조·그물을 소독해 재감염을 막는다', true, '바닷물고기의 아가미 기생충은 민물에 약해 담수욕이 흔히 쓰여요. (시간·수질은 전문가 지도에 따라요)'], ['항바이러스제를 사료에 섞어 먹인다', false, '원인이 바이러스가 아니라서 효과가 없어요.'], ['병든 물고기를 그대로 시장에 출하한다', false, '질병을 퍼뜨리고 식품 안전에도 문제가 돼요.']] } },
  { pat: '🐟 양식 우럭 · 수온이 오른 여름', sym: ['몸 표면에 붉은 출혈 반점과 궤양이 있어요', '배가 부풀고 움직임이 둔해요', '수온이 25℃를 넘은 뒤 폐사가 늘었어요'], organ: 'liver',
    find: '간이 붓고 표면에 붉은 점 출혈이 있어요. 복강에는 맑은 액체(복수)가 고여 있고, 배양 검사에서 세균(비브리오속)이 자랐어요.',
    diag: { q: '간 비대·복수·세균 배양 양성이에요. 가장 알맞은 진단은?', a: [['세균성 감염(비브리오증)', true, '고수온기에 세균이 늘어 패혈증이 생기면 간·복강에 이런 변화가 나타나요.'], ['아가미 기생충 감염', false, '이번 사례는 아가미가 아니라 간과 복강에 이상이 있어요.'], ['단순 저산소증', false, '저산소증은 출혈 반점·복수·세균 검출로 이어지지 않아요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['진단에 따라 처방받은 수산용 항생제를 정해진 용법·휴약 기간을 지켜 쓰고, 사육 밀도·수질을 개선한다', true, '항생제는 반드시 전문가 처방이 필요하고, 휴약 기간을 지켜야 식품 안전을 지킬 수 있어요.'], ['시중 항생제를 아무거나 많이 섞어 먹인다', false, '내성균이 생기고 약 성분이 몸에 남을 위험이 커요.'], ['수온 변화를 무시하고 사료만 늘린다', false, '아픈 물고기는 먹지 못하고, 남은 사료는 수질만 나빠져요.']] } },
  { pat: '🐟 양식 넙치 · 수온이 낮은 초봄', sym: ['눈이 튀어나오고 아가미가 창백해요', '며칠 만에 수조의 폐사 수가 빠르게 늘어요', '항생제를 먹여도 소용이 없었어요'], organ: 'swim',
    find: '부레와 내장 표면에 붉은 점 모양 출혈이 보여요. 세균 배양에서는 아무 균도 자라지 않았고, 유전자 검사(PCR)에서 바이러스 양성이에요.',
    diag: { q: '세균은 안 자라고 바이러스 검사가 양성이에요. 가장 알맞은 진단은?', a: [['바이러스성 출혈성 패혈증(VHS)', true, '세균이 없고 항생제가 듣지 않으며 바이러스 검사가 양성이면 바이러스병이에요.'], ['비브리오증(세균)', false, '세균 배양에서 균이 자라지 않았어요.'], ['아가미 기생충 감염', false, '기생충은 발견되지 않았어요.']] },
    treat: { q: '어떤 조치가 알맞을까요?', a: [['치료약이 없으므로 병든 개체를 격리하고 이동을 제한하며, 시설·장비를 소독하고 관할 기관에 신고한다', true, '바이러스병은 확산을 막는 방역이 가장 중요해요. 법정 전염병은 신고 의무가 있어요.'], ['항생제를 2배로 늘려 투여한다', false, '항생제는 바이러스에 효과가 없고 내성만 키워요.'], ['폐사어를 이웃 양식장에 나눠 준다', false, '병원체를 퍼뜨리는 위험한 행동이에요.']] } },
];

registerExperience('fsh', {
  icon: '🐟', title: '어병 진단 클리닉 · 해부와 처방',
  desc: '수산질병관리사가 되어 아픈 물고기의 증상을 살피고, 해부로 이상 장기를 찾아 병을 진단한 뒤 알맞은 처방과 방역 조치를 결정해 보세요. (사례는 학습용으로 단순화했어요)',
  tools: ['🩺 진료 차트', '🔪 해부 도구', '🔬 검사 결과', '🧪 처방·방역'],
  steps: ['진료 차트의 증상을 읽고 🔪 해부를 시작해요', '장기를 눌러 이름·역할을 확인하며 이상 소견이 있는 장기를 찾아요 (틀리면 감점)', '검사 결과를 보고 병명을 진단해요', '알맞은 처방·방역 조치를 골라요 (3마리 환자)'],
  env: LAB_ENV,
  build(c) {
    const { root, ui, cam } = c;
    c.box(44, 0.4, 28, '#c9d5df', 5, -0.2, 0, root); c.box(44, 13, 0.5, '#e6eef5', 5, 6.5, -10, root);
    c.box(16, 0.5, 9, '#b9c6d2', 0, -0.05, 0, root); c.box(14, 0.25, 7.6, '#e7eef4', 0, 0.2, 0, root);
    /* 현미경 · 장식 */
    c.box(2.2, 0.4, 1.8, '#2d3a4b', -10, 0.2, -4, root); c.cyl(0.25, 0.25, 2.6, '#2d3a4b', -10.5, 1.5, -4, root, 8); const tube = c.cyl(0.3, 0.3, 2.2, '#566377', -10, 2.4, -4, root, 10); tube.rotation.z = 0.5;
    const lab = tagSprite('검사실 · 현미경', 'rgba(20,70,110,.9)', 5.2, 1.3); lab.position.set(-10, 4.6, -4); root.add(lab);

    /* 물고기 몸통(아래 반쪽 그릇 + 열리는 뚜껑) */
    const BY = 1.75, bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e9a99a', roughness: 0.8, side: THREE.DoubleSide }));
    bowl.scale.set(5.4, 1.5, 2.4); bowl.position.set(0, BY, 0); root.add(bowl);
    const lid = new THREE.Group(); lid.position.set(0, BY, -2.4); root.add(lid);
    const skin = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8ea3b8', roughness: 0.45, metalness: 0.15 }));
    skin.scale.set(5.4, 1.5, 2.4); skin.position.set(0, 0, 2.4); lid.add(skin);
    c.sph(0.32, '#ffffff', -4.2, 0.78, 2.7, lid); c.sph(0.17, '#111111', -4.35, 0.88, 2.82, lid);
    const tail = c.cyl(2.2, 0, 2.4, '#7f95aa', 6.5, BY, 0, root, 4); tail.rotation.z = -Math.PI / 2; tail.scale.x = 0.15;

    /* 장기 */
    const og = (id, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); g.userData.oid = id; root.add(g); return g; };
    const ell = (g, r, col, sx, sy, sz, x = 0, y = 0, z = 0) => { const m = c.sph(r, col, x, y, z, g); m.scale.set(sx, sy, sz); return m; };
    const O = {};
    { const g = og('gill', -3.3, 0.95, 0.1); const pl = [0, 1, 2, 3].map((k) => { const p = c.box(0.14, 0.9, 1.6, '#d6404a', k * 0.3 - 0.45, 0, 0, g); p.rotation.z = (k - 1.5) * 0.12; return p; }); O.gill = { g, pl }; }
    var mucus = new THREE.Group(); O.gill.g.add(mucus); for (let i = 0; i < 8; i++) { const s = c.sph(0.14, '#ffffff', c.rnd(-0.6, 0.6), c.rnd(-0.4, 0.5), c.rnd(-0.7, 0.7), mucus); s.material.transparent = true; s.material.opacity = 0.75; }
    O.heart = { g: og('heart', -2.2, 0.8, 0.95) }; ell(O.heart.g, 0.42, '#b3202f', 1, 0.9, 0.9);
    O.liver = { g: og('liver', -1.0, 0.75, 0.75) }; const liverM = ell(O.liver.g, 0.7, '#9c3a2a', 1.5, 0.55, 0.95);
    const lSp = new THREE.Group(); O.liver.g.add(lSp); for (let i = 0; i < 8; i++) c.sph(0.07, '#d81e2a', c.rnd(-0.9, 0.9), 0.42, c.rnd(-0.5, 0.5), lSp);
    O.stomach = { g: og('stomach', 0.3, 0.7, 0.5) }; ell(O.stomach.g, 0.62, '#e5a89d', 1.4, 0.6, 0.85);
    O.intestine = { g: og('intestine', 1.6, 0.6, 0.95) }; for (let k = 0; k < 4; k++) c.cyl(0.13, 0.13, 1.6, '#e9b7a8', 0, 0, k * 0.25 - 0.4, O.intestine.g, 8).rotation.z = Math.PI / 2;
    O.gonad = { g: og('gonad', 3.2, 0.7, 0.35) }; ell(O.gonad.g, 0.6, '#f0c25a', 2.0, 0.5, 0.8);
    O.swim = { g: og('swim', 1.9, 0.9, -0.85) }; ell(O.swim.g, 0.7, '#eef3f7', 3.2, 0.5, 0.55);
    const sSp = new THREE.Group(); O.swim.g.add(sSp); for (let i = 0; i < 9; i++) c.sph(0.07, '#d81e2a', c.rnd(-1.8, 1.8), 0.32, c.rnd(-0.25, 0.25), sSp);
    const fluid = c.sph(1, '#f1e29a', 0.5, 0.45, 0.2, root); fluid.scale.set(4.6, 0.18, 1.9); fluid.material.transparent = true; fluid.material.opacity = 0.35; fluid.visible = false;
    const resetOrg = () => { O.gill.pl.forEach((p) => p.material.color.set('#d6404a')); mucus.visible = false; liverM.scale.set(1.5, 0.55, 0.95); liverM.material.color.set('#9c3a2a'); lSp.visible = false; fluid.visible = false; sSp.visible = false; };
    const applyCase = (k) => { resetOrg(); if (k === 0) { O.gill.pl.forEach((p) => p.material.color.set('#eac7c7')); mucus.visible = true; } else if (k === 1) { liverM.scale.set(1.9, 0.75, 1.1); liverM.material.color.set('#c28a4a'); lSp.visible = true; fluid.visible = true; } else sSp.visible = true; };
    const flashQ = [];
    const flash = (g) => { g.traverse((m) => { if (m.material && m.material.emissive) m.material.emissive.setRGB(0.55, 0.5, 0.1); }); flashQ.push({ g, t: 0.45 }); };

    const dk = dock(c, '🩺 어병 진단 클리닉');
    const order = shuffle([0, 1, 2]);
    let ci = 0, phase = 'idle', lidP = 0, left = 300, ended = false, oPts = 0, dPts = 0, tPts = 0, cutBtn = null, msgEl = null;
    const wrong = new Set();

    const showCase = () => {
      const cs = CASES[order[ci]]; applyCase(order[ci]); phase = 'obs'; lidP = 0; wrong.clear(); dk.clear();
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>📋 진료 차트 ${ci + 1}/3</b><br>${cs.pat}`));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.65;flex:none', '<b>🩺 임상 증상</b><br>' + cs.sym.map((s) => '• ' + s).join('<br>')));
      cutBtn = btn('🔪 해부 시작 (몸을 열어요)', doCut, 'background:#b5453a'); dk.add(cutBtn); ui.hint('증상을 읽고 🔪 해부를 시작해요');
    };
    const doCut = () => { if (phase !== 'obs') return; phase = 'cut'; cutBtn.remove(); snd(c, 'swing'); ui.hint('해부 중…'); };
    const onFound = () => {
      phase = 'diag'; const cs = CASES[order[ci]]; oPts += clamp(10 - 3 * wrong.size, 0, 10); snd(c, 'ok');
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(40,160,90,.22);line-height:1.6;flex:none', `<b>🔬 검사 소견</b><br>${cs.find}`));
      dk.add(btn('🧪 진단·처방 결정 ▶', () => {
        quizFlow(dk, [{ ...cs.diag, after: (ok) => { if (ok) dPts += 12; } }, { ...cs.treat, after: (ok) => { if (ok) tPts += 34 / 3; } }], () => {
          ci++; if (ci < 3) showCase(); else endAll();
        });
      }, 'background:#2a6bff;text-align:center')); ui.hint('검사 소견을 보고 진단해요');
    };
    const endAll = () => { if (ended) return; ended = true; dk.el.style.display = 'none'; c.finish(oPts + dPts + tPts); };

    return {
      start() { showCase(); },
      down() {
        if (phase !== 'find') return;
        const hit = c.pick(Object.values(O).map((o) => o.g)); if (!hit) return;
        let o = hit.object; while (o && !o.userData.oid) o = o.parent; if (!o) return;
        const id = o.userData.oid, inf = INFO[id]; flash(o);
        if (id === CASES[order[ci]].organ) { ui.pop(`⚠ ${inf[0]} 이상 발견!`, hit.point, '#a0ffb8'); onFound(); }
        else { wrong.add(id); snd(c, 'bad'); ui.pop(`${inf[0]} — ${inf[1]} (정상이에요)`, hit.point, '#ffe9a0'); if (msgEl) msgEl.innerHTML = `❌ ${inf[0]}은(는) 이번 증상과 관련이 적어요. (오답 ${wrong.size}회)`; }
      },
      idle(dt, t) { cam.to([5, 10, 9.5], [5, 0.8, 0]); },
      update(dt, t) {
        cam.to([5, 10, 9.5], [5, 0.8, 0]);
        flashQ.forEach((f) => { f.t -= dt; if (f.t <= 0) f.g.traverse((m) => { if (m.material && m.material.emissive) m.material.emissive.setRGB(0, 0, 0); }); });
        for (let i = flashQ.length - 1; i >= 0; i--) if (flashQ[i].t <= 0) flashQ.splice(i, 1);
        if (phase === 'cut') {
          lidP = Math.min(1, lidP + dt * 0.8);
          if (lidP >= 1) { phase = 'find'; msgEl = h('div', 'line-height:1.55;color:#ffd9a0;flex:none', '🔎 증상과 관련된 장기를 눌러 보세요. 누르면 이름과 역할이 나와요.'); dk.add(msgEl); ui.hint('이상 소견이 있는 장기를 눌러요'); }
        }
        lid.rotation.x = -(1 - Math.pow(1 - lidP, 3)) * 2.4;
        if (!ended && (phase === 'obs' || phase === 'cut' || phase === 'find')) { left -= dt; ui.timer(left); if (left <= 0) endAll(); }
      },
      dispose() { dk.dispose(); },
    };
  },
});

/* ═══════════════ 2. 스마트수산자원관리학과 — AI 자원 평가 ═══════════════ */
const YEARS = 12, K = 100, RG = 0.4;
const drawChart = (cv, hs, cur) => {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, L = 28, Bt = 18, T0 = 8, pw = W - L - 8, ph = H - Bt - T0, Y = (v) => T0 + ph - (v / 100) * ph, n = YEARS, bw = pw / n;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(L, T0, pw, ph);
  g.font = '700 11px sans-serif'; g.textAlign = 'right'; g.fillStyle = '#9fb3c9';
  [0, 50, 100].forEach((v) => { g.fillText(v, L - 4, Y(v) + 4); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); });
  g.setLineDash([5, 4]); g.strokeStyle = '#ffd34d'; g.beginPath(); g.moveTo(L, Y(50)); g.lineTo(L + pw, Y(50)); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ffd34d'; g.textAlign = 'left'; g.fillText('MSY 수준', L + 4, Y(50) - 3);
  hs.forEach((x, i) => { const hh = (x.C / 25) * ph * 0.5; g.fillStyle = 'rgba(255,140,80,.78)'; g.fillRect(L + i * bw + bw * 0.2, T0 + ph - hh, bw * 0.6, hh); });
  const pts = hs.map((x, i) => [L + i * bw + bw / 2, Y(x.est)]); pts.push([L + hs.length * bw + bw / 2, Y(cur)]);
  g.strokeStyle = '#5fe3ff'; g.lineWidth = 2.5; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  g.fillStyle = '#ffffff'; pts.forEach((p, i) => { g.beginPath(); g.arc(p[0], p[1], i === pts.length - 1 ? 4.5 : 3, 0, Math.PI * 2); g.fill(); });
  g.textAlign = 'center'; g.fillStyle = '#9fb3c9'; for (let i = 0; i < n; i += 2) g.fillText(i + 1, L + i * bw + bw / 2, H - 4);
};

registerExperience('smf', {
  icon: '📈', title: 'AI 수산자원 평가 · 어획량(TAC) 결정',
  desc: 'AI와 조사 데이터로 어족 자원량을 추정하고, 12년 동안 해마다 총허용어획량(TAC)을 정해 보세요. 많이 잡으면서도 자원을 지키는 균형이 핵심이에요. (수치는 학습용 가상 값이에요)',
  tools: ['📡 어군 탐지·CPUE 데이터', '🤖 AI 자원량 예측', '📊 자원 평가 차트', '🎚 TAC 결정'],
  steps: ['해마다 음향조사·CPUE·어린 물고기 비율·해황 예보를 확인해요', '데이터로 자원량을 추정해 TAC 슬라이더를 정하고 ✅ 결정해요', 'AI 추천은 3번만 쓸 수 있고, 측정에는 오차가 있어요', '12년 뒤 누적 어획과 남은 자원량으로 점수가 나와요 (자원이 무너지면 큰 감점)'],
  env: SEA_ENV,
  build(c) {
    const { root, ui, cam } = c;
    const sea = createSea(c);
    const ship = makeResearchShip(c); ship.position.set(-10, 0, 4); ship.rotation.y = 0.3; root.add(ship);
    const boats = [[14, -6], [18, 3], [14, 11]].map(([x, z]) => { const b = makeTug(c); b.position.set(x, 0, z); b.rotation.y = Math.PI / 2; root.add(b); return { b, x, z }; });
    [[4, 18, 'AI'], [30, -14, 'AI']].forEach(([x, z, n]) => buoy(c, root, n, x, z, '#2a9fd6'));
    const shadows = [], sg = new THREE.Group(); root.add(sg);
    for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(c.rnd(0.5, 1.1), 14), new THREE.MeshBasicMaterial({ color: '#05203f', transparent: true, opacity: 0.4, depthWrite: false })); m.rotation.x = -Math.PI / 2; const a = c.rnd(0, 6.28), r = c.rnd(0, 14); m.position.set(34 + Math.cos(a) * r, 0.06, 2 + Math.sin(a) * r); sg.add(m); shadows.push({ m, a, r, sp: c.rnd(0.1, 0.4) }); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#7fe9ff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(-10, 0.1, 4); root.add(ring);
    const barge = new THREE.Group(); barge.position.set(-8, 0, -26); root.add(barge); c.box(12, 0.8, 6, '#6b7787', 0, 0.2, 0, barge);
    const crates = []; for (let i = 0; i < 36; i++) { const x = (i % 6) * 1.6 - 4, z = (Math.floor(i / 6) % 3) * 1.5 - 1.5, y = 0.9 + Math.floor(i / 18) * 1.1; const cr = c.box(1.4, 1.0, 1.3, ['#e8b92f', '#2f6fed', '#3aa86a', '#d94a3d'][i % 4], x, y, z, barge); crates.push(cr); }
    const tg = tagSprite('수확물 운반선', 'rgba(20,70,110,.9)', 7, 1.7); tg.position.set(-8, 5, -26); root.add(tg);
    const ts = tagSprite('자원조사선 · AI 관측', 'rgba(20,110,150,.9)', 8, 1.8); ts.position.set(-10, 16, 4); root.add(ts);

    const dk = dock(c, '📈 AI 수산자원 평가');
    const warm = new Set(shuffle([3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 2));
    let yr = 1, B = 70, cum = 0, phase = 'idle', seasonT = 9, aiLeft = 3, tac = 10, ended = false, quizRight = 0;
    let ac = 0, cp = 0, est = 0, jv = 0, lastCatch = 0;
    const hist = [];
    let cv = null, predEl = null, sl = null, recBtn = null;

    const measure = () => {
      ac = Math.max(1, B * (1 + gauss(0.12))); cp = Math.max(1, B * (1 + gauss(0.18))); est = 0.6 * ac + 0.4 * cp;
      jv = clamp(18 + 55 * Math.pow(Math.max(0, 1 - B / K), 1.2) + gauss(4), 5, 75);
    };
    const pred = (C) => est + RG * est * (1 - est / K) * (warm.has(yr) ? 0.6 : 1) - C;
    const recommend = () => Math.max(0, Math.round(est * 0.2 * (warm.has(yr) ? 0.75 : 1) * (est / K < 0.35 ? 0.5 : 1) * 2) / 2);
    const updPred = () => {
      const p = Math.max(0, pred(tac)), lo = Math.max(0, p - est * 0.12), hi = p + est * 0.12;
      predEl.innerHTML = `🔮 내년 예상 자원량 <b style="color:#5fe3ff">${p.toFixed(0)}</b> <small>(${lo.toFixed(0)}~${hi.toFixed(0)})</small> ${p < 40 ? '<span style="color:#ff8a80">⚠ 위험 수준</span>' : p < 50 ? '<span style="color:#ffd34d">주의</span>' : '<span style="color:#7dffa8">양호</span>'}`;
      drawChart(cv, hist, est);
    };
    const showYear = () => {
      phase = 'decide'; measure(); dk.clear(); const w = warm.has(yr);
      dk.add(h('div', 'display:flex;justify-content:space-between;font-size:1.05em;flex:none', `<b>📅 ${yr}/${YEARS}년차</b><span>누적 어획 <b style="color:#ffd34d">${cum.toFixed(1)}</b></span>`));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.6;flex:none', `📡 어군 탐지(음향) <b>${ac.toFixed(0)}</b> · 🎣 CPUE 지수 <b>${cp.toFixed(0)}</b><br>🤖 AI 종합 추정 자원량 <b style="color:#5fe3ff">${est.toFixed(0)}</b> <small>(±12%)</small><br>🐟 어린 개체 비율 <b>${jv.toFixed(0)}%</b> ${jv > 45 ? '<span style="color:#ff8a80">⚠ 산란친어 부족 경고</span>' : ''}<br>${w ? '🌡 <span style="color:#ffb27a">해수온 이상 예보: 어린 물고기 생존율이 떨어져 자원 회복이 느려져요</span>' : '🌊 해황 평년 수준'}`));
      cv = h('canvas', 'width:100%;flex:none;border-radius:8px;background:rgba(0,0,0,.18)'); cv.width = 340; cv.height = 140; dk.add(cv);
      dk.add(h('div', 'flex:none;font-size:.9em', '<span style="color:#5fe3ff">● AI 추정 자원량</span> &nbsp; <span style="color:#ff9b66">▇ 어획량</span>'));
      tac = Math.round(est * 0.15 * 2) / 2;
      sl = slider('🎚 총허용어획량(TAC)', '', 0, 25, 0.5, tac, (v) => { tac = v; updPred(); }, 1);
      predEl = h('div', 'line-height:1.6;flex:none'); dk.add(sl.el, predEl);
      recBtn = btn(`🤖 AI 추천 TAC 보기 (남은 ${aiLeft}회)`, () => {
        if (aiLeft <= 0) { ui.pop('추천 횟수를 모두 썼어요', null, '#ffe9a0'); return; }
        aiLeft--; const rec = recommend(); sl.set(rec); recBtn.innerHTML = `🤖 AI 추천 TAC 보기 (남은 ${aiLeft}회)`; ui.pop(`AI 추천 TAC: ${rec.toFixed(1)} (오차가 있을 수 있어요)`, null, '#a0e7ff');
      }, 'background:#34506f');
      dk.add(recBtn, btn('✅ 이 TAC로 결정', decide, 'background:#2a6bff;text-align:center'));
      updPred(); ui.hint('데이터를 보고 TAC를 정해요. 많이 잡되 자원은 지켜야 해요!');
    };
    const decide = () => {
      if (phase !== 'decide') return;
      const act = Math.min(tac, B * 0.9), grow = RG * B * (1 - B / K) * (warm.has(yr) ? 0.6 : 1) * (1 + (Math.random() - 0.5) * 0.16);
      B = Math.max(0, B + grow - act); cum += act; lastCatch = act; hist.push({ est, C: act }); phase = 'season'; seasonT = 0; snd(c, 'go');
      dk.clear();
      dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.7;flex:none', `<b>📅 ${yr}년차 결과</b><br>🎣 올해 어획 <b style="color:#ffd34d">${act.toFixed(1)}</b> (TAC ${tac.toFixed(1)})<br>${act < tac ? '⚠ 자원이 부족해 허용량을 다 못 잡았어요' : '✅ 허용량만큼 잡았어요'}<br>🌊 새 시즌의 자원 상태는 <b>다음 해 조사</b>에서 확인해요`));
      dk.add(btn(yr >= YEARS || B < 8 ? '📊 최종 결과 보기 ▶' : '다음 해 ▶', () => { yr++; if (yr > YEARS || B < 8) finalSummary(); else showYear(); }, 'background:#2a6bff;text-align:center'));
      if (B < 8) { ui.banner('🚨 자원 붕괴! 어업을 중단해요'); snd(c, 'bad'); }
    };
    const scores = () => ({ catchS: 55 * clamp(cum / 110, 0, 1), stockS: B < 8 ? 0 : 35 * clamp((B / K - 0.25) / 0.25, 0, 1) });
    const finalSummary = () => {
      phase = 'final'; const sc = scores(); dk.clear();
      dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.75;flex:none', `<b>📊 ${Math.min(yr - 1, YEARS)}년 관리 결과</b><br>🎣 누적 어획 <b style="color:#ffd34d">${cum.toFixed(1)}</b> → ${sc.catchS.toFixed(0)}/55점<br>🐟 남은 자원량 <b style="color:${B / K >= 0.5 ? '#7dffa8' : B / K >= 0.3 ? '#ffd34d' : '#ff8a80'}">${B.toFixed(0)}/${K}</b> → ${sc.stockS.toFixed(0)}/35점<br><small>${B < 8 ? '자원이 무너졌어요. 한번 무너진 자원은 회복에 오랜 시간이 걸려요.' : B / K >= 0.5 ? '자원을 지키면서 꾸준히 잡았어요!' : '자원이 많이 줄었어요. 조금 덜 잡았다면 더 오래 지속할 수 있어요.'}</small>`));
      dk.add(btn('마무리 퀴즈 ▶', finalQuiz, 'background:#2a6bff;text-align:center'));
    };
    const finalQuiz = () => {
      phase = 'quiz';
      quizFlow(dk, [
        { q: '수산자원 관리에서 <b>TAC(총허용어획량)</b>는 무엇일까요?', a: [['자원 상태를 평가해 1년에 잡아도 되는 어획량의 상한', true, '과학적 자원 평가를 바탕으로 정하는 어획 한도예요.'], ['배 한 척이 한 번에 실을 수 있는 최대 양', false, '그건 선박의 적재량이에요.'], ['수산물 가격의 상한선', false, 'TAC는 가격이 아니라 어획량을 관리해요.']] },
        { q: '어린 물고기 비율이 높아지고 자원량 추정치가 계속 줄고 있어요. 가장 알맞은 관리는?', a: [['TAC를 줄이고 금어기·어린 물고기 보호(그물코 확대)를 강화한다', true, '산란할 어미 물고기를 늘려야 자원이 회복돼요.'], ['가격이 오를 때 더 많이 잡는다', false, '자원이 줄 때 더 잡으면 붕괴가 빨라져요.'], ['조사를 중단하고 지난해와 같은 양을 잡는다', false, '데이터 없이 관리하면 위험 신호를 놓쳐요.']] },
      ], (right) => { quizRight = right; endAll(); });
    };
    const endAll = () => { if (ended) return; ended = true; dk.el.style.display = 'none'; const sc = scores(); c.finish(sc.catchS + sc.stockS + quizRight * 5); };

    const animScene = (dt, t) => {
      sea.update(0, 0, t);
      ship.position.y = Math.sin(t * 1.2) * 0.1 - 0.05; ship.rotation.z = Math.sin(t * 0.9) * 0.02;
      const k = clamp(seasonT / 5, 0, 1), p = Math.sin(Math.PI * k);
      boats.forEach((o, i) => { o.b.position.set(o.x + p * (20 + i * 3), Math.sin(t * 1.3 + i) * 0.1 - 0.05, o.z + Math.sin(t * 0.5 + i) * 0.5); o.b.rotation.y = k < 0.5 ? Math.PI / 2 : -Math.PI / 2; });
      const ns = Math.round((B / K) * 70); shadows.forEach((s, i) => { s.m.visible = i < ns; s.a += s.sp * dt * 0.3; s.m.position.x = 34 + Math.cos(s.a) * s.r; s.m.position.z = 2 + Math.sin(s.a) * s.r; });
      const nc = Math.round(clamp(cum / 130, 0, 1) * 36); crates.forEach((cr, i) => { cr.visible = i < nc; });
      const rk = (t % 3) / 3; ring.scale.setScalar(1 + rk * 44); ring.material.opacity = 0.5 * (1 - rk);
      cam.to([4 + Math.sin(t * 0.15) * 3, 26, 46], [8, 0, -2]);
    };

    return {
      start() { showYear(); },
      idle(dt, t) { animScene(dt, t); },
      update(dt, t) { if (phase === 'season') seasonT += dt; animScene(dt, t); },
      dispose() { dk.dispose(); },
    };
  },
});