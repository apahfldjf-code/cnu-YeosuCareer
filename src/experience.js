/* ═══════════════════════════════════════════════════════════════
 * src/experience.js (신규, E1 단계) — 심화 직업체험 프레임워크
 *  - 부스에서 [체험 시작]을 누르면 별도의 3D 체험 무대로 이동합니다.
 *  - 조작은 터치 우선: 화면 드래그·탭 + 화면 버튼. (PC는 마우스 + 키보드도 가능)
 *  - 학과별 체험은 registerExperience(학과id, 정의) 로 등록합니다.
 *  - 등록되지 않은 학과는 기존 미니게임(minigames.js)이 그대로 실행됩니다.
 *
 * 체험 정의 형식
 *   registerExperience('학과id', {
 *     icon, title, desc, tools:['📷 카메라'], steps:['설명1','설명2'],
 *     env: { sky, fog:[색,near,far], sunColor, sunI, hemi:[하늘,땅,세기], sunPos:[x,y,z] },
 *     build(c) { ...3D 무대 만들기...; return { start(), update(dt,t), idle(dt,t), down(p), move(p), up(p), key(code), dispose() }; }
 *   });
 *   c(ctx): THREE, root, camera, ui, cam, keys, sfx, buzz, mat, box, cyl, sph, ground, avatar, pick, at, finish(점수0~100)
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
#xp .bar{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px));display:flex;gap:8px;align-items:center}
#xp .chip{padding:6px 12px;border-radius:14px;background:rgba(10,30,60,.72);font-weight:700;font-size:14px;white-space:nowrap}
#xp .sp{flex:1}
#xp .xq{pointer-events:auto;min-height:44px;padding:0 14px;border:0;border-radius:14px;background:rgba(190,60,60,.85);color:#fff;font-weight:700;font-size:14px}
#xp .panel{position:absolute;top:calc(60px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));max-width:min(46vw,300px);padding:9px 13px;border-radius:12px;background:rgba(10,30,60,.72);font-size:13px;line-height:1.6}
#xp .hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:62vw;padding:8px 16px;border-radius:14px;background:rgba(0,0,0,.62);font-size:14px;text-align:center}
#xp .card{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88vw,460px);max-height:86vh;overflow-y:auto;padding:18px 20px;border-radius:18px;background:rgba(14,32,66,.95);box-shadow:0 8px 30px rgba(0,0,0,.5)}
#xp .card h2,#xp .card h3{margin:0 0 8px;line-height:1.4}
#xp .card p{margin:6px 0;line-height:1.6;font-size:14px}
#xp .card ol{margin:8px 0 12px;padding-left:20px;font-size:13px;line-height:1.7}
#xp .tools span{display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:10px;background:rgba(255,255,255,.14);font-size:13px}
#xp .cbtn{display:block;width:100%;min-height:46px;margin:7px 0 0;border:0;border-radius:12px;background:#2f6fed;color:#fff;font-size:16px;font-weight:700}
#xp .xbtn{pointer-events:auto;touch-action:none;position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;background:rgba(15,30,60,.62);border:2px solid rgba(255,255,255,.6);font-size:26px;-webkit-tap-highlight-color:transparent}
#xp .xbtn small{font-size:11px;margin-top:-2px}
#xp .xbtn.dn{background:rgba(80,140,255,.9);transform:scale(.92)}
#xp .xbtn.red{background:rgba(220,70,60,.7)}
#xp .xbtn.grn{background:rgba(40,170,110,.85)}
#xp .pop{position:absolute;transform:translate(-50%,-50%);font-weight:800;font-size:22px;white-space:nowrap;text-shadow:0 2px 6px #000;animation:xpop 1.1s ease-out forwards}
@keyframes xpop{0%{opacity:0;margin-top:10px}15%{opacity:1}100%{opacity:0;margin-top:-60px}}
#xp .banner{position:absolute;left:50%;top:38%;padding:12px 26px;border-radius:18px;background:rgba(10,30,60,.82);font-size:26px;font-weight:800;animation:xban 1.3s forwards}
@keyframes xban{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}20%{opacity:1;transform:translate(-50%,-50%) scale(1)}85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
#xp .fl{position:absolute;inset:0;background:#fff;opacity:0}
#xp .fl.on{animation:xfl .3s}
@keyframes xfl{0%{opacity:.9}100%{opacity:0}}
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
  xp.innerHTML = '<div class="fl"></div><div class="bar"><div class="chip" data-r="t"></div><div class="sp"></div><div class="chip" data-r="time" style="display:none"></div><div class="chip" data-r="sc" style="display:none"></div><button class="xq">✖ 그만하기</button></div><div class="panel" data-r="p" style="display:none"></div><div class="hint" data-r="h" style="display:none"></div>';
  document.body.append(xp);
  const q = (r) => xp.querySelector(`[data-r="${r}"]`);
  q('t').textContent = `${def.icon || ''} ${def.title}`;
  xp.querySelector('.xq').onclick = () => { if (alive) host.quit(); };

  const ui = {
    layer: xp,
    hint(t) { const h = q('h'); h.style.display = t ? 'block' : 'none'; h.textContent = t || ''; },
    panel(html) { const p = q('p'); p.style.display = html ? 'block' : 'none'; p.innerHTML = html || ''; },
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
      const s = o.size || 64; b.style.width = b.style.height = s + 'px'; Object.assign(b.style, o.pos || {});
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
    removeEventListener('keydown', kd); removeEventListener('keyup', ku);
    cvs.removeEventListener('pointerdown', pd); cvs.removeEventListener('pointermove', pm); cvs.removeEventListener('pointerup', pu); cvs.removeEventListener('pointercancel', pu);
    if (run.dispose) { try { run.dispose(); } catch (e) { /* 무시 */ } }
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
      avatars.forEach((a) => a.tick(dt));
      if (state === 'run' && run.update) run.update(dt, t); else if (run.idle) run.idle(dt, t);
    },
    dispose,
  };
}