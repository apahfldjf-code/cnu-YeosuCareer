/* ═══════════════════════════════════════════════════════════════
 * src/exp-cul1.js (신규, E3-1 · 문화사회과학대학 1/3) — 국제학부 언어회화 테스트 3종 + 공용 도구
 *   eng2 : 국제학부 영어학전공   jpn : 국제학부 일본학전공   chn : 국제학부 중국학전공
 *   4개 부스: 🎧 듣기 · 🎤 말하기 · 📄 텍스트(독해) · ✍️ 언어 정확도
 *
 * 공용 도구(export) — exp-cul2.js, exp-cul3.js 에서 가져다 써요
 *   ctag(parent, text, w, h) : 3D 글자 표지  /  culOverlay() : 화면 아래(가로 폰은 오른쪽) 패널
 *   h(tag, cls, html, parent) : DOM 만들기   /  mix(q) : 보기 순서 섞기  /  wrapTxt(s, n) : 줄바꿈
 *   speech : { say, stop, listen, sim, hasVoice, canListen }  (음성 합성·인식, 없으면 자동 대체)
 *
 * 필요: experience.js 만 (exp-kit.js, exp-eng*.js 는 쓰지 않아요)
 * 모든 조작은 화면 버튼·탭이에요. 키보드가 필요 없어서 모바일에서도 그대로 동작해요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { duck } from './audio.js';

/* ───────────────────────── 공용 도구 ───────────────────────── */
const FONT = '"Malgun Gothic","Yu Gothic","Microsoft YaHei","Noto Sans CJK KR",sans-serif';

/* 3D 글자 표지(항상 카메라를 향함). t.userData.set(글, 글자색, 배경색) */
export function ctag(parent, text = '', w = 3, hh = 0.8) {
  const W = 512, H = Math.max(64, Math.round((512 * hh) / w)), cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext('2d'); g.scale(2, 2); const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(w, hh, 1); sp.renderOrder = 20;
  sp.userData.set = (t, fg = '#ffffff', bg = 'rgba(40,60,90,.88)') => {
    g.clearRect(0, 0, W, H); g.fillStyle = bg; const r = Math.min(26, H / 3);
    g.beginPath(); g.moveTo(r, 4); g.arcTo(W - 4, 4, W - 4, H - 4, r); g.arcTo(W - 4, H - 4, 4, H - 4, r); g.arcTo(4, H - 4, 4, 4, r); g.arcTo(4, 4, W - 4, 4, r); g.closePath(); g.fill();
    const lines = String(t).split('\n'); let fs = Math.min(40, Math.floor((H - 24) / (lines.length * 1.3)));
    g.font = `bold ${fs}px ${FONT}`;
    while (fs > 11 && Math.max(...lines.map((s) => g.measureText(s).width)) > W - 36) { fs -= 2; g.font = `bold ${fs}px ${FONT}`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((s, i) => g.fillText(s, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.3));
    tex.needsUpdate = true;
  };
  sp.userData.set(text); parent.add(sp); return sp;
}
/* 줄바꿈: 공백 있는 말은 단어 단위, 없는 말(일본어·중국어)은 n글자 단위 */
export function wrapTxt(s, n = 20) {
  if (s.includes('\n')) return s;
  const out = [];
  if (s.includes(' ')) { let line = ''; s.split(' ').forEach((w) => { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }); if (line) out.push(line); }
  else for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.join('\n');
}
export const h = (tag, cls, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.append(e); return e; };
/* 보기(opts) 순서를 섞고 정답 번호 a 를 새 위치로 맞춰 줘요 */
export const mix = (q) => { const ix = shuffle(q.opts.map((_, i) => i)); return Object.assign({}, q, { opts: ix.map((i) => q.opts[i]), a: ix.indexOf(q.a) }); };

const CUL_CSS = `
.cul{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:min(96vw,760px);max-height:58vh;overflow-y:auto;z-index:2147483000;box-sizing:border-box;background:rgba(17,24,39,.95);color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 40px rgba(0,0,0,.45);font:15px/1.5 "Malgun Gothic","Noto Sans KR",system-ui,sans-serif;-webkit-overflow-scrolling:touch}
@media (max-height:520px){.cul{left:auto;right:8px;top:52px;bottom:8px;transform:none;width:min(56vw,500px);max-height:none;font-size:14px}}
.cul h3{margin:0 0 6px;font-size:17px}
.cul .hd{font-size:12px;color:#ffd24d;margin-bottom:4px}
.cul .q{font-size:18px;font-weight:700;margin:4px 0 8px;line-height:1.45;white-space:pre-wrap}
.cul .sign{background:#fffbe9;color:#1b2a41;border-radius:10px;padding:8px 12px;margin:4px 0 8px;font-size:15px;line-height:1.55;white-space:pre-wrap;font-weight:600}
.cul .opts{display:flex;flex-direction:column;gap:6px}
.cul .orow{display:flex;gap:6px}
.cul button{font:inherit;color:#fff;border:0;border-radius:10px;padding:9px 12px;background:#2c3a55;cursor:pointer;min-height:46px;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.cul button:hover{background:#3a4b6e}.cul button:active{transform:scale(.97)}
.cul .opt{flex:1;text-align:left}
.cul .spk{flex:none;width:46px;padding:0}
.cul .opt.ok{background:#2f9e6a}.cul .opt.no{background:#c0453d}
.cul .pri{background:#2f6fed;font-weight:700}.cul .pri:hover{background:#4a85ff}
.cul .fb{margin-top:8px;font-size:14px;color:#cfe3ff;white-space:pre-wrap}
.cul .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center}
.cul .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.cul .card{text-align:left;line-height:1.4;padding:10px 12px}
.cul .card.dn{background:#1f5f46}
.cul .bar{height:10px;border-radius:5px;background:rgba(255,255,255,.15);overflow:hidden;margin:2px 0 6px}
.cul .bar i{display:block;height:100%;background:linear-gradient(90deg,#3fd17a,#8be36a)}
.cul small{opacity:.85}
.cul .big{font-size:22px;font-weight:800;margin:4px 0}
.cul .mic{background:#c0453d;font-weight:700}
.cul .mic.on{background:#e8473d;animation:culp 1s infinite}
@keyframes culp{50%{opacity:.55}}`;
export function culOverlay() {
  if (!document.getElementById('cul-css')) { const s = document.createElement('style'); s.id = 'cul-css'; s.textContent = CUL_CSS; document.head.append(s); }
  const el = document.createElement('div'); el.className = 'cul';
  ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  document.body.append(el);
  return { el, clear() { el.innerHTML = ''; }, destroy() { el.remove(); } };
}

/* ── 음성: 합성(TTS)·인식(STT). 지원하지 않으면 호출하는 쪽이 글자·읽기 확인으로 대체해요 ── */
const SYN = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
const SRC = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const lc = (l) => String(l || '').toLowerCase().replace('_', '-');
const norm = (s) => String(s).toLowerCase().replace(/[\s.,!?'"。、！？，．・「」『』\-–—:;()（）]/g, '');
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
/* 소리가 나오지 않을 때 대본을 화면에 보여 줘요 */
function showScript(lines) {
  const old = document.getElementById('cq-script'); if (old) old.remove();
  const d = document.createElement('div'); d.id = 'cq-script';
  d.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);max-width:92vw;z-index:2147483600;background:rgba(20,30,50,.94);color:#fff;border:2px solid #ffd34d;border-radius:12px;padding:10px 14px;font:700 16px/1.6 "Malgun Gothic","Noto Sans KR",sans-serif;white-space:pre-line;text-align:center';
  d.textContent = '🔇 이 기기에서 소리가 나오지 않아 대본을 보여 드려요\n' + lines.join('\n');
  d.onclick = () => d.remove(); document.body.append(d); setTimeout(() => d.remove(), 15000);
}
export const speech = {
  sttDead: false, cur: null,
  canListen() { return !!SRC && !this.sttDead; },
  hasVoice(lang) {
    if (!SYN) return false; const vs = SYN.getVoices(); if (!vs.length) return true;
    const p = lc(lang).slice(0, 2); return vs.some((v) => lc(v.lang).startsWith(p));
  },
  say(lines, lang, o = {}) {
    if (!this.hasVoice(lang)) return false;
    try {
      SYN.cancel(); try { SYN.resume(); } catch (e) { /* 무시 */ }
      const arr = [].concat(lines), tk = (this._tk = (this._tk || 0) + 1); let started = false;
      setTimeout(() => {
        if (tk !== this._tk) return;
        const vs = SYN.getVoices(), p = lc(lang).slice(0, 2);
        const v = vs.find((x) => lc(x.lang) === lc(lang)) || vs.find((x) => lc(x.lang).startsWith(p));
        arr.forEach((t, i) => { const u = new SpeechSynthesisUtterance(t); u.lang = lang; if (v) u.voice = v; u.rate = o.rate || 0.88; u.pitch = i % 2 ? 0.8 : 1.1; u.volume = 1; u.onstart = () => { started = true; }; SYN.speak(u); });
      }, 120);
      duck(2 + arr.join('').length * 0.18);
      setTimeout(() => { if (tk === this._tk && !started) showScript(arr); }, 3000);
      return true;
    } catch (e) { return false; }
  },
  stop() { this._tk = (this._tk || 0) + 1; if (SYN) { try { SYN.cancel(); } catch (e) { /* 무시 */ } } if (this.cur) { try { this.cur.abort(); } catch (e) { /* 무시 */ } this.cur = null; } },
  /* cb({ok:true, alts:[...]}) 또는 cb({ok:false, fatal:true|false}) */
  listen(lang, cb) {
    if (!SRC) { cb({ ok: false, fatal: true }); return; }
    let fin = false, tm = 0;
    const end = (r) => { if (fin) return; fin = true; clearTimeout(tm); this.cur = null; cb(r); };
    let r; try { r = new SRC(); } catch (e) { this.sttDead = true; end({ ok: false, fatal: true }); return; }
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
    r.onresult = (e) => { const alts = []; for (let i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript); end({ ok: true, alts }); };
    r.onerror = (e) => { const fatal = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e.error); if (fatal) this.sttDead = true; end({ ok: false, fatal, err: e.error }); };
    r.onend = () => end({ ok: false, fatal: false, err: 'none' });
    tm = setTimeout(() => { try { r.abort(); } catch (e) { /* 무시 */ } end({ ok: false, fatal: false, err: 'timeout' }); }, 10000);
    this.cur = r; try { r.start(); } catch (e) { this.sttDead = true; end({ ok: false, fatal: true }); }
  },
  sim(a, b) { const x = norm(a), y = norm(b); if (!x || !y) return 0; return 1 - lev(x, y) / Math.max(x.length, y.length); },
};

/* ───────────────────────── 언어회화 테스트 공통 틀 ───────────────────────── */
function langTest(id, L) {
  const SEC = [
    { ic: '🎧', name: '듣기', desc: '안내방송·대화를 듣고 내용을 파악해요' },
    { ic: '🎤', name: '말하기', desc: '알맞은 대답을 고르고 직접 소리 내어 말해요' },
    { ic: '📄', name: '텍스트', desc: `${L.short} 안내문을 읽고 이해해요` },
    { ic: '✍️', name: '언어 정확도', desc: '문법·어휘를 정확하게 골라요' },
  ];
  registerExperience(id, {
    icon: L.icon, title: L.title, desc: L.desc,
    tools: ['🎧 듣기 부스(음성 합성)', '🎤 말하기(음성 인식)', '📄 안내문 독해', '✍️ 문법 정확도 보드'],
    steps: ['듣기·말하기·텍스트·언어 정확도 4개 부스를 원하는 순서로 골라요', '듣기: 소리를 듣고 내용을 고르고, 말하기: 알맞은 대답을 골라 직접 말해 봐요', '텍스트·정확도: 안내문을 읽고 문제를 풀어요 (모두 화면 버튼·탭으로 조작)', '4개를 모두 마치면 종합 결과와 학과 연결 정보를 확인해요'],
    env: L.env,
    build(c) {
      const { root, ui, cam } = c, sp = speech;
      const SX = [-12, -4, 4, 12], done = [null, null, null, null];
      let ov = null, alive = true, ended = false, talkT = 0, talkAt = 0, vid = 0;

      /* ── 3D 무대 ── */
      c.ground(L.ground, 60, -0.5); c.box(34, 0.5, 14, L.floor, 0, -0.25, 0);
      c.box(34, 7, 0.4, L.wall, 0, 3.5, -5.5); c.box(34, 0.7, 0.5, L.accent, 0, 0.35, -5.3);
      const ttl = ctag(root, '', 11, 1.4); ttl.position.set(0, 6.5, -5.1); ttl.userData.set(L.banner, '#ffffff', L.accent);
      const NM = SEC.map((s) => `${s.ic} ${s.name}`);
      const stT = SX.map((x) => { const t = ctag(root, '', 5.2, 0.95); t.position.set(x, 5.2, 0); return t; });
      const refTags = () => stT.forEach((t, i) => t.userData.set(`${NM[i]}${done[i] == null ? '' : ` ✅ ${done[i]}점`}`, '#ffffff', done[i] == null ? 'rgba(40,60,90,.88)' : 'rgba(30,130,75,.92)'));
      refTags();
      /* 0 듣기 부스: 책상·헤드셋·스피커·음파 */
      c.box(5, 0.9, 2.4, '#8b6b4a', SX[0], 0.45, 0.4);
      [-0.6, 0.6].forEach((dx) => { c.cyl(0.38, 0.38, 0.3, '#2b2f3a', SX[0] + dx, 1.2, 0.5).rotation.z = Math.PI / 2; });
      c.box(1.6, 0.12, 0.14, '#2b2f3a', SX[0], 1.62, 0.5);
      c.box(1.2, 2.0, 1.0, '#3a3f4a', SX[0] + 1.9, 1.9, -0.6); c.cyl(0.4, 0.4, 0.1, '#cfd5de', SX[0] + 1.9, 1.7, -0.08).rotation.x = Math.PI / 2;
      const waves = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: '#7fc4f2', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.position.set(SX[0] + 1.9, 1.7, 0.3); root.add(m); return m; });
      /* 1 말하기 부스: 카운터·손님(NPC)·마이크·말풍선 */
      c.box(5, 1.1, 1.6, L.accent, SX[1], 0.55, 1.4);
      c.cyl(0.08, 0.08, 0.9, '#cfd5de', SX[1] + 1.6, 1.55, 1.4); c.sph(0.2, '#2b2f3a', SX[1] + 1.6, 2.1, 1.4);
      const npc = new THREE.Group(); npc.position.set(SX[1], 0, -0.6); root.add(npc);
      c.box(1.2, 1.5, 0.7, L.npc, 0, 1.35, 0, npc); c.box(0.4, 0.9, 0.4, '#2b3a55', -0.3, 0.45, 0, npc); c.box(0.4, 0.9, 0.4, '#2b3a55', 0.3, 0.45, 0, npc);
      c.sph(0.42, '#f2c9a5', 0, 2.45, 0, npc); c.box(0.82, 0.3, 0.82, L.hair, 0, 2.78, 0, npc); c.box(0.3, 1.1, 0.3, L.npc, -0.8, 1.4, 0, npc);
      const arm = new THREE.Group(); arm.position.set(0.8, 1.9, 0); npc.add(arm); c.box(0.3, 1.1, 0.3, L.npc, 0, -0.5, 0, arm);
      const bub = ctag(root, '', 6.4, 1.8); bub.position.set(SX[1], 3.9, 0); bub.visible = false;
      /* 2 텍스트 부스: 안내판 */
      const R = L.read;
      c.box(5.4, 3.4, 0.2, '#6b4a2a', SX[2], 3.4, -0.4); c.cyl(0.12, 0.12, 2, '#6b4a2a', SX[2] - 2.2, 1, -0.4); c.cyl(0.12, 0.12, 2, '#6b4a2a', SX[2] + 2.2, 1, -0.4);
      const signT = ctag(root, '', 4.9, 3.0); signT.position.set(SX[2], 3.4, 0.1); signT.userData.set(R.lines.join('\n'), '#1b2a41', '#fffbe9');
      /* 3 정확도 부스: 화이트보드 */
      c.box(5.4, 3.0, 0.2, '#cfd5de', SX[3], 3.0, -0.4); c.box(4, 0.12, 0.3, '#8a93a3', SX[3], 1.4, -0.2);
      const boardT = ctag(root, '', 4.9, 2.5); boardT.position.set(SX[3], 3.0, 0.1); boardT.userData.set('✍️ 언어 정확도\n문법·어휘를\n정확하게 골라요', '#1b2a41', '#ffffff');
      const overview = () => cam.to([0, 7.5, 19], [0, 2.6, 0]);
      const focus = (i) => cam.to([SX[i] * 0.85, 4.6, 11], [SX[i], 2.4, 0]);
      cam.set([0, 7.5, 19], [0, 2.6, 0]); cam.fov(50, true);

      /* ── 소리 ── */
      const speakOut = (lines, at, rate) => { const arr = [].concat(lines); talkAt = at; talkT = 1.2 + arr.join('').length * (L.lang === 'en-US' ? 0.07 : 0.22); return sp.say(arr, L.lang, { rate }); };

      /* ── 문제 한 장 그리기: 보기 고르기 → 정답/해설 → 다음 ── */
      function choose(o) {
        const my = ++vid, live = () => my === vid && alive;
        ov.clear(); const b = ov.el;
        h('div', 'hd', o.head, b);
        if (o.sign) h('div', 'sign', o.sign, b);
        if (o.body) h('div', 'q', o.body, b);
        if (o.extra) o.extra(b, live);
        const list = h('div', 'opts', '', b), fb = h('div', 'fb', '', b), row = h('div', 'row', '', b), btns = []; let locked = false;
        o.opts.forEach((t, i) => {
          const r = h('div', 'orow', '', list), bt = h('button', 'opt', t, r); btns.push(bt);
          if (o.spk) { const s = h('button', 'spk', '🔈', r); s.onclick = () => o.spk(t); }
          bt.onclick = () => {
            if (locked) return; locked = true; const ok = i === o.a;
            bt.classList.add(ok ? 'ok' : 'no'); btns[o.a].classList.add('ok'); if (ok) c.sfx.ok(); else c.sfx.bump();
            fb.textContent = `${ok ? '⭕ 정답!' : '❌ 아쉬워요'} ${o.why || ''}`;
            const nx = h('button', 'pri', o.nextLabel || '다음 ▶', row); nx.onclick = () => { if (live()) o.next(ok); };
          };
        });
      }
      /* items 를 차례로 풀고 점수(0~1) 배열을 summary 로 넘겨요 */
      function seq(si, items, view) {
        const sc = []; let k = 0;
        const step = () => { if (!alive) return; if (k >= items.length) { summary(si, sc); return; } view(items[k], k, items.length, (s) => { sc.push(s); k++; step(); }); };
        step();
      }
      function summary(si, sc) {
        const pct = Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 100); done[si] = pct; refTags(); sp.stop(); bub.visible = false; c.sfx.ok();
        ov.clear(); const b = ov.el;
        h('h3', '', `${SEC[si].ic} ${SEC[si].name} 결과`, b); h('div', 'big', `${pct}점`, b);
        h('div', 'fb', sc.map((s, i) => `문제 ${i + 1}: ${s >= 0.99 ? '⭕' : s > 0.4 ? '🔺' : '❌'} ${Math.round(s * 100)}점`).join('\n'), b);
        const row = h('div', 'row', '', b), a = h('button', 'pri', '← 부스 선택으로', row); a.onclick = menu;
      }

      /* ── 1) 듣기 ── */
      const listenSec = () => seq(0, L.listen.map(mix), (q, k, n, next) => {
        let plays = 0, btnPlay = null; const voice = sp.hasVoice(L.lang);
        const play = () => { if (plays >= 3) { ui.pop('최대 3번까지 들을 수 있어요', null, '#ffe9a0'); return; } plays++; speakOut(q.lines, 0, 0.85); if (btnPlay) btnPlay.textContent = `🔊 다시 듣기 (${plays}/3)`; };
        choose({
          head: `🎧 듣기 ${k + 1}/${n}`, body: q.q,
          extra: (b, live) => {
            if (voice) { const r = h('div', 'row', '', b); btnPlay = h('button', 'pri', '🔊 듣기', r); btnPlay.onclick = play; setTimeout(() => { if (live()) play(); }, 450); }
            else { h('div', 'sign', q.lines.join('\n'), b); h('div', 'fb', `⚠ 이 기기에는 ${L.short} 음성이 없어 대본으로 대신해요. (Windows는 설정 → 시간 및 언어 → 음성에서 ${L.short} 음성을 추가할 수 있어요)`, b); }
          },
          opts: q.opts, a: q.a, why: `\n\n📝 대본\n${q.lines.join('\n')}\n→ ${q.tr}`,
          next: (ok) => next(ok ? 1 : 0),
        });
      });

      /* ── 2) 말하기: ① 알맞은 대답 고르기 → ② 소리 내어 말하기(음성 인식 있으면 일치도 평가) ── */
      function pronView(q, tgt, choice, next) {
        ov.clear(); const b = ov.el; let best = null, busy = false, nx = null;
        const pron = () => (best == null ? null : clamp((best - 0.3) / 0.5, 0, 1));
        const fin = (p) => next(p == null ? choice : 0.6 * choice + 0.4 * p);
        h('div', 'hd', '🎤 2단계 · 직접 말해 보기', b); h('div', 'q', `${tgt}\n<small>${q.mean}</small>`, b);
        const fb = h('div', 'fb', '', b), row = h('div', 'row', '', b);
        const hearB = h('button', '', '🔊 먼저 들어 보기', row); hearB.onclick = () => speakOut(tgt, 1, 0.8);
        const more = () => { if (nx) return; nx = h('button', 'pri', '다음 ▶', row); nx.onclick = () => fin(pron()); };
        const manual = () => { const m = h('button', 'pri', '✔ 소리 내어 읽었어요', row); m.onclick = () => fin(null); };
        if (sp.canListen()) {
          const mic = h('button', 'mic', '🎤 말하기', row);
          mic.onclick = () => {
            if (busy) return; sp.stop(); busy = true; mic.classList.add('on'); mic.textContent = '🎙 듣고 있어요… 말해 보세요';
            sp.listen(L.lang, (res) => {
              busy = false; if (!alive) return; mic.classList.remove('on'); mic.textContent = '🎤 다시 말하기';
              if (res.ok) {
                const s = Math.max(...res.alts.map((a) => sp.sim(a, tgt))); best = Math.max(best == null ? 0 : best, s);
                fb.textContent = `인식된 말: “${res.alts[0]}”\n일치도 ${Math.round(s * 100)}% ${s >= 0.8 ? '🎉 발음이 좋아요!' : s >= 0.55 ? '👍 거의 맞아요' : '🙂 천천히 한 번 더 말해 볼까요?'}`; more();
              } else if (res.fatal) { fb.textContent = '이 기기에서는 음성 인식을 쓸 수 없어요. 소리 내어 읽고 ✔ 를 눌러 주세요.'; mic.remove(); manual(); }
              else fb.textContent = '목소리가 잘 안 들렸어요. 마이크를 확인하고 다시 눌러 주세요.';
            });
          };
        } else manual();
        const sk = h('button', '', '건너뛰기', row); sk.onclick = () => fin(null);
      }
      const speakSec = () => seq(1, L.speak.map(mix), (q, k, n, next) => {
        const tgt = q.opts[q.a];
        const hear = () => { bub.visible = true; bub.userData.set(wrapTxt(q.line, L.wrapN), '#1b2a41', '#ffffff'); if (!speakOut(q.line, 1, 0.85)) ui.pop('음성이 없어 글자로 확인해요', null, '#ffe9a0'); };
        choose({
          head: `🎤 말하기 ${k + 1}/${n} · 1단계: 알맞은 대답 고르기`, body: `${q.ctx}\n💬 “${q.line}”\n<small>${q.ko}</small>`,
          extra: (b, live) => { const r = h('div', 'row', '', b), p = h('button', 'pri', '🔊 손님 말 듣기', r); p.onclick = hear; setTimeout(() => { if (live()) hear(); }, 450); },
          opts: q.opts, a: q.a, spk: (t) => speakOut(t, 1, 0.85), why: q.why, nextLabel: '2단계: 직접 말해 보기 ▶',
          next: (ok) => pronView(q, tgt, ok ? 1 : 0, next),
        });
      });

      /* ── 3) 텍스트(독해) ── */
      const readSec = () => seq(2, R.qs.map(mix), (q, k, n, next) => choose({ head: `📄 텍스트 ${k + 1}/${n} · ${R.title}`, sign: R.lines.join('\n'), body: q.q, opts: q.opts, a: q.a, why: q.why, next: (ok) => next(ok ? 1 : 0) }));

      /* ── 4) 언어 정확도 ── */
      const accSec = () => seq(3, L.acc.map(mix), (q, k, n, next) => {
        boardT.userData.set(wrapTxt(q.stem, 18), '#1b2a41', '#ffffff');
        choose({ head: `✍️ 언어 정확도 ${k + 1}/${n} · ${q.type}`, body: `${q.stem}\n<small>${q.ko}</small>`, opts: q.opts, a: q.a, why: q.why, next: (ok) => next(ok ? 1 : 0) });
      });

      /* ── 메뉴·종합 결과 ── */
      function run(i) { sp.stop(); focus(i); [listenSec, speakSec, readSec, accSec][i](); }
      function menu() {
        if (!ov || !alive) return; sp.stop(); bub.visible = false; overview(); ov.clear();
        h('h3', '', `${L.icon} ${L.short} 회화 테스트 · 부스를 골라 도전해요`, ov.el);
        const g = h('div', 'grid', '', ov.el);
        SEC.forEach((s, i) => { const bt = h('button', 'card' + (done[i] != null ? ' dn' : ''), `<b>${s.ic} ${s.name}</b><br><small>${s.desc}</small><br>${done[i] == null ? '⬜ 아직 안 했어요' : `✅ ${done[i]}점 (다시 도전 가능)`}`, g); bt.onclick = () => { c.sfx.click(); run(i); }; });
        h('div', 'fb', `🔊 음성 합성: ${sp.hasVoice(L.lang) ? '사용 가능' : '음성 없음 → 대본으로 대체'}  ·  🎤 음성 인식: ${sp.canListen() ? '사용 가능(마이크 허용 필요)' : '미지원 → 읽기 확인으로 대체'}`, ov.el);
        const row = h('div', 'row', '', ov.el);
        if (done.every((d) => d != null)) { const f = h('button', 'pri', '📊 종합 결과 보기', row); f.onclick = final; }
        else h('small', '', `${done.filter((d) => d != null).length}/4 완료 · 4개를 모두 마치면 종합 결과가 열려요`, row);
      }
      function final() {
        const avg = Math.round(done.reduce((a, b) => a + b, 0) / 4), w = done.indexOf(Math.min(...done));
        ov.clear(); const b = ov.el; sp.stop(); overview();
        h('h3', '', `${L.icon} ${L.short} 회화 테스트 종합 결과`, b);
        SEC.forEach((s, i) => { h('div', '', `${s.ic} ${s.name} <b>${done[i]}점</b>`, b); h('div', 'bar', `<i style="width:${done[i]}%"></i>`, b); });
        h('div', 'big', `종합 ${avg}점`, b);
        const tier = avg >= 90 ? '🏆 통번역가 후보 수준! 현장에서 바로 통할 만큼 정확해요.' : avg >= 70 ? '👍 의사소통이 아주 잘 돼요. 조금만 다듬으면 통번역 실무도 도전할 만해요.' : avg >= 50 ? '🙂 기본기는 충분해요. 학과에서 체계적으로 배우면 크게 늘어요.' : '🌱 지금부터 시작이에요! 입문 수업부터 차근차근 배울 수 있어요.';
        h('div', 'fb', `${tier}\n더 키우면 좋은 영역: 「${SEC[w].name}」\n${L.career}\n※ 체험용 간이 진단이며 공인 어학 점수가 아니에요.`, b);
        const row = h('div', 'row', '', b), ok = h('button', 'pri', '✔ 체험 완료', row);
        ok.onclick = () => { if (ended) return; ended = true; if (ov) { ov.destroy(); ov = null; } c.finish(avg); };
        const back = h('button', '', '← 부스로 돌아가기', row); back.onclick = menu;
      }

      return {
        start() { ui.hint(''); ov = culOverlay(); menu(); },
        update(dt, t) {
          if (talkT > 0) talkT -= dt; const on = talkT > 0;
          waves.forEach((m, i) => { const k = on && talkAt === 0 ? (t * 1.4 + i / 3) % 1 : 1; m.scale.setScalar(0.4 + k * 1.6); m.material.opacity = on && talkAt === 0 ? (1 - k) * 0.7 : 0; });
          arm.rotation.z = on && talkAt === 1 ? 2.6 + Math.sin(t * 9) * 0.35 : arm.rotation.z * 0.9;
        },
        idle() {},
        dispose() { alive = false; sp.stop(); if (ov) { ov.destroy(); ov = null; } },
      };
    },
  });
}

/* ───────────────────────── 언어별 문제 데이터 ───────────────────────── */
const ENV = (sky) => ({ sky, fog: [sky, 50, 150], sunColor: '#ffffff', sunI: 1.35, hemi: ['#f2f6ff', '#8c97a8', 1.0], sunPos: [18, 40, 22] });

const EN = {
  lang: 'en-US', short: '영어', icon: '🗣️', wrapN: 24, title: '영어 통역 안내 데스크 · 언어회화 테스트',
  desc: '여수를 찾은 외국인 관광객을 돕는 통역 안내원이 되어, 듣기·말하기·텍스트·언어 정확도를 차례로 테스트해요.',
  banner: '🗣️ Yeosu Interpreter Desk', accent: '#2f6fed', wall: '#e8eefb', floor: '#dfe6f2', ground: '#9bb0cc', npc: '#2f6fed', hair: '#3b2a1e', env: ENV('#cfe3ff'),
  career: '영어학전공에서는 영어듣기·영어발음·영문법·통역입문·영작문·한영순차통역 같은 수업으로 이 네 영역을 키워요.',
  listen: [
    { lines: ["Hi! I'd like two tickets for the night cruise, please.", 'Sure. It leaves at seven thirty from Pier Two. Please arrive ten minutes early.'], q: '야간 유람선의 출발 시각과 승선 장소는?', opts: ['7시 30분 · 2번 부두', '7시 30분 · 1번 부두', '7시 10분 · 2번 부두'], a: 0, tr: '손님: 야간 유람선 티켓 두 장 주세요. / 직원: 7시 30분에 2번 부두에서 출발해요. 10분 일찍 오세요. (7시 10분은 “일찍 도착” 시각이라 함정!)' },
    { lines: ['Attention, passengers. Due to strong winds, the ferry to the island is delayed by thirty minutes. We apologize for the inconvenience.'], q: '안내방송의 내용은?', opts: ['강풍 때문에 섬 여객선이 30분 늦게 출발한다', '비 때문에 모든 운항이 취소됐다', '승선 요금을 30% 깎아 준다'], a: 0, tr: '승객 여러분께 알립니다. 강풍으로 섬 여객선이 30분 지연됩니다. 불편을 드려 죄송합니다.' },
    { lines: ["Excuse me, I'm allergic to shrimp. Does the seafood soup have shrimp in it?", 'Yes, it does. But the grilled fish comes without shrimp.'], q: '새우 알레르기가 있는 손님이 주문하기에 알맞은 메뉴는?', opts: ['구운 생선', '해산물 수프', '둘 다 괜찮다'], a: 0, tr: '손님: 새우 알레르기가 있는데 해산물 수프에 새우가 들어 있나요? / 직원: 네, 들어 있어요. 구운 생선에는 새우가 없어요.' },
  ],
  speak: [
    { ctx: '길을 잃은 관광객이 엑스포역 가는 길을 물어요.', line: 'Excuse me, how can I get to the Expo station?', ko: '실례합니다, 엑스포역에 어떻게 가나요?', opts: ['Go straight and turn left at the second corner. It takes about five minutes.', 'I like the Expo station very much.', 'Yes, I can. Thank you very much.'], a: 0, mean: '직진해서 두 번째 모퉁이에서 왼쪽으로 도세요. 5분쯤 걸려요.', why: 'How can I get to ~? 는 길을 묻는 표현이에요. go straight, turn left 같은 길 안내 표현으로 답해요.' },
    { ctx: '손님이 여수의 대표 음식을 추천해 달라고 해요.', line: 'Can you recommend a local food?', ko: '이 지역 음식 하나 추천해 주실래요?', opts: ['Sure! You should try gat-kimchi. It is a Yeosu specialty.', "I'm sorry, I don't have a pen.", 'Yes, I am a student.'], a: 0, mean: '물론이죠! 갓김치를 드셔 보세요. 여수의 특산품이에요.', why: 'Can you recommend ~? (추천해 줄래요?)에는 Sure! + You should try ~ 로 답해요.' },
    { ctx: '안내를 마치자 손님이 감사 인사를 해요.', line: 'Thank you so much for your help!', ko: '도와주셔서 정말 감사합니다!', opts: ["You're welcome. Enjoy your stay in Yeosu!", 'Nice to meet you, too.', 'See you yesterday.'], a: 0, mean: '천만에요. 여수에서 즐거운 시간 보내세요!', why: '감사 인사에는 You\'re welcome. 으로 답해요.' },
  ],
  read: {
    title: '여수 야간 유람선 안내판', lines: ['🚢 YEOSU NIGHT CRUISE', 'Departures: 19:30 / 20:30', 'Adult: ₩20,000  Child (under 12): ₩10,000', 'Last boarding: 10 minutes before departure', 'No refunds after departure'],
    qs: [
      { q: '성인 2명과 어린이 1명의 요금은 모두 얼마일까요?', opts: ['₩40,000', '₩50,000', '₩60,000'], a: 1, why: '20,000×2 + 10,000 = 50,000' },
      { q: '20:30 배를 타려면 늦어도 몇 시까지 탑승해야 할까요?', opts: ['20:30', '20:20', '20:00'], a: 1, why: 'Last boarding: 출발 10분 전 → 20:20' },
      { q: '안내문과 일치하는 것은?', opts: ['출발한 뒤에는 환불이 되지 않는다', '12세 미만 어린이는 무료이다', '하루에 세 번 출발한다'], a: 0, why: 'No refunds after departure = 출발 후 환불 불가' },
    ],
  },
  acc: [
    { type: '빈칸 채우기', stem: 'She ___ to school by bus every day.', ko: '그녀는 매일 버스로 학교에 가요.', opts: ['goes', 'go', 'going'], a: 0, why: 'She(3인칭 단수) + 현재형 → goes' },
    { type: '틀린 문장 고치기', stem: 'I have visited Yeosu last summer.', ko: '“last summer(작년 여름)”처럼 과거 시점과 어울리는 올바른 문장은?', opts: ['I visited Yeosu last summer.', 'I have visit Yeosu last summer.', 'I am visiting Yeosu last summer.'], a: 0, why: '명확한 과거 시점(last summer)에는 현재완료가 아니라 과거형(visited)을 써요.' },
    { type: '어휘·표현', stem: 'The ferry was cancelled ___ the typhoon.', ko: '태풍 때문에 여객선이 취소됐어요.', opts: ['because of', 'because', 'although'], a: 0, why: 'because of + 명사(구), because + 절(주어+동사)' },
  ],
};

const JA = {
  lang: 'ja-JP', short: '일본어', icon: '🎌', wrapN: 13, title: '일본어 관광 안내 · 언어회화 테스트',
  desc: '여수를 찾은 일본인 관광객을 안내하는 통역사가 되어, 듣기·말하기·텍스트·언어 정확도를 차례로 테스트해요.',
  banner: '🎌 ようこそ、麗水へ（여수 관광 안내）', accent: '#d6453d', wall: '#fbeeee', floor: '#f1e4e0', ground: '#c9a9a4', npc: '#c9ced8', hair: '#1a1a1f', env: ENV('#ffe6e1'),
  career: '일본학전공에서는 일본어회화·일본어문법·일본어구문연습·비즈니스일본어·일본어인터뷰 같은 수업으로 이 네 영역을 키워요.',
  listen: [
    { lines: ['すみません、夜のクルーズは何時に出発しますか。', '七時半に出発します。二番乗り場からご乗船ください。'], q: '야간 크루즈의 출발 시각과 승선 장소는?', opts: ['7시 30분 · 2번 승강장', '7시 · 2번 승강장', '7시 30분 · 1번 승강장'], a: 0, tr: '실례합니다, 야간 크루즈는 몇 시에 출발해요? / 7시 반에 출발해요. 2번 승강장에서 승선해 주세요.' },
    { lines: ['朝食は七時から十時まで、二階のレストランでお召し上がりいただけます。'], q: '호텔 아침 식사 시간과 장소는?', opts: ['7시~10시 · 2층 레스토랑', '7시~10시 · 1층 로비', '8시~11시 · 2층 레스토랑'], a: 0, tr: '아침 식사는 7시부터 10시까지 2층 레스토랑에서 드실 수 있습니다.' },
    { lines: ['すみません、駅はどこですか。', 'まっすぐ行って、二つ目の角を右に曲がってください。歩いて五分です。'], q: '역으로 가는 길 안내는?', opts: ['직진 후 두 번째 모퉁이에서 오른쪽 · 도보 5분', '직진 후 첫 번째 모퉁이에서 왼쪽 · 도보 5분', '직진 후 두 번째 모퉁이에서 오른쪽 · 택시 5분'], a: 0, tr: '역이 어디예요? / 쭉 가서 두 번째 모퉁이에서 오른쪽으로 도세요. 걸어서 5분이에요.' },
  ],
  speak: [
    { ctx: '관광객이 근처 맛집을 물어요.', line: 'すみません、この近くにおいしいレストランはありますか。', ko: '실례합니다, 이 근처에 맛있는 식당이 있나요?', opts: ['はい、あります。あのビルの二階に海鮮料理のお店があります。', 'はい、わたしは学生です。', 'どういたしまして。さようなら。'], a: 0, mean: '네, 있어요. 저 건물 2층에 해산물 요리 가게가 있어요.', why: '있느냐고 물었으니 はい、あります(네, 있어요)로 답하고 위치를 덧붙여요.' },
    { ctx: '길 안내를 받은 관광객이 고마워해요.', line: 'ありがとうございました。とても助かりました。', ko: '감사합니다. 큰 도움이 됐어요.', opts: ['どういたしまして。よいご旅行を！', 'はじめまして、よろしくお願いします。', 'いただきます。'], a: 0, mean: '천만에요. 즐거운 여행 되세요!', why: '감사 인사에는 どういたしまして(천만에요)로 답해요.' },
    { ctx: '화장실 위치를 묻는 손님이에요.', line: 'すみません、トイレはどこですか。', ko: '실례합니다, 화장실이 어디예요?', opts: ['あちらの階段の隣にあります。', 'わたしは昨日行きました。', 'とても大きいです。'], a: 0, mean: '저쪽 계단 옆에 있어요.', why: '「どこですか」(어디예요?)에는 장소를 알려 주는 말로 답해요.' },
  ],
  read: {
    title: 'ホテル・ヨス 館内のご案内', lines: ['🏨 ホテル・ヨス ご案内', 'チェックイン 15:00 ／ チェックアウト 11:00', '朝食 7:00〜10:00（2階レストラン）', 'Wi-Fi：ロビーと客室で無料', '駐車場：1泊 3,000ウォン', '大浴場：夜 11:00まで'],
    qs: [
      { q: '체크아웃 시각은?', opts: ['10시', '11시', '15시'], a: 1, why: 'チェックアウト 11:00 / 15:00은 체크인 시각이에요.' },
      { q: '대욕장(大浴場)은 언제까지 이용할 수 있나요?', opts: ['밤 11시까지', '아침 11시까지', '24시간 이용 가능'], a: 0, why: '夜 11:00まで = 밤 11시까지' },
      { q: '안내문과 일치하는 것은?', opts: ['주차 요금은 1박에 3,000원이다', 'Wi-Fi는 객실에서만 쓸 수 있다', '아침 식사는 1층에서 한다'], a: 0, why: '1泊 3,000ウォン. Wi-Fi는 로비와 객실, 아침 식사는 2층이에요.' },
    ],
  },
  acc: [
    { type: '조사 고르기', stem: 'わたしは毎朝コーヒー___飲みます。', ko: '나는 매일 아침 커피를 마셔요.', opts: ['を', 'に', 'で'], a: 0, why: '마시는 대상(목적어)에는 조사 を를 써요.' },
    { type: '시제·활용', stem: '昨日は雨が___ので、家にいました。', ko: '어제는 비가 와서 집에 있었어요.', opts: ['降った', '降る', '降って'], a: 0, why: '어제의 일이므로 과거형 降った + ので' },
    { type: '형용사 + です', stem: 'この店は安くて、___です。', ko: '이 가게는 싸고 맛있어요.', opts: ['おいしい', 'おいしく', 'おいしいだ'], a: 0, why: 'い형용사는 そのまま + です (おいしいです). 「おいしいだ」는 틀린 표현이에요.' },
  ],
};

const ZH = {
  lang: 'zh-CN', short: '중국어', icon: '🏮', wrapN: 13, title: '중국어 관광 통역 · 언어회화 테스트',
  desc: '여수를 찾은 중국인 관광객을 안내하는 관광통역사가 되어, 듣기·말하기·텍스트·언어 정확도를 차례로 테스트해요.',
  banner: '🏮 欢迎来到丽水（여수 관광 통역）', accent: '#c9372c', wall: '#fff3dc', floor: '#f3e7cc', ground: '#cdb98a', npc: '#d6453d', hair: '#1a1a1f', env: ENV('#fff0cf'),
  career: '중국학전공에서는 중국어초급회화·중국어독해·초급HSK·중국어작문·실전HSK·관광통역중국어 같은 수업으로 이 네 영역을 키워요.',
  listen: [
    { lines: ['请问，夜间游船几点出发？', '七点半出发，请在二号码头上船。'], q: '야간 유람선의 출발 시각과 승선 장소는?', opts: ['7시 30분 · 2번 부두', '7시 · 2번 부두', '7시 30분 · 1번 부두'], a: 0, tr: '야간 유람선은 몇 시에 출발해요? / 7시 반에 출발해요. 2번 부두에서 승선하세요.' },
    { lines: ['各位乘客请注意，由于大风，开往岛上的轮渡将延迟三十分钟，给您带来不便，敬请原谅。'], q: '안내방송의 내용은?', opts: ['강풍 때문에 섬 여객선이 30분 늦게 출발한다', '폭우 때문에 모든 운항이 취소됐다', '승선 요금을 30% 깎아 준다'], a: 0, tr: '승객 여러분께 알립니다. 강풍으로 섬행 여객선이 30분 지연됩니다. 불편을 드려 죄송합니다.' },
    { lines: ['请问，火车站怎么走？', '一直走，在第二个路口往右拐，走五分钟就到了。'], q: '기차역 가는 길 안내는?', opts: ['직진 후 두 번째 갈림길에서 우회전 · 도보 5분', '직진 후 첫 번째 갈림길에서 좌회전 · 도보 5분', '직진 후 두 번째 갈림길에서 우회전 · 택시 5분'], a: 0, tr: '기차역은 어떻게 가요? / 쭉 가다가 두 번째 갈림길에서 오른쪽으로 돌아 5분 걸으면 도착해요.' },
  ],
  speak: [
    { ctx: '관광객이 근처 맛집을 물어요.', line: '你好，请问这附近有好吃的餐厅吗？', ko: '안녕하세요, 이 근처에 맛있는 식당이 있나요?', opts: ['有，前面那栋楼二楼有一家海鲜餐厅。', '我是学生，你呢？', '不客气，再见。'], a: 0, mean: '있어요. 앞 건물 2층에 해산물 식당이 하나 있어요.', why: '“有…吗?”(있나요?)에는 有(있어요)로 답하고 위치를 알려 줘요.' },
    { ctx: '길 안내를 받은 관광객이 고마워해요.', line: '谢谢你，帮了我大忙！', ko: '고마워요, 큰 도움이 됐어요!', opts: ['不客气，祝你旅途愉快！', '你好，初次见面。', '我吃饱了。'], a: 0, mean: '천만에요, 즐거운 여행 되세요!', why: '감사 인사에는 不客气(천만에요)로 답해요.' },
    { ctx: '기념품 가게에서 손님이 가격을 물어요.', line: '请问，这个多少钱？', ko: '실례지만 이거 얼마예요?', opts: ['两万韩元，可以刷卡。', '我昨天去了。', '今天天气很好。'], a: 0, mean: '2만 원이에요. 카드로 결제할 수 있어요.', why: '“多少钱?”(얼마예요?)에는 가격으로 답해요.' },
  ],
  read: {
    title: '海洋水族馆 参观须知', lines: ['🐠 海洋水族馆 参观须知', '开放时间：10:00–18:00（最后入场 17:00）', '成人票 25,000韩元 ／ 儿童票 15,000韩元', '禁止使用闪光灯拍照', '每周一休馆'],
    qs: [
      { q: '입장을 마감하는(마지막 입장) 시각은?', opts: ['18시', '17시', '10시'], a: 1, why: '最后入场 17:00 (18:00은 폐관 시각)' },
      { q: '성인 2명과 어린이 2명의 입장료는 모두 얼마일까요?', opts: ['65,000원', '80,000원', '90,000원'], a: 1, why: '25,000×2 + 15,000×2 = 80,000' },
      { q: '안내문과 일치하는 것은?', opts: ['매주 월요일은 쉰다', '플래시를 켜고 찍어도 된다', '어린이는 무료이다'], a: 0, why: '每周一休馆 = 매주 월요일 휴관' },
    ],
  },
  acc: [
    { type: '양사 고르기', stem: '我想买三___苹果。', ko: '나는 사과 세 개를 사고 싶어요.', opts: ['个', '本', '只'], a: 0, why: '사과 같은 일반 물건은 个, 本은 책, 只는 작은 동물에 써요.' },
    { type: '개사 고르기', stem: '我昨天___朋友去看电影了。', ko: '나는 어제 친구와 함께 영화를 보러 갔어요.', opts: ['和', '把', '被'], a: 0, why: '“~와 함께”는 和(hé)' },
    { type: '조동사', stem: '明天会下雨，你___带伞。', ko: '내일 비가 올 거예요. 우산을 챙겨야 해요.', opts: ['要', '了', '吗'], a: 0, why: '“~해야 한다”는 要(yào)' },
  ],
};

langTest('eng2', EN);
langTest('jpn', JA);
langTest('chn', ZH);