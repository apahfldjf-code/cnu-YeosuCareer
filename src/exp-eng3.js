/* ═══════════════════════════════════════════════════════════════
 * src/exp-eng3.js (신규, E2-3a) — 공학대학 전기·전자·컴퓨터 계열 체험
 *   ece : 전자통신공학과   → 5G 기지국 배치·주파수 대역 선택·통신 품질 시험
 *   eec : 전기및반도체공학과 → 반도체 팹 공정 순서 운영 + 클린룸 먼지 제거(수율)
 *   cse : 컴퓨터공학과     → 블록 코딩(이동·회전·반복) + 오류 디버깅 3단계
 * (스마트전기제어 sec, 스마트ICT융합 ict, 디지털융합정보 dig 는 다음 파일 E2-3b)
 * 공용 도구: tag(글자 간판) 는 export 되어 다음 파일에서도 씁니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, rnd, shuffle } from './experience.js';
import { pipe, link } from './exp-kit.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const LAB = { sky: '#dfe7f1', fog: ['#dfe7f1', 50, 140], sunColor: '#ffffff', sunI: 1.35, hemi: ['#f2f6ff', '#8c97a8', 1.0], sunPos: [18, 40, 22] };
const SUNNY = { sky: '#bfe3ff', fog: ['#d6ecff', 70, 170], sunColor: '#fff4e0', sunI: 1.5, hemi: ['#dff1ff', '#8aa07a', 0.95], sunPos: [25, 50, 20] };

/* 글자 간판(항상 화면을 향하는 스프라이트). set(text, 글자색, 배경색) 으로 다시 쓸 수 있어요 */
export function tag(parent, text, w = 4, h = 1, col = '#ffffff', bg = 'rgba(10,30,60,.8)') {
  const PXW = clamp(Math.round(w * 120), 256, 1024);
  const cv = document.createElement('canvas'); cv.width = PXW; cv.height = Math.max(32, Math.round(PXW * h / w));
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const kMax = w >= 5 ? 1.4 : w >= 3 ? 1.25 : w >= 2 ? 1.3 : 1.15;
  const kk = clamp(720 / Math.max(300, window.innerHeight), 1, kMax);
  sp.scale.set(w * kk, h * kk, 1); sp.renderOrder = 10;
  sp.userData.set = (t, c2, b2) => {
    g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = b2 || bg; g.beginPath();
    if (g.roundRect) g.roundRect(2, 2, cv.width - 4, cv.height - 4, cv.height * 0.3); else g.rect(2, 2, cv.width - 4, cv.height - 4);
    g.fill(); g.fillStyle = c2 || col; g.font = `bold ${Math.round(cv.height * 0.5)}px "Malgun Gothic","Noto Sans KR",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cv.width / 2, cv.height / 2 + 2, cv.width - 24); tex.needsUpdate = true;
  };
  sp.userData.set(text); parent.add(sp); return sp;
}
const kill = (root, g) => { root.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); };

/* ───────────────────────── 1. 전자통신공학과 · 5G 기지국 배치 ───────────────────────── */
registerExperience('ece', {
  icon: '📡', title: '5G 기지국 배치·통신 품질 시험',
  desc: '기지국 3기를 지도 위에 세우고 주파수 대역을 골라, 경기장·학교·병원 등 5곳이 필요한 통신 속도를 얻도록 만들어 보세요. 대역마다 장단점이 달라요.',
  tools: ['🗼 기지국 3기', '📶 주파수 대역 3종', '📊 통신 품질 계측'],
  steps: ['🗼를 끌어서 지도 위에 세워요 (탑을 누르면 선택돼요)', '선택한 탑의 📶 대역을 골라요 · 대역 비용의 합은 6까지예요', '건물 뒤는 신호가 약해지고, 주파수가 높을수록 더 약해져요', '5곳이 모두 ✅가 되면 ✔ 통신 시험!'],
  env: SUNNY,
  build(c) {
    const { root, ui, cam } = c, BUDGET = 6, LIM = 17;
    const BANDS = [
      { n: '700MHz', k: '저대역', R: 24, mx: 100, pen: 1.3, cost: 1, col: '#47b5a2', ic: '🐢', info: '멀리까지 닿지만 속도가 느려요 · 건물에 강해요' },
      { n: '3.5GHz', k: '중대역', R: 15, mx: 900, pen: 2.0, cost: 2, col: '#f2b84b', ic: '🚗', info: '거리와 속도의 균형 · 5G의 기본 대역이에요' },
      { n: '28GHz', k: '초고대역', R: 8, mx: 4000, pen: 5.0, cost: 3, col: '#e0533d', ic: '🚀', info: '엄청 빠르지만 가까이만 닿고 건물에 약해요' },
    ];
    const BLD = [[-3, -2, 3.0, 7], [6, -1, 2.4, 5]];
    const USERS = [
      { ic: '🏟️', n: '경기장', x: 4, z: -10, need: 1500 }, { ic: '🏫', n: '학교', x: -11, z: 4, need: 300 }, { ic: '🏘️', n: '마을', x: 10, z: 7, need: 40 },
      { ic: '🏭', n: '스마트공장', x: -12, z: -11, need: 8 }, { ic: '🏥', n: '병원', x: 0, z: 10, need: 150 },
    ];
    let phase = 'set', sel = 0, drag = null, sig = '', EV = [];

    c.ground('#9cc27f', 27);
    BLD.forEach(([x, z, r, h]) => { c.box(r * 1.8, h, r * 1.8, '#9aa3ad', x, h / 2, z); c.box(r * 1.9, 0.3, r * 1.9, '#6f7a88', x, h + 0.15, z); for (let k = 1; k < h; k += 1.6) c.box(r * 1.84, 0.28, r * 1.84, '#c8d2de', x, k, z); });
    USERS.forEach((u) => {
      c.box(2.4, 1.4, 2.4, '#efe9da', u.x, 0.7, u.z); c.box(2.7, 0.3, 2.7, u.ic === '🏟️' ? '#d6453d' : '#4c6fb0', u.x, 1.55, u.z);
      u.tg = tag(root, '', 5.4, 1.0); u.tg.position.set(u.x, 3.4, u.z); u.last = '';
    });

    const T = [[-6, 14], [0, 14], [6, 14]].map(([x, z], i) => {
      const g = new THREE.Group(); g.userData.ti = i; root.add(g);
      c.cyl(0.15, 0.22, 5, '#cfd6df', 0, 2.5, 0, g, 10);
      const base = c.cyl(1.0, 1.0, 0.12, BANDS[0].col, 0, 0.06, 0, g, 24), head = c.box(1.1, 0.55, 1.1, BANDS[0].col, 0, 5.2, 0, g);
      for (let k = 0; k < 3; k++) { const a = k * 2.094, p = c.box(0.3, 0.9, 0.12, '#f4f6f9', Math.sin(a) * 0.75, 4.6, Math.cos(a) * 0.75, g); p.rotation.y = a; }
      const cov = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: BANDS[0].col, transparent: true, opacity: 0.16, depthWrite: false })); cov.rotation.x = -Math.PI / 2; root.add(cov);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.5, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; root.add(ring);
      const tg = tag(root, '', 2.8, 0.7);
      return { g, base, head, cov, ring, tg, x, z, band: 0 };
    });
    const beams = USERS.map(() => { const b = pipe(root, 0.07, '#ffffff'); b.visible = false; return b; });
    const A = V3(0, 0, 0), B = V3(0, 0, 0);

    const place = (q, x, z) => {
      const r = Math.hypot(x, z); if (r > LIM) { x *= LIM / r; z *= LIM / r; }
      BLD.forEach(([bx, bz, br]) => { const d = Math.hypot(x - bx, z - bz), m = br + 0.9; if (d < m) { const k = d || 0.001; x = bx + ((x - bx) / k) * m; z = bz + ((z - bz) / k) * m; } });
      q.x = x; q.z = z; q.g.position.set(x, 0, z);
    };
    T.forEach((q) => place(q, q.x, q.z));
    const blocked = (ax, az, bx, bz) => BLD.some(([cx, cz, r]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, k = clamp(((cx - ax) * dx + (cz - az) * dz) / L2, 0, 1); return Math.hypot(ax + dx * k - cx, az + dz * k - cz) < r; });
    const speed = (q, u) => { const b = BANDS[q.band], d = Math.hypot(q.x - u.x, q.z - u.z), de = d * (blocked(q.x, q.z, u.x, u.z) ? b.pen : 1); return b.mx * Math.max(0, 1 - de / b.R); };
    const fmt = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'Gbps' : Math.round(v) + 'Mbps');
    const total = () => T.reduce((a, q) => a + BANDS[q.band].cost, 0);
    const syncT = () => T.forEach((q, i) => {
      const b = BANDS[q.band]; q.base.material.color.set(b.col); q.head.material.color.set(b.col); q.cov.material.color.set(b.col);
      q.tg.userData.set(`🗼${i + 1} ${b.n}`, '#fff', 'rgba(10,30,60,.85)'); q.ring.visible = i === sel;
    });
    const refresh = (t) => {
      T.forEach((q) => { q.cov.position.set(q.x, 0.05, q.z); q.cov.scale.setScalar(BANDS[q.band].R); q.ring.position.set(q.x, 0.08, q.z); q.ring.scale.setScalar(1 + 0.06 * Math.sin(t * 6)); q.tg.position.set(q.x, 6.7, q.z); });
      EV = USERS.map((u) => { let s = 0, bi = -1; T.forEach((q, i) => { const v = speed(q, u); if (v > s) { s = v; bi = i; } }); return { s, bi, ok: s >= u.need }; });
      EV.forEach((e, j) => {
        const u = USERS[j], txt = `${u.ic} ${u.n} ${e.ok ? '✅' : '❌'} ${fmt(e.s)}/${fmt(u.need)}`;
        if (txt !== u.last) { u.last = txt; u.tg.userData.set(txt, '#fff', e.ok ? 'rgba(30,120,70,.88)' : 'rgba(140,50,40,.88)'); }
        if (e.s > 0.5) { A.set(T[e.bi].x, 5.2, T[e.bi].z); B.set(u.x, 1.9, u.z); beams[j].visible = true; link(beams[j], A, B); beams[j].material.color.set(e.ok ? '#6dffa8' : '#ffb35c'); } else beams[j].visible = false;
      });
      const n = EV.filter((e) => e.ok).length, k = `${n}|${total()}|${sel}|${T[sel].band}`;
      if (k !== sig) { sig = k; const b = BANDS[T[sel].band]; ui.panel(`<b>📡 통신 시험 ${n}/5곳 연결</b><br>💰 비용 ${total()}/${BUDGET}<br>선택: 🗼${sel + 1} · ${b.n} ${b.k}<br><small>${b.info}</small>`); }
    };
    const setBand = (b) => {
      if (phase !== 'set') return; const q = T[sel], tot = total() - BANDS[q.band].cost + BANDS[b].cost;
      if (tot > BUDGET) { c.sfx.bump(); ui.pop(`비용 초과! (${tot}/${BUDGET})`, null, '#ffd0d0'); ui.hint('다른 기지국의 대역을 낮춰 비용을 아껴요'); return; }
      q.band = b; c.sfx.click(); syncT(); sig = '';
    };
    const bb = BANDS.map((b, i) => ui.button({ icon: b.ic, label: b.k, size: 70, pos: { right: (30 + i * 84) + 'px', bottom: '140px' }, down: () => setBand(i) }));
    const fin = ui.button({ icon: '✔', label: '통신 시험', size: 86, cls: 'grn', pos: { right: '30px', bottom: '36px' }, down: () => done() });
    [...bb, fin].forEach((b) => b.show(false));
    const done = () => {
      if (phase !== 'set') return; phase = 'end'; const n = EV.filter((e) => e.ok).length;
      ui.hint(n === 5 ? '🎉 5곳 모두 연결! 대역을 알맞게 섞어 쓰는 게 핵심이에요' : `${n}곳 연결 · 멀리는 저대역, 빠른 곳은 고대역, 건물 뒤는 낮은 주파수!`); c.finish(30 + 14 * n);
    };
    syncT(); cam.set([0, 27, 21], [0, 0, 1]); cam.fov(50, true); refresh(0);

    return {
      start() { [...bb, fin].forEach((b) => b.show(true)); ui.hint('🗼를 끌어서 세우고, 탑을 누른 뒤 📶 대역을 골라요'); },
      down(p) {
        if (phase !== 'set') return; let k = -1; const h = c.pick(T.map((q) => q.g));
        if (h) { let o = h.object; while (o && o.userData.ti === undefined) o = o.parent; if (o) k = o.userData.ti; }
        const pt = c.at(0); if (!pt) return;
        if (k < 0) { let bd = 3.2; T.forEach((q, i) => { const d = Math.hypot(q.x - pt.x, q.z - pt.z); if (d < bd) { bd = d; k = i; } }); }
        if (k < 0) return; sel = k; drag = { k, ox: T[k].x - pt.x, oz: T[k].z - pt.z }; c.sfx.click(); syncT(); sig = '';
      },
      move(p) { if (!drag || !p.down) return; const pt = c.at(0); if (pt) place(T[drag.k], pt.x + drag.ox, pt.z + drag.oz); },
      up() { drag = null; },
      key(code) { const m = { Digit1: 0, Digit2: 1, Digit3: 2 }[code]; if (m !== undefined) setBand(m); },
      idle(dt, t) { refresh(t); },
      update(dt, t) { refresh(t); },
    };
  },
});

/* ───────────────────────── 2. 전기및반도체공학과 · 반도체 팹 공정 ───────────────────────── */
registerExperience('eec', {
  icon: '🔌', title: '반도체 팹 공정 운영',
  desc: '웨이퍼를 공정 장비에 알맞은 순서로 옮겨 칩을 만들어요. 장비가 돌아가는 동안 떨어지는 먼지를 지워 불량 없는 칩(수율)을 지켜 보세요.',
  tools: ['💿 웨이퍼', '🏭 공정 장비 5종', '🧹 클린룸 먼지 제거'],
  steps: ['웨이퍼(💿)를 끌어서 알맞은 공정 장비 위에 올려요', '장비가 돌아가는 동안 떨어지는 먼지를 톡톡 눌러 없애요', '순서가 틀리면 이유를 알려 줘요', '5단계를 마치고 좋은 칩이 많을수록 고득점!'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c, X = [-9, -4.5, 0, 4.5, 9], HOME = V3(0, 0.3, 6.4), OV = [[0, 15, 13.5], [0, 0, 1.5]];
    const ST = [
      { n: '산화', fn: '웨이퍼 표면에 얇은 절연막을 만들어요', col: '#5aa9e6', wafer: '#9db8d6', why: '' },
      { n: '포토', fn: '빛으로 회로 그림을 새겨요', col: '#e8c34a', wafer: '#c9a54a', why: '산화막이 먼저 있어야 그 위에 회로 그림을 새길 수 있어요' },
      { n: '식각', fn: '그려진 회로대로 필요 없는 부분을 깎아요', col: '#9aa3ad', wafer: '#6f7a88', why: '포토로 회로 그림을 새겨야 어디를 깎을지 알 수 있어요' },
      { n: '증착', fn: '깎은 홈에 금속·절연 박막을 입혀요', col: '#c06bd8', wafer: '#b98a4a', why: '식각으로 홈을 판 뒤에 그 안에 박막을 채워요' },
      { n: '테스트·패키징', fn: '완성된 칩을 검사하고 포장해요', col: '#3cd17a', wafer: '#2f3a4a', why: '회로가 모두 완성된 뒤에 검사하고 포장해요' },
    ];
    let slots; do { slots = shuffle([0, 1, 2, 3, 4]); } while (slots.every((s, i) => s === i));
    let phase = 'pick', idx = 0, wrong = 0, drag = null, proc = null, ended = false, endT = 0, fin = false, score = 0;
    const specks = [];

    c.ground('#aeb7c2', 32); c.box(27, 0.2, 10, '#e4e9f0', 0, -0.1, 1);
    ST.forEach((s, i) => {
      s.x = X[slots[i]]; s.done = false;
      s.body = c.box(3.2, 1.6, 3.0, s.col, s.x, 0.8, 0); c.box(2.4, 0.3, 2.2, '#e8edf3', s.x, 1.75, 0);
      s.tg = tag(root, s.n, 3.8, 0.9); s.tg.position.set(s.x, 3.5, 0);
    });
    c.cyl(1.9, 1.9, 0.2, '#6f7a88', 0, 0.1, 6.4); const trayTg = tag(root, '💿 웨이퍼 (끌어서 옮겨요)', 4.8, 0.8); trayTg.position.set(0, 1.7, 6.4);

    const wf = new THREE.Group(); root.add(wf); wf.position.copy(HOME);
    const wbase = c.cyl(1.25, 1.25, 0.14, '#c5ccd6', 0, 0, 0, wf, 40), dies = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const d = c.box(0.46, 0.06, 0.46, '#4a5fa0', a * 0.58, 0.1, b * 0.58, wf); d.userData.bad = false; dies.push(d); }

    const showPanel = () => {
      const order = [0, 1, 2, 3, 4].map((p) => ST[slots.indexOf(p)]);
      ui.panel('<b>🏭 공정 장비 (왼쪽→오른쪽)</b><br>' + order.map((s) => `${s.done ? '✅' : '⬜'} <b>${s.n}</b> — ${s.fn}`).join('<br>') + `<br>진행 ${idx}/5 · 순서 오류 ${wrong}번`);
    };
    const goHome = () => { wf.position.copy(HOME); };
    const dropSpeck = (s) => { root.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); };
    const tapDust = () => {
      let best = -1, bd = 84; const v = V3(0, 0, 0);
      specks.forEach((s, i) => { v.copy(s.m.position).project(c.camera); const d = Math.hypot(((v.x - c.ptr.nx) * innerWidth) / 2, ((v.y - c.ptr.ny) * innerHeight) / 2); if (d < bd) { bd = d; best = i; } });
      if (best < 0) return; const s = specks.splice(best, 1)[0]; ui.pop('✨', s.m.position, '#cfffe0'); dropSpeck(s); c.sfx.pickup(); c.buzz(10);
    };
    const startProc = (i) => {
      const s = ST[i], n = [3, 3, 4, 4, 5][i]; phase = 'proc'; wf.position.set(s.x, 2.05, 0);
      proc = { i, t: 0, times: Array.from({ length: n }, (_, k) => 0.4 + k * (1.7 / n) + rnd(0, 0.25)) };
      cam.to([s.x, 9.5, 7.5], [s.x, 2, 0]); ui.hint('🧹 떨어지는 먼지를 톡톡 눌러 없애요!'); c.sfx.go();
    };
    const finishProc = () => {
      const s = ST[proc.i]; wbase.material.color.set(s.wafer); s.done = true; s.tg.userData.set('✅ ' + s.n, '#fff', 'rgba(30,120,70,.88)');
      s.body.material.emissive.set('#000000'); idx++; proc = null; c.sfx.ok(); showPanel();
      if (idx === 5) {
        const good = dies.filter((d) => !d.userData.bad).length; dies.forEach((d) => { if (!d.userData.bad) d.material.color.set('#3cd17a'); });
        score = Math.round(35 + (50 * good) / 9 + Math.max(0, 15 - 5 * wrong)); ended = true; endT = 2.0; phase = 'end';
        ui.hint(`🧪 테스트 결과: 좋은 칩 ${good}/9 (수율 ${Math.round((good / 9) * 100)}%) · 먼지 한 알이 칩 하나를 망쳐요`);
      } else { phase = 'pick'; goHome(); cam.to(OV[0], OV[1]); ui.hint('다음 공정 장비를 골라 웨이퍼를 옮겨요'); }
    };
    const tryStation = (i) => {
      if (i === idx) { startProc(i); return; }
      wrong++; c.sfx.bump(); c.buzz(30); ui.pop('순서가 달라요!', null, '#ffd0d0');
      ui.hint('💡 ' + (i < idx ? `${ST[i].n}은(는) 이미 끝낸 공정이에요` : ST[i].why)); goHome(); showPanel();
    };

    cam.set(OV[0], OV[1]); cam.fov(50, true);
    return {
      start() { showPanel(); ui.hint('웨이퍼(💿)를 끌어서 첫 공정 장비에 올려요 · 장비 설명을 읽고 순서를 생각해요'); },
      down(p) {
        if (phase === 'proc') { tapDust(); return; } if (phase !== 'pick') return;
        let ok = !!c.pick([wf]); if (!ok) { const q = c.at(wf.position.y); ok = !!q && Math.hypot(q.x - wf.position.x, q.z - wf.position.z) < 2.8; }
        if (!ok) return; const pt = c.at(2.8); if (!pt) return;
        drag = { ox: wf.position.x - pt.x, oz: wf.position.z - pt.z }; wf.position.y = 2.8; c.sfx.click();
      },
      move(p) { if (!drag || !p.down) return; const pt = c.at(2.8); if (pt) wf.position.set(clamp(pt.x + drag.ox, -13, 13), 2.8, clamp(pt.z + drag.oz, -4, 9)); },
      up() {
        if (!drag) return; drag = null; let bi = -1, bd = 2.6;
        ST.forEach((s, i) => { const d = Math.hypot(s.x - wf.position.x, wf.position.z); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0) goHome(); else tryStation(bi);
      },
      update(dt, t) {
        if (ended) { endT -= dt; if (endT <= 0 && !fin) { fin = true; c.finish(score); } return; }
        if (phase !== 'proc' || !proc) return;
        proc.t += dt; const s = ST[proc.i]; s.body.material.emissive.set(s.col); s.body.material.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 10);
        while (proc.times.length && proc.t >= proc.times[0]) {
          proc.times.shift(); const k = Math.floor(Math.random() * 9), m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), c.mat('#5b4636'));
          m.position.set(s.x + dies[k].position.x, 5.0, dies[k].position.z); root.add(m); specks.push({ m, k });
        }
        for (let i = specks.length - 1; i >= 0; i--) {
          const q = specks[i]; q.m.position.y -= 1.2 * dt;
          if (q.m.position.y <= 2.3) {
            if (!dies[q.k].userData.bad) { dies[q.k].userData.bad = true; dies[q.k].material.color.set('#d6453d'); ui.pop('💥 먼지 묻음!', q.m.position, '#ffd0d0'); c.sfx.bump(); }
            dropSpeck(q); specks.splice(i, 1);
          }
        }
        if (proc.t > 2.4 && !proc.times.length && !specks.length) finishProc();
      },
    };
  },
});

/* ───────────────────────── 3. 컴퓨터공학과 · 블록 코딩 + 디버깅 ───────────────────────── */
registerExperience('cse', {
  icon: '💻', title: '코딩 퀘스트: 블록 코딩과 디버깅',
  desc: '명령 블록을 순서대로 쌓아 프로그램을 만들고 ▶ 실행! 캐릭터가 코인을 모으고 🏁에 도착하도록 코드를 짜 보세요. 오류가 나면 코드를 고치는 디버깅도 해요.',
  tools: ['🧩 명령 블록 (이동·회전·반복)', '▶ 실행 · 🐞 디버깅'],
  steps: ['⬆ ↰ ↱ 블록을 눌러 프로그램에 한 줄씩 추가해요', '🔁2·🔁3 은 바로 다음 블록을 2번·3번 반복해요 (짧은 코드 = 고득점)', '▶ 실행! 벽이나 🐞 버그 칸에 부딪히면 오류예요', '코드를 고쳐(디버깅) 3단계를 모두 깨 보세요'],
  env: LAB,
  build(c) {
    const { root, ui, cam } = c, TS = 2.2, MAXB = 24, DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1];
    const LV = [
      { name: '1단계 · 첫 프로그램', map: ['S.*.G'], par: 3, hint: '🪙을 먹고 🏁에 도착해요. 🔁로 짧게 만들어 보세요' },
      { name: '2단계 · 회전과 반복', map: ['S....*', '####.#', 'G*....'], par: 14, hint: '벽 사이로 길이 있어요. ↱ ↰ 와 🔁를 섞어 보세요' },
      { name: '3단계 · 디버깅', map: ['S.B.*', '...B.', 'B*..G'], par: 14, hint: '🐞 버그 칸을 밟으면 오류! 피해서 모든 🪙을 모아요' },
    ];
    let lv = 0, prog = [], phase = 'edit', run = null, got = 0, fails = 0, lvFails = 0, total = 0, tm = 0, lvG = null, coins = [], hp = { x: 0, y: 0, d: 0 }, yaw = Math.PI / 2, st = { x: 0, y: 0 }, gp = () => [0, 0];
    const hero = c.avatar(0, 0, Math.PI / 2);

    const showPanel = () => {
      const cur = run && run.cur ? run.cur : null;
      const seq = prog.map((q, i) => { const s = q.t === 'F' ? '⬆' : q.t === 'L' ? '↰' : q.t === 'R' ? '↱' : '🔁' + q.n; return cur && (cur.i === i || cur.r === i) ? `<b style="color:#ffd24d">[${s}]</b>` : s; }).join(' ');
      ui.panel(`<b>${LV[lv].name}</b><br><small>${LV[lv].hint}</small><br>🧩 블록 ${prog.length}/${MAXB} · 목표 ${LV[lv].par}줄 이하<br>🪙 ${got}/${coins.length} · 오류 ${lvFails}번<br><span style="font-size:15px;letter-spacing:2px">${seq || '(비어 있음)'}</span>`);
    };
    const loadLevel = (n) => {
      if (lvG) kill(root, lvG); lvG = new THREE.Group(); root.add(lvG);
      const M = LV[n].map, H = M.length, W = M[0].length; coins = []; prog = []; got = 0; lvFails = 0; phase = 'edit'; run = null;
      gp = (x, y) => [(x - (W - 1) / 2) * TS, (y - (H - 1) / 2) * TS];
      M.forEach((row, y) => [...row].forEach((ch, x) => {
        const [px, pz] = gp(x, y);
        c.box(TS - 0.12, 0.3, TS - 0.12, (x + y) % 2 ? '#dbe3ec' : '#cdd7e2', px, -0.15, pz, lvG);
        if (ch === '#') c.box(TS - 0.2, 1.5, TS - 0.2, '#5f6b7a', px, 0.75, pz, lvG);
        if (ch === 'S') { c.box(TS - 0.4, 0.04, TS - 0.4, '#3cd17a', px, 0.02, pz, lvG); st = { x, y }; }
        if (ch === 'B') { c.box(TS - 0.4, 0.05, TS - 0.4, '#d6453d', px, 0.03, pz, lvG); const s = tag(lvG, '🐞', 1.3, 1.3, '#fff', 'rgba(0,0,0,0)'); s.position.set(px, 1.1, pz); }
        if (ch === 'G') { c.box(TS - 0.4, 0.04, TS - 0.4, '#ffffff', px, 0.02, pz, lvG); c.cyl(0.06, 0.06, 1.6, '#dddddd', px - 0.4, 0.8, pz, lvG, 8); c.box(0.7, 0.45, 0.05, '#d6453d', px - 0.05, 1.35, pz, lvG); }
        if (ch === '*') { const g = new THREE.Group(); g.position.set(px, 0.8, pz); lvG.add(g); const m = c.cyl(0.5, 0.5, 0.14, '#f2c94c', 0, 0, 0, g, 24); m.rotation.x = Math.PI / 2; coins.push({ x, y, m: g, got: false }); }
      }));
      resetHero(); cam.to([0, 12.5, 9], [0, 0, 0.6]); showPanel();
    };
    const resetHero = () => {
      got = 0; coins.forEach((q) => { q.got = false; q.m.visible = true; }); hp = { x: st.x, y: st.y, d: 0 }; yaw = Math.PI / 2;
      const [x, z] = gp(st.x, st.y); hero.group.position.set(x, 0, z); hero.group.rotation.y = yaw; run = null;
    };
    const add = (tok) => {
      if (phase !== 'edit') return; if (prog.length >= MAXB) { ui.pop('블록이 가득 찼어요', null, '#ffe9a0'); return; }
      prog.push(tok); c.sfx.click(); showPanel();
    };
    const undo = () => { if (phase !== 'edit' || !prog.length) return; prog.pop(); c.sfx.click(); showPanel(); };
    const clear = () => { if (phase !== 'edit' || !prog.length) return; prog = []; c.sfx.click(); showPanel(); };
    const compile = () => {
      const out = [];
      for (let i = 0; i < prog.length; i++) {
        const t = prog[i];
        if (t.t === 'rep') { const nx = prog[i + 1]; if (!nx || nx.t === 'rep') return { err: '🔁 반복 블록 바로 다음에는 이동·회전 블록이 필요해요 (문법 오류)' }; for (let k = 0; k < t.n; k++) out.push({ t: nx.t, i: i + 1, r: i }); i++; }
        else out.push({ t: t.t, i });
      }
      return { out };
    };
    const runProg = () => {
      if (phase !== 'edit') return;
      if (!prog.length) { ui.pop('먼저 블록을 추가해요', null, '#ffe9a0'); return; }
      const r = compile(); if (r.err) { c.sfx.bump(); ui.hint('🐞 ' + r.err); ui.pop('문법 오류!', null, '#ffd0d0'); return; }
      resetHero(); run = { out: r.out, i: 0, a: null, cur: null }; phase = 'run'; c.sfx.go(); ui.hint('실행 중…');
    };
    const crash = (msg) => {
      phase = 'fail'; tm = 1.4; fails++; lvFails++; c.sfx.bump(); c.buzz(30);
      ui.hint(msg + ' 코드를 고쳐 다시 실행해요 (디버깅)'); ui.pop('💥 오류!', hero.group.position.clone().add(V3(0, 2, 0)), '#ffd0d0'); showPanel();
    };
    const cleared = () => {
      const s = clamp(Math.round(23 + 10 * Math.min(1, LV[lv].par / prog.length) - 3 * lvFails), 8, 33); total += s; phase = 'next'; tm = 1.8;
      ui.banner(`✅ ${lv + 1}단계 클리어! +${s}`); c.sfx.ok(); ui.hint(prog.length <= LV[lv].par ? '완벽해요! 가장 짧은 코드예요' : `${prog.length}줄로 성공 · 반복(🔁)을 쓰면 더 짧게 만들 수 있어요`);
    };
    const finishRun = () => { const ok = LV[lv].map[hp.y][hp.x] === 'G'; if (ok && got === coins.length) cleared(); else crash(ok ? '🪙 코인이 아직 남아 있어요!' : '🏁 도착점에 닿지 못했어요!'); };
    const stepRun = (dt, t) => {
      if (!run.a) {
        if (run.i >= run.out.length) { finishRun(); return; }
        const a = run.out[run.i]; run.cur = a;
        if (a.t === 'F') {
          const nx = hp.x + DX[hp.d], ny = hp.y + DZ[hp.d], ch = (LV[lv].map[ny] || '')[nx];
          if (ch === undefined) { crash('🗺 지도 밖으로 나갔어요!'); return; }
          if (ch === '#') { crash('🧱 벽에 부딪혔어요!'); return; }
          if (ch === 'B') { crash('🐞 버그 칸을 밟았어요!'); return; }
          run.a = { k: 'F', tx: nx, ty: ny, fx: hp.x, fy: hp.y, e: 0, dur: 0.5 };
        } else run.a = { k: 'T', e: 0, dur: 0.35, y0: yaw, y1: yaw + ((a.t === 'R' ? -1 : 1) * Math.PI) / 2 };
        showPanel();
      }
      const a = run.a; a.e += dt; const k = clamp(a.e / a.dur, 0, 1), s = k * k * (3 - 2 * k);
      if (a.k === 'F') { const [x0, z0] = gp(a.fx, a.fy), [x1, z1] = gp(a.tx, a.ty); hero.group.position.set(x0 + (x1 - x0) * s, 0, z0 + (z1 - z0) * s); hero.walk(t * 1.6, 1); }
      else { yaw = a.y0 + (a.y1 - a.y0) * s; hero.group.rotation.y = yaw; hero.walk(t, 0); }
      if (k >= 1) {
        if (a.k === 'F') {
          hp.x = a.tx; hp.y = a.ty; const q = coins.find((o) => !o.got && o.x === hp.x && o.y === hp.y);
          if (q) { q.got = true; q.m.visible = false; got++; c.sfx.pickup(); ui.pop('🪙 +1', hero.group.position.clone().add(V3(0, 2, 0)), '#ffe27a'); }
        } else hp.d = (hp.d + (run.cur.t === 'R' ? 1 : 3)) % 4;
        run.a = null; run.i++; showPanel();
      }
    };

      const bF = ui.button({ icon: '⬆', label: '앞으로', size: 62, pos: { right: '22px', bottom: '136px' }, down: () => add({ t: 'F' }) });
      const bL = ui.button({ icon: '↰', label: '왼쪽', size: 62, pos: { right: '92px', bottom: '136px' }, down: () => add({ t: 'L' }) });
      const bR = ui.button({ icon: '↱', label: '오른쪽', size: 62, pos: { right: '162px', bottom: '136px' }, down: () => add({ t: 'R' }) });
      const b2 = ui.button({ icon: '🔁', label: '×2', size: 62, pos: { right: '232px', bottom: '136px' }, down: () => add({ t: 'rep', n: 2 }) });
      const b3 = ui.button({ icon: '🔁', label: '×3', size: 62, pos: { right: '302px', bottom: '136px' }, down: () => add({ t: 'rep', n: 3 }) });
    const bRun = ui.button({ icon: '▶', label: '실행', size: 84, cls: 'grn', pos: { right: '22px', bottom: '34px' }, down: runProg });
    const bUndo = ui.button({ icon: '⌫', label: '지우기', size: 58, pos: { right: '118px', bottom: '44px' }, down: undo });
    const bClr = ui.button({ icon: '🗑', label: '전부', size: 58, pos: { right: '186px', bottom: '44px' }, down: clear });
    const all = [bF, bL, bR, b2, b3, bRun, bUndo, bClr]; all.forEach((b) => b.show(false));

    cam.set([0, 12.5, 9], [0, 0, 0.6]); cam.fov(50, true); loadLevel(0);
    const spin = (dt) => coins.forEach((q) => { if (!q.got) q.m.rotation.y += dt * 2.5; });
    return {
      start() { all.forEach((b) => b.show(true)); ui.hint(LV[lv].hint); },
      key(code) {
        const m = { ArrowUp: { t: 'F' }, KeyW: { t: 'F' }, ArrowLeft: { t: 'L' }, KeyA: { t: 'L' }, ArrowRight: { t: 'R' }, KeyD: { t: 'R' } }[code];
        if (m) add(m); else if (code === 'Backspace') undo(); else if (code === 'Enter') runProg();
      },
      idle(dt, t) { hero.walk(t, 0); spin(dt); },
      update(dt, t) {
        spin(dt);
        if (phase === 'run') stepRun(dt, t);
        else if (phase === 'fail') { hero.walk(t, 0); tm -= dt; if (tm <= 0) { resetHero(); phase = 'edit'; showPanel(); } }
        else if (phase === 'next') {
          hero.walk(t, 0); tm -= dt;
          if (tm <= 0) { if (lv + 1 < LV.length) { lv++; loadLevel(lv); ui.hint(LV[lv].hint); } else { phase = 'end'; c.finish(Math.min(100, total + (fails === 0 ? 1 : 0))); } }
        } else hero.walk(t, 0);
      },
    };
  },
});