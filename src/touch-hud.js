/* ═══════════════════════════════════════════════════════════════
 * src/touch-hud.js (U3 v2) — 모바일 화면 정리
 *
 * 1) 부스 앞에 뜨는 "체험하기" 상자를 눌러서 바로 체험을 시작합니다.
 *    - 부스, 리포트 단말기, 레이싱 센터, 포털, FPS 줍기(F), 카트 내리기에 똑같이 적용돼요.
 *    - 화면에 보이던 [E]/[F] 글자는 모바일에서 지우고, 눌러 보라는 ▶ 표시를 붙입니다.
 * 2) 좌측(현황 카드) · 우측(미니맵·리포트·메뉴·조작 버튼) · 하단(단축바)을 작게 줄이고 겹치지 않게 재배치합니다.
 *    - 조작 버튼은 input.js 를 고치지 않고, 버튼 안의 이모지를 보고 찾아서 자리를 다시 잡습니다.
 *
 * v2 변경점
 *   - 하단 단축바(DOGBAR) 크기 50% 축소 (CFG.bar)
 *   - 우측 하단 조작 버튼(공격·강타·점프·✋) 50% 확대 (CFG.act)
 *   - 카트 탈 때: 🌀 드리프트가 공격 버튼 자리(가장 큰 버튼), 🛑 브레이크는 점프 버튼 자리, ✖ 레이스 취소는 강타 버튼 자리
 *   - 재장전·시점전환(FPS)은 점프 버튼 위로 이동
 *
 * 설치: game.js 맨 위 import 들 중 "가장 앞쪽"에 한 줄 (이미 있으면 그대로)
 *       import './touch-hud.js';
 *
 * 크기 조절은 아래 CFG 숫자만 바꾸면 됩니다.
 * 콘솔 확인: __thud()
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch, buzz } from './input.js';

const CFG = {
  b: 'clamp(34px, 11vh, 52px)',     // 기준 크기 (화면 높이의 11%, 34~52px)
  map: 'clamp(64px, 24vh, 100px)',  // 미니맵 지름
  card: 0.68,                       // 좌측 현황 카드 축소 배율 (작게 → 0.6, 크게 → 0.8)
  alpha: 0.88,                      // 조작 버튼 투명도
  act: 1.5,                         // 우측 하단 조작 버튼 배율 (1.5 = 기존보다 50% 크게, 더 키우려면 1.7)
  bar: 0.5,                         // 하단 단축바 배율 (0.5 = 기존의 절반, 너무 작으면 0.6~0.7)
  barMin: 22,                       // 단축바 칸 최소 크기(px) — 이보다 작아지면 손가락으로 누르기 힘들어요
};

const $ = (s) => document.querySelector(s);

const CSS = `
:root{--b:${CFG.b};--mm:${CFG.map};
  --sl:max(${CFG.barMin}px, calc(var(--b)*${(0.8 * CFG.bar).toFixed(3)}));
  --bh:calc(var(--sl) + 8px)}

/* ── 좌측: 현황 카드 ── */
body.touch #hud-card{left:6px!important;top:6px!important;min-width:0!important;padding:6px 10px!important;
  transform:scale(${CFG.card});transform-origin:top left;opacity:.9}

/* ── 우측 위: 미니맵 + 리포트/메뉴 작은 버튼 ── */
body.touch #hud-right{right:6px!important;top:6px!important}
body.touch #mini{width:var(--mm)!important;height:var(--mm)!important;border-width:2px!important}
body.touch #hud-right .hud-btns{position:fixed!important;top:6px!important;right:calc(var(--mm) + 14px)!important;margin:0!important;gap:5px!important;flex-direction:row!important}
body.touch #hud-right .hud-btns button{width:calc(var(--b)*.8)!important;height:calc(var(--b)*.8)!important;padding:0!important;
  font-size:calc(var(--b)*.42)!important;border-radius:50%!important;line-height:1!important}

/* ── 하단: 단축바(DOGBAR) ── */
body.touch #bar{bottom:calc(3px + env(safe-area-inset-bottom,0px))!important;padding:2px!important;gap:2px!important;
  border-radius:8px!important;background:rgba(8,20,40,.5)!important}
body.touch .slot{width:var(--sl)!important;height:var(--sl)!important;min-width:0!important;min-height:0!important;
  flex:0 0 auto!important;padding:0!important;box-sizing:border-box!important;border-radius:6px!important}
body.touch .slot b{font-size:calc(var(--sl)*.58)!important;line-height:1!important}
body.touch .slot i{font-size:6px!important;top:0!important;left:2px!important;line-height:1!important}
body.touch .slot small{display:none!important}

/* ── FPS 체력·탄약 ── */
body.touch #hpbox{top:34px!important;width:150px!important;height:14px!important}
body.touch #hptxt{line-height:14px!important;font-size:10px!important}
body.touch #ammobox{bottom:calc(var(--bh) + 8px)!important;padding:3px 9px!important;font-size:11px!important}
body.touch #lockhint{display:none!important}

/* ── 체험하기 상자 = 누르는 버튼 ── */
body.touch #prompt{
  z-index:30!important;pointer-events:auto!important;touch-action:manipulation;cursor:pointer;
  bottom:calc(var(--bh) + 8px + env(safe-area-inset-bottom,0px))!important;
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
  ['drift',  /🌀/u],
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

/* ── 버튼 배치 ───────────────────────────────────────────────
 *   오른쪽 아래를 기준으로 이렇게 놓아요 (K = CFG.act)
 *
 *            [재장전][시점]            ← FPS 에서만
 *                      [ 점프 ]
 *     [✋사용]
 *     [ 강타/조준 ]   [  공격  ]
 *   카트 탈 때는 공격 자리 = 🌀 드리프트, 점프 자리 = 🛑 브레이크, 강타 자리 = ✖ 레이스 취소
 * ─────────────────────────────────────────────────────────── */
const B = 'var(--b)';
const K = CFG.act, AT = +(1.35 * K).toFixed(3), SM = +(0.8 * K).toFixed(3), UU = +(1.1 * K).toFixed(3);
const G = 8, E = 10;                                         // G = 버튼 사이 간격, E = 화면 가장자리 여백(px)
const right = (extra = '0px') => `calc(${E}px + env(safe-area-inset-right,0px) + ${extra})`;
const bottom = (extra = '0px') => `calc(${E}px + env(safe-area-inset-bottom,0px) + ${extra})`;

function place(el, role) {
  const base = { position: 'fixed', left: 'auto', top: 'auto', margin: '0', padding: '0', 'border-radius': '50%', opacity: String(CFG.alpha), transform: 'none' };
  const sz = (m) => ({ width: `calc(${B}*${m})`, height: `calc(${B}*${m})`, 'min-width': '0', 'min-height': '0', 'font-size': `calc(${B}*${m}*.5)` });
  const side = `${B}*${AT} + ${G}px`;                        // 공격 버튼 폭 + 간격
  const rowK = `${B}*${K} + ${G}px`;                         // 기본 버튼 높이 + 간격
  const rel = `${B}*${AT} + ${B}*${K} + ${G * 2}px`;         // 점프 버튼 위

  if (role === 'atk' || role === 'drift')      style(el, { ...base, ...sz(AT), right: right(), bottom: bottom() });
  else if (role === 'alt' || role === 'cancel') style(el, { ...base, ...sz(K), right: right(side), bottom: bottom() });
  else if (role === 'jump' || role === 'brake') style(el, { ...base, ...sz(K), right: right(), bottom: bottom(side) });
  else if (role === 'use')  style(el, { ...base, ...sz(UU), right: right(side), bottom: bottom(rowK) });
  else if (role === 'rel')  style(el, { ...base, ...sz(SM), right: right(), bottom: bottom(rel) });
  else if (role === 'view') style(el, { ...base, ...sz(SM), right: right(`${B}*${SM} + 6px`), bottom: bottom(rel) });
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
  hookPrompt();
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

/* 콘솔 확인용: 어떤 버튼을 찾았는지 + 실제 크기 */
window.__thud = () => ({
  touch: isTouch,
  cfg: { act: CFG.act, bar: CFG.bar },
  slotPx: (() => { const s = document.querySelector('.slot'); return s ? Math.round(s.getBoundingClientRect().width) : null; })(),
  buttons: Object.fromEntries(Object.entries(found).map(([k, el]) => [k, { icon: (el.textContent || '').trim(), px: Math.round(el.getBoundingClientRect().width) }])),
  prompt: (() => { const p = $('#prompt'); return p ? { text: p.textContent, key: p.dataset.k || null, shown: getComputedStyle(p).display !== 'none' } : null; })(),
});
