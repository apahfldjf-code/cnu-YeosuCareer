/* ═══════════════════════════════════════════════════════════════
 * src/audio.js (신규, A1) — 오디오 엔진
 *  - 첫 터치·클릭·키 입력에서 오디오 잠금을 풀어요 (모바일·크롬 자동재생 정책 대응)
 *  - 전체 · 효과음 · 배경음악 볼륨 (localStorage 저장), 컴프레서로 찢어짐 방지
 *  - 배경음악 7곡: 코드로 합성(드럼·베이스·패드·리버브·딜레이·사이드체인) · MP3_TRACKS 에 이름을 적고 audio/bgm_이름.mp3 를 넣으면 그 파일을 우선 재생
 *  - fx.* : 체험용 효과음 15종 (A2 에서 체험별로 연결해요)
 *  - core.js 의 sfx/tone/engine 은 이 엔진의 효과음 버스(sfxOut)로 나가요
 * ═══════════════════════════════════════════════════════════════ */
const LS = 'cq_audio_v1';
const st = { on: true, master: 1, sfx: 1, bgm: 0.5 };
try {
  const j = JSON.parse(localStorage.getItem(LS) || '{}');
  ['master', 'sfx', 'bgm'].forEach((k) => { if (typeof j[k] === 'number') st[k] = j[k]; });
} catch (e) { /* 무시 */ }
const saveSt = () => { try { localStorage.setItem(LS, JSON.stringify({ master: st.master, sfx: st.sfx, bgm: st.bgm })); } catch (e) { /* 무시 */ } };

let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, kicked = false, sfxAn = null, musAn = null, outAn = null;
let cur = null, curName = null, tm = null, step = 0, nextT = 0;
if (typeof window !== 'undefined') window.__cqAudio = { get ctx() { return ctx; }, st }; /* 문제 확인용: 콘솔에서 __cqAudio.ctx.state */

/* ───────────── 컨텍스트 · 볼륨 ───────────── */
function build() {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) { ctx = new C(); }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); sfxBus = ctx.createGain(); musBus = ctx.createGain();
  sfxBus.connect(master); musBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
  ctx.__sfx = sfxBus;
  /* 소리 테스트용 신호 측정기 (스피커로 나가는 소리에는 영향 없어요) */
  const mkAn = () => { const a = ctx.createAnalyser(); a.fftSize = 1024; return a; };
  sfxAn = mkAn(); musAn = mkAn(); outAn = mkAn(); sfxBus.connect(sfxAn); musBus.connect(musAn); comp.connect(outAn);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply();
  return ctx;
}
function apply() {
  if (!ctx) return; const t = ctx.currentTime;
  master.gain.setTargetAtTime(st.on ? st.master : 0, t, 0.03);
  sfxBus.gain.setTargetAtTime(st.sfx * 2.4, t, 0.03); /* core.js 효과음은 0.04~0.08 로 작아서 키워 줘요 */
  musBus.gain.setTargetAtTime(st.bgm, t, 0.1);
}
/** 소리를 낼 수 있는 컨텍스트만 돌려줘요 (잠겨 있으면 null → 첫 소리가 사라지는 문제 방지) */
export function ac() {
  if (!ctx && !build()) return null;
  if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return null; }
  return ctx;
}
export const sfxOut = (c) => c.__sfx || c.destination;
export function setEnabled(v) { st.on = !!v; apply(); }

/* 첫 사용자 입력에서 잠금 해제 */
function kick() {
  if (kicked || !ctx) return; kicked = true;
  try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* 무시 */ }
}
const unlockEv = () => {
  if (!ctx) build(); if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().then(() => { if (ctx.state === 'running') kick(); }).catch(() => {});
  else kick();
};
if (typeof window !== 'undefined') {
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockEv, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
}

/* 볼륨 API */
export const getVol = (k) => st[k];
export function setVol(k, v) { st[k] = Math.max(0, Math.min(1, v)); saveSt(); apply(); }
export function cycleVol(k, levels = [1, 0.6, 0.3, 0]) { /* 100 → 60 → 30 → 꺼짐 → 100 (처음 누를 때 꺼지지 않게) */
  let i = 0, best = 9; levels.forEach((x, j) => { const d = Math.abs(x - st[k]); if (d < best) { best = d; i = j; } });
  const n = levels[(i + 1) % levels.length]; setVol(k, n); return n;
}
/** 듣기 재생 같은 때 배경음악을 잠깐 줄여요 */
export function duck(sec = 6) {
  if (!ctx) return; const t = ctx.currentTime;
  musBus.gain.cancelScheduledValues(t);
  musBus.gain.setTargetAtTime(st.bgm * 0.12, t, 0.05);
  musBus.gain.setTargetAtTime(st.bgm, t + sec, 0.5);
}

/* ───────────── 효과음 재료 ───────────── */
function T(f, d = 0.12, type = 'sine', v = 0.08, f2 = null, delay = 0) {
  const c = ac(); if (!c || !st.on) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + d + 0.03);
}
function N(d, v, fc, delay = 0, type = 'lowpass') {
  const c = ac(); if (!c || !st.on) return;
  const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = fc;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.3); s.stop(t + d + 0.03);
}

/** 체험용 효과음 (core.js 의 sfx 와 따로 쓰는 추가 팔레트) */
export const fx = {
  shutter() { N(0.04, 0.3, 5000, 0, 'highpass'); N(0.05, 0.25, 3500, 0.07, 'highpass'); },
  splash() { N(0.5, 0.25, 1800); T(500, 0.25, 'sine', 0.05, 180); },
  typing() { for (let i = 0; i < 5; i++) N(0.02, 0.18, 4000, i * 0.07 + Math.random() * 0.03, 'highpass'); },
  cash() { T(1568, 0.1, 'triangle', 0.1); T(2093, 0.35, 'triangle', 0.1, null, 0.09); },
  motor() { T(90, 0.5, 'sawtooth', 0.06, 200); },
  drill() { for (let i = 0; i < 8; i++) T(220 + i * 8, 0.06, 'sawtooth', 0.04, null, i * 0.05); },
  bubble() { T(400, 0.12, 'sine', 0.07, 900); T(500, 0.1, 'sine', 0.06, 1100, 0.1); },
  ding() { T(1318, 0.6, 'sine', 0.1); T(1975, 0.5, 'sine', 0.05, null, 0.02); },
  alarm() { for (let i = 0; i < 4; i++) T(i % 2 ? 700 : 980, 0.14, 'square', 0.05, null, i * 0.16); },
  wave() { N(1.6, 0.2, 700); },
  whoosh() { N(0.3, 0.15, 2500, 0, 'bandpass'); },
  steam() { N(0.6, 0.12, 6000, 0, 'highpass'); },
  clank() { T(180, 0.12, 'square', 0.08, 90); N(0.06, 0.15, 2500, 0, 'bandpass'); },
  horn() { T(120, 0.9, 'sawtooth', 0.12); T(150, 0.9, 'sawtooth', 0.1); },
  radar() { T(1000, 0.5, 'sine', 0.06, 400); },
};

/* 일반 <audio> 재생 확인용 짧은 WAV (웹오디오와 별개 경로) */
function wavUrl(freq, sec) {
  const sr = 22050, n = Math.floor(sr * sec), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, gate = (t % 0.25) < 0.12 ? 1 : 0, e = Math.min(1, i / 200, (n - i) / 400); v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * freq * t) * 0.5 * gate * e * 32767, true); }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/* 소리 테스트 결과창 (game.js 수정 없이 화면 위에 직접 띄워요) */
const peak = (an) => {
  if (!an) return 0; const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
  let m = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } return m;
};
let box = null, boxTxt = null;
function showBox(text) {
  if (typeof document === 'undefined') return;
  if (!box || !box.isConnected) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);width:min(94vw,640px);box-sizing:border-box;z-index:2147483600;background:rgba(15,25,45,.96);color:#fff;border:2px solid #6fb4ff;border-radius:12px;padding:12px 14px;font:600 14px/1.65 "Malgun Gothic","Noto Sans KR",sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    ['pointerdown', 'pointerup', 'mousedown', 'touchstart'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation()));
    boxTxt = document.createElement('div'); boxTxt.style.whiteSpace = 'pre-wrap';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap';
    const mkB = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'font:inherit;color:#fff;background:#2c3a55;border:0;border-radius:8px;padding:8px 12px;cursor:pointer'; b.onclick = f; row.append(b); };
    mkB('🔧 볼륨 초기화 (전체100·효과음100·배경음악50)', () => { st.master = 1; st.sfx = 1; st.bgm = 0.5; saveSt(); apply(); fx.ding(); boxTxt.textContent += '\n\n✅ 볼륨을 초기화했어요. 다시 [메뉴 → 소리 테스트]를 눌러 보세요.'; });
    mkB('닫기', () => box.remove());
    box.append(boxTxt, row); document.body.append(box);
  }
  boxTxt.textContent = text;
}

/** 소리 테스트: 소리를 3번 내고, 효과음·배경음악 신호가 실제로 나가는지 장치로 측정해서 화면에 보여 줘요
 *  ① 낮은 "삐—" = 웹오디오 직결  ② "딩" = 게임 효과음 경로  ③ 높은 "삐삐" = 일반 오디오 재생 */
export function testSound() {
  const c = ac();
  if (!c) { const m = `🔇 오디오가 잠겨 있어요 (상태: ${ctx ? ctx.state : '없음'}). 화면을 한 번 더 누르고 다시 시도해 주세요`; showBox(m); return m; }
  const mx = { sfx: 0, mus: 0, out: 0 };
  const poll = setInterval(() => { mx.sfx = Math.max(mx.sfx, peak(sfxAn)); mx.mus = Math.max(mx.mus, peak(musAn)); mx.out = Math.max(mx.out, peak(outAn)); }, 40);
  showBox('① 낮은 "삐—" 재생 중…');
  try { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 440; g.gain.value = 0.25; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.6); } catch (e) { console.error('[audio] 직결 테스트 실패', e); }
  setTimeout(() => { showBox('② "딩" 재생 중…'); fx.ding(); }, 1000);
  setTimeout(() => {
    showBox('③ 높은 "삐삐" 재생 중…');
    try { const a = new Audio(wavUrl(880, 0.6)); a.volume = 1; const pr = a.play(); if (pr && pr.catch) pr.catch((e) => console.error('[audio] 일반 재생 실패', e)); } catch (e) { console.error('[audio] 일반 재생 오류', e); }
  }, 2200);
  setTimeout(() => {
    clearInterval(poll);
    const p = (v) => (v <= 0.001 ? '꺼짐' : Math.round(v * 100) + '%'), n = (v) => (v * 100).toFixed(1);
    const L = [`🔊 소리 테스트 결과 (상태 ${c.state} · ${c.sampleRate}Hz)`, `볼륨: 전체 ${p(st.master)} · 효과음 ${p(st.sfx)} · 배경음악 ${p(st.bgm)} · 소리 설정 ${st.on ? '켜짐' : '꺼짐'}`, ''];
    L.push(`② 효과음 신호 ${n(mx.sfx)} → 스피커 직전 ${n(mx.out)}`);
    if (!st.on) L.push('→ 메뉴의 "🔊 소리"가 꺼져 있어요. 켜 주세요.');
    else if (st.master <= 0.001 || st.sfx <= 0.001) L.push('→ 볼륨이 0이에요. 아래 [볼륨 초기화]를 눌러 주세요.');
    else if (mx.sfx < 0.005) L.push('→ 효과음 신호가 만들어지지 않았어요. 콘솔(F12) 빨간 오류를 알려 주세요.');
    else if (mx.out < 0.005) L.push('→ 신호가 스피커 직전에서 사라졌어요. (엔진 문제) 이 숫자를 알려 주세요.');
    else L.push('→ 효과음 신호는 스피커 직전까지 나갔어요. ②가 안 들렸다면 PC 출력(Windows 볼륨 믹서) 쪽이에요.');
    L.push('', `배경음악: ${curName ? "'" + curName + "' 선택됨" : '선택된 곡 없음(playBgm 호출이 안 됨)'} · 방식 ${fileName ? 'MP3' : '합성'} · 스케줄러 ${tm ? '작동' : '없음'} · 신호 ${n(mx.mus)}`);
    if (!curName) L.push('→ game.js 의 playBgm 연결을 확인해야 해요.');
    else if (st.bgm <= 0.001) L.push('→ 배경음악 볼륨이 꺼져 있어요. [볼륨 초기화]를 눌러 주세요.');
    else if (mx.mus < 0.002) L.push('→ 곡은 선택됐지만 소리가 만들어지지 않아요. 콘솔 오류를 알려 주세요.');
    else L.push('→ 배경음악 신호가 나가고 있어요.');
    L.push('', '들린 번호(①②③)와 위 숫자를 알려 주세요.');
    showBox(L.join('\n'));
  }, 3600);
  return '🔊 소리 테스트 중… 화면 위 안내를 보세요';
}

/* ───────────── 배경음악 (A1-b) — 프로듀싱형 합성: 드럼·베이스·패드·리버브·딜레이·사이드체인 ───────────── */
const MP3_TRACKS = []; /* 예: ['title', 'campus'] 라고 적고 audio/bgm_title.mp3 같은 파일을 넣으면 합성음 대신 그 파일을 재생해요 */
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mod12 = (x) => ((x % 12) + 12) % 12;
const QUAL = { maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], min: [0, 3, 7], maj: [0, 4, 7], six: [0, 4, 7, 9] };
const voicing = (r, q, base) => { let m = base + mod12(r - base); if (m - base > 6) m -= 12; return QUAL[q].map((i) => m + i); };
const broot = (r, lo) => lo + mod12(r - lo);
const rnd = Math.random;
const SEA_IDS = new Set(['nav', 'mar', 'aqu', 'fsh', 'smf', 'ocs', 'fbi', 'sea', 'mfm', 'kcg']);
export const bgmForDept = (id) => (SEA_IDS.has(id) ? 'sea' : 'lab');

/* 믹스 버스: 곡마다 새로 만들어서 이전 곡의 잔향이 섞이지 않게 해요 */
let mus = null, irBuf = null;
function makeIR(sec) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.45; d[i] = lp * Math.exp(-6.9 * i / n) * (i < 600 ? i / 600 : 1); } }
  return b;
}
function killMus(sec) {
  if (!mus) return; const m = mus, t = ctx.currentTime; mus = null;
  m.syn.gain.cancelScheduledValues(t); m.syn.gain.setValueAtTime(m.syn.gain.value, t); m.syn.gain.linearRampToValueAtTime(0, t + sec);
  setTimeout(() => { try { m.syn.disconnect(); } catch (e) { /* 무시 */ } }, sec * 1000 + 3500);
}
function newMus(name) {
  killMus(0.9);
  const t = ctx.currentTime, syn = ctx.createGain(), sc = ctx.createGain(), dry = ctx.createGain(), rv = ctx.createGain(), dl = ctx.createGain();
  syn.gain.setValueAtTime(0.0001, t); syn.gain.linearRampToValueAtTime(0.6, t + 0.5); syn.connect(musBus); sc.connect(syn); dry.connect(syn);
  if (!irBuf) irBuf = makeIR(2.4);
  const cv = ctx.createConvolver(); cv.buffer = irBuf; rv.connect(cv); cv.connect(syn);
  const d = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), spb = cur ? 60 / cur.bpm : 0.6;
  d.delayTime.value = Math.min(1.4, spb * 0.75); fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 3200;
  dl.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(syn); lp.connect(rv);
  mus = { name, syn, sc, dry, rv, dl };
}
/** 소리를 믹스 버스로 보내요. sc: 킥에 맞춰 눌리는 버스 · pan: 좌우 · rv: 리버브 양 · dl: 딜레이 양 */
function route(node, o = {}) {
  let n = node;
  if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
  n.connect(o.sc ? mus.sc : mus.dry);
  if (o.rv) { const g = ctx.createGain(); g.gain.value = o.rv; n.connect(g); g.connect(mus.rv); }
  if (o.dl) { const g = ctx.createGain(); g.gain.value = o.dl; n.connect(g); g.connect(mus.dl); }
}
function duckSC(t, depth) { if (!mus) return; const g = mus.sc.gain; g.setValueAtTime(1 - depth, t); g.linearRampToValueAtTime(1, t + 0.17); }

/* 악기 (모두 Web Audio 노드로 즉석 합성) */
function pluckV(f, t, d, v, bright, o) {
  const g = ctx.createGain(), fl = ctx.createBiquadFilter(), a = ctx.createOscillator(), b = ctx.createOscillator();
  a.type = 'sawtooth'; b.type = 'triangle'; a.frequency.value = f; b.frequency.value = f * 2.004; a.detune.value = 4;
  fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(Math.min(9000, f * (5 + 8 * bright)), t); fl.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + d * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + d);
  a.connect(fl); b.connect(fl); fl.connect(g); a.start(t); b.start(t); a.stop(t + d + 0.1); b.stop(t + d + 0.1); route(g, o);
}
function padV(f, t, dur, v, o, att = 0.7, rel = 1.0) {
  const g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = Math.min(3200, f * 5); fl.Q.value = 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  [-9, 0, 9].forEach((c) => { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = c; s.connect(fl); s.start(t); s.stop(t + dur + rel + 0.05); });
  fl.connect(g); route(g, o);
}
function epV(f, t, d, v, o) {
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = f; m.frequency.value = f; mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.5); m.connect(mg); mg.connect(c.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(v * 0.25, t + Math.min(d, 0.9)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
  c.connect(g); c.start(t); m.start(t); c.stop(t + d + 0.3); m.stop(t + d + 0.3); route(g, o);
}
function bassV(f, t, d, v, saw, o) {
  const g = ctx.createGain(), s = ctx.createOscillator(), fl = ctx.createBiquadFilter(); s.type = saw ? 'sawtooth' : 'sine'; s.frequency.value = f;
  fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(saw ? Math.min(2500, f * 14) : 600, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, f * 2.2), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setValueAtTime(v, t + Math.max(0.012, d - 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
  if (!saw) { const s2 = ctx.createOscillator(), g2 = ctx.createGain(); s2.type = 'triangle'; s2.frequency.value = f * 2; g2.gain.value = 0.18; s2.connect(g2); g2.connect(fl); s2.start(t); s2.stop(t + d + 0.08); }
  s.connect(fl); fl.connect(g); s.start(t); s.stop(t + d + 0.08); route(g, o);
}
function brassV(f, t, d, v, o) {
  const g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1;
  fl.frequency.setValueAtTime(f * 1.5, t); fl.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 7), t + 0.05); fl.frequency.exponentialRampToValueAtTime(f * 3, t + Math.max(0.1, d));
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + Math.max(0.03, d - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
  [-8, 0, 8].forEach((c) => { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = c; s.connect(fl); s.start(t); s.stop(t + d + 0.12); });
  fl.connect(g); route(g, o);
}
function noiseHit(t, d, v, fc, type, o, q = 0.7) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = fc; f.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); s.start(t, rnd() * 1.5); s.stop(t + d + 0.03); route(g, o);
}
function kickV(t, v, o) {
  const s = ctx.createOscillator(), g = ctx.createGain(); s.frequency.setValueAtTime(150, t); s.frequency.exponentialRampToValueAtTime(46, t + 0.09);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); s.connect(g); s.start(t); s.stop(t + 0.4); route(g, o); noiseHit(t, 0.012, v * 0.3, 3000, 'highpass', o);
}
function boomV(t, v) {
  const s = ctx.createOscillator(), g = ctx.createGain(); s.frequency.setValueAtTime(70, t); s.frequency.exponentialRampToValueAtTime(28, t + 0.7);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); s.connect(g); s.start(t); s.stop(t + 1.25); route(g, { rv: 0.5 });
}
function tomV(t, f, v, o) {
  const s = ctx.createOscillator(), g = ctx.createGain(); s.frequency.setValueAtTime(f * 1.3, t); s.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); s.connect(g); s.start(t); s.stop(t + 0.33); route(g, o);
}
function snareV(t, v, o) {
  noiseHit(t, 0.16, v, 1800, 'bandpass', o, 0.8);
  const s = ctx.createOscillator(), g = ctx.createGain(); s.type = 'triangle'; s.frequency.setValueAtTime(220, t); s.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); s.connect(g); s.start(t); s.stop(t + 0.12); route(g, o);
}
function clapV(t, v, o) { [0, 0.011, 0.022].forEach((k) => noiseHit(t + k, 0.012, v, 1500, 'bandpass', o, 0.9)); noiseHit(t + 0.03, 0.15, v * 0.8, 1400, 'bandpass', o, 0.9); }
function hatV(t, v, open, o) { noiseHit(t, open ? 0.22 : 0.04, v, 7500, 'highpass', o); }
function swell(t, dur, v, fc, type, pan, q = 0.7) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = fc; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); s.start(t, rnd()); s.stop(t + dur + 0.05); route(g, { pan, rv: 0.2 });
}
function riserV(t, dur, v) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.98); g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(f); f.connect(g); s.start(t, rnd()); s.stop(t + dur + 0.05); route(g, { rv: 0.3 });
}
const padBar = (t0, K, r, q, base, v, att, rel, rv) => voicing(r, q, base).slice(0, 5).forEach((m, i) => padV(mf(m), t0, K.bs, v, { sc: true, pan: [-0.4, 0.4, -0.2, 0.2, 0][i], rv }, att, rel));
const melPhrase = (ph, b, t0, K, v, bright, o, shift = 0, extra = 0.5) => ph[b % 4].forEach(([s, m, l]) => pluckV(mf(m + shift), t0 + s * K.s16, l * K.s16 + extra, v, bright, o));

/* 곡 데이터: [시작 16분음표, 음높이(MIDI), 길이] */
const PT = [[0, 'maj7'], [7, 'maj'], [9, 'min7'], [5, 'maj9']];
const MT_A = [[[0, 76, 6], [6, 79, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2]], [[0, 74, 6], [6, 79, 2], [8, 83, 6], [14, 81, 2]], [[0, 81, 6], [6, 79, 2], [8, 76, 4], [12, 79, 4]], [[0, 77, 4], [4, 81, 4], [8, 79, 8]]];
const MT_B = [[[0, 79, 4], [4, 81, 2], [6, 84, 6], [12, 81, 4]], [[0, 83, 4], [4, 81, 4], [8, 79, 6], [14, 74, 2]], [[0, 76, 4], [4, 81, 4], [8, 84, 4], [12, 81, 4]], [[0, 81, 6], [6, 79, 2], [8, 77, 4], [12, 76, 4]]];
const PC = [[5, 'maj7'], [7, 'add9'], [4, 'min7'], [9, 'min7']];
const MC_A = [[[0, 81, 3], [3, 79, 1], [4, 77, 4], [8, 81, 4], [12, 84, 4]], [[0, 83, 3], [3, 81, 1], [4, 79, 4], [8, 74, 4], [12, 79, 2], [14, 81, 2]], [[0, 79, 3], [3, 76, 1], [4, 79, 4], [8, 83, 4], [12, 79, 4]], [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 81, 6], [14, 79, 2]]];
const MC_B = [[[0, 84, 4], [4, 81, 4], [8, 84, 2], [10, 86, 2], [12, 84, 4]], [[0, 86, 4], [4, 83, 4], [8, 79, 4], [12, 83, 4]], [[0, 83, 4], [4, 79, 4], [8, 76, 4], [12, 79, 4]], [[0, 84, 4], [4, 81, 4], [8, 79, 4], [12, 81, 4]]];
const PL = [[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [9, 'min7']];
const ML_A = [[[2, 77, 4], [8, 81, 6]], [[2, 79, 4], [8, 83, 4], [12, 77, 4]], [[2, 76, 4], [8, 79, 6]], [[2, 81, 4], [8, 76, 4], [12, 72, 4]]];
const ML_B = [[[0, 81, 4], [6, 84, 4], [12, 81, 4]], [[0, 83, 4], [6, 79, 4], [12, 77, 2], [14, 79, 2]], [[2, 84, 4], [8, 79, 4], [12, 76, 4]], [[0, 76, 6], [8, 72, 4], [12, 74, 4]]];
const PR = [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']];
const LD = [[[0, 81, 3], [3, 84, 1], [4, 88, 4], [8, 84, 4], [12, 81, 4]], [[0, 84, 3], [3, 81, 1], [4, 84, 4], [8, 89, 4], [12, 88, 4]], [[0, 88, 3], [3, 84, 1], [4, 79, 4], [8, 84, 4], [12, 88, 4]], [[0, 86, 3], [3, 83, 1], [4, 79, 4], [8, 83, 4], [12, 86, 4]]];
const RP = [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], RA = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 2, 3];
const PS = [[2, 'add9'], [9, 'maj'], [11, 'min7'], [7, 'maj']];
const SA = [[[0, 81, 4], [4, 81, 2], [6, 83, 2], [8, 85, 6], [14, 83, 2]], [[0, 85, 4], [4, 85, 2], [6, 83, 2], [8, 81, 6], [14, 80, 2]], [[0, 83, 4], [4, 83, 2], [6, 81, 2], [8, 78, 6], [14, 81, 2]], [[0, 79, 4], [4, 81, 4], [8, 83, 4], [12, 81, 4]]];
const SB = [[[0, 86, 4], [4, 85, 2], [6, 86, 2], [8, 88, 6], [14, 86, 2]], [[0, 88, 4], [4, 85, 4], [8, 81, 4], [12, 85, 4]], [[0, 86, 4], [4, 83, 4], [8, 78, 4], [12, 83, 4]], [[0, 86, 4], [4, 83, 4], [8, 79, 4], [12, 83, 2], [14, 86, 2]]];
const PF = [[4, 'min'], [0, 'maj7'], [4, 'min'], [2, 'maj']];
const FA = [[[0, 71, 3], [4, 74, 3], [8, 76, 4]], [[0, 72, 3], [4, 76, 3], [8, 79, 4]], [[0, 71, 3], [4, 74, 3], [8, 71, 4], [12, 69, 4]], [[0, 69, 4], [4, 74, 4], [8, 78, 4]]];
const PE = [[7, 'maj9'], [4, 'min9'], [0, 'maj7'], [2, 'six']];
const SeA = [[[0, 86, 8], [8, 83, 4], [12, 79, 4]], [[0, 83, 8], [8, 79, 4], [12, 76, 4]], [[0, 84, 8], [8, 79, 8]], [[0, 81, 8], [8, 86, 4], [12, 83, 4]]];
const SeB = [[[0, 91, 6], [8, 86, 4], [12, 83, 4]], [[0, 88, 6], [8, 83, 4], [12, 79, 4]], [[0, 91, 6], [8, 88, 4], [12, 84, 4]], [[0, 90, 6], [8, 86, 4], [12, 81, 4]]];

/* 16마디가 한 바퀴. 앞 4마디는 가볍게, 뒤로 갈수록 악기가 늘어나요 */
const TR = {
  title: { bpm: 92, play(b, t0, K) {
    const [r, q] = PT[b % 4], s = (n) => t0 + n * K.s16, cyc = b >> 2;
    padBar(t0, K, r, q, 55, 0.035, 0.9, 1.2, 0.45);
    bassV(mf(broot(r, 31)), t0, K.bs * 0.95, 0.4, false, { sc: true });
    const up = voicing(r, q, 60); up.push(up[0] + 12);
    [0, 1, 2, 3, 2, 1, 2, 3].forEach((ix, k) => epV(mf(up[ix]), s(k * 2), 0.55, k % 2 ? 0.1 : 0.15, { pan: k % 2 ? 0.3 : -0.3, rv: 0.5, dl: 0.25 }));
    if (cyc >= 1) melPhrase(cyc % 2 ? MT_A : MT_B, b, t0, K, 0.14, 0.7, { pan: 0.15, rv: 0.5, dl: 0.35 }, 0, 0.6);
    if (b >= 2) { [0, 10].forEach((n) => { kickV(s(n), 0.45, {}); K.duck(s(n), 0.25); }); clapV(s(8), 0.1, { rv: 0.6 }); }
    if (b >= 4) for (let n = 0; n < 16; n += 2) hatV(s(n), 0.05, false, { pan: 0.3 });
  } },
  campus: { bpm: 110, play(b, t0, K) {
    const [r, q] = PC[b % 4], s = (n) => t0 + n * K.s16, cyc = b >> 2, br = mf(broot(r, 33));
    padBar(t0, K, r, q, 57, 0.03, 0.3, 0.6, 0.35);
    [2, 6, 10, 14].forEach((n) => bassV(br * (n === 14 ? 2 : 1), s(n), K.s16 * 1.8, 0.32, true, { sc: true }));
    [0, 4, 8, 12].forEach((n) => { kickV(s(n), 0.85, {}); K.duck(s(n), 0.55); });
    [4, 12].forEach((n) => clapV(s(n), 0.45, { rv: 0.25 }));
    for (let n = 0; n < 16; n++) { if (n % 4 === 2) hatV(s(n), 0.14, true, { pan: 0.2 }); else if (n % 2) hatV(s(n), 0.08, false, { pan: -0.2 }); }
    if (b >= 2) [3, 6, 10].forEach((n) => voicing(r, q, 64).slice(0, 3).forEach((m, i) => pluckV(mf(m), s(n), 0.3, 0.07, 1.3, { pan: [-0.3, 0, 0.3][i], rv: 0.25, dl: 0.3 })));
    if (cyc >= 1) melPhrase(cyc % 2 ? MC_A : MC_B, b, t0, K, 0.14, 0.9, { pan: 0.1, rv: 0.35, dl: 0.3 });
  } },
  lab: { bpm: 84, play(b, t0, K) {
    const [r, q] = PL[b % 4], sw = (n) => t0 + n * K.s16 + (n % 2 ? 0.2 * K.s16 : 0), cyc = b >> 2, ch = voicing(r, q, 58);
    [[0, 6, 0.9], [6, 3, 0.6], [10, 3, 0.65]].forEach(([n, l, vel]) => ch.slice(0, 4).forEach((m, i) => epV(mf(m), sw(n) + i * 0.012, l * K.s16, 0.11 * vel, { pan: [-0.3, 0.3, -0.1, 0.1][i], rv: 0.3 })));
    [[0, 5], [7, 2], [10, 3]].forEach(([n, l]) => bassV(mf(broot(r, 34)), sw(n), l * K.s16, 0.4, false, { sc: true }));
    [0, 7, 10].forEach((n) => { kickV(sw(n), 0.4, {}); K.duck(sw(n), 0.2); });
    snareV(sw(8), 0.22, { rv: 0.3 });
    for (let n = 0; n < 16; n += 2) hatV(sw(n), n % 4 ? 0.04 : 0.06, false, { pan: 0.25 });
    if (cyc >= 1) (cyc % 2 ? ML_A : ML_B)[b % 4].forEach(([n, m, l]) => epV(mf(m), sw(n), l * K.s16, 0.15, { pan: 0.2, rv: 0.4, dl: 0.25 }));
    for (let i = 0; i < 5; i++) noiseHit(t0 + rnd() * K.bs, 0.004, 0.02, 4000, 'highpass', { pan: rnd() * 2 - 1 });
  } },
  race: { bpm: 140, play(b, t0, K) {
    const [r, q] = PR[b % 4], s = (n) => t0 + n * K.s16, full = b >= 8, br = broot(r, 33);
    if (full) padBar(t0, K, r, q, 52, 0.025, 0.15, 0.4, 0.3);
    RP.forEach((on, n) => { if (on) bassV(mf(br + (n === 3 || n === 11 ? 12 : 0)), s(n), K.s16 * 0.85, 0.3, true, { sc: true }); });
    [0, 4, 8, 12].forEach((n) => { kickV(s(n), 0.9, {}); K.duck(s(n), 0.6); });
    [4, 12].forEach((n) => clapV(s(n), 0.45, { rv: 0.2 }));
    if (b % 4 === 3) for (let n = 12; n < 16; n++) snareV(s(n), 0.16 + 0.07 * (n - 12), { rv: 0.15 });
    for (let n = 0; n < 16; n++) { if (n % 4 === 2) hatV(s(n), full ? 0.14 : 0.09, true, { pan: 0.2 }); else hatV(s(n), n % 2 ? 0.07 : 0.09, false, { pan: -0.2 }); }
    const n3 = voicing(r, q, 57).slice(0, 3), an = [n3[0], n3[1], n3[2], n3[0] + 12];
    for (let n = 0; n < 16; n++) pluckV(mf(an[RA[n]] + 12), s(n), 0.22, full ? 0.06 : 0.045, 1.5, { pan: -0.4 + 0.8 * (n % 4) / 3, rv: 0.2, dl: 0.2 });
    if (full) LD[b % 4].forEach(([n, m, l]) => { brassV(mf(m), s(n), l * K.s16 * 0.95, 0.05, { rv: 0.3, dl: 0.2 }); pluckV(mf(m + 12), s(n), l * K.s16 + 0.3, 0.07, 1.0, { rv: 0.3, dl: 0.3 }); });
    if (b === 7) riserV(t0, K.bs, 0.2);
    if (b === 8) clapV(t0, 0.7, { rv: 0.6 });
  } },
  soccer: { bpm: 126, play(b, t0, K) {
    const [r, q] = PS[b % 4], s = (n) => t0 + n * K.s16, cyc = b >> 2, br = mf(broot(r, 38));
    padBar(t0, K, r, q, 57, 0.03, 0.25, 0.5, 0.3);
    for (let n = 0; n < 16; n += 2) bassV(br * (n % 8 === 6 ? 2 : 1), s(n), K.s16 * 1.6, 0.3, true, { sc: true });
    [0, 4, 8, 12].forEach((n) => { kickV(s(n), 0.85, {}); K.duck(s(n), 0.5); });
    [4, 12].forEach((n) => clapV(s(n), 0.7, { rv: 0.3 }));
    for (let n = 0; n < 16; n++) { if (n % 4 === 2) hatV(s(n), 0.13, true, { pan: 0.2 }); else if (n % 2) hatV(s(n), 0.06, false, { pan: -0.2 }); }
    if (b % 4 === 3) [12, 13, 14, 15].forEach((n, i) => tomV(s(n), [200, 150, 110, 80][i], 0.45, { pan: [-0.4, -0.15, 0.15, 0.4][i], rv: 0.3 }));
    if (cyc >= 1) {
      [0, 6, 8, 14].forEach((n) => voicing(r, q, 62).slice(0, 3).forEach((m) => brassV(mf(m), s(n), 0.2, 0.025, { rv: 0.25 })));
      (cyc % 2 ? SA : SB)[b % 4].forEach(([n, m, l]) => { brassV(mf(m), s(n), l * K.s16 * 0.95, 0.04, { rv: 0.3 }); pluckV(mf(m), s(n), l * K.s16 + 0.4, 0.11, 1.2, { rv: 0.35, dl: 0.25 }); });
    }
    if (b % 2 === 0) swell(t0, K.bs * 2, 0.05, 1500, 'bandpass', 0);
  } },
  fps: { bpm: 100, play(b, t0, K) {
    const [r, q] = PF[b % 4], s = (n) => t0 + n * K.s16, br = mf(broot(r, 33)), ch = voicing(r, q, 64);
    padBar(t0, K, r, q, 45, 0.04, 1.2, 1.0, 0.5);
    for (let n = 0; n < 16; n += 2) bassV(br, s(n), K.s16 * 1.6, 0.3, true, { sc: true });
    [0, 7, 10].forEach((n) => { kickV(s(n), n ? 0.6 : 0.8, {}); K.duck(s(n), 0.45); });
    snareV(s(12), 0.3, { rv: 0.4 });
    for (let n = 0; n < 16; n++) if (n % 2 || n % 4 === 0) hatV(s(n), 0.045, false, { pan: 0.25 });
    [0, 1, 2, 1, 2, 1, 0, 1].forEach((ix, k) => pluckV(mf(ch[ix] + 12), s(k * 2), 0.3, 0.05, 2.0, { pan: k % 2 ? 0.4 : -0.4, rv: 0.4, dl: 0.5 }));
    [3, 11].forEach((n) => pluckV(mf(88), s(n), 0.5, 0.035, 2.5, { pan: 0.5, rv: 0.5, dl: 0.5 }));
    if (b >= 8) melPhrase(FA, b, t0, K, 0.12, 1.2, { pan: 0.1, rv: 0.5, dl: 0.45 }, 0, 0.4);
    if (b === 7 || b === 15) riserV(t0, K.bs, 0.18);
    if (b === 8) boomV(t0, 0.9);
  } },
  sea: { bpm: 72, play(b, t0, K) {
    const [r, q] = PE[b % 4], s = (n) => t0 + n * K.s16, cyc = b >> 2, ch = voicing(r, q, 60), an = ch.concat([ch[0] + 12, ch[1] + 12]);
    padBar(t0, K, r, q, 52, 0.04, 1.6, 1.8, 0.7);
    [0, 1, 2, 3, 4, 3, 2, 1].forEach((ix, k) => pluckV(mf(an[ix]), s(k * 2), 1.4, 0.09, 0.45, { pan: -0.6 + 1.2 * k / 7, rv: 0.75, dl: 0.25 }));
    epV(mf(broot(r, 40)), t0, 3.0, 0.16, { rv: 0.4 });
    if (cyc >= 1) melPhrase(cyc === 2 ? SeB : SeA, b, t0, K, 0.13, 0.6, { pan: 0.1, rv: 0.7, dl: 0.3 }, 0, 1.2);
    if (b % 2 === 0) { swell(t0, K.bs * 2, 0.1, 600, 'lowpass', -0.5); swell(t0 + 0.7, K.bs * 2, 0.1, 600, 'lowpass', 0.5); }
  } },
};

/* ───────────── 곡 재생 스케줄러 · MP3 우선 재생 ───────────── */
const mp3 = {}; let fileVoices = [], fileName = null, nextLoop = 0, schedErr = false;
function tryMp3(name) {
  if (mp3[name] !== undefined) return; mp3[name] = 0;
  const x = new XMLHttpRequest(); x.open('GET', 'audio/bgm_' + name + '.mp3'); x.responseType = 'arraybuffer';
  x.onload = () => { if (x.response && x.response.byteLength > 2000) ctx.decodeAudioData(x.response).then((b) => { mp3[name] = b; }).catch(() => { mp3[name] = -1; }); else mp3[name] = -1; };
  x.onerror = () => { mp3[name] = -1; console.warn('[audio] MP3 파일을 못 찾아 합성음으로 대신해요:', name); }; x.send();
}
function fileFade(sec) {
  const t = ctx.currentTime;
  fileVoices.forEach((v) => { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + sec); v.src.stop(t + sec + 0.05); } catch (e) { /* 무시 */ } });
  fileVoices = []; fileName = null;
}
/* 파일 앞뒤를 0.5초 겹쳐 이어 붙여요 (MP3 는 앞뒤에 아주 짧은 무음이 있어 단순 반복하면 툭 끊겨요) */
function fileSpawn(buf, at, fi) {
  const src = ctx.createBufferSource(), g = ctx.createGain(), d = buf.duration, xf = Math.min(0.5, d / 4), fin = fi == null ? xf : fi;
  src.buffer = buf; src.connect(g); g.connect(musBus);
  g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(1, at + fin); g.gain.setValueAtTime(1, at + d - xf); g.gain.linearRampToValueAtTime(0, at + d);
  src.start(at); src.stop(at + d + 0.05); const v = { src, g }; fileVoices.push(v); src.onended = () => { fileVoices = fileVoices.filter((q) => q !== v); };
  return at + d - xf;
}
function tick() {
  if (!ctx || ctx.state !== 'running') return;
  if (!engSched) { engSched = true; setTimeout(buildEngine, 1500); }
  if (!curName || !st.on || st.bgm <= 0.001) { if (fileName) fileFade(0.6); if (!curName) killMus(0.6); return; }
  if (MP3_TRACKS.includes(curName)) {
    tryMp3(curName); const b = mp3[curName];
    if (b instanceof AudioBuffer) {
      killMus(0.8);
      if (fileName !== curName) { fileFade(1.0); fileName = curName; nextLoop = fileSpawn(b, ctx.currentTime + 0.05, 1.0); }
      else if (ctx.currentTime >= nextLoop - 0.25) nextLoop = fileSpawn(b, nextLoop);
      return;
    }
  }
  if (fileName) fileFade(1.0);
  if (!cur) return;
  if (!mus || mus.name !== curName) { newMus(curName); nextT = 0; step = 0; }
  const K = cur.K;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.08;
  try { while (nextT < ctx.currentTime + 0.9) { cur.play(step % 16, nextT, K); nextT += K.bs; step++; } }
  catch (e) { if (!schedErr) { schedErr = true; console.error('[audio] 배경음악 오류', e); } }
}
export function playBgm(name) {
  if (name === curName) return; curName = name; cur = TR[name] || null; step = 0; nextT = 0;
  if (cur && !cur.K) { const spb = 60 / cur.bpm; cur.K = { spb, s16: spb / 4, bs: spb * 4, duck: duckSC }; }
  if (!tm) tm = setInterval(tick, 90);
}
export function stopBgm() { curName = null; cur = null; }

/* ───────────── 엔진 소리 — 4기통 점화 파형을 만들고 속도에 맞춰 회전수·변속을 흉내 내요 ───────────── */
const ENG_REF = [['idle', 1000], ['low', 2400], ['mid', 4200], ['high', 6600]];
let engBufs = null, engSched = false, engOn = false, engRpm = 1100, engT = 0, eg = null, egFb = null;
function biq(x, type, f0, Q, gdb, sr) {
  const w = 2 * Math.PI * f0 / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q), A = Math.pow(10, (gdb || 0) / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
}
/** 회전수별 무이음새 루프 1개 (2초) */
function genEngine(rpmT) {
  const sr = 32000, per = 2, revs = Math.max(2, Math.round(rpmT / 60 * 2)), L = Math.round(revs * 60 / rpmT * sr), rpm = revs * 60 * sr / L, nf = revs * per, P = L / nf, N = L * 3, x = new Float32Array(N), ul = Math.floor(P * 1.2);
  const jit = [], amp = []; for (let i = 0; i < nf; i++) { jit.push((rnd() - 0.5) * 0.02 * P); amp.push(1 + (rnd() - 0.5) * 0.18); }
  const shape = new Float32Array(ul); for (let u = 0; u < ul; u++) shape[u] = Math.exp(-u / (0.2 * P)) - Math.exp(-u / (0.025 * P));
  for (let rep = 0; rep < 3; rep++) for (let i = 0; i < nf; i++) { const p0 = Math.round(rep * L + i * P + jit[i]); for (let u = 0; u < ul; u++) { const k = p0 + u; if (k >= 0 && k < N) x[k] += amp[i] * shape[u]; } }
  const fc = 650 + 0.24 * rpm;
  biq(x, 'lp', fc, 0.707, 0, sr); biq(x, 'lp', fc, 0.707, 0, sr);
  biq(x, 'pk', 80 + rpm * 0.012, 2.2, 8, sr); biq(x, 'pk', 250, 2, 5, sr); biq(x, 'pk', 520, 1.6, 3, sr); biq(x, 'hp', 35, 0.707, 0, sr);
  let m = 0, sd = 0; for (let i = L; i < 2 * L; i++) m += x[i]; m /= L; for (let i = L; i < 2 * L; i++) { const d = x[i] - m; sd += d * d; } sd = Math.sqrt(sd / L) + 1e-9;
  for (let i = 0; i < N; i++) x[i] = Math.tanh(1.8 * (x[i] - m) / sd);
  biq(x, 'lp', fc * 2.2, 0.707, 0, sr);
  const out = new Float32Array(L); for (let i = 0; i < L; i++) out[i] = x[L + i];
  const mm = 2000, nz = new Float32Array(L + mm); for (let i = 0; i < nz.length; i++) nz[i] = rnd() * 2 - 1;
  biq(nz, 'lp', 3200, 0.707, 0, sr); biq(nz, 'hp', 500, 0.707, 0, sr);
  for (let i = 0; i < mm; i++) { const f = i / mm; nz[i] = nz[i] * f + nz[L + i] * (1 - f); }
  let s2 = 0, sn = 0; for (let i = 0; i < L; i++) { s2 += out[i] * out[i]; sn += nz[i] * nz[i]; }
  const nl = (0.1 + 0.22 * rpm / 7000) * (Math.sqrt(s2 / L) + 1e-9) / (Math.sqrt(sn / L) + 1e-9);
  let mean = 0, pk = 0; for (let i = 0; i < L; i++) { out[i] += nz[i] * nl * (1 + 0.6 * Math.cos(2 * Math.PI * nf * i / L)); mean += out[i]; } mean /= L;
  for (let i = 0; i < L; i++) { out[i] -= mean; pk = Math.max(pk, Math.abs(out[i])); } for (let i = 0; i < L; i++) out[i] *= 0.8 / pk;
  const buf = ctx.createBuffer(1, L, sr); buf.copyToChannel(out, 0); return buf;
}
function buildEngine() {
  if (engBufs || !ctx) return;
  try { engBufs = ENG_REF.map(([, r]) => genEngine(r)); } catch (e) { console.error('[audio] 엔진 소리 생성 실패(기본 엔진음 사용)', e); engBufs = 'fail'; }
}
const GEARS = [0, 8, 16, 24, 34]; /* 속도(m/s) 구간마다 기어가 바뀌어요: 5단 변속처럼 회전수가 올랐다 뚝 떨어져요 */
const rpmFor = (sp) => { let g = 0; while (g < GEARS.length - 2 && sp > GEARS[g + 1]) g++; const f = Math.min(1.08, Math.max(0, (sp - GEARS[g]) / (GEARS[g + 1] - GEARS[g]))); return g === 0 ? 1100 + f * 4000 : 3000 + f * 3400; };
function engLayers() {
  if (eg || !ctx || !engBufs || engBufs === 'fail') return;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(sfxBus); const L = [];
  engBufs.forEach((b) => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.loop = true; g.gain.value = 0; s.connect(g); g.connect(out); s.start(); L.push({ s, g }); });
  eg = { out, L };
}
function engFallbackSet(v) {
  if (!egFb) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0.05; o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o.start(); o2.start(); egFb = { o, o2, f, g }; }
  const sp = Math.abs(v), hz = 38 + sp * 5, t = ctx.currentTime;
  egFb.o.frequency.setTargetAtTime(hz, t, 0.1); egFb.o2.frequency.setTargetAtTime(hz / 2, t, 0.1); egFb.f.frequency.setTargetAtTime(260 + sp * 25, t, 0.1);
}
export const engine = {
  start() { engOn = true; engT = performance.now(); },
  set(v) {
    if (!engOn || !ctx || ctx.state !== 'running') return;
    if (!engBufs) buildEngine();
    if (engBufs === 'fail') { engFallbackSet(v); return; }
    if (!eg) engLayers(); if (!eg) return;
    const now = performance.now(), dt = Math.min(0.1, (now - engT) / 1000); engT = now;
    const sp = Math.abs(v), tg = rpmFor(sp), k = tg < engRpm - 600 ? 16 : 7; engRpm += (tg - engRpm) * Math.min(1, k * dt);
    const rpm = engRpm + Math.sin(now / 170) * 18, t = ctx.currentTime, lr = Math.log(rpm);
    ENG_REF.forEach(([, ref], i) => {
      const c = Math.log(ref), lo = i > 0 ? Math.log(ENG_REF[i - 1][1]) : c - 0.5, hi = i < 3 ? Math.log(ENG_REF[i + 1][1]) : c + 0.5;
      let w = lr < c ? (lr - lo) / (c - lo) : (hi - lr) / (hi - c); w = Math.max(0, Math.min(1, w));
      if ((i === 0 && lr < c) || (i === 3 && lr > c)) w = 1;
      eg.L[i].g.gain.setTargetAtTime(Math.sin(w * Math.PI / 2), t, 0.04); eg.L[i].s.playbackRate.setTargetAtTime(rpm / ref, t, 0.05);
    });
    eg.out.gain.setTargetAtTime(0.16 + 0.16 * Math.min(1, sp / 30), t, 0.12);
  },
  stop() {
    engOn = false; engRpm = 1100; const e = eg, f = egFb; eg = null; egFb = null; if (!ctx) return;
    if (e) { e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => { e.L.forEach((l) => { try { l.s.stop(); } catch (er) { /* 무시 */ } }); try { e.out.disconnect(); } catch (er) { /* 무시 */ } }, 700); }
    if (f) { try { f.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { try { f.o.stop(); f.o2.stop(); f.g.disconnect(); } catch (er) { /* 무시 */ } }, 400); } catch (er) { /* 무시 */ } }
  },
};