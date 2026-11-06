/* ═══════════════════════════════════════════════════════════════
 * src/post.js (신규, Q1) — 화면 품질 파이프라인
 *  1) MSAA(PC)  : 계단 현상 제거 (폰은 고해상도 렌더로 대체)
 *  2) GTAO      : 접촉 그림자(앰비언트 오클루전) — 부스 아래, 기둥 밑, 벽 모서리가 어두워져 입체감이 확 살아남
 *  3) 블룸      : 전구·발광 재질·해에 빛 번짐
 *  4) 색보정    : 채도·대비·가장자리 어둡게(비네트)
 *  5) 환경광    : 월드 하늘색으로 만든 간접광/반사 (gfx.js 를 이미 쓰고 있으면 건너뜀)
 *
 *  단계(level)   0=끔(기존 화면)  1=블룸+색보정  2=AO까지 전부
 *  기본값        PC=2, 폰=1   /   화질 메뉴 '중간'=최대 1, '낮음'=0
 *  주소 뒤       ?fx=0|1|2 (저장됨)  ?fx=auto (기본값 복귀)   ?env=0.3 (환경광 세기)
 *  점검(콘솔)    __post()
 *  자동 보호     프레임이 계속 30 아래면 한 단계씩 낮춤. 애드온 로드/그리기 오류 시 기존 화면으로 복귀.
 *
 *  라이선스      three.js 및 examples/jsm 애드온 = MIT License © three.js authors.
 *               배포 시 lib/ 안에 three 의 LICENSE 파일을 함께 두면 됩니다. (화면 표시 불필요)
 *  ※ 외부 이미지·모델·HDRI 파일을 쓰지 않는 자체 작성 코드입니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { isTouch } from './input.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
};
const QP = new URLSearchParams(location.search);
if (QP.has('fx')) { const v = QP.get('fx'); store.set('cq_fx', /^[012]$/.test(v) ? v : null); }
const sv = store.get('cq_fx');
let LEVEL = sv !== null && /^[012]$/.test(sv) ? +sv : (isTouch ? 1 : 2);
const ENV_K = QP.has('env') && isFinite(+QP.get('env')) ? +QP.get('env') : (isTouch ? 0.4 : 0.5);
const BUDGET = isTouch ? 3.0e6 : 4.6e6;   /* 후처리 내부 화소 수 상한(넘으면 내부만 줄이고 화면엔 늘려서 출력) */

const S = { ready: false, failed: false, why: '', composer: null, gtao: null, bloom: null, samples: 0, k: 1 };
let R = null, SC = null, CAM = null, lastKey = '';
const effLevel = (q) => Math.min(LEVEL, q === 'low' ? 0 : q === 'mid' ? 1 : 2);

/* ───────── 색보정 셰이더 (OutputPass 뒤, 화면 색 공간에서 적용) ───────── */
const GRADE = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, con: { value: 1.05 }, vig: { value: 0.42 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat, con, vig; varying vec2 vUv;'
    + 'void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(.2126,.7152,.0722));'
    + 'c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - .5) * con + .5; vec2 d = vUv - .5; c.rgb *= 1.0 - dot(d, d) * vig;'
    + 'gl_FragColor = vec4(c.rgb, 1.0); }',
};

/* ───────── 애드온 불러오기 (실패해도 게임은 그대로 동작) ───────── */
async function load() {
  const [a, b, c, d, e, f] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    LEVEL >= 2 ? import('three/addons/postprocessing/GTAOPass.js') : Promise.resolve({}),
  ]);
  const size = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
  const w = Math.max(2, Math.round(size.x * pr)), h = Math.max(2, Math.round(size.y * pr));
  const msaaOk = !isTouch && R.capabilities.isWebGL2 && R.extensions.has('EXT_color_buffer_float');
  S.samples = msaaOk ? 4 : 0;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: S.samples });
  const composer = new a.EffectComposer(R, rt);
  composer.addPass(new b.RenderPass(SC, CAM));

  if (f.GTAOPass) {
    const g = new f.GTAOPass(SC, CAM, w, h);
    g.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.2, thickness: 1.5, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    g.blendIntensity = 0.95;
    /* 법선 버퍼를 그릴 때 반투명(바다·유리돔)·스프라이트(이름표)·점·선은 제외 → 엉뚱한 어두운 테두리 방지 */
    g.overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse((o) => {
        cache.set(o, o.visible);
        if (o.isPoints || o.isLine || o.isSprite) { o.visible = false; return; }
        const m = o.material;
        if (m) { const arr = Array.isArray(m) ? m : [m]; if (arr.some((x) => x && x.transparent && x.opacity < 0.98)) o.visible = false; }
      });
    };
    composer.addPass(g); S.gtao = g;
  }
  const bloom = new c.UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.6, 0.92);
  composer.addPass(bloom); S.bloom = bloom;
  composer.addPass(new d.OutputPass());
  composer.addPass(new e.ShaderPass(GRADE));
  S.composer = composer; S.ready = true; lastKey = '';
  sync(true);
}

/* 렌더러 해상도(display.js 가 바꿈)를 따라가되, 내부 화소 수는 상한을 둠 */
function sync(force) {
  if (!S.composer) return;
  const sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
  const k = Math.min(1, Math.sqrt(BUDGET / Math.max(1, sz.x * sz.y * pr * pr)));
  const key = sz.x + 'x' + sz.y + '|' + pr.toFixed(3) + '|' + k.toFixed(3);
  if (!force && key === lastKey) return; lastKey = key; S.k = k;
  S.composer.setPixelRatio(pr * k); S.composer.setSize(sz.x, sz.y);
}

/* ───────── 환경광(간접광·반사) — gfx.js 가 있으면 건너뜀 ───────── */
let pm = null, envTex = null, envKey = -1, lastScan = 0;
const mats = new WeakSet();
function buildEnv(hex) {
  const c = new THREE.Color(hex), W = new THREE.Color(1, 1, 1);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: c.clone().multiplyScalar(0.85) }, hor: { value: c.clone().lerp(W, 0.35) }, gnd: { value: c.clone().multiplyScalar(0.3) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, hor, gnd; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(hor, top, pow(h, .55)) : mix(hor, gnd, pow(-h, .45)); gl_FragColor = vec4(c, 1.0); }',
  });
  const geo = new THREE.SphereGeometry(10, 32, 16), s = new THREE.Scene(); s.add(new THREE.Mesh(geo, mat));
  if (!pm) pm = new THREE.PMREMGenerator(R);
  const t = pm.fromScene(s, 0.02).texture; geo.dispose(); mat.dispose(); return t;
}
function envTick(now) {
  if (window.__gfx || !SC) return;
  try {
    const bg = SC.background;
    if (bg && bg.isColor) {
      const hx = bg.getHex();
      if (hx !== envKey) { envKey = hx; const old = envTex; envTex = buildEnv(hx); SC.environment = envTex; if (old) old.dispose(); }
    }
    if (now - lastScan > 2000) {
      lastScan = now;
      SC.traverse((o) => {
        const m = o.material; if (!m) return;
        (Array.isArray(m) ? m : [m]).forEach((x) => { if (x && x.isMeshStandardMaterial && !mats.has(x)) { mats.add(x); x.envMapIntensity = ENV_K; } });
      });
    }
  } catch (e) { console.warn('[post] 환경광 건너뜀:', e && e.message); }
}

/* ───────── 공개 함수 ───────── */
export function initPost(renderer, scene, camera) {
  R = renderer; SC = scene; CAM = camera;
  window.__post = () => ({
    level: LEVEL, ready: S.ready, failed: S.failed, why: S.why, msaa: S.samples, innerScale: +S.k.toFixed(2),
    gtao: !!S.gtao, env: !!SC.environment, envBy: window.__gfx ? 'gfx.js' : 'post.js', envK: ENV_K,
    fps: +fpsNow.toFixed(1), canvas: R.domElement.width + 'x' + R.domElement.height,
  });
  if (LEVEL <= 0) return;
  load().catch((e) => { S.failed = true; S.why = String((e && e.message) || e); console.warn('[post] 후처리 애드온을 불러오지 못해 기본 화면으로 동작합니다:', S.why); });
}

let fpsNow = 0, accT = 0, accN = 0, lastT = performance.now(), low = 0;
export function renderFx(renderer, scene, camera, q) {
  const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
  envTick(now);
  const lv = effLevel(q || 'high');
  if (!S.ready || S.failed || lv <= 0) { renderer.render(scene, camera); return; }
  try {
    if (S.gtao) S.gtao.enabled = lv >= 2;
    if (S.bloom) S.bloom.enabled = lv >= 1;
    sync(false);
    S.composer.render(dt);
  } catch (e) {
    S.failed = true; S.why = String((e && e.message) || e); console.warn('[post] 그리기 오류 → 기본 화면으로 복귀:', S.why);
    try { renderer.setRenderTarget(null); } catch (e2) { /* 무시 */ }
    renderer.render(scene, camera); return;
  }
  /* 자동 보호: 4.5초 이상 계속 느리면 한 단계 낮춤 (display.js 의 해상도 조절이 먼저 동작) */
  if (dt < 0.5 && !document.hidden) { accT += dt; accN++; }
  if (accT >= 1.5) {
    fpsNow = accN / accT; accT = 0; accN = 0;
    low = fpsNow < 30 ? low + 1 : 0;
    if (low >= 3 && LEVEL > 0) { LEVEL--; low = 0; console.warn('[post] 프레임이 낮아 효과 단계를 ' + LEVEL + ' 로 낮췄어요 (이번 접속만)'); }
  }
}
