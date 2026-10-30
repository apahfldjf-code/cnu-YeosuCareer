/* ═══════════════════════════════════════════════════════════════
 * src/input.js  (신규, M1 단계) — 모바일 입력·화면 계층
 *  - 왼쪽 화면 누르고 밀기 = 가상 조이스틱(끝까지 밀면 달리기)
 *  - 오른쪽 화면 드래그 = 시점 회전
 *  - 오른쪽 아래 버튼: 공격 · 강타/조준(토글) · 점프 · ✋상호작용 · 재장전 · 시점전환 · 브레이크 · 레이스 취소
 *  - 화질 3단계(상/중/하), 전체화면·가로고정·화면 꺼짐 방지, 진동 피드백, 가로 화면 안내
 * PC(마우스·키보드)에서는 아무 것도 하지 않습니다. 테스트: 주소 뒤에 ?touch=1
 * ═══════════════════════════════════════════════════════════════ */
const qs = new URLSearchParams(location.search);
export const isTouch = qs.get('touch') === '1' || (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
export const joy = { x: 0, y: 0 };
export const buzz = (ms = 20) => { try { if (isTouch && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 무시 */ } };

/* ───────────── 화질 ───────────── */
export const QUALITIES = {
  high: { label: '상', prD: 2, prT: 3, shadow: true, map: 2048 },
  mid: { label: '중', prD: 1.5, prT: 2.25, shadow: true, map: 1024 },
  low: { label: '하', prD: 1, prT: 1.5, shadow: false, map: 1024 },
};
let prTarget = 1, prNow = 1, prAcc = 0, prN = 0, prHold = 2;
export function applyQuality(q, renderer, sun, S) {
  const c = QUALITIES[q] || QUALITIES.high;
  prTarget = Math.max(1, Math.min(devicePixelRatio || 1, isTouch ? c.prT : c.prD));
  prNow = prTarget; prHold = 2; prAcc = 0; prN = 0;
  renderer.setPixelRatio(prNow);
  sun.castShadow = c.shadow;
  if (sun.shadow.mapSize.x !== c.map) {
    sun.shadow.mapSize.set(c.map, c.map);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  if (S) S.settings.shadow = c.shadow;
}
/* 프레임이 떨어지면 해상도를 0.25씩 낮추고, 여유가 생기면 다시 올려요 (매 프레임 호출) */
export function adaptQuality(renderer, dt) {
  if (document.hidden) return;
  prAcc += dt; prN++; if (prAcc < 2) return;
  const fps = prN / prAcc; prAcc = 0; prN = 0;
  if (prHold > 0) { prHold--; return; }
  let nx = prNow;
  if (fps < 42 && prNow > 1) nx = Math.max(1, prNow - 0.25);
  else if (fps > 56 && prNow < prTarget) nx = Math.min(prTarget, prNow + 0.25);
  if (nx !== prNow) { prNow = nx; prHold = 1; renderer.setPixelRatio(prNow); }
}
export const renderInfo = (r) => `📐 렌더 ${r.domElement.width}×${r.domElement.height} · 배율 ${r.getPixelRatio().toFixed(2)} (목표 ${prTarget.toFixed(2)} · 기기 ${(devicePixelRatio || 1).toFixed(2)})`;


/* ───────────── 전체화면 · 가로 고정 · 화면 꺼짐 방지 (시작 버튼 클릭 안에서 호출) ───────────── */
export function goFullscreen() {
  if (!isTouch) return;
  try {
    const d = document.documentElement, p = d.requestFullscreen && d.requestFullscreen({ navigationUI: 'hide' });
    if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
  } catch (e) { /* iOS Safari 는 미지원 */ }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* 무시 */ }
}

export const TOUCH_HELP = '<h2>❓ 조작법 (터치)</h2><ul>'
  + '<li>왼쪽 화면을 누른 채 밀면 <b>이동</b> (끝까지 밀면 달리기)</li>'
  + '<li>오른쪽 화면을 드래그하면 <b>시점 회전</b></li>'
  + '<li>🔫/👊 공격(잽·발사) · 💥/🎯 강타·조준(누를 때마다 켜짐/꺼짐) · ⤒ 점프</li>'
  + '<li>✋ 버튼이 나타나면 눌러서 체험·줍기·포털 이동·카트 내리기</li>'
  + '<li>🔄 재장전 · 👁 1/3인칭 · 아래 단축바로 가방·지도·리포트·설정</li>'
  + '<li>카트: 조이스틱으로 가속·조향 · 🛑 브레이크 · 레이스 중 ✖ 취소</li></ul>';

/* ───────────── 스타일 (touch 일 때만 적용) ───────────── */
const CSS = `
body.touch{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
body.touch #gl{touch-action:none}
body.touch .btn{min-height:44px;font-size:15px}
body.touch #modal-box{max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}
body.touch #title{overflow-y:auto}
body.touch #cust{max-height:30vh}
body.touch .sw{width:34px;height:34px}
body.touch .sw.txt{width:auto;min-width:34px;padding:0 10px}
body.touch #bar{bottom:calc(6px + env(safe-area-inset-bottom,0px));padding:4px;gap:4px;border-radius:12px}
body.touch .slot{width:44px;height:44px;border-radius:10px}
body.touch .slot b{font-size:19px}
body.touch .slot small{display:none}
body.touch .slot i{font-size:9px;left:4px;top:1px}
body.touch #hpbox{left:50%;transform:translateX(-50%);bottom:auto;top:44px;width:190px;height:18px}
body.touch #hptxt{line-height:18px;font-size:11px}
body.touch #ammobox{right:auto;left:50%;transform:translateX(-50%);bottom:auto;top:68px;padding:3px 10px;font-size:12px}
body.touch #wtag{font-size:12px;top:8px}
body.touch #prompt{bottom:62px!important;max-width:60vw;font-size:13px!important}
#tc{position:fixed;inset:0;pointer-events:none;z-index:15;display:none;font-family:sans-serif}
#tc.on{display:block}
.tb{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;background:rgba(15,30,60,.55);border:2px solid rgba(255,255,255,.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;-webkit-tap-highlight-color:transparent}
.tb.big{font-size:32px;background:rgba(220,70,60,.6)}
.tb.dn{background:rgba(80,140,255,.85);transform:scale(.92)}
.tb.act{background:rgba(60,190,130,.85)}
.tb.use{background:rgba(255,200,60,.8);animation:tbp 1s infinite}
@keyframes tbp{50%{box-shadow:0 0 0 9px rgba(255,210,80,.25)}}
#jb{position:fixed;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.4);pointer-events:none;opacity:.3;z-index:15;display:none}
#jb.show{display:block}
#jb.on{opacity:.8}
#jk{position:absolute;left:32px;top:32px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.65)}
#rot{position:fixed;inset:0;z-index:99;background:#0f2547;color:#fff;display:none;align-items:center;justify-content:center;text-align:center;font:700 20px/1.7 "Malgun Gothic",sans-serif}
`;

/* ───────────── 버튼 정의 (s 크기, r 오른쪽 여백, b 아래 여백) ───────────── */
const SP = (h) => h.keys.add('Space'), SPX = (h) => h.keys.delete('Space');
const BTN = [
  { id: 'atk', big: 1, s: 78, r: 24, b: 40, ic: (c) => (c.gun ? '🔫' : '👊'), when: (c) => !c.kart, down: (h) => h.atk(true), up: (h) => h.atk(false) },
  { id: 'alt', s: 56, r: 114, b: 30, ic: (c) => (c.gun ? '🎯' : '💥'), when: (c) => !c.kart, down: (h) => h.alt(true) },
  { id: 'jump', s: 54, r: 30, b: 132, ic: () => '⤒', when: (c) => !c.kart, down: SP, up: SPX },
  { id: 'use', cls: 'use', s: 66, r: 112, b: 106, ic: () => '✋', when: (c) => c.prompt && !c.race, down: (h) => h.key('KeyE') },
  { id: 'rel', s: 46, r: 30, b: 198, ic: () => '🔄', when: (c) => c.world === 'fps' && !c.kart, down: (h) => h.key('KeyR') },
  { id: 'view', s: 46, r: 84, b: 198, ic: () => '👁', when: (c) => c.world === 'fps' && !c.kart, down: (h) => h.key('KeyV') },
  { id: 'brake', big: 1, s: 78, r: 24, b: 40, ic: () => '🛑', when: (c) => c.kart, down: SP, up: SPX },
  { id: 'cancel', s: 50, r: 114, b: 30, ic: () => '✖', when: (c) => c.race, down: (h) => h.key('Escape') },
];

/* ───────────── 초기화 ───────────── */
let ctx = { mode: 'title' }, sync = () => {}, resetJoy = () => {};
export function touchSync(c) { ctx = c; sync(); }

export function initTouch(h) {
  if (!isTouch) return;
  document.body.classList.add('touch');
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  let mt = document.querySelector('meta[name=viewport]');
  if (!mt) { mt = document.createElement('meta'); mt.name = 'viewport'; document.head.append(mt); }
  mt.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e; };
  const tc = mk('div', 'tc'), jb = mk('div', 'jb', 'show'), jk = mk('div', 'jk'), rot = mk('div', 'rot');
  jb.append(jk); rot.innerHTML = '📱 화면을 <b>가로</b>로 돌려 주세요'; document.body.append(tc, jb, rot);

  const els = BTN.map((d) => {
    const b = mk('div', '', 'tb' + (d.big ? ' big' : '') + (d.cls ? ' ' + d.cls : ''));
    b.style.width = b.style.height = d.s + 'px';
    b.style.right = `calc(${d.r}px + env(safe-area-inset-right,0px))`; b.style.bottom = `calc(${d.b}px + env(safe-area-inset-bottom,0px))`;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (ctx.mode !== 'play') return;
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
      b.classList.add('dn'); buzz(10); d.down(h);
    });
    const up = () => { if (!b.classList.contains('dn')) return; b.classList.remove('dn'); if (d.up) d.up(h); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    tc.append(b); return { d, b, ic: '' };
  });

  /* 조이스틱(왼쪽 45%) + 시점 드래그(그 밖) — 캔버스 위에서만 동작 */
  const cvs = document.getElementById('gl'); let mv = null, lk = null;
  const idle = () => { jb.style.left = 'calc(96px + env(safe-area-inset-left,0px))'; jb.style.top = (innerHeight - 96) + 'px'; jb.classList.remove('on'); jk.style.transform = ''; };
  resetJoy = () => { mv = null; lk = null; joy.x = joy.y = 0; h.keys.delete('ShiftLeft'); idle(); };
  idle();
  cvs.addEventListener('pointerdown', (e) => {
    if (ctx.mode !== 'play') return; e.preventDefault();
    try { cvs.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
    if (e.clientX < innerWidth * 0.45 && !mv) { mv = { id: e.pointerId, ox: e.clientX, oy: e.clientY }; jb.style.left = e.clientX + 'px'; jb.style.top = e.clientY + 'px'; jb.classList.add('on'); }
    else if (!lk) lk = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
  });
  cvs.addEventListener('pointermove', (e) => {
    if (mv && e.pointerId === mv.id) {
      const R = 56; let dx = e.clientX - mv.ox, dy = e.clientY - mv.oy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      joy.x = dx / R; joy.y = -dy / R; const m = Math.hypot(joy.x, joy.y);
      if (m < 0.12) joy.x = joy.y = 0;
      jk.style.transform = `translate(${dx}px,${dy}px)`;
      if (m > 0.88) h.keys.add('ShiftLeft'); else h.keys.delete('ShiftLeft');
    } else if (lk && e.pointerId === lk.id) {
      h.look((e.clientX - lk.lx) * 1.5, (e.clientY - lk.ly) * 1.5); lk.lx = e.clientX; lk.ly = e.clientY;
    }
  });
  const end = (e) => { if (mv && e.pointerId === mv.id) { mv = null; joy.x = joy.y = 0; h.keys.delete('ShiftLeft'); idle(); } if (lk && e.pointerId === lk.id) lk = null; };
  cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', end);

  /* 상태가 바뀔 때만 DOM 갱신 */
  let last = '';
  sync = () => {
    const c = ctx, k = [c.mode, c.world, c.kart, c.race, c.gun, c.prompt, c.ads].join('|');
    if (k === last) return; last = k;
    const play = c.mode === 'play'; tc.classList.toggle('on', play); jb.style.display = play ? 'block' : 'none';
    if (!play) resetJoy();
    els.forEach((o) => {
      o.b.style.display = o.d.when(c) ? 'flex' : 'none';
      const ic = o.d.ic(c); if (ic !== o.ic) { o.ic = ic; o.b.textContent = ic; }
      if (o.d.id === 'alt') o.b.classList.toggle('act', !!c.ads);
    });
  };
  const chk = () => { rot.style.display = innerHeight > innerWidth ? 'flex' : 'none'; idle(); };
  addEventListener('resize', chk); addEventListener('orientationchange', () => setTimeout(chk, 250)); chk();
}