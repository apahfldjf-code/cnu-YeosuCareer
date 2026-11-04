/* ═══════════════════════════════════════════════════════════════
 * src/touch-hud.js (신규, U3) — 모바일 화면 정리
 *
 * 1) 부스 앞에 뜨는 "체험하기" 상자를 눌러서 바로 체험을 시작합니다.
 *    - 부스뿐 아니라 리포트 단말기, 레이싱 센터, 포털, FPS 줍기(F), 카트 내리기에도 똑같이 적용돼요.
 *    - 화면에 보이던 [E]/[F] 글자는 모바일에서 지우고, 눌러 보라는 ▶ 표시를 붙입니다.
 * 2) 좌측(현황 카드) · 우측(미니맵·리포트·메뉴·조작 버튼) · 하단(단축바)을 작게 줄이고 겹치지 않게 재배치합니다.
 *    - 조작 버튼은 input.js 를 고치지 않고, 버튼 안의 이모지를 보고 찾아서 자리를 다시 잡습니다.
 *
 * 설치: game.js 맨 위 import 들 중 "가장 앞쪽"에 한 줄 추가
 *       import './touch-hud.js';
 *       (mobile-ui.js 를 이미 쓰고 있다면 그 import 보다 "뒤"에 두세요.)
 *
 * 크기 조절은 아래 CFG 숫자만 바꾸면 됩니다.
 * 콘솔 확인: __thud()
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch, buzz } from './input.js';

const CFG = {
  b: 'clamp(34px, 11vh, 52px)',     // 조작 버튼 기본 크기 (화면 높이의 11%, 34~52px)
  map: 'clamp(64px, 24vh, 100px)',  // 미니맵 지름
  card: 0.68,                       // 좌측 현황 카드 축소 배율 (작게 → 0.6, 크게 → 0.8)
  alpha: 0.88,                      // 조작 버튼 투명도
};

const $ = (s) => document.querySelector(s);

const CSS = `
:root{--b:${CFG.b};--mm:${CFG.map}}

/* ── 좌측: 현황 카드 ── */
body.touch #hud-card{left:6px!important;top:6px!important;min-width:0!important;padding:6px 10px!important;
  transform:scale(${CFG.card});transform-origin:top left;opacity:.9}

/* ── 우측 위: 미니맵 + 리포트/메뉴 작은 버튼 ── */
body.touch #hud-right{right:6px!important;top:6px!important}
body.touch #mini{width:var(--mm)!important;height:var(--mm)!important;border-width:2px!important}
body.touch #hud-right .hud-btns{position:fixed!important;top:6px!important;right:calc(var(--mm) + 14px)!important;margin:0!important;gap:5px!important;flex-direction:row!important}
body.touch #hud-right .hud-btns button{width:calc(var(--b)*.8)!important;height:calc(var(--b)*.8)!important;padding:0!important;
  font-size:calc(var(--b)*.42)!important;border-radius:50%!important;line-height:1!important}

/* ── 하단: 단축바 ── */
body.touch #bar{bottom:calc(4px + env(safe-area-inset-bottom,0px))!important;padding:3px!important;gap:3px!important;
  border-radius:10px!important;background:rgba(8,20,40,.55)!important}
body.touch .slot{width:calc(var(--b)*.8)!important;height:calc(var(--b)*.8)!important;border-radius:8px!important}
body.touch .slot b{font-size:calc(var(--b)*.4)!important}
body.touch .slot i{font-size:8px!important;top:0!important;left:3px!important}
body.touch .slot small{display:none!important}
body.touch #bar>*{width:calc(var(--b)*.8)!important;height:calc(var(--b)*.8)!important;min-width:0!important;min-height:0!important;flex:none!important}

/* ── FPS 체력바·탄약: 상단 중앙에 한 줄로 고정 (체력바 왼쪽, 탄약 오른쪽) ── */
body.touch #hudx #hpbox{left:50%!important;right:auto!important;bottom:auto!important;top:38px!important;transform:translateX(-50%)!important;
  width:150px!important;height:14px!important;border-radius:7px!important}
body.touch #hudx #hptxt{line-height:14px!important;font-size:10px!important}
body.touch #hudx #ammobox{left:calc(50% + 84px)!important;right:auto!important;top:35px!important;bottom:auto!important;transform:none!important;
  width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;padding:2px 9px!important;border-radius:10px!important;
  font-size:12px!important;line-height:18px!important;white-space:nowrap!important;text-align:left!important}
body.touch #hudx #ammobox small,body.touch #hudx #ammobox br{display:none!important}
body.touch #lockhint{display:none!important}

/* ── 체험하기 상자 = 누르는 버튼 ── */
body.touch #prompt{
  z-index:30!important;pointer-events:auto!important;touch-action:manipulation;cursor:pointer;
  bottom:calc(var(--b)*.8 + 14px + env(safe-area-inset-bottom,0px))!important;
  min-height:38px;padding:7px 16px!important;font-size:14px!important;font-weight:800!important;
  color:#10223f!important;background:linear-gradient(#ffe688,#ffc42f)!important;
  border:2px solid #fff!important;border-radius:999px!important;box-shadow:0 3px 12px rgba(0,0,0,.45);
  white-space:nowrap;animation:cqPulse 1.3s ease-in-out infinite}
body.touch #prompt::after{content:'  ▶';font-size:12px}
body.touch #prompt.press{transform:translateX(-50%) scale(.94)!important;filter:brightness(.9);animation:none}
@keyframes cqPulse{0%,100%{box-shadow:0 3px 12px rgba(0,0,0,.45),0 0 0 0 rgba(255,210,74,.55)}50%{box-shadow:0 3px 12px rgba(0,0,0,.45),0 0 0 8px rgba(255,210,74,0)}}
`;

/* ── 조작 버튼 찾기 (이모지로 역할 판별) ── */
const ROLES = [
  ['atk',    /[👊🔫]/u],
  ['alt',    /[💥🎯]/u],
  ['jump',   /[⤒⤴↑⬆]/u],
  ['use',    /✋/u],
  ['rel',    /🔄/u],
  ['view',   /👁/u],
  ['brake',  /🛑/u],
  ['cancel', /[✖✕❌]/u],
];
const SKIP = '#bar,#modal,#modal-box,#title,#hudx,#hud,#prompt,#toast,.game-host';
const found = {};

function inFixed(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return true;
  }
  return false;
}
function roleOf(el) {
  const t = (el.textContent || '').trim();
  if (!t || t.length > 4) return null;
  for (const [r, re] of ROLES) if (re.test(t)) return r;
  return null;
}
function style(el, o) {
  for (const k in o) el.style.setProperty(k, o[k], 'important');
}

/* 크기 단위: b = 기본 버튼, g = 간격 */
const B = 'var(--b)';
function place(el, role) {
  const base = { position: 'fixed', left: 'auto', top: 'auto', margin: '0', padding: '0', 'border-radius': '50%', opacity: String(CFG.alpha), transform: 'none' };
  const sz = (m) => ({ width: `calc(${B}*${m})`, height: `calc(${B}*${m})`, 'min-width': '0', 'min-height': '0', 'font-size': `calc(${B}*${m}*.5)` });
  const small = ['rel', 'view', 'brake', 'cancel'];
  if (role === 'atk')   style(el, { ...base, ...sz(1.35), right: '10px', bottom: '10px' });
  else if (role === 'alt')  style(el, { ...base, ...sz(1), right: `calc(18px + ${B}*1.35)`, bottom: '10px' });
  else if (role === 'jump') style(el, { ...base, ...sz(1), right: '10px', bottom: `calc(18px + ${B}*1.35)` });
  else if (role === 'use')  style(el, { ...base, ...sz(1.1), right: `calc(18px + ${B}*1.35)`, bottom: `calc(18px + ${B})` });
  else if (small.includes(role)) {
    const k = small.indexOf(role);
    style(el, { ...base, ...sz(0.8), right: `calc(26px + ${B}*2.35 + ${k}*(${B}*.8 + 6px))`, bottom: '10px' });
  }
}

/* ── 400ms 마다: 버튼 재배치 + 리포트/메뉴 아이콘화 ── */
function tick() {
  const hud = $('#hud'), title = $('#title');
  const playing = hud && !hud.classList.contains('hidden') && (!title || title.classList.contains('hidden'));
  if (!playing) return;

  const cand = [];
  document.querySelectorAll('button,div,span,a').forEach((el) => {
    if (el.children.length > 1 || el.closest(SKIP)) return;
    const r = roleOf(el); if (!r) return;
    if (!inFixed(el)) return;
    cand.push([el, r]);
  });
  const set = new Set(cand.map((c) => c[0]));
  Object.keys(found).forEach((k) => delete found[k]);
  cand.forEach(([el, r]) => {
    if (set.has(el.parentElement)) return;      // 가장 바깥 요소만
    place(el, r); found[r] = el;
  });

  const rep = $('#b-report'), men = $('#b-menu');
  if (rep && rep.textContent !== '📊') { rep.textContent = '📊'; rep.title = '리포트'; }
  if (men && men.textContent !== '⏸') { men.textContent = '⏸'; men.title = '메뉴'; }
  hookPrompt(); hookAmmo(); enforce();
}

/* ── FPS 체력바·탄약·단축바: 다른 스타일에 밀려 중앙에 커지거나 길어지는 문제를 막으려고 직접 고정 ── */
function enforce() {
  const hp = $('#hpbox'), am = $('#ammobox');
  if (hp) style(hp, { left: '50%', right: 'auto', top: '38px', bottom: 'auto', transform: 'translateX(-50%)', width: '150px', height: '14px' });
  if (am) style(am, { left: 'calc(50% + 84px)', right: 'auto', top: '35px', bottom: 'auto', transform: 'none', width: 'auto', height: 'auto', 'min-height': '0', 'max-height': 'none' });
  document.querySelectorAll('#bar>*').forEach((s) => style(s, { width: 'calc(var(--b)*.8)', height: 'calc(var(--b)*.8)', 'min-width': '0', flex: 'none' }));
}

/* 탄약 상자: "🔫 무기이름 12 / 0" → "🔫 12 / 0" 한 줄로 줄임 (무기 이름은 단축바에서 확인) */
let amEl = null;
function compactAmmo() {
  const b = amEl; if (!b || b.dataset.c === b.innerHTML) return;
  const t = (b.textContent || '').trim(); if (!t) return;
  const sp = b.querySelector('span'), icon = t.split(/\s+/)[0];
  let html;
  if (sp) { const m = /\/\s*(\d+)\s*$/.exec(t); html = `${icon} <b style="font-size:16px">${sp.textContent.trim()}</b> <span style="opacity:.85">/ ${m ? m[1] : 0}</span>`; }
  else html = t.split(/\s+/).slice(0, 2).join(' ');
  b.innerHTML = html; b.dataset.c = b.innerHTML;
}
function hookAmmo() {
  if (amEl || !(amEl = $('#ammobox'))) return;
  new MutationObserver(compactAmmo).observe(amEl, { childList: true, characterData: true, subtree: true });
  compactAmmo();
}

/* ── 체험하기 상자: [E]/[F] 글자 제거 + 누르면 실행 ── */
let promptEl = null, last = 0;
function stripKey() {
  const p = promptEl; if (!p) return;
  const m = /^\s*\[([A-Z])\]\s*/.exec(p.textContent || '');
  if (m) { p.dataset.k = m[1]; p.textContent = p.textContent.replace(m[0], ''); }
}
function hookPrompt() {
  if (promptEl || !(promptEl = $('#prompt'))) return;
  new MutationObserver(stripKey).observe(promptEl, { childList: true, characterData: true, subtree: true });
  stripKey();
}
function fire() {
  const now = performance.now(); if (now - last < 400) return; last = now;
  const p = $('#prompt'); if (!p || getComputedStyle(p).display === 'none') return;
  const k = (p.dataset.k || 'E');
  const opt = { code: 'Key' + k, key: k.toLowerCase(), bubbles: true };
  window.dispatchEvent(new KeyboardEvent('keydown', opt));
  window.dispatchEvent(new KeyboardEvent('keyup', opt));
  buzz(25);
}
const onPrompt = (e) => !!(e.target && e.target.closest && e.target.closest('#prompt'));

function boot() {
  const st = document.createElement('style'); st.id = 'cq-touch-hud'; st.textContent = CSS; document.head.append(st);

  /* 상자를 누르는 터치가 조이스틱·시점 드래그로 새지 않게 먼저 가로챔 (window 캡처 단계) */
  ['touchstart', 'touchmove', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup']
    .forEach((t) => addEventListener(t, (e) => {
      if (!onPrompt(e)) return;
      e.stopPropagation();
      const p = $('#prompt');
      if (t === 'touchstart' || t === 'pointerdown') p.classList.add('press');
      if (t === 'pointerup' || t === 'pointercancel' || t === 'mouseup') p.classList.remove('press');
    }, { capture: true, passive: true }));
  addEventListener('touchend', (e) => {
    if (!onPrompt(e)) return;
    e.stopPropagation(); e.preventDefault(); $('#prompt').classList.remove('press'); fire();
  }, { capture: true, passive: false });
  addEventListener('touchcancel', (e) => { if (onPrompt(e)) { e.stopPropagation(); $('#prompt').classList.remove('press'); } }, { capture: true, passive: true });
  addEventListener('click', (e) => { if (!onPrompt(e)) return; e.stopPropagation(); fire(); }, { capture: true });

  setInterval(tick, 400);
  tick();
}

if (isTouch) {
  if (document.body) boot(); else addEventListener('DOMContentLoaded', boot);
}

/* 콘솔 확인용: 어떤 버튼을 찾았는지 */
window.__thud = () => ({
  touch: isTouch,
  buttons: Object.fromEntries(Object.entries(found).map(([k, el]) => [k, (el.textContent || '').trim()])),
  prompt: (() => { const p = $('#prompt'); return p ? { text: p.textContent, key: p.dataset.k || null, shown: getComputedStyle(p).display !== 'none' } : null; })(),
  fps: (() => {
    const g = (s) => { const e = $(s); if (!e) return null; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), pos: c.position, disp: c.display }; };
    return { hp: g('#hpbox'), ammo: g('#ammobox'), bar: g('#bar'), slot: g('#bar > *') };
  })(),
});
