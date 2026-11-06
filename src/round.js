/* ═══════════════════════════════════════════════════════════════
 * src/round.js (신규) — R1 형태 정밀도 향상
 *  · rbox  : 모서리가 둥근 상자 (BoxGeometry 대체, 글씨판 UV·재질 6면 그대로 유지)
 *  · rboxChar : 캐릭터용 (더 둥글게)
 *  · rcyl / rsph : 원기둥·구 (크기에 맞춰 꼭짓점 수를 늘림. 원래 값보다 줄이지는 않음)
 *
 *  ※ 이 파일은 외부 모델·이미지를 쓰지 않는 자체 작성 코드예요. (고지 의무 없음)
 *
 *  끄기/조절 (주소 뒤에 붙이기)
 *   ?round=0 : 전부 끄기(옛 모양)   ?hq=1 : 폰에서도 촘촘하게   ?hq=0 : PC에서도 가볍게
 *  점검(콘솔): __round()
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const QP = new URLSearchParams(location.search);
const OFF = QP.get('round') === '0';
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const HQ = QP.get('hq') === '1' ? true : QP.get('hq') === '0' ? false : !COARSE;
const CNT = { box: 0, plain: 0 };

/* ───────── 둥근 상자 ─────────
 * r 을 안 주면 가장 짧은 변의 22%(최대 0.35). k=1 → 한 모서리 2조각, k=2 → 4조각 */
export function rbox(w, h, d, r, k) {
  const m = Math.min(w, h, d);
  if (OFF) return new THREE.BoxGeometry(w, h, d);
  if (r === undefined) r = Math.min(m * 0.22, 0.35);
  r = Math.min(r, m * 0.49);
  if (!(r >= 0.012)) { CNT.plain++; return new THREE.BoxGeometry(w, h, d); }   /* 얇은 판은 그대로 */
  k = k || 1;
  const S = k * 2 + 1, half = 0.5 / S, per = (S + 1) * (S + 1);
  const geo = new THREE.BoxGeometry(1, 1, 1, S, S, S);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1, sz = z < 0 ? -1 : 1;
    let nx = x - sx * half, ny = y - sy * half, nz = z - sz * half;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const px = sx * (hx - r) + nx * r, py = sy * (hy - r) + ny * r, pz = sz * (hz - r) + nz * r;
    pos.setXYZ(i, px, py, pz); nor.setXYZ(i, nx, ny, nz);
    /* UV 를 실제 위치로 다시 계산 → 큰 글씨판 면이 찌그러지지 않음 (BoxGeometry 면 순서: +x -x +y -y +z -z) */
    let u, v;
    switch ((i / per) | 0) {
      case 0: u = (hz - pz) / d; v = (py + hy) / h; break;
      case 1: u = (pz + hz) / d; v = (py + hy) / h; break;
      case 2: u = (px + hx) / w; v = (hz - pz) / d; break;
      case 3: u = (px + hx) / w; v = (pz + hz) / d; break;
      case 4: u = (px + hx) / w; v = (py + hy) / h; break;
      default: u = (hx - px) / w; v = (py + hy) / h;
    }
    uv.setXY(i, u, v);
  }
  pos.needsUpdate = true; nor.needsUpdate = true; uv.needsUpdate = true;
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  CNT.box++;
  return geo;
}

/* 캐릭터용: 더 둥글게(짧은 변의 30%). 얇은 장식(7cm 미만)은 그대로 */
export function rboxChar(w, h, d) {
  const m = Math.min(w, h, d);
  if (OFF || m < 0.07) return new THREE.BoxGeometry(w, h, d);
  return rbox(w, h, d, m * 0.3, HQ ? 2 : 1);
}

/* ───────── 원기둥 · 구: 크기별 최소 꼭짓점 수 (원래 값이 더 크면 그대로) ───────── */
export function rcyl(rt, rb, h, rs = 32, hs = 1, open = false, ts = 0, tl = Math.PI * 2) {
  if (!OFF) {
    const r = Math.max(rt, rb);
    const mn = r < 0.12 ? 8 : r < 0.5 ? (HQ ? 16 : 12) : (HQ ? 28 : 20);
    rs = Math.max(rs, mn);
  }
  return new THREE.CylinderGeometry(rt, rb, h, rs, hs, open, ts, tl);
}
export function rsph(r, ws = 32, hs = 16, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) {
  if (!OFF) {
    const a = r < 0.06 ? [8, 6] : r < 0.2 ? (HQ ? [16, 12] : [12, 8]) : r < 1 ? (HQ ? [24, 16] : [16, 12]) : (HQ ? [32, 20] : [20, 14]);
    ws = Math.max(ws, a[0]); hs = Math.max(hs, a[1]);
  }
  return new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
}

window.__round = () => ({ off: OFF, hq: HQ, coarse: COARSE, roundBoxes: CNT.box, plainBoxes: CNT.plain });