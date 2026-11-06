/* ═══════════════════════════════════════════════════════════════
 * src/experience.js (E1 → U2 화면 영역 규칙판) — 심화 직업체험 프레임워크
 *  - 부스에서 [체험 시작]을 누르면 별도의 3D 체험 무대로 이동합니다.
 *  - 조작은 터치 우선: 화면 드래그·탭 + 화면 버튼. (PC는 마우스 + 키보드도 가능)
 *  - 학과별 체험은 registerExperience(학과id, 정의) 로 등록합니다.
 *
 * [U2 화면 영역 규칙]
 *   상단 한 줄 : 제목 · 시간 · 점수 · [가: 글자 크기] · [그만하기]
 *   좌측 위    : 현황 패널 (▼/▶ 접기, 길면 내부 스크롤, 낮은 화면은 처음부터 접힘)
 *   우측       : 작업 패널(.cul) — 가로 화면은 오른쪽 세로 도크, 세로 화면은 아래 시트
 *   하단 중앙  : 힌트 (작업 패널을 뺀 '남는 영역'의 가운데)
 *   3D 장면    : 작업 패널이 열리면 카메라 시야 중심을 남는 영역으로 자동 이동
 *   글자 크기  : 작게 / 보통 / 크게 3단계 (localStorage 'cq_fs' 에 저장)
 *  → exp-cul1~3.js 는 고치지 않아도 .cul 을 자동으로 같은 규칙에 맞춥니다.
 *
 * 체험 정의 형식은 이전과 같아요 (ui·ctx API 변경 없음)
 *   registerExperience('학과id', { icon, title, desc, tools, steps, env, build(c) { ...; return { start, update, idle, down, move, up, key, dispose }; } });
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createCharacter, sfx } from './core.js';
import { buzz } from './input.js';

const REG = {};
export function registerExperience(ids, def) { [].concat(ids).forEach((id) => { REG[id] = def; }); }
export const hasExperience = (id) => !!REG[id];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const CSS = `
#xp{position:fixed;inset:0;z-index:30;pointer-events:none;color:#fff;font-family:"Malgun Gothic","Noto Sans KR",sans-serif;user-select:none;-webkit-user-select:none;touch-action:none}
#xp .bar{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px));display:flex;gap:6px;align-items:center}
#xp .chip{padding:6px 12px;border-radius:14px;background:rgba(10,30,60,.72);font-weight:700;font-size:calc(14px*var(--xs,1));white-space:nowrap}
#xp .chip.t{min-width:0;max-width:44vw;overflow:hidden;text-overflow:ellipsis}
#xp .sp{flex:1}
#xp .xq,#xp .xs{pointer-events:auto;min-height:44px;min-width:44px;padding:0 14px;border:0;border-radius:14px;color:#fff;font-weight:700;font-size:14px;flex:none}
#xp .xq{background:rgba(190,60,60,.85)}
#xp .xs{background:rgba(10,30,60,.78);padding:0 10px;font-weight:800}

#xp .panel{position:absolute;top:calc(60px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));display:flex;flex-direction:column;max-width:min(calc(100vw - var(--rw,0px) - 28px),320px);max-height:min(56vh,calc(100vh - 150px - var(--bh,0px)));border-radius:12px;background:rgba(10,30,60,.72);overflow:hidden;pointer-events:none}
#xp .pt{pointer-events:auto;flex:none;min-height:36px;padding:0 12px;border:0;background:transparent;color:#fff;font-family:inherit;font-weight:700;font-size:calc(13px*var(--xs,1));text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#xp .pb{flex:1 1 auto;min-height:0;padding:0 13px 9px;font-size:calc(13px*var(--xs,1));line-height:1.6;overflow:hidden}
#xp .pb.sc{overflow-y:auto;pointer-events:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#xp .panel.min .pb{display:none}
#xp .panel.min{background:rgba(10,30,60,.82)}

#xp .hint{position:absolute;left:calc(50% - var(--rw,0px)/2);bottom:calc(14px + var(--bh,0px) + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:min(62vw,calc(100vw - var(--rw,0px) - 48px));padding:8px 16px;border-radius:14px;background:rgba(0,0,0,.62);font-size:calc(14px*var(--xs,1));text-align:center}

#xp .card{pointer-events:auto;touch-action:pan-y;position:absolute;left:calc(50% - var(--rw,0px)/2);top:calc(50% - var(--bh,0px)/2);transform:translate(-50%,-50%);width:min(calc(100vw - var(--rw,0px) - 24px),460px);max-height:calc(100vh - var(--bh,0px) - 24px);overflow-y:auto;margin:0;border:0;padding:18px 20px;border-radius:18px;background:rgba(14,32,66,.95);box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:calc(15px*var(--xs,1));text-align:left}
#xp .card h2,#xp .card h3{margin:0 0 8px;line-height:1.4}
#xp .card h2{font-size:1.4em}
#xp .card h3{font-size:1.2em}
#xp .card p{margin:6px 0;line-height:1.6;font-size:.95em}
#xp .card ol{margin:8px 0 12px;padding-left:20px;font-size:.9em;line-height:1.7}
#xp .tools span{display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:10px;background:rgba(255,255,255,.14);font-size:.9em}
#xp .cbtn{display:block;width:100%;min-height:46px;margin:7px 0 0;border:0;border-radius:12px;background:#2f6fed;color:#fff;font-size:1.07em;font-weight:700}

#xp .xbtn{pointer-events:auto;touch-action:none;position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:rgba(15,30,60,.62);border:2px solid rgba(255,255,255,.6);font-size:26px;-webkit-tap-highlight-color:transparent}
#xp .xbtn small{font-size:11px;margin-top:-2px}
#xp .xbtn.dn{background:rgba(80,140,255,.9);transform:scale(.92)}
#xp .xbtn.red{background:rgba(220,70,60,.7)}
#xp .xbtn.grn{background:rgba(40,170,110,.85)}
#xp .pop{position:absolute;transform:translate(-50%,-50%);font-weight:800;font-size:22px;white-space:nowrap;text-shadow:0 2px 6px #000;animation:xpop 1.1s ease-out forwards}
@keyframes xpop{0%{opacity:0;margin-top:10px}15%{opacity:1}100%{opacity:0;margin-top:-60px}}
#xp .banner{position:absolute;left:calc(50% - var(--rw,0px)/2);top:38%;padding:12px 26px;border-radius:18px;background:rgba(10,30,60,.82);font-size:26px;font-weight:800;animation:xban 1.3s forwards}
@keyframes xban{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}20%{opacity:1;transform:translate(-50%,-50%) scale(1)}85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
#xp .fl{position:absolute;inset:0;background:#fff;opacity:0}
#xp .fl.on{animation:xfl .3s}
@keyframes xfl{0%{opacity:.9}100%{opacity:0}}

/* 낮은 화면(가로 폰) */
@media (max-height:520px){
  #xp .chip{font-size:calc(13px*var(--xs,1));padding:5px 10px}
  #xp .panel{top:calc(56px + env(safe-area-inset-top,0px));max-height:min(42vh,calc(100vh - 110px))}
  #xp .hint{bottom:calc(8px + var(--bh,0px) + env(safe-area-inset-bottom,0px))}
  #xp .card{padding:12px 16px}
}

/* 문화사회 작업 패널(.cul) — exp-cul1.js 의 스타일을 같은 영역 규칙으로 덮어써요 */
html body .cul{position:fixed!important;left:auto!important;right:calc(8px + env(safe-area-inset-right,0px))!important;top:calc(60px + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;width:min(44vw,480px)!important;height:auto!important;max-height:calc(100vh - 72px)!important;overflow-y:auto!important;z-index:40!important;font-size:calc(15px*var(--xs,1))!important;touch-action:pan-yb.style.width;-webkit-overflow-scrolling:touch}
html body .cul button{font-size:inherit!important;min-height:44px}
html body .cul .big{font-size:calc(22px*var(--xs,1))!important}
@media (max-height:520px){
  html body .cul{top:calc(54px + env(safe-area-inset-top,0px))!important;width:min(48vw,420px)!important;max-height:calc(100vh - 62px)!important;padding:10px 12px!important}
}
@media (orientation:portrait){
  html body .cul{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;max-height:min(50vh,calc(100vh - 120px))!important;border-radius:14px 14px 0 0!important}
}
`;

/* host: game.js 가 넘겨주는 { scene, camera, cvs, sun, hemi, look, dept, enter(stage), finish(score), quit() } */
export function startExperience(id, host) {
  const def = REG[id]; if (!def) return null;
  if (!document.getElementById('xp-css')) { const s = document.createElement('style'); s.id = 'xp-css'; s.textContent = CSS; document.head.append(s); }
  const { scene, camera, cvs } = host;
  const root = new THREE.Group(); scene.add(root);
  const env = Object.assign({ sky: '#bfe3ff', fog: ['#bfe3ff', 45, 150], sunColor: '#fff4e0', sunI: 1.5, hemi: ['#dff1ff', '#7a8f6a', 0.9], sunPos: [30, 50, 20] }, def.env || {});
  host.enter({ root, env });
  host.sun.position.set(env.sunPos[0], env.sunPos[1], env.sunPos[2]); host.sun.target.position.set(0, 0, 0);

  let state = 'intro', alive = true, run = {};
  const avatars = [], keys = new Set();

  /* ───── 화면 UI ───── */
  const xp = document.createElement('div'); xp.id = 'xp';
  xp.innerHTML = '<div class="fl"></div>'
    + '<div class="bar"><div class="chip t" data-r="t"></div><div class="sp"></div><div class="chip" data-r="time" style="display:none"></div><div class="chip" data-r="sc" style="display:none"></div><button class="xs" data-r="fs">가</button><button class="xq">✖ 그만하기</button></div>'
    + '<div class="panel" data-r="p" style="display:none"><button class="pt" data-r="pt"></button><div class="pb" data-r="pb"></div></div>'
    + '<div class="hint" data-r="h" style="display:none"></div>';
  document.body.append(xp);
  const q = (r) => xp.querySelector(`[data-r="${r}"]`);
  q('t').textContent = `${def.icon || ''} ${def.title}`;
  xp.querySelector('.xq').onclick = () => { if (alive) host.quit(); };

  /* 글자 크기 3단계 */
  const FS = [0.9, 1, 1.2], FSZ = [12, 15, 19], FSN = ['작게', '보통', '크게'];
  let fl = 1; try { const v = parseInt(localStorage.getItem('cq_fs'), 10); if (v >= 0 && v <= 2) fl = v; } catch (e) { /* 무시 */ }
  const fsBtn = q('fs');
  const applyFs = () => { document.documentElement.style.setProperty('--xs', String(FS[fl])); fsBtn.style.fontSize = FSZ[fl] + 'px'; fsBtn.title = `글자 크기: ${FSN[fl]}`; };
  fsBtn.onclick = () => { fl = (fl + 1) % 3; try { localStorage.setItem('cq_fs', String(fl)); } catch (e) { /* 무시 */ } applyFs(); ui.banner(`글자 크기: ${FSN[fl]}`); fitSoon(); };
  applyFs();

  /* 현황 패널: 접기 · 길면 스크롤 */
  const panelEl = q('p'), pt = q('pt'), pb = q('pb');
  let pMin = innerHeight <= 400, pFirst = '현황';
  const firstLine = (html) => { const t = document.createElement('div'); t.innerHTML = String(html).split(/<br\s*\/?>/i)[0]; const s = (t.textContent || '').trim(); return s.length > 16 ? s.slice(0, 15) + '…' : s; };
  const setPt = () => { panelEl.classList.toggle('min', pMin); pt.textContent = pMin ? `▶ ${pFirst}` : '▼ 접기'; };
  const fitSoon = () => setTimeout(() => { if (alive) pb.classList.toggle('sc', pb.scrollHeight > pb.clientHeight + 2); }, 30);
  pt.onclick = () => { pMin = !pMin; setPt(); fitSoon(); };
  setPt(); addEventListener('resize', fitSoon);

  const ui = {
    layer: xp,
    hint(t) { const h = q('h'); h.style.display = t ? 'block' : 'none'; h.textContent = t || ''; },
    panel(html) {
      if (!html) { panelEl.style.display = 'none'; pb.innerHTML = ''; return; }
      pb.innerHTML = html; pFirst = firstLine(html); panelEl.style.display = 'flex'; setPt(); fitSoon();
    },
    timer(s) { const e = q('time'); e.style.display = s == null ? 'none' : 'block'; if (s != null) e.textContent = `⏱ ${Math.max(0, Math.ceil(s))}`; },
    score(t) { const e = q('sc'); e.style.display = t == null ? 'none' : 'block'; if (t != null) e.textContent = t; },
    pop(text, at, color) {
      const e = document.createElement('div'); e.className = 'pop'; e.textContent = text; if (color) e.style.color = color;
      let x = innerWidth / 2, y = innerHeight / 2;
      if (at) { const v = at.clone().project(camera); x = (v.x * 0.5 + 0.5) * innerWidth; y = (-v.y * 0.5 + 0.5) * innerHeight; }
      e.style.left = x + 'px'; e.style.top = y + 'px'; xp.append(e); setTimeout(() => e.remove(), 1150);
    },
    banner(t) { const e = document.createElement('div'); e.className = 'banner'; e.textContent = t; xp.append(e); setTimeout(() => e.remove(), 1400); },
    flash() { const f = xp.querySelector('.fl'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
    button(o) {
      const b = document.createElement('div'); b.className = 'xbtn' + (o.cls ? ' ' + o.cls : '');
      b.innerHTML = `<span>${o.icon}</span>${o.label ? `<small>${o.label}</small>` : ''}`;
      const s = Math.max(44, o.size || 64); b.style.width = b.style.height = s + 'px'; Object.assign(b.style, o.pos || {});
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.style.webkitTouchCallout = 'none';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } b.classList.add('dn'); buzz(10); if (o.down) o.down(); });
      const up = () => { if (!b.classList.contains('dn')) return; b.classList.remove('dn'); if (o.up) o.up(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      xp.append(b);
      return {
        el: b, held: () => b.classList.contains('dn'), show(v = true) { b.style.display = v ? 'flex' : 'none'; },
        icon(t) { b.firstChild.textContent = t; },
        label(t) { let m = b.querySelector('small'); if (!m) { m = document.createElement('small'); b.append(m); } m.textContent = t; },
      };
    },
    ask(question, opts, cb) {
      const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<h3>${question}</h3>`;
      opts.forEach((t, i) => { const b = document.createElement('button'); b.className = 'cbtn'; b.textContent = t; b.onclick = () => { c.remove(); sfx.click(); cb(i); }; c.append(b); });
      xp.append(c); return c;
    },
  };

  /* ───── 카메라 ───── */
  const cp = new THREE.Vector3(), cl = new THREE.Vector3(), tp = new THREE.Vector3(), tl = new THREE.Vector3(); let tfov = 55;
  const cam = {
    set(p, l) { cp.set(p[0], p[1], p[2]); cl.set(l[0], l[1], l[2]); tp.copy(cp); tl.copy(cl); },
    to(p, l) { tp.set(p[0], p[1], p[2]); tl.set(l[0], l[1], l[2]); },
    fov(f, snap) { tfov = f; if (snap) { camera.fov = f; camera.updateProjectionMatrix(); } },
  };
  cam.set([0, 8, 14], [0, 0, 0]); cam.fov(55, true);

  /* ───── 화면 영역: 작업 패널(.cul)을 피해 3D 시야 중심 이동 ───── */
  let ox = 0, oy = 0, tox = 0, toy = 0, lay = 0, vkey = '', lastRw = -1, lastBh = -1;
  const scan = () => {
    let rw = 0, bh = 0;
    document.querySelectorAll('.cul').forEach((el) => {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      if (r.width > innerWidth * 0.85) bh = Math.max(bh, innerHeight - r.top); else rw = Math.max(rw, innerWidth - r.left);
    });
    tox = rw > 0 ? rw / 2 + 4 : 0; toy = bh > 0 ? bh / 2 : 0;
    if (rw !== lastRw) { lastRw = rw; xp.style.setProperty('--rw', rw > 0 ? (rw + 4) + 'px' : '0px'); }
    if (bh !== lastBh) { lastBh = bh; xp.style.setProperty('--bh', bh > 0 ? bh + 'px' : '0px'); }
  };
  const applyView = (dt) => {
    lay -= dt; if (lay <= 0) { lay = 0.2; scan(); }
    const k = Math.min(1, 8 * dt); ox += (tox - ox) * k; oy += (toy - oy) * k;
    if (Math.abs(tox - ox) < 0.4) ox = tox; if (Math.abs(toy - oy) < 0.4) oy = toy;
    const key = `${innerWidth}|${innerHeight}|${Math.round(ox)}|${Math.round(oy)}`;
    if (key === vkey) return; vkey = key;
    if (!Math.round(ox) && !Math.round(oy)) camera.clearViewOffset(); else camera.setViewOffset(innerWidth, innerHeight, ox, oy, innerWidth, innerHeight);
  };

  /* ───── 포인터(터치·마우스 공용) ───── */
  const ptr = { x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, down: false, id: null };
  const rc = new THREE.Raycaster(), v2 = new THREE.Vector2(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const setP = (e, first) => {
    const r = cvs.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    ptr.dx = first ? 0 : x - ptr.x; ptr.dy = first ? 0 : y - ptr.y; ptr.x = x; ptr.y = y; ptr.nx = (x / r.width) * 2 - 1; ptr.ny = -(y / r.height) * 2 + 1;
  };
  const pd = (e) => {
    if (state !== 'run' || ptr.down) return; if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); try { cvs.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
    ptr.down = true; ptr.id = e.pointerId; setP(e, true); if (run.down) run.down(ptr);
  };
  const pm = (e) => { if (state !== 'run') return; if (ptr.down && e.pointerId !== ptr.id) return; setP(e, false); if (run.move) run.move(ptr); };
  const pu = (e) => { if (!ptr.down || e.pointerId !== ptr.id) return; setP(e, false); ptr.down = false; if (run.up) run.up(ptr); };
  cvs.addEventListener('pointerdown', pd); cvs.addEventListener('pointermove', pm); cvs.addEventListener('pointerup', pu); cvs.addEventListener('pointercancel', pu);
  const kd = (e) => {
    if (e.code === 'Escape') { if (alive) host.quit(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return; keys.add(e.code); if (state === 'run' && run.key) run.key(e.code);
  };
  const ku = (e) => keys.delete(e.code);
  addEventListener('keydown', kd); addEventListener('keyup', ku);

  /* ───── 체험에서 쓰는 도구 모음 ───── */
  const mat = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.8, metalness: 0.05 }, o || {}));
  const ctx = {
    THREE, root, camera, ui, cam, keys, sfx, buzz, mat, ptr, dept: host.dept, clamp, rnd, shuffle,
    get state() { return state; },
    box(w, h, d, col, x = 0, y = 0, z = 0, parent = root) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col)); m.castShadow = m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m; },
    cyl(rt, rb, h, col, x = 0, y = 0, z = 0, parent = root, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(col)); m.castShadow = m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m; },
    sph(r, col, x = 0, y = 0, z = 0, parent = root) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(col)); m.castShadow = true; m.position.set(x, y, z); parent.add(m); return m; },
    ground(col, r = 40, y = 0) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(col)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; root.add(m); return m; },
    avatar(x, z, yaw = 0, look) { const ch = createCharacter(look || host.look); ch.group.position.set(x, 0, z); ch.group.rotation.y = yaw; root.add(ch.group); avatars.push(ch); return ch; },
    pick(objs) { camera.updateMatrixWorld(true); v2.set(ptr.nx, ptr.ny); rc.setFromCamera(v2, camera); const h = rc.intersectObjects(objs, true); return h.length ? h[0] : null; },
    at(y = 0) { camera.updateMatrixWorld(true); v2.set(ptr.nx, ptr.ny); rc.setFromCamera(v2, camera); pl.constant = -y; return rc.ray.intersectPlane(pl, new THREE.Vector3()); },
    finish,
  };

  function finish(score) {
    if (state === 'done' || !alive) return; state = 'done'; ui.hint(''); ui.timer(null); ui.banner('🎉 체험 완료!'); sfx.win();
    setTimeout(() => { if (alive) host.finish(clamp(Math.round(score), 0, 100)); }, 1400);
  }
  function start() { if (state !== 'intro') return; state = 'run'; card.remove(); sfx.go(); if (run.start) run.start(); }
  function dispose() {
    if (!alive) return; alive = false;
    removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', fitSoon);
    cvs.removeEventListener('pointerdown', pd); cvs.removeEventListener('pointermove', pm); cvs.removeEventListener('pointerup', pu); cvs.removeEventListener('pointercancel', pu);
    if (run.dispose) { try { run.dispose(); } catch (e) { /* 무시 */ } }
    document.querySelectorAll('.cul').forEach((el) => el.remove());   /* 남은 작업 패널 정리 */
    document.documentElement.style.removeProperty('--xs');
    camera.clearViewOffset();
    xp.remove(); scene.remove(root);
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
  }

  /* ───── 시작 안내 카드 ───── */
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<h2>${def.icon || ''} ${def.title}</h2><p>${def.desc || ''}</p><div class="tools">${(def.tools || []).map((t) => `<span>${t}</span>`).join('')}</div><ol>${(def.steps || []).map((s) => `<li>${s}</li>`).join('')}</ol>`;
  const go = document.createElement('button'); go.className = 'cbtn'; go.textContent = '▶ 시작하기'; go.onclick = start; card.append(go); xp.append(card);

  try { run = def.build(ctx) || {}; } catch (err) { dispose(); throw err; }

  return {
    update(dt, t) {
      if (!alive) return;
      const k = Math.min(1, 6 * dt); cp.lerp(tp, k); cl.lerp(tl, k); camera.position.copy(cp); camera.lookAt(cl);
      if (Math.abs(camera.fov - tfov) > 0.05) { camera.fov += (tfov - camera.fov) * Math.min(1, 10 * dt); camera.updateProjectionMatrix(); }
      applyView(dt);
      avatars.forEach((a) => a.tick(dt));
      if (state === 'run' && run.update) run.update(dt, t); else if (run.idle) run.idle(dt, t);
    },
    dispose,
  };
}