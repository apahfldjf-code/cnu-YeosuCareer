/* ═══════════════════════════════════════════════════════════════
 * src/title-mobile.js v2 (통교체) — 모바일 가로 시작 화면
 *
 *  왼쪽 34%  : 제목 · 닉네임 · 탭(머리/얼굴/옷/…) · 랜덤 · 탐험 시작
 *  가운데    : 캐릭터가 보이는 빈 공간
 *  오른쪽 30%: 선택한 탭의 세부 옵션 (스크롤)
 *
 *  v1 이 안 먹던 이유와 고친 점
 *   1) 실제 구조는 #title(전체 화면 래퍼) > .title-card(내용). v1 은 #title 을 줄여서 .title-card 의
 *      고정폭 400px 이 그대로 남았음 → 이제 .title-card 를 직접 왼쪽 패널로 만듦
 *   2) 모바일 브라우저의 100vh 는 주소창 뒤까지 포함해서 아래·위가 잘림 → 실제 보이는 높이(innerHeight)로 계산
 *   3) input.js / touch-hud.js 가 나중에 추가하는 스타일에 밀릴 수 있음 → 선택자 우선순위를 높이고
 *      스타일을 맨 뒤로 다시 붙임
 *
 *  끄고 싶으면(전체화면)  localStorage.setItem('cq_fs','0')
 *  점검(콘솔)            __tm()
 *  ※ 터치 기기에서만 동작. PC 화면은 바뀌지 않아요.
 *  ※ game.js 맨 위에  import './title-mobile.js';  가 있어야 해요 (이미 있음)
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch } from './input.js';

const U = 'var(--u,4px)';
const CSS = `
html body.touch.tm-land #title:not(.hidden){background:none!important}
html body.touch.tm-land #title:not(.hidden) .title-card{
  position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;
  width:34vw!important;max-width:none!important;height:calc(${U}*100)!important;max-height:none!important;margin:0!important;
  padding:calc(${U}*3) calc(${U}*3) calc(${U}*3) calc(${U}*3 + env(safe-area-inset-left,0px))!important;
  box-sizing:border-box!important;overflow:hidden!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;
  display:flex!important;flex-direction:column!important;justify-content:center!important;gap:calc(${U}*1.8)!important;pointer-events:auto!important;
  background:linear-gradient(90deg,rgba(6,16,38,.92) 0%,rgba(6,16,38,.8) 75%,rgba(6,16,38,0) 100%)!important}
html body.touch.tm-land #title:not(.hidden) .title-card>*{flex:none!important;margin:0!important;max-width:100%!important;box-sizing:border-box!important}
html body.touch.tm-land #title .title-card h1{font-size:calc(${U}*5.4)!important;line-height:1.15!important;white-space:nowrap!important}
html body.touch.tm-land #title .title-card .sub{display:none!important}
html body.touch.tm-land #title .title-card #t-info{display:none!important}
html body.touch.tm-land #title .title-card .nm{display:flex!important;align-items:center!important;gap:calc(${U}*1.2)!important;font-size:calc(${U}*4)!important;white-space:nowrap!important}
html body.touch.tm-land #title .title-card .nm input{flex:1 1 0!important;min-width:0!important;width:auto!important;margin:0!important;height:calc(${U}*9.5)!important;
  font-size:calc(${U}*4.2)!important;padding:0 calc(${U}*1.5)!important;border-radius:calc(${U}*1.5)!important}
html body.touch.tm-land #title #cust{max-height:none!important;overflow:visible!important;padding:0!important;margin:0!important}
html body.touch.tm-land #title #cust .ctabs{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:calc(${U}*1)!important;margin:0!important}
html body.touch.tm-land #title #cust .ctabs .btn{height:calc(${U}*8.8)!important;min-height:0!important;padding:0 2px!important;margin:0!important;
  font-size:calc(${U}*3.8)!important;white-space:nowrap!important;border-radius:calc(${U}*1.5)!important;line-height:1!important}
html body.touch.tm-land #title .title-card .row{display:flex!important;flex-wrap:nowrap!important;gap:calc(${U}*1)!important;margin:0!important}
html body.touch.tm-land #title .title-card .row .btn{flex:1 1 0!important;height:calc(${U}*10.5)!important;min-height:0!important;padding:0 calc(${U}*1)!important;margin:0!important;
  font-size:calc(${U}*4.2)!important;white-space:nowrap!important;border-radius:calc(${U}*1.6)!important;line-height:1!important}
html body.touch.tm-land #title .title-card .row #b-start{flex:1.7 1 0!important}

#copt{position:fixed;top:0;right:0;bottom:auto;height:calc(${U}*100);width:30vw;box-sizing:border-box;z-index:30;display:none;color:#fff;pointer-events:auto;
  padding:calc(${U}*3) calc(${U}*2 + env(safe-area-inset-right,0px)) calc(${U}*3) calc(${U}*3);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  background:linear-gradient(270deg,rgba(6,16,38,.92) 0%,rgba(6,16,38,.8) 75%,rgba(6,16,38,0) 100%);
  font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
body:not(.tm-land) #copt{display:none!important}
#copt .crow{display:block!important;margin:0 0 calc(${U}*2.2)!important}
#copt .clab{display:block!important;width:auto!important;font-size:calc(${U}*3.6)!important;font-weight:700;opacity:.85;margin:0 0 calc(${U}*.8)!important}
#copt .cbox{display:flex!important;flex-wrap:wrap!important;gap:calc(${U}*1.1)!important}
#copt .sw{width:calc(${U}*7.2)!important;height:calc(${U}*7.2)!important;min-width:26px!important;min-height:26px!important;border-radius:50%!important;flex:none!important;padding:0!important}
#copt .sw.txt{width:auto!important;height:auto!important;min-height:26px!important;border-radius:calc(${U}*1.4)!important;padding:calc(${U}*.9) calc(${U}*1.6)!important;
  font-size:calc(${U}*3.8)!important;white-space:nowrap!important}
`;

function boot() {
  const root = document.documentElement, body = document.body;
  const st = document.createElement('style'); st.id = 'tm-css'; st.textContent = CSS; document.head.append(st);
  const copt = document.createElement('div'); copt.id = 'copt'; body.append(copt);
  const land = window.matchMedia('(orientation:landscape)');

  /* 실제로 보이는 높이의 1% = --u  (주소창이 있어도 안 잘림) */
  const setU = () => { root.style.setProperty('--u', (window.innerHeight / 100).toFixed(3) + 'px'); };
  let tagged = false;
  const sync = () => {
    setU();
    const L = land.matches;
    body.classList.toggle('tm-land', L);
    const title = document.getElementById('title'); if (!title) return;
    const hidden = title.classList.contains('hidden');
    copt.style.display = hidden || !L ? 'none' : 'block';
    const cust = document.getElementById('cust');
    /* 가로: 세부 옵션을 오른쪽 패널로 / 세로: 원래 자리로 */
    if (L) {
      const rows = title.querySelectorAll('#cust .crow');
      if (rows.length) { copt.replaceChildren(...rows); copt.scrollTop = 0; }
    } else if (cust && copt.children.length) {
      const tabs = cust.querySelector('.ctabs');
      [...copt.children].forEach((r) => cust.append(r));
      if (tabs) cust.prepend(tabs);
    }
    tagged = true;
  };

  const start = () => {
    const title = document.getElementById('title');
    if (!title) { requestAnimationFrame(start); return; }
    new MutationObserver(sync).observe(title, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => setTimeout(sync, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', sync);
  if (land.addEventListener) land.addEventListener('change', sync);

  /* 다른 파일(input.js · touch-hud.js)이 나중에 붙이는 스타일에 밀리지 않게 맨 뒤로 다시 붙임 */
  const last = () => { if (st.parentNode) document.head.append(st); sync(); };
  setTimeout(last, 0); setTimeout(last, 800); window.addEventListener('load', last);

  /* 전체화면 · 가로 고정 : 터치할 때마다 전체화면이 아니면 다시 요청 */
  const tryFs = () => {
    try { if (localStorage.getItem('cq_fs') === '0') return; } catch (e) { /* 무시 */ }
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const e = document.documentElement, rq = e.requestFullscreen || e.webkitRequestFullscreen; if (!rq) return;
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (x) { /* 무시 */ } };
    try { const p = rq.call(e); if (p && p.then) p.then(lock).catch(() => {}); else lock(); } catch (x) { /* 무시 */ }
  };
  document.addEventListener('pointerup', tryFs, true);

  /* 점검용: 콘솔에서 __tm() */
  window.__tm = () => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const card = document.querySelector('#title .title-card');
    return {
      touchClass: body.classList.contains('touch'), land: land.matches, tmLand: body.classList.contains('tm-land'),
      u: root.style.getPropertyValue('--u'), css: !!document.getElementById('tm-css'),
      card: r(card), copt: r(copt), coptRows: copt.children.length, view: [innerWidth, innerHeight],
      cardPos: card ? getComputedStyle(card).position : null,
    };
  };
}

if (isTouch) boot();
