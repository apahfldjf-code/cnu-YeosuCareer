/* ═══════════════════════════════════════════════════════════════
 * src/exp-cul3.js (신규, E3-3 · 문화사회과학대학 3/3)
 *   mmd : 문화콘텐츠학부 멀티미디어전공 → 🎥 촬영(샷·앵글) · ✂️ 편집(구성·비트 컷) · 💻 제작 기초(용량·프레임·색)
 *   ctm : 문화관광경영학과           → 🗺️ 관광 코스 설계 · 🏛️ 컨벤션(MICE) 룸 배정 · 📊 관광 데이터 · 🎤 문화관광 해설
 *
 * 필요: experience.js, exp-cul1.js (ctag, culOverlay, h, mix)
 * 모든 조작은 화면 버튼·슬라이더예요(키보드 불필요 → 모바일 그대로 동작).
 * 'mmd' 는 exp-pilot.js 의 시험용 체험을 덮어써요(나중에 import 한 것이 우선).
 * 시간·비용·정원 숫자는 학습용 "게임 가정값"이에요(실제 요금과 다를 수 있어요).
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { ctag, culOverlay, h, mix } from './exp-cul1.js';

const ENV = (sky, ground = '#8c97a8') => ({ sky, fog: [sky, 40, 130], sunColor: '#ffffff', sunI: 1.4, hemi: ['#eef4ff', ground, 0.95], sunPos: [20, 40, 25] });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmtW = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const MAN = (n) => n.toLocaleString('ko-KR') + '만원';
const fm = (m) => `${Math.floor(m / 60)}시간 ${m % 60}분`;
const clearG = (g) => { [...g.children].forEach((m) => { g.remove(m); if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); };

/* ───────────── 공용: 객관식 · 결과 화면 · 단계 안내 · 파트 허브 (exp-cul2.js 와 같은 방식) ───────────── */
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

/* ═══════════════════════════════════════════════════════════════
 * 1. 문화콘텐츠학부 멀티미디어전공 — 🎬 멀티미디어 콘텐츠 스튜디오
 * ═══════════════════════════════════════════════════════════════ */
const SZ = { close: '클로즈업(얼굴)', bust: '바스트샷(가슴 위)', full: '풀샷(전신)', long: '롱샷(멀리서 본 전경)' };
const AN = { low: '로우앵글(아래→위)', eye: '아이레벨(눈높이)', high: '하이앵글(위→아래)' };
const sizeOf = (d) => (d < 1.0 ? 'close' : d < 2.4 ? 'bust' : d < 5.5 ? 'full' : 'long');
const angOf = (e) => (e < -8 ? 'low' : e <= 12 ? 'eye' : 'high');
const BRIEFS = [
  { t: '🎞 장면 1 — 주인공의 눈물 한 방울. 관객이 감정에 푹 빠지게 해 주세요.', size: ['close', ['bust']], ang: ['eye', []], why: '감정(표정)을 보여 줄 땐 클로즈업이 기본이고, 눈높이 앵글이면 인물에게 자연스럽게 공감하게 돼요.' },
  { t: '🎞 장면 2 — 거대한 악당이 등장! 위압감이 느껴지게 찍어 주세요.', size: ['full', ['bust']], ang: ['low', []], why: '아래에서 올려 찍는 로우앵글은 인물을 크고 강해 보이게 해요.' },
  { t: '🎞 장면 3 — 여수 밤바다 앞에 홀로 선 주인공. 쓸쓸하고 작게 느껴지게!', size: ['long', ['full']], ang: ['high', ['eye']], why: '멀리서(롱샷) 위에서 내려다보면(하이앵글) 인물이 작고 외로워 보여요.' },
  { t: '🎞 장면 4 — 관광 안내 인터뷰. 편안하고 믿음직하게 상반신 위주로!', size: ['bust', ['close', 'full']], ang: ['eye', []], why: '인터뷰는 가슴 위 바스트샷 + 눈높이 앵글이 정석이에요.' },
  { t: '🎞 장면 5 — 관광지를 걸어가는 모습. 전신과 걸음걸이가 모두 보이게!', size: ['full', ['long']], ang: ['eye', []], why: '동작 전체를 보여 줄 땐 풀샷이 알맞아요.' },
  { t: '🎞 장면 6 — 길을 잃고 막막해하는 인물. 약하고 작아 보이게!', size: ['full', ['long', 'bust']], ang: ['high', []], why: '하이앵글은 인물을 작고 약해 보이게 만들어요.' },
];
const STORY = [
  ['🔥 "여수 밤바다, 지금 아니면 후회!" 자막 + 불꽃 하이라이트 3초 예고', '훅(관심 끌기)'],
  ['🌅 해 질 녘 오동도·돌산대교 드론 풍경', '장소 소개(도입)'],
  ['🚢 유람선 · 🍤 먹거리 체험 장면 모음', '체험(전개)'],
  ['🎤 관광객 인터뷰 "또 오고 싶어요!"', '감정·후기'],
  ['🎆 낭만포차 · 불꽃 풀 영상', '클라이맥스'],
  ['🔖 로고 + 문의처 + QR 엔딩 카드', '엔딩(행동 유도)'],
];

registerExperience('mmd', {
  icon: '🎬', title: '멀티미디어 콘텐츠 스튜디오',
  desc: '여수 관광 홍보 영상 제작팀이 되어 촬영(샷·앵글) → 편집(구성·비트 컷) → 제작 기초(용량·프레임·색)를 직접 체험해요.',
  tools: ['🎥 카메라 샷·앵글 조절', '✂️ 타임라인 컷 편집', '💻 용량·프레임 계산'],
  steps: ['🎥 거리·각도 슬라이더로 장면 의도에 맞는 샷을 찍어요', '✂️ 영상 구성 순서를 맞추고 음악 박자에 맞춰 컷을 잘라요', '💻 영상 용량·프레임·색을 계산하는 제작 기초 퀴즈', '세 파트를 모두 마치면 종합 결과가 나와요 (순서 자유)'],
  env: ENV('#ddd6f3', '#9a94b3'),
  build(c) {
    const { root, cam, ui } = c, SX = -7, ids = ['shot', 'cut', 'dev'];
    c.ground('#e2def0', 42, -0.5); c.box(26, 0.3, 16, '#f4f2fa', 0, -0.15, 3);

    /* 촬영 세트 (밤바다 배경) */
    c.box(8, 0.1, 8, '#4a4f68', SX, -0.04, 0.5);
    const gBack = new THREE.Group(); root.add(gBack);
    c.box(11, 6, 0.2, '#1b2a52', SX, 3, -3.4, gBack);
    const moon = c.sph(0.7, '#fff3c8', SX + 2.6, 4.6, -3.2, gBack); moon.material.emissive = new THREE.Color('#fff3c8'); moon.material.emissiveIntensity = 0.9;
    c.box(11, 1.2, 0.25, '#2f5f9a', SX, 0.6, -3.25, gBack);
    c.cyl(0.25, 0.4, 2.2, '#e9e9ef', SX - 3.2, 1.6, -3.1, gBack); c.cyl(0.3, 0.3, 0.5, '#d6453d', SX - 3.2, 2.9, -3.1, gBack);
    [-3.2, 3.2].forEach((dx) => { c.cyl(0.05, 0.05, 2.4, '#222', SX + dx, 1.2, 1.6); const l = c.box(0.7, 0.5, 0.15, '#fff5c0', SX + dx, 2.5, 1.6); l.material.emissive = new THREE.Color('#ffe9a0'); l.material.emissiveIntensity = 0.6; });
    c.avatar(SX, 0, 0);
    const gCam = new THREE.Group(); root.add(gCam);
    [[-0.3, 0.3], [0.3, 0.3], [0, -0.3]].forEach(([dx, dz]) => c.cyl(0.03, 0.03, 1.4, '#222', SX + dx, 0.7, 6 + dz, gCam));
    c.box(0.6, 0.38, 0.4, '#222', SX, 1.55, 6, gCam); const lens = c.cyl(0.15, 0.15, 0.35, '#555', SX, 1.55, 5.65, gCam); lens.rotation.x = Math.PI / 2;

    /* 편집 스튜디오 */
    const gEdit = new THREE.Group(); root.add(gEdit);
    c.box(5, 0.8, 1.6, '#5a4b8a', 0, 0.4, 0, gEdit);
    [-1.3, 1.3].forEach((x) => { c.box(1.7, 1.0, 0.08, '#101624', x, 1.6, -0.45, gEdit); c.box(1.5, 0.8, 0.05, x < 0 ? '#6a4bd8' : '#2f8f80', x, 1.6, -0.4, gEdit); });
    ['#e04a5a', '#f2b705', '#2f8f80', '#6a4bd8', '#e08a2f'].forEach((col, i) => c.box(0.7, 0.05, 0.28, col, -1.8 + i * 0.9, 0.83, 0.35, gEdit));
    const ph = c.box(0.05, 0.14, 0.55, '#ff3d3d', -1.9, 0.9, 0.35, gEdit);

    /* 제작(코딩) 스튜디오 */
    const gCode = new THREE.Group(); root.add(gCode);
    c.box(3.2, 0.8, 1.6, '#2f8f80', 7, 0.4, 0, gCode);
    c.box(1.5, 0.06, 0.95, '#c9ced8', 7, 0.83, 0.15, gCode);
    const scr = c.box(1.5, 0.95, 0.06, '#101624', 7, 1.35, -0.35, gCode); scr.rotation.x = -0.18;
    const glow = c.box(1.34, 0.8, 0.04, '#23c18b', 7, 1.35, -0.32, gCode); glow.rotation.x = -0.18; glow.material.emissive = new THREE.Color('#23c18b'); glow.material.emissiveIntensity = 0.5;
    c.box(0.45, 0.12, 0.25, '#e04a5a', 8.2, 0.86, 0.3, gCode);

    const defs = [['🎥', '촬영(샷·앵글)', SX, 4.6, 0.5], ['✂️', '편집(구성·비트)', 0, 3.3, -0.3], ['💻', '제작 기초', 7, 3.3, -0.3]];
    const stations = defs.map(([ic, nm, x, y, z]) => { const t = ctag(root, `${ic} ${nm}`, 2.8, 0.7); t.position.set(x, y, z); return { t, nm, ic }; });
    const paint = (act, res) => stations.forEach((s, i) => s.t.userData.set(`${s.ic} ${s.nm}`, '#ffffff', ids[i] === act ? '#2f6fed' : res && res[ids[i]] ? 'rgba(47,158,106,.92)' : 'rgba(40,60,90,.88)'));
    const ttl = ctag(root, '🎬 멀티미디어 콘텐츠 스튜디오', 5.6, 0.9); ttl.position.set(0, 6.2, -0.5);
    cam.set([0, 5.5, 15.5], [0, 1.7, 1.2]); cam.fov(50, true);

    /* 카메라 연출: 피사체(SX,·,0)를 보며 거리 d · 각도 a(도) 로 이동 */
    const shotCam = (d, a) => {
      const ty = clamp(1.7 - 0.2 * d, 0.9, 1.6), y = Math.max(0.15, ty + d * Math.sin((a * Math.PI) / 180)), z = d * Math.cos((a * Math.PI) / 180);
      cam.set([SX, y, z], [SX, ty, 0]); return { el: (Math.atan2(y - ty, z) * 180) / Math.PI };
    };
    const setMode = (m) => {
      const sh = m === 'shot'; gEdit.visible = gCode.visible = gCam.visible = !sh; stations.forEach((s) => { s.t.visible = !sh; }); ttl.visible = !sh;
      if (sh) { cam.fov(38, true); shotCam(5, 5); } else { cam.fov(50, true); cam.set([0, 5.5, 15.5], [0, 1.7, 1.2]); }
    };

    /* ① 촬영 */
    const shotRun = (box, done) => {
      const Q = shuffle(BRIEFS.slice()).slice(0, 4), st = { d: 5, a: 5 }; let i = 0, sum = 0; const notes = [];
      const show = () => {
        box.innerHTML = ''; let cur = null;
        h('div', 'hd', `① 촬영 감독 · 장면 ${i + 1} / ${Q.length}`, box);
        h('div', 'sign', Q[i].t + '\n슬라이더로 카메라의 거리·각도를 바꾸면 3D 화면이 실제 카메라 화면이에요. 준비되면 📸 촬영!', box);
        const info = h('div', 'fb', '', box);
        const mk = (label, min, max, stp, key) => {
          const r = h('div', 'row', '', box); h('span', '', label, r).style.minWidth = '78px';
          const s = h('input', '', '', r); s.type = 'range'; s.min = min; s.max = max; s.step = stp; s.value = st[key]; s.style.flex = '1';
          s.oninput = () => { st[key] = +s.value; upd(); }; return s;
        };
        const s1 = mk('📏 거리', 0.6, 16, 0.1, 'd'), s2 = mk('📐 각도', -30, 60, 1, 'a');
        const upd = () => { const r = shotCam(st.d, st.a); cur = { size: sizeOf(st.d), ang: angOf(r.el) }; info.textContent = `📷 샷 크기: ${SZ[cur.size]}\n📐 앵글: ${AN[cur.ang]} (${Math.round(r.el)}°)`; };
        const row = h('div', 'row', '', box), sb = h('button', 'pri', '📸 촬영!', row);
        sb.onclick = () => {
          [s1, s2].forEach((s) => { s.disabled = true; }); sb.disabled = true; ui.flash(); c.sfx.click();
          const b = Q[i], sP = cur.size === b.size[0] ? 50 : b.size[1].includes(cur.size) ? 30 : 0, aP = cur.ang === b.ang[0] ? 50 : b.ang[1].includes(cur.ang) ? 30 : 0, sc = sP + aP;
          sum += sc; notes.push(`장면 ${i + 1}: ${SZ[cur.size].split('(')[0]} + ${AN[cur.ang].split('(')[0]} → ${sc}점`);
          h('div', 'fb', `${sc >= 80 ? '⭕ 훌륭한 샷!' : sc >= 50 ? '🙂 괜찮지만 아쉬워요.' : '❌ 의도와 달라요.'} (${sc}점)\n추천 샷: ${SZ[b.size[0]]} + ${AN[b.ang[0]]}\n${b.why}`, box);
          const r2 = h('div', 'row', '', box), nx = h('button', 'pri', i + 1 < Q.length ? '다음 장면 ▶' : '결과 보기 ▶', r2);
          nx.onclick = () => {
            if (++i < Q.length) { show(); return; }
            const score = Math.round(sum / Q.length);
            result(box, score, ['영상콘텐츠 · 촬영 연출(샷·앵글)', `${Q.length}개 장면 평균 ${score}점`, ...notes, '💡 같은 인물도 거리(샷 크기)와 각도(앵글)에 따라 전혀 다른 감정을 전해요. 촬영 감독은 장면의 의도에 맞게 카메라를 선택해요.', '영상프로덕션테크닉·영상콘텐츠스토리텔링·멀티미디어영상기획 같은 수업과 연결돼요.'], done);
          };
        };
        upd();
      };
      show();
    };

    /* ② 편집 */
    const cutRun = (box, done) => {
      const BPM = 96, BEAT = 60 / BPM, LEN = BEAT * 16, TG = [4, 8, 12].map((k) => k * BEAT), state = { tick: null };
      const order = shuffle(STORY.map((_, i) => i)); let nxt = 0, miss = 0, msg = '';
      const rhythm = (sA) => {
        box.innerHTML = ''; let t = 0, on = false, fin = false, lastB = -1; const cuts = [];
        h('div', 'hd', '② 비트 컷 편집 — 4마디(약 10초) 영상을 3번 잘라요', box);
        h('div', 'sign', `🎵 BPM ${BPM} · 4박 = 1마디(굵은 노란 선)\n컷 포인트: 마디가 바뀌는 굵은 선 가운데 3곳에서 ✂ 컷!\n박자에서 벗어난 컷은 영상이 어색해 보여요.`, box);
        const tl = h('div', '', '', box); tl.style.cssText = 'position:relative;height:46px;border-radius:8px;background:#1b2433;margin:10px 0;overflow:hidden';
        for (let k = 0; k <= 16; k++) { const d = document.createElement('div'), big = k % 4 === 0; d.style.cssText = `position:absolute;left:${(k / 16) * 100}%;top:${big ? 4 : 15}px;bottom:${big ? 4 : 15}px;width:${big ? 3 : 1}px;background:${big ? '#ffd24a' : '#5b6a85'}`; tl.append(d); }
        const phd = document.createElement('div'); phd.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:3px;background:#ff4d4d;box-shadow:0 0 6px #ff4d4d'; tl.append(phd);
        const st = h('div', 'fb', '▶ 재생 시작을 누르면 빨간 선이 움직여요', box);
        const row = h('div', 'row', '', box), go = h('button', 'pri', '▶ 재생 시작', row), ct = h('button', 'pri', '✂ 컷!', row); ct.disabled = true;
        const finish = () => {
          if (fin) return; fin = true; on = false; state.tick = null; ct.disabled = true;
          const used = [], info = cuts.map((x) => {
            let bi = -1, bd = 99; TG.forEach((g, i) => { if (!used.includes(i) && Math.abs(x - g) < bd) { bd = Math.abs(x - g); bi = i; } }); used.push(bi);
            const e = x - TG[bi], a = Math.abs(e); return { i: bi, e, p: a <= 0.12 ? 100 : a <= 0.25 ? 75 : a <= 0.4 ? 40 : 0 };
          }).sort((a, b) => a.i - b.i);
          const sB = Math.round(TG.map((_, i) => { const f = info.find((x) => x.i === i); return f ? f.p : 0; }).reduce((a, b) => a + b, 0) / 3), sc = Math.round(sA * 0.4 + sB * 0.6);
          result(box, sc, ['영상콘텐츠 · 편집(구성·비트 컷)', `구성 순서 ${sA}점 · 비트 컷 ${sB}점`, ...info.map((x) => `컷 ${x.i + 1}: ${Math.abs(x.e) < 0.03 ? '정확!' : x.e > 0 ? '늦게' : '빠르게'} ${Math.abs(x.e).toFixed(2)}초 → ${x.p}점`), ...(info.length < 3 ? [`컷을 ${3 - info.length}번 놓쳤어요`] : []), '💡 훅-도입-전개-후기-클라이맥스-엔딩 구성과 음악 박자에 맞춘 컷이 보는 사람의 몰입을 만들어요.', '영상애니메이션기초·영상콘텐츠디자인·영상처리실습 같은 수업과 연결돼요.'], done);
        };
        const cut = () => {
          if (!on || cuts.length >= 3) return; cuts.push(t);
          const m = document.createElement('div'); m.style.cssText = `position:absolute;left:${(t / LEN) * 100}%;top:0;bottom:0;width:3px;background:#3fd17a`; tl.append(m);
          st.textContent = `✂ 컷 ${cuts.length} / 3`; c.sfx.click(); if (cuts.length >= 3) setTimeout(finish, 350);
        };
        ct.onpointerdown = (e) => { e.preventDefault(); cut(); };
        go.onclick = () => {
          if (on) return; on = true; t = 0; go.disabled = true; ct.disabled = false; st.textContent = '재생 중… 박자를 느끼며 ✂ 컷!';
          state.tick = (dt) => {
            if (!on) return; t += dt; phd.style.left = Math.min(100, (t / LEN) * 100) + '%';
            const b = Math.floor(t / BEAT); if (b !== lastB) { lastB = b; phd.style.background = b % 4 === 0 ? '#ffd24a' : '#ff4d4d'; }
            if (t >= LEN) finish();
          };
        };
      };
      const draw = () => {
        box.innerHTML = '';
        h('div', 'hd', '① 영상 구성 — 홍보 영상의 컷을 알맞은 순서로 눌러요', box);
        h('div', 'sign', '📐 숏폼 홍보 영상 구성 공식\n훅(관심 끌기) → 장소 소개 → 체험 → 후기 → 클라이맥스 → 엔딩(행동 유도)', box);
        h('div', 'fb', nxt ? STORY.slice(0, nxt).map((s, i) => `${i + 1}. ${s[1]} — ${s[0]}`).join('\n') : '(여기에 완성된 타임라인이 쌓여요)', box);
        const ol = h('div', 'opts', '', box);
        order.filter((i) => i >= nxt).forEach((i) => {
          const b = h('button', 'opt', STORY[i][0], ol);
          b.onclick = () => {
            if (i === nxt) { nxt++; msg = ''; if (nxt === STORY.length) { const sA = clamp(100 - miss * 12, 20, 100); step(box, `✅ 타임라인 완성! (실수 ${miss}번 · ${sA}점)\n이제 음악 박자에 맞춰 컷을 잘라 볼까요?`, '② 비트 컷 편집 ▶', () => rhythm(sA)); return; } }
            else { miss++; msg = `⛔ "${STORY[i][1]}" 컷은 지금 넣을 차례가 아니에요. 구성 공식을 다시 확인해요.`; }
            draw();
          };
        });
        if (msg) h('div', 'fb', msg, box);
      };
      draw();
      return { tick(dt) { if (state.tick) state.tick(dt); }, dispose() { state.tick = null; } };
    };

    /* ③ 제작 기초 */
    const devRun = (box, done) => mcq(box, [
      { q: 'FHD(1920×1080) 사진 한 장을 압축하지 않고 저장해요. 한 픽셀에 RGB 3바이트가 필요하다면 용량은 대략?', opts: ['약 6MB', '약 600KB', '약 60MB', '약 2MB'], a: 0, why: '1920×1080 = 2,073,600픽셀 × 3바이트 = 6,220,800바이트 ≈ 6MB. 그래서 JPEG 같은 압축이 필요해요.' },
      { q: '위 크기의 영상(압축 없음)을 1초에 30장(30fps)으로 저장하면 1초 분량은?', opts: ['약 187MB', '약 6MB', '약 18MB', '약 1.9GB'], a: 0, why: '6.22MB × 30장 ≈ 187MB. 그래서 영상은 H.264 같은 코덱으로 압축해서 저장하고 전송해요.' },
      { q: '4Mbps(초당 4메가비트)로 스트리밍되는 80초 영상의 데이터량은?', opts: ['40MB', '320MB', '4MB', '80MB'], a: 0, why: '4Mb × 80초 = 320Mb(메가비트). 8비트 = 1바이트이므로 ÷ 8 = 40MB예요.' },
      { sign: '게임 화면을 60fps로 보여 주려고 해요.', q: '한 프레임을 그리는 데 쓸 수 있는 시간은 최대 약?', opts: ['16.7ms', '60ms', '1.67ms', '100ms'], a: 0, why: '1초 ÷ 60 ≈ 0.0167초 = 16.7ms. 이보다 오래 걸리면 화면이 끊겨 보여요.' },
      { q: '모니터·스마트폰 화면은 빛을 섞어 색을 만들어요. 빨간 빛과 초록 빛을 같은 세기로 섞으면?', opts: ['노란색', '보라색', '흰색', '검은색'], a: 0, why: '화면은 RGB 가산혼합이에요. R+G = 노랑, R+B = 자홍, G+B = 청록, R+G+B = 흰색. 인쇄는 CMYK(감산혼합)를 써요.' },
      { sign: '웹사이트를 스마트폰·태블릿·PC에서 모두 보기 좋게 만들고 싶어요.', q: '화면 크기에 맞춰 레이아웃이 자동으로 바뀌는 방식은?', opts: ['반응형 웹', '고정폭 웹', '이미지 맵', '정적 PDF'], a: 0, why: '반응형 웹은 하나의 사이트가 화면 너비에 맞춰 배치를 바꿔요. 웹·앱 콘텐츠 제작의 기본이에요.' },
    ], '③ 디지털 콘텐츠 제작 기초', (ok, n) => {
      const sc = Math.round((ok / n) * 100);
      result(box, sc, ['멀티미디어 제작 기초 · 용량·프레임·색', `${ok}/${n}문제 정답`, '💡 해상도·프레임·비트레이트·색 표현을 이해해야 영상·웹·게임 콘텐츠를 가볍고 선명하게 만들 수 있어요.', '멀티미디어프로그래밍및실습·게임기획및분석·웹클라이언트구현및실습·멀티미디어데이터처리및실습 같은 수업과 연결돼요.'], done);
    });

    return hub(c, {
      title: '🎬 멀티미디어 콘텐츠 스튜디오', sub: '세 파트를 모두 체험하면 종합 결과가 나와요 (순서 자유)',
      career: '멀티미디어전공은 영상콘텐츠 인재양성(영화·방송·뉴미디어 기획·제작)과 멀티미디어 콘텐츠 인재양성(웹·앱·게임 프로그래밍)으로 나뉘어요. 콘텐츠 기업, 영상프로덕션·방송, IT·게임·모바일 서비스 개발, 공기업·전산직 공무원, 대학원 등으로 진출해요. (문화콘텐츠학부는 입학 후 2개 학기 수료 뒤 멀티미디어/전자상거래 전공을 선택해요.)',
      parts: [
        { id: 'shot', icon: '🎥', name: '촬영(샷·앵글)', desc: '거리·각도로 장면 의도를 표현', run: shotRun },
        { id: 'cut', icon: '✂️', name: '편집(구성·비트 컷)', desc: '영상 구성 순서 + 박자에 맞춘 컷', run: cutRun },
        { id: 'dev', icon: '💻', name: '제작 기초', desc: '용량·프레임·색·반응형 웹', run: devRun },
      ],
      onHome: (res) => { setMode('over'); paint(null, res); }, onOpen: (id) => { setMode(id === 'shot' ? 'shot' : 'over'); paint(id, null); },
      tick: (dt, t) => { ph.position.x = -1.9 + ((t * 0.5) % 3.8); },
    });
  },
});

/* ═══════════════════════════════════════════════════════════════
 * 2. 문화관광경영학과 — 🎡 여수 관광·MICE 기획 센터
 * ═══════════════════════════════════════════════════════════════ */
/* 약식 지도 좌표(x 동, y 북 / 1칸 ≈ 2km) · 시간·비용은 게임 가정값 */
const SP = [
  { id: 'sq', n: '이순신광장·낭만포차', s: '광장', ic: '🌃', x: 0.2, y: 0.1, min: 60, cost: 25000, tags: ['food', 'night', 'culture'] },
  { id: 'mk', n: '여수수산시장', s: '시장', ic: '🐟', x: 0.9, y: 0.9, min: 60, cost: 30000, tags: ['food'] },
  { id: 'mu', n: '고소동 벽화마을', s: '벽화', ic: '🎨', x: -0.2, y: -0.5, min: 50, cost: 0, tags: ['culture', 'photo'] },
  { id: 'cc', n: '여수 해상케이블카', s: '케이블카', ic: '🚠', x: 0.3, y: -0.9, min: 60, cost: 20000, tags: ['view', 'sea', 'kids', 'night'] },
  { id: 'ds', n: '돌산공원', s: '돌산공원', ic: '🌉', x: 1.6, y: -1.7, min: 40, cost: 0, tags: ['view', 'night', 'photo'] },
  { id: 'ex', n: '엑스포 해양공원', s: '엑스포', ic: '🎡', x: 2.1, y: 0.1, min: 80, cost: 15000, tags: ['kids', 'sea', 'night'] },
  { id: 'aq', n: '아쿠아플라넷 여수', s: '아쿠아', ic: '🐠', x: 2.35, y: 0.35, min: 120, cost: 35000, tags: ['kids', 'indoor'] },
  { id: 'od', n: '오동도', s: '오동도', ic: '🌺', x: 2.9, y: -0.55, min: 90, cost: 2000, tags: ['sea', 'walk', 'kids', 'photo'] },
  { id: 'mj', n: '만성리 검은모래해변', s: '만성리', ic: '🏖️', x: 4.3, y: 2.3, min: 60, cost: 0, tags: ['sea', 'photo'] },
  { id: 'hy', n: '향일암', s: '향일암', ic: '🛕', x: 3.6, y: -9.8, min: 90, cost: 3000, tags: ['culture', 'view', 'sea'] },
];
const TI = { food: '🍽️', night: '🌙', culture: '🏛️', photo: '📸', view: '🌅', sea: '🌊', kids: '🧒', indoor: '🏠', walk: '🚶' };
const TCOL = { food: '#e08a2f', night: '#6a4bd8', culture: '#c0453d', view: '#2f8f80', sea: '#2f6fed', kids: '#f2b705' };
const START = [0.5, 0.0];
const PROF = [
  { ic: '👨‍👩‍👧', n: '가족 여행 (초등학생 자녀 동반)', lim: 400, bud: 65000, req: [['kids', 2, '아이와 즐길 곳 2곳 이상'], ['food', 1, '식사(먹거리) 1곳 이상'], ['sea', 1, '바다를 느낄 곳 1곳 이상']], fav: ['kids', 'sea', 'indoor', 'food'] },
  { ic: '🧑‍🤝‍🧑', n: '청년 친구들 (야경·SNS 사진)', lim: 360, bud: 55000, req: [['night', 2, '야경 명소 2곳 이상'], ['photo', 2, '사진 명소 2곳 이상'], ['food', 1, '식사(먹거리) 1곳 이상'], ['view', 1, '전망 명소 1곳 이상']], fav: ['night', 'photo', 'view', 'food'] },
  { ic: '🌏', n: '외국인 개별 여행객 (문화 체험)', lim: 450, bud: 75000, req: [['culture', 2, '문화·역사 장소 2곳 이상'], ['food', 1, '현지 음식 1곳 이상'], ['view', 1, '전망 명소 1곳 이상'], ['photo', 1, '사진 명소 1곳 이상']], fav: ['culture', 'photo', 'view', 'food'] },
];
const trav = (a, b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 2 * 2.4 + 5);

const ROOMS = [{ id: 'A', n: '대강당', cap: 300, cost: 400 }, { id: 'B', n: '중강당', cap: 150, cost: 250 }, { id: 'C', n: '세미나실', cap: 120, cost: 200 }, { id: 'D', n: '소회의실', cap: 60, cost: 100 }];
const safe = (r) => Math.floor(r.cap * 0.9);
const perms = (a, n) => (n === 0 ? [[]] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)], n - 1).map((p) => [x, ...p])));
const cheapest = (p) => { const k = ROOMS.filter((r) => p <= safe(r)).map((r) => r.cost); return k.length ? Math.min(...k) : Infinity; };
const optCost = (S) => {
  let tot = 0; S.filter((s) => s.slot !== 2).forEach((s) => { tot += cheapest(s.p); });
  const sl = S.filter((s) => s.slot === 2); let b = Infinity;
  perms(ROOMS, sl.length).forEach((pm) => { if (pm.every((r, i) => sl[i].p <= safe(r))) b = Math.min(b, pm.reduce((a, r) => a + r.cost, 0)); });
  return tot + b;
};
const genSessions = () => {
  for (let k = 0; k < 60; k++) {
    const S = [{ k: 'k', n: '개막 기조강연', slot: 1, p: rint(190, 255) }, { k: 'a', n: '분과 ① 지역 관광 정책', slot: 2, p: rint(100, 135) }, { k: 'b', n: '분과 ② 관광 데이터', slot: 2, p: rint(65, 106) }, { k: 'c', n: '분과 ③ 크루즈·해양관광', slot: 2, p: rint(28, 52) }, { k: 'n', n: '폐회 네트워킹', slot: 3, p: rint(120, 260) }];
    if (isFinite(optCost(S))) return S;
  }
  return [{ k: 'k', n: '개막 기조강연', slot: 1, p: 220 }, { k: 'a', n: '분과 ① 지역 관광 정책', slot: 2, p: 120 }, { k: 'b', n: '분과 ② 관광 데이터', slot: 2, p: 90 }, { k: 'c', n: '분과 ③ 크루즈·해양관광', slot: 2, p: 40 }, { k: 'n', n: '폐회 네트워킹', slot: 3, p: 200 }];
};

registerExperience('ctm', {
  icon: '🎡', title: '여수 관광·MICE 기획 센터',
  desc: '여수시 관광 기획자가 되어 관광 코스 설계 · 컨벤션(MICE) 회의실 배정 · 관광 데이터 분석 · 문화관광 해설을 직접 해 봐요.',
  tools: ['🗺️ 3D 여수 지도', '🏛️ 컨벤션 룸 배정표', '📊 관광 통계', '🎤 해설 시나리오'],
  steps: ['🗺️ 여행자 조건에 맞는 하루 코스를 지도에 그려요', '🏛️ 세션별 회의실을 정해 안전과 비용을 모두 맞춰요', '📊 방문객·소비·손익분기 데이터를 읽고 판단해요', '🎤 외국인·어린이·돌발 상황별 해설과 응대를 골라요', '네 파트를 모두 마치면 종합 결과가 나와요 (순서 자유)'],
  env: ENV('#cfe9f6', '#9ec7a0'),
  build(c) {
    const { root, cam } = c, ids = ['course', 'conv', 'data', 'guide'];
    const W = (x, y) => [(x - 1.8) * 1.15, -y * 0.95], S0 = W(START[0], START[1]);
    c.ground('#d9ecd6', 42, -0.5);
    c.box(12, 0.5, 18, '#7a5a3c', 0.5, -0.3, 3.6); c.box(10, 0.1, 16, '#5bb0dc', 0.5, 0, 3.6);
    [[0.8, 0.3, 2.1], [0.2, -0.5, 1.4], [2.1, 0.1, 1.2], [2.9, -0.55, 0.55], [1.8, -2.2, 1.0], [2.4, -4.2, 0.9], [2.9, -6.2, 0.85], [3.3, -8.2, 0.85], [3.6, -9.8, 0.8], [4.3, 2.3, 0.9]].forEach(([x, y, r]) => { const [X, Z] = W(x, y); c.cyl(r, r, 0.3, '#9bcf86', X, 0.1, Z); });
    const pins = {};
    SP.forEach((s, k) => {
      const [X, Z] = W(s.x, s.y); c.cyl(0.05, 0.05, 0.7, '#444', X, 0.65, Z);
      pins[s.id] = c.sph(0.2, TCOL[s.tags[0]] || '#888', X, 1.1, Z);
      const t = ctag(root, s.s, 1.2, 0.4); t.position.set(X, 1.75 + (k % 2) * 0.45, Z);
    });
    c.cyl(0.05, 0.05, 0.7, '#222', S0[0], 0.65, S0[1]); c.sph(0.22, '#222', S0[0], 1.1, S0[1]); const st0 = ctag(root, '🏨 출발', 1.2, 0.4); st0.position.set(S0[0], 1.75, S0[1]);
    const routeG = new THREE.Group(); root.add(routeG);
    const setRoute = (sel) => {
      clearG(routeG);
      SP.forEach((s) => { const on = sel.includes(s.id), m = pins[s.id]; m.material.emissive = new THREE.Color(on ? '#ff4d6d' : '#000000'); m.material.emissiveIntensity = on ? 0.7 : 0; m.scale.setScalar(on ? 1.5 : 1); });
      let prev = S0;
      sel.forEach((id) => {
        const s = SP.find((q) => q.id === id), b = W(s.x, s.y), dx = b[0] - prev[0], dz = b[1] - prev[1], len = Math.hypot(dx, dz);
        if (len > 0.01) { const m = c.box(0.14, 0.05, len, '#ff4d6d', (prev[0] + b[0]) / 2, 0.32, (prev[1] + b[1]) / 2, routeG); m.rotation.y = Math.atan2(dx, dz); }
        prev = b;
      });
    };

    /* 컨벤션 홀 · 데이터 · 해설 세트 */
    const halls = {};
    [['A', -9.7, -0.2, 3.0, 1.0, 2.0], ['B', -7.2, 0.0, 2.0, 0.9, 1.6], ['C', -9.7, 2.2, 1.6, 0.8, 1.4], ['D', -7.4, 2.2, 1.1, 0.7, 1.0]].forEach(([id, x, z, w, hh, d]) => { halls[id] = c.box(w, hh, d, '#9aa3b5', x, hh / 2, z); });
    const hallPaint = (used) => ROOMS.forEach((r) => halls[r.id].material.color.set(used && used.has(r.id) ? '#4cc38a' : '#9aa3b5'));
    c.box(5, 0.15, 2, '#2c3550', 8.5, 0.07, 3);
    const bars = [0.8, 1.3, 1.0, 2.0, 1.6, 2.6].map((v, i) => ({ v, m: c.box(0.5, v, 0.5, ['#2f8f80', '#e08a2f', '#6a4bd8', '#c0453d', '#2f6fed', '#f2b705'][i], 6.8 + i * 0.7, v / 2 + 0.15, 3) }));
    const guide = c.avatar(8.5, 7, 0); c.cyl(0.04, 0.04, 2.4, '#ddd', 9.4, 1.2, 7); c.box(0.9, 0.5, 0.04, '#e08a2f', 9.85, 2.2, 7);

    const defs = [['🗺️', '관광 코스 설계', '#2f8f80', 0.5, 3.6, -3.4], ['🏛️', '컨벤션 운영', '#6a4bd8', -8.5, 3.4, 1], ['📊', '관광 데이터', '#c0453d', 8.5, 3.6, 3], ['🎤', '문화관광 해설', '#e08a2f', 8.5, 3.9, 7]];
    const stations = defs.map(([ic, nm, , x, y, z]) => { const t = ctag(root, `${ic} ${nm}`, 2.8, 0.7); t.position.set(x, y, z); return { t, nm, ic }; });
    const paint = (act, res) => stations.forEach((s, i) => s.t.userData.set(`${s.ic} ${s.nm}`, '#ffffff', ids[i] === act ? '#2f6fed' : res && res[ids[i]] ? 'rgba(47,158,106,.92)' : 'rgba(40,60,90,.88)'));
    const ttl = ctag(root, '🎡 여수 관광·MICE 기획 센터', 5.8, 0.9); ttl.position.set(0.5, 5.6, -3.4);
    const camOver = () => { cam.set([0.5, 10.5, 20], [0.5, 0.5, 3.5]); cam.fov(50, true); }, camMap = () => { cam.set([3.0, 13.5, 12.5], [3.0, 0, 3.5]); cam.fov(50, true); };
    camOver();

    /* ① 관광 코스 설계 */
    const courseRun = (box, done) => {
      const P = pick(PROF), sel = [];
      h('div', 'hd', '① 관광 상품 개발 — 하루 코스 설계', box);
      h('div', 'sign', `${P.ic} ${P.n}\n⏱ 이동 포함 ${P.lim / 60}시간 이내 (여수 시내 숙소에서 출발)\n💰 1인 비용 ${fmtW(P.bud)} 이내\n✅ ${P.req.map((r) => r[2]).join(' · ')}\n📌 코스는 4~5곳이 가장 알맞아요\n${Object.entries(TI).map(([k, v]) => v + ({ food: '먹거리', night: '야경', culture: '문화', photo: '사진', view: '전망', sea: '바다', kids: '아이', indoor: '실내', walk: '산책' })[k]).join(' ')}\n※ 시간·비용은 게임용 가정값이에요. 지도의 분홍 선이 이동 경로예요.`, box);
      const g = h('div', 'grid', '', box), mine = h('div', '', '', box);
      const calc = () => {
        const L = sel.map((id) => SP.find((s) => s.id === id)); let t = 0, cost = 0, prev = START;
        L.forEach((s) => { t += trav(prev, [s.x, s.y]) + s.min; cost += s.cost; prev = [s.x, s.y]; });
        const rq = P.req.map(([tg, n, lab]) => ({ lab, ok: L.filter((s) => s.tags.includes(tg)).length >= n }));
        const n = L.length, rf = rq.filter((r) => r.ok).length / P.req.length, ts = t <= P.lim ? 1 : Math.max(0, 1 - (t - P.lim) / 90), bs = cost <= P.bud ? 1 : Math.max(0, 1 - (cost - P.bud) / 25000);
        const pace = n === 4 || n === 5 ? 1 : n === 3 || n === 6 ? 0.7 : 0.3, fit = n ? L.filter((s) => s.tags.some((q) => P.fav.includes(q))).length / n : 0;
        return { L, t, cost, rq, n, sc: Math.round(100 * (0.35 * rf + 0.2 * ts + 0.15 * bs + 0.15 * pace + 0.15 * fit)) };
      };
      const refresh = () => {
        mine.innerHTML = ''; setRoute(sel); const r = calc();
        h('div', 'hd', `내 코스 (${sel.length}곳)`, mine);
        if (!sel.length) h('div', 'fb', '위 카드를 눌러 코스에 담아요. 담은 순서대로 방문해요.', mine);
        sel.forEach((id, i) => {
          const s = SP.find((q) => q.id === id), row = h('div', 'row', '', mine); h('span', '', `${i + 1}. ${s.ic} ${s.n}`, row).style.flex = '1';
          const up = h('button', '', '↑', row), dn = h('button', '', '↓', row), rm = h('button', '', '✕', row);
          up.onclick = () => { if (i > 0) { [sel[i - 1], sel[i]] = [sel[i], sel[i - 1]]; cardSync(); refresh(); } };
          dn.onclick = () => { if (i < sel.length - 1) { [sel[i + 1], sel[i]] = [sel[i], sel[i + 1]]; cardSync(); refresh(); } };
          rm.onclick = () => { sel.splice(i, 1); cardSync(); refresh(); };
        });
        if (sel.length) h('div', 'fb', `⏱ ${fm(r.t)} / 한도 ${P.lim / 60}시간 ${r.t <= P.lim ? '✅' : '⚠ 초과'}\n💰 ${fmtW(r.cost)} / 예산 ${fmtW(P.bud)} ${r.cost <= P.bud ? '✅' : '⚠ 초과'}\n${r.rq.map((q) => `${q.ok ? '✅' : '⬜'} ${q.lab}`).join('\n')}`, mine);
        const row = h('div', 'row', '', mine), sb = h('button', 'pri', '✔ 코스 확정하고 평가받기', row); sb.disabled = sel.length < 2;
        sb.onclick = () => {
          setRoute(sel); const q = calc();
          result(box, q.sc, ['관광경영 · 관광 상품 개발(코스 설계)', `${P.n}: ${q.n}곳 · 이동 포함 ${fm(q.t)} (한도 ${P.lim / 60}시간) · ${fmtW(q.cost)} (예산 ${fmtW(P.bud)})`, ...q.rq.map((x) => `${x.ok ? '✅' : '❌'} ${x.lab}`), '💡 좋은 관광 상품은 고객의 조건(시간·예산·취향)에 맞고, 이동 동선까지 무리 없이 짜여 있어요. 너무 적거나 너무 빡빡한 일정도 만족도를 떨어뜨려요.', '관광자원론·관광마케팅·도시관광론·관광시장조사론 같은 수업과 연결돼요.'], done);
        };
      };
      const cards = {}, cardSync = () => SP.forEach((s) => cards[s.id].classList.toggle('dn', sel.includes(s.id)));
      SP.forEach((s) => {
        const b = h('button', 'card', `<b>${s.ic} ${s.n}</b><br><small>${s.min}분 · ${s.cost ? fmtW(s.cost) : '무료'}<br>${s.tags.map((t) => TI[t]).join(' ')}</small>`, g); cards[s.id] = b;
        b.onclick = () => { const k = sel.indexOf(s.id); if (k >= 0) sel.splice(k, 1); else if (sel.length < 7) sel.push(s.id); cardSync(); refresh(); };
      });
      refresh();
      return { dispose() { setRoute([]); } };
    };

    /* ② 컨벤션 룸 배정 */
    const convRun = (box, done) => {
      const S = genSessions(), opt = optCost(S), asg = {}, SL = { 1: '🕘 오전 · 개막', 2: '🕑 오후 · 동시 진행 (서로 다른 방)', 3: '🕔 저녁' };
      h('div', 'hd', '② MICE 운영 — 컨벤션 회의실 배정', box);
      h('div', 'sign', `여수 해양관광 컨퍼런스! 세션마다 회의실을 하나씩 정해요.\n규칙 ① 정원의 90% 이하 인원만(안전 여유)\n규칙 ② 같은 시간대 세션은 서로 다른 방\n규칙 ③ 대관 비용은 낮을수록 좋아요\n${ROOMS.map((r) => `${r.id} ${r.n} ${r.cap}석(안전 ${safe(r)}명) · ${MAN(r.cost)}`).join('\n')}`, box);
      const btns = {}, wns = {};
      [1, 2, 3].forEach((sl) => {
        h('div', 'hd', SL[sl], box);
        S.filter((s) => s.slot === sl).forEach((s) => {
          h('div', 'q', `${s.n} — 예상 ${s.p}명`, box);
          const row = h('div', 'row', '', box); btns[s.k] = {};
          ROOMS.forEach((r) => { const b = h('button', 'opt', `${r.id} ${r.n}`, row); btns[s.k][r.id] = b; b.onclick = () => { asg[s.k] = r.id; refresh(); }; });
          wns[s.k] = h('div', 'fb', '', box);
        });
      });
      const tot = h('div', 'fb', '', box), row = h('div', 'row', '', box), sb = h('button', 'pri', '✔ 배정 확정', row);
      const problems = () => {
        const bad = {};
        S.forEach((s) => { const r = ROOMS.find((q) => q.id === asg[s.k]); if (r && s.p > safe(r)) bad[s.k] = `⚠ 안전 정원(${safe(r)}명) 초과`; });
        S.filter((s) => s.slot === 2).forEach((s) => { if (asg[s.k] && S.some((o) => o !== s && o.slot === 2 && asg[o.k] === asg[s.k])) bad[s.k] = (bad[s.k] ? bad[s.k] + ' · ' : '') + '⚠ 같은 시간대에 같은 방'; });
        return bad;
      };
      const refresh = () => {
        const bad = problems(); let cost = 0; const used = new Set();
        S.forEach((s) => {
          ROOMS.forEach((r) => btns[s.k][r.id].classList.toggle('ok', asg[s.k] === r.id));
          const r = ROOMS.find((q) => q.id === asg[s.k]); if (r) { cost += r.cost; used.add(r.id); }
          wns[s.k].textContent = bad[s.k] || (asg[s.k] ? '✅ 배정됨' : '');
        });
        hallPaint(used); const all = S.every((s) => asg[s.k]);
        tot.textContent = `💰 현재 대관 비용 ${MAN(cost)} · 배정 ${Object.keys(asg).length} / ${S.length}`; sb.disabled = !all;
      };
      sb.onclick = () => {
        const bad = problems(), cost = S.reduce((a, s) => a + ROOMS.find((q) => q.id === asg[s.k]).cost, 0), nb = Object.keys(bad).length;
        const sc = nb ? Math.round((40 * (S.length - nb)) / S.length) : Math.round(clamp((100 * opt) / cost, 0, 100));
        result(box, sc, ['MICE 운영 · 컨벤션 룸 배정', nb ? `규칙 위반 ${nb}건 — 안전과 일정 규칙을 먼저 지켜야 해요` : `규칙을 모두 지켰어요 · 비용 ${MAN(cost)} (가장 저렴한 배정 ${MAN(opt)})`, ...S.map((s) => `${s.n}(${s.p}명) → ${asg[s.k]} ${ROOMS.find((q) => q.id === asg[s.k]).n}${bad[s.k] ? ' ' + bad[s.k] : ''}`), '💡 행사 기획은 ①안전(정원) ②일정(동시 진행) ③비용을 한꺼번에 맞추는 일이에요. 방이 크다고 좋은 게 아니라, 참가 인원에 알맞은 방을 고르는 것이 비용을 아끼는 열쇠예요.', 'MICE산업론·이벤트컨벤션마케팅·컨벤션기획실무론·지역사회와축제경영 같은 수업과 연결돼요.'], (s2, n) => { hallPaint(null); done(s2, n); });
      };
      refresh();
      return { dispose() { hallPaint(null); } };
    };

    /* ③ 관광 데이터 */
    const dataRun = (box, done) => mcq(box, [
      { sign: '월별 방문객(만 명)\n1월 38 · 4월 82 · 5월 95 · 8월 141 · 11월 57 · 12월 44', q: '성수기 쏠림을 줄이려 비수기 프로모션을 가장 먼저 집중할 달은?', opts: ['1월', '8월', '5월', '4월'], a: 0, why: '방문객이 가장 적은 1월이 비수기 해소의 우선 대상이에요. 겨울에도 즐길 콘텐츠(예: 동백·겨울 바다 상품)를 만들면 연중 수요를 고르게 할 수 있어요.' },
      { sign: '한 해 방문객 20만 명 · 총 관광 수입 300억 원', q: '관광객 1인당 평균 소비(객단가)는?', opts: ['150,000원', '15,000원', '1,500,000원', '66,667원'], a: 0, why: '300억 원 ÷ 20만 명 = 150,000원. 객단가는 관광 수입을 방문객 수로 나눠요.' },
      { sign: '만족도 설문 500명 중 "다시 방문하겠다" 350명', q: '재방문 의사 비율은?', opts: ['70%', '35%', '7%', '85%'], a: 0, why: '350 ÷ 500 = 0.7 → 70%. 재방문율은 관광지 충성도를 보여 주는 핵심 지표예요.' },
      { sign: '축제 만족도를 알아보려고 "토요일 낮, 한 해수욕장에서 20대 100명"에게만 설문했어요.', q: '이 조사의 문제와 개선 방법은?', opts: ['특정 요일·장소·연령에 치우친 표본 편향 → 요일·시간·연령대를 고르게 표본 추출', '표본이 100명이면 항상 정확하다', '20대만 보면 전체를 알 수 있다', '문제 없다'], a: 0, why: '표본이 모집단을 고르게 대표해야 해요. 한쪽에 치우치면 결과를 일반화할 수 없어요(관광시장조사론의 기본).' },
      { sign: '축제 고정비 6,000만 원 · 입장료 15,000원 · 1인당 변동비(식음·기념품 원가) 5,000원', q: '손익분기점 방문객 수는?', opts: ['6,000명', '4,000명', '12,000명', '3,000명'], a: 0, why: '1인당 남는 돈 = 15,000 − 5,000 = 10,000원. 6,000만 원 ÷ 10,000원 = 6,000명부터 이익이 나요(관광회계와재무관리).' },
      { sign: 'A안: 방문객 100만 명 × 1인 관광 소비 5만 원\nB안: 방문객 60만 명 × 1인 관광 소비 10만 원', q: '총 관광 소비가 더 큰 안은?', opts: ['B안 (600억 원)', 'A안 (500억 원)', '같다'], a: 0, why: 'A: 100만 × 5만 = 500억 원, B: 60만 × 10만 = 600억 원. 방문객 수뿐 아니라 1인당 소비를 높이는 전략도 중요해요.' },
    ], '③ 관광 데이터 분석', (ok, n) => {
      const sc = Math.round((ok / n) * 100);
      result(box, sc, ['문화관광경영 · 관광 데이터 분석', `${ok}/${n}문제 정답`, '💡 관광 기획은 통계를 읽고 객단가·재방문율·손익분기점으로 판단하는 일이에요.', '관광시장조사론·관광데이터분석·관광경제론·관광회계와재무관리 같은 수업과 연결돼요.'], done);
    });

    /* ④ 문화관광 해설 */
    const guideRun = (box, done) => mcq(box, [
      { sign: '외국인 관광객 6명이 이순신광장 앞에서 "여기는 어떤 곳이에요?" 하고 물어요. (한국 역사는 잘 몰라요)', q: '가장 좋은 첫 설명은?', opts: ['"조선 수군 사령부인 전라좌수영이 있던 도시예요. 지금은 밤바다를 보며 걷는 광장이에요." 처럼 핵심 한두 문장 + 질문 받기', '연도·관직 이름을 외운 대로 길게 설명', '"인터넷에서 찾아보세요"', '아주 빠르게 모든 역사를 한 번에 설명'], a: 0, why: '낯선 방문객에게는 쉬운 말로 핵심 이야기를 짧게 전하고, 궁금한 점을 물어보게 하는 것이 해설의 기본이에요.' },
      { sign: '초등학생 아이들과 오동도 동백숲을 걷는 중이에요.', q: '아이들 눈높이에 맞는 해설은?', opts: ['"빨간 동백꽃이 몇 송이인지 세어 볼까? 바닥에 떨어진 꽃도 찾아봐!" 처럼 질문·놀이를 섞어 설명', '식물학 용어로 꽃의 구조를 길게 강의', '떠들지 않게 조용히 하라고 안내', '해설 없이 사진만 찍게 한다'], a: 0, why: '대상의 눈높이에 맞춘 체험형 해설이 집중력과 기억을 높여요.' },
      { sign: '해상케이블카가 강풍 때문에 갑자기 운행을 멈췄어요. 대기 중인 관광객이 불만스러워 해요.', q: '가장 알맞은 대응은?', opts: ['상황과 이유를 정확히 안내하고 사과 → 대체 일정(다른 코스·차량 이동)과 환불·재운행 정보를 함께 제시', '"저는 모르는 일이에요" 하고 자리를 피한다', '재개 시간을 모르는데도 곧 된다고 말한다', '불만 고객을 무시한다'], a: 0, why: '안전이 우선이라는 설명, 정확한 정보, 선택 가능한 대안 제시가 서비스 회복의 기본이에요.' },
      { sign: '주말 저녁 낭만포차거리에 사람이 몰려 보행이 위험할 만큼 혼잡해요.', q: '지속가능한 관광을 위한 해결책은?', opts: ['시간대별 방문 분산 안내(이른 저녁·평일 혜택), 주변 야경 명소로 동선 분산, 안전요원 배치', '더 많은 홍보로 방문객을 계속 늘린다', '아무 조치 없이 지켜본다', '방문을 전면 금지한다'], a: 0, why: '과밀(오버투어리즘)은 방문 시간·장소를 분산하고 안전을 관리하는 방식으로 줄여요.' },
      { sign: '무슬림 관광객이 식당을 찾고 있어요.', q: '가장 알맞은 안내는?', opts: ['돼지고기·알코올 사용 여부를 확인해 재료 정보를 알려 주고, 확인된 식당과 메뉴만 안내', '"다 같은 한식이니 괜찮아요"', '메뉴 질문을 받지 않는다', '아무 식당이나 데려간다'], a: 0, why: '종교·문화에 따른 식문화 차이를 존중하고 확인된 정보만 정확히 안내하는 것이 문화관광 서비스의 기본이에요.' },
    ], '④ 문화관광 해설·응대', (ok, n) => {
      const sc = Math.round((ok / n) * 100);
      result(box, sc, ['문화관광경영 · 문화관광 해설·응대', `${ok}/${n}문제 정답`, '💡 좋은 해설은 대상에 맞는 쉬운 말, 정확한 정보, 상대의 문화에 대한 존중에서 시작해요.', '문화관광해설론·관광영어·동아시아문화의이해·문화관광서비스경영 같은 수업과 연결돼요.'], done);
    });

    return hub(c, {
      title: '🎡 여수 관광·MICE 기획 센터', sub: '네 파트를 모두 체험하면 종합 결과가 나와요 (순서 자유)',
      career: '문화관광경영학과는 관광마케팅·관광전략경영론·도시관광론·컨벤션기획실무론·지역사회와축제경영·관광데이터분석 같은 수업으로 관광상품 개발·마케팅·전략·재무·회계 직무를 배워요. 관광공사·문화관광재단·지자체, 호텔·리조트·여행사·MICE 기업·항공사, 중앙·지방공무원, 로컬 문화관광 크리에이터·관광 스타트업 창업 등으로 진출해요. 여수시 MICE·해양관광에 특화된 학과예요.',
      parts: [
        { id: 'course', icon: '🗺️', name: '관광 코스 설계', desc: '여행자 조건에 맞는 하루 코스 짜기', run: courseRun },
        { id: 'conv', icon: '🏛️', name: '컨벤션(MICE) 운영', desc: '안전·일정·비용을 맞춘 회의실 배정', run: convRun },
        { id: 'data', icon: '📊', name: '관광 데이터 분석', desc: '객단가·재방문율·손익분기점', run: dataRun },
        { id: 'guide', icon: '🎤', name: '문화관광 해설·응대', desc: '대상·상황별 해설과 서비스 대응', run: guideRun },
      ],
      onHome: (res) => { camOver(); setRoute([]); hallPaint(null); paint(null, res); },
      onOpen: (id) => { if (id === 'course') camMap(); else camOver(); paint(id, null); },
      tick: (dt, t) => { bars.forEach((b, i) => { const k = 1 + 0.15 * Math.sin(t * 1.5 + i); b.m.scale.y = k; b.m.position.y = (b.v * k) / 2 + 0.15; }); if (guide.wave) guide.wave(t); },
    });
  },
});