/* ═══════════════════════════════════════════════════════════════
 * src/mobile-ui.js  (신규, H2) — 모바일 화면 정리
 *  1) 첫 터치에 전체화면 진입 + 가로/세로 전환 후에도 다음 터치에 자동 재진입
 *     (브라우저 규칙상 '터치 없이' 자동 전체화면은 불가 → 첫 터치 + 안내 문구)
 *  2) 타이틀: 제목·이름·분류 탭·버튼은 왼쪽 좁은 열, 세부 항목은 오른쪽 패널에 표시
 *  3) "체험하기" 안내 문구를 실제 눌리는 버튼으로 (✋ 버튼과 같은 동작)
 *  4) 단축바(DOGBAR) 축소, 미니맵 축소, 리포트·메뉴는 아이콘 버튼으로 미니맵 옆에 배치
 *  5) 홍보영상·소리 버튼을 화면 위쪽 가운데로 이동 (우측 조작 버튼과 겹침 방지)
 *  6) 체험 화면의 '다음/시작/완료' 버튼을 눈에 띄게 + 스크롤해도 아래에 고정
 *  7) display.js 의 viewport 폭이 input.js 에 덮어써지는 문제 방지
 *
 *  끄기: 주소 뒤 ?fs=0 (자동 전체화면 끔) / ?fs=1 (다시 켬)
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch } from './input.js';
import { UI_W } from './display.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
};

const CSS = `
/* ── 타이틀 ── */
body.touch #title.screen{padding:0;align-items:flex-start;background:linear-gradient(90deg,rgba(6,20,40,.8) 0,rgba(6,20,40,.5) 18%,transparent 32%)}
body.touch #title .title-card{position:absolute;left:calc(8px + env(safe-area-inset-left,0px));top:calc(6px + env(safe-area-inset-top,0px));width:196px;max-height:none;overflow:visible;display:flex;flex-direction:column;gap:6px}
body.touch #title h1{font-size:16px;margin:0;white-space:nowrap;text-shadow:0 2px 6px #000}
body.touch #title .sub{display:none}
body.touch #title .nm{margin:0;font-size:13px;display:flex;align-items:center;gap:6px;white-space:nowrap}
body.touch #title .nm input{width:132px;margin:0;padding:7px 8px;font-size:14px}
body.touch #title #cust{max-height:none;overflow:visible;padding:0}
body.touch #title .ctabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0}
body.touch #title .ctabs .btn{min-height:36px;padding:0 4px;font-size:13px}
body.touch #title.cd-off .ctabs .btn.primary{background:#1d3b66;border-color:#4a74b0;font-weight:400}
body.touch #title .row{margin:0;gap:6px;flex-wrap:nowrap}
body.touch #title #b-rand{min-height:44px;padding:0 10px;flex:none}
body.touch #title #b-start{min-height:44px;flex:1;padding:0 6px;font-size:15px}
body.touch #title #t-info{font-size:11px}
body.touch #cdet{position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(6px + env(safe-area-inset-top,0px));bottom:calc(6px + env(safe-area-inset-bottom,0px));width:min(300px,36vw);overflow-y:auto;pointer-events:auto;padding:8px 10px;background:rgba(8,24,48,.82);border:1px solid #4a74b0;border-radius:14px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
body.touch #title.cd-off #cdet{display:none}
body.touch #cdet .cdh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px}
body.touch #cdet .cdh button{background:#1d3b66;border:1px solid #4a74b0;border-radius:8px;width:34px;height:30px;font-size:14px}
body.touch #cdet .crow{display:block;margin:0 0 10px}
body.touch #cdet .clab{display:block;width:auto;margin:0 0 4px;font-size:12px;opacity:.85}
body.touch #cdet .cbox{gap:6px}
body.touch #cdet .sw{width:34px;height:34px}
body.touch #cdet .sw.txt{width:auto;min-width:34px;height:34px;padding:0 9px;font-size:13px}

/* ── 전체화면 안내 ── */
#fshint{position:fixed;left:50%;top:calc(40px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:60;padding:7px 16px;border-radius:999px;background:rgba(47,123,246,.95);color:#fff;font:700 13px "Malgun Gothic","Noto Sans KR",sans-serif;display:none;box-shadow:0 3px 10px rgba(0,0,0,.4);white-space:nowrap}
#fshint.on{display:block}

/* ── 플레이 HUD ── */
html body.touch #hud #hud-card{left:calc(8px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px));min-width:0;padding:5px 9px;font-size:12px}
html body.touch #hud #hud-name{font-size:13px}
html body.touch #hud #hud-prog{font-size:11px;margin:2px 0}
html body.touch #hud #hud-misc{font-size:11px;margin-top:3px}
html body.touch #hud #hud-right{display:flex;flex-direction:row-reverse;align-items:flex-start;gap:6px;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px))}
html body.touch #hud #mini{width:104px;height:104px;margin:0}
html body.touch #hud #hud-right.big #mini{width:210px;height:210px}
html body.touch #hud .hud-btns{margin:0;flex-direction:column;gap:6px}
html body.touch #hud .hud-btns button{width:40px;height:40px;padding:0;font-size:18px;border-radius:12px}
body.touch #hudx #bar{padding:3px;gap:3px;border-radius:10px;bottom:calc(4px + env(safe-area-inset-bottom,0px))}
body.touch #hudx #bar .slot{width:34px;height:34px;border-radius:8px}
body.touch #hudx #bar .slot b{font-size:15px}
body.touch #hudx #bar .slot i{display:none}

/* ── '체험하기' 버튼화 ── */
html body.touch #hud #prompt{pointer-events:auto;cursor:pointer;z-index:16;bottom:46px!important;max-width:60vw;padding:9px 24px;border-radius:999px;border:2px solid #fff3c4;background:linear-gradient(180deg,#ffd75a,#ffb21f);color:#2a1a00;font-size:15px!important;font-weight:800;box-shadow:0 4px 0 #b97a00,0 6px 14px rgba(0,0,0,.45);animation:muipulse 1.1s infinite;touch-action:manipulation}
html body.touch #hud #prompt::after{content:" ▶"}
@keyframes muipulse{50%{filter:brightness(1.12);transform:translateX(-50%) scale(1.04)}}

/* ── 체험 화면 '다음' 버튼 ── */
#xp .mui-next,.cul .mui-next{position:sticky!important;bottom:6px;z-index:5;background:linear-gradient(180deg,#ffd75a,#ffb21f)!important;color:#2a1a00!important;font-weight:800;border:2px solid #fff3c4!important;box-shadow:0 0 0 4px rgba(255,200,60,.28),0 6px 16px rgba(0,0,0,.45)}
body.touch #xp .card{max-height:calc(100vh - 24px);overflow-y:auto;-webkit-overflow-scrolling:touch}
`;

/* ───────────── 1) 전체화면 ───────────── */
function setupFullscreen() {
  const root = document.documentElement;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!req) return;                                   // iPhone Safari 등: 미지원
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const enter = () => {
    if (isFs()) return;
    try {
      const p = req.call(root, { navigationUI: 'hide' });
      const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* 무시 */ } };
      if (p && p.then) p.then(lock).catch(() => {});
    } catch (e) { /* 무시 */ }
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* 무시 */ }
  };
  const qs = new URLSearchParams(location.search);
  if (qs.has('fs')) store.set('cq_autofs', qs.get('fs') === '0' ? '0' : '1');
  if (store.get('cq_autofs') !== '0') {
    /* 터치가 끝나는 순간(pointerup·click·touchend)만 브라우저가 전체화면을 허용합니다 */
    ['pointerup', 'click', 'touchend'].forEach((ev) => addEventListener(ev, enter, true));
  }
  const hint = document.createElement('div'); hint.id = 'fshint'; hint.textContent = '👆 화면을 터치하면 전체화면으로 전환돼요';
  document.body.append(hint);
  const show = () => hint.classList.toggle('on', !isFs() && innerWidth > innerHeight);
  document.addEventListener('fullscreenchange', () => setTimeout(show, 120));
  document.addEventListener('webkitfullscreenchange', () => setTimeout(show, 120));
  addEventListener('resize', () => setTimeout(show, 150));
  addEventListener('orientationchange', () => setTimeout(show, 300));
  show();
}

/* ───────────── 2) 타이틀 재구성 ───────────── */
function setupTitle() {
  const title = $('#title'), cust = $('#cust');
  const det = document.createElement('div'); det.id = 'cdet'; title.append(det);
  title.classList.add('cd-off');                       // 처음에는 세부 패널을 닫아 캐릭터가 전부 보이게
  const sync = () => {
    const rows = [...cust.querySelectorAll('.crow')];
    if (!rows.length) return;                          // 내가 옮긴 뒤 다시 불린 경우
    const st = det.scrollTop;
    const act = cust.querySelector('.ctabs .btn.primary');
    det.innerHTML = '';
    const hd = document.createElement('div'); hd.className = 'cdh';
    const nm = document.createElement('b'); nm.textContent = act ? act.textContent : '';
    const x = document.createElement('button'); x.textContent = '✕'; x.onclick = () => title.classList.add('cd-off');
    hd.append(nm, x); det.append(hd, ...rows); det.scrollTop = st;
  };
  new MutationObserver(sync).observe(cust, { childList: true });
  cust.addEventListener('click', (e) => {              // 같은 탭을 다시 누르면 닫기
    const b = e.target.closest && e.target.closest('.ctabs .btn'); if (!b) return;
    if (b.classList.contains('primary') && !title.classList.contains('cd-off')) title.classList.add('cd-off');
    else title.classList.remove('cd-off');
  }, true);
  sync();
}

/* ───────────── 3) '체험하기' 안내 → 실제 버튼 ───────────── */
function setupPrompt() {
  const p = $('#prompt'); if (!p) return;
  const press = () => {
    const u = document.querySelector('#tc .tb.use');   // ✋ 버튼과 같은 경로 사용
    if (u) {
      const o = { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'touch', isPrimary: true };
      u.dispatchEvent(new PointerEvent('pointerdown', o));
      setTimeout(() => u.dispatchEvent(new PointerEvent('pointerup', o)), 60);
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true })), 60);
    }
  };
  p.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(); });
}

/* ───────────── 4~6) 주기적 정리 (0.7초마다, 가벼운 검사만) ───────────── */
const PROMO_RE = /홍보영상|소리\s*(켬|끔)/;
const NEXT_RE = /^\s*(▶|➡|→|⏭)?\s*(다음|계속|시작하기|결과\s*보기|완료|제출)/;
function tick() {
  const rep = $('#b-report'), men = $('#b-menu');
  if (rep && rep.textContent !== '📊') { rep.textContent = '📊'; rep.title = '리포트'; }
  if (men && men.textContent !== '⏸') { men.textContent = '⏸'; men.title = '메뉴'; }
  /* 홍보영상·소리 버튼 → 위쪽 가운데 */
  [...document.body.children]
    .filter((e) => e.id !== 'hud' && e.id !== 'toast' && e.id !== 'fshint' && e.textContent.length < 50 && PROMO_RE.test(e.textContent))
    .slice(0, 2).forEach((e, i) => {
      const s = (k, v) => e.style.setProperty(k, v, 'important');
      s('position', 'fixed'); s('top', 'calc(44px + env(safe-area-inset-top,0px))'); s('bottom', 'auto'); s('right', 'auto'); s('left', '50%');
      s('margin', '0'); s('z-index', '30'); s('font-size', '13px'); s('padding', '6px 12px'); s('min-height', '34px');
      s('transform', i === 0 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)');
    });
  /* 체험 화면의 진행 버튼 표시 */
  if ($('#xp') || $('.cul')) {
    document.querySelectorAll('#xp button, .cul button').forEach((b) => {
      if (!b.classList.contains('mui-next') && NEXT_RE.test(b.textContent || '')) b.classList.add('mui-next');
    });
  }
}

/* ───────────── 7) viewport 폭 고정 (input.js 의 device-width 덮어쓰기 방지) ───────────── */
function guardViewport() {
  const want = `width=${UI_W},user-scalable=no,viewport-fit=cover`;
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.append(m); }
  const set = () => { if (m.getAttribute('content') !== want) m.setAttribute('content', want); };
  set(); new MutationObserver(set).observe(m, { attributes: true, attributeFilter: ['content'] });
}

function boot() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  guardViewport();
  setupFullscreen();
  setupPrompt();
  setInterval(tick, 700); tick();
  const t = setInterval(() => { if ($('#cust') && $('#title')) { clearInterval(t); setupTitle(); } }, 80);
  window.__mui = () => ({ fs: !!document.fullscreenElement, uiW: UI_W, vp: (document.querySelector('meta[name="viewport"]') || {}).content, css: innerWidth + 'x' + innerHeight });
}

if (isTouch) boot();