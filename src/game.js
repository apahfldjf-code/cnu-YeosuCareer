/* ═══════════════════════════════════════════════════════════════
 * src/game.js  v2 (1단계) — 4개 월드 · 근접전투 · FPS · 인벤토리 · 캐릭터 커스터마이징
 * ※ world.js / core.js / data.js 는 2~4단계에서 아래 "계약"대로 교체됩니다.
 *   4개 파일을 모두 교체한 뒤에 실행하세요. (minigames/report/index/css/main 은 그대로)
 *
 * [data.js] 기존 DEPTS, COLLEGES + 추가 export
 *   WORLDS = { campus|race|soccer|fps: { name, icon } }
 *   ITEMS[id] = { id, name, icon, desc, rarity(1~4), type:'weapon'|'helmet'|'vest'|'pack'|'heal'|'ammo',
 *     weapon: fam, dmg, rate(발/초), mag, reload(초), range, spread(도), pellets, auto, recoil, ammo('AR'|'SMG'|'SR'|'SG'|'HG')
 *     helmet|vest: reduce(0~1)   pack: slots   heal: heal   ammo: ammo, amt }
 *   LOOT = { 1:[[id,가중치]..], 2:[..], 3:[..], drop:[..] }     AMMO_NAMES = { AR:'..', SMG:'..', SR:'..', SG:'..', HG:'..' }
 * [world.js] export buildWorlds(scene) → { worlds:{campus,race,soccer,fps}, sun, hemi }
 *   공통: id, root(Group), env{ sky, fog:[색,near,far], sunPos:[x,y,z], sunColor, sunI, hemi:[하늘색,땅색,세기] },
 *         spawn{x,z,yaw}, limit(원형 반경), mapR?, colliders[{x,z,r,h?}], portals[{x,z,r,to,label}],
 *         dummies?[{x,z,r,mesh}] (충돌체는 colliders 에도 포함), update(dt,t)
 *   campus: booths[], kiosk{x,z}, coins[], ballSpots[{x,z,r,kind}]
 *   race:   W{TRACK_R,TRACK_W,LIMIT}, pads[], coins[], kartSpawn{x,z,yaw}, garage{x,z}
 *   soccer: pitch{x,z,hw,hl}, ballSpots[]
 *   fps:    lootSpots[{x,z,tier}], droneSpots[{x,z,kind}]
 * [core.js] 기존 export 유지 + CUSTOM, randomLook, Inventory, Drone, makeItemMesh, makeGunMesh
 *   CUSTOM = [{ key, label, tab, list }]  list: 색상 문자열 배열 또는 [값,라벨] 배열
 *   createCharacter(look) → { group, walk(t,amt), sit(on), wave(t), stopWave(), swing('L'|'R'), tick(dt),
 *                             hold(def|null), kick(), setGear({helmet,vest,pack}) }
 *   Inventory: bag[{id,n,mag?}], equip{main,sub,helmet,vest,pack}, ammo{AR,SMG,SR,SG,HG}, active('main'|'sub'|'fist'),
 *     cap(), add(id,n,mag)→{ok,msg}, wear(i)→슬롯|null, takeOff(slot)→bool, dropAt(i)→스택|null, useAt(i)→def|null,
 *     weapon()→장착무기|null, armor()→{helmet,vest}(def|null), isEmpty(), clear()
 *   Drone(parent,{x,z,kind}): alive,x,z,r,dmg,center(),update(dt,t,px,pz)→true(발사),hit(dmg)→true(파괴),respawn()
 *   sfx 추가: swing hit shoot(fam) reload empty pickup equip hurt heal portal boom zap
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { DEPTS, COLLEGES, ITEMS, LOOT, WORLDS, AMMO_NAMES } from './data.js';
import { load, save, reset, sfx, engine, setSound, isSoundOn, createCharacter, CUSTOM, randomLook,
  Ball, Kart, makeKartMesh, Inventory, Drone, makeGunMesh, makeItemMesh, $, el, toast, openModal, closeModal, isModalOpen } from './core.js';
import { buildWorlds } from './world.js';
import { isTouch, initTouch, adaptQuality, renderInfo, touchSync, joy, QUALITIES, applyQuality, buzz, goFullscreen, TOUCH_HELP } from './input.js';
import { runGame } from './minigames.js';
import { playBgm, bgmForDept, cycleVol, getVol, testSound, fx } from './audio.js';
const bgmPct = (v) => (v <= 0 ? '꺼짐' : Math.round(v * 100) + '%');
import { startExperience, hasExperience } from './experience.js';
import './exp-pilot.js';
import './exp-eng1.js';
import './exp-eng2.js';
import './exp-eng3.js';
import './exp-eng4.js';
import './exp-eng5.js';
import './exp-cul1.js';
import './exp-cul2.js';
import './exp-cul3.js';
import './exp-sea1.js';
import './exp-sea2.js';
import './exp-sea3.js';
import './exp-sea4.js';
import './exp-sea5.js';
import './exp-sea6.js';
import { analyze, drawRadar, reportPNG } from './report.js';
import { initDisplay, tickDisplay } from './display.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const rad = (d) => (d * Math.PI) / 180;
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
const pickW = (t) => { let r = Math.random() * t.reduce((a, b) => a + b[1], 0); for (const [id, w] of t) if ((r -= w) < 0) return id; return t[0][0]; };
const HPMAX = 100;
const FIST = { L: { dmg: 8, range: 2.4, cd: 0.34, kb: 8, dur: 0.3, hitAt: 0.12 }, R: { dmg: 22, range: 2.8, cd: 0.85, kb: 20, dur: 0.62, hitAt: 0.3 } };
const RAR = ['#9aa5b5', '#4fbf6a', '#4c8dd9', '#b06cf0'];
const SLOT_NAME = { main: '주무기', sub: '보조무기', helmet: '헬멧', vest: '조끼', pack: '가방' };

/* ───────────── 상태 ───────────── */
let S = load(); setSound(S.settings.sound); playBgm('title');
let mode = 'title', view = 'tps', ads = false, invOpen = false, hp = HPMAX, race = null, interactables = [], frameN = 0, lastPrompt = '';
const inv = new Inventory(), reload = { t: 0, e: null, d: null }, loot = [], tracers = [], bursts = [];
const bolts = [], BOLT_GEO = new THREE.SphereGeometry(0.13, 8, 6), BOLT_MAT = new THREE.MeshBasicMaterial({ color: '#7fe3ff' });
let bloom = 0;
let vm = null, vmK = 0;
let exp = null;
const ptr = { locked: false, fail: isTouch ? 3 : 0, skip: false, down: [false, false, false] };
const cam = { yaw: Math.PI, pitch: 0.45, aim: 0, dist: 9, lastDrag: 0 };
const keys = new Set();

/* ───────────── HUD 스타일·DOM (index.html 수정 없이 동적 생성) ───────────── */
const css = document.createElement('style');
css.textContent = `
#hudx{position:fixed;inset:0;pointer-events:none;z-index:14;color:#fff;user-select:none;font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
#hudx>div{position:absolute}
#wtag{top:12px;left:50%;transform:translateX(-50%);padding:5px 14px;border-radius:14px;background:rgba(10,30,60,.65);font-weight:700;font-size:14px}
#cross{left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid rgba(255,255,255,.9);border-radius:50%;box-shadow:0 0 3px #000;display:none}
#cross.ads{width:8px;height:8px;margin:-4px 0 0 -4px}
#hitm{left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border:3px solid #ffd24a;border-radius:6px;transform:rotate(45deg);opacity:0;transition:opacity .12s}
#hitm.on{opacity:1}
#hpbox{left:18px;bottom:96px;width:230px;height:22px;border-radius:11px;background:rgba(0,0,0,.5);overflow:hidden;display:none}
#hpfill{height:100%;background:linear-gradient(90deg,#3fd17a,#8be36a);transition:width .15s}
#hptxt{position:absolute;inset:0;text-align:center;line-height:22px;font-size:13px;font-weight:700}
#ammobox{right:22px;bottom:96px;padding:8px 14px;border-radius:12px;background:rgba(10,30,60,.7);font-weight:700;display:none;text-align:right;font-size:14px}
#bar{left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:6px;padding:7px;border-radius:16px;background:rgba(15,30,60,.72);box-shadow:0 4px 16px rgba(0,0,0,.35)}
.slot{pointer-events:auto;cursor:pointer;position:relative;width:62px;height:62px;border-radius:12px;background:rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid transparent}
.slot.on{border-color:#6fb4ff;background:rgba(80,140,255,.3)}
.slot i{position:absolute;top:2px;left:6px;font-size:11px;font-style:normal;opacity:.85}
.slot b{font-size:24px;line-height:1}
.slot small{font-size:10px;opacity:.9;margin-top:2px;max-width:58px;overflow:hidden;white-space:nowrap}
#lockhint{left:50%;bottom:92px;transform:translateX(-50%);padding:6px 14px;border-radius:12px;background:rgba(0,0,0,.6);font-size:13px;display:none}
#flash{inset:0;background:radial-gradient(transparent 55%,rgba(90,160,255,.55));opacity:0;transition:opacity .3s}
#flash.on{opacity:1;transition:none}
#cust{max-height:290px;overflow-y:auto;padding-right:6px}
.ctabs{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}
.crow{display:flex;align-items:center;gap:8px;margin:5px 0}
.clab{width:62px;font-size:13px;opacity:.9;flex:none}
.cbox{display:flex;flex-wrap:wrap;gap:6px}
.igrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:6px 0}
.icard{border:2px solid #9aa5b5;border-radius:10px;padding:8px;background:rgba(127,127,127,.12);font-size:14px}
.icard small{opacity:.85}
.icard .btn{margin-top:6px}

#bar{gap:4px;padding:4px;border-radius:12px;bottom:8px}
.slot{width:46px;height:46px;border-radius:9px}
.slot i{font-size:9px;top:1px;left:4px}
.slot b{font-size:18px}
.slot small{font-size:8px;margin-top:1px;max-width:44px}
body.touch .slot{width:40px;height:40px}
body.touch .slot small{display:none}
#hpbox{bottom:66px;width:200px;height:18px}
#hptxt{line-height:18px;font-size:12px}
#ammobox{bottom:66px;padding:6px 12px;font-size:13px}
#lockhint{bottom:62px}
`;
document.head.append(css);
const hx = el('div'); hx.id = 'hudx'; hx.style.display = 'none';
hx.innerHTML = '<div id="wtag"></div><div id="cross"></div><div id="hitm"></div><div id="hpbox"><div id="hpfill"></div><span id="hptxt"></span></div><div id="ammobox"></div><div id="bar"></div><div id="lockhint">🖱 화면을 클릭하면 마우스가 고정돼요 · Esc: 해제(메뉴)</div><div id="flash"></div>';
document.body.append(hx);
const ui = { cross: $('#cross'), hint: $('#lockhint'), hit: $('#hitm'), flash: $('#flash'), wtag: $('#wtag') };

/* ───────────── 3D 기본 설정 ───────────── */
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900); scene.add(camera);
const WR = buildWorlds(scene), WS = WR.worlds; let cur = WS.campus; WR.sun.castShadow = S.settings.shadow;
if (!QUALITIES[S.settings.q] || S.settings.qv !== 3) { S.settings.q = 'high'; S.settings.qv = 3; }
initDisplay(renderer, scene);
applyQuality(S.settings.q, renderer, WR.sun, S);
const onResize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', onResize); onResize();
addEventListener('orientationchange', () => setTimeout(onResize, 250));
function applyEnv(w) {
  const e = w.env; scene.background = new THREE.Color(e.sky); scene.fog = new THREE.Fog(e.fog[0], e.fog[1], e.fog[2]);
  WR.sun.color.set(e.sunColor || '#fff4e0'); WR.sun.intensity = e.sunI ?? 1.5; WR.hemi.color.set(e.hemi[0]); WR.hemi.groundColor.set(e.hemi[1]); WR.hemi.intensity = e.hemi[2];
  Object.values(WS).forEach((x) => { x.root.visible = x === w; });
}
WS.campus.booths.forEach((b) => b.setDone(!!S.played[b.dept.id]));

const P = { x: cur.spawn.x, z: cur.spawn.z, y: 0, vx: 0, vz: 0, vy: 0, yaw: cur.spawn.yaw, char: null, cd: 0, atk: null };
const kart = new Kart(WS.race.root), RW = WS.race.W; kart.place(WS.race.kartSpawn.x, WS.race.kartSpawn.z, WS.race.kartSpawn.yaw);
const ballsBy = { campus: WS.campus.ballSpots.map((s) => new Ball(WS.campus.root, s)), soccer: WS.soccer.ballSpots.map((s) => new Ball(WS.soccer.root, s)) };
const balls = () => ballsBy[cur.id] || [];
const drones = WS.fps.droneSpots.map((s) => new Drone(WS.fps.root, s));

function placePlayer() { P.char.group.position.set(P.x, P.y, P.z); P.char.group.rotation.y = P.yaw; }
function buildPlayer() {
  let parent = scene;
  if (P.char) { parent = P.char.group.parent || scene; parent.remove(P.char.group); }
  P.char = createCharacter(S.look); parent.add(P.char.group);
  if (parent === kart.group) { P.char.group.position.set(0, 0.45, -0.15); P.char.group.scale.setScalar(0.7); P.char.sit(true); } else placePlayer();
  syncGear(); P.char.hold(heldDef());
}

/* 이펙트 */
function burst(x, y, z) {
  const n = 50, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel.push(rnd(-6, 6), rnd(4, 11), rnd(-6, 6)); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6), transparent: true }));
  scene.add(m); bursts.push({ m, vel, life: 1.2, n });
}
function tracer(a, b, color) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
  l.frustumCulled = false; scene.add(l); tracers.push({ l, life: 0.09 });
}
const hitmark = (kill) => { ui.hit.style.borderColor = kill ? '#ff7a59' : '#ffd24a'; ui.hit.classList.add('on'); setTimeout(() => ui.hit.classList.remove('on'), kill ? 220 : 90); };
const flash = () => { ui.flash.classList.add('on'); setTimeout(() => ui.flash.classList.remove('on'), 60); };

/* ───────────── 입력(포인터 락: 좌/우클릭 = 공격) ───────────── */
const cvs = $('#gl');
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
function lock() { try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(() => { ptr.fail++; }); } catch (e) { ptr.fail++; } }
function unlock() { if (document.pointerLockElement) { ptr.skip = true; document.exitPointerLock(); } }
document.addEventListener('pointerlockchange', () => {
  ptr.locked = document.pointerLockElement === cvs; if (ptr.locked) ptr.fail = 0;
  if (!ptr.locked) { ptr.down[0] = ptr.down[2] = false; ads = false; if (ptr.skip) ptr.skip = false; else if (mode === 'play') openMenu(); }
});
document.addEventListener('pointerlockerror', () => { ptr.fail++; });
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (mode === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  onKey(e);
});
addEventListener('keyup', (e) => keys.delete(e.code));
cvs.addEventListener('mousedown', (e) => {
  if (mode !== 'play') return;
  if (isTouch) return;
  if (!ptr.locked && ptr.fail < 3) { lock(); return; }
  if (race || kart.active) return;
  if (e.button === 0) { ptr.down[0] = true; primary(); } else if (e.button === 2) { ptr.down[2] = true; secondary(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) ptr.down[0] = false; if (e.button === 2) { ptr.down[2] = false; ads = false; } });
cvs.addEventListener('mousemove', (e) => { if (mode === 'play' && ptr.locked) look(e.movementX, e.movementY); });
cvs.addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 4, 18); });
function look(dx, dy) {
  const s = 0.0026 * (S.settings.sens || 1) * (ads ? 0.6 : 1); cam.yaw -= dx * s; cam.lastDrag = performance.now();
  if (view === 'fps' && cur.id === 'fps' && !kart.active) cam.aim = clamp(cam.aim - dy * s, -1.35, 1.35); else cam.pitch = clamp(cam.pitch + dy * s, -0.04, 1.25);
}
function onKey(e) {
  if (e.repeat) return; const c = e.code;
  if (c === 'Escape') { if (isModalOpen()) closeModal(); else if (race) { cleanupRace(); toast('레이스를 취소했어요.'); } else if (mode === 'play') openMenu(); return; }
  if (mode === 'modal') { if (invOpen && (c === 'KeyI' || c === 'Tab')) closeModal(); return; }
  if (mode !== 'play') return;
  if (c === 'KeyE') interact();
  else if (c === 'KeyF') { if (cur.id === 'fps') interact(); else kickAll(); }
  else if (c === 'KeyR') { if (cur.id === 'fps') startReload(); else { balls().forEach((b) => b.reset()); toast('공을 제자리로 돌려놨어요.'); } }
  else if (c === 'Tab') { if (cur.id === 'fps') openInventory(); else showReport(); }
  else if (c === 'KeyI') openInventory();
  else if (c === 'KeyM') $('#hud-right').classList.toggle('big');
  else if (c === 'KeyV' && cur.id === 'fps') { view = view === 'fps' ? 'tps' : 'fps'; cam.pitch = 0.35; cam.aim = 0; toast(view === 'fps' ? '👁 1인칭' : '🎥 3인칭'); }
  else if (/^Digit[1-6]$/.test(c)) { const d = barDefs().find((x) => x.k === +c.slice(5)); if (d) d.f(); }
}
$('#b-report').onclick = () => { if (mode === 'play') showReport(); };
$('#b-menu').onclick = () => { if (mode === 'play') openMenu(); };
initTouch({
  keys,
  look: (dx, dy) => look(dx, dy),
  key: (c) => onKey({ code: c, repeat: false }),
  atk: (on) => { if (mode !== 'play' || race || kart.active) return; ptr.down[0] = on; if (on) primary(); },
  alt: (on) => {
    if (!on || mode !== 'play' || race || kart.active) return;
    if (cur.id === 'fps' && heldDef()) ads = !ads; else melee('R');
  },
});


/* ───────────── HUD ───────────── */
function hud() {
  const n = Object.keys(S.played).length;
  $('#hud-name').textContent = `🎒 ${S.name || '탐험가'}`; $('#hud-prog').textContent = `🧭 직업체험 ${n} / ${DEPTS.length}`;
  $('#hud-fill').style.width = (n / DEPTS.length) * 100 + '%';
  $('#hud-misc').textContent = `🪙 ${S.coins}   ⚽ ${S.goals}골${S.kills ? `   🎯 ${S.kills}` : ''}${S.bestLap ? `   🏁 최고랩 ${S.bestLap.toFixed(1)}초` : ''}`;
}
function updateHp() { $('#hpfill').style.width = (hp / HPMAX) * 100 + '%'; $('#hptxt').textContent = `❤ ${Math.ceil(hp)} / ${HPMAX}`; }
function updateAmmo() {
  const b = $('#ammobox'); $('#hpbox').style.display = cur.id === 'fps' ? 'block' : 'none';
  if (cur.id !== 'fps') { b.style.display = 'none'; return; } b.style.display = 'block';
  const e = inv.weapon(); if (!e) { b.innerHTML = '👊 맨손<br><small>좌클릭 잽 · 우클릭 강타</small>'; return; }
  const d = ITEMS[e.id]; b.innerHTML = `${d.icon || '🔫'} ${d.name}<br><span style="font-size:22px">${reload.t > 0 ? '재장전…' : e.mag}</span> / ${inv.ammo[d.ammo] | 0}`;
}
function barDefs() {
  if (cur.id === 'fps') {
    const m = inv.equip.main, s = inv.equip.sub, nHeal = inv.bag.filter((e) => ITEMS[e.id].type === 'heal').reduce((a, e) => a + (e.n || 1), 0), nGear = ['helmet', 'vest', 'pack'].filter((k) => inv.equip[k]).length;
    return [{ k: 1, ic: '🔫', t: m ? ITEMS[m.id].name : '주무기', on: inv.active === 'main', f: () => setActive('main') },
      { k: 2, ic: '🔫', t: s ? ITEMS[s.id].name : '보조무기', on: inv.active === 'sub', f: () => setActive('sub') },
      { k: 3, ic: '👊', t: '맨손', on: inv.active === 'fist', f: () => setActive('fist') },
      { k: 4, ic: '🩹', t: nHeal ? `회복 ×${nHeal}` : '회복', f: useHeal }, { k: 5, ic: '🛡️', t: `장비 ${nGear}/3`, f: openInventory }, { k: 6, ic: '⚙️', t: '설정', f: openMenu }];
  }
  return [{ k: 1, ic: '🎒', t: '가방', f: openInventory }, { k: 2, ic: '🗺️', t: '지도', f: () => $('#hud-right').classList.toggle('big') },
    { k: 3, ic: '📷', t: '사진', f: takePhoto }, { k: 4, ic: '📓', t: '리포트', f: showReport }, { k: 5, ic: '🧭', t: '나침반', f: compass }, { k: 6, ic: '⚙️', t: '설정', f: openMenu }];
}
function updateBar() {
  const bar = $('#bar'); bar.innerHTML = '';
  barDefs().forEach((d) => { const s = el('div', 'slot' + (d.on ? ' on' : ''), `<i>${d.k}</i><b>${d.ic}</b><small>${d.t}</small>`); s.onclick = () => { if (mode === 'play') { sfx.click(); d.f(); } }; bar.append(s); });
}
function takePhoto() { renderer.render(scene, camera); const a = document.createElement('a'); a.href = cvs.toDataURL('image/png'); a.download = '진로탐험_사진.png'; a.click(); toast('📷 사진을 저장했어요!'); }
function compass() {
  const a = actor(); let best = null, bd = 1e9;
  const cand = (cur.id === 'campus' ? cur.booths.filter((b) => !b.done).map((b) => ({ x: b.x, z: b.z, n: b.dept.name })) : []).concat(cur.portals.map((p) => ({ x: p.x, z: p.z, n: p.label })));
  for (const c of cand) { const d = Math.hypot(c.x - a.x, c.z - a.z); if (d < bd) { bd = d; best = c; } }
  if (!best) return;
  let rel = Math.atan2(best.x - a.x, best.z - a.z) - cam.yaw; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
  const ar = { 0: '⬆️', 1: '↖️', 2: '⬅️', 3: '↙️', 4: '⬇️', '-4': '⬇️', '-1': '↗️', '-2': '➡️', '-3': '↘️' }[Math.round(rel / (Math.PI / 4))];
  toast(`🧭 ${best.n} · ${Math.round(bd)}m ${ar}`, 3000);
}

/* ───────────── 모달 래퍼 ───────────── */
function openM(content, opts = {}) {
  mode = 'modal'; ads = false; ptr.down[0] = ptr.down[2] = false; unlock();
  openModal(content, { wide: opts.wide, onClose: (rep) => { if (opts.onClose) opts.onClose(rep); if (!rep) mode = 'play'; } });
}

/* ───────────── 타이틀: 캐릭터 커스터마이징 ───────────── */
const TABS = [...new Set(CUSTOM.map((o) => o.tab))]; let tab = TABS[0], custPanel = null;
function rowOf(sel) { let e = $(sel); if (!e) return null; const stop = $('#b-start'); while (e.parentElement && !e.parentElement.contains(stop)) e = e.parentElement; return e; }
function buildCust() {
  custPanel.innerHTML = ''; const tb = el('div', 'ctabs');
  TABS.forEach((t) => { const b = el('button', 'btn small' + (t === tab ? ' primary' : ''), t); b.onclick = () => { tab = t; sfx.click(); buildCust(); }; tb.append(b); });
  custPanel.append(tb);
  CUSTOM.filter((o) => o.tab === tab).forEach((o) => {
    const row = el('div', 'crow'), box = el('div', 'cbox'); row.append(el('span', 'clab', o.label));
    o.list.forEach((v) => {
      const isT = Array.isArray(v), val = isT ? v[0] : v, b = el('button', 'sw' + (isT ? ' txt' : ''));
      if (isT) b.textContent = v[1]; else b.style.background = v;
      if (S.look[o.key] === val) b.classList.add('on');
      b.onclick = () => { S.look[o.key] = val; save(S); buildPlayer(); sfx.click(); buildCust(); }; box.append(b);
    });
    row.append(box); custPanel.append(row);
  });
  const n = Object.keys(S.played).length; $('#t-info').textContent = n ? `💾 이전 기록: 직업체험 ${n}개 · 코인 ${S.coins}` : '';
}
{
  const olds = ['#o-style', '#o-hair', '#o-skin', '#o-uni', '#o-bag'].map(rowOf).filter(Boolean);
  custPanel = el('div'); custPanel.id = 'cust'; if (olds[0]) olds[0].before(custPanel); else $('#title').append(custPanel);
  [...new Set(olds)].forEach((r) => { r.style.display = 'none'; });
}
$('#in-name').value = S.name || '';
$('#b-rand').onclick = () => { S.look = randomLook(); save(S); buildPlayer(); buildCust(); sfx.click(); };
$('#b-start').onclick = () => {
  playBgm('campus');
  goFullscreen(); S.name = $('#in-name').value.trim() || '탐험가'; save(S); sfx.ok();
  $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden'); hx.style.display = 'block'; mode = 'play'; cam.yaw = Math.PI; hud();
  toast(isTouch ? '왼쪽 화면을 밀어 이동 · 오른쪽 화면을 드래그해 시점 · ✋ 버튼으로 체험하기!' : '부스 앞에서 E 키! 마우스를 클릭하면 시점이 고정돼요 (좌클릭 잽 · 우클릭 강타)', 5000);
};

/* ───────────── 상호작용 ───────────── */
function buildInteractables() {
  const w = cur, l = [];
  (w.booths || []).forEach((b) => l.push({ x: b.x, z: b.z, r: 6.2, label: `[E] ${b.dept.icon} ${b.dept.name} 체험하기`, act: () => openBooth(b) }));
  if (w.kiosk) l.push({ x: w.kiosk.x, z: w.kiosk.z, r: 4.5, label: '[E] 📊 내 진로 리포트 보기', act: showReport });
  if (w.garage) l.push({ x: w.garage.x, z: w.garage.z, r: 9, label: '[E] 🏎️ 레이싱 센터 (카트·레이스)', act: openGarage, hide: () => race || kart.active });
  w.portals.forEach((p) => l.push({ x: p.x, z: p.z, r: p.r || 4.5, label: `[E] 🌀 ${p.label}`, act: () => askPortal(p.to), hide: () => kart.active }));
  return l;
}
const actor = () => (kart.active ? { x: kart.x, z: kart.z } : { x: P.x, z: P.z });
function nearest() {
  if (race) return null;
  if (kart.active) return { label: '[E] 🚪 카트에서 내리기', act: exitKart };
  const a = actor(); let best = null, bd = 1e9;
  for (const it of interactables) { if (it.hide && it.hide()) continue; const d = Math.hypot(a.x - it.x, a.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  if (cur.id === 'fps') for (const l of loot) { const d = Math.hypot(a.x - l.x, a.z - l.z); if (d < 2.4 && d < bd) { bd = d; best = { label: `[F] 줍기 · ${l.def.icon} ${l.def.name}`, act: () => pickup(l) }; } }
  return best;
}
function interact() { const it = nearest(); if (it) { sfx.click(); it.act(); } }
function kickAll() { const a = actor(); let hit = false; balls().forEach((b) => { if (b.kick(a.x, a.z, 16)) hit = true; }); if (hit) sfx.kick(); }

/* ───────────── 월드 이동 (아이템 초기화) ───────────── */
function askPortal(to) {
  const w = WORLDS[to]; if (inv.isEmpty()) { changeWorld(to); return; }
  const box = el('div', '', `<h2>${w.icon} ${w.name}(으)로 이동할까요?</h2><p>⚠ 가지고 있는 <b>무기·장비·소모품·탄약은 이동하면 모두 사라져요.</b><br>진로코인과 체험 기록은 그대로예요.</p>`);
  const row = el('div', 'row'), go = el('button', 'btn primary big', '🌀 이동하기'), no = el('button', 'btn', '취소');
  go.onclick = () => { closeModal(); changeWorld(to); }; no.onclick = closeModal; row.append(go, no); box.append(row); openM(box);
}
function changeWorld(id, quiet) {
  playBgm(id);
  const nw = WS[id]; if (!nw) return; const had = !inv.isEmpty();
  inv.clear(); clearLoot(); clearBolts(); reload.t = 0; reload.e = null; ads = false; hp = HPMAX; P.atk = null;
  if (kart.active) exitKart(); if (race) cleanupRace();
  cur = nw; applyEnv(cur);
  P.x = cur.spawn.x; P.z = cur.spawn.z; P.yaw = cur.spawn.yaw; P.y = 0; P.vx = P.vz = P.vy = 0; cam.yaw = cur.spawn.yaw; cam.aim = 0; cam.pitch = 0.45;
  view = id === 'fps' ? 'fps' : 'tps'; placePlayer();
  interactables = buildInteractables(); if (id === 'fps') { spawnLoot(); drones.forEach((d) => { d.respawn(); d.deadT = 0; }); }
  syncGear(); syncHeld(); updateHp(); hud(); ui.wtag.textContent = `${WORLDS[id].icon} ${WORLDS[id].name}`;
  if (!quiet) { sfx.portal(); toast(had ? '🎒 월드를 이동해서 가지고 있던 아이템이 모두 사라졌어요' : id === 'fps' ? '🎯 바닥의 무기·장비를 주우면 바로 착용돼요! (1·2번 무기 · 4번 회복)' : `${WORLDS[id].icon} ${WORLDS[id].name} 도착!`, 3600); }
}

/* ───────────── 장비 동기화 ───────────── */
const heldDef = () => { const e = inv.weapon(); return e ? ITEMS[e.id] : null; };
function syncGear() { const a = inv.armor(); P.char.setGear({ helmet: a.helmet, vest: a.vest, pack: inv.equip.pack ? ITEMS[inv.equip.pack.id] : null }); }
function setVM(d) {
  if (vm) { camera.remove(vm); vm = null; } if (!d) return;
  vm = makeGunMesh(d); vm.rotation.y = Math.PI; vm.position.set(0.26, -0.24, -0.6); vm.traverse((o) => { if (o.isMesh) o.castShadow = false; }); camera.add(vm);
}
function syncHeld() {
  if (inv.active !== 'fist' && !inv.equip[inv.active]) inv.active = inv.equip.main ? 'main' : inv.equip.sub ? 'sub' : 'fist';
  const d = heldDef(); P.char.hold(d); setVM(d); updateAmmo(); updateBar();
}
function setActive(s) {
  if (s !== 'fist' && !inv.equip[s]) { toast('비어 있는 슬롯이에요'); return; }
  inv.active = s; reload.t = 0; reload.e = null; ads = false; sfx.equip(); syncHeld();
}

/* ───────────── 바닥 아이템 ───────────── */
function addLoot(id, x, z, stack) {
  const def = ITEMS[id]; if (!def) return; const m = makeItemMesh(def); m.position.set(x, 0, z); WS.fps.root.add(m);
  loot.push({ id, x, z, mesh: m, def, stack: stack || null, t: Math.random() * 6 });
}
function clearLoot() { loot.splice(0).forEach((l) => l.mesh.parent && l.mesh.parent.remove(l.mesh)); }
function spawnLoot() { WS.fps.lootSpots.forEach((s) => addLoot(pickW(LOOT[s.tier || 1]), s.x, s.z)); }
function autoEquip(id) {
  const d = ITEMS[id]; if (!d || !['weapon', 'helmet', 'vest', 'pack'].includes(d.type)) return '';
  let i = -1; for (let k = inv.bag.length - 1; k >= 0; k--) if (inv.bag[k].id === id) { i = k; break; }
  if (i < 0) return '';
  if (d.type === 'weapon') {
    if (inv.equip.main && inv.equip.sub) return '';
    const had = !!(inv.equip.main || inv.equip.sub), s = inv.wear(i); if (!s) return '';
    if (s === 'main' || s === 'sub') { if (!had || inv.active === 'fist') inv.active = s; }
    return `${SLOT_NAME[s]} 장착`;
  }
  const o = inv.equip[d.type];
  if (o) { const od = ITEMS[o.id], better = d.type === 'pack' ? (d.slots || 0) > (od.slots || 0) : (d.reduce || 0) > (od.reduce || 0); if (!better) return ''; }
  const s = inv.wear(i); return s ? `${SLOT_NAME[s] || SLOT_NAME[d.type]} 착용` : '';
}
function pickup(l) {
  const r = inv.add(l.id, l.stack ? l.stack.n : 1, l.stack ? l.stack.mag : undefined);
  if (!r.ok) { toast('🎒 ' + (r.msg || '가방이 가득 찼어요')); return; }
  sfx.pickup(); l.mesh.parent.remove(l.mesh); loot.splice(loot.indexOf(l), 1);
  const note = autoEquip(l.id); if (note) { sfx.equip(); syncGear(); syncHeld(); }
  const heal = l.def.type === 'heal';
  toast(`${l.def.icon} ${l.def.name} 획득!${note ? ' · ' + note : heal ? ' · 4번 칸으로 사용' : ['weapon', 'helmet', 'vest', 'pack'].includes(l.def.type) ? ' · 가방에 보관(I로 교체)' : ''}`); updateAmmo(); updateBar();
}
function dropItem(i) {
  const st = inv.dropAt(i); if (!st) return;
  if (cur.id === 'fps') addLoot(st.id, P.x + Math.sin(P.yaw) * 1.6, P.z + Math.cos(P.yaw) * 1.6, st); toast('아이템을 버렸어요');
}
function useHeal() {
  const i = inv.bag.findIndex((e) => ITEMS[e.id].type === 'heal');
  if (i < 0) { toast('🩹 회복 아이템이 없어요'); return; } if (hp >= HPMAX) { toast('체력이 이미 가득해요'); return; }
  const d = inv.useAt(i); hp = Math.min(HPMAX, hp + d.heal); sfx.heal(); updateHp(); updateBar(); toast(`${d.icon} 체력 +${d.heal}`);
}

/* ───────────── 인벤토리 창 ───────────── */
function itemInfo(d, e) {
  let s = '';
  if (d.type === 'weapon') s = `피해 ${d.dmg}${d.pellets > 1 ? '×' + d.pellets : ''} · 연사 ${d.rate}/초 · 탄창 ${e && e.mag != null ? e.mag : '-'}/${d.mag} · ${AMMO_NAMES[d.ammo]}`;
  else if (d.type === 'helmet' || d.type === 'vest') s = `받는 피해 ${Math.round(d.reduce * 100)}% 감소`;
  else if (d.type === 'pack') s = `가방 칸 +${d.slots}`; else if (d.type === 'heal') s = `체력 +${d.heal}`; else if (d.type === 'ammo') s = `${AMMO_NAMES[d.ammo]} +${d.amt}`;
  return s + (d.desc ? `<br>${d.desc}` : '');
}
function openInventory() {
  if (mode !== 'play') return; invOpen = true; const box = el('div', 'inv');
  const after = () => { syncGear(); syncHeld(); render(); };
  const render = () => {
    box.innerHTML = ''; box.append(el('h2', '', `🎒 가방 (${inv.bag.length}/${inv.cap()})`), el('div', 'small', '⚠ 다른 월드로 이동하면 가진 아이템이 모두 사라져요. (코인·체험 기록은 유지)'), el('h4', '', '🧍 착용 중'));
    const eq = el('div', 'igrid');
    for (const k of ['main', 'sub', 'helmet', 'vest', 'pack']) {
      const e = inv.equip[k], c = el('div', 'icard');
      if (e) { const d = ITEMS[e.id]; c.style.borderColor = RAR[(d.rarity || 1) - 1]; c.innerHTML = `<b>${SLOT_NAME[k]} · ${d.icon} ${d.name}</b><br><small>${itemInfo(d, e)}</small><br>`; const b = el('button', 'btn small', '벗기 / 해제'); b.onclick = () => { if (inv.takeOff(k)) { sfx.equip(); after(); } else toast('가방이 가득 차서 해제할 수 없어요'); }; c.append(b); }
      else c.innerHTML = `<b>${SLOT_NAME[k]}</b><br><small>비어 있음</small>`;
      eq.append(c);
    }
    box.append(eq, el('div', 'small', '🔸 탄약: ' + Object.keys(inv.ammo).map((k) => `${AMMO_NAMES[k]} ${inv.ammo[k]}`).join(' · ')), el('h4', '', '📦 소지품'));
    const gr = el('div', 'igrid');
    if (!inv.bag.length) gr.append(el('div', 'small', '비어 있어요. FPS 훈련 월드 바닥에서 아이템을 주워 보세요!'));
    inv.bag.forEach((e, i) => {
      const d = ITEMS[e.id], c = el('div', 'icard'); c.style.borderColor = RAR[(d.rarity || 1) - 1];
      c.innerHTML = `<b>${d.icon} ${d.name}${e.n > 1 ? ` ×${e.n}` : ''}</b><br><small>${itemInfo(d, e)}</small><br>`;
      if (['weapon', 'helmet', 'vest', 'pack'].includes(d.type)) { const b = el('button', 'btn small primary', '착용'); b.onclick = () => { const s = inv.wear(i); if (s) { sfx.equip(); if (s === 'main' || s === 'sub') inv.active = s; after(); } else toast('착용할 수 없어요'); }; c.append(b, ' '); }
      if (d.type === 'heal') { const b = el('button', 'btn small primary', '사용'); b.onclick = () => { useHeal(); render(); }; c.append(b, ' '); }
      const x = el('button', 'btn small', '버리기'); x.onclick = () => { dropItem(i); after(); }; c.append(x); gr.append(c);
    });
    const row = el('div', 'row'), cl = el('button', 'btn primary', '닫기 (I)'); cl.onclick = closeModal; row.append(cl); box.append(gr, row);
  };
  render(); openM(box, { wide: true, onClose: () => { invOpen = false; } });
}

/* ───────────── 전투: 근접(좌 잽 / 우 강타) + 총기(좌 발사 / 우 조준) ───────────── */
function primary() {
  if (cur.id === 'fps' && heldDef()) fire(true); else melee('L');
}
function secondary() {
  if (cur.id === 'fps' && heldDef()) ads = true; else melee('R');
}
function melee(kind) {
  if (P.cd > 0 || P.atk || kart.active) return; const f = FIST[kind];
  P.atk = { kind, t: 0, hit: false, ...f }; P.cd = f.cd; P.yaw = cam.yaw; P.char.swing(kind); sfx.swing();
}
function meleeHit(a) {
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); let any = false;
  const cone = (x, z, r) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > a.range + r) return null; if (d > r + 0.3 && (dx * fx + dz * fz) / d < 0.3) return null; return { dx, dz }; };
  for (const b of balls()) if (cone(b.p.x, b.p.z, b.r)) { b.kick(P.x, P.z, a.kb); any = true; sfx.kick(); }
  if (cur.id === 'fps') for (const d of drones) if (d.alive && cone(d.x, d.z, d.r * 0.8)) { damageDrone(d, a.dmg); any = true; }
  for (const dm of cur.dummies || []) { const h = cone(dm.x, dm.z, dm.r || 0.8); if (h) { dm.wob = 1; dm.dir = Math.atan2(h.dz, h.dx); any = true; sfx.hit(); } }
  if (any) hitmark(false);
}
function damageDrone(d, dmg) {
  if (!d.alive) return; const dead = d.hit(dmg); hitmark(dead); sfx.hit();
  if (dead) {
    d.deadT = 0; S.kills = (S.kills | 0) + 1; S.coins += 2; save(S); hud(); burst(d.x, 1.5, d.z); sfx.boom(); toast('🎯 훈련 드론 격파! 🪙+2');
    if (Math.random() < 0.75) addLoot(pickW(LOOT.drop), d.x + rnd(-1, 1), d.z + rnd(-1, 1));
  }
}
function rayWorld(o, d, max) {
  let best = max; if (d.y < -1e-4) best = Math.min(best, -o.y / d.y);
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-8) for (const c of cur.colliders) {
    const ox = o.x - c.x, oz = o.z - c.z, b = 2 * (ox * d.x + oz * d.z), k = ox * ox + oz * oz - c.r * c.r, disc = b * b - 4 * a * k;
    if (disc < 0) continue; const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t > 0 && t < best) { const y = o.y + d.y * t; if (y >= 0 && y <= (c.h || 4)) best = t; }
  }
  return best;
}
function castRay(o, d, range) {
  let t = rayWorld(o, d, range), hit = null;
  const sph = (c, r) => { const ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z, tca = ox * d.x + oy * d.y + oz * d.z; if (tca < 0) return -1; const d2 = ox * ox + oy * oy + oz * oz - tca * tca; return d2 > r * r ? -1 : tca - Math.sqrt(r * r - d2); };
  if (cur.id === 'fps') for (const dr of drones) { if (!dr.alive) continue; const s = sph(dr.center(), dr.r); if (s >= 0 && s < t) { t = s; hit = { drone: dr }; } }
  for (const dm of cur.dummies || []) { const s = sph({ x: dm.x, y: 1.1, z: dm.z }, dm.r || 0.8); if (s >= 0 && s < t) { t = s; hit = { dummy: dm }; } }
  return { t, hit };
}
function muzzle() {
  const y = cam.yaw, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), r = new THREE.Vector3(-Math.cos(y), 0, Math.sin(y));
  if (view === 'fps') return camera.position.clone().addScaledVector(f, 0.9).addScaledVector(r, 0.26).add(new THREE.Vector3(0, -0.25, 0));
  return new THREE.Vector3(P.x, P.y + 1.3, P.z).addScaledVector(f, 1.0).addScaledVector(r, 0.3);
}
function assist(o, dir) {
  if (cur.id !== 'fps') return; let best = null, bc = 0.975;
  for (const dr of drones) {
    if (!dr.alive) continue; const v = dr.center().clone().sub(o), L = v.length(); if (L > 90 || L < 1) continue;
    v.divideScalar(L); const c = v.dot(dir); if (c > bc) { bc = c; best = v; }
  }
  if (best) dir.lerp(best, 0.7).normalize();
}
function shoot(d) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  if (isTouch) assist(camera.position, dir);
  const sp = rad(d.spread || 1) * (ads ? 0.45 : 1) * (1 + Math.min(2.2, Math.hypot(P.vx, P.vz) * 0.18) + (P.y > 0.3 ? 1.2 : 0) + bloom);
  dir.x += rnd(-sp, sp); dir.y += rnd(-sp, sp); dir.z += rnd(-sp, sp); dir.normalize();
  const o = camera.position.clone(); if (view !== 'fps') o.addScaledVector(dir, camera.position.distanceTo(new THREE.Vector3(P.x, P.y + 1.4, P.z)));
  const range = d.range || 80, { t, hit } = castRay(o, dir, range);
  tracer(muzzle(), o.clone().addScaledVector(dir, t), '#ffe6a0');
  if (hit && hit.drone) damageDrone(hit.drone, d.dmg * (1 - 0.35 * (t / range)));
  else if (hit && hit.dummy) { hit.dummy.wob = 1; hit.dummy.dir = Math.atan2(dir.z, dir.x); hitmark(false); sfx.hit(); }
}
function fire(first) {
  const e = inv.weapon(); if (!e || reload.t > 0 || P.cd > 0 || mode !== 'play') return; const d = ITEMS[e.id];
  if (!d.auto && !first) return;
  if (e.mag <= 0) { if (first) sfx.empty(); startReload(); return; }
  e.mag--; bloom = Math.min(1.6, bloom + (d.recoil || 1) * 0.06); P.cd = 1 / d.rate; vmK = 1; P.char.kick(); P.yaw = cam.yaw;
  for (let i = 0; i < (d.pellets || 1); i++) shoot(d);
  sfx.shoot(d.fam); if (view === 'fps') { cam.aim = clamp(cam.aim + (d.recoil || 1) * 0.01, -1.35, 1.35); cam.yaw += rnd(-0.004, 0.004) * (d.recoil || 1); }
  updateAmmo(); if (e.mag <= 0 && (inv.ammo[d.ammo] | 0) > 0) setTimeout(() => { if (inv.weapon() === e) startReload(); }, 250);
}
function startReload() {
  const e = inv.weapon(); if (!e || reload.t > 0) return; const d = ITEMS[e.id]; if (e.mag >= d.mag) return;
  if ((inv.ammo[d.ammo] | 0) <= 0) { toast('탄약이 없어요! 바닥에서 탄약을 찾아보세요'); return; }
  reload.t = d.reload; reload.e = e; reload.d = d; sfx.reload(); updateAmmo();
}
function finishReload() {
  const e = reload.e, d = reload.d; if (e && inv.weapon() === e) { const take = Math.min(d.mag - e.mag, inv.ammo[d.ammo] | 0); e.mag += take; inv.ammo[d.ammo] -= take; }
  reload.e = null; updateAmmo();
}
function hurt(dmg) {
  const a = inv.armor(), red = clamp((a.helmet ? a.helmet.reduce : 0) + (a.vest ? a.vest.reduce : 0), 0, 0.7);
  hp -= dmg * (1 - red); sfx.hurt(); flash(); buzz(35); updateHp(); if (hp <= 0) { hp = 0; updateHp(); ko(); }
}
function ko() {
  let next = 'fps'; const box = el('div', '', '<h2>🤖 훈련 종료!</h2><p>훈련 드론의 신호를 많이 맞았어요. 아이템은 사라지지만 코인과 기록은 그대로예요.</p>');
  const row = el('div', 'row'), re = el('button', 'btn primary', '🔁 다시 도전'), home = el('button', 'btn', '🏫 캠퍼스로');
  re.onclick = closeModal; home.onclick = () => { next = 'campus'; closeModal(); }; row.append(re, home); box.append(row);
  openM(box, { onClose: (rep) => { if (!rep) changeWorld(next); } });
}
/* 적 사격: 즉시 명중이 아니라 날아가는 탄환이에요. 거리·내 속도·점프에 따라 빗나가고, 옆으로 움직이면 피할 수 있어요 */
const BOLT_V = 34;
function fireBolt(d) {
  if (!d.alive || cur.id !== 'fps' || mode !== 'play') return;
  const from = d.center(), tgt = new THREE.Vector3(P.x + P.vx * 0.25, P.y + 1.1, P.z + P.vz * 0.25), dir = tgt.clone().sub(from), dist = dir.length();
  if (dist < 0.8 || dist > 85) return; dir.normalize();
  if (rayWorld(from, dir, dist) < dist - 0.5) return;
  const mv = Math.hypot(P.vx, P.vz), sp = rad(1.6 + dist * 0.055 + mv * 0.55 + (P.y > 0.3 ? 2.5 : 0));
  dir.x += rnd(-sp, sp); dir.y += rnd(-sp, sp) * 0.7; dir.z += rnd(-sp, sp); dir.normalize();
  const m = new THREE.Mesh(BOLT_GEO, BOLT_MAT); m.position.copy(from); scene.add(m);
  bolts.push({ m, dir, life: 2.4, dmg: d.dmg }); sfx.zap();
}
function enemyShot(d) {
  fireBolt(d);
  const dd = Math.hypot(d.x - P.x, d.z - P.z);
  if (dd < 25) setTimeout(() => fireBolt(d), 140);
}
function clearBolts() { bolts.splice(0).forEach((b) => scene.remove(b.m)); }
function boltUpdate(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], step = BOLT_V * dt, a = b.m.position.clone(), nx = a.clone().addScaledVector(b.dir, step); let dead = (b.life -= dt) <= 0;
    if (rayWorld(a, b.dir, step) < step) dead = true;
    else if (!kart.active) {
      const ab = nx.clone().sub(a), tt = clamp(new THREE.Vector3(P.x, P.y + 0.9, P.z).sub(a).dot(ab) / (ab.lengthSq() || 1), 0, 1), q = a.clone().addScaledVector(ab, tt);
      if (Math.hypot(q.x - P.x, q.z - P.z) < 0.5 && q.y > P.y && q.y < P.y + 1.85) { hurt(b.dmg * (q.y > P.y + 1.5 ? 1.5 : 1)); dead = true; }
    }
    if (dead) { scene.remove(b.m); bolts.splice(i, 1); } else b.m.position.copy(nx);
  }
}
function combatUpdate(dt, t) {
  P.cd = Math.max(0, P.cd - dt);
  if (P.atk) { P.atk.t += dt; if (!P.atk.hit && P.atk.t >= P.atk.hitAt) { P.atk.hit = true; meleeHit(P.atk); } if (P.atk.t >= P.atk.dur) P.atk = null; }
  if (cur.id === 'fps') {
    boltUpdate(dt); bloom = Math.max(0, bloom - dt * 2.2);
    if (reload.t > 0) { reload.t -= dt; if (reload.t <= 0) finishReload(); }
    const d = heldDef(); if (d && ptr.down[0] && d.auto && (ptr.locked || ptr.fail >= 3)) fire(false);
    for (const dr of drones) {
      if (!dr.alive) { dr.deadT = (dr.deadT || 0) + dt; if (dr.deadT > 9) dr.respawn(); continue; }
      if (dr.update(dt, t, P.x, P.z)) enemyShot(dr);
    }
    for (const l of loot) { l.mesh.rotation.y += dt * 1.5; l.mesh.position.y = 0.15 + Math.sin(l.t + t * 2) * 0.1; }
  }
}

/* ───────────── 부스 → 미니게임 → 결과 (기존 유지) ───────────── */
function openBooth(b) {
  const d = b.dept, C = COLLEGES[d.col], rec = S.played[d.id], box = el('div', 'intro');
  const li = (a) => a.map((t) => `<li>${t}</li>`).join('');
  box.innerHTML = `<span class="tag" style="background:${C.color}">${d.col === 'cre' ? '대학 직할 학부' : C.name}</span>
<h2>${d.icon} ${d.name}</h2>
    <div class="job">🎯 대표 직업: <b>${d.job}</b></div><p>${d.desc}</p>
    <h4>이런 자질이 필요해요</h4><ul>${li(d.quals)}</ul>
    <h4>졸업 후 진로 (리플렛 기준)</h4><ul>${li(d.careers)}</ul>
    ${d.facts && d.facts.length ? `<h4>알아두면 좋아요</h4><ul>${li(d.facts)}</ul>` : ''}
    <div class="meta">📍 여수캠퍼스 ${d.loc} · ☎ ${d.tel}</div>
    ${rec ? `<div class="best">내 최고 점수 ${rec.score}점 · ${'★'.repeat(rec.stars)}</div>` : ''}`;
  const row = el('div', 'row'), go = el('button', 'btn primary big', rec ? `🔁 다시 체험: ${d.game.title}` : `▶ 체험 시작: ${d.game.title}`), cl = el('button', 'btn', '닫기');
  go.onclick = () => startGame(b); cl.onclick = closeModal; row.append(go, cl); box.append(row); openM(box);
}
function startGame(b) {
  if (hasExperience(b.dept.id)) { closeModal(); setTimeout(() => beginExp(b), 0); return; }
  startClassic(b);
}
function beginExp(b) {
  playBgm(bgmForDept(b.dept.id));
  mode = 'exp'; ads = false; ptr.down[0] = ptr.down[2] = false; unlock();
  $('#hud').classList.add('hidden'); hx.style.display = 'none'; $('#prompt').style.display = 'none'; lastPrompt = '';
  P.char.group.visible = false;
  try {
    exp = startExperience(b.dept.id, {
      scene, camera, cvs, sun: WR.sun, hemi: WR.hemi, look: S.look, dept: b.dept,
      enter: (st) => applyEnv(st),
      finish: (score) => endExp(b, score),
      quit: () => endExp(b, null),
    });
  } catch (e) { console.error(e); exp = null; }
  if (!exp) { leaveExp(); toast('체험을 불러오지 못해 기본 체험으로 전환해요'); startClassic(b); }
}
function leaveExp() {
  playBgm(cur.id);
  if (exp) { exp.dispose(); exp = null; }
  applyEnv(cur); P.char.group.visible = true;
  $('#hud').classList.remove('hidden'); hx.style.display = 'block';
  camera.fov = 60; camera.updateProjectionMatrix(); camera.position.set(P.x, P.y + 6, P.z - 9);
  mode = 'play';
}
function endExp(b, score) {
  if (!exp) return; leaveExp();
  if (score == null) { toast('체험을 중단했어요. 언제든 다시 도전해요!'); return; }
  showResult(b, score, {});
}
function startClassic(b) {
  const d = b.dept, box = el('div', 'game-wrap'), head = el('div', 'game-head', `<span>${d.icon} ${d.name} · ${d.game.title}</span>`);
  const quit = el('button', 'btn ghost small', '나가기'); head.append(quit);
  const host = el('div', 'game-host'); box.append(head, host);
  let dispose = null, ended = false;
  openM(box, { wide: true, onClose: () => { if (dispose) { dispose(); dispose = null; } } });
  quit.onclick = closeModal;
  dispose = runGame(host, d.game, (score, extra) => { if (ended) return; ended = true; if (dispose) { dispose(); dispose = null; } showResult(b, score, extra || {}); });
}
function showResult(b, score, extra) {
  const d = b.dept; let stars = 3; const prev = S.played[d.id];
  const grade = score >= 90 ? '🏆 현직자 못지않아요!' : score >= 70 ? '👍 아주 잘했어요!' : score >= 50 ? '🙂 도전 성공!' : '🌱 다음엔 더 잘할 수 있어요!';
  const box = el('div', 'result', `<h2>${d.icon} ${d.name} 체험 완료</h2><div class="score">${score}<small>점</small></div><div class="grade">${grade}</div>
    <p>이 체험은 <b>${d.job}</b>의 일부를 간단히 맛본 거예요. 실제 업무는 훨씬 다양해요!</p><h4>얼마나 재미있었나요? (적성 힌트로 쓰여요)</h4>`);
  const st = el('div', 'stars'), paint = () => { st.innerHTML = ''; for (let i = 1; i <= 5; i++) { const s = el('button', 'star' + (i <= stars ? ' on' : ''), '★'); s.onclick = () => { stars = i; sfx.click(); paint(); }; st.append(s); } };
  paint(); box.append(st);
  const row = el('div', 'row'), ok = el('button', 'btn primary big', '💾 저장하고 계속'), again = el('button', 'btn', '🔁 다시 도전');
  ok.onclick = () => {
    S.played[d.id] = { score: Math.max(prev ? prev.score : 0, score), last: score, stars, traits: extra.traits || (prev ? prev.traits : null), plays: (prev ? prev.plays : 0) + 1 };
    if (!prev) { S.coins += score >= 70 ? 10 : 5; b.setDone(true); burst(b.x, 3, b.z); }
    save(S); hud(); sfx.win(); closeModal();
    const n = Object.keys(S.played).length;
    if (n === DEPTS.length) { toast('🎉 모든 부스를 체험했어요! 진로 리포트를 확인해 보세요.', 4000); setTimeout(showReport, 500); } else toast(`체험 ${n}/${DEPTS.length} 완료! 🪙 코인 +${score >= 70 ? 10 : 5}`);
  };
  again.onclick = () => startGame(b); row.append(ok, again); box.append(row); openM(box);
}

/* ───────────── 진로 리포트 (기존 유지) ───────────── */
function showReport() {
  const a = analyze(S);
  if (!a.count) { toast('먼저 부스에서 직업체험을 해 보세요!'); return; }
  const box = el('div', 'report', `<h2>📊 ${S.name || '탐험가'}님의 진로 리포트</h2>`), grid = el('div', 'rep-grid'), left = el('div'), right = el('div');
  const rc = el('canvas'); rc.width = rc.height = 340; left.append(rc, el('div', 'small', `체험 ${a.count}/${a.total}개 · 🪙 ${S.coins} · ⚽ ${S.goals}골`));
  let h = '<h4>🎓 나에게 어울리는 학과 TOP 3</h4>';
  a.top.forEach((r, i) => {
    const d = r.dept;
    h += `<div class="rec"><b>${i + 1}. ${d.icon} ${d.name}</b><span class="fit">적합도 ${r.fit}%</span><div>🎯 ${d.job} <small>(${d.col === 'cre' ? '대학 직할 학부' : COLLEGES[d.col].name})</small></div>
      <div class="why">${r.why.length ? r.why.join('·') + ' 성향과 잘 맞아요' : '체험 결과를 바탕으로 추천했어요'}${r.own ? ` · 체험 ${r.own.rec.score}점 ${'★'.repeat(r.own.rec.stars)}` : ' · 아직 체험하지 않은 학과예요!'}</div>
      <div><small>진출: ${d.careers.slice(0, 3).join(' / ')}</small></div></div>`;
  });
  h += '<h4>💼 관심 직업군</h4><ul>' + a.jobs.map((j) => `<li>${j.icon} <b>${j.job}</b> (${j.pct}%)<br><small>${j.eg}</small></li>`).join('') + '</ul>';
  if (a.best.length) h += '<h4>🏅 잘한 체험</h4><ul>' + a.best.map((r) => `<li>${r.d.icon} ${r.d.name} · ${r.rec.score}점</li>`).join('') + '</ul>';
  if (a.fav.length) h += `<h4>💖 가장 재미있었던 체험</h4><p>${a.fav.join(', ')}</p>`;
  h += '<h4>🌈 다음 단계 조언</h4><ul>';
  if (a.flat) h += '<li>아직 한 가지 방향으로 모이지 않았어요. 더 많은 부스를 체험해 보세요! 전공을 못 정했다면 <b>창의융합학부(대학 직할)</b>에서 1년간 다양한 전공을 경험하고 2학년 때 학과를 선택할 수도 있어요.</li>';
  h += '<li>수산해양대학은 <b>해양수산자율전공계열</b>, 공학대학은 <b>계열 모집/학과 모집</b>처럼 입학 방식이 달라요. 입학처(ao.jnu.ac.kr)에서 최신 모집 요강을 꼭 확인하세요.</li><li>학과 홈페이지·현직자 멘토링·학과 설명회로 이 결과를 다시 확인해 보세요.</li></ul>';
  right.innerHTML = h; grid.append(left, right); box.append(grid);
  const row = el('div', 'row'), png = el('button', 'btn', '🖼 이미지로 저장'), cl = el('button', 'btn primary', '계속 탐험하기');
  png.onclick = () => { const link = document.createElement('a'); link.href = reportPNG(a, S); link.download = '진로탐험_리포트.png'; link.click(); };
  cl.onclick = closeModal; row.append(png, cl); box.append(row);
  openM(box, { wide: true }); drawRadar(rc, a.norm);
}

/* ───────────── 메뉴 ───────────── */
function openMenu() {
  const box = el('div', 'menu', '<h2>⏸ 메뉴</h2>'); const btn = (t, f, cls = 'btn') => { const b = el('button', cls, t); b.style.cssText = 'display:block;width:100%;margin:6px 0'; b.onclick = f; box.append(b); return b; };
  btn('▶ 계속하기', closeModal, 'btn primary');
  btn('🎒 가방 (I)', () => { closeModal(); setTimeout(openInventory, 0); });
  btn('📊 내 진로 리포트', () => { closeModal(); setTimeout(showReport, 0); });
  if (cur.id !== 'campus') btn('🏫 캠퍼스로 돌아가기 (아이템 사라짐)', () => { closeModal(); changeWorld('campus'); });
  btn(`🔊 소리: ${isSoundOn() ? '켜짐' : '꺼짐'}`, () => { S.settings.sound = !isSoundOn(); setSound(S.settings.sound); save(S); closeModal(); });
  btn(`🎵 배경음악: ${bgmPct(getVol('bgm'))} (눌러서 변경)`, () => { cycleVol('bgm'); closeModal(); setTimeout(openMenu, 0); });
  btn(`🔔 효과음: ${bgmPct(getVol('sfx'))} (눌러서 변경)`, () => { cycleVol('sfx'); fx.ding(); closeModal(); setTimeout(openMenu, 0); });
  const sndTestBtn = btn('🔊 소리 테스트', () => { sndTestBtn.textContent = testSound(); });
    btn(`🖥 화질: ${QUALITIES[S.settings.q].label} (눌러서 변경)`, () => {
    const o = ['low', 'mid', 'high']; S.settings.q = o[(o.indexOf(S.settings.q) + 1) % 3];
    applyQuality(S.settings.q, renderer, WR.sun, S); save(S); closeModal(); toast(`화질: ${QUALITIES[S.settings.q].label}`);
  });
  btn(`🖱 마우스 감도: ×${S.settings.sens || 1}`, () => { const l = [0.6, 1, 1.5, 2], c = S.settings.sens || 1; S.settings.sens = l[(l.indexOf(c) + 1) % l.length]; save(S); closeModal(); toast(`마우스 감도 ×${S.settings.sens}`); });
  btn(`📱 터치 조작 화면: ${isTouch ? '켜짐' : '꺼짐'} (눌러서 바꾸기 · 새로고침)`, () => { try { localStorage.setItem('cq_touch', isTouch ? '0' : '1'); } catch (e) { /* 무시 */ } location.reload(); });
  btn('❓ 조작법', () => {
    const h = el('div', '', '<h2>❓ 조작법</h2><ul><li>WASD 이동 · Shift 달리기 · Space 점프 · 마우스 시점(화면 클릭 시 고정, Esc 해제)</li><li><b>좌클릭 잽 · 우클릭 강타</b> (공·훈련 샌드백·드론에 맞아요)</li><li>FPS 월드: 좌클릭 발사 · 우클릭 조준 · R 재장전 · V 1/3인칭 · F 줍기</li><li>I 가방(착용·해제·버리기) · 1~6 단축바 · E 상호작용/포털 · F 공 차기</li><li>카트: W/S 가속·후진, A/D 조향, Space 브레이크, ⚡패드 부스트</li><li>Tab 리포트(FPS에선 가방) · M 지도 크기 · Esc 메뉴 · F11 전체화면</li></ul>');
    if (isTouch) h.innerHTML = TOUCH_HELP;
    const c = el('button', 'btn primary', '닫기'); c.onclick = closeModal; h.append(c); openM(h);
  });
  btn('🗑 기록 초기화', () => { if (confirm('체험 기록과 코인을 모두 지울까요?')) { S = reset(true); WS.campus.booths.forEach((b) => b.setDone(false)); hud(); closeModal(); toast('기록을 초기화했어요.'); } });
  btn('🏠 타이틀로', () => location.reload());
  openM(box);
}

/* ───────────── 카트 / 레이스 (레이싱 월드) ───────────── */
function enterKart() {
  if (kart.active) return; kart.active = true; kart.group.add(P.char.group);
  P.char.group.position.set(0, 0.45, -0.15); P.char.group.rotation.set(0, 0, 0); P.char.group.scale.setScalar(0.7); P.char.sit(true);
  engine.start(); $('#speed').classList.remove('hidden');
}
function exitKart() {
  if (!kart.active) return; kart.active = false; kart.group.remove(P.char.group); scene.add(P.char.group); P.char.group.scale.setScalar(1); P.char.sit(false);
  P.x = kart.x + Math.cos(kart.yaw) * 2.8; P.z = kart.z - Math.sin(kart.yaw) * 2.8; P.y = 0; P.vx = P.vz = 0; P.yaw = kart.yaw; kart.v = 0;
  engine.stop(); $('#speed').classList.add('hidden'); placePlayer();
}
function openGarage() {
  const box = el('div', '', '<h2>🏎️ 레이싱 센터</h2><p>원형 서킷을 달려요! 노란 ⚡ 패드는 부스트, 코인은 줍기. 3바퀴 기록은 저장돼요.</p>');
  const a = el('button', 'btn primary big', '🏁 3랩 레이스 (AI 3대와 대결)'), b = el('button', 'btn big', '🚗 자유 주행');
  a.style.cssText = b.style.cssText = 'display:block;width:100%;margin:8px 0';
  a.onclick = () => { closeModal(); setTimeout(startRace, 0); }; b.onclick = () => { closeModal(); enterKart(); toast('WASD로 운전! E로 내리기'); };
  box.append(a, b); openM(box);
}
function startRace() {
  enterKart(); const th = -0.07, R = RW.TRACK_R; kart.place(R * Math.cos(th), R * Math.sin(th), -th); kart.frozen = true;
  const sp = [29.5 + rnd(-1, 1), 32.5 + rnd(-1, 1), 35 + rnd(-1, 1)], cols = ['#4c8dd9', '#47b5a2', '#c06bd8'];
  race = { state: 'cd', cd: 3.99, t: 0, prog: 0, lastTh: th, lap: 0, lapT: [], lapStart: 0,
    ai: [{ r: R - 5, th0: -0.12 }, { r: R + 5, th0: -0.12 }, { r: R, th0: -0.2 }].map((a, i) => { const m = makeKartMesh(cols[i]); WS.race.root.add(m); return { ...a, v: sp[i], m }; }) };
  race.ai.forEach((a) => { a.m.position.set(a.r * Math.cos(a.th0), 0, a.r * Math.sin(a.th0)); a.m.rotation.y = -a.th0; });
  $('#race-info').classList.remove('hidden');
}
function cleanupRace() {
  if (!race) return; race.ai.forEach((a) => a.m.parent && a.m.parent.remove(a.m)); race = null; kart.frozen = false;
  $('#race-info').classList.add('hidden'); $('#countdown').textContent = '';
}
const fmt = (t) => t.toFixed(1) + '초';
function raceUpdate(dt) {
  if (!race) return; const cd = $('#countdown');
  if (race.state === 'cd') {
    const before = Math.ceil(race.cd); race.cd -= dt; const n = Math.ceil(race.cd);
    if (n !== before && n > 0) sfx.beep(); cd.textContent = n > 0 ? n : 'GO!';
    if (race.cd <= 0) { race.state = 'run'; kart.frozen = false; sfx.go(); setTimeout(() => { cd.textContent = ''; }, 700); }
  } else if (race.state === 'run') {
    race.t += dt;
    const th = Math.atan2(kart.z, kart.x); let d = th - race.lastTh; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; race.lastTh = th;
    if (Math.abs(Math.hypot(kart.x, kart.z) - RW.TRACK_R) < 16) race.prog = Math.max(0, race.prog + d);
    race.ai.forEach((a) => { const ang = a.th0 + (a.v / a.r) * race.t; a.m.position.set(a.r * Math.cos(ang), 0, a.r * Math.sin(ang)); a.m.rotation.y = -ang; });
    const lapDone = Math.floor(race.prog / (Math.PI * 2));
    if (lapDone > race.lap) { race.lapT.push(race.t - race.lapStart); race.lapStart = race.t; race.lap = lapDone; sfx.ok(); toast(`랩 ${race.lap} 완료 ⏱ ${fmt(race.lapT[race.lapT.length - 1])}`); if (race.lap >= 3) { finishRace(); return; } }
    const rank = 1 + race.ai.filter((a) => (a.v / a.r) * race.t > race.prog).length;
    $('#race-info').textContent = `🏁 랩 ${Math.min(3, race.lap + 1)}/3 · ⏱ ${fmt(race.t)} · 순위 ${rank}/4`;
  }
}
function finishRace() {
  race.state = 'done'; kart.frozen = true; const T = race.t, rank = 1 + race.ai.filter((a) => (3 * Math.PI * 2 * a.r) / a.v < T).length;
  const best = Math.min(...race.lapT), reward = [30, 15, 8, 3][rank - 1]; S.coins += reward;
  if (!S.bestLap || best < S.bestLap) S.bestLap = best; if (!S.bestRace || T < S.bestRace) S.bestRace = T; save(S); hud(); sfx.win();
  const box = el('div', '', `<h2>🏁 레이스 종료!</h2><div class="score">${rank}<small>위</small></div><p style="text-align:center">총 기록 ${fmt(T)}<br>랩 타임 ${race.lapT.map(fmt).join(' / ')}<br>최고 랩 ${S.bestLap.toFixed(1)}초 · 🪙 +${reward}</p>`);
  const row = el('div', 'row'), re = el('button', 'btn primary', '🔁 다시 도전'), ok = el('button', 'btn', '자유 주행으로');
  re.onclick = () => { closeModal(); setTimeout(startRace, 0); }; ok.onclick = closeModal; row.append(re, ok); box.append(row);
  openM(box, { onClose: (rep) => { if (!rep && race) cleanupRace(); } });
}

/* ───────────── 매 프레임 갱신 ───────────── */
const NOINP = {};
function movePlayer(dt, t) {
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight'), sp = (run ? 9.5 : 5.2) * (ads ? 0.55 : 1), fp = cur.id === 'fps';
  const ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x, iz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + joy.y;
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), dx = sy * iz - cy * ix, dz = cy * iz + sy * ix, len = Math.hypot(dx, dz);
  let tvx = 0, tvz = 0;
  if (len > 0.05) { const m = Math.min(1, len); tvx = (dx / len) * sp * m; tvz = (dz / len) * sp * m;
  if (!fp && !P.atk) P.yaw = lerpAngle(P.yaw, Math.atan2(dx, dz), Math.min(1, 14 * dt)); }
  if (fp) P.yaw = view === 'fps' ? cam.yaw : lerpAngle(P.yaw, cam.yaw, Math.min(1, 16 * dt));
  P.vx += (tvx - P.vx) * Math.min(1, 12 * dt); P.vz += (tvz - P.vz) * Math.min(1, 12 * dt);
  P.x += P.vx * dt; P.z += P.vz * dt;
  if (keys.has('Space') && P.y <= 0.001) { P.vy = 8; sfx.click(); }
  P.vy -= 24 * dt; P.y += P.vy * dt; if (P.y < 0) { P.y = 0; P.vy = 0; }
  for (const c of cur.colliders) { const ddx = P.x - c.x, ddz = P.z - c.z, min = c.r + 0.45, d2 = ddx * ddx + ddz * ddz; if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; P.x = c.x + (ddx / d) * min; P.z = c.z + (ddz / d) * min; } }
  const r = Math.hypot(P.x, P.z); if (r > cur.limit) { P.x *= cur.limit / r; P.z *= cur.limit / r; }
  P.char.walk(t, clamp(Math.hypot(P.vx, P.vz) / 6, 0, 1.2)); P.char.tick(dt); placePlayer();
}
function driveKart(dt, active) {
  const k = keys;
  const inp = active ? { up: k.has('KeyW') || k.has('ArrowUp') || joy.y > 0.3, down: k.has('KeyS') || k.has('ArrowDown') || joy.y < -0.3, left: k.has('KeyA') || k.has('ArrowLeft') || joy.x < -0.3, right: k.has('KeyD') || k.has('ArrowRight') || joy.x > 0.3, brake: k.has('Space') } : NOINP;
  kart.update(dt, inp, cur.colliders, RW, () => sfx.bump());
  (cur.pads || []).forEach((p) => { if (Math.hypot(kart.x - p.x, kart.z - p.z) < 4.5 && kart.boost <= 0) { kart.boost = 1.6; sfx.boost(); } });
  engine.set(kart.v); $('#speed').textContent = `${Math.round(Math.abs(kart.v) * 3.6)} km/h`;
}
function updateCamera(dt) {
  const fp = cur.id === 'fps' && view === 'fps' && !kart.active;
  P.char.group.visible = !fp; if (vm) vm.visible = fp;
  if (fp) {
    camera.position.set(P.x, P.y + 1.62, P.z); const cp = Math.cos(cam.aim);
    camera.lookAt(P.x + Math.sin(cam.yaw) * cp, P.y + 1.62 + Math.sin(cam.aim), P.z + Math.cos(cam.yaw) * cp); return;
  }
  let tx, ty, tz;
  if (kart.active) { tx = kart.x; tz = kart.z; ty = 1.4; if (performance.now() - cam.lastDrag > 1500) cam.yaw = lerpAngle(cam.yaw, kart.yaw, Math.min(1, 2.2 * dt)); }
  else { tx = P.x; tz = P.z; ty = P.y + 1.5; if (mode === 'play') { if (keys.has('ArrowLeft')) cam.yaw += 1.8 * dt; if (keys.has('ArrowRight')) cam.yaw -= 1.8 * dt; } }
  const d = cam.dist * (kart.active ? 1.15 : 1), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const wx = tx - Math.sin(cam.yaw) * d * cp, wz = tz - Math.cos(cam.yaw) * d * cp, wy = ty + d * sp, k = Math.min(1, 10 * dt);
  camera.position.x += (wx - camera.position.x) * k; camera.position.y += (wy - camera.position.y) * k; camera.position.z += (wz - camera.position.z) * k;
  camera.lookAt(tx, ty + 0.3, tz);
}
function checkGoal(b, dt) {
  if (b.gc > 0) { b.gc -= dt; return; } const pt = WS.soccer.pitch;
  if (Math.abs(b.p.x - pt.x) < 4.2 && Math.abs(b.p.z - pt.z) > pt.hl + 0.2 && Math.abs(b.p.z - pt.z) < pt.hl + 3 && b.p.y < 3) {
    b.gc = 3; S.goals++; sfx.goal(); toast('⚽ 골~!! 🎉'); burst(b.p.x, 2, b.p.z); setTimeout(() => b.reset(), 1500); hud(); save(S);
  }
}
function update(dt, t) {
  if (mode === 'exp') { if (exp) exp.update(dt, t); touchSync({ mode }); return; }
  cur.update(dt, t);
  if (mode === 'title') {
    const a = t * 0.35; P.char.walk(t, 0); P.char.tick(dt); P.char.group.rotation.y = P.yaw;
    camera.position.set(P.x + Math.sin(a) * 4.6, 2.3, P.z + Math.cos(a) * 4.6); camera.lookAt(P.x, 1.4, P.z);
  } else {
    if (mode === 'play') { if (kart.active) driveKart(dt, true); else { movePlayer(dt, t); combatUpdate(dt, t); } }
    else if (kart.active) driveKart(dt, false); else { P.vx *= 0.8; P.vz *= 0.8; P.char.walk(t, 0); P.char.tick(dt); }
    raceUpdate(dt); updateCamera(dt);
    const tf = ads && heldDef() ? (heldDef().fam === 'SR' ? 26 : 42) : 60;
    if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, 12 * dt); camera.updateProjectionMatrix(); }
    if (vm) { vmK = Math.max(0, vmK - dt * 7); vm.position.set(ads ? 0.02 : 0.26, ads ? -0.2 : -0.24, -0.6 + vmK * 0.08); vm.rotation.x = vmK * 0.06; }
    const a = actor();
    (cur.coins || []).forEach((c) => { if (!c.got && Math.hypot(c.x - a.x, c.z - a.z) < 1.8) { c.got = true; c.mesh.visible = false; S.coins++; sfx.coin(); hud(); save(S); } });
    const it = mode === 'play' ? nearest() : null, txt = it ? it.label : '', pr = $('#prompt');
    if (txt !== lastPrompt) { lastPrompt = txt; pr.textContent = isTouch ? txt.replace(/^\[[EF]\]\s*/, '') : txt; pr.style.display = txt ? 'block' : 'none'; }
    ui.cross.style.display = mode === 'play' && cur.id === 'fps' && !kart.active ? 'block' : 'none'; ui.cross.classList.toggle('ads', ads);
    ui.hint.style.display = mode === 'play' && !ptr.locked && ptr.fail < 3 ? 'block' : 'none';
  }
  for (const dm of cur.dummies || []) { dm.wob = Math.max(0, (dm.wob || 0) - dt * 1.6); const w = dm.wob * 0.5 * Math.sin(t * 16); dm.mesh.rotation.z = w * Math.cos(dm.dir || 0); dm.mesh.rotation.x = w * Math.sin(dm.dir || 0); }
  for (const b of balls()) {
    b.update(dt, cur.colliders, cur.limit);
    if (mode !== 'title') { let kicked = false; if (kart.active) kicked = b.touch(kart.x, kart.z, Math.sin(kart.yaw) * kart.v, Math.cos(kart.yaw) * kart.v, 1.7); else kicked = b.touch(P.x, P.z, P.vx, P.vz, 0.5); if (kicked) sfx.kick(); }
    if (cur.id === 'soccer') checkGoal(b, dt);
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i]; p.life -= dt; const arr = p.m.geometry.attributes.position.array;
    for (let k = 0; k < p.n; k++) { p.vel[k * 3 + 1] -= 14 * dt; arr[k * 3] += p.vel[k * 3] * dt; arr[k * 3 + 1] += p.vel[k * 3 + 1] * dt; arr[k * 3 + 2] += p.vel[k * 3 + 2] * dt; }
    p.m.geometry.attributes.position.needsUpdate = true; p.m.material.opacity = Math.max(0, p.life);
    if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); bursts.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const q = tracers[i]; q.life -= dt; q.l.material.opacity = Math.max(0, q.life / 0.09);
    if (q.life <= 0) { scene.remove(q.l); q.l.geometry.dispose(); q.l.material.dispose(); tracers.splice(i, 1); }
  }
  const f = actor(), sp = cur.env.sunPos || [60, 90, 40]; WR.sun.position.set(f.x + sp[0], sp[1], f.z + sp[2]); WR.sun.target.position.set(f.x, 0, f.z);
  touchSync({ mode, world: cur.id, kart: kart.active, race: !!race, gun: cur.id === 'fps' && !!heldDef(), prompt: !!lastPrompt, ads });
  if (mode !== 'title' && ++frameN % 3 === 0) drawMini();
}

/* ───────────── 미니맵 (월드별) ───────────── */
const mini = $('#mini'), mx = mini.getContext('2d');
function drawMini() {
  const c = 170, R = cur.mapR || cur.limit + 8, sc = c / R, X = (x) => c + x * sc, Z = (z) => c + z * sc, dot = (x, z, r, col) => { mx.fillStyle = col; mx.beginPath(); mx.arc(X(x), Z(z), r, 0, 7); mx.fill(); };
  mx.clearRect(0, 0, 340, 340); mx.fillStyle = 'rgba(10,30,60,.75)'; mx.beginPath(); mx.arc(c, c, c - 2, 0, 7); mx.fill();
  if (cur.id === 'campus') {
    for (const [cid, C] of Object.entries(COLLEGES)) { if (cid === 'cre') continue; mx.beginPath(); mx.arc(c, c, 84 * sc, rad(C.a0), rad(C.a1)); mx.arc(c, c, 30 * sc, rad(C.a1), rad(C.a0), true); mx.closePath(); mx.fillStyle = C.color + '99'; mx.fill(); }
    cur.booths.forEach((b) => dot(b.x, b.z, 3.5, b.done ? '#4be37a' : '#ffffff'));
    dot(0, -12, 5, '#0a8a3a');
    const cb = cur.booths.find((b) => b.dept.col === 'cre');
    if (cb) { mx.strokeStyle = '#b79bff'; mx.lineWidth = 2; mx.beginPath(); mx.arc(X(cb.x), Z(cb.z), 7, 0, 7); mx.stroke(); }
  } else if (cur.id === 'race') {
    mx.strokeStyle = '#6a6e78'; mx.lineWidth = RW.TRACK_W * sc; mx.beginPath(); mx.arc(c, c, RW.TRACK_R * sc, 0, 7); mx.stroke(); mx.fillStyle = '#fff'; mx.fillRect(X(RW.TRACK_R) - 7 * sc, c - 1, 14 * sc, 2);
  } else if (cur.id === 'soccer') {
    const p = cur.pitch; mx.fillStyle = '#4f9a4a'; mx.fillRect(X(p.x - p.hw), Z(p.z - p.hl), p.hw * 2 * sc, p.hl * 2 * sc);
  } else if (cur.id === 'fps') {
    cur.colliders.forEach((q) => dot(q.x, q.z, 1.5, '#8a93a3')); loot.forEach((l) => dot(l.x, l.z, 2.5, '#ffd24a')); drones.forEach((d) => { if (d.alive) dot(d.x, d.z, 3, '#ff6b6b'); });
  }
  cur.portals.forEach((p) => dot(p.x, p.z, 5, '#c58bff'));
  balls().forEach((b, i) => dot(b.p.x, b.p.z, i === 0 ? 3 : 2, i === 0 ? '#ffd24a' : '#fff'));
  const a = actor(), yaw = kart.active ? kart.yaw : P.yaw;
  mx.save(); mx.translate(X(a.x), Z(a.z)); mx.rotate(Math.PI / 2 - yaw); mx.fillStyle = '#ff4d4d'; mx.beginPath(); mx.moveTo(8, 0); mx.lineTo(-6, 5); mx.lineTo(-6, -5); mx.closePath(); mx.fill(); mx.restore();
}

/* ───────────── 시작 ───────────── */
applyEnv(cur); buildPlayer(); interactables = buildInteractables(); buildCust(); updateBar(); updateAmmo(); updateHp(); ui.wtag.textContent = `${WORLDS.campus.icon} ${WORLDS.campus.name}`;
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame); const dt = Math.min(clock.getDelta(), 0.05);
  update(dt, clock.elapsedTime); tickDisplay(renderer, S.settings.q); renderer.render(scene, camera);
  const l = $('#loading'); if (l) l.remove();
}
frame();