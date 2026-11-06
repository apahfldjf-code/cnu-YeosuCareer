/* ═══════════════════════════════════════════════════════════════
 * src/display.js  (신규, H1) — 고해상도 렌더 + 모바일 "PC 축소판" 화면
 *
 *  1) 렌더 해상도: 기기 실제 화소(DPR)까지 올리고, 프레임이 떨어지면 자동으로 낮춥니다.
 *  2) 모바일 화면: 레이아웃을 PC 폭(기본 1000px)으로 잡고 폰 화면에 맞춰 줄여 보여줍니다.
 *     글자는 DOM 글자라 줄어도 화면 해상도로 다시 그려져 또렷합니다.
 *  3) 3D 안의 글씨 판(캔버스 텍스처): 비스듬히 봐도 흐려지지 않게 이방성 필터를 최대로 올립니다.
 *
 *  주소 뒤 옵션(저장됨):  ?ui=1280 (PC 크기에 가깝게, 글자 작음)
 *                         ?ui=900  (조금 크게)   ?ui=0 (기본값 1000으로 복귀)
 *  콘솔 확인: __disp()
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch } from './input.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
};

/* ───────────── 1) 모바일 UI 기준 폭 ───────────── */
const UI_DEFAULT = 1000;
const qs = new URLSearchParams(location.search);
if (qs.has('ui')) { const v = parseInt(qs.get('ui'), 10); store.set('cq_uiw', v >= 640 && v <= 1920 ? String(v) : null); }
const savedUi = parseInt(store.get('cq_uiw'), 10);
export const UI_W = savedUi >= 640 && savedUi <= 1920 ? savedUi : UI_DEFAULT;

if (isTouch) {
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.append(m); }
  m.setAttribute('content', `width=${UI_W},user-scalable=no,viewport-fit=cover`);
  const st = document.createElement('style');
  st.textContent = 'html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}'
    + 'body.touch{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}';
  document.head.append(st);
}

/* ───────────── 2) 렌더 해상도 ───────────── */
/* budget = 화면 전체 화소 수 상한, boost = DPR 이 낮은 PC 에서 최소 배율(슈퍼샘플링), floor = 자동 조절이 내려갈 수 있는 하한 */
const PROFILE = {
  high: { budget: isTouch ? 3.4e6 : 8.5e6, boost: isTouch ? 0 : 1.5, floor: isTouch ? 1.5 : 1.0 },
  mid:  { budget: isTouch ? 2.4e6 : 4.2e6, boost: isTouch ? 0 : 1.25, floor: isTouch ? 1.25 : 1.0 },
  low:  { budget: isTouch ? 1.2e6 : 2.1e6, boost: 0, floor: 1.0 },
};
let mul = 1, slow = 0, fast = 0, accT = 0, accN = 0, lastNow = performance.now(), lastQ = '', lastKey = '';
let R = null, SC = null;

/* 레이아웃 1px 당 실제 화소 수 = DPR × 페이지 배율(viewport width 고정으로 생기는 축소 비율) */
const effDpr = () => {
  const d = window.devicePixelRatio || 1;
  const s = (isTouch && window.visualViewport && window.visualViewport.scale) || 1;
  return Math.min(4, d * Math.max(0.3, Math.min(s, 3)));
};
function targetPr(q) {
  const P = PROFILE[q] || PROFILE.high, w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  const base = Math.min(Math.max(effDpr(), P.boost), Math.sqrt(P.budget / (w * h)), 3);
  return Math.max(Math.min(P.floor, base), base * mul);
}
function apply(renderer, q) {
  const pr = targetPr(q);
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.02) { renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); }
}

/* 매 프레임 호출 — game.js 의 adaptQuality 대신 */
export function tickDisplay(renderer, q) {
  q = q || 'high';
  const now = performance.now(), dt = (now - lastNow) / 1000; lastNow = now;
  if (q !== lastQ) { lastQ = q; mul = 1; slow = fast = 0; lastKey = ''; }
  if (dt < 0.5 && !document.hidden) { accT += dt; accN++; }
  if (accT >= 1.5) {
    const fps = accN / accT; accT = 0; accN = 0;
    if (fps < 38) { slow++; fast = 0; } else if (fps >= 56) { fast++; slow = 0; } else { slow = fast = 0; }
    if (slow >= 2) { mul = Math.max(0.55, mul * 0.86); slow = 0; }
    else if (fast >= 3 && mul < 1) { mul = Math.min(1, mul * 1.1); fast = 0; }
  }
  const key = q + '|' + innerWidth + 'x' + innerHeight + '|' + effDpr().toFixed(2) + '|' + mul.toFixed(2);
  if (key !== lastKey) { lastKey = key; apply(renderer, q); }
}

/* ───────────── 3) 3D 안의 글씨·그림 선명도 ───────────── */
const seen = new WeakSet();
function sharpen() {
  if (!R || !SC) return;
  const max = Math.min(16, R.capabilities.getMaxAnisotropy());
  SC.traverseVisible((o) => {
    if (!o.material) return;
    [].concat(o.material).forEach((m) => {
      const t = m && m.map;
      if (!t || seen.has(t) || t.isVideoTexture || t.isCubeTexture) return;
      seen.add(t);
      if (t.anisotropy < max) {
        t.anisotropy = max;
        const im = t.image;
        if (im && (im.complete === undefined || im.complete) && (im.width || im.videoWidth)) t.needsUpdate = true;
      }
    });
  });
}

export function initDisplay(renderer, scene) {
  R = renderer; SC = scene;
  sharpen(); setInterval(sharpen, 2500);
  window.__disp = () => ({
    pixelRatio: +renderer.getPixelRatio().toFixed(2),
    canvas: renderer.domElement.width + 'x' + renderer.domElement.height,
    css: innerWidth + 'x' + innerHeight,
    uiWidth: UI_W, autoMul: +mul.toFixed(2),
    effDpr: +effDpr().toFixed(2), maxAniso: renderer.capabilities.getMaxAnisotropy(),
  });
}