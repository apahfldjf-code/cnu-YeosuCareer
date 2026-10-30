/* ═══════════════════════════════════════════════════════════════
 * src/exp-cul2.js (신규, E3-2 · 문화사회과학대학 2/3)
 *   gbs : 글로벌비즈니스학과  → ① 국제통상(무역 실무) ② 글로벌비즈니스(협상·문화 매너)
 *   log : 물류교통학과        → 🚚 배송 경로 설계 · 🚦 교차로 신호 운영 · 🚢 항만 선적 검수
 *   eco : 문화콘텐츠학부 전자상거래전공 → 🛍️ A/B 테스트 · 📦 재고·발주(ERP) · 🛡️ 결제 보안 · 💬 고객관리(CRM)
 *
 * 필요: experience.js, exp-cul1.js (ctag, culOverlay, h, mix 를 가져다 써요 → exp-cul1.js 가 먼저 있어야 해요)
 * 모든 조작은 화면 버튼·슬라이더·탭이에요(키보드 불필요 → 모바일 그대로 동작).
 * 'log' 는 exp-pilot.js 의 시험용 체험을 덮어써요(나중에 import 한 것이 우선).
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { ctag, culOverlay, h, mix } from './exp-cul1.js';

const ENV = (sky, ground = '#8c97a8') => ({ sky, fog: [sky, 40, 130], sunColor: '#ffffff', sunI: 1.4, hemi: ['#eef4ff', ground, 0.95], sunPos: [20, 40, 25] });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmtW = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const clearG = (g) => { [...g.children].forEach((m) => { g.remove(m); if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); };

/* ───────────── 공용: 객관식 · 결과 화면 · 단계 안내 · 파트 허브 ───────────── */
function mcq(box, items, title, finish) {
  const qs = items.map(mix); let i = 0, ok = 0;
  const show = () => {
    const it = qs[i]; box.innerHTML = '';
    h('div', 'hd', `${title} · ${i + 1} / ${qs.length}`, box);
    if (it.sign) h('div', 'sign', it.sign, box);
    h('div', 'q', it.q, box);
    const ol = h('div', 'opts', '', box), fb = h('div', 'fb', '', box); let locked = false;
    const bs = it.opts.map((o, k) => {
      const b = h('button', 'opt', o, ol);
      b.onclick = () => {
        if (locked) return; locked = true; const good = k === it.a; if (good) ok++;
        b.classList.add(good ? 'ok' : 'no'); if (!good) bs[it.a].classList.add('ok');
        fb.textContent = (good ? '⭕ 정답! ' : '❌ 아쉬워요. ') + it.why;
        const row = h('div', 'row', '', box), nx = h('button', 'pri', i + 1 < qs.length ? '다음 ▶' : '결과 보기 ▶', row);
        nx.onclick = () => { if (++i < qs.length) show(); else finish(ok, qs.length); };
      };
      return b;
    });
  };
  show();
}
function result(box, score, lines, done, label = '목록으로') {
  box.innerHTML = '';
  h('div', 'hd', '결과', box); h('div', 'big', `${score}점`, box);
  h('div', 'bar', `<i style="width:${score}%"></i>`, box);
  h('div', 'fb', lines.join('\n'), box);
  const row = h('div', 'row', '', box), b = h('button', 'pri', '✔ ' + label, row);
  b.onclick = () => done(score, lines[0]);
}
function step(box, text, label, next) {
  box.innerHTML = ''; h('div', 'fb', text, box);
  const row = h('div', 'row', '', box), b = h('button', 'pri', label, row); b.onclick = next;
}
/* 파트 허브: 카드 목록 → 파트 실행 → 결과 → 모두 마치면 종합 결과 + 체험 완료
 * cfg: { title, sub, career, parts:[{id,icon,name,desc,run(box,done)→{tick?,dispose?}}], onHome(res), onOpen(id), tick(dt,t) } */
function hub(c, cfg) {
  const { ui } = c; let ov = null, cur = null, ended = false; const res = {};
  const stop = () => { if (cur && cur.dispose) cur.dispose(); cur = null; };
  const avg = () => Math.round(cfg.parts.reduce((s, p) => s + (res[p.id] ? res[p.id].score : 0), 0) / cfg.parts.length);
  const home = () => {
    stop(); ov.clear(); if (cfg.onHome) cfg.onHome(res);
    h('h3', '', cfg.title, ov.el); h('div', 'hd', cfg.sub, ov.el);
    const g = h('div', 'grid', '', ov.el);
    cfg.parts.forEach((p) => {
      const r = res[p.id], b = h('button', 'card' + (r ? ' dn' : ''), `<b>${p.icon} ${p.name}</b><br><small>${p.desc}</small>${r ? `<br>✅ ${r.score}점 · 다시 도전 가능` : ''}`, g);
      b.onclick = () => open(p);
    });
    const left = cfg.parts.filter((p) => !res[p.id]).length;
    if (left) { h('div', 'fb', `남은 체험 ${left}개 · 순서는 자유예요`, ov.el); ui.hint('체험할 파트를 골라요'); return; }
    const sc = avg();
    h('div', 'big', `🏁 종합 ${sc}점`, ov.el); h('div', 'bar', `<i style="width:${sc}%"></i>`, ov.el);
    h('div', 'fb', cfg.parts.map((p) => `${p.icon} ${p.name}: ${res[p.id].score}점`).join('\n') + '\n\n🎓 ' + cfg.career, ov.el);
    const row = h('div', 'row', '', ov.el), ok = h('button', 'pri', '✔ 체험 완료', row);
    ok.onclick = () => { if (ended) return; ended = true; ov.destroy(); ov = null; ui.hint('🎉 체험 완료!'); c.finish(sc); };
    ui.hint('모든 파트 완료! ✔ 체험 완료를 눌러요');
  };
  const open = (p) => {
    stop(); ov.clear(); if (cfg.onOpen) cfg.onOpen(p.id);
    const top = h('div', 'row', '', ov.el), back = h('button', '', '← 목록', top); back.onclick = home;
    h('b', '', `${p.icon} ${p.name}`, top);
    const box = h('div', '', '', ov.el);
    cur = p.run(box, (score, note) => { const old = res[p.id]; res[p.id] = { score: Math.max(old ? old.score : 0, score), note }; home(); }) || null;
  };
  return {
    start() { ov = culOverlay(); home(); },
    update(dt, t) { if (cfg.tick) cfg.tick(dt, t); if (cur && cur.tick) cur.tick(dt, t); },
    idle(dt, t) { if (cfg.tick) cfg.tick(dt, t); },
    down() {}, move() {}, up() {}, key() {},
    dispose() { stop(); if (ov) { ov.destroy(); ov = null; } },
  };
}

/* ═══════════════ 1. 글로벌비즈니스학과 (국제통상학전공 + 글로벌비즈니스학전공) ═══════════════ */
function tradeRun(box, done) {
  const ST = [['🔎', '해외 시장조사 · 바이어 발굴 (KOTRA 등 활용)'], ['🤝', '견적 제시 · 가격 협상 → 매매계약 체결'], ['📑', '결제 조건 확정 · 신용장(L/C) 개설'], ['🛃', '수출 통관 신고 (관세청)'], ['🚢', '선적 · 선하증권(B/L) 발행'], ['💵', '선적 서류 제시 → 수출 대금 수령']];
  const order = shuffle(ST.map((_, i) => i)); let nxt = 0, miss = 0, msg = '';
  const calc = (sA) => {
    const U = pick([500, 800, 1200]), PR = pick([8, 12, 15]), RT = pick([1300, 1350, 1400]), rev = U * PR * RT, d = U * PR * 50;
    const T = pick([{ p: 20, a: [8, 1.0], b: [0, 2.5] }, { p: 30, a: [5, 2.0], b: [0, 3.6] }]);
    const land = (t) => T.p * (1 + t[0] / 100) + t[1], la = land(T.a), lb = land(T.b);
    const items = [
      { q: `수출 계약: 상품 ${U.toLocaleString()}개 × 개당 $${PR}. 오늘 환율은 1달러 = ${RT.toLocaleString()}원이에요. 원화로 환산한 수출 대금은?`, opts: [fmtW(rev), fmtW(U * PR), fmtW(U * PR * (RT + 100)), fmtW(rev / 10)], a: 0, why: `${U.toLocaleString()} × $${PR} = $${(U * PR).toLocaleString()} → × ${RT.toLocaleString()}원 = ${fmtW(rev)}` },
      { q: `같은 계약인데 결제일에 환율이 1달러 = ${RT - 50}원으로 내렸어요(원화 강세). 원화로 받는 금액은?`, opts: [`${fmtW(d)} 줄어든다`, `${fmtW(d)} 늘어난다`, `${fmtW(U * PR)} 줄어든다`, '변화 없다'], a: 0, why: `달러 매출 $${(U * PR).toLocaleString()} × 50원 = ${fmtW(d)}. 환율이 내리면 같은 달러가 원화로 덜 바뀌어 수출 기업엔 불리해요.` },
      { q: `수출 단가 $${T.p}. 수입국 A는 관세 ${T.a[0]}% + 운송비 $${T.a[1].toFixed(1)}/개, 수입국 B는 관세 ${T.b[0]}% + 운송비 $${T.b[1].toFixed(1)}/개예요. 개당 도착원가가 더 낮은 나라는?\n(도착원가 = 단가 × (1 + 관세율) + 운송비)`, opts: ['A국', 'B국', '똑같다'], a: la < lb ? 0 : 1, why: `A국 $${la.toFixed(2)} · B국 $${lb.toFixed(2)} → ${la < lb ? 'A' : 'B'}국이 더 낮아요. 관세뿐 아니라 운송비까지 함께 따져야 해요.` },
    ];
    mcq(box, items, '② 환율·관세 계산', (ok, n) => {
      const sB = Math.round((ok / n) * 100), sc = Math.round(sA * 0.4 + sB * 0.6);
      result(box, sc, ['국제통상학전공 · 무역 실무', `절차 순서 ${sA}점 · 환율·관세 계산 ${sB}점`, '무역실무·무역영어·국제재무·디지털무역결제 같은 수업에서 이런 계산과 절차를 배워요.', '💡 환율이 오르내리면 같은 거래도 이익이 달라져서, 무역에서는 환율 관리가 중요해요.'], done);
    });
  };
  const draw = () => {
    box.innerHTML = '';
    h('div', 'hd', '① 수출 절차 순서 맞추기 — 처음 할 일부터 차례로 눌러요', box);
    h('div', 'sign', nxt ? ST.slice(0, nxt).map((s, i) => `${i + 1}. ${s[0]} ${s[1]}`).join('\n') : '(여기에 완성된 순서가 쌓여요)', box);
    const ol = h('div', 'opts', '', box);
    order.filter((i) => i >= nxt).forEach((i) => {
      const b = h('button', 'opt', `${ST[i][0]} ${ST[i][1]}`, ol);
      b.onclick = () => {
        if (i === nxt) { nxt++; msg = ''; if (nxt === ST.length) { const sA = clamp(100 - miss * 12, 20, 100); step(box, `✅ 절차 완성! (실수 ${miss}번 · ${sA}점)\n무역 거래는 이 순서로 흘러요. 이제 환율과 관세를 계산해 볼까요?`, '② 환율·관세 계산 ▶', () => calc(sA)); return; } }
        else { miss++; msg = `⛔ "${ST[i][1]}"은(는) 아직 일러요. 먼저 해야 할 단계가 있어요.`; }
        draw();
      };
    });
    if (msg) h('div', 'fb', msg, box);
  };
  draw();
}

function negoRun(box, done) {
  const COST = 60, M = 78 + Math.floor(Math.random() * 19), COMP = M + Math.floor(Math.random() * 11) - 4;
  let mS = 0;
  const finish = (nS, deal) => result(box, Math.round(mS * 0.4 + nS * 0.6), [
    '글로벌비즈니스학전공 · 협상과 매너', `문화·매너 ${mS}점 · 협상 ${nS}점`,
    deal ? `🤝 합의 가격 $${deal} (바이어의 한계 $${M}) → 개당 이익 $${deal - COST}` : `💥 협상 결렬! 바이어의 한계 가격은 $${M}였어요. 너무 높게 부르면 거래 자체를 잃을 수 있어요.`,
    '국제매너와 해외지역연구·비즈니스 커뮤니케이션·디지털수출마케팅 같은 수업에서 이런 역량을 키워요.'], done);
  const nego = () => {
    let round = 1, offer = 100;
    const draw = (msg) => {
      box.innerHTML = '';
      h('div', 'hd', `② 가격 협상 · 라운드 ${round} / 5`, box);
      h('div', 'sign', `📦 우리 원가 $${COST}/개 · (제안가 − 원가) = 우리 이익\n📊 시장조사: 경쟁사 평균 제안가 약 $${COMP}\n💬 ${msg}`, box);
      const lab = h('div', 'big', `$${offer}`, box), sl = h('input', '', '', box);
      sl.type = 'range'; sl.min = 60; sl.max = 130; sl.step = 1; sl.value = offer; sl.style.width = '100%';
      sl.oninput = () => { offer = +sl.value; lab.textContent = '$' + offer; };
      const row = h('div', 'row', '', box), go = h('button', 'pri', '🤝 이 가격으로 제안', row);
      go.onclick = () => {
        if (offer <= M) { finish(Math.round(20 + (80 * (offer - COST)) / (M - COST)), offer); return; }
        const d = offer - M;
        if (d > 22 || round >= 5) { finish(10, 0); return; }
        round++; draw(d <= 6 ? '바이어: "조금만 더 맞춰 주시면 계약할게요."' : d <= 15 ? '바이어: "솔직히 예산보다 꽤 비싸네요."' : '바이어: "이 가격이면 다른 공급처를 알아봐야겠어요."');
      };
    };
    draw('바이어: "첫 제안을 들려주세요."');
  };
  const MANNERS = [
    { q: '일본 거래처 담당자와 첫 미팅이에요. 명함을 받을 때 가장 알맞은 행동은?', opts: ['두 손으로 받고 이름을 확인한 뒤 테이블 위에 정중히 놓는다', '한 손으로 받아 바로 주머니에 넣는다', '받은 명함 뒷면에 바로 메모를 한다'], a: 0, why: '동아시아에서는 명함을 상대방 자신처럼 존중해요. 두 손으로 받고 내용을 확인하는 것이 기본 매너예요.' },
    { q: '이슬람권 바이어를 점심에 초대했어요. 가장 좋은 준비는?', opts: ['할랄(허용 음식) 가능 여부를 미리 확인하고 메뉴를 고른다', '가장 유명한 돼지고기 맛집을 예약한다', '메뉴는 신경 쓰지 않고 현장에서 정한다'], a: 0, why: '종교·문화에 따라 먹지 않는 음식이 있어요. 미리 확인하는 배려가 신뢰를 쌓는 첫걸음이에요.' },
    { q: '미국·유럽 파트너와 현장 미팅이 10시예요. 교통 문제로 10분쯤 늦을 것 같아요.', opts: ['미리 사과와 예상 도착 시간을 연락한다', '조용히 들어가서 아무 말도 하지 않는다', '늦는 건 흔한 일이니 연락하지 않는다'], a: 0, why: '서구권 비즈니스는 시간 약속을 신뢰의 기준으로 봐요. 늦을 땐 미리 알리는 것이 매너예요.' },
    { q: '중국 파트너와 계약 협상 전, 상대가 저녁 식사를 제안했어요.', opts: ['관계를 쌓는 자리로 보고 기꺼이 참석해 대화를 나눈다', '계약과 상관없으니 거절하고 계약서만 보낸다', '식사 자리에서 바로 서명하라고 요구한다'], a: 0, why: '중화권은 신뢰 관계(관시)를 중시하는 경향이 있어요. ※ 문화 차이는 일반적 경향일 뿐 사람마다 달라요. 상대를 관찰하는 태도가 가장 중요해요.' },
  ];
  mcq(box, MANNERS, '① 문화·매너', (ok, n) => { mS = Math.round((ok / n) * 100); step(box, `문화·매너 ${ok}/${n} 정답 (${mS}점)\n이제 바이어와 가격을 협상해요. 바이어의 한계 가격은 비밀이에요. 반응을 보고 5번 안에 최대한 높은 가격에 합의하세요!`, '② 가격 협상 ▶', nego); });
}

registerExperience('gbs', {
  icon: '🌐', title: '글로벌 무역·협상 데스크',
  desc: '국제통상학전공의 무역 실무(절차·환율·관세)와 글로벌비즈니스학전공의 협상·문화 매너를 두 파트로 체험해요.',
  tools: ['🌍 무역 상황판', '💱 환율·관세 계산', '🤝 가격 협상'],
  steps: ['① 무역 실무: 수출 절차를 순서대로 맞추고 환율·관세를 계산해요', '② 협상과 매너: 문화별 비즈니스 매너를 고르고 바이어와 가격을 협상해요', '두 파트를 모두 마치면 종합 결과가 나와요 (순서 자유)'],
  env: ENV('#cfe3f5'),
  build(c) {
    const { root, cam } = c;
    c.ground('#d3dde8', 40, -0.5); c.box(16, 0.4, 9, '#f4f6f9', 0, -0.2, 0);
    const globe = new THREE.Group(); globe.position.set(0, 2.8, -0.5); root.add(globe);
    c.sph(2.2, '#2f6fb5', 0, 0, 0, globe);
    [[0.5, 0.2], [0.8, 2.3], [-0.2, 3.0], [0.3, -1.7], [-0.6, -2.5], [0.6, -0.9]].forEach(([la, lo]) => c.sph(0.55, '#58b368', Math.cos(la) * Math.sin(lo) * 2.05, Math.sin(la) * 2.05, Math.cos(la) * Math.cos(lo) * 2.05, globe));
    const tilt = new THREE.Group(); tilt.rotation.z = 0.45; tilt.position.copy(globe.position); root.add(tilt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.035, 8, 72), new THREE.MeshBasicMaterial({ color: '#ffd24d' })); ring.rotation.x = Math.PI / 2; tilt.add(ring);
    const car = new THREE.Group(); tilt.add(car);
    c.box(0.7, 0.18, 0.28, '#ffffff', 3.3, 0, 0, car); c.box(0.18, 0.04, 0.9, '#e0533d', 3.3, 0, 0, car); /* 화물기 */
    c.box(0.9, 0.2, 0.34, '#2f3f5c', -3.3, 0, 0, car); c.box(0.4, 0.2, 0.3, '#e0533d', -3.1, 0.2, 0, car); /* 화물선 */
    [['KOREA\n수출 기업', -6.2, 0.2], ['USA\n바이어', 6.2, 0.2], ['JAPAN\n바이어', -4.6, 3.2], ['CHINA\n바이어', 4.6, 3.2]].forEach(([t, x, z]) => { c.cyl(0.07, 0.07, 2.4, '#8a94a3', x, 1.2, z); const g = ctag(root, t, 2.0, 0.8); g.position.set(x, 3.0, z); });
    const title = ctag(root, '🌐 글로벌 비즈니스 센터', 4.6, 0.9); title.position.set(0, 6.4, -0.5);
    cam.set([0, 6.2, 12.5], [0, 2.0, 1.5]); cam.fov(50, true);
    return hub(c, {
      title: '🌐 글로벌 무역·협상 데스크', sub: '두 파트를 모두 체험하면 종합 결과가 나와요 (순서 자유)',
      career: '국제통상학전공은 무역실무·디지털무역결제·국제재무·AI비즈니스데이터분석을, 글로벌비즈니스학전공은 국제관계·비즈니스·사회문화 이론과 언어·실무 교육을 배워요. KOTRA·한국무역협회·여수광양항만공사·무역회사, 관세사·국제무역사 같은 전문직으로 진출해요.',
      parts: [
        { id: 'trade', icon: '💱', name: '국제통상 · 무역 실무', desc: '수출 절차 순서 + 환율·관세 계산', run: tradeRun },
        { id: 'nego', icon: '🤝', name: '글로벌비즈니스 · 협상과 매너', desc: '나라별 매너 + 바이어 가격 협상', run: negoRun },
      ],
      tick(dt) { globe.rotation.y += dt * 0.25; car.rotation.y += dt * 0.6; },
    });
  },
});

/* ═══════════════ 2. 물류교통학과 · 배송 경로 / 교차로 신호 / 항만 선적 검수 ═══════════════ */
const perms = (a) => (a.length < 2 ? [a] : a.flatMap((v, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [v, ...p])));
const rndPts = (n) => {
  const pts = []; let g = 0;
  while (pts.length < n && g++ < 600) { const p = { x: (Math.random() * 2 - 1) * 11, z: (Math.random() * 2 - 1) * 5.6 }; if (Math.hypot(p.x, p.z) < 3.5) continue; if (pts.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 4.2)) pts.push(p); }
  return pts.length === n ? pts : rndPts(n);
};
const seg = (a, b, col, parent) => {
  const L = Math.hypot(b.x - a.x, b.z - a.z), m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: col }));
  m.position.set((a.x + b.x) / 2, 0.06, (a.z + b.z) / 2); m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); parent.add(m); return m;
};

registerExperience('log', {
  icon: '🚚', title: '항만·물류·교통 운영 센터',
  desc: '물류(배송 경로 설계·항만 선적 검수)와 교통(교차로 신호 운영)을 세 가지 파트로 체험해요.',
  tools: ['🗺️ 배송 경로 지도', '🚦 신호 제어기', '🚢 선적 검수 탤리'],
  steps: ['🚚 물류센터에서 5곳을 돌고 오는 가장 짧은 경로를 짜요 (냉동식품 주의!)', '🚦 시간대별로 바뀌는 교통량에 맞춰 신호 시간을 배분해요', '🚢 크레인이 싣는 컨테이너를 세어 선적서와 맞는지 검수해요', '세 파트를 모두 마치면 종합 결과가 나와요 (순서 자유)'],
  env: ENV('#cfe6f7'),
  build(c) {
    const { root, cam } = c;
    c.ground('#9fc4a0', 60, -0.5);
    const mapG = new THREE.Group(), sigG = new THREE.Group(), portG = new THREE.Group(); root.add(mapG, sigG, portG);
    const VIEW = { map: [[0, 17, 12], [0, 0, 3.5]], sig: [[0, 15, 13], [0, 0, 3.5]], port: [[0, 8.5, 14], [0, 0.8, 4]] };
    const go = (k) => { mapG.visible = k === 'map'; sigG.visible = k === 'sig'; portG.visible = k === 'port'; cam.to(VIEW[k][0], VIEW[k][1]); };

    /* ── 지도(배송 경로) ── */
    c.box(30, 0.2, 16, '#cdd5c4', 0, -0.1, 0, mapG); c.box(3.2, 1.8, 2.6, '#47698f', 0, 0.9, 0, mapG); c.box(3.4, 0.2, 2.8, '#2c4766', 0, 1.9, 0, mapG);
    const dTag = ctag(mapG, '🏭 물류센터 (출발·복귀)', 3.6, 0.7); dTag.position.set(0, 2.9, 0);
    const stopG = new THREE.Group(), lineG = new THREE.Group(); mapG.add(stopG, lineG);
    const STOPS = [{ n: '대형마트', i: '🏪', col: '#e0833d' }, { n: '병원', i: '🏥', col: '#d94b4b' }, { n: '급식센터', i: '🏫', col: '#3da35d' }, { n: '공장', i: '🏭', col: '#6f7a88' }, { n: '냉동식품 매장', i: '❄️', col: '#4c8dd9' }], CI = 4, DEP = { x: 0, z: 0 };
    const tourLen = (pts, ord, back) => { let d = 0, p = DEP; ord.forEach((i) => { d += Math.hypot(pts[i].x - p.x, pts[i].z - p.z); p = pts[i]; }); return back ? d + Math.hypot(p.x, p.z) : d; };
    const routeRun = (box, done) => {
      clearG(stopG); clearG(lineG);
      const pts = rndPts(5), best = Math.min(...perms([0, 1, 2, 3, 4]).filter((o) => o.indexOf(CI) <= 1).map((o) => tourLen(pts, o, true)));
      const tags = pts.map((p, i) => { c.box(1.8, 1.1, 1.6, STOPS[i].col, p.x, 0.55, p.z, stopG); const t = ctag(stopG, `${STOPS[i].i} ${STOPS[i].n}`, 2.6, 0.6); t.position.set(p.x, 2.0, p.z); return t; });
      const truck = new THREE.Group(); c.box(1.6, 0.7, 0.8, '#f2f2f2', 0, 0.55, 0, truck); c.box(0.6, 0.6, 0.8, '#e0533d', 1.0, 0.5, 0, truck); stopG.add(truck);
      let route = [], run = null, ended = false;
      const lenNow = () => tourLen(pts, route, route.length === 5);
      const lines = () => {
        clearG(lineG); const path = [DEP, ...route.map((i) => pts[i])]; if (route.length === 5) path.push(DEP);
        for (let k = 1; k < path.length; k++) seg(path[k - 1], path[k], '#ffd24d', lineG);
        tags.forEach((t, i) => { const k = route.indexOf(i); t.userData.set(k < 0 ? `${STOPS[i].i} ${STOPS[i].n}` : `${k + 1}번 ${STOPS[i].i} ${STOPS[i].n}`, '#ffffff', k < 0 ? undefined : '#2f9e6a'); });
      };
      const finishRoute = () => {
        const mine = lenNow(), eff = clamp(best / mine, 0, 1), sc = Math.round(clamp(100 * eff * eff, 5, 100));
        result(box, sc, ['물류관리 · 배송 경로 설계', `내 경로 ${mine.toFixed(1)}km · 최적 경로 ${best.toFixed(1)}km (효율 ${Math.round(eff * 100)}%)`, '💡 배송 순서만 바꿔도 이동 거리와 연료비가 크게 달라져요. 냉동식품처럼 시간·온도 제약이 있으면 더 어려워지죠.', '물류관리론·물류시뮬레이션·공급사슬경영론 수업에서 이런 최적화를 배워요.'], done);
      };
      const draw = (msg) => {
        box.innerHTML = '';
        h('div', 'hd', '① 배송 경로 짜기 — 물류센터 🏭 출발 → 5곳 방문 → 복귀', box);
        h('div', 'sign', `❄️ 냉동식품은 녹기 전에! 처음 2곳 안에 방문해야 해요.\n📏 지금까지 이동 거리: ${lenNow().toFixed(1)} km`, box);
        const g = h('div', 'grid', '', box);
        STOPS.forEach((s, i) => {
          const used = route.includes(i), b = h('button', 'card' + (used ? ' dn' : ''), `${s.i} ${s.n}${used ? ` <small>(${route.indexOf(i) + 1}번째)</small>` : ''}`, g);
          b.onclick = () => {
            if (used || run) return;
            if (route.length >= 1 && !route.includes(CI) && i !== CI) { draw('❄️ 냉동식품이 녹기 전에! 두 번째까지는 냉동식품 매장을 방문해야 해요.'); return; }
            route.push(i); lines(); draw();
          };
        });
        const row = h('div', 'row', '', box), un = h('button', '', '↩ 되돌리기', row), rs = h('button', '', '🧹 처음부터', row), st = h('button', 'pri', '🚚 출발!', row);
        un.onclick = () => { if (!run) { route.pop(); lines(); draw(); } }; rs.onclick = () => { if (!run) { route = []; lines(); draw(); } };
        st.style.opacity = route.length === 5 ? 1 : 0.45;
        st.onclick = () => { if (route.length < 5 || run) return; run = { path: [DEP, ...route.map((i) => pts[i]), DEP], s: 0 }; draw('🚚 배송 중…'); };
        if (msg) h('div', 'fb', msg, box);
      };
      draw('');
      return {
        tick(dt) {
          if (!run || ended) return; run.s += 6 * dt; let rem = run.s;
          for (let k = 1; k < run.path.length; k++) {
            const a = run.path[k - 1], b = run.path[k], L = Math.hypot(b.x - a.x, b.z - a.z);
            if (rem <= L) { const u = rem / L; truck.position.set(a.x + (b.x - a.x) * u, 0, a.z + (b.z - a.z) * u); truck.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); return; }
            rem -= L;
          }
          ended = true; finishRoute();
        },
        dispose() { run = null; },
      };
    };

    /* ── 교차로(신호 운영) ── */
    c.box(30, 0.1, 5.2, '#3a3f48', 0, 0, 0, sigG); c.box(5.2, 0.12, 24, '#3a3f48', 0, 0.01, 0, sigG);
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => c.box(11, 0.3, 9, '#bcc6b3', sx * 8.1, 0.1, sz * 7.1, sigG)));
    const LG = new THREE.SphereGeometry(0.3, 14, 10), CARG = new THREE.BoxGeometry(1.2, 0.5, 0.7), CC = ['#e0533d', '#3d7fd6', '#f2b84b', '#47b5a2', '#c06bd8', '#f1f1f1'];
    const mkLight = (x, z) => { c.cyl(0.08, 0.08, 2.8, '#7a828e', x, 1.4, z, sigG); const m = new THREE.Mesh(LG, new THREE.MeshBasicMaterial({ color: '#e0533d' })); m.position.set(x, 3.0, z); sigG.add(m); return m; };
    const lNS = [mkLight(3.0, -3.2), mkLight(-3.0, 3.2)], lEW = [mkLight(3.2, 3.0), mkLight(-3.2, -3.0)];
    const carM = (ax) => { const m = new THREE.Mesh(CARG, new THREE.MeshStandardMaterial({ color: pick(CC), roughness: 0.6 })); m.position.y = 0.35; m.rotation.y = ax === 'z' ? Math.PI / 2 : 0; m.visible = false; sigG.add(m); return m; };
    const arms = [{ ax: 'z', s: -1, o: -0.9 }, { ax: 'z', s: 1, o: 0.9 }, { ax: 'x', s: 1, o: -0.9 }, { ax: 'x', s: -1, o: 0.9 }].map((a) => ({ ...a, cars: Array.from({ length: 8 }, () => carM(a.ax)) }));
    const runners = Array.from({ length: 12 }, () => ({ m: carM('x'), alive: false, a: null, u: 0 }));
    const tagNS = ctag(sigG, '', 3.8, 0.7), tagEW = ctag(sigG, '', 3.8, 0.7); tagNS.position.set(0, 2.6, -10); tagEW.position.set(-11, 2.6, 0);
    const showQ = (qn, qe) => {
      const cnt = [Math.ceil(qn / 2), Math.floor(qn / 2), Math.ceil(qe / 2), Math.floor(qe / 2)];
      arms.forEach((a, i) => a.cars.forEach((m, k) => { const on = k < Math.min(8, cnt[i]); m.visible = on; if (on) { const d = 3.4 + k * 1.6; m.position.x = a.ax === 'z' ? a.o : a.s * d; m.position.z = a.ax === 'z' ? a.s * d : a.o; } }));
    };
    const spawnRun = (a) => { const r = runners.find((x) => !x.alive); if (!r) return; r.alive = true; r.a = a; r.u = a.s * 3; r.m.rotation.y = a.ax === 'z' ? Math.PI / 2 : 0; r.m.visible = true; };
    const moveRun = (dt) => runners.forEach((r) => {
      if (!r.alive) return; r.u -= r.a.s * 10 * dt;
      if (Math.abs(r.u) > 14) { r.alive = false; r.m.visible = false; return; }
      r.m.position.x = r.a.ax === 'z' ? r.a.o : r.u; r.m.position.z = r.a.ax === 'z' ? r.u : r.a.o;
    });
    const sigRun = (box, done) => {
      const C = 8, SAT = 1.5, SL = 18, ST = [[1.15, 0.3, '🌅 출근 시간대'], [0.72, 0.72, '☀️ 낮 시간대'], [0.3, 1.15, '🌇 퇴근 시간대']];
      let on = false, ended = false, t = 0, f = 0.5, qn = 0, qe = 0, area = 0, info = null, acc = 0, ns = true; const sp = [0, 0]; let kTag = '';
      runners.forEach((r) => { r.alive = false; r.m.visible = false; }); showQ(0, 0);
      [...lNS, ...lEW].forEach((l) => l.material.color.set('#e0533d'));
      h('div', 'hd', '② 교차로 신호 운영 (교통운영·교통계획)', box);
      h('div', 'sign', '🚦 54초 동안 교차로 신호를 운영해요. 시간대에 따라 교통량이 바뀌어요.\n🟢 신호는 8초 주기로 돌고, 남북·동서에 초록불 시간을 나눠 줘요.\n🔼/🔽 버튼으로 배분을 바꿔요 (20%~80%). 대기 차량이 적을수록 고득점!\n💡 힌트: 신호 배분 ≈ 교통량 비율', box);
      const row0 = h('div', 'row', '', box), st0 = h('button', 'pri', '▶ 운영 시작', row0);
      const refresh = () => {
        const s = Math.min(2, Math.floor(t / SL)), rem = Math.max(0, Math.ceil(SL * 3 - t)), [ln, le, nm] = ST[s], warn = s < 2 && SL * (s + 1) - t < 4;
        info.innerHTML = `⏱ 남은 시간 ${rem}초 · ${nm}${warn ? ' <b style="color:#b8860b">→ 곧 교통량이 바뀌어요!</b>' : ''}<br>🚗 교통량(대/분): 남북 <b>${Math.round(ln * 60)}</b> · 동서 <b>${Math.round(le * 60)}</b><br>🟢 신호 배분: 남북 <b>${Math.round(f * 100)}%</b> · 동서 <b>${Math.round((1 - f) * 100)}%</b><br>🚙 대기 차량: 남북 <b>${qn.toFixed(1)}</b> · 동서 <b>${qe.toFixed(1)}</b>`;
      };
      st0.onclick = () => {
        box.innerHTML = ''; h('div', 'hd', '🚦 신호 운영 중…', box); info = h('div', 'sign', '', box);
        const row = h('div', 'row', '', box), bN = h('button', '', '🔼 남북 늘리기', row), bE = h('button', '', '🔽 동서 늘리기', row);
        bN.onclick = () => { f = clamp(Math.round((f + 0.1) * 10) / 10, 0.2, 0.8); refresh(); }; bE.onclick = () => { f = clamp(Math.round((f - 0.1) * 10) / 10, 0.2, 0.8); refresh(); };
        on = true; refresh();
      };
      const end = () => {
        ended = true; on = false; [...lNS, ...lEW].forEach((l) => l.material.color.set('#e0533d'));
        const avg = area / (SL * 3), sc = Math.round(clamp(100 - (avg - 2.4) * 12, 0, 100));
        result(box, sc, ['교통운영 · 신호 배분 최적화', `평균 대기 차량 ${avg.toFixed(1)}대 (신호를 50:50으로 고정하면 약 6.6대)`, '💡 교통량이 많은 방향에 초록불을 더 주면 전체 대기가 줄어요. 시간대별로 배분을 바꾸는 것이 신호 운영의 핵심이에요.', '교통수요분석·교통계획·교통운영 수업에서 이런 문제를 다뤄요.'], done);
      };
      return {
        tick(dt) {
          if (on && !ended) {
            t += dt; const s = Math.min(2, Math.floor(t / SL)), [ln, le] = ST[s]; ns = t % C < f * C;
            qn = Math.max(0, qn + ln * dt - (ns ? SAT * dt : 0)); qe = Math.max(0, qe + le * dt - (ns ? 0 : SAT * dt)); area += (qn + qe) * dt;
            if (ns && qn > 0.3) { sp[0] += dt; while (sp[0] > 0.7) { sp[0] -= 0.7; spawnRun(arms[Math.random() < 0.5 ? 0 : 1]); } } else sp[0] = 0;
            if (!ns && qe > 0.3) { sp[1] += dt; while (sp[1] > 0.7) { sp[1] -= 0.7; spawnRun(arms[Math.random() < 0.5 ? 2 : 3]); } } else sp[1] = 0;
            lNS.forEach((l) => l.material.color.set(ns ? '#3cd17a' : '#e0533d')); lEW.forEach((l) => l.material.color.set(ns ? '#e0533d' : '#3cd17a'));
            acc += dt; if (acc > 0.2) { acc = 0; refresh(); }
            const key = `${Math.round(qn)}|${Math.round(qe)}|${ns}`;
            if (key !== kTag) { kTag = key; tagNS.userData.set(`↕ 남북 대기 ${Math.round(qn)}대`, '#ffffff', ns ? '#2f9e6a' : '#c0453d'); tagEW.userData.set(`↔ 동서 대기 ${Math.round(qe)}대`, '#ffffff', ns ? '#c0453d' : '#2f9e6a'); }
            if (t >= SL * 3) end();
          }
          moveRun(dt); showQ(qn, qe);
        },
        dispose() { on = false; },
      };
    };

    /* ── 항만(선적 검수) ── */
    c.box(34, 0.1, 9, '#2a6f9e', 4, -0.05, -3.5, portG); c.box(34, 0.3, 7, '#b8bcc2', 0, 0, 4.2, portG);
    c.box(9, 0.35, 1.2, '#444c58', -7, 0.32, 3.0, portG);
    c.box(11, 1.0, 3.8, '#2f3f5c', 4, 0.3, -1.8, portG); c.box(11, 0.1, 3.8, '#8a94a3', 4, 0.85, -1.8, portG); c.box(1.6, 2.2, 2.4, '#e8e8e8', 9.2, 1.9, -1.8, portG);
    c.box(0.3, 6, 0.3, '#e0a21f', -3.6, 3, 2.2, portG); c.box(0.3, 6, 0.3, '#e0a21f', -3.6, 3, -3.0, portG); c.box(0.4, 0.4, 6, '#e0a21f', -3.6, 6.0, -0.4, portG);
    c.box(0.2, 1.8, 0.2, '#ffd24d', -7.9, 1.1, 2.2, portG); c.box(0.2, 1.8, 0.2, '#ffd24d', -7.9, 1.1, 3.8, portG); c.box(0.2, 0.2, 1.8, '#ffd24d', -7.9, 2.0, 3.0, portG);
    const pTag = ctag(portG, '🔍 검수 지점', 2.4, 0.6); pTag.position.set(-7.9, 3.0, 3.0);
    const cargoG = new THREE.Group(); portG.add(cargoG);
    const CG = new THREE.BoxGeometry(1.4, 0.8, 0.7), PG = new THREE.BoxGeometry(0.5, 0.5, 0.06); CG.userData.keep = true;
    const TY = [{ n: '식품', i: '🔴', col: '#d6453d' }, { n: '전자', i: '🔵', col: '#3d7fd6' }, { n: '부품', i: '🟢', col: '#3dae63' }];
    const slotOf = (i) => new THREE.Vector3(Math.floor((i % 12) / 2) * 1.5, 1.3 + Math.floor(i / 12) * 0.82, i % 2 ? -2.6 : -1.0);
    const portRun = (box, done) => {
      clearG(cargoG);
      const N = 20, seq = shuffle(Array.from({ length: N }, (_, i) => i % 3)).map((k) => ({ k, dmg: false }));
      shuffle(seq.map((_, i) => i)).slice(0, 3).forEach((i) => { seq[i].dmg = true; });
      const act = [0, 0, 0]; seq.forEach((s) => { act[s.k]++; });
      const sh = Math.floor(Math.random() * 3), plan = act.slice(); plan[sh] += 1;
      let on = false, ended = false, spawned = 0, sp = 0, endT = 0, loaded = 0, dmgT = 0, stat = null, bD = null; const items = [], tally = [0, 0, 0], hist = [], btns = [];
      const refresh = () => { btns.forEach((b, k) => { b.textContent = `${TY[k].i} ${TY[k].n}  ${tally[k]}`; }); if (bD) bD.textContent = `⚠ 파손  ${dmgT}`; if (stat) stat.textContent = `🏗 선적 ${loaded} / ${N}개 완료`; };
      const tap = (k) => { if (!on) return; if (k < 3) tally[k]++; else dmgT++; hist.push(k); refresh(); };
      h('div', 'hd', '③ 항만 선적 검수 (선적서 대조)', box);
      h('div', 'sign', `📄 선적서(B/L) 예정 수량\n${TY.map((t, k) => `${t.i} ${t.n} ${plan[k]}개`).join(' · ')} (총 ${plan.reduce((a, b) => a + b, 0)}개)\n\n크레인이 컨테이너를 배에 실어요. 지나가는 컨테이너를 보며 색깔 버튼으로 수를 세요(검수원의 탤리). 검은 얼룩이 있는 파손 컨테이너는 색깔 버튼과 ⚠ 버튼을 함께 눌러요.`, box);
      const row0 = h('div', 'row', '', box), st0 = h('button', 'pri', '▶ 검수 시작', row0);
      st0.onclick = () => {
        box.innerHTML = ''; h('div', 'hd', '🔍 컨테이너를 세어 주세요!', box); stat = h('div', 'sign', '', box);
        const r1 = h('div', 'row', '', box);
        TY.forEach((t, k) => { const b = h('button', 'pri', '', r1); b.style.flex = '1'; b.style.fontSize = '16px'; b.onclick = () => tap(k); btns.push(b); });
        const r2 = h('div', 'row', '', box); bD = h('button', 'mic', '', r2); bD.style.flex = '1'; bD.onclick = () => tap(3);
        const un = h('button', '', '↩ 마지막 입력 취소', r2); un.onclick = () => { const k = hist.pop(); if (k === undefined || !on) return; if (k < 3) tally[k]--; else dmgT--; refresh(); };
        on = true; refresh();
      };
      const spawn = () => {
        const s = seq[spawned], m = new THREE.Mesh(CG, new THREE.MeshStandardMaterial({ color: TY[s.k].col, roughness: 0.6 }));
        if (s.dmg) { const p = new THREE.Mesh(PG, new THREE.MeshBasicMaterial({ color: '#111111' })); p.position.set(0, 0, 0.36); m.add(p); }
        m.position.set(-11, 0.9, 3.0); cargoG.add(m); items.push({ m, i: spawned, st: 0, t: 0 }); spawned++;
      };
      const finish = () => {
        ended = true; on = false;
        const err = [0, 1, 2].reduce((a, k) => a + Math.abs(tally[k] - act[k]), 0) + Math.abs(dmgT - 3), sc = Math.max(0, 100 - 14 * err);
        result(box, sc, ['항만 물류 · 선적 검수', `내 집계: ${TY.map((t, k) => `${t.i}${tally[k]}`).join(' ')} · 파손 ${dmgT}`, `실제 선적: ${TY.map((t, k) => `${t.i}${act[k]}`).join(' ')} · 파손 3 (오차 ${err}개)`, `📄 선적서 대비: ${TY[sh].i} ${TY[sh].n} 컨테이너가 서류보다 1개 부족 → 선사에 확인·클레임 대상!`, '검수는 서류와 실물이 같은지 확인해 분쟁을 막는 일이에요. 항만운영관리론·해상운송론·화물운송론 수업과 연결돼요.'], done);
      };
      return {
        tick(dt) {
          if (!on) return;
          sp += dt; if (spawned < N && sp >= 1.2) { sp -= 1.2; spawn(); }
          items.forEach((it) => {
            if (it.st === 0) { it.m.position.x += 3.4 * dt; if (it.m.position.x >= -4) { it.st = 1; it.t = 0; } }
            else if (it.st === 1) {
              it.t = Math.min(1, it.t + dt / 0.9); const T = slotOf(it.i), p = it.t;
              it.m.position.set(-4 + (T.x + 4) * p, 0.9 + (T.y - 0.9) * p + 3 * Math.sin(Math.PI * p), 3.0 + (T.z - 3.0) * p);
              if (p >= 1) { it.st = 2; loaded++; refresh(); }
            }
          });
          if (!ended && spawned >= N && loaded >= N) { endT += dt; if (endT > 1.0) finish(); }
        },
        dispose() { on = false; clearG(cargoG); },
      };
    };

    cam.set(VIEW.map[0], VIEW.map[1]); cam.fov(50, true); go('map');
    return hub(c, {
      title: '🚚 항만·물류·교통 운영 센터', sub: '세 파트를 모두 체험하면 종합 결과가 나와요 (순서 자유)',
      career: '물류교통학과는 물류관리론·화물운송론·항만운영관리론·교통계획·교통운영·스마트항만캡스톤디자인 같은 수업으로 물류(공급망)와 교통(도시·지역 교통체계)을 배워요. 광양항·여수국가산단과 연계한 AI 융합 항만물류 마이크로디그리를 운영하며, 항만공사·CJ대한통운·글로비스·한국도로공사·코레일·한국교통연구원 등으로 진출해요.',
      parts: [
        { id: 'route', icon: '🚚', name: '배송 경로 설계', desc: '5곳을 도는 최단 경로 + 냉동식품 제약', run: routeRun },
        { id: 'sig', icon: '🚦', name: '교차로 신호 운영', desc: '시간대별 교통량에 맞춰 초록불 배분', run: sigRun },
        { id: 'port', icon: '🚢', name: '항만 선적 검수', desc: '컨테이너 수량·파손을 세고 선적서와 대조', run: portRun },
      ],
      onOpen: (id) => go(id === 'route' ? 'map' : id), onHome: () => go('map'),
    });
  },
});

/* ═══════════════ 3. 문화콘텐츠학부 전자상거래전공 · A/B 테스트 · 재고(ERP) · 결제 보안 · CRM ═══════════════ */
const ORD = [
  { id: 1, t: '🧾 38,000원 · 한국 IP · 평소 배송지 · 14:20 · 1회 결제 성공', bad: false, why: '평소와 같은 패턴이에요.' },
  { id: 2, t: '🧾 1,850,000원 · 해외 IP · 처음 쓰는 배송지 · 03:12 · 카드 5회 시도 끝에 성공', bad: true, why: '고액 + 해외 IP + 새 배송지 + 연속 시도는 카드 도용의 전형적인 신호예요.' },
  { id: 3, t: '🧾 25,000원 × 3건 · 같은 카드로 1분 안에 연속 결제 · 같은 상품', bad: true, why: '소액을 잇달아 결제해 카드가 유효한지 시험하는 패턴일 수 있어요.' },
  { id: 4, t: '🧾 129,000원 · 한국 IP · 평소 배송지 · 20:40 · 단골 고객(구매 12회)', bad: false, why: '금액이 커도 평소 패턴과 같아요.' },
  { id: 5, t: '🧾 60,000원 · 한국 IP · 새 배송지(가족 주소) · 본인 인증 2단계 완료', bad: false, why: '새 배송지라도 추가 본인 인증을 통과했어요.' },
  { id: 6, t: '🧾 420,000원 · 가입 3분 만에 · 고가 상품 10개 동일 구매 · 배송지가 폐업한 상가', bad: true, why: '신규 계정 + 대량 고가 구매 + 수상한 배송지 → 사기 의심이에요.' },
];

registerExperience('eco', {
  icon: '🛒', title: 'AI 이커머스 운영 센터',
  desc: '온라인 쇼핑몰을 운영하는 기획자가 되어 A/B 테스트·재고 발주·결제 보안·고객관리(CRM)를 데이터로 판단해 봐요.',
  tools: ['📊 A/B 테스트 대시보드', '📦 ERP 재고 시뮬레이터', '🛡️ 이상거래 탐지 화면', '💬 CRM 고객 분류'],
  steps: ['🛍️ 배너 A/B 테스트 결과를 올바른 지표로 비교해요', '📦 발주점·발주량을 정해 21일 동안 재고를 운영해요', '🛡️ 주문 목록에서 이상거래를 찾아내요', '💬 고객 상황에 맞는 CRM 메시지를 골라요', '네 파트를 모두 마치면 종합 결과가 나와요 (순서 자유)'],
  env: ENV('#e6e1f6', '#9a94b3'),
  build(c) {
    const { root, cam } = c, ids = ['ab', 'erp', 'fds', 'crm'];
    c.ground('#e4e0f2', 40, -0.5); c.box(18, 0.3, 9, '#f6f4fb', 0, -0.15, 0);
    const stations = [['🛍️', 'A/B 테스트', '#6a4bd8'], ['📦', '재고·발주(ERP)', '#2f8f80'], ['🛡️', '결제 보안', '#c0453d'], ['💬', '고객관리(CRM)', '#e08a2f']].map(([ic, nm, col], i) => {
      const x = -6.3 + i * 4.2; c.box(2.6, 0.9, 1.6, col, x, 0.45, 0); c.box(2.2, 1.5, 0.12, '#1b2433', x, 1.95, -0.5); c.box(1.8, 0.9, 0.05, col, x, 1.95, -0.43);
      const t = ctag(root, `${ic} ${nm}`, 2.6, 0.7); t.position.set(x, 3.3, -0.4); return { t, nm, ic };
    });
    const paint = (act, res) => stations.forEach((s, i) => s.t.userData.set(`${s.ic} ${s.nm}`, '#ffffff', ids[i] === act ? '#2f6fed' : res && res[ids[i]] ? 'rgba(47,158,106,.92)' : 'rgba(40,60,90,.88)'));
    const ttl = ctag(root, '🛒 AI 이커머스 운영 센터', 5.4, 0.9); ttl.position.set(0, 5.2, -0.5);
    cam.set([0, 5.5, 11.5], [0, 2.0, 2]); cam.fov(50, true);

    const abRun = (box, done) => mcq(box, [
      { sign: '🅰 배너 A: 노출 1,000회 · 클릭 50회\n🅱 배너 B: 노출 400회 · 클릭 28회', q: '클릭률(CTR = 클릭 ÷ 노출)이 더 높은 배너는?', opts: ['B (7%)', 'A (5%)', '둘 다 같다'], a: 0, why: 'A: 50÷1,000 = 5% · B: 28÷400 = 7%. 클릭 수가 아니라 노출 대비 비율로 비교해야 공정해요.' },
      { sign: '🅰 배너 A: 방문 2,000 · 클릭 160 · 구매 8건\n🅱 배너 B: 방문 2,000 · 클릭 100 · 구매 15건\n(구매 1건당 평균 3만 원)', q: '매출이 목적이라면 어떤 배너를 쓸까요?', opts: ['B: 구매가 더 많아 매출이 커요', 'A: 클릭이 더 많으니까', '클릭만 보면 충분해요'], a: 0, why: 'A 매출 8×3만 = 24만 원, B 15×3만 = 45만 원. 목표(매출)에 맞는 지표를 봐야 해요. 클릭이 많아도 구매로 이어지지 않으면 의미가 적어요.' },
      { sign: '🅰 새 배너 A: 노출 20회 · 클릭 6회 (30%)\n🅱 기존 배너 B: 노출 5,000회 · 클릭 300회 (6%)', q: '어떻게 결정할까요?', opts: ['A는 표본이 너무 적어요. 노출을 더 모아 다시 비교한다', 'A가 30%니까 바로 교체한다', 'B는 클릭률이 낮으니 바로 삭제한다'], a: 0, why: '20번 노출은 우연의 영향이 커요. 데이터가 충분히 쌓인 뒤에 판단하는 것이 A/B 테스트의 기본이에요.' },
      { sign: '고객 데이터: "러닝화" 상세 페이지를 보고 구매 없이 이탈했어요.', q: '3일 뒤 보낼 가장 효과적인 개인화 메시지는?', opts: ['본 러닝화와 비슷한 상품 추천 + 가격 인하·재입고 알림', '전혀 다른 카테고리의 광고', '모든 고객에게 같은 전체 공지'], a: 0, why: '고객의 행동 데이터를 활용한 개인화 추천은 이커머스의 핵심이에요.' },
    ], '① A/B 테스트·데이터 마케팅', (ok, n) => {
      const sc = Math.round((ok / n) * 100);
      result(box, sc, ['전자상거래전공 · 데이터 기반 마케팅', `${ok}/${n}문제 정답`, '💡 "무엇을 목표로 하는가"에 맞는 지표를 고르고, 데이터가 충분한지 확인하는 것이 데이터 마케터의 기본이에요.', '인터넷마케팅·e-조사방법론·빅데이터분석 수업과 연결돼요.'], done);
    });

    const erpRun = (box, done) => {
      const P = { R: 50, Q: 60 }; let play = null;
      const setup = () => {
        box.innerHTML = '';
        h('div', 'hd', '② 재고·발주 관리(ERP·SCM) — 21일 운영', box);
        h('div', 'sign', '🛒 인기 상품 1개 · 하루 판매량 평균 20개(±6)\n🚚 발주 후 입고까지 3일 · 시작 재고 80개\n💰 판매 1개 이익 3,000원 · 발주 1회 40,000원 · 재고 보관비 개당 60원/일\n📐 발주점 ≈ (하루 판매 × 입고 소요일) + 여유 재고', box);
        const ctl = (label, key, min, max, step) => {
          const r = h('div', 'row', '', box); h('span', '', label, r).style.minWidth = '150px';
          const m = h('button', '', '−', r), v = h('b', '', P[key] + '개', r), p = h('button', '', '＋', r);
          [[m, -step], [p, step]].forEach(([b, d]) => { b.onclick = () => { P[key] = clamp(P[key] + d, min, max); v.textContent = P[key] + '개'; }; });
        };
        ctl('발주점 (이하이면 주문)', 'R', 30, 130, 10); ctl('발주량 (1회 주문)', 'Q', 20, 160, 20);
        const row = h('div', 'row', '', box), go = h('button', 'pri', '▶ 21일 운영 시작', row); go.onclick = run;
      };
      const run = () => {
        const dem = Array.from({ length: 21 }, () => 14 + Math.floor(Math.random() * 13)); let stock = 80, pipe = [], lost = 0, sold = 0, orders = 0, hs = 0; const log = [];
        dem.forEach((x, d) => {
          pipe = pipe.filter((o) => { if (o.d === d) { stock += o.q; return false; } return true; });
          const s = Math.min(stock, x); stock -= s; sold += s; lost += x - s;
          if (stock + pipe.reduce((a, o) => a + o.q, 0) <= P.R) { pipe.push({ d: d + 3, q: P.Q }); orders++; }
          hs += stock; log.push({ stock, lost, orders, inb: pipe.reduce((a, o) => a + o.q, 0), x });
        });
        const profit = sold * 3000 - orders * 40000 - hs * 60, total = dem.reduce((a, b) => a + b, 0), sc = Math.round(clamp(((profit - 300000) / 740000) * 100, 0, 100));
        box.innerHTML = ''; h('div', 'hd', '📅 운영 중…', box);
        const st = h('div', 'sign', '', box), bar = h('div', 'bar', '<i></i>', box).firstChild; bar.style.width = '0%';
        play = { i: 0, t: 0, log, st, bar, fin() {
          result(box, sc, ['전자상거래전공 · 재고·발주(ERP·SCM)', `발주점 ${P.R}개 · 발주량 ${P.Q}개 → 판매 충족률 ${Math.round((sold / total) * 100)}% · 품절 ${lost}개 · 발주 ${orders}회 · 평균 재고 ${(hs / 21).toFixed(0)}개`, `이익 ${fmtW(profit)}`, '💡 발주점이 낮으면 품절로 판매를 놓치고, 너무 높으면 재고 비용이 늘어요. 데이터로 균형점을 찾는 것이 ERP·SCM의 핵심이에요.', '전자상거래시스템구축·의사결정론·ERP·CRM·SCM 학습과 연결돼요.'], done);
        } };
      };
      setup();
      return {
        tick(dt) {
          if (!play) return; play.t += dt; if (play.t < 0.3) return; play.t = 0;
          const L = play.log[play.i];
          play.st.innerHTML = `📅 ${play.i + 1} / 21일 · 오늘 주문 ${L.x}개<br>📦 재고 <b>${L.stock}</b>개 · 🚚 입고예정 ${L.inb}개<br>❌ 누적 품절 <b>${L.lost}</b>개 · 🧾 발주 ${L.orders}회`;
          play.bar.style.width = clamp((L.stock / 150) * 100, 0, 100) + '%'; play.i++;
          if (play.i >= play.log.length) { const f = play.fin; play = null; setTimeout(f, 700); }
        },
        dispose() { play = null; },
      };
    };

    const fdsRun = (box, done) => {
      const mark = {}, list = shuffle(ORD.slice());
      h('div', 'hd', '③ 결제 보안(이상거래 탐지) — 사기가 의심되는 주문을 모두 눌러 선택해요', box);
      const ol = h('div', 'opts', '', box);
      list.forEach((o) => { const b = h('button', 'opt', o.t, ol); b.onclick = () => { mark[o.id] = !mark[o.id]; b.classList.toggle('no', !!mark[o.id]); }; });
      h('div', 'fb', '빨간색으로 표시된 주문이 "의심 신고" 대상이에요.', box);
      const row = h('div', 'row', '', box), sb = h('button', 'pri', '🚨 의심 신고하고 결과 보기', row);
      sb.onclick = () => {
        const right = ORD.filter((o) => !!mark[o.id] === o.bad).length, sc = Math.round((right / ORD.length) * 100);
        result(box, sc, ['전자상거래전공 · 결제 보안(이상거래 탐지)', `${right} / ${ORD.length}건을 정확히 분류했어요`, ...ORD.map((o) => `${o.id}. ${o.bad ? '⚠ 의심 거래' : '✅ 정상 거래'} — ${o.why}`), '💡 금액·IP·배송지·시도 횟수·계정 나이 같은 신호를 조합해 판단해요. 전자거래 및 보안서비스 학습과 연결돼요.'], done);
      };
    };

    const crmRun = (box, done) => mcq(box, [
      { sign: '고객 데이터: 가입 3일 · 구매 이력 0회 · 상품 조회 8회', q: '이 고객에게 가장 알맞은 CRM 메시지는?', opts: ['첫 구매 10% 웰컴 쿠폰', 'VIP 전용 감사 선물', '"그동안 그리웠어요" 복귀 쿠폰'], a: 0, why: '구매 경험이 없는 신규 고객은 첫 구매 장벽을 낮추는 웰컴 혜택이 효과적이에요.' },
      { sign: '고객 데이터: 최근 한 달 구매 12회 · 누적 구매 180만 원', q: '이 고객에게 가장 알맞은 CRM 메시지는?', opts: ['VIP 감사 혜택 + 신상품 우선 안내', '첫 구매 10% 웰컴 쿠폰', '대폭 할인 쿠폰 남발'], a: 0, why: '충성 고객에게는 할인보다 특별 대우와 정보 우선 제공으로 관계를 깊게 하는 것이 좋아요.' },
      { sign: '고객 데이터: 예전엔 월 2회 구매 · 최근 90일 구매 없음', q: '이 고객은 어떤 상태이고, 어떤 메시지가 알맞을까요?', opts: ['이탈 위험 → 관심 상품 리마인드 + 맞춤 복귀 쿠폰', '신규 고객 → 웰컴 쿠폰', '충성 고객 → 아무 연락도 하지 않는다'], a: 0, why: '구매 주기가 끊긴 고객은 이탈 위험군이에요. 개인 취향에 맞춘 메시지로 다시 불러와요.' },
      { sign: '고객 데이터: 장바구니에 상품 3개를 담고 24시간째 결제하지 않음', q: '가장 알맞은 메시지는?', opts: ['"장바구니에 담아 둔 상품이 기다려요" 알림 (재고 임박 안내)', '전혀 상관없는 신상품 광고', '아무 조치도 하지 않는다'], a: 0, why: '장바구니 이탈 알림은 전환율을 높이는 대표적인 CRM 기법이에요.' },
      { sign: '고객 데이터: 어제 첫 상품을 받았고 아직 후기를 남기지 않음', q: '가장 알맞은 메시지는?', opts: ['후기 작성 시 적립금 지급 안내', '환불 절차 안내', '같은 상품 재구매 강요'], a: 0, why: '구매 직후의 고객에게 후기를 요청하면 다른 고객의 구매 결정에도 도움이 되고 관계도 깊어져요.' },
    ], '④ 고객관리(CRM) — 상황에 맞는 메시지', (ok, n) => {
      const sc = Math.round((ok / n) * 100);
      result(box, sc, ['전자상거래전공 · 고객관계관리(CRM)', `${ok}/${n}문제 정답`, '💡 고객을 신규·충성·이탈 위험 등으로 나누고, 상황에 맞는 메시지를 보내는 것이 CRM이에요.', '고객관계관리론·모바일비즈니스·빅데이터분석 수업과 연결돼요.'], done);
    });

    return hub(c, {
      title: '🛒 AI 이커머스 운영 센터', sub: '네 파트를 모두 체험하면 종합 결과가 나와요 (순서 자유)',
      career: '전자상거래전공은 인터넷마케팅·e-조사방법론·데이터베이스시스템·고객관계관리론·빅데이터분석·전자상거래시스템구축 같은 수업으로 AI·IT와 ERP·CRM·SCM을 배워요. 11번가·GS리테일 같은 이커머스·유통 기업, 금융기관, IT·데이터 분야로 진출해요.',
      parts: [
        { id: 'ab', icon: '🛍️', name: 'A/B 테스트·데이터 마케팅', desc: '올바른 지표로 배너·메시지 비교', run: abRun },
        { id: 'erp', icon: '📦', name: '재고·발주 관리(ERP)', desc: '발주점·발주량을 정해 21일 운영', run: erpRun },
        { id: 'fds', icon: '🛡️', name: '결제 보안(이상거래 탐지)', desc: '의심 주문 6건 중 사기 거래 찾기', run: fdsRun },
        { id: 'crm', icon: '💬', name: '고객관리(CRM)', desc: '고객 상황별 알맞은 메시지 선택', run: crmRun },
      ],
      onHome: (res) => paint(null, res), onOpen: (id) => paint(id, null),
    });
  },
});