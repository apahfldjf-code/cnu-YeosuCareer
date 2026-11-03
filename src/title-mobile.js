/* ═══════════════════════════════════════════════════════════════
 * src/title-mobile.js (신규) — 모바일 가로 시작 화면 재배치
 *
 *  왼쪽 33%  : 제목 · 닉네임 · 탭(머리/얼굴/옷/…) · 랜덤 · 탐험 시작
 *  가운데    : 캐릭터가 보이는 빈 공간
 *  오른쪽 31%: 선택한 탭의 세부 옵션 (스크롤)
 *
 *  + 화면을 터치하면 전체화면·가로 고정을 요청합니다.
 *    (세로로 돌렸다가 가로로 돌아와 한 번 터치해도 다시 전체화면)
 *    끄고 싶으면 콘솔에서  localStorage.setItem('cq_fs','0')
 *
 *  ※ 터치 기기에서만 동작합니다. PC 화면은 바뀌지 않아요.
 *  ※ game.js 맨 위 import 목록에  import './title-mobile.js';  한 줄을 추가하세요.
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch } from './input.js';

const CSS = `
@media (orientation:landscape){
  body.touch #title:not(.hidden){
    position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;
    width:33vw!important;max-width:none!important;height:100vh!important;height:100dvh!important;max-height:none!important;
    margin:0!important;padding:2.4vh 1.6vw 2.4vh calc(1.6vw + env(safe-area-inset-left,0px))!important;
    box-sizing:border-box!important;transform:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;
    display:flex!important;flex-direction:column!important;justify-content:center!important;gap:1.7vh!important;overflow:hidden!important;
    background:linear-gradient(90deg,rgba(6,16,38,.9) 0%,rgba(6,16,38,.76) 72%,rgba(6,16,38,0) 100%)!important}
  body.touch #title:not(.hidden)>*{flex:none!important;max-width:100%!important;box-sizing:border-box!important}
  body.touch #title h1{font-size:max(15px,5.4vh)!important;line-height:1.15!important;margin:0!important;white-space:nowrap!important}
  body.touch #title>p{display:none!important}
  body.touch #t-info{font-size:max(10px,3vh)!important;margin:0!important;opacity:.85}

  body.touch #title .tm-row{display:flex!important;align-items:center!important;gap:1vh!important;margin:0!important}
  body.touch #title .tm-row label,body.touch #title .tm-row span{font-size:max(12px,3.8vh)!important;white-space:nowrap!important;margin:0!important;width:auto!important}
  body.touch #in-name{flex:1 1 0!important;min-width:0!important;width:100%!important;height:9.2vh!important;min-height:30px!important;
    font-size:max(13px,4vh)!important;padding:0 1.3vh!important;box-sizing:border-box!important;border-radius:1.4vh!important}

  body.touch #cust{max-height:none!important;overflow:visible!important;padding:0!important;margin:0!important}
  body.touch #cust .ctabs{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:.9vh!important;margin:0!important}
  body.touch #cust .ctabs .btn{height:8.6vh!important;min-height:28px!important;padding:0 .3vw!important;margin:0!important;
    font-size:max(12px,3.7vh)!important;white-space:nowrap!important;border-radius:1.4vh!important}

  body.touch #title .tm-btns{display:flex!important;gap:1vh!important;margin:0!important}
  body.touch #title .tm-btns .btn{flex:1 1 0!important;height:10.2vh!important;min-height:32px!important;padding:0 1vh!important;margin:0!important;
    font-size:max(12px,4vh)!important;white-space:nowrap!important;border-radius:1.5vh!important}
  body.touch #title .tm-btns #b-start{flex:1.7 1 0!important}

  #copt{position:fixed;top:0;right:0;bottom:0;width:31vw;box-sizing:border-box;z-index:30;display:none;color:#fff;
    padding:2.4vh calc(1.4vw + env(safe-area-inset-right,0px)) 2.4vh 2.4vw;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
    background:linear-gradient(270deg,rgba(6,16,38,.9) 0%,rgba(6,16,38,.76) 72%,rgba(6,16,38,0) 100%);
    font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
  #copt .crow{display:block!important;margin:0 0 2vh!important}
  #copt .clab{display:block!important;width:auto!important;font-size:max(11px,3.5vh)!important;font-weight:700;opacity:.85;margin:0 0 .8vh!important}
  #copt .cbox{display:flex!important;flex-wrap:wrap!important;gap:1vh!important}
  #copt .sw{width:6.8vh!important;height:6.8vh!important;min-width:28px!important;min-height:28px!important;border-radius:50%!important;flex:none!important}
  #copt .sw.txt{width:auto!important;height:auto!important;min-height:28px!important;border-radius:1.3vh!important;padding:.7vh 1.3vh!important;
    font-size:max(12px,3.7vh)!important;white-space:nowrap!important}
}
@media (orientation:portrait){ #copt{display:none!important} }
`;

function boot() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const copt = document.createElement('div'); copt.id = 'copt'; document.body.append(copt);

  let tagged = false;
  const sync = () => {
    const title = document.getElementById('title'); if (!title) return;
    const hidden = title.classList.contains('hidden');
    copt.style.display = hidden ? 'none' : '';
    if (!tagged) {
      const n = document.getElementById('in-name'), b = document.getElementById('b-start');
      if (n && n.parentElement && n.parentElement !== title) n.parentElement.classList.add('tm-row');
      if (b && b.parentElement && b.parentElement !== title) b.parentElement.classList.add('tm-btns');
      tagged = !!(n && b);
    }
    const rows = title.querySelectorAll('#cust .crow');
    if (rows.length) { copt.replaceChildren(...rows); copt.scrollTop = 0; }
  };

  const start = () => {
    const title = document.getElementById('title');
    if (!title) { requestAnimationFrame(start); return; }
    new MutationObserver(sync).observe(title, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* 전체화면 · 가로 고정 : 터치할 때마다 전체화면이 아니면 다시 요청 */
  const tryFs = () => {
    try { if (localStorage.getItem('cq_fs') === '0') return; } catch (e) { /* 무시 */ }
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const e = document.documentElement, rq = e.requestFullscreen || e.webkitRequestFullscreen; if (!rq) return;
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (x) { /* 무시 */ } };
    try { const p = rq.call(e); if (p && p.then) p.then(lock).catch(() => {}); else lock(); } catch (x) { /* 무시 */ }
  };
  document.addEventListener('pointerup', tryFs, true);
}

if (isTouch) boot();