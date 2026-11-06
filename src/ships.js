/* ═══════════════════════════════════════════════════════════════
 * src/ships.js  (신규) — 항구 선박 2척 (이미지·모델 파일 없음, 전부 코드로 생성)
 *
 *  research() : 실습선 새동백호 — 흰 선체 + 붉은 흘수선, 파란 줄, 초록 앞갑판,
 *               계단식 선교(창문 띠) + 레이돔 돛대, 뒤쪽 파란 굴뚝(학교 마크),
 *               주황 구조정 2척, 선미 A자 프레임·크레인, 선체 글자
 *  cheong()   : 청경호 — LNG 추진 실습선. 붉은 선체 아래쪽, '전 남 대 학 교' 글자,
 *               앞쪽 선교, 가운데 LNG 탱크, 뒤쪽 굴뚝·선실, 선미 A자 프레임
 *
 *  사용 : fishing.js 의 makeShip 맨 앞에서  SHIPKIT[kind]() 를 불러요.
 *  반환 : THREE.Group (앞쪽 = +z), userData = { L, B, FB }  ← 충돌 계산에 쓰여요
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const PI2 = Math.PI / 2;
const WH = '#e6eaef', WH2 = '#eef1f4', DK = '#1b2836', GREEN = '#2f7d4a', NAVY = '#143a78', RED = '#8e2f27';
const GRAY = '#9aa3ad', DGRAY = '#55606d', YEL = '#e8c53a', ORG = '#e8602c', BLK = '#22262c', FUN = '#1c4a8e';

function hullGeo(L, B, depth, bow) {
  const w = B / 2, s = new THREE.Shape();
  s.moveTo(-w, -L / 2); s.lineTo(w, -L / 2); s.lineTo(w, L / 2 - bow);
  s.quadraticCurveTo(w * 0.6, L / 2 - bow * 0.3, 0, L / 2);
  s.quadraticCurveTo(-w * 0.6, L / 2 - bow * 0.3, -w, L / 2 - bow); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(Math.PI / 2); return geo;
}

/* M(색) = fishing.js 의 재질 캐시, tplane = fishing.js 의 글자판 만들기 */
export function createShipKit(M, tplane) {
  const put = (p, m, x, y, z) => { m.position.set(x, y, z); p.add(m); return m; };
  const bx = (p, w, h, d, c, x, y, z) => put(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)), x, y, z);
  const cy = (p, rt, rb, h, c, x, y, z, s = 10) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), M(c)), x, y, z);
  const ball = (p, r, c, x, y, z) => put(p, new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), M(c)), x, y, z);
  const glow = (p, r, c, x, y, z) => put(p, new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 })), x, y, z);
  const hull = (g, L, B, depth, bow, col, y) => {
    const m = new THREE.Mesh(hullGeo(L, B, depth, bow), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }));
    m.position.y = y; g.add(m); return m;
  };
  /* 양쪽 옆면 글자 (x 는 선체 반폭) */
  const side = (g, text, pw, ph, x, y, z, o) => {
    tplane(text, pw, ph, x + 0.03, y, z, PI2, o, g);
    tplane(text, pw, ph, -x - 0.03, y, z, -PI2, o, g);
  };
  /* 선체 둘레를 따라가는 띠(난간·줄무늬) — 뱃머리 곡선도 따라가요. off>0 안쪽, off<0 바깥쪽 */
  function band(g, L, B, bow, y, h, th, col, off, zBack) {
    const w = B / 2, z0 = L / 2 - bow, path = [[w, zBack]];
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * 0.97, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      path.push([w * a + w * 0.6 * b, z0 * a + (L / 2 - bow * 0.3) * b + (L / 2) * c]);
    }
    for (const s of [1, -1]) {
      for (let i = 0; i < path.length - 1; i++) {
        const xa = s * (path[i][0] - off), xb = s * (path[i + 1][0] - off), za = path[i][1], zb = path[i + 1][1];
        const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const m = bx(g, th, h, len + 0.02, col, (xa + xb) / 2, y, (za + zb) / 2);
        m.rotation.y = Math.atan2(dx, dz);
      }
    }
  }
  /* 굴뚝 옆면 학교 마크 (흰 원 + 초록 테두리 + CNU) */
  function logo(g, hx, y, z, r) {
    for (const s of [1, -1]) {
      const ry = s * PI2;
      const w = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      w.position.set(s * (hx + 0.02), y, z); w.rotation.y = ry; g.add(w);
      const rg = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 24), new THREE.MeshBasicMaterial({ color: '#1b7a3a', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      rg.position.set(s * (hx + 0.03), y, z); rg.rotation.y = ry; g.add(rg);
      tplane('CNU', r * 1.5, r * 0.8, s * (hx + 0.05), y, z, ry, { color: '#1b7a3a' }, g);
    }
  }
  const done = (g, L, B, FB) => {
    g.userData = { L, B, FB };
    g.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.userData.noDetail = true; }); });
    return g;
  };

  /* ═════════════ 실습선 새동백호 ═════════════ */
  function research() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const L = 30, B = 6.4, FB = 2.4, W = B / 2, BOW = 7, ZB = -L / 2;

    /* 선체: 붉은 아랫부분 → 흰 윗부분 → 초록 갑판 */
    hull(g, L - 0.1, B - 0.12, 2.05, BOW, RED, 0.45);
    hull(g, L, B, FB - 0.45, BOW, WH, FB);
    hull(g, L - 0.5, B - 0.5, 0.06, BOW, GREEN, FB + 0.05);
    band(g, L, B, BOW, FB + 0.32, 0.6, 0.1, WH, 0.08, ZB + 0.3);          // 흰 불워크(뱃전 벽)
    bx(g, B - 0.2, 0.6, 0.1, WH, 0, FB + 0.32, ZB + 0.2);
    band(g, L, B, BOW, 1.0, 0.14, 0.05, NAVY, -0.02, ZB);                  // 파란 줄
    for (const s of [1, -1]) bx(g, 0.3, 0.6, 0.9, BLK, s * 2.05, 1.5, 11.3);   // 닻

    /* 선체 글자 · 선미 초록/노랑 줄 */
    side(g, 'CHONNAM NATIONAL UNIVERSITY', 9.5, 0.62, W, 1.72, -3.2, { color: NAVY });
    side(g, 'SAE DONG BAEK\n새동백호', 2.5, 0.8, W, 1.65, 7.2, { color: NAVY });
    for (const s of [1, -1]) {
      bx(g, 0.05, 1.7, 0.55, GREEN, s * (W + 0.02), 1.45, -13.3).rotation.x = 0.45;
      bx(g, 0.05, 1.7, 0.45, YEL, s * (W + 0.02), 1.45, -12.5).rotation.x = 0.45;
    }

    /* 앞갑판: 닻 감는 기계 · 계선주 · 앞 돛대 */
    bx(g, 3.2, 0.5, 0.6, '#3d4650', 0, FB + 0.3, 9.6);
    for (const s of [1, -1]) {
      const d = cy(g, 0.42, 0.42, 1.1, DGRAY, s * 0.95, FB + 0.55, 9.6, 12); d.rotation.z = PI2;
      cy(g, 0.12, 0.14, 0.45, YEL, s * 2.3, FB + 0.28, 8.4, 8);
      cy(g, 0.12, 0.14, 0.4, YEL, s * 1.2, FB + 0.26, 11.2, 8);
    }
    cy(g, 0.1, 0.14, 4.8, WH, 0, FB + 2.4, 12.0, 8);
    bx(g, 1.5, 0.09, 0.09, WH, 0, FB + 4.1, 12.0);
    bx(g, 0.9, 0.08, 0.9, GRAY, 0, FB + 3.0, 12.0);
    bx(g, 0.7, 0.14, 0.22, BLK, 0, FB + 4.9, 12.0);
    glow(g, 0.1, '#ffffff', 0, FB + 5.05, 12.0);

    /* 선실 1층 (갑판 위 첫 층) */
    bx(g, 5.4, 2.3, 12.5, WH, 0, FB + 1.15, 0.25);
    bx(g, 5.44, 0.38, 10.5, DK, 0, FB + 1.5, 0.3);          // 창문 띠
    bx(g, 5.44, 0.22, 10, '#3a4a5e', 0, FB + 0.55, 0.3);   // 아래 작은 창 띠
    bx(g, 4.6, 0.38, 0.06, DK, 0, FB + 1.5, 6.52);
    bx(g, 5.2, 0.06, 12.2, GREEN, 0, FB + 2.33, 0.25);       // 지붕 갑판(초록)
    /* 선실 2층 */
    bx(g, 4.4, 2.2, 8.5, WH, 0, FB + 3.4, 0.25);
    bx(g, 4.44, 0.36, 7, DK, 0, FB + 3.5, 0.25);
    bx(g, 3.6, 0.36, 0.06, DK, 0, FB + 3.5, 4.52);
    bx(g, 4.2, 0.06, 8.3, GREEN, 0, FB + 4.53, 0.25);
    /* 선교(조타실) + 양쪽 날개 */
    bx(g, 4.0, 1.9, 4.4, WH, 0, FB + 5.45, 2.2);
    bx(g, 3.8, 0.8, 0.08, DK, 0, FB + 5.7, 4.42);
    bx(g, 4.04, 0.7, 3.2, DK, 0, FB + 5.7, 2.4);
    bx(g, 4.3, 0.14, 4.9, WH, 0, FB + 6.45, 2.3);
    bx(g, 7.4, 0.16, 1.1, WH, 0, FB + 4.75, 3.2);
    glow(g, 0.12, '#ff3b30', 3.65, FB + 4.95, 3.2);          // 왼쪽(좌현) 빨강
    glow(g, 0.12, '#2fd27a', -3.65, FB + 4.95, 3.2);         // 오른쪽(우현) 초록
    /* 레이더 탑 + 레이돔 + 돛대 */
    bx(g, 1.9, 4.2, 2.2, WH, 0, FB + 6.6, 0.6);
    bx(g, 1.94, 0.3, 1.4, DK, 0, FB + 7.4, 0.6);
    bx(g, 2.5, 0.1, 2.8, GRAY, 0, FB + 8.75, 0.6);
    ball(g, 0.9, '#f8f9fb', 0, FB + 9.65, 1.0);
    cy(g, 0.06, 0.09, 3.6, '#cdd3da', 0, FB + 10.6, -0.3, 8);
    bx(g, 1.4, 0.07, 0.07, '#cdd3da', 0, FB + 11.6, -0.3);
    glow(g, 0.1, '#ffffff', 0, FB + 12.45, -0.3);

    /* 굴뚝(파란색 + 학교 마크) */
    bx(g, 3.2, 3.6, 3.0, FUN, 0, FB + 1.8, -7.6);
    bx(g, 3.26, 0.2, 3.06, GREEN, 0, FB + 0.9, -7.6);
    bx(g, 3.26, 0.2, 3.06, YEL, 0, FB + 1.2, -7.6);
    bx(g, 3.3, 0.22, 3.1, WH, 0, FB + 3.7, -7.6);
    bx(g, 2.2, 0.4, 2.0, BLK, 0, FB + 3.95, -7.6);
    logo(g, 1.6, FB + 2.5, -7.6, 0.75);
    /* 뒤쪽 높은 돛대 */
    cy(g, 0.09, 0.13, 6.5, WH, 0, FB + 7.0, -6.6, 8);
    bx(g, 1.8, 0.07, 0.07, WH, 0, FB + 8.5, -6.6);
    bx(g, 1.2, 0.07, 0.07, WH, 0, FB + 7.4, -6.6);
    glow(g, 0.1, '#ffffff', 0, FB + 10.3, -6.6);

    /* 주황 구조정 2척 */
    for (const s of [1, -1]) {
      const bt = put(g, new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.2, 4, 10), M(ORG)), s * 2.4, FB + 1.1, -7.6);
      bt.rotation.x = PI2;
      bx(g, 0.7, 0.12, 1.2, '#b84a22', s * 2.4, FB + 1.62, -7.6);
      for (const dz of [-1.0, 1.0]) bx(g, 0.12, 0.9, 0.12, GRAY, s * 2.4, FB + 0.45, -7.6 + dz);
    }
    /* 선미 갑판: A자 프레임 · 크레인 */
    for (const s of [1, -1]) bx(g, 0.3, 3.6, 0.3, WH, s * 2.4, FB + 1.8, -14.2);
    bx(g, 5.1, 0.3, 0.35, WH, 0, FB + 3.6, -14.2);
    const wn = cy(g, 0.5, 0.5, 1.4, DGRAY, 0, FB + 0.55, -12.0, 12); wn.rotation.z = PI2;
    cy(g, 0.22, 0.25, 2.2, ORG, 2.4, FB + 1.1, -10.6, 8);
    bx(g, 0.16, 0.16, 3.0, ORG, 2.4, FB + 3.1, -11.8).rotation.x = 0.58;
    return done(g, L, B, FB);
  }

  /* ═════════════ 청경호 (LNG 추진 실습선) ═════════════ */
  function cheong() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const L = 22, B = 5.2, FB = 2.3, W = B / 2, BOW = 6, ZB = -L / 2;

    /* 선체: 붉은 아랫부분이 넓고, 흰 윗부분 */
    hull(g, L - 0.1, B - 0.12, 2.55, BOW, RED, 0.95);
    hull(g, L, B, FB - 0.95, BOW, WH, FB);
    hull(g, L - 0.4, B - 0.4, 0.06, BOW, '#aab2bb', FB + 0.05);
    band(g, L, B, BOW, FB + 0.3, 0.55, 0.09, WH, 0.08, ZB + 0.3);
    bx(g, B - 0.2, 0.55, 0.09, WH, 0, FB + 0.32, ZB + 0.12);
    band(g, L, B, BOW, 1.08, 0.1, 0.05, NAVY, -0.02, ZB);

    /* 글자 · 선미 줄무늬 */
    side(g, '전 남 대 학 교', 7.8, 0.9, W, 1.75, 1.2, { color: '#14181f' });
    side(g, 'LNG POWERED', 2.4, 0.4, W, 1.75, -6.2, { color: '#1b7a3a' });
    for (const s of [1, -1]) {
      bx(g, 0.05, 1.2, 0.5, GREEN, s * (W + 0.02), 1.6, -9.7).rotation.x = 0.45;
      bx(g, 0.05, 1.2, 0.4, YEL, s * (W + 0.02), 1.6, -9.0).rotation.x = 0.45;
    }
    bx(g, 1.6, 0.5, 0.7, DGRAY, 0, FB + 0.3, 8.4);
    for (const s of [1, -1]) cy(g, 0.11, 0.13, 0.4, YEL, s * 1.5, FB + 0.26, 6.6, 8);

    /* 선교: 아래층 + 조타실 + 날개 */
    bx(g, 4.2, 2.0, 6, WH, 0, FB + 1.0, 3.5);
    bx(g, 4.24, 0.34, 5, DK, 0, FB + 1.15, 3.5);
    bx(g, 3.4, 0.34, 0.06, DK, 0, FB + 1.15, 6.52);
    bx(g, 3.8, 1.7, 4, WH, 0, FB + 2.85, 4.0);
    bx(g, 3.6, 0.8, 0.06, DK, 0, FB + 3.0, 6.02);
    bx(g, 3.84, 0.7, 3.0, DK, 0, FB + 3.0, 3.9);
    bx(g, 4.1, 0.14, 4.4, WH, 0, FB + 3.75, 4.05);
    bx(g, 5.4, 0.14, 1.0, WH, 0, FB + 2.1, 5.2);
    glow(g, 0.1, '#ff3b30', 2.7, FB + 2.3, 5.2);
    glow(g, 0.1, '#2fd27a', -2.7, FB + 2.3, 5.2);
    for (const s of [1, -1]) {
      const lb = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 6, 12), M(ORG)), s * 2.13, FB + 1.3, 1.7);
      lb.rotation.y = PI2;
    }
    /* 선교 위 돛대 */
    cy(g, 0.07, 0.1, 2.6, WH, 0, FB + 5.1, 3.0, 8);
    bx(g, 1.2, 0.07, 0.07, WH, 0, FB + 5.6, 3.0);
    bx(g, 0.8, 0.1, 0.18, BLK, 0, FB + 6.0, 3.0);
    glow(g, 0.09, '#ffffff', 0, FB + 6.45, 3.0);
    cy(g, 0.05, 0.06, 1.6, WH, 0, FB + 4.6, 5.6, 6);

    /* LNG 탱크 */
    const tk = cy(g, 1.25, 1.25, 2.4, WH2, 0, FB + 1.75, -2.3, 20); tk.rotation.x = PI2;
    ball(g, 1.25, WH2, 0, FB + 1.75, -3.5);
    ball(g, 1.25, WH2, 0, FB + 1.75, -1.1);
    bx(g, 2.2, 0.5, 0.5, GRAY, 0, FB + 0.25, -3.3);
    bx(g, 2.2, 0.5, 0.5, GRAY, 0, FB + 0.25, -1.3);
    for (const s of [1, -1]) tplane('LNG', 1.9, 0.85, s * 1.27, FB + 1.75, -2.3, s * PI2, { color: '#1b7a3a' }, g);
    cy(g, 0.08, 0.08, 1.2, DGRAY, 0.5, FB + 3.6, -2.3, 6);

    /* 뒤쪽 선실 + 굴뚝 */
    bx(g, 3.8, 1.5, 3.8, '#dfe4ea', 0, FB + 0.75, -7.5);
    bx(g, 3.84, 0.3, 3.0, DK, 0, FB + 0.95, -7.5);
    bx(g, 2.2, 2.4, 2.4, WH, 0, FB + 2.7, -6.9);
    bx(g, 2.24, 0.18, 2.44, '#1e8f4a', 0, FB + 1.75, -6.9);
    bx(g, 2.24, 0.14, 2.44, YEL, 0, FB + 2.0, -6.9);
    bx(g, 1.9, 0.5, 2.1, BLK, 0, FB + 4.15, -6.9);
    cy(g, 0.3, 0.38, 0.9, BLK, 0, FB + 4.8, -7.1, 10);
    logo(g, 1.1, FB + 2.95, -6.9, 0.55);

    /* 선미 A자 프레임 */
    for (const s of [1, -1]) bx(g, 0.28, 4.0, 0.28, WH, s * 2.1, FB + 2.0, -10.3);
    bx(g, 4.5, 0.3, 0.3, WH, 0, FB + 4.0, -10.3);
    bx(g, 3.9, 0.12, 0.12, WH, 0, FB + 2.6, -10.3);
    return done(g, L, B, FB);
  }

  return { research, cheong };
}