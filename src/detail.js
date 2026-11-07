/* ═══════════════════════════════════════════════════════════════
 * src/detail.js (Q2 + 체험 보정) — 표면 미세 질감 (화소 단위 계산, 이미지 파일 없음)
 *
 *  단색이던 모든 표준 재질(부스·바닥·건물·캐릭터 등)에 셰이더가 직접
 *   1) 색 결(미세한 밝기 변화)  2) 요철(빛을 받을 때 울퉁불퉁)  3) 거칠기 변화
 *  를 그려 넣어요. 질감은 물체에 붙어 있어서 움직이는 캐릭터·카트·배에서도 미끄러지지 않아요.
 *
 *  [추가] 학과 체험 중에는 질감을 끄고(깨끗한 색), 끌어다 놓을 목표(반투명 흰 모형)에
 *         흰 윤곽선 + 발광 깜빡임을 입혀 눈에 잘 띄게 합니다.
 *         체험 여부는 화면에 "그만하기" 버튼이 보이는지로 자동 판단합니다.
 *
 *  단계        0=끔  1=색 결+거칠기  2=요철까지
 *  기본값      PC·폰 모두 2   / 화질 메뉴 '중간'=최대 1, '낮음'=0
 *  주소 뒤     ?dt=0|1|2 (저장됨)  ?dt=auto (기본값 복귀)
 *              ?dta=0.4 (색 결 세기)  ?dtb=3 (요철 세기)
 *              ?exp=0   (체험 중 보정 끄기 = 예전 동작)
 *  점검(콘솔)  __detail()    __expLook(true|false|undefined)  ← 체험 모드 수동 전환/자동 복귀
 *
 *  제외         반투명(바다·유리), 글씨·그림이 붙은 작은 면, 발광 재질, 하늘 돔 → 그대로 둠
 *               특정 재질을 빼려면  material.userData.noDetail = true
 *               윤곽선을 빼려면      material.userData.noGhost  = true
 *  라이선스     외부 이미지·모델·코드 없이 자체 작성한 셰이더.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { isTouch } from './input.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
};
const QP = new URLSearchParams(location.search);
if (QP.has('dt')) { const v = QP.get('dt'); store.set('cq_dt', /^[012]$/.test(v) ? v : null); }
const sv = store.get('cq_dt');
const LEVEL = sv !== null && /^[012]$/.test(sv) ? +sv : 2;
const num = (k, d) => (QP.has(k) && isFinite(+QP.get(k)) ? +QP.get(k) : d);
const K_ALB = num('dta', 0.55);
const K_BUMP = num('dtb', 3);
const OCT = isTouch ? 3 : 4;   /* 겹치는 질감 층 수 (폰은 가볍게) */
const EXP_FIX = QP.get('exp') !== '0';

/* 모든 재질이 함께 쓰는 값 → 화질을 바꾸면 한 번에 반영 */
const U = { uOct: { value: 0 }, uAlb: { value: 0 }, uBump: { value: 0 } };

/* ───────── 셰이더 조각 ───────── */
const VTX = [
  '{ mat4 cqM = modelMatrix;',
  '#ifdef USE_INSTANCING',
  'cqM = modelMatrix * instanceMatrix;',
  '#endif',
  'vCqP = transformed * vec3(length(cqM[0].xyz), length(cqM[1].xyz), length(cqM[2].xyz)); }',
].join('\n');

const FRAG_PARS = [
  'varying vec3 vCqP;',
  'uniform float uOct; uniform float uAlb; uniform float uBump;',
  'float cqH = 0.0;',
  'float cqHash(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }',
  'float cqNoise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(mix(cqHash(i), cqHash(i + vec3(1.0,0.0,0.0)), f.x), mix(cqHash(i + vec3(0.0,1.0,0.0)), cqHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),',
  '             mix(mix(cqHash(i + vec3(0.0,0.0,1.0)), cqHash(i + vec3(1.0,0.0,1.0)), f.x), mix(cqHash(i + vec3(0.0,1.0,1.0)), cqHash(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z); }',
  /* foot = 한 화소가 덮는 길이(m). 화소보다 촘촘한 층은 자동으로 사라져요 */
  'float cqDetail(vec3 p, float foot){ float h = 0.0; float a = 0.5; float f = 2.0;',
  '  for (int i = 0; i < 4; i++) { if (float(i) >= uOct) break;',
  '    float fade = 1.0 - smoothstep(0.25, 0.6, f * foot);',
  '    h += (cqNoise(p * f) - 0.5) * a * fade; f *= 3.1; a *= 0.6; }',
  '  return h * 2.0; }',
].join('\n');

const COLOR = [
  '{ float foot = length(fwidth(vCqP)); cqH = cqDetail(vCqP, foot);',
  '  float lo = cqNoise(vCqP * 0.31);',
  '  diffuseColor.rgb *= (1.0 + cqH * uAlb) * (1.0 + (lo - 0.5) * 0.10 * uAlb); }',
].join('\n');

const ROUGH = 'roughnessFactor = clamp(roughnessFactor + cqH * 0.6 * uAlb, 0.04, 1.0);';

const BUMP = [
  '{ vec3 sx = normalize(dFdx(-vViewPosition)); vec3 sy = normalize(dFdy(-vViewPosition));',
  '  vec3 R1 = cross(sy, normal); vec3 R2 = cross(normal, sx);',
  '  float det = dot(sx, R1) * faceDirection;',
  '  vec2 d = clamp(vec2(dFdx(cqH), dFdy(cqH)) * uBump, vec2(-0.6), vec2(0.6));',
  '  vec3 g = sign(det) * (d.x * R1 + d.y * R2);',
  '  normal = normalize(abs(det) * normal - g); }',
].join('\n');

function patch(sh) {
  sh.uniforms.uOct = U.uOct; sh.uniforms.uAlb = U.uAlb; sh.uniforms.uBump = U.uBump;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCqP;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + VTX);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOR)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ROUGH)
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BUMP);
}

/* ───────── 대상 고르기 · 장면 훑기 ───────── */
const DEFAULT_OBC = THREE.Material.prototype.onBeforeCompile;
const seen = new WeakSet();
let SC = null, patched = 0, skipped = 0, lastScan = 0;

/* 광장처럼 큰 수평 바닥인가? (글씨 화살표 같은 작은 바닥 그림은 제외) */
function bigFloor(o) {
  try {
    if (!o || !o.isMesh || !o.geometry || Math.abs(o.rotation.x + Math.PI / 2) > 0.06) return false;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox, sx = (b.max.x - b.min.x) * o.scale.x, sy = (b.max.y - b.min.y) * o.scale.y;
    return sx >= 12 && sy >= 12;
  } catch (e) { return false; }
}
function eligible(m, o) {
  if (!m || !m.isMeshStandardMaterial) return false;
  if (m.onBeforeCompile !== DEFAULT_OBC) return false;            /* 다른 코드가 이미 셰이더를 고친 재질은 건드리지 않음 */
  if (m.userData && m.userData.noDetail) return false;
  if (m.wireframe || m.depthWrite === false || m.side === THREE.BackSide) return false;
  if (m.transparent && m.opacity < 0.98) return false;            /* 바다·유리·그림자 판 */
  if (m.map && !(m.map.repeat && m.map.repeat.x > 1.5) && !bigFloor(o)) return false;   /* 글씨·그림 면은 보호. 반복 타일·큰 바닥은 허용 */
  if (m.emissive && m.emissiveIntensity > 0.25 && m.emissive.r + m.emissive.g + m.emissive.b > 0.3) return false;
  return true;
}
function scan() {
  if (!SC) return;
  SC.traverse((o) => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((x) => {
      if (!x || seen.has(x)) return; seen.add(x);
      if (!eligible(x, o)) { skipped++; return; }
      x.onBeforeCompile = patch; x.needsUpdate = true; patched++;
    });
  });
}

/* ───────── 학과 체험 보정 ───────── */
let EXP = false, expCheck = 0, expManual = null, ghostScanT = 0;
const ghostSeen = new WeakSet(), ghosts = [];

/* 화면에 "그만하기" 버튼이 보이면 체험 중 */
function detectExp(now) {
  if (expManual !== null) return expManual;
  if (now - expCheck < 350) return EXP;
  expCheck = now;
  const list = document.querySelectorAll('button,div,span');
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.childElementCount > 2) continue;
    const t = e.textContent;
    if (!t || t.length > 10 || t.indexOf('그만하기') < 0) continue;
    if (e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') return true;
  }
  return false;
}

/* 끌어다 놓을 자리(밝고 반투명한 모형)인가? */
function isGhost(o) {
  if (!o.isMesh || ghostSeen.has(o) || !o.geometry) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || !m.transparent || m.depthWrite !== false) return false;
  if (m.opacity > 0.5 || m.opacity < 0.05 || m.map || m.wireframe || m.side === THREE.BackSide) return false;
  if (m.blending === THREE.AdditiveBlending || (m.userData && m.userData.noGhost)) return false;
  if (m.color && (m.color.r + m.color.g + m.color.b) / 3 < 0.3) return false;      /* 검은 그림자 판 제외 */
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const b = o.geometry.boundingBox, s = o.scale;
  const mx = Math.max((b.max.x - b.min.x) * Math.abs(s.x), (b.max.y - b.min.y) * Math.abs(s.y), (b.max.z - b.min.z) * Math.abs(s.z));
  return mx > 0.15 && mx < 16;                                                      /* 바다·큰 유리벽 제외 */
}
function armGhost(o) {
  ghostSeen.add(o);
  const m = o.material;
  if (m.opacity < 0.3) m.opacity = 0.3;
  if (m.emissive) { m.emissive.set('#bfe9ff'); m.emissiveIntensity = 0.6; }
  else if (m.color) m.color.lerp(new THREE.Color('#ffffff'), 0.6);
  const ln = new THREE.LineSegments(
    new THREE.EdgesGeometry(o.geometry, 35),
    new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false }),
  );
  ln.renderOrder = 12; ln.userData.noDetail = true; ln.raycast = () => {};          /* 터치 판정에 안 걸리게 */
  o.add(ln); ghosts.push({ o, ln, m });
}
function clearGhosts() {
  ghosts.forEach((g) => { try { g.o.remove(g.ln); g.ln.geometry.dispose(); g.ln.material.dispose(); ghostSeen.delete(g.o); } catch (e) { /* 무시 */ } });
  ghosts.length = 0;
}

/* ───────── 공개 함수 ───────── */
export function initDetail(scene) {
  SC = scene;
  window.__detail = () => ({ level: LEVEL, patched, skipped, oct: U.uOct.value, alb: U.uAlb.value, bump: U.uBump.value, exp: EXP, ghosts: ghosts.length });
  window.__expLook = (v) => { expManual = v === undefined ? null : !!v; expCheck = 0; return EXP; };
  if (LEVEL <= 0) return;
  scan();   /* 첫 화면을 그리기 전에 한 번 → 재컴파일 없이 바로 적용 */
}
export function tickDetail(q) {
  const now = performance.now();

  /* 체험 시작/종료 감지 */
  if (EXP_FIX) {
    const on = detectExp(now);
    if (on !== EXP) {
      EXP = on; if (!on) clearGhosts();
      window.dispatchEvent(new CustomEvent('cq-exp', { detail: on }));   /* post.js 등이 들을 수 있음 */
    }
    if (EXP) {
      if (SC && now - ghostScanT > 400) { ghostScanT = now; SC.traverseVisible((o) => { if (isGhost(o)) armGhost(o); }); }
      const t = now / 1000, k = 0.5 + 0.5 * Math.sin(t * 4);
      ghosts.forEach((g) => {
        const vis = g.o.visible && g.m.opacity > 0.02;
        g.ln.visible = vis;
        if (vis) { g.ln.material.opacity = 0.6 + 0.35 * k; if (g.m.emissive) g.m.emissiveIntensity = 0.45 + 0.35 * k; }
      });
    }
  }

  if (LEVEL <= 0) return;
  const lv = Math.min(LEVEL, q === 'low' ? 0 : q === 'mid' ? 1 : 2);
  const flat = EXP_FIX && EXP;                       /* 체험 중에는 질감을 끈다 */
  U.uOct.value = lv === 0 || flat ? 0 : OCT;
  U.uAlb.value = lv === 0 || flat ? 0 : K_ALB;
  U.uBump.value = lv >= 2 && !flat ? K_BUMP : 0;
  if (now - lastScan > 2000) { lastScan = now; scan(); }   /* 체험 장면 등 나중에 생긴 재질 */
}
