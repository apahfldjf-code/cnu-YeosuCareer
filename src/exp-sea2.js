/* ═══════════════════════════════════════════════════════════════
 * src/exp-sea2.js (신규, 수산해양 S2-a)
 *   mar : 기관시스템공학과 → 새동백호 기관실 · 시동 절차 · 선교 명령 운전 · 경보 대응
 *   aqu : 양식생물학과     → 스마트 양식장 · 수온/산소/사료 관리 · 폭염 · 한밤중 정전
 * 공용 도구(h, btn, slider, bar, dock, gauge, quizFlow, gauss, ENG_ENV, LAB_ENV)는 exp-sea3.js 도 가져다 써요.
 * 조작은 모두 화면의 슬라이더·버튼(터치 가능)이에요. 수치는 학습용으로 단순화한 게임 값이에요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { registerExperience, clamp, shuffle } from './experience.js';
import { engine } from './core.js';
import { tagSprite, snd, vib } from './exp-sea-kit.js';

/* ───────── 공용 도구 ───────── */
export const h = (tag, css = '', html = '') => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html) e.innerHTML = html; return e; };
export const btn = (label, cb, css = '') => {
  const b = h('button', 'min-height:44px;padding:8px 12px;border:1px solid rgba(255,255,255,.24);border-radius:12px;background:#27405f;color:#fff;font:inherit;font-weight:800;text-align:left;cursor:pointer;touch-action:manipulation;line-height:1.35;' + css, label);
  b.type = 'button'; b.addEventListener('click', cb); return b;
};
export const gauss = (sd) => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd; };
export const ENG_ENV = { sky: '#101a28', fog: ['#101a28', 50, 160], sunColor: '#fff3e0', sunI: 1.3, hemi: ['#e6f0ff', '#4a566b', 1.15], sunPos: [10, 40, 25] };
export const LAB_ENV = { sky: '#cfe3f2', fog: ['#cfe3f2', 60, 220], sunColor: '#ffffff', sunI: 1.6, hemi: ['#f2f8ff', '#8aa0b4', 1.1], sunPos: [10, 40, 25] };

export function bar(col = '#35c3ff') {
  const o = h('div', 'height:12px;border-radius:8px;background:rgba(255,255,255,.14);overflow:hidden;flex:none');
  const i = h('div', `height:100%;width:0%;background:${col};transition:width .2s`); o.append(i);
  return { el: o, set(p, col2) { i.style.width = clamp(p, 0, 100) + '%'; if (col2) i.style.background = col2; } };
}

export function slider(label, unit, min, max, step, val, cb, dec = 0) {
  const w = h('div', 'padding:4px 2px;flex:none');
  const top = h('div', 'display:flex;justify-content:space-between;margin-bottom:2px');
  const v = h('b', 'color:#ffd34d'); top.append(h('span', '', label), v);
  const r = h('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val;
  r.style.cssText = 'width:100%;height:30px;accent-color:#35c3ff;touch-action:none';
  const upd = () => { v.textContent = Number(r.value).toFixed(dec) + unit; };
  r.addEventListener('input', () => { upd(); cb(parseFloat(r.value)); });
  upd(); w.append(top, r);
  return { el: w, get: () => parseFloat(r.value), set: (x) => { r.value = x; upd(); cb(parseFloat(r.value)); } };
}

/* 오른쪽 조작 패널 (▼ 로 접을 수 있어요) */
export function dock(c, title) {
  const small = window.innerHeight <= 430;
  const el = h('div', `position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(62px + env(safe-area-inset-top,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(${small ? 47 : 42}vw,${small ? 330 : 390}px);display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:14px;background:rgba(8,20,38,.88);border:1px solid rgba(160,210,255,.28);color:#eaf4ff;font-size:calc(${small ? 12 : 13}px*var(--xs,1));font-weight:700;overflow-y:auto;pointer-events:auto;z-index:6;overscroll-behavior:contain`);
  ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'contextmenu'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation()));
  const head = h('div', 'display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:1.12em;font-weight:900;position:sticky;top:-8px;background:rgba(8,20,38,.96);padding:2px 0;z-index:1;flex:none');
  const tt = h('span', '', title);
  const body = h('div', 'display:flex;flex-direction:column;gap:6px');
  let open = true;
  const tog = btn('▼', () => { open = !open; body.style.display = open ? 'flex' : 'none'; el.style.bottom = open ? `calc(10px + env(safe-area-inset-bottom,0px))` : 'auto'; tog.textContent = open ? '▼' : '▶'; }, 'min-height:32px;min-width:40px;padding:2px 8px;text-align:center');
  head.append(tt, tog); el.classList.add('cul'); el.append(head, body); c.ui.layer.append(el);
  return {
    el, body, clear() { body.innerHTML = ''; el.scrollTop = 0; }, add(...n) { body.append(...n); }, title(t) { tt.innerHTML = t; },
    dispose() { el.remove(); },
  };
}

/* 바늘 계기판 (3D 판) */
export function gauge(label, unit, min, max, zones, w = 3.4, dec = 0) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const ang = (v) => Math.PI * 0.75 + clamp((v - min) / (max - min), 0, 1) * Math.PI * 1.5;
  let last = NaN, lastM = NaN, Z = zones;
  const F = (s) => `800 ${s}px "Malgun Gothic","Noto Sans KR",sans-serif`;
  const draw = (v, m) => {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#0c1522'; g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b7c93'; g.lineWidth = 6; g.stroke();
    Z.forEach((z) => { g.strokeStyle = z.col; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 100, ang(z.a), ang(z.b)); g.stroke(); });
    for (let i = 0; i <= 10; i++) { const a = ang(min + ((max - min) * i) / 10), ca = Math.cos(a), sa = Math.sin(a); g.strokeStyle = '#cfd8e3'; g.lineWidth = i % 5 === 0 ? 4 : 2; g.beginPath(); g.moveTo(128 + ca * 82, 128 + sa * 82); g.lineTo(128 + ca * 91, 128 + sa * 91); g.stroke(); }
    if (m != null) { const a = ang(m); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128 + Math.cos(a) * 113, 128 + Math.sin(a) * 113, 6, 0, Math.PI * 2); g.fill(); }
    const a = ang(v); g.strokeStyle = '#ffd34d'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); g.stroke();
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(128, 128, 9, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#9fc4ff'; g.font = F(22); g.fillText(label, 128, 72);
    g.fillStyle = '#ffffff'; g.font = F(36); g.fillText(Number(v).toFixed(dec), 128, 176);
    g.fillStyle = '#9fb3c9'; g.font = F(20); g.fillText(unit, 128, 208);
  };
  draw(min, null); tex.needsUpdate = true;
  return {
    mesh,
    set(v, m = null) { if (Math.abs(v - last) > (max - min) * 0.002 || m !== lastM) { last = v; lastM = m; draw(v, m); tex.needsUpdate = true; } },
    zones(z) { Z = z; last = NaN; },
  };
}

/* 객관식 흐름: qs=[{q, a:[[보기, 정답여부, 해설]], enter?, after?(ok)}] → done(맞은 개수, 전체) */
export function quizFlow(dk, qs, done) {
  let i = 0, right = 0;
  const show = () => {
    const q = qs[i]; if (q.enter) q.enter();
    dk.clear(); dk.add(h('div', 'font-size:1.05em;line-height:1.5;flex:none', `<b>Q${i + 1}/${qs.length}</b> ${q.q}`));
    const box = h('div', 'display:flex;flex-direction:column;gap:6px'); dk.add(box);
    let locked = false;
    shuffle(q.a.slice()).forEach(([t, ok, why]) => {
      const b = btn(t, () => {
        if (locked) return; locked = true; if (ok) right++;
        b.style.background = ok ? '#1f9d55' : '#c0392b';
        const ans = q.a.find((x) => x[1]);
        box.append(h('div', `padding:8px 10px;border-radius:10px;line-height:1.5;background:${ok ? 'rgba(40,160,90,.28)' : 'rgba(220,70,60,.28)'}`, `${ok ? '✅ 정답!' : '❌ 아쉬워요.'} ${why}${ok ? '' : `<br><b>정답:</b> ${ans[0]}`}`));
        box.append(btn(i + 1 < qs.length ? '다음 ▶' : '결과 보기 ▶', () => { i++; if (i < qs.length) show(); else done(right, qs.length); }, 'background:#2a6bff'));
        if (q.after) q.after(ok);
      });
      box.append(b);
    });
  };
  show();
}

/* ═══════════════ 1. 기관시스템공학과 — 새동백호 기관실 ═══════════════ */
registerExperience('mar', {
  icon: '🛠️', title: '새동백호 기관실 · 엔진 당직 실습',
  desc: '실습선 새동백호의 기관사가 되어 엔진을 시동하고, 선교의 속도 명령에 맞춰 회전수·냉각수·윤활유를 조절하고, 경보가 울리면 안전하게 대응하는 기관실 당직을 체험해 보세요.',
  tools: ['⚙ 주기관(디젤 엔진)', '🌡 냉각수 밸브', '🛢 윤활유 펌프', '🚨 경보 장치'],
  steps: ['시동 전 안전 절차를 알맞은 순서로 눌러 엔진을 시동해요 (윤활·냉각 → 연료·터닝기어 → 시동 공기)', '선교 명령(미속·순항·전속)의 목표 RPM에 맞추고, 온도(65~85℃)·유압(3.5~6bar)을 초록 구간에 6초 유지해요', '냉각수 95℃ 초과나 유압 저하가 3초 이어지면 안전장치가 엔진을 세워요', '경보가 울리면 가장 안전한 조치를 골라요'],
  env: ENG_ENV,
  build(c) {
    const { root, ui, cam } = c;
    /* 기관실 */
    c.box(36, 0.4, 26, '#4a5666', 3, -0.2, 0, root); c.box(36, 0.02, 0.5, '#e0b13a', 3, 0.02, 6, root);
    c.box(36, 11, 0.5, '#26384d', 3, 5.5, -9.2, root); c.box(0.5, 11, 26, '#2b3d54', -15, 5.5, 0, root);
    /* 주기관 */
    c.box(14, 0.5, 4.8, '#1a2d44', 0.5, 0.25, 0, root); c.box(13, 2.6, 4.4, '#23405e', 0.5, 1.8, 0, root);
    const heads = [], rods = [];
    for (let i = 0; i < 6; i++) {
      const x = -4.5 + i * 1.9;
      heads.push(c.box(1.5, 1.7, 2.6, '#2f8f6b', x, 3.95, 0, root));
      c.cyl(0.35, 0.35, 1.1, '#c8d0da', x, 5.2, 0, root, 10);
      c.box(1.0, 1.6, 0.12, '#10202f', x, 2.0, 2.24, root);
      rods.push(c.cyl(0.24, 0.24, 1.5, '#d7dde5', x, 2.0, 2.36, root, 10));
    }
    const fly = new THREE.Group(); fly.position.set(8.4, 2.2, 0); root.add(fly);
    const disc = c.cyl(1.8, 1.8, 0.5, '#8a96a6', 0, 0, 0, fly, 28); disc.rotation.z = Math.PI / 2; c.box(0.6, 0.3, 0.3, '#ffd34d', 0, 1.5, 0, fly);
    c.cyl(0.4, 0.4, 7, '#9aa5b3', 13.4, 2.2, 0, root, 12).rotation.z = Math.PI / 2;
    c.cyl(0.7, 0.7, 9, '#58606c', -6.5, 6.5, -3, root, 12); c.cyl(1.4, 1.4, 3, '#c0392b', -11, 1.5, -4, root, 16);
    const tg = (t, bg, x, y, z, w = 7, hh = 1.8) => { const s = tagSprite(t, bg, w, hh); s.position.set(x, y, z); root.add(s); };
    tg('주기관 · 디젤 엔진', 'rgba(10,90,140,.9)', 0.5, 6.0, 2.6); tg('연료유 탱크', 'rgba(150,50,40,.9)', -11, 4.0, -4, 5.5, 1.4);
    const lamps = [0, 1, 2, 3, 4].map((i) => c.sph(0.3, '#3a4658', -3.5 + i * 2.5, 10.3, -8.8, root));
    const beacon = c.cyl(0.4, 0.4, 0.8, '#d33', 3, 9.4, -8.8, root, 12); beacon.material.emissive = new THREE.Color('#ff2222'); beacon.material.emissiveIntensity = 0.05;
    const av = c.avatar(0, 0, 0); root.add(av.group); av.group.position.set(-8, 0, 5); av.group.rotation.y = Math.PI;
    const ZR = [{ a: 0, b: 600, col: '#555d68' }, { a: 600, b: 1800, col: '#2a8a4a' }, { a: 1800, b: 2000, col: '#c0392b' }];
    const ZT = [{ a: 20, b: 65, col: '#e0b13a' }, { a: 65, b: 85, col: '#2a9d4a' }, { a: 85, b: 95, col: '#e0b13a' }, { a: 95, b: 110, col: '#d33' }];
    const ZP = [{ a: 0, b: 2.5, col: '#d33' }, { a: 2.5, b: 3.5, col: '#e0b13a' }, { a: 3.5, b: 6, col: '#2a9d4a' }, { a: 6, b: 7, col: '#e0b13a' }, { a: 7, b: 8, col: '#d33' }];
    const gR = gauge('엔진 회전수', 'RPM', 0, 2000, ZR, 3.4, 0), gT = gauge('냉각수 온도', '℃', 20, 110, ZT, 3.4, 0), gP = gauge('윤활유 압력', 'bar', 0, 8, ZP, 3.4, 1);
    [[gR, -2], [gT, 2.5], [gP, 7]].forEach(([g, x]) => { g.mesh.position.set(x, 7.6, -8.9); root.add(g.mesh); });

    const dk = dock(c, '🛠️ 기관실 당직');
    const S = { rpm: 0, set: 600, T: 28, P: 0, valve: 0.5, pump: 0.6, running: false, lube: false, cool: false, crank: 0, alarm: false, lockP: null, lockT: null };
    const ORD = [{ n: '입항 미속', rpm: 900, msg: '🔔 선교: 입항 준비, 미속 전진!' }, { n: '순항', rpm: 1200, msg: '🔔 선교: 항해 속력, 순항!' }, { n: '전속', rpm: 1600, msg: '🔔 선교: 파도를 피해야 해요, 전속 전진!' }];
    let phase = 'start', left = 240, mist = 0, trips = 0, ord = 0, hold = 0, ordDone = 0, hot = 0, low = 0, hudT = 0, bootT = 0, quizRight = 0, ended = false, stDone = false, stScore = 20;
    let sR = null, sV = null, sP = null, ordBox = null, lights = null, coach = null, pb = null;

    const sim = (dt, t) => {
      const seaT = 27 + 2.5 * Math.sin(t * 0.25);
      if (S.running) {
        S.rpm += clamp(S.set - S.rpm, -300 * dt, 300 * dt);
        const Q = 55 * Math.pow(Math.max(S.rpm, 1) / 1200, 1.4);
        S.T += (seaT + Q * (1.4 - 0.9 * S.valve) - S.T) * Math.min(1, dt * 0.45);
        S.P += (0.8 + 5.2 * S.pump * (0.4 + (0.6 * S.rpm) / 1200) - S.P) * Math.min(1, dt * 0.9);
      } else {
        S.rpm += (0 - S.rpm) * Math.min(1, dt * 2);
        S.T += ((S.cool ? 38 : seaT) - S.T) * Math.min(1, dt * 0.3);
        S.P += ((S.lube ? 1.6 : 0) - S.P) * Math.min(1, dt * 1.5);
      }
      if (S.lockP != null) S.P += (S.lockP - S.P) * Math.min(1, dt * 3);
      if (S.lockT != null) S.T += (S.lockT - S.T) * Math.min(1, dt * 3);
    };
    const anim = (dt, t) => {
      sim(dt, t);
      S.crank += (S.rpm / 60) * Math.PI * 2 * dt * 0.12;
      rods.forEach((r, i) => { r.position.y = 2.0 + Math.sin(S.crank + i * 1.047) * 0.5; });
      fly.rotation.x = S.crank;
      const k = clamp((S.T - 60) / 45, 0, 1); heads.forEach((hd) => hd.material.emissive.setRGB(k * 0.7, k * 0.08, 0));
      gR.set(S.rpm, phase === 'run' && ord < 3 ? ORD[ord].rpm : null); gT.set(S.T); gP.set(S.P);
      beacon.material.emissiveIntensity = S.alarm ? 0.5 + 0.5 * Math.sin(t * 10) : 0.05;
      try { if (S.running) engine.set(S.rpm / 130); } catch (e) { /* 무시 */ }
      cam.to([8.8 + Math.sin(t * 0.2) * 1.4, 7.2, 19], [8.8, 3.8, 0]);
    };

    /* 1단계: 시동 절차 */
    const ITEMS = ['🛢 윤활유 프라임 펌프 기동', '💧 냉각수 순환펌프 기동', '⛽ 연료 공급 밸브 개방', '🔧 터닝기어 해제', '💨 시동 공기 투입'];
    const GRP = [0, 0, 1, 1, 2], NEED = [2, 2, 1], WHY = ['', '먼저 윤활유와 냉각수를 돌려 엔진을 보호해야 해요. 윤활 없이 돌리면 베어링이 마모돼요.', '연료 공급과 터닝기어 해제를 마친 뒤에 시동 공기를 넣어요. 터닝기어가 걸린 채 공기를 넣으면 크게 파손돼요!'];
    const doneSet = new Set(); let cur = 0;
    const showStart = () => {
      dk.clear();
      dk.add(h('div', 'line-height:1.55;flex:none', '엔진을 시동하기 전에 <b>안전 절차</b>를 지켜야 해요. 알맞은 순서로 장치를 눌러 보세요.<br><small style="opacity:.8">(학습용으로 단순화한 절차예요)</small>'));
      const box = h('div', 'display:flex;flex-direction:column;gap:6px'); dk.add(box);
      const msg = h('div', 'min-height:3em;line-height:1.5;color:#ffd9a0;flex:none'); dk.add(msg);
      shuffle([0, 1, 2, 3, 4]).forEach((i) => { const b = btn(ITEMS[i], () => press(i, b, msg)); box.append(b); });
    };
    const press = (i, b, msg) => {
      if (phase !== 'start' || doneSet.has(i)) return;
      if (GRP[i] !== cur) { mist++; snd(c, 'bad'); vib(c, 40); msg.innerHTML = `⚠ 순서가 틀렸어요! ${WHY[GRP[i]]}`; return; }
      doneSet.add(i); b.style.background = '#1f9d55'; b.innerHTML = '✅ ' + ITEMS[i]; snd(c, 'click'); msg.innerHTML = '';
      lamps[i].material.color.set('#3dff7a'); lamps[i].material.emissive = new THREE.Color('#3dff7a'); lamps[i].material.emissiveIntensity = 0.9;
      if (i === 0) S.lube = true; if (i === 1) S.cool = true;
      if ([...doneSet].filter((x) => GRP[x] === cur).length >= NEED[cur]) { cur++; if (cur < 3) { msg.innerHTML = '👍 좋아요! 다음 단계로!'; snd(c, 'ok'); } }
      if (i === 4) {
        stDone = true; stScore = clamp(20 - mist * 4, 4, 20); S.running = true; S.set = 600; phase = 'boot'; bootT = 1.6; snd(c, 'go');
        try { engine.start(); } catch (e) { /* 무시 */ } ui.banner('🔥 엔진 시동!'); ui.hint('엔진이 안정될 때까지 잠깐 기다려요…');
      }
    };

    /* 2단계: 선교 명령 운전 */
    const buildRun = () => {
      dk.clear();
      ordBox = h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,200,60,.16);line-height:1.5;flex:none');
      sR = slider('⚙ 엔진 회전수', ' RPM', 600, 1800, 20, S.set, (v) => { S.set = v; });
      sV = slider('💧 냉각수 밸브 개도', '%', 0, 100, 1, S.valve * 100, (v) => { S.valve = v / 100; });
      sP = slider('🛢 윤활유 펌프 출력', '%', 0, 100, 1, S.pump * 100, (v) => { S.pump = v / 100; });
      lights = h('div', 'line-height:1.6;flex:none'); coach = h('div', 'min-height:2.8em;line-height:1.5;color:#ffd9a0;flex:none'); pb = bar('#2fd27a');
      dk.add(ordBox, sR.el, sV.el, sP.el, lights, coach, h('div', 'flex:none', '<small>안정 유지 진행도</small>'), pb.el);
      hudT = 0;
    };
    const hudRun = (okR, okT, okP) => {
      const o = ORD[ord];
      ordBox.innerHTML = `<b>${o.msg}</b><br>목표 <b style="color:#ffd34d">${o.rpm} RPM</b> · 온도 65~85℃ · 유압 3.5~6.0bar 를 6초 유지 <small>(${ord + 1}/3)</small>`;
      lights.innerHTML = `⚙ ${Math.round(S.rpm)}rpm ${okR ? '✅' : '⚠️'} &nbsp; 🌡 ${S.T.toFixed(0)}℃ ${okT ? '✅' : S.T > 85 ? '🔥' : '🧊'} &nbsp; 🛢 ${S.P.toFixed(1)}bar ${okP ? '✅' : '⚠️'}`;
      coach.innerHTML = S.T > 95 ? '🔥 위험! 냉각수 밸브를 열거나 회전수를 낮춰요!' : S.P < 2.5 ? '🆘 유압이 너무 낮아요! 펌프 출력을 올려요!'
        : Math.abs(S.rpm - o.rpm) > 50 ? '⚙ 회전수를 목표에 맞춰요' : S.T > 85 ? '🌡 온도가 높아요 → 냉각수 밸브를 열어요' : S.T < 65 ? '🌡 너무 차가워요 → 냉각수 밸브를 줄여요'
          : S.P < 3.5 ? '🛢 유압이 낮아요 → 펌프 출력을 올려요' : S.P > 6 ? '🛢 유압이 높아요 → 펌프 출력을 줄여요' : '👍 안정적이에요! 그대로 유지!';
      pb.set((hold / 6) * 100, okR && okT && okP ? '#2fd27a' : '#e0b13a');
    };
    const trip = (why) => {
      trips++; left -= 8; hold = 0; hot = 0; low = 0; S.T = Math.min(S.T, 82); S.P = Math.max(S.P, 4); S.rpm = 600;
      sR.set(600); sV.set(55); sP.set(65); snd(c, 'bad'); vib(c, 120); ui.banner(`🛑 ${why}! 안전장치가 엔진을 세웠어요 (-8초)`);
    };
    const runStep = (dt) => {
      const o = ORD[ord];
      const okR = Math.abs(S.rpm - o.rpm) <= 50, okT = S.T >= 65 && S.T <= 85, okP = S.P >= 3.5 && S.P <= 6;
      hold = okR && okT && okP ? hold + dt : Math.max(0, hold - dt * 1.5);
      hot = S.T > 95 ? hot + dt : Math.max(0, hot - dt);
      low = S.P < 2.5 && S.rpm > 700 ? low + dt : Math.max(0, low - dt);
      if (hot > 3) { trip('냉각수 고온'); return; } if (low > 3) { trip('윤활유 저압'); return; }
      if (hold >= 6) {
        ordDone++; hold = 0; snd(c, 'ok'); ui.pop(`✔ ${o.n} 운전 완료`, null, '#a0ffb8'); ord++;
        if (ord >= ORD.length) { startAlarm(); return; }
        ui.banner(ORD[ord].msg);
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.2; hudRun(okR, okT, okP); }
    };

    /* 3단계: 경보 대응 */
    const startAlarm = () => {
      phase = 'alarm'; S.set = 1200; S.alarm = true; snd(c, 'bad'); ui.banner('🚨 경보 발생!'); ui.hint('경보가 울려요! 가장 안전한 조치를 골라요');
      quizFlow(dk, [
        { enter() { S.lockP = 1.8; S.lockT = 78; }, q: '🚨 <b>[윤활유 압력 저하]</b> 경보! 압력이 <b>1.8 bar</b>까지 떨어졌어요. 가장 먼저 할 조치는?', a: [
          ['경보음만 끄고 계속 운전한다', false, '경보를 무시하면 베어링이 눌어붙어 엔진이 크게 파손될 수 있어요.'],
          ['부하를 낮추고 예비 윤활유 펌프를 기동한 뒤 필터·누설을 점검하고 선교에 보고한다', true, '엔진을 보호하면서 원인을 찾고, 선교에 알려 항해 계획을 조정하는 것이 기관사의 절차예요.'],
          ['냉각수 밸브를 최대로 열어 온도를 더 낮춘다', false, '냉각수는 유압 문제를 해결하지 못해요. 원인은 윤활 계통이에요.']] },
        { enter() { S.lockP = 4.5; S.lockT = 98; }, q: '🚨 <b>[냉각수 고온]</b> 경보! 온도가 <b>98℃</b>까지 올랐어요. 가장 알맞은 조치는?', a: [
          ['찬 바닷물을 엔진에 직접 뿌려 급히 식힌다', false, '급냉은 열충격을 일으켜 실린더 헤드에 균열이 생길 수 있어요.'],
          ['부하(RPM)를 낮추고 냉각수 펌프·밸브·필터를 점검하며 서서히 온도를 낮춘다', true, '부하를 줄이면 열 발생이 줄고, 냉각 계통을 점검하면서 천천히 식혀야 안전해요.'],
          ['엔진을 전속으로 올려 빨리 목적지에 도착한다', false, '열이 더 늘어 엔진이 멈추거나 파손될 수 있어요.']] },
      ], (right) => { quizRight = right; S.alarm = false; S.lockP = null; S.lockT = null; endAll(); });
    };
    const endAll = () => {
      if (ended) return; ended = true; dk.el.style.display = 'none'; try { engine.stop(); } catch (e) { /* 무시 */ }
      c.finish((stDone ? stScore + clamp(10 - trips * 5, 0, 10) : 0) + ordDone * 15 + quizRight * 12.5);
    };

    return {
      start() { showStart(); ui.hint('시동 전 안전 절차를 순서대로 눌러요 (오른쪽 패널)'); },
      idle(dt, t) { anim(dt, t); },
      update(dt, t) {
        anim(dt, t); if (ended) return;
        if (phase === 'start' || phase === 'run') { left -= dt; ui.timer(left); if (left <= 0) { endAll(); return; } }
        if (phase === 'boot') { bootT -= dt; if (bootT <= 0) { phase = 'run'; buildRun(); ui.banner(ORD[0].msg); ui.hint('슬라이더로 RPM을 맞추고, 온도·유압을 초록 구간에 유지해요'); } }
        else if (phase === 'run') runStep(dt);
      },
      dispose() { dk.dispose(); try { engine.stop(); } catch (e) { /* 무시 */ } },
    };
  },
});

/* ═══════════════ 2. 양식생물학과 — 스마트 양식장 ═══════════════ */
registerExperience('aqu', {
  icon: '🦐', title: '스마트 양식장 · 수질 관리 실습',
  desc: '스마트 양식장의 관리자가 되어 수온·용존산소·사료량을 조절하고, 폭염과 한밤중 정전 같은 위기에서 우럭·넙치·전복을 지켜 보세요.',
  tools: ['🌡 수온 조절기', '💨 산소 공급기', '🍽 자동 급이기', '📟 수질 센서'],
  steps: ['수온·산소·사료 슬라이더로 성장 최적도를 높여요 (계기판의 초록 구간이 적정)', '라운드마다 상황이 달라져요: 봄 수온 상승 → 폭염 → 한밤중 정전', '용존산소가 3.5mg/L 아래로 떨어지면 물고기가 폐사해요 (게임용 수치)', '3라운드를 마치면 마무리 퀴즈 2문제!'],
  env: LAB_ENV,
  build(c) {
    const { root, ui, cam } = c;
    c.box(46, 0.4, 28, '#9fb0bf', 4, -0.2, 0, root); c.box(46, 13, 0.5, '#d9e4ee', 4, 6.5, -11, root);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3.2, 40), new THREE.MeshStandardMaterial({ color: '#2f8fc7', transparent: true, opacity: 0.5, roughness: 0.2, depthWrite: false })); water.position.set(0, 1.6, 0); root.add(water);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(5.15, 5.15, 3.6, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#e8f2fa', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); wall.position.set(0, 1.8, 0); root.add(wall);
    c.cyl(5.4, 5.4, 0.3, '#667789', 0, -0.05, 0, root, 40);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.12, 8, 48), new THREE.MeshStandardMaterial({ color: '#c3ced9' })); rim.rotation.x = Math.PI / 2; rim.position.y = 3.6; root.add(rim);
    /* 장비 */
    c.box(3, 2.6, 2.4, '#4a6fa5', 9, 1.3, -4, root); const chLamp = c.sph(0.35, '#888', 9, 2.9, -2.7, root); chLamp.material.emissive = new THREE.Color('#000000');
    c.cyl(0.9, 0.9, 3.6, '#e9eef2', -9, 1.8, -5, root, 16); c.cyl(0.9, 0.9, 3.6, '#e9eef2', -10.8, 1.8, -5, root, 16); c.box(3.4, 0.6, 1.4, '#5b6b7c', -9.9, 0.3, -5, root);
    c.box(0.6, 0.5, 11, '#7b8794', 0, 7.9, -5.5, root); c.cyl(1.2, 0.5, 1.8, '#e8b92f', 0, 7.0, 0, root, 16);
    [['수온 조절기 (히터·칠러)', 9, 4.6, -4], ['산소 발생기', -9.9, 4.6, -5], ['자동 급이기', 0, 9.2, 0]].forEach(([t, x, y, z]) => { const s = tagSprite(t, 'rgba(20,70,110,.9)', 6.2, 1.5); s.position.set(x, y, z); root.add(s); });
    const ZO = (ox) => [{ a: 0, b: 3.5, col: '#d33' }, { a: 3.5, b: 6.5, col: '#e0b13a' }, { a: 6.5, b: 12, col: '#2a9d4a' }];
    const gT = gauge('수온', '℃', 0, 32, [], 3.3, 1), gD = gauge('용존산소', 'mg/L', 0, 12, ZO(), 3.3, 1), gO = gauge('성장 최적도', '%', 0, 100, [{ a: 0, b: 40, col: '#d33' }, { a: 40, b: 70, col: '#e0b13a' }, { a: 70, b: 100, col: '#2a9d4a' }], 3.3, 0);
    [[gT, -6], [gD, -2.4], [gO, 1.2]].forEach(([g, x]) => { g.mesh.position.set(x, 8.6, -10.7); root.add(g.mesh); });
    const av = c.avatar(0, 0, 0); root.add(av.group); av.group.position.set(-6.5, 0, 6); av.group.rotation.y = Math.PI * 0.85;

    /* 거품 · 사료 알갱이 */
    const bubs = [], bg = new THREE.Group(); root.add(bg);
    for (let i = 0; i < 40; i++) { const a = (i % 4) * (Math.PI / 2) + 0.4, m = c.sph(0.08, '#ffffff', Math.cos(a) * 3.5, c.rnd(0.2, 3.2), Math.sin(a) * 3.5, bg); m.material.transparent = true; m.material.opacity = 0.6; bubs.push({ m, sp: c.rnd(1.2, 2.2) }); }
    const pels = [], pg = new THREE.Group(); root.add(pg);
    for (let i = 0; i < 24; i++) { const m = c.sph(0.08, '#8a5a2b', c.rnd(-0.8, 0.8), c.rnd(3.3, 6), c.rnd(-0.8, 0.8), pg); pels.push({ m, sp: c.rnd(2, 3) }); }

    /* 양식 생물 */
    let stockG = null, stock = [], kind = 'rock';
    const mkStock = (k) => {
      if (stockG) root.remove(stockG); stockG = new THREE.Group(); root.add(stockG); stock = []; kind = k;
      if (k === 'abalone') {
        [0.72, 1.72].forEach((y) => c.cyl(3.2, 3.2, 0.12, '#5c6b78', 0, y, 0, stockG, 24)); c.cyl(0.15, 0.15, 2.4, '#5c6b78', 0, 1.2, 0, stockG, 8);
        for (let i = 0; i < 16; i++) { const g = new THREE.Group(), a = (i % 8) * (Math.PI / 4) + (i > 7 ? 0.4 : 0), y = i > 7 ? 1.95 : 0.95; g.position.set(Math.cos(a) * 2.5, y, Math.sin(a) * 2.5); g.rotation.y = -a; stockG.add(g); const s = c.sph(0.42, '#7b4f36', 0, 0, 0, g); s.scale.set(1, 0.45, 0.8); const f = c.sph(0.4, '#d8c7a3', 0, -0.1, 0, g); f.scale.set(1.05, 0.25, 0.85); stock.push({ g }); }
        return;
      }
      const n = k === 'flat' ? 8 : 12;
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group(); stockG.add(g); const tail = new THREE.Group(); g.add(tail);
        if (k === 'rock') {
          const b = c.sph(0.38, '#8c6a4c', 0, 0, 0, g); b.scale.set(1.8, 0.85, 0.6); tail.position.set(-0.62, 0, 0);
          const f = c.cyl(0.3, 0, 0.5, '#a07c58', -0.2, 0, 0, tail, 4); f.rotation.z = Math.PI / 2; f.scale.z = 0.3; c.sph(0.06, '#111111', 0.45, 0.1, 0.2, g);
        } else {
          const b = c.sph(0.55, '#a88d5e', 0, 0, 0, g); b.scale.set(1.7, 0.16, 1.0); c.sph(0.07, '#111111', 0.7, 0.15, 0.2, g); c.sph(0.07, '#111111', 0.7, 0.15, -0.05, g);
          [[-0.2, 0.2], [0.2, -0.3], [-0.5, -0.1]].forEach(([x, z]) => { const s = c.sph(0.1, '#6b5a3a', x, 0.14, z, g); s.scale.y = 0.2; });
        }
        stock.push({ g, tail, a: c.rnd(0, 6.28), r: c.rnd(1.2, 4.2), y: c.rnd(0.7, 2.6), dir: i % 3 === 0 ? -1 : 1 });
      }
    };

    /* 라운드 */
    const R = [
      { sp: '조피볼락(우럭)', ico: '🐟', kind: 'rock', Topt: 18, T0: 13, amb: 14, resp: 1.0, note: '🌱 봄철 수온 상승기예요. 수온을 우럭의 적정 구간에 맞춰 주세요.' },
      { sp: '넙치(광어)', ico: '🐠', kind: 'flat', Topt: 21, T0: 23, amb: 25, resp: 1.1, heat: true, note: '☀ 곧 폭염이 와요! 바깥 기온이 올라 수온이 쑥 올라가요. 냉각과 산소를 미리 준비해요.' },
      { sp: '전복', ico: '🐚', kind: 'abalone', Topt: 20, T0: 19, amb: 18, resp: 1.35, outage: true, note: '🌙 한밤중이에요. 광합성이 없어 산소가 빨리 줄어요. 정전이 날 수도 있어요!' },
    ];
    const dk = dock(c, '🦐 스마트 양식장');
    let ri = 0, phase = 'idle', rt = 0, T = 13, DO = 8, amb = 14, power = 1, genDone = false, mort = 0, optSum = 0, optN = 0, tfL = 1, dfL = 1, hudT = 0, ended = false, heatMsg = false, outMsg = false;
    let setV = 13, aerV = 50, feedV = 6, coach = null, ob = null, info = null, genBtn = null, evBox = null, quizRight = 0;
    const res = [], ROUND_T = 32;

    const zonesFor = (r) => { gT.zones([{ a: 0, b: r.Topt - 6, col: '#d33' }, { a: r.Topt - 6, b: r.Topt - 2, col: '#e0b13a' }, { a: r.Topt - 2, b: r.Topt + 2, col: '#2a9d4a' }, { a: r.Topt + 2, b: r.Topt + 6, col: '#e0b13a' }, { a: r.Topt + 6, b: 32, col: '#d33' }]); };
    const showIntro = () => {
      const r = R[ri]; phase = 'idle'; mkStock(r.kind); zonesFor(r); T = r.T0; DO = 7.5; dk.clear();
      dk.add(h('div', 'font-size:1.1em;flex:none', `<b>${r.ico} 라운드 ${ri + 1}/3 · ${r.sp}</b>`));
      dk.add(h('div', 'padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.6;flex:none', `${r.note}<br><br>🎯 적정 수온 <b>${r.Topt}℃ 안팎</b> (±2℃) · 용존산소 <b>6.5mg/L 이상</b><br>🍽 사료는 적정 수온일 때 가장 잘 먹어요. 너무 많이 주면 물이 더러워지고 산소가 줄어요.<br><small style="opacity:.8">※ 학습용으로 단순화한 게임 수치예요</small>`));
      dk.add(btn('▶ 실습 시작', startRound, 'background:#2a6bff;text-align:center'));
      ui.hint(`${r.sp} 라운드 준비! 설명을 읽고 시작해요`);
    };
    const startRound = () => {
      const r = R[ri]; phase = 'run'; rt = 0; T = r.T0; DO = 7.5; amb = r.amb; power = 1; genDone = false; mort = 0; optSum = 0; optN = 0; heatMsg = false; outMsg = false;
      setV = Math.round(r.T0 * 2) / 2; aerV = 50; feedV = 6; dk.clear();
      const sT = slider('🌡 수온 설정', ' ℃', 5, 30, 0.5, setV, (v) => { setV = v; }, 1);
      const sA = slider('💨 산소 공급기 출력', '%', 0, 100, 1, aerV, (v) => { aerV = v; });
      const sF = slider('🍽 사료 투입량', ' kg', 0, 20, 0.5, feedV, (v) => { feedV = v; }, 1);
      info = h('div', 'line-height:1.55;flex:none'); coach = h('div', 'min-height:3em;line-height:1.5;color:#ffd9a0;flex:none'); ob = bar('#2fd27a'); evBox = h('div', 'flex:none');
      dk.add(h('div', 'font-size:1.05em;flex:none', `<b>${r.ico} 라운드 ${ri + 1}/3 · ${r.sp}</b>`), sT.el, sA.el, sF.el, info, coach, h('div', 'flex:none', '<small>성장 최적도</small>'), ob.el, evBox);
      hudT = 0; ui.hint('슬라이더로 수온·산소·사료를 조절해요');
    };
    const showGen = () => {
      genBtn = btn('🔋 비상 발전기 가동!', () => { if (genDone) return; genDone = true; power = 1; snd(c, 'ok'); ui.banner('🔋 비상 발전기 가동! 산소 공급 복구'); genBtn.remove(); }, 'background:#c0392b;text-align:center;font-size:1.1em');
      evBox.append(genBtn); ui.banner('⚡ 정전! 산소 공급이 끊겼어요!'); snd(c, 'bad'); vib(c, 100);
    };
    const endRound = () => {
      phase = 'sum'; const opt = optN ? optSum / optN : 0, surv = clamp(100 - mort, 0, 100); res.push({ opt, surv }); dk.clear();
      dk.add(h('div', 'font-size:1.1em;flex:none', `<b>📊 라운드 ${ri + 1} 결과 · ${R[ri].sp}</b>`));
      dk.add(h('div', 'padding:10px;border-radius:10px;background:rgba(255,255,255,.09);line-height:1.7;flex:none', `평균 성장 최적도 <b style="color:#ffd34d">${opt.toFixed(0)}%</b><br>생존율 <b style="color:${surv > 95 ? '#7dffa8' : '#ff9b8a'}">${surv.toFixed(0)}%</b><br><small>${opt > 75 ? '훌륭해요! 환경을 안정적으로 유지했어요.' : opt > 50 ? '무난해요. 계기판의 초록 구간에 더 오래 두면 좋아요.' : '수온·산소·사료의 균형이 아직 부족해요.'}</small>`));
      dk.add(btn(ri < 2 ? '다음 라운드 ▶' : '마무리 퀴즈 ▶', () => { ri++; if (ri < 3) showIntro(); else finalQuiz(); }, 'background:#2a6bff;text-align:center'));
    };
    const finalQuiz = () => {
      phase = 'quiz'; ui.hint('마지막 퀴즈!');
      quizFlow(dk, [
        { q: '양식장에서 물속 산소(용존산소)가 가장 부족해지기 쉬운 상황은?', a: [['수온이 높은 여름 밤, 사료를 많이 준 뒤', true, '따뜻한 물은 녹는 산소가 적고, 물고기 호흡은 늘어요. 남은 사료가 분해되며 산소를 쓰고, 밤에는 광합성이 멈춰 더 줄어요.'], ['수온이 낮은 겨울 낮', false, '찬 물에는 산소가 더 많이 녹아 있어요.'], ['맑게 갠 봄 낮', false, '낮에는 식물성 플랑크톤의 광합성으로 산소가 늘기도 해요.']] },
        { q: '사료를 너무 많이 주면 어떤 일이 생길까요?', a: [['남은 사료가 물을 더럽히고 산소를 줄여 오히려 성장이 나빠진다', true, '먹지 못한 사료는 분해되며 산소를 쓰고 암모니아 같은 물질을 만들어 수질을 나쁘게 해요.'], ['많이 줄수록 항상 더 빨리 큰다', false, '물고기가 먹는 양에는 한계가 있고, 수온이 맞지 않으면 더 적게 먹어요.'], ['아무 영향이 없다', false, '수질과 비용 모두에 영향을 줘요.']] },
      ], (right) => { quizRight = right; endAll(); });
    };
    const endAll = () => {
      if (ended) return; ended = true; dk.el.style.display = 'none';
      const n = Math.max(1, res.length), mo = res.reduce((s, x) => s + x.opt, 0) / n, ms = res.reduce((s, x) => s + x.surv, 0) / n;
      c.finish(0.8 * mo + (10 * ms) / 100 + quizRight * 5);
    };

    const stepSim = (dt) => {
      const r = R[ri]; rt += dt;
      if (r.heat) { amb = r.amb + clamp((rt - 6) / 6, 0, 1) * 7; if (rt > 6 && !heatMsg) { heatMsg = true; ui.banner('☀ 폭염 경보! 외기온이 올라요'); snd(c, 'bad'); } }
      if (r.outage && rt > 11 && !outMsg) { outMsg = true; power = 0.1; showGen(); }
      T += ((setV - T) * 0.35 + (amb - T) * 0.06) * dt;
      const tf = Math.exp(-Math.pow((T - r.Topt) / 4, 2)), DOsat = 13.1 - 0.185 * T, A = (aerV / 100) * power, resp = (0.8 + 0.06 * (T - 10)) * r.resp;
      const DOeq = DOsat * (0.5 + 0.7 * A) - resp - 0.1 * feedV;
      DO += (clamp(DOeq, 0, 12) - DO) * Math.min(1, 0.6 * dt);
      const df = clamp((DO - 3) / 4, 0, 1), Fopt = 8 * (0.4 + 0.6 * tf), ff = clamp(1 - Math.abs(feedV - Fopt) / Math.max(Fopt, 2), 0, 1);
      const opt = (0.4 * tf + 0.3 * df + 0.3 * ff) * (0.5 + 0.5 * Math.min(tf, df, ff)) * 100;
      tfL = tf; dfL = df; optSum += opt * dt; optN += dt;
      mort += dt * (Math.max(0, 3.5 - DO) * 2.5 + Math.max(0, Math.abs(T - r.Topt) - 6) * 0.4);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.25; const warnT = Math.abs(T - r.Topt) > 2;
        info.innerHTML = `🌡 수온 <b>${T.toFixed(1)}℃</b> ${warnT ? '⚠️' : '✅'} &nbsp; 💨 산소 <b>${DO.toFixed(1)}</b> ${DO < 6.5 ? '⚠️' : '✅'}<br>🐟 생존율 <b>${clamp(100 - mort, 0, 100).toFixed(0)}%</b> · 외기온 ${amb.toFixed(0)}℃${power < 1 ? ' · <span style="color:#ff8a80">⚡정전 중</span>' : ''}`;
        coach.innerHTML = power < 1 ? '⚡ 산소 공급이 끊겼어요! 비상 발전기를 눌러요!' : DO < 3.5 ? '🆘 산소가 너무 낮아요! 산소 공급기 출력을 올리고 사료를 줄여요'
          : T > r.Topt + 2 ? '🌡 수온이 높아요 → 수온 설정을 낮춰요' : T < r.Topt - 2 ? '🌡 수온이 낮아요 → 수온 설정을 올려요'
            : DO < 6.5 ? '💨 산소가 부족해요 → 산소 공급기 출력을 올려요' : feedV > Fopt * 1.3 ? '🍽 사료가 많아요 (남은 사료가 물을 더럽혀요)' : feedV < Fopt * 0.7 ? '🍽 사료가 부족해요 (물고기가 굶어요)' : '👍 아주 좋아요! 그대로 유지!';
        ob.set(opt, opt > 70 ? '#2fd27a' : opt > 40 ? '#e0b13a' : '#e0584a');
        gT.set(T); gD.set(DO); gO.set(opt);
      }
    };
    const animScene = (dt, t) => {
      const act = clamp(tfL * dfL, 0.15, 1);
      stock.forEach((f, i) => {
        if (kind === 'abalone') { f.g.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.03 * act); return; }
        f.a += dt * (0.25 + 0.8 * act) * (3.0 / f.r) * f.dir;
        f.g.position.set(Math.cos(f.a) * f.r, kind === 'flat' ? 0.32 : f.y + (1 - dfL) * (3.0 - f.y), Math.sin(f.a) * f.r);
        f.g.rotation.y = -f.a - (Math.PI / 2) * f.dir; if (f.tail) f.tail.rotation.y = Math.sin(t * 8 * act + i) * 0.4;
      });
      const nb = phase === 'run' ? Math.round((aerV / 100) * power * 40) : 8; bubs.forEach((b, i) => { b.m.visible = i < nb; b.m.position.y += b.sp * dt; if (b.m.position.y > 3.2) b.m.position.y = 0.2; });
      const np = phase === 'run' ? Math.round((feedV / 20) * 24) : 0; pels.forEach((p, i) => { p.m.visible = i < np; p.m.position.y -= p.sp * dt; if (p.m.position.y < 3.25) { p.m.position.y = 6 + Math.random() * 0.4; p.m.position.x = c.rnd(-0.8, 0.8); p.m.position.z = c.rnd(-0.8, 0.8); } });
      const d = setV - T; chLamp.material.emissive.set(phase !== 'run' ? '#000000' : d > 0.4 ? '#ff4a3a' : d < -0.4 ? '#3aa0ff' : '#000000'); chLamp.material.emissiveIntensity = 0.9;
      cam.to([8 + Math.sin(t * 0.2) * 1.2, 8.5, 20], [8, 3.2, 0]);
    };

    return {
      start() { showIntro(); },
      idle(dt, t) { if (!stockG) mkStock('rock'); animScene(dt, t); },
      update(dt, t) {
        if (!stockG) mkStock('rock'); animScene(dt, t); if (ended) return;
        if (phase === 'run') { stepSim(dt); ui.timer(Math.max(0, ROUND_T - rt)); if (rt >= ROUND_T) endRound(); }
      },
      dispose() { dk.dispose(); },
    };
  },
});