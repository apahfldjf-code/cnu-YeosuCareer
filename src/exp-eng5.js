/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng5.js (신규, E2-4) — 공학대학 나머지 학과 체험 6종
 *   che : 화공생명공학과     → 반응기 운전(온도·압력·촉매) 수율 최적화 + 안전 판단
 *   pcm : 석유화학소재공학과 → 분별증류탑 제품 배치 + 고객별 출하
 *   env : 환경시스템공학과   → 하수 처리 공정 설계 + 송풍기(DO) 운전
 *   bio : 융합생명공학과     → DNA 염기쌍 복원 + 유전자 가위 교정
 *   bme : 의공학부           → 심전도 전극 부착 + 필터 조절 + 심박수 진단
 *   itc : 산업기술융합공학과 → 현장 순찰 점검 + 압력 상승 비상 대응
 * 필요: experience.js, exp-eng3.js(tag).  exp-kit.js 는 쓰지 않음(이 파일만으로 동작)
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, rnd, shuffle } from './experience.js';
import { tag } from './exp-eng3.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const LAB = { sky: '#dfe7f1', fog: ['#dfe7f1', 50, 160], sunColor: '#ffffff', sunI: 1.35, hemi: ['#f2f6ff', '#8c97a8', 1.0], sunPos: [18, 40, 22] };
const kill = (root, g) => { root.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); };
/* 포인터가 가리키는 그룹의 인덱스(없으면 -1) */
const hit = (c, groups) => { const h = c.pick(groups); if (!h) return -1; for (let i = 0; i < groups.length; i++) for (let x = h.object; x; x = x.parent) if (x === groups[i]) return i; return -1; };
/* 포인터 광선이 수평면(y=v) 또는 수직면(z=v)과 만나는 지점 */
const atPlane = (c, axis, v) => {
  c.camera.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(c.ptr.nx, c.ptr.ny), c.camera);
  return rc.ray.intersectPlane(new THREE.Plane(axis === 'z' ? V3(0, 0, 1) : V3(0, 1, 0), -v), new THREE.Vector3());
};
/* 끌어다 놓기 도구: items=[{g,...}], axis/v = 끌 때 쓰는 평면, o={can,lift,drop(item,moved)} */
function dragger(c, items, axis, v, o = {}) {
  let d = null;
  return {
    down() {
      const live = items.filter((i) => i.g.visible && (!o.can || o.can(i))), k = hit(c, live.map((i) => i.g)); if (k < 0) return false;
      const it = live[k]; if (o.lift) o.lift(it);
      const pt = atPlane(c, axis, v); if (!pt) return false;
      d = { it, off: it.g.position.clone().sub(pt), sx: c.ptr.x, sy: c.ptr.y, mv: false }; return true;
    },
    move() {
      if (!d || !c.ptr.down) return;
      if (!d.mv && Math.hypot(c.ptr.x - d.sx, c.ptr.y - d.sy) > 8) { d.mv = true; c.sfx.click(); }
      if (d.mv) { const pt = atPlane(c, axis, v); if (pt) d.it.g.position.copy(pt).add(d.off); }
    },
    up() { if (!d) return; const x = d; d = null; if (o.drop) o.drop(x.it, x.mv); },
  };
}
/* ➖➕ 버튼을 누르고 있으면 반복 */
const rep = (b, st, dt, fn) => { if (b.held()) { st.t += dt; if (st.t > 0.4) { st.t -= 0.13; fn(); } } else st.t = 0; };

/* ───────────────────────── 1. 화공생명공학과 · 반응기 운전 ───────────────────────── */
registerExperience('che', {
  icon: '🧪', title: '화학 반응기 운전·수율 최적화',
  desc: '플라스틱·배터리 소재를 만드는 반응기를 직접 운전해요. 온도·압력·촉매량을 조절해 수율(생산 효율)을 높이되, 안전 한계는 넘지 마세요.',
  tools: ['🌡️ 온도 · 🧭 압력 · ⚗️ 촉매 조절', '📈 수율 계측기', '🛡️ 안전밸브'],
  steps: ['왼쪽 버튼으로 조절할 항목(🌡️🧭⚗️)을 고르고 ➖ ➕로 값을 바꿔요 (누르고 있으면 계속)', '수율 92% 이상을 3초 유지하면 1단계 성공', '원료가 바뀌면 최적점이 이동해요 — 2단계에서 다시 찾아요', '압력·온도 한계를 넘으면 안전밸브가 작동해 수율이 0이 돼요'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const VAR = [
      { k: 'T', n: '온도', u: '℃', min: 100, max: 400, st: 10, ic: '🌡️' },
      { k: 'P', n: '압력', u: 'bar', min: 2, max: 50, st: 2, ic: '🧭' },
      { k: 'C', n: '촉매량', u: '%', min: 0, max: 10, st: 0.5, ic: '⚗️' },
    ];
    const val = { T: 150, P: 10, C: 1 }, LIM = { P: 40, T: 350 };
    const opt = { T: 240 + 10 * Math.floor(rnd(0, 7)), P: 18 + 2 * Math.floor(rnd(0, 7)), C: 3 + 0.5 * Math.floor(rnd(0, 7)) };
    let phase = 'run', stage = 1, sel = 0, trip = 0, trips = 0, hd = 0, ycur = 0, left = 100, sig = '';
    const sM = { t: 0 }, sP = { t: 0 };

    c.ground('#aeb8c4', 34); c.box(12, 0.5, 9, '#59667a', 0, 0.25, 0);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6.6, 32), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false }));
    glass.position.set(0, 3.8, 0); root.add(glass);
    const liq = c.cyl(2.2, 2.2, 1, '#4cd17a', 0, 1.3, 0); liq.material.transparent = true; liq.material.opacity = 0.82;
    const heat = c.cyl(2.55, 2.55, 0.6, '#3a3f4a', 0, 1.6, 0);
    const ag = new THREE.Group(); ag.position.set(0, 4.2, 0); root.add(ag);
    c.cyl(0.12, 0.12, 6, '#cfd5de', 0, 0, 0, ag); c.box(3.2, 0.15, 0.4, '#cfd5de', 0, -1.6, 0, ag); c.box(0.4, 0.15, 3.2, '#cfd5de', 0, -0.8, 0, ag);
    c.cyl(2.5, 2.5, 0.3, '#59667a', 0, 7.25, 0);
    [-1, 1].forEach((s) => {
      const p = c.cyl(0.28, 0.28, 6, '#8a93a3', s * 5.6, 2.2, 0); p.rotation.z = Math.PI / 2;
      c.cyl(1.4, 1.4, 3.6, '#e8ecf2', s * 9.8, 2.3, 0);
      const t = tag(root, s < 0 ? '🛢️ 원료' : '📦 제품', 2.6, 0.7); t.position.set(s * 9.8, 5, 0);
    });
    const sv = c.cyl(0.32, 0.32, 1.3, '#d6453d', 1.3, 8.0, 0);
    const tvv = tag(root, '🛡️ 안전밸브', 2.8, 0.7); tvv.position.set(3.6, 8.6, 0);
    const tags = VAR.map((v, i) => { const t = tag(root, '', 4.4, 0.8); t.position.set(-6.6, 6.8 - i * 1.0, 3); return t; });
    const tY = tag(root, '', 5.2, 1.0); tY.position.set(0, 9.8, 0);
    cam.set([0, 8.5, 19], [0, 4.6, 0]); cam.fov(50, true);

    const yld = () => (trip > 0 ? 0 : 100 * Math.exp(-(((val.T - opt.T) / 80) ** 2 + ((val.P - opt.P) / 10) ** 2 + ((val.C - opt.C) / 2) ** 2)));
    const adj = (dir) => {
      if (phase !== 'run') return; const v = VAR[sel], k = v.k;
      const nv = Math.round(clamp(val[k] + dir * v.st, v.min, v.max) * 10) / 10;
      if (nv === val[k]) { ui.pop('조절 한계예요', null, '#ffe9a0'); return; }
      val[k] = nv; c.sfx.click();
      if (val.P > LIM.P || val.T > LIM.T) {
        trip = 2.5; trips++; hd = 0; c.sfx.bump(); c.buzz(40);
        ui.pop(val.P > LIM.P ? '🚨 압력 초과! 안전밸브 작동' : '🚨 과열! 안전 차단', null, '#ffb0a0');
        val.P = Math.min(val.P, 30); val.T = Math.min(val.T, 330);
      }
    };
    const sb = VAR.map((v, i) => ui.button({ icon: v.ic, label: v.n, size: 64, pos: { left: (16 + i * 72) + 'px', bottom: '70px' }, down: () => { sel = i; sig = ''; c.sfx.click(); } }));
    const mM = ui.button({ icon: '➖', label: '줄이기', size: 80, pos: { right: '130px', bottom: '40px' }, down: () => { adj(-1); sM.t = 0; } });
    const mP = ui.button({ icon: '➕', label: '올리기', size: 80, pos: { right: '30px', bottom: '40px' }, down: () => { adj(1); sP.t = 0; } });
    const allB = [...sb, mM, mP]; allB.forEach((b) => b.show(false));

    const refresh = (y) => {
      VAR.forEach((v, i) => {
        const bad = (v.k === 'P' && val.P >= 36) || (v.k === 'T' && val.T >= 330);
        tags[i].userData.set(`${v.ic} ${v.n} ${val[v.k]}${v.u}`, '#fff', bad ? 'rgba(190,50,45,.92)' : i === sel ? 'rgba(47,111,237,.92)' : 'rgba(40,60,90,.85)');
      });
      tY.userData.set(trip > 0 ? '🚨 안전밸브 작동 · 수율 0%' : `📈 수율 ${Math.round(y)}%`, '#fff', trip > 0 ? 'rgba(190,50,45,.92)' : y >= 92 ? 'rgba(30,130,75,.92)' : 'rgba(40,60,90,.88)');
      ui.panel(`<b>🧪 반응기 운전 · ${stage}/2단계</b><br>${VAR.map((v, i) => `${i === sel ? '▶ ' : ''}${v.ic} ${v.n} ${val[v.k]}${v.u}`).join('<br>')}<br>📈 수율 <b>${Math.round(y)}%</b> (92%↑ 3초 · ${Math.min(3, hd).toFixed(1)}초)<br><small>안전 한계: 압력 ${LIM.P}bar · 온도 ${LIM.T}℃ · 작동 ${trips}회</small>`);
    };
    const nextStage = () => {
      hd = 0; stage = 2; c.sfx.ok(); ui.banner('🛢️ 원료가 바뀌었어요!');
      opt.T += opt.T > 260 ? -40 : 40; opt.P += opt.P > 24 ? -6 : 6; opt.C += opt.C > 4.5 ? -1 : 1;
      ui.hint('원료 성분이 달라져 최적점이 이동했어요. 다시 찾아봐요'); sig = '';
    };
    const result = (sc, extra) => { phase = 'end'; allB.forEach((b) => b.show(false)); ui.timer(null); ui.panel(`<b>📋 운전 결과</b><br>${extra}<br>안전밸브 작동 ${trips}회`); c.finish(clamp(sc, 0, 100)); };
    const quiz = () => {
      phase = 'quiz'; allB.forEach((b) => b.show(false)); c.sfx.win();
      const ops = shuffle([
        { t: '압력만 계속 올려 수율을 맞춘다', v: 0, m: '한계를 넘으면 설비와 사람이 위험해져요.' },
        { t: '안전 한계 안에서 한 변수씩 조금씩 바꾸며 최적점을 찾는다', v: 25, m: '정답! 공정은 안전이 최우선, 변수는 하나씩 확인해요.' },
        { t: '안전밸브를 잠가 두고 운전한다', v: 0, m: '안전밸브는 마지막 보호 장치라 절대 막으면 안 돼요.' }]);
      ui.ask('🛡️ 안전 점검!<br>수율이 아직 낮은데 압력이 안전 한계에 가까워졌어요. 가장 알맞은 판단은?', ops.map((o) => o.t), (i) => {
        const o = ops[i]; ui.pop(o.v ? '정답! ✔' : '아쉬워요', null, o.v ? '#a0ffb8' : '#ffd0d0'); ui.hint(o.m);
        result(60 + o.v + clamp(left, 0, 100) * 0.15 - trips * 5, `1·2단계 성공 ✅ · 안전 판단 ${o.v ? '정답 ✅' : '오답 ❌'}`);
      });
    };

    return {
      start() { allB.forEach((b) => b.show(true)); ui.hint('🌡️🧭⚗️ 버튼으로 항목을 고르고 ➖ ➕로 조절 · 수율 막대를 보며 최적점을 찾아요'); },
      update(dt, t) {
        ag.rotation.y += dt * (2 + val.C * 0.5);
        sv.material.emissive.setRGB(trip > 0 && Math.sin(t * 22) > 0 ? 1 : 0, 0, 0);
        if (phase !== 'run') return;
        rep(mM, sM, dt, () => adj(-1)); rep(mP, sP, dt, () => adj(1));
        left -= dt; ui.timer(left); if (trip > 0) trip -= dt;
        const y = yld(); ycur += (y - ycur) * Math.min(1, 5 * dt);
        const hv = clamp(ycur / 100, 0, 1), H = 0.4 + hv * 5.4;
        liq.scale.y = H; liq.position.y = 0.8 + H / 2; liq.material.color.setHSL(0.33 * hv, 0.65, 0.5);
        const f = (val.T - 100) / 300; heat.material.emissive.setRGB(f * 0.9, f * 0.2, 0);
        if (y >= 92) hd += dt; else hd = 0;
        if (hd >= 3) { if (stage === 1) nextStage(); else { quiz(); return; } }
        if (left <= 0) { result((stage - 1) * 30 + Math.min(20, ycur * 0.2) - trips * 5, `시간 종료 · ${stage - 1}단계 완료`); return; }
        const s = `${val.T}|${val.P}|${val.C}|${sel}|${Math.round(y)}|${trips}|${stage}|${Math.floor(hd * 2)}|${trip > 0}`;
        if (s !== sig) { sig = s; refresh(y); }
      },
      idle(dt) { ag.rotation.y += dt * 2; },
    };
  },
});

/* ───────────────────────── 2. 석유화학소재공학과 · 분별증류탑 ───────────────────────── */
registerExperience('pcm', {
  icon: '🛢️', title: '원유 분별증류탑 운전·제품 출하',
  desc: '여수산단의 핵심 설비인 분별증류탑에서 원유 성분이 나뉘는 원리를 배우고, 만들어진 제품을 알맞은 고객에게 출하해 보세요.',
  tools: ['🏭 분별증류탑', '🛢️ 제품 드럼 5종', '🚚 출하 고객 5곳'],
  steps: ['드럼에 적힌 끓는점을 비교해 증류탑 출구 칸에 끌어다 놓아요 (끓는점이 낮을수록 탑 위쪽)', '5개를 모두 놓으면 출하 단계가 시작돼요', '각 제품을 쓰임새가 알맞은 고객 칸으로 끌어다 놓아요', '틀리면 이유를 알려줘요 — 적게 틀릴수록 고득점!'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const Y = [11, 9, 7, 5, 3], SX = -4.0;
    const PR = [
      { n: 'LPG', bp: '30℃↓', col: '#7fd1ff', use: 'LPG는 가정·택시의 연료로 쓰여요' },
      { n: '나프타', bp: '30~200℃', col: '#b6e36a', use: '나프타는 플라스틱·섬유의 원료, 석유화학의 쌀이에요' },
      { n: '등유', bp: '150~250℃', col: '#ffd24a', use: '정제한 등유(제트유)는 항공기 연료가 돼요' },
      { n: '경유', bp: '250~350℃', col: '#f29b4b', use: '경유는 트럭·버스의 연료예요' },
      { n: '중질유', bp: '350℃↑', col: '#7a5a46', use: '가장 무거운 잔유에서 아스팔트가 나와 도로를 포장해요' },
    ];
    const CU = ['🏠 가정·택시 연료', '🧴 플라스틱·섬유 원료', '✈️ 항공기 연료', '🚛 트럭·버스 연료', '🛣️ 도로 포장'];
    const PXs = shuffle([0, 1, 2, 3, 4]).map((ci, j) => ({ ci, x: 0.5 + j * 3.4 }));
    let phase = 'tower', w1 = 0, w2 = 0, n = 0, shipped = 0, pads = [];
    const filled = [null, null, null, null, null];

    c.ground('#aeb8c4', 44); c.cyl(1.7, 1.7, 12.4, '#9aa5b5', -8, 6.7, 0);
    const bandCol = ['#4c8dd9', '#6fc0c8', '#e8d36a', '#f29b4b', '#d6453d'];
    Y.forEach((y, i) => { c.cyl(1.78, 1.78, 0.28, bandCol[i], -8, y, 0); const p = c.cyl(0.22, 0.22, 2.3, '#8a93a3', -5.15, y, 0); p.rotation.z = Math.PI / 2; });
    c.box(4.5, 2.2, 3, '#c9543d', -8, 1.1, 4); const pf = c.cyl(0.3, 0.3, 2.4, '#8a93a3', -8, 1.4, 1.6); pf.rotation.x = Math.PI / 2;
    const tf = tag(root, '🔥 가열로 · 원유를 약 350℃로 가열', 5.6, 0.8); tf.position.set(-8, 3.2, 4);
    const tt = tag(root, '▲ 끓는점 낮음 (탑 위쪽)', 5.0, 0.8); tt.position.set(-8, 14, 0);
    Y.forEach((y) => { const m = c.box(2.2, 0.2, 1.8, '#ffffff', SX, y - 0.85, 0); m.material.transparent = true; m.material.opacity = 0.55; });
    const hx = shuffle([0, 1, 2, 3, 4]);
    const drums = PR.map((p, i) => {
      const g = new THREE.Group(); c.cyl(0.65, 0.65, 1.5, p.col, 0, 0, 0, g); c.cyl(0.68, 0.68, 0.12, '#2b2f3a', 0, 0.45, 0, g); c.cyl(0.68, 0.68, 0.12, '#2b2f3a', 0, -0.45, 0, g);
      const t = tag(g, `${p.n} ${p.bp}`, 3.4, 0.7); t.position.set(0, 1.45, 0);
      const home = V3(0.5 + hx[i] * 2.6, 0.75, 0); g.position.copy(home); root.add(g);
      return { g, i, p, home, slot: -1, sent: false };
    });
    cam.set([3, 7.5, 27], [3, 6, 0]); cam.fov(52, true);

    const goHome = (d) => d.g.position.copy(d.slot >= 0 ? V3(SX, Y[d.slot], 0) : d.home);
    const panel = () => ui.panel(phase === 'tower'
      ? `<b>🏭 증류탑 ${n}/5</b><br>끓는점이 낮은 성분일수록 탑 위쪽에서 나와요<br><small>드럼의 끓는점 범위를 비교해 보세요</small>`
      : `<b>🚚 출하 ${shipped}/5</b><br>제품의 쓰임새에 맞는 고객에게 끌어다 놓아요<br><small>잘못 보내면 이유를 알려줘요</small>`);
    const startShip = () => {
      phase = 'ship'; panel(); ui.banner('🚚 출하 단계!');
      pads = PXs.map((o) => { c.box(3.0, 0.25, 2.4, '#d9dee6', o.x, 0.12, 0); const t = tag(root, CU[o.ci], 3.8, 0.8); t.position.set(o.x, 3.4, 0); return { x: o.x, ci: o.ci, used: false }; });
      ui.hint('탑 칸의 드럼을 끌어 알맞은 고객 칸에 놓아요');
    };
    const end = () => {
      phase = 'end'; const s1 = Math.max(15, 40 - w1 * 5), s2 = Math.max(10, 60 - w2 * 8);
      ui.panel(`<b>📋 결과</b><br>증류탑 배치 오답 ${w1}회 (+${s1})<br>출하 오답 ${w2}회 (+${s2})`); c.finish(s1 + s2);
    };
    const dr = dragger(c, drums, 'z', 0, {
      can: (d) => (phase === 'tower' ? d.slot < 0 : phase === 'ship' ? !d.sent : false),
      drop(d) {
        if (phase === 'tower') {
          let bi = -1, bd = 1.9; Y.forEach((y, i) => { if (filled[i]) return; const dd = Math.hypot(d.g.position.x - SX, d.g.position.y - y); if (dd < bd) { bd = dd; bi = i; } });
          if (bi < 0) { goHome(d); return; }
          if (bi === d.i) { filled[bi] = d; d.slot = bi; d.g.position.set(SX, Y[bi], 0); n++; c.sfx.ok(); c.buzz(18); ui.pop(`${d.p.n} 정답! ✔`, d.g.position, '#a0ffb8'); panel(); if (n === 5) setTimeout(startShip, 1200); }
          else { w1++; c.sfx.bump(); ui.pop('그 자리가 아니에요', d.g.position, '#ffd0d0'); ui.hint(bi < d.i ? `${d.p.n}은(는) 끓는점이 더 높아서 이보다 아래쪽에서 나와요` : `${d.p.n}은(는) 끓는점이 더 낮아서 이보다 위쪽에서 나와요`); goHome(d); }
        } else if (phase === 'ship') {
          const px = d.g.position.x, py = d.g.position.y; let j = -1, bd = 1.9;
          pads.forEach((pd, k) => { const dd = Math.abs(px - pd.x); if (dd < bd && py < 3.8 && !pd.used) { bd = dd; j = k; } });
          if (j < 0) { goHome(d); return; }
          if (pads[j].ci === d.i) { pads[j].used = true; d.sent = true; d.g.position.set(pads[j].x, 1.0, 0); shipped++; c.sfx.ok(); c.buzz(18); ui.pop('출하 완료! 🚚', d.g.position, '#a0ffb8'); ui.hint(d.p.use); panel(); if (shipped === 5) setTimeout(end, 1200); }
          else { w2++; c.sfx.bump(); ui.pop('이 고객에게는 맞지 않아요', d.g.position, '#ffd0d0'); ui.hint(w2 >= 2 ? d.p.use : '제품의 쓰임새를 떠올려 보세요'); goHome(d); }
        }
      },
    });
    return { start() { panel(); ui.hint('드럼에 적힌 끓는점을 비교해서 증류탑 칸에 끌어다 놓아요'); }, down() { dr.down(); }, move() { dr.move(); }, up() { dr.up(); } };
  },
});

/* ───────────────────────── 3. 환경시스템공학과 · 하수 처리장 ───────────────────────── */
registerExperience('env', {
  icon: '💧', title: '하수 처리장 설계·운전',
  desc: '더러운 물이 깨끗한 물이 되기까지의 처리 공정을 순서대로 설계하고, 생물반응조의 송풍기를 조절해 오염 변화에도 안정적으로 운전해 보세요.',
  tools: ['🧰 처리 공정 4종', '💨 송풍기(공기 공급)', '📟 용존산소(DO) 계측기'],
  steps: ['처리 공정 4개를 끌어서 물이 흐르는 순서대로 놓아요', '1단계가 끝나면 생물반응조를 맡아 운전해요', '➖ ➕로 송풍기 세기를 조절해 DO를 초록 구간(2~4 mg/L)에 유지해요', '유입 오염이 변해도 45초 동안 안정적으로 운전하면 성공!'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const X = [-7.5, -2.5, 2.5, 7.5];
    const UN = [
      { n: '스크린·침사지', role: '큰 쓰레기·모래 제거', col: '#9aa5b5', why: '큰 쓰레기가 남으면 뒤쪽 펌프·장치가 막혀요 → 맨 앞 단계예요' },
      { n: '침전지', role: '부유물을 가라앉혀 제거', col: '#c9a66b', why: '큰 쓰레기를 거른 다음에 부유물을 가라앉혀요' },
      { n: '생물반응조', role: '미생물이 녹은 유기물을 분해 (산소 필요)', col: '#4fbf8a', why: '맑게 가라앉힌 물에서 미생물이 일하기 좋아요' },
      { n: '소독조', role: '염소·UV로 병원균 살균', col: '#7fb3ff', why: '오염물을 다 뺀 마지막 단계에서 소독해야 효과가 커요' },
    ];
    const PAL = ['#7a5a3a', '#8a7b52', '#7fa86a', '#6cc7b8', '#74d0f0'];
    const EV = [{ t: 0, l: 1 }, { t: 7, l: 1.8, m: '🌧 비가 와서 오염물 유입이 늘었어요' }, { t: 18, l: 0.55, m: '🌙 야간이라 유입이 줄었어요' }, { t: 27, l: 1.6, m: '🏭 공장 폐수가 들어와요' }, { t: 37, l: 0.8, m: '☀ 유입이 안정되고 있어요' }];
    let phase = 'build', w1 = 0, n = 0, air = 5, DO = 3, ld = 1, ldT = 1, ev = 0, el = 0, tB = 0, tO = 0, tU = 0, sig = '', bub = [], marker = null, tDO = null;
    const filled = [null, null, null, null], sA = { t: 0 }, sB = { t: 0 };

    c.ground('#aeb8c4', 44); c.box(34, 0.3, 11, '#c7ced8', 0, 0, 0.5);
    const SEG = [[-13.5, -9.3], [-5.7, -4.3], [-0.7, 0.7], [4.3, 5.7], [9.3, 13.5]].map(([p, q]) => c.box(q - p, 0.2, 0.9, PAL[0], (p + q) / 2, 0.4, 0));
    const ti = tag(root, '🏭 오염된 물 유입 →', 4, 0.8); ti.position.set(-12, 2, 0); const to = tag(root, '→ 🌊 깨끗한 물 방류', 4, 0.8); to.position.set(12, 2, 0);
    X.forEach((x) => { const m = c.box(3.6, 0.1, 2.9, '#ffffff', x, 0.2, 0); m.material.transparent = true; m.material.opacity = 0.5; });
    const flow = () => { let k = 0; while (k < 4 && filled[k]) k++; SEG.forEach((m, j) => m.material.color.set(j <= k ? PAL[j] : PAL[0])); };
    const hx = shuffle([0, 1, 2, 3]);
    const pcs = UN.map((u, i) => {
      const g = new THREE.Group(); c.box(3.4, 1.6, 2.6, u.col, 0, 0, 0, g); c.box(3.0, 0.1, 2.2, '#79c4e0', 0, 0.85, 0, g);
      const t = tag(g, u.n, 3.4, 0.75); t.position.set(0, 1.9, 0);
      const home = V3(-6.6 + hx[i] * 4.4, 0.95, 6.3); g.position.copy(home); root.add(g); return { g, i, u, slot: -1, home };
    });
    cam.set([0, 14, 16], [0, 0, 1.5]); cam.fov(52, true);
    const roles = shuffle(UN.map((u) => `• <b>${u.n}</b>: ${u.role}`)).join('<br>');
    const panelB = () => ui.panel(`<b>🧰 처리 공정 ${n}/4</b><br><small>물이 흐르는 순서대로 놓아요</small><br><small>${roles}</small>`);

    const bM = ui.button({ icon: '➖', label: '공기↓', size: 80, pos: { right: '130px', bottom: '40px' }, down: () => { adjA(-1); sA.t = 0; } });
    const bP = ui.button({ icon: '➕', label: '공기↑', size: 80, pos: { right: '30px', bottom: '40px' }, down: () => { adjA(1); sB.t = 0; } });
    [bM, bP].forEach((b) => b.show(false));
    const adjA = (d) => { if (phase !== 'run') return; const v = clamp(air + d, 0, 10); if (v === air) { ui.pop('조절 한계예요', null, '#ffe9a0'); return; } air = v; c.sfx.click(); sig = ''; };

    const startRun = () => {
      phase = 'run'; el = 0; cam.to([2.5, 8, 14], [2.5, 1.8, 1.5]); [bM, bP].forEach((b) => b.show(true));
      const gg = new THREE.Group(); root.add(gg);
      [[0, 2, '#e0533d'], [2, 4, '#3fd17a'], [4, 7, '#f2b84b']].forEach(([lo, hi, col]) => c.box(0.8, (hi - lo) * 0.8, 0.5, col, 2.5, 0.15 + ((lo + hi) / 2) * 0.8, 4.4, gg));
      marker = c.sph(0.38, '#ffffff', 3.4, 0.15 + DO * 0.8, 4.4, gg);
      tDO = tag(root, '', 3.6, 0.8); tDO.position.set(5.2, 0.15 + DO * 0.8, 4.4);
      const tg = tag(root, '📟 DO 용존산소 (mg/L)', 4.4, 0.8); tg.position.set(2.5, 6.9, 4.4);
      bub = Array.from({ length: 16 }, () => { const m = c.sph(0.12, '#ffffff', X[2] + rnd(-1.2, 1.2), 1, rnd(-0.9, 0.9)); m.material.transparent = true; m.material.opacity = 0.7; return { m, o: Math.random() }; });
      ui.banner('🌀 운전 시작!'); ui.hint('DO를 초록 구간(2~4)에 유지해요 · 유입 오염이 바뀌면 공기를 미리 조절!');
    };
    const dr = dragger(c, pcs, 'y', 2.6, {
      can: (it) => phase === 'build' && it.slot < 0, lift: (it) => { it.g.position.y = 2.6; },
      drop(it) {
        const pt = atPlane(c, 'y', 0.2); let bi = -1, bd = 2.6;
        if (pt) X.forEach((x, i) => { if (filled[i]) return; const d = Math.hypot(pt.x - x, pt.z); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0) { it.g.position.copy(it.home); return; }
        if (bi === it.i) { filled[bi] = it; it.slot = bi; it.g.position.set(X[bi], 0.95, 0); n++; flow(); c.sfx.ok(); c.buzz(18); ui.pop(`${it.u.n} 설치! ✔`, it.g.position, '#a0ffb8'); panelB(); if (n === 4) setTimeout(startRun, 1300); }
        else { w1++; c.sfx.bump(); ui.pop('순서가 달라요', it.g.position, '#ffd0d0'); ui.hint(it.u.why); it.g.position.copy(it.home); }
      },
    });
    const finishRun = () => {
      phase = 'end'; [bM, bP].forEach((b) => b.show(false)); ui.timer(null);
      const fb = tB / 45, fo = tO / 45, fu = tU / 45, s1 = Math.max(10, 25 - w1 * 3), s2 = 60 * fb + 15 * (1 - fo);
      ui.panel(`<b>📋 운전 결과</b><br>목표 구간 유지 ${Math.round(fb * 100)}%<br>산소 과다(전력 낭비) ${Math.round(fo * 100)}%<br>산소 부족(처리 저하·악취) ${Math.round(fu * 100)}%<br>공정 배치 오답 ${w1}회`);
      c.finish(clamp(s1 + s2, 0, 100));
    };
    return {
      start() { panelB(); ui.hint('공정을 끌어서 물이 흐르는 순서대로 놓아요'); },
      down() { dr.down(); }, move() { dr.move(); }, up() { dr.up(); },
      update(dt) {
        if (phase !== 'run') return;
        rep(bM, sA, dt, () => adjA(-1)); rep(bP, sB, dt, () => adjA(1));
        el += dt; ui.timer(45 - el);
        while (ev < EV.length && el >= EV[ev].t) { ldT = EV[ev].l; if (EV[ev].m) { ui.pop(EV[ev].m, null, '#fff3a0'); ui.hint(EV[ev].m); c.sfx.beep && c.sfx.beep(); } ev++; }
        ld += (ldT - ld) * Math.min(1, 1.5 * dt);
        DO += (clamp(0.62 * air / ld, 0, 7) - DO) * (1 - Math.exp(-0.6 * dt));
        if (DO >= 2 && DO <= 4) tB += dt; else if (DO > 4) tO += dt; else tU += dt;
        marker.position.y = 0.15 + DO * 0.8; tDO.position.y = marker.position.y;
        bub.forEach((b) => { b.o = (b.o + dt * (0.15 + air * 0.12)) % 1; b.m.position.y = 1.0 + b.o * 1.4; b.m.visible = air > 0; });
        const s = `${air}|${DO.toFixed(1)}|${ld > 1.25 ? 2 : ld < 0.75 ? 0 : 1}|${Math.round(tB)}`;
        if (s !== sig) {
          sig = s; const bad = DO < 2 || DO > 4;
          tDO.userData.set(`DO ${DO.toFixed(1)}`, '#fff', bad ? 'rgba(190,50,45,.92)' : 'rgba(30,130,75,.92)');
          ui.panel(`<b>💧 생물반응조 운전</b><br>🌀 송풍기 ${air}/10 (⚡ 전력 ${air * 10}%)<br>DO <b>${DO.toFixed(1)}</b> mg/L (목표 2~4)<br>유입 오염: ${ld > 1.25 ? '높음 🔴' : ld < 0.75 ? '낮음 🟢' : '보통 🟡'}<br><small>목표 구간 유지 ${Math.round((tB / Math.max(1, el)) * 100)}%</small>`);
        }
        if (el >= 45) finishRun();
      },
      idle() {},
    };
  },
});

/* ───────────────────────── 4. 융합생명공학과 · DNA 복원·유전자 가위 ───────────────────────── */
registerExperience('bio', {
  icon: '🧬', title: 'DNA 염기쌍 복원·유전자 가위 교정',
  desc: 'DNA의 염기 짝을 직접 맞춰 이중나선 가닥을 복원하고, 유전자 가위로 잘못된 염기를 잘라내 올바르게 고쳐 보세요.',
  tools: ['🧬 염기 블록 A·T·G·C', '✂️ 유전자 가위', '🔬 DNA 분석 화면'],
  steps: ['염기 블록을 끌어서 윗줄과 짝이 맞는 자리에 놓아요 (A–T, G–C)', '8쌍을 모두 맞추면 교정 단계가 시작돼요', '짝이 틀린 아랫줄 염기를 눌러 ✂️ 가위로 잘라요', '윗줄과 맞는 염기를 골라 끼워 넣으면 교정 완료! (2명의 환자)'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const BC = { A: '#e0533d', T: '#4c8dd9', G: '#3aa86a', C: '#e8b92f' }, CP = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const NAMES = ['A (아데닌)', 'T (티민)', 'G (구아닌)', 'C (사이토신)'];
    const XS = Array.from({ length: 8 }, (_, i) => (i - 3.5) * 2.2);
    const newTop = () => { let t; do { t = Array.from({ length: 8 }, () => 'ATGC'[Math.floor(rnd(0, 4))]); } while (new Set(t).size < 4); return t; };
    let top = newTop(), phase = 'pair', w1 = 0, err = 0, round = 1, fixed = 0, need = 0, n = 0, marks = [], bot = [], shown = false;
    c.ground('#c9d3df', 30); c.box(24, 0.3, 15, '#e9eef5', 0, -0.15, 1.2);
    const mk = (L) => { const g = new THREE.Group(); c.box(1.7, 0.5, 1.5, BC[L], 0, 0, 0, g); const t = tag(g, L, 0.9, 0.7); t.position.set(0, 0.95, 0); return g; };
    const bond = (parent, x, L) => { const k = L === 'A' || L === 'T' ? 2 : 3; for (let i = 0; i < k; i++) c.box(0.1, 0.1, 1.3, '#e8ecf2', x + (i - (k - 1) / 2) * 0.4, 0.3, -1.4, parent); };
    let topG = null, G = new THREE.Group(); root.add(G);
    const buildTop = () => { if (topG) kill(root, topG); topG = new THREE.Group(); root.add(topG); top.forEach((L, i) => { const g = mk(L); g.position.set(XS[i], 0.5, -2.8); topG.add(g); }); };
    buildTop();
    const tl = tag(root, '윗줄(기준 가닥)', 3.4, 0.7); tl.position.set(-10.2, 0.9, -2.8); const tb = tag(root, '아랫줄', 2.2, 0.7); tb.position.set(-10.2, 0.9, 0);

    const filled = Array(8).fill(false);
    const slots = XS.map((x) => { const m = c.box(1.8, 0.1, 1.6, '#ffffff', x, 0.3, 0, G); m.material.transparent = true; m.material.opacity = 0.5; return m; });
    const tray = shuffle(top.map((L) => CP[L])).map((L, k) => { const g = mk(L); g.position.set(XS[k], 0.5, 5); G.add(g); return { g, L, k, slot: -1 }; });
    cam.set([0, 11.5, 12.5], [0, 0, 0.8]); cam.fov(50, true);

    const panel = () => ui.panel(phase === 'pair'
      ? `<b>🧬 염기쌍 ${n}/8</b><br>A–T · G–C 로만 결합해요<br><small>A–T는 수소결합 2개, G–C는 3개</small>`
      : `<b>✂️ 유전자 교정 ${round}/2</b><br>고친 염기 ${fixed}/${need}<br><small>윗줄과 짝이 안 맞는 아랫줄 염기를 눌러요</small>`);
    const dr = dragger(c, tray, 'y', 2.6, {
      can: (it) => phase === 'pair' && it.slot < 0, lift: (it) => { it.g.position.y = 2.6; },
      drop(it) {
        const pt = atPlane(c, 'y', 0.3); let bi = -1, bd = 1.6;
        if (pt) XS.forEach((x, i) => { if (filled[i]) return; const d = Math.hypot(pt.x - x, pt.z); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0) { it.g.position.set(XS[it.k], 0.5, 5); return; }
        if (it.L === CP[top[bi]]) {
          filled[bi] = true; it.slot = bi; it.g.position.set(XS[bi], 0.5, 0); bond(G, XS[bi], it.L); n++; c.sfx.ok(); c.buzz(18);
          ui.pop(`${top[bi]}–${it.L} 결합 ✔`, it.g.position, '#a0ffb8'); panel(); if (n === 8) setTimeout(startFix, 1300);
        } else { w1++; c.sfx.bump(); ui.pop('짝이 아니에요', it.g.position, '#ffd0d0'); ui.hint(`${top[bi]}는 ${CP[top[bi]]}와 결합해요 (A–T, G–C)`); it.g.position.set(XS[it.k], 0.5, 5); }
      },
    });
    const showMarks = () => { if (shown) return; shown = true; marks.forEach((m) => { m.visible = true; }); ui.hint('빨간 ✕ 표시가 잘못된 짝이에요'); };
    const startFix = () => {
      kill(root, G); G = new THREE.Group(); root.add(G); phase = 'edit'; fixed = 0; shown = false;
      if (round === 2) { top = newTop(); buildTop(); }
      need = round === 1 ? 1 : 2; const bad = shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, need);
      bot = XS.map((x, i) => {
        const isBad = bad.includes(i), L = isBad ? shuffle('ATGC'.split('').filter((q) => q !== CP[top[i]]))[0] : CP[top[i]];
        const g = mk(L); g.position.set(x, 0.5, 0); G.add(g); if (!isBad) bond(G, x, L); return { g, i, L, bad: isBad };
      });
      marks = bot.filter((b) => b.bad).map((b) => { const t = tag(G, '✕', 0.9, 0.9, '#fff', 'rgba(200,40,40,.92)'); t.position.set(XS[b.i], 0.9, -1.4); t.visible = false; return t; });
      ui.banner(`🧬 환자 ${round}의 DNA`); panel(); ui.hint('윗줄과 짝이 안 맞는 아랫줄 염기를 눌러 ✂️ 가위로 잘라요');
    };
    const ask = (b) => {
      ui.ask(`✂️ 잘못된 염기를 잘라냈어요!<br>윗줄이 <b>${top[b.i]}</b>일 때 빈칸에 들어갈 염기는?`, NAMES, (k) => {
        const L = 'ATGC'[k], want = CP[top[b.i]];
        if (L !== want) { err++; c.sfx.bump(); ui.pop(`${top[b.i]}의 짝은 ${want}예요`, null, '#ffd0d0'); if (err >= 2) showMarks(); setTimeout(() => ask(b), 500); return; }
        const g = mk(want); g.position.set(XS[b.i], 0.5, 0); G.add(g); bond(G, XS[b.i], want); b.g = g; b.L = want; b.bad = false; fixed++; c.sfx.ok(); c.buzz(25);
        ui.pop('교정 성공! 🧬', g.position, '#a0ffb8'); panel();
        if (fixed < need) { phase = 'edit'; return; }
        if (round === 1) { round = 2; phase = 'wait'; ui.banner('DNA 교정 성공!'); setTimeout(startFix, 1500); }
        else { phase = 'end'; const s1 = Math.max(15, 50 - w1 * 5), s2 = Math.max(10, 50 - err * 8); ui.panel(`<b>📋 결과</b><br>염기쌍 복원 오답 ${w1}회 (+${s1})<br>교정 단계 실수 ${err}회 (+${s2})`); c.finish(s1 + s2); }
      });
    };
    return {
      start() { panel(); ui.hint('염기 블록을 끌어서 윗줄과 짝이 맞는 자리에 놓아요'); },
      down() {
        if (phase === 'pair') { dr.down(); return; }
        if (phase !== 'edit') return;
        const live = bot.filter((b) => b.g.visible), k = hit(c, live.map((b) => b.g)); if (k < 0) return; const b = live[k];
        if (!b.bad) { err++; c.sfx.bump(); ui.pop('정상 염기쌍이에요 (가위 낭비!)', b.g.position, '#ffe9a0'); if (err >= 2) showMarks(); return; }
        phase = 'ask'; b.g.visible = false; c.sfx.pickup(); c.buzz(30); ui.pop('✂️ 절단!', b.g.position, '#fff3a0'); ask(b);
      },
      move() { dr.move(); }, up() { dr.up(); },
    };
  },
});

/* ───────────────────────── 5. 의공학부 · 심전도 측정·진단 ───────────────────────── */
registerExperience('bme', {
  icon: '🩺', title: '심전도 측정·신호 처리·진단',
  desc: '병원의 심전도(ECG) 모니터를 직접 세팅해요. 전극을 붙이고, 잡음을 걸러 신호를 선명하게 만든 뒤, 환자의 심박수를 읽어 상태를 판단해 보세요.',
  tools: ['🩺 심전도 전극 3개', '🎚️ 필터 조절', '📈 ECG 모니터'],
  steps: ['전극 3개를 끌어서 이름에 맞는 환자 몸 위치에 붙여요', '➖ ➕로 필터 컷오프(Hz)를 조절해 신호 품질 85% 이상을 3초 유지해요', '너무 낮으면 R파가 뭉개지고, 너무 높으면 잡음이 섞여요', '6초 화면의 R파 개수 × 10으로 심박수를 읽고 환자 3명을 진단해요'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const WIN = 6;
    let phase = 'attach', mode = 'off', cut = 90, bpm = 75, w1 = 0, n = 0, steps = 0, hd = 0, pi = 0, ok3 = 0, sig = '', cls = shuffle(['n', 't', 'b']);
    const taken = [false, false, false], sA = { t: 0 }, sB = { t: 0 };

    c.ground('#c9d3df', 30); c.box(5, 0.9, 10, '#e9eef5', 0, 0.45, -1.8);
    c.sph(0.65, '#f2c9a0', 0, 1.5, -5.6); c.box(2.3, 0.8, 3.2, '#6fa8dc', 0, 1.3, -3.4);
    [-1, 1].forEach((s) => { c.box(0.7, 0.5, 2.6, '#6fa8dc', s * 1.7, 1.15, -3.0); c.box(0.6, 0.4, 0.6, '#f2c9a0', s * 1.7, 1.15, -1.5); c.box(0.8, 0.7, 3.4, '#9ec3e6', s * 0.65, 1.15, -0.1); });
    const pt0 = tag(root, '🧍 환자 (누운 모습 · 발 쪽에서 본 화면)', 5.8, 0.8); pt0.position.set(0, 3.4, -1.0);
    c.box(2.4, 1.0, 6, '#b9c3d1', -6.5, 0.5, -2.5);
    const TG = [{ id: 'RA', p: V3(1.7, 1.55, -2.3), n: '오른팔' }, { id: 'LA', p: V3(-1.7, 1.55, -2.3), n: '왼팔' }, { id: 'LL', p: V3(-0.65, 1.6, 0.4), n: '왼다리' }];
    TG.forEach((q) => { const m = c.cyl(0.6, 0.6, 0.06, '#ffffff', q.p.x, q.p.y, q.p.z); m.material.transparent = true; m.material.opacity = 0.55; });
    const els = TG.map((q, k) => {
      const g = new THREE.Group(); c.cyl(0.45, 0.45, 0.2, '#ffd23a', 0, 0, 0, g);
      const t = tag(g, `${q.id} ${q.n}`, 2.6, 0.65); t.position.set(0, 0.8, 0);
      const home = V3(-6.5, 1.3, -4.4 + k * 2.2); g.position.copy(home); root.add(g); return { g, id: q.id, home, on: false };
    });

    /* ECG 모니터(캔버스 텍스처) */
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 320;
    const g2 = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    c.box(10.5, 5.5, 0.3, '#2b2f3a', 0, 6.3, -9.2); c.box(0.6, 3.6, 0.6, '#59667a', 0, 1.8, -9.3);
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: tex })); mon.position.set(0, 6.3, -9); root.add(mon);
    cam.set([0, 9, 12], [0, 3.2, -3]); cam.fov(52, true);

    const Gs = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
    const wave = (p) => Gs(p, 0.16, 0.025, 0.14) + Gs(p, 0.35, 0.012, -0.12) + Gs(p, 0.385, 0.011, 1) + Gs(p, 0.42, 0.012, -0.24) + Gs(p, 0.62, 0.05, 0.3);
    const hs = (k) => { const h = Math.sin(k * 12.9898) * 43758.5453; return h - Math.floor(h); };
    const sp = () => { const R = cut < 25 ? 0.35 + (cut / 25) * 0.65 : 1, nz = 0.04 + Math.max(0, cut - 40) * 0.01; return { R, nz, q: Math.round(100 * R * (1 - Math.min(1, nz / 0.5))) }; };
    const draw = (t) => {
      const W = 640, H = 320; g2.fillStyle = '#06140c'; g2.fillRect(0, 0, W, H);
      g2.strokeStyle = 'rgba(60,255,120,.12)'; g2.lineWidth = 1;
      for (let x = 0; x <= W; x += 32) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x, H); g2.stroke(); }
      for (let y = 0; y <= H; y += 32) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(W, y); g2.stroke(); }
      const s = sp(), T = 60 / bpm, base = H * 0.62, amp = H * 0.34;
      g2.strokeStyle = mode === 'off' ? '#3a5a44' : '#3dff7a'; g2.lineWidth = 3; g2.beginPath();
      for (let i = 0; i <= 320; i++) {
        const ts = t - WIN * (1 - i / 320); let v = 0;
        if (mode !== 'off') { const u = (((ts / T) % 1) + 1) % 1; v = wave(u * 0.8) * s.R + (hs(Math.floor(ts * 90)) - 0.5) * 2 * s.nz + Math.sin(ts * 188) * s.nz * 0.5; }
        const x = (i / 320) * W, y = base - v * amp; if (i) g2.lineTo(x, y); else g2.moveTo(x, y);
      }
      g2.stroke();
      g2.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = Math.ceil(t - WIN); k <= Math.floor(t); k++) g2.fillRect(((k - (t - WIN)) / WIN) * W, H - 14, 2, 14);
      g2.fillStyle = '#9dffbd'; g2.font = 'bold 22px "Malgun Gothic","Noto Sans KR",sans-serif'; g2.textBaseline = 'top'; g2.textAlign = 'left';
      g2.fillText(mode === 'off' ? '전극을 연결하세요 (LEAD OFF)' : mode === 'filter' ? `필터 ${cut}Hz · 신호 품질 ${s.q}%` : `환자 ${pi + 1}/3 · 아래 눈금 = 1초`, 14, 10);
      tex.needsUpdate = true;
    };

    const fM = ui.button({ icon: '➖', label: '컷오프↓', size: 80, pos: { right: '130px', bottom: '40px' }, down: () => { adj(-1); sA.t = 0; } });
    const fP = ui.button({ icon: '➕', label: '컷오프↑', size: 80, pos: { right: '30px', bottom: '40px' }, down: () => { adj(1); sB.t = 0; } });
    const bDx = ui.button({ icon: '🩺', label: '진단', size: 86, cls: 'grn', pos: { right: '30px', bottom: '40px' }, down: () => diagnose() });
    [fM, fP, bDx].forEach((b) => b.show(false));
    const adj = (d) => { if (phase !== 'filter') return; const v = clamp(cut + d * 5, 10, 100); if (v === cut) return; cut = v; steps++; c.sfx.click(); };

    const panelA = () => ui.panel(`<b>🩺 전극 부착 ${n}/3</b><br>전극 이름의 몸 위치에 붙여요<br><small>환자의 오른쪽·왼쪽은 환자 기준이에요</small>`);
    const newPatient = () => {
      phase = 'diag'; mode = 'diag'; const k = cls[pi];
      bpm = k === 'n' ? Math.round(rnd(62, 92)) : k === 't' ? Math.round(rnd(115, 150)) : Math.round(rnd(40, 52));
      ui.panel(`<b>🩺 환자 ${pi + 1}/3 진단</b><br>6초 화면의 <b>R파</b>(가장 높고 뾰족한 파) 개수 × 10 ≈ 분당 심박수<br><small>정상 60~100 · 빈맥 100 초과 · 서맥 60 미만</small>`);
      bDx.show(true); ui.hint('R파를 세어 보고 🩺 진단을 눌러요');
    };
    const startDiag = () => { fM.show(false); fP.show(false); cut = 35; pi = 0; ui.banner('✅ 신호가 선명해요!'); setTimeout(newPatient, 1200); };
    const diagnose = () => {
      if (phase !== 'diag') return; phase = 'ask'; bDx.show(false); const truth = bpm > 100 ? 1 : bpm < 60 ? 2 : 0;
      ui.ask('🩺 이 환자의 심전도는 어떤 상태일까요?', ['정상 (분당 60~100회)', '빈맥 (분당 100회 초과)', '서맥 (분당 60회 미만)'], (i) => {
        const ok = i === truth; if (ok) ok3++; c.sfx[ok ? 'ok' : 'bump'](); ui.pop(ok ? `정답! ${bpm}회/분` : `실제는 ${bpm}회/분이었어요`, null, ok ? '#a0ffb8' : '#ffd0d0');
        pi++; if (pi < 3) { setTimeout(newPatient, 1500); return; }
        phase = 'end'; const s1 = Math.max(10, 25 - w1 * 5), s2 = clamp(35 - Math.max(0, steps - 12) * 1.5, 15, 35), s3 = Math.round(ok3 * 13.3);
        ui.panel(`<b>📋 결과</b><br>전극 부착 오답 ${w1}회 (+${s1})<br>필터 조절 ${steps}번 (+${Math.round(s2)})<br>심박수 진단 ${ok3}/3 (+${s3})`); c.finish(s1 + s2 + s3);
      });
    };
    const dr = dragger(c, els, 'y', 3.2, {
      can: (e) => phase === 'attach' && !e.on, lift: (e) => { e.g.position.y = 3.2; },
      drop(e) {
        const pt = atPlane(c, 'y', 1.6); let k = -1, bd = 1.9;
        if (pt) TG.forEach((q, i) => { if (taken[i]) return; const d = Math.hypot(pt.x - q.p.x, pt.z - q.p.z); if (d < bd) { bd = d; k = i; } });
        if (k < 0) { e.g.position.copy(e.home); return; }
        if (TG[k].id === e.id) {
          taken[k] = true; e.on = true; e.g.position.set(TG[k].p.x, TG[k].p.y + 0.15, TG[k].p.z); n++; c.sfx.ok(); c.buzz(18); ui.pop(`${TG[k].n} 전극 ✔`, e.g.position, '#a0ffb8'); panelA();
          if (n === 3) { mode = 'filter'; phase = 'filter'; cut = [85, 90, 95, 100, 10, 15][Math.floor(rnd(0, 6))]; fM.show(true); fP.show(true); ui.banner('📈 신호 수신!'); ui.hint('신호가 지저분해요! 컷오프(Hz)를 조절해 품질 85% 이상을 3초 유지해요'); }
        } else { w1++; c.sfx.bump(); ui.pop('위치가 달라요', e.g.position, '#ffd0d0'); ui.hint('전극 이름의 몸 위치를 확인해요 · 발 쪽에서 볼 때 환자의 오른팔은 화면의 오른쪽이에요'); e.g.position.copy(e.home); }
      },
    });
    return {
      start() { panelA(); ui.hint('전극을 끌어서 이름에 맞는 몸 위치에 붙여요'); },
      down() { dr.down(); }, move() { dr.move(); }, up() { dr.up(); },
      update(dt, t) {
        draw(t);
        if (phase === 'filter') {
          rep(fM, sA, dt, () => adj(-1)); rep(fP, sB, dt, () => adj(1));
          const q = sp().q; if (q >= 85) hd += dt; else hd = 0;
          const s = `${cut}|${q}|${Math.floor(hd * 2)}`; if (s !== sig) { sig = s; ui.panel(`<b>🎚️ 필터 설정</b><br>컷오프 ${cut}Hz · 신호 품질 <b>${q}%</b><br>85%↑ 유지 ${Math.min(3, hd).toFixed(1)} / 3초<br><small>낮으면 R파가 뭉개지고, 높으면 잡음이 섞여요</small>`); }
          if (hd >= 3) { phase = 'next'; startDiag(); }
        }
      },
      idle(dt, t) { draw(t); },
    };
  },
});

/* ───────────────────────── 6. 산업기술융합공학과 · 현장 순찰 + 비상 대응 ───────────────────────── */
registerExperience('itc', {
  icon: '🏭', title: '플랜트 현장 순찰·비상 대응',
  desc: '야간 공정 현장을 순찰하며 계측값이 이상한 설비를 찾아내고, 반응기 압력이 오르는 비상 상황에서 절차대로 침착하게 대응해 보세요.',
  tools: ['📟 설비 계측값', '📋 점검 보고', '📖 비상 운전 절차'],
  steps: ['설비 6대의 계측값과 정상 범위를 비교해 이상한 설비를 눌러 🚩 표시해요 (3대)', '📋 점검 보고를 누르면 결과를 확인해요', '반응기 압력이 계속 올라요! 📖 절차를 확인하고 🔒🔥💧 조치를 해요', '📞 상급자 보고까지 마치고 압력을 안정시키면 성공!'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c;
    const EQ = [
      { id: 'R-101', n: '반응기', k: '압력', u: 'bar', lo: 15, hi: 20 }, { id: 'E-201', n: '열교환기', k: '출구온도', u: '℃', lo: 80, hi: 95 },
      { id: 'T-301', n: '저장탱크', k: '액위', u: '%', lo: 30, hi: 80 }, { id: 'P-401', n: '펌프', k: '진동', u: 'mm/s', lo: 0, hi: 4.5 },
      { id: 'C-501', n: '냉각탑', k: '수온', u: '℃', lo: 25, hi: 32 }, { id: 'D-601', n: '증류탑', k: '탑정온도', u: '℃', lo: 140, hi: 160 },
    ];
    const POS = [[-9, -3], [0, -3], [9, -3], [-9, 5], [0, 5], [9, 5]], HT = [5.2, 3.2, 4.4, 2.6, 5.2, 7.6];
    const bad = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3);
    const VAL = EQ.map((e, i) => {
      const s = e.hi - e.lo; if (!bad.includes(i)) return +(e.lo + s * rnd(0.2, 0.8)).toFixed(1);
      const up = e.lo === 0 || Math.random() < 0.5; return +(up ? e.hi + s * rnd(0.2, 0.45) : e.lo - s * rnd(0.2, 0.45)).toFixed(1);
    });
    const flag = EQ.map(() => false);
    let phase = 'patrol', left = 50, s1 = 0, sig = '', manFirst = false, paused = false, el = 0, P = 18, peak = 18;
    const sim = { feed: true, heat: true, cool: false, boss: false, man: false, act: [] };

    c.ground('#9aa3ad', 44); c.box(30, 0.2, 1, '#6b7a8e', 0, 0.1, 1);
    const mkEq = (i) => {
      const g = new THREE.Group();
      if (i === 0) { c.cyl(1.5, 1.5, 3.6, '#8aa0b8', 0, 1.8, 0, g); c.sph(1.5, '#8aa0b8', 0, 3.6, 0, g); }
      else if (i === 1) { const h = c.cyl(1.0, 1.0, 4.2, '#c9a66b', 0, 1.2, 0, g); h.rotation.z = Math.PI / 2; c.box(0.4, 1.2, 2.2, '#6b7a8e', -1.2, 0.6, 0, g); c.box(0.4, 1.2, 2.2, '#6b7a8e', 1.2, 0.6, 0, g); }
      else if (i === 2) { c.cyl(2.2, 2.2, 3.2, '#e8ecf2', 0, 1.6, 0, g); }
      else if (i === 3) { c.box(2.6, 1.0, 1.6, '#2f6fed', 0, 0.5, 0, g); const m = c.cyl(0.8, 0.8, 1.6, '#59667a', 1.6, 0.9, 0, g); m.rotation.z = Math.PI / 2; }
      else if (i === 4) { c.box(3.2, 3.6, 3.2, '#a9c8e8', 0, 1.8, 0, g); c.cyl(1.1, 1.1, 0.3, '#2b2f3a', 0, 3.8, 0, g); }
      else { c.cyl(1.0, 1.0, 6.4, '#9aa5b5', 0, 3.2, 0, g); c.cyl(1.05, 1.05, 0.3, '#d6453d', 0, 4.8, 0, g); c.cyl(1.05, 1.05, 0.3, '#d6453d', 0, 2.2, 0, g); }
      g.position.set(POS[i][0], 0, POS[i][1]); root.add(g); return g;
    };
    const eqG = EQ.map((e, i) => mkEq(i));
    const tn = EQ.map((e, i) => { const t = tag(eqG[i], `${e.id} ${e.n}`, 3.6, 0.7); t.position.set(0, HT[i] + 1.1, 0); return t; });
    const tv = EQ.map((e, i) => { const t = tag(eqG[i], '', 5.6, 0.7); t.position.set(0, HT[i] + 0.3, 0); return t; });
    const showTag = (i) => {
      const e = EQ[i]; tv[i].userData.set(`${flag[i] ? '🚩 ' : ''}${e.k} ${VAL[i]}${e.u} (정상 ${e.lo}~${e.hi})`, '#fff', flag[i] ? 'rgba(200,110,25,.94)' : 'rgba(10,30,60,.85)');
    };
    EQ.forEach((e, i) => showTag(i));
    cam.set([0, 18, 16], [0, 1, 1.5]); cam.fov(50, true);

    const bRep = ui.button({ icon: '📋', label: '점검 보고', size: 86, cls: 'grn', pos: { right: '30px', bottom: '40px' }, down: () => evaluate() });
    const bMan = ui.button({ icon: '📖', label: '절차', size: 66, pos: { right: '14px', bottom: '110px' }, down: () => act('man') });
    const bFeed = ui.button({ icon: '🔒', label: '원료차단', size: 66, pos: { right: '88px', bottom: '110px' }, down: () => act('feed') });
    const bHeat = ui.button({ icon: '🔥', label: '가열중지', size: 66, pos: { right: '14px', bottom: '30px' }, down: () => act('heat') });
    const bCool = ui.button({ icon: '💧', label: '냉각수↑', size: 66, pos: { right: '88px', bottom: '30px' }, down: () => act('cool') });
    const bBoss = ui.button({ icon: '📞', label: '상급자', size: 66, pos: { right: '162px', bottom: '30px' }, down: () => act('boss') });
    const eB = [bMan, bFeed, bHeat, bCool, bBoss]; [bRep, ...eB].forEach((b) => b.show(false));

    const evaluate = () => {
      if (phase !== 'patrol') return; phase = 'rev'; bRep.show(false); ui.timer(null);
      const hits = bad.filter((i) => flag[i]).length, fp = flag.filter((f, i) => f && !bad.includes(i)).length;
      s1 = clamp(13 * hits - 7 * fp, 0, 40);
      EQ.forEach((e, i) => { const ab = bad.includes(i); tv[i].userData.set(`${ab ? (flag[i] ? '✅ 이상 발견 ' : '⚠ 놓침 ') : (flag[i] ? '❌ 정상인데 표시 ' : '')}${e.k} ${VAL[i]}${e.u} (정상 ${e.lo}~${e.hi})`, '#fff', ab ? (flag[i] ? 'rgba(30,130,75,.94)' : 'rgba(190,50,45,.94)') : flag[i] ? 'rgba(200,110,25,.94)' : 'rgba(10,30,60,.85)'); });
      ui.panel(`<b>📋 점검 결과</b><br>이상 설비 ${hits}/3 발견 · 잘못 표시 ${fp}대<br>점검 점수 +${s1}`); c.sfx.ok(); ui.hint('정상 범위를 벗어난 계측값이 이상 신호예요');
      setTimeout(startEmerg, 3800);
    };
    /* 비상 대응 */
    const bar = c.box(0.8, 1, 0.8, '#3fd17a', -5.6, 0.5, -1.2); const tg = tag(root, '', 4.2, 0.8); tg.position.set(-5.6, 6.2, -1.2);
    bar.visible = false; tg.visible = false;
    const done = (k) => (k === 'man' ? sim.man : k === 'feed' ? !sim.feed : k === 'heat' ? !sim.heat : k === 'cool' ? sim.cool : sim.boss);
    const panelE = () => ui.panel(`<b>🚨 R-101 압력 상승!</b><br>${[['man', '📖 비상 절차 확인'], ['feed', '🔒 원료 공급 차단'], ['heat', '🔥 가열 중지'], ['cool', '💧 냉각수 최대'], ['boss', '📞 상급자 보고']].map(([k, t]) => `${done(k) ? '✅' : '⬜'} ${t}`).join('<br>')}<br><small>압력 ${P.toFixed(1)} bar · 40bar에서 자동 비상정지</small>`);
    const startEmerg = () => {
      phase = 'emerg'; EQ.forEach((e, i) => { if (i) { tv[i].visible = false; tn[i].visible = false; } }); tn[0].visible = true; tv[0].visible = false;
      bar.visible = true; tg.visible = true; eB.forEach((b) => b.show(true)); cam.to([-8, 8.5, 11], [-8, 2.6, -2]);
      ui.banner('🚨 압력 이상 상승!'); ui.hint('절차를 확인하고 원료·가열·냉각 조치 후 상급자에게 보고해요'); panelE();
    };
    const act = (k) => {
      if (phase !== 'emerg' || paused) return; const first = sim.act.length === 0; sim.act.push(k); c.sfx.click();
      if (k === 'man') {
        paused = true; sim.man = true; if (first) manFirst = true; bMan.show(false);
        ui.ask('<b>📖 비상 운전 절차 (요약)</b><br>1. 원료 공급 차단<br>2. 가열 중지<br>3. 냉각수 최대<br>4. 상급자 보고 · 기록<br><small>※ 임의 조작 금지, 절차 준수</small>', ['확인했어요'], () => { paused = false; });
      } else if (k === 'feed') { sim.feed = false; bFeed.show(false); ui.pop('🔒 원료 공급 차단', null, '#a0ffb8'); }
      else if (k === 'heat') { sim.heat = false; bHeat.show(false); ui.pop('🔥 가열 중지', null, '#a0ffb8'); }
      else if (k === 'cool') { sim.cool = true; bCool.show(false); ui.pop('💧 냉각수 최대', null, '#a0ffb8'); }
      else { sim.boss = true; bBoss.show(false); ui.pop('📞 상급자에게 보고', null, '#a0ffb8'); }
      panelE();
    };
    const endE = (ok) => {
      phase = 'end'; eB.forEach((b) => b.show(false));
      let s2 = (manFirst ? 10 : sim.man ? 4 : 0) + (sim.boss ? 10 : 0); if (ok) s2 += (peak <= 30 ? 25 : peak <= 36 ? 15 : 8) + 15;
      ui.panel(`<b>📋 비상 대응 결과</b><br>${ok ? '압력을 안정시켰어요 ✅' : '압력이 40bar에 도달해 자동 비상정지(ESD)가 작동했어요 ❌ (안전장치가 막아 준 거예요)'}<br>최고 압력 ${peak.toFixed(1)}bar · 절차 확인 ${manFirst ? '먼저 ✅' : sim.man ? '뒤늦게' : '안 함'} · 보고 ${sim.boss ? '✅' : '❌'}<br>점검 +${s1} · 비상 대응 +${s2}`);
      if (ok) c.sfx.ok(); else c.sfx.bump(); c.finish(s1 + s2);
    };
    return {
      start() { bRep.show(true); ui.hint('설비의 계측값이 정상 범위를 벗어났다면 눌러서 🚩 표시해요 (이상 설비는 3대)'); },
      down() { if (phase !== 'patrol') return; const k = hit(c, eqG); if (k < 0) return; flag[k] = !flag[k]; c.sfx.click(); showTag(k); },
      update(dt) {
        if (phase === 'patrol') { left -= dt; ui.timer(left); const s = flag.map((f) => (f ? 1 : 0)).join(''); if (s !== sig) { sig = s; ui.panel(`<b>🔦 야간 순찰</b><br>표시한 설비 ${flag.filter(Boolean).length}대<br><small>계측값이 정상 범위(괄호)를 벗어난 설비를 찾아요</small>`); } if (left <= 0) evaluate(); }
        else if (phase === 'emerg' && !paused) {
          el += dt; const ramp = Math.min(1, el / 3), rate = 0.25 + (sim.feed ? 0.9 : 0) + (sim.heat ? 0.5 : 0) - (sim.cool ? 1.4 : 0.2);
          P = Math.max(6, P + rate * (rate > 0 ? ramp : 1) * dt); peak = Math.max(peak, P);
          const h = clamp(P / 45, 0.05, 1) * 5; bar.scale.y = h; bar.position.y = h / 2; bar.material.color.setHSL((1 - clamp((P - 18) / 22, 0, 1)) * 0.33, 0.7, 0.5);
          eqG[0].children[0].material.color.lerpColors(new THREE.Color('#8aa0b8'), new THREE.Color('#d6453d'), clamp((P - 18) / 22, 0, 1));
          const s = `${P.toFixed(0)}|${sim.act.length}`; if (s !== sig) { sig = s; tg.userData.set(`R-101 압력 ${P.toFixed(1)} bar`, '#fff', P >= 34 ? 'rgba(190,50,45,.94)' : P >= 26 ? 'rgba(200,110,25,.94)' : 'rgba(30,130,75,.92)'); panelE(); }
          if (P >= 40) endE(false); else if (!sim.feed && !sim.heat && sim.cool && sim.boss && P <= 20) endE(true);
        }
      },
      idle() {},
    };
  },
});