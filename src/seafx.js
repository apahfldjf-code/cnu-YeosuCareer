/* ═══════════════════════════════════════════════════════════════
 * src/seafx.js  (신규) — 낚시 항구 바다 셰이더 (이미지·모델 파일 없음, 전부 코드로 계산)
 *
 *  - 물결 : 크기가 다른 파도 5겹 + 잔물결로 표면 방향을 계산해 빛이 일렁여요
 *  - 색   : 해안 가까이는 옥빛 → 멀수록 짙은 파랑 (해안까지의 거리로 계산)
 *  - 반사 : 보는 각도가 낮을수록 하늘색을 비춰요(프레넬) + 햇빛 반짝임
 *  - 포말 : 섬·부두·안벽·갯바위·큰 배 둘레에 물결치는 하얀 거품
 *  - 항적 : 내 낚싯배가 달리면 뒤로 V자 물보라
 *  - 안개 : 게임 안개(fog)와 그대로 이어져요
 *
 *  끄기/조절
 *    주소 뒤에 ?sea=0 → 예전 바다로 복귀
 *    아래 SEA_CFG 숫자로 세기·색 조절
 *  콘솔 확인 : __sea()
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const QS = new URLSearchParams(location.search);
export const SEA_CFG = {
  OFF: QS.get('sea') === '0',
  WAVE: 0.75,         // 물결 세기 (0.4 잔잔 ~ 1.4 거침)
  FOAM: 1.0,          // 포말 세기
  SHALLOW: '#3fc0d2', // 얕은 바다 (예전보다 푸르게)
  MID: '#2a8fc6',
  DEEP: '#12528c',    // 깊은 바다
  HORIZON: '#c4e4fa', // 수평선 하늘색 (W.env.fog 색과 같게)
  TOP: '#4a9be0',     // 위쪽 하늘색
  SUNCOL: '#fff1d6',
};
const MAXC = 40, MAXR = 6;

const VERT = `
varying vec3 vW;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = `
uniform float uT, uWave, uFoam, uBoatOn;
uniform vec3 uSun, uSunCol, uShallow, uMid, uDeep, uHor, uTop;
uniform vec3 uC[${MAXC}];
uniform int uNC;
uniform vec4 uR[${MAXR}];
uniform int uNR;
uniform vec4 uBoat;
varying vec3 vW;
#include <fog_pars_fragment>

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 gw(vec2 p, vec2 d, float k, float s, float a, float t){
  d = normalize(d);
  return d * (a * k * cos(dot(p, d) * k + t * s));
}

void main(){
  vec2 p = vW.xz; float t = uT;
  vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;

  /* 해안(땅·섬·배)까지의 거리 */
  float d = 1e4;
  for (int i = 0; i < ${MAXC}; i++) { if (i >= uNC) break; d = min(d, length(p - uC[i].xy) - uC[i].z); }
  for (int i = 0; i < ${MAXR}; i++) {
    if (i >= uNR) break;
    vec4 r = uR[i]; vec2 c = (r.xy + r.zw) * 0.5, h = (r.zw - r.xy) * 0.5; vec2 q = abs(p - c) - h;
    d = min(d, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
  }
  d = max(d, 0.0);

  /* 물결 (멀리 갈수록 약하게 해서 반짝거림을 줄여요) */
  vec2 g = gw(p, vec2(1.0, 0.3), 0.21, 0.9, 0.5, t) + gw(p, vec2(-0.6, 0.8), 0.37, 1.2, 0.3, t)
         + gw(p, vec2(0.4, 0.9), 0.83, 1.7, 0.1, t);
  g += (vec2(vn(p * 0.8 + t * 0.2), vn(p * 0.8 + 17.0 - t * 0.15)) - 0.5) * 0.05;
  float far = smoothstep(60.0, 400.0, dist);
  g *= uWave * mix(1.0, 0.15, far);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

  /* 하늘 반사 */
  float fres = clamp(0.03 + 0.97 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0), 0.0, 1.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uHor, uTop, clamp(R.y * 1.4, 0.0, 1.0));

  /* 물 색 */
  vec3 base = mix(uShallow, uMid, smoothstep(0.0, 14.0, d));
  base = mix(base, uDeep, smoothstep(10.0, 80.0, d));
  base = mix(base, uDeep * 0.85, smoothstep(500.0, 900.0, length(p)));
  float caus = pow(1.0 - abs(vn(p * 0.55 + vec2(t * 0.18, -t * 0.12)) * 2.0 - 1.0), 7.0) * (1.0 - smoothstep(0.0, 16.0, d)) * 0.2;
  base += vec3(0.25, 0.4, 0.35) * caus;
  vec3 S = normalize(uSun);
  base *= 0.78 + 0.22 * max(dot(n, S), 0.0) * 1.2;
  vec3 col = mix(base, sky, fres * 0.55);

  /* 햇빛 반짝임 */
  vec3 H = normalize(S + V); float nh = max(dot(n, H), 0.0);
  col += uSunCol * min(pow(nh, 120.0) * 0.35 + pow(nh, 30.0) * 0.05, 0.45) * (1.0 - far * 0.5);

  /* 해안 포말 */
  float nz = vn(p * 1.3 + vec2(t * 0.15, t * 0.1)), nz2 = vn(p * 3.1 - vec2(t * 0.2, 0.0));
  float wob = sin(d * 2.4 - t * 1.5 + nz * 5.0) * 0.35;
  float foam = 1.0 - smoothstep(0.15, 2.6 + nz * 1.2, d + wob);
  float rings = smoothstep(0.82, 1.0, sin(d * 0.85 - t * 0.9 + nz * 2.0) * 0.5 + 0.5) * (1.0 - smoothstep(3.0, 11.0, d)) * 0.35;
  foam = max(foam * (0.55 + 0.6 * nz2), rings * (0.5 + nz2 * 0.5));
  foam = max(foam, 1.0 - smoothstep(0.0, 0.7, d));

  /* 내 배 둘레 물보라 + 항적 */
  vec2 bp = p - uBoat.xy; vec2 fw = vec2(sin(uBoat.z), cos(uBoat.z)); vec2 sd = vec2(fw.y, -fw.x);
  float u = dot(bp, fw), w = dot(bp, sd), sp = clamp(uBoat.w / 9.0, 0.0, 1.0);
  float e = length(vec2(u / 6.4, w / 2.7));
  float hull = smoothstep(0.78, 1.0, e) * (1.0 - smoothstep(1.0, 1.35, e)) * (0.18 + 0.82 * sp) * (0.6 + 0.4 * nz2);
  float back = -u - 5.5, wk = 0.0;
  if (back > 0.0 && back < 80.0) {
    float wd = 1.3 + back * 0.3;
    wk = (1.0 - smoothstep(0.0, 1.1 + back * 0.06, abs(abs(w) - wd))) * (1.0 - smoothstep(10.0, 80.0, back));
    wk += (1.0 - smoothstep(0.0, 1.6 + back * 0.1, abs(w))) * (1.0 - smoothstep(5.0, 55.0, back)) * 0.8;
    wk *= sp;
  }
  float bf = clamp(hull + wk * (0.5 + 0.7 * nz2), 0.0, 1.0) * uBoatOn;

  float F = clamp(max(foam * uFoam, bf), 0.0, 1.0);
  col = mix(col, vec3(0.95, 0.98, 1.0) * (0.9 + 0.1 * nz), F * 0.9 * (1.0 - far * 0.6));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/* o = { root, y, circles:[[x,z,r]..], rects:[[x0,z0,x1,z1]..], sun:[x,y,z] }  →  { mesh, update(t,px,pz,boat) } 또는 null(끔·오류) */
export function createSeaFx(o) {
  if (SEA_CFG.OFF) return null;
  try {
    const C = SEA_CFG;
    const uC = Array.from({ length: MAXC }, () => new THREE.Vector3());
    const uR = Array.from({ length: MAXR }, () => new THREE.Vector4());
    const circles = (o.circles || []).slice(0, MAXC), rects = (o.rects || []).slice(0, MAXR);
    circles.forEach((c, i) => uC[i].set(c[0], c[1], c[2]));
    rects.forEach((r, i) => uR[i].set(r[0], r[1], r[2], r[3]));
    const sun = o.sun || [80, 120, 60];

    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uT: { value: 0 }, uWave: { value: C.WAVE }, uFoam: { value: C.FOAM }, uBoatOn: { value: 1 },
      uSun: { value: new THREE.Vector3(sun[0], sun[1], sun[2]) }, uSunCol: { value: new THREE.Color(C.SUNCOL) },
      uShallow: { value: new THREE.Color(C.SHALLOW) }, uMid: { value: new THREE.Color(C.MID) }, uDeep: { value: new THREE.Color(C.DEEP) },
      uHor: { value: new THREE.Color(C.HORIZON) }, uTop: { value: new THREE.Color(C.TOP) },
      uC: { value: uC }, uNC: { value: circles.length }, uR: { value: uR }, uNR: { value: rects.length },
      uBoat: { value: new THREE.Vector4(0, 0, 0, 0) },
    }]);
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true });
    mat.userData.noDetail = true;   // detail.js 가 건드리지 않게

    const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = o.y; mesh.frustumCulled = false; mesh.renderOrder = -1;
    o.root.add(mesh);

    /* 예전 섬 둘레 흰 고리(정적)는 새 포말과 겹치니 숨겨요 */
    try {
      o.root.traverse((m) => {
        if (m.isMesh && m.geometry && m.geometry.type === 'RingGeometry' && m.material && m.material.color
          && m.material.color.getHex() === 0xffffff && m.material.opacity < 0.4) m.visible = false;
      });
    } catch (e) { /* 무시 */ }

    window.__sea = () => ({ on: true, circles: circles.length, rects: rects.length, wave: uniforms.uWave.value, foam: uniforms.uFoam.value, boatSpeed: +uniforms.uBoat.value.w.toFixed(1) });
    return {
      mesh,
      update(t, px, pz, boat) {
        mesh.position.x = Math.round(px / 20) * 20; mesh.position.z = Math.round(pz / 20) * 20;
        uniforms.uT.value = t;
        if (boat) uniforms.uBoat.value.set(boat.x, boat.z, boat.h, Math.abs(boat.v || 0));
      },
    };
  } catch (e) {
    console.warn('[seafx] 바다 셰이더를 만들지 못해 예전 바다를 써요:', e);
    return null;
  }
}

/* ═══════════════ 맑은 하늘 + 듬성듬성 구름 (createSkyFx) ═══════════════
 * 끄기: 주소 뒤에 ?sky=0   구름 양: SKY_CFG.CLOUD (0.55 많음 ~ 0.72 아주 드묾)
 * o = { root, sun:[x,y,z] }  →  { mesh, update(t, px, py, pz) } 또는 null */
export const SKY_CFG = {
  OFF: QS.get('sky') === '0',
  CLOUD: 0.62,        // 클수록 구름이 적어요
  SPEED: 0.006,       // 구름 흐르는 속도
  HORIZON: '#c4e4fa',
  TOP: '#3f8fdf',
  SUNCOL: '#fff1d6',
};
const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
uniform float uT, uCloud, uSpeed;
uniform vec3 uHor, uTop, uSun, uSunCol;
varying vec3 vDir;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHor, uTop, pow(h, 0.5));
  vec3 S = normalize(uSun); float sd = max(dot(d, S), 0.0);
  col += uSunCol * (pow(sd, 700.0) * 0.8 + pow(sd, 14.0) * 0.07);
  if (d.y > 0.015) {
    vec2 uv = d.xz / (d.y + 0.14) * 0.85 + vec2(uT * uSpeed, uT * uSpeed * 0.35);
    float n = fbm(uv * 1.15);
    float m = smoothstep(uCloud, uCloud + 0.14, n);
    float fade = smoothstep(0.015, 0.22, d.y);
    float sh = smoothstep(0.5, 0.85, fbm(uv * 2.4 + 3.0));
    vec3 cc = mix(vec3(0.97, 0.98, 1.0), vec3(0.78, 0.85, 0.95), sh * 0.55);
    col = mix(col, cc, m * fade * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function createSkyFx(o) {
  if (SKY_CFG.OFF) return null;
  try {
    const C = SKY_CFG, sun = o.sun || [80, 120, 60];
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uCloud: { value: C.CLOUD }, uSpeed: { value: C.SPEED },
        uHor: { value: new THREE.Color(C.HORIZON) }, uTop: { value: new THREE.Color(C.TOP) },
        uSun: { value: new THREE.Vector3(sun[0], sun[1], sun[2]) }, uSunCol: { value: new THREE.Color(C.SUNCOL) },
      },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    });
    mat.userData.noDetail = true;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
    mesh.frustumCulled = false; mesh.renderOrder = -100;
    o.root.add(mesh);
    window.__sky = () => ({ on: true, cloud: mat.uniforms.uCloud.value });
    return { mesh, update(t, px, py, pz) { mat.uniforms.uT.value = t; mesh.position.set(px, py, pz); } };
  } catch (e) {
    console.warn('[seafx] 하늘 셰이더를 만들지 못해 예전 하늘을 써요:', e);
    return null;
  }
}
