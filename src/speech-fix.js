/* ═══════════════════════════════════════════════════════════════
 * src/speech-fix.js (신규) — 모바일 음성 재생(TTS) 보정
 *  game.js 맨 위쪽에 한 줄만 추가:   import './speech-fix.js';
 *
 *  1) 첫 터치에서 소리 없는 발화를 한 번 재생해 브라우저 음성 엔진을 깨웁니다.
 *  2) 폰에서 getVoices() 가 비어 있거나 특정 언어가 없어도 hasVoice 류 검사가 통과하도록
 *     목록에 기본 언어(ko/en/ja/zh) 항목을 보강합니다. (utterance.voice 로는 들어가지 않게 막음)
 *  3) cancel() 직후 speak() 가 무시되는 문제를 90ms 간격으로 피합니다.
 *  4) 3초 안에 재생이 시작되지 않으면 "음성 데이터 설치" 안내 토스트를 띄웁니다.
 *  콘솔 점검: __tts()
 * ═══════════════════════════════════════════════════════════════ */
const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
const state = { primed: false, started: 0, fails: [], langs: {} };

if (ss && typeof SpeechSynthesisUtterance !== 'undefined') {
  const norm = (l) => String(l || '').replace('_', '-').toLowerCase();
  const WANT = ['ko-KR', 'en-US', 'ja-JP', 'zh-CN'];
  const realGet = ss.getVoices.bind(ss), realSpeak = ss.speak.bind(ss), realCancel = ss.cancel.bind(ss);
  let lastCancel = 0;

  /* 2) 음성 목록 보강 */
  ss.getVoices = () => {
    const v = realGet() || [];
    const have = new Set(v.map((x) => norm(x.lang).slice(0, 2)));
    const extra = WANT.filter((l) => !have.has(l.slice(0, 2)))
      .map((l) => ({ lang: l, name: 'default ' + l, default: false, localService: true, voiceURI: 'cq-' + l, __fake: true }));
    return v.concat(extra);
  };
  const d = Object.getOwnPropertyDescriptor(SpeechSynthesisUtterance.prototype, 'voice');
  if (d && d.set) {
    Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', {
      configurable: true, get: d.get,
      set(v) { if (v && v.__fake) return; d.set.call(this, v); },
    });
  }

  /* 3) 취소 직후 재생 보호 + 4) 시작 감시 */
  ss.cancel = () => { lastCancel = performance.now(); realCancel(); };
  ss.speak = (u) => {
    const go = () => {
      try { ss.resume(); } catch (e) { /* 무시 */ }
      let began = false;
      u.addEventListener('start', () => { began = true; state.started++; });
      u.addEventListener('error', (ev) => { if (ev.error && !/interrupted|canceled/.test(ev.error)) state.fails.push(ev.error + ' ' + u.lang); });
      realSpeak(u);
      setTimeout(() => {
        if (began) return;
        const k = norm(u.lang).slice(0, 2);
        if (state.langs[k]) return; state.langs[k] = 1;
        toast('🔇 이 기기에서 ' + ({ en: '영어', ja: '일본어', zh: '중국어', ko: '한국어' }[k] || u.lang)
          + ' 음성이 나오지 않아요.\n설정 → 일반 → 언어 → 텍스트 음성 변환에서 해당 언어 음성 데이터를 설치해 주세요.');
      }, 3000);
    };
    const wait = 90 - (performance.now() - lastCancel);
    if (wait > 0) setTimeout(go, wait); else go();
  };

  /* 1) 첫 터치에서 엔진 깨우기 */
  const prime = () => {
    if (state.primed) return; state.primed = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; realSpeak(u); } catch (e) { /* 무시 */ }
    try { ss.getVoices(); } catch (e) { /* 무시 */ }
  };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((t) => addEventListener(t, prime, { capture: true, passive: true }));

  window.__tts = () => ({ ...state, real: realGet().map((v) => v.lang).join(','), speaking: ss.speaking });
}

function toast(msg) {
  const e = document.createElement('div');
  e.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:200;max-width:80vw;padding:10px 16px;border-radius:12px;'
    + 'background:rgba(10,30,60,.92);color:#fff;font:700 13px/1.5 "Malgun Gothic",sans-serif;white-space:pre-line;text-align:center;pointer-events:none';
  e.textContent = msg; document.body.append(e); setTimeout(() => e.remove(), 6500);
}