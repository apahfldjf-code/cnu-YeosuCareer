/* ═══════════════════════════════════════════════════════════════
 * src/core.js  v2 (3단계) — 오디오 · 저장 · UI · 캐릭터 · 공 · 카트 · 인벤토리 · 드론 · 총기/아이템 모델
 *
 * [유지] load save reset sfx engine setSound isSoundOn tone DEFAULT_LOOK SKINS HAIRC UNIFORMS BAGS HAIRSTYLES
 *        Ball Kart makeKartMesh $ el toast openModal closeModal isModalOpen
 * [추가] CUSTOM randomLook Inventory Drone makeItemMesh makeGunMesh   (game.js v2 가 import)
 *
 * [data.js 에 필요한 값]  ITEMS[id] = { type, rarity(1~4), fam('AR'|'SMG'|'SR'|'SG'|'HG'), ammo, amt, mag, slots, heal, reduce ... }
 *   - 총기 모양은 def.fam 으로 정합니다. fam 이 위 5개가 아니면 def.ammo 로 대신합니다.
 *   - 가방 칸 수: 기본 6칸 + 가방 아이템의 slots
 *
 * [참고] 실제 총기 이름·피 표현 없음. 드론은 파괴 시 전기 불꽃 연출만 game.js 가 처리합니다.
 * [참고] 저장 키는 v1 과 같아서 이전 기록·코인이 그대로 유지됩니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { ITEMS } from './data.js';
import { ac as _ac, setEnabled as _setEn, sfxOut } from './audio.js';
import { rbox, rcyl, rsph, rboxChar } from './round.js';
import { createCharacter, CUSTOM, randomLook, DEFAULT_LOOK, SKINS, HAIRC, UNIFORMS, BAGS, HAIRSTYLES, setGunMaker } from './character.js';
export { createCharacter, CUSTOM, randomLook, DEFAULT_LOOK, SKINS, HAIRC, UNIFORMS, BAGS, HAIRSTYLES };
setGunMaker((def) => makeGunMesh(def));


const HP = Math.PI / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────── 오디오 (WebAudio 합성, 별도 음원 파일 불필요) ───────────── */
let soundOn = true, eng = null;
function ac() { return _ac(); }
export function setSound(v) { soundOn = v; _setEn(v); if (!v) engine.stop(); }

export function isSoundOn() { return soundOn; }
export function tone(f = 600, d = 0.12, type = 'sine', v = 0.07, f2 = null, delay = 0) {
  if (!soundOn) return; const c = ac(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(sfxOut(c)); o.start(t); o.stop(t + d + 0.03);
}
function noise(d = 0.1, v = 0.1, fc = 2000, delay = 0) {
  if (!soundOn) return; const c = ac(); if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = 'lowpass'; f.frequency.value = fc; g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(sfxOut(c)); s.start(c.currentTime + delay);
}
export const sfx = {
  click: () => tone(520, 0.07, 'square', 0.04),
  coin: () => { tone(880, 0.08, 'triangle', 0.06); tone(1320, 0.12, 'triangle', 0.06, null, 0.07); },
  kick: () => tone(170, 0.14, 'sine', 0.12, 60),
  ok: () => [523, 659, 784].forEach((f, i) => tone(f, 0.15, 'triangle', 0.07, null, i * 0.09)),
  bad: () => tone(180, 0.22, 'sawtooth', 0.05, 90),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, null, i * 0.12)),
  bump: () => tone(110, 0.15, 'square', 0.07, 50),
  beep: () => tone(660, 0.12, 'square', 0.06),
  go: () => tone(990, 0.4, 'square', 0.07),
  boost: () => tone(300, 0.45, 'sawtooth', 0.05, 900),
  goal: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, null, i * 0.08)),
  /* v2 추가 */
  swing: () => { noise(0.12, 0.05, 1800); tone(320, 0.12, 'sawtooth', 0.03, 120); },
  hit: () => { tone(230, 0.09, 'square', 0.08, 90); noise(0.06, 0.06, 1500); },
  shoot: (fam) => {
    switch (fam) {
      case 'SMG': noise(0.05, 0.09, 3600); tone(260, 0.05, 'square', 0.05, 110); break;
      case 'SR': noise(0.28, 0.2, 1400); tone(90, 0.3, 'sawtooth', 0.1, 38); break;
      case 'SG': noise(0.22, 0.2, 1100); tone(110, 0.2, 'sawtooth', 0.1, 45); break;
      case 'HG': noise(0.06, 0.1, 3000); tone(210, 0.07, 'square', 0.05, 90); break;
      default: noise(0.08, 0.12, 2500); tone(160, 0.08, 'square', 0.06, 60);
    }
  },
  reload: () => { tone(900, 0.04, 'square', 0.04); tone(520, 0.05, 'square', 0.05, null, 0.35); tone(760, 0.04, 'square', 0.04, null, 0.75); },
  empty: () => tone(1200, 0.03, 'square', 0.04),
  pickup: () => { tone(700, 0.06, 'triangle', 0.06); tone(1000, 0.09, 'triangle', 0.06, null, 0.06); },
  equip: () => { tone(400, 0.05, 'square', 0.05); tone(620, 0.06, 'square', 0.05, null, 0.06); },
  hurt: () => { tone(160, 0.18, 'sawtooth', 0.08, 70); noise(0.08, 0.05, 800); },
  heal: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, null, i * 0.08)),
  portal: () => { tone(240, 0.7, 'sine', 0.08, 1300); tone(480, 0.7, 'triangle', 0.04, 1900, 0.05); },
  boom: () => { noise(0.45, 0.2, 700); tone(85, 0.4, 'sine', 0.14, 30); },
  zap: () => tone(1500, 0.09, 'sawtooth', 0.04, 480),
};
export const engine = {
  start() { if (!soundOn || eng) return; const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 55; g.gain.value = 0.05; o.connect(g); g.connect(sfxOut(c)); o.start(); eng = { o, g }; },
  set(speed) { if (eng) eng.o.frequency.value = 55 + Math.abs(speed) * 2.6; },
  stop() { if (eng) { try { eng.o.stop(); } catch (e) { /* ignore */ } eng = null; } },
};

/* ───────────── 저장(localStorage) — v1 과 같은 키 ───────────── */
const KEY = 'jnu_yeosu_career_quest_v1';
const fresh = () => ({ name: '', look: { ...DEFAULT_LOOK }, played: {}, coins: 0, goals: 0, kills: 0, bestLap: null, bestRace: null, settings: { sound: true, shadow: true, sens: 1 } });
export function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return fresh();
    const s = JSON.parse(raw), f = fresh();
    return { ...f, ...s, look: { ...f.look, ...(s.look || {}) }, settings: { ...f.settings, ...(s.settings || {}) } };
  } catch (e) { return fresh(); }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function reset(keepLook) {
  const old = load(), s = fresh();
  if (keepLook) { s.name = old.name; s.look = old.look; s.settings = old.settings; }
  save(s); return s;
}

/* ───────────── UI 헬퍼 ───────────── */
export const $ = (s, r = document) => r.querySelector(s);
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
let toastT = null;
export function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
let curModal = null;
export function openModal(content, { wide = false, onClose = null } = {}) {
  const prev = curModal; curModal = null;
  if (prev && prev.onClose) prev.onClose(true);
  const box = $('#modal-box'); box.innerHTML = ''; box.className = wide ? 'wide' : ''; box.append(content);
  $('#modal').classList.remove('hidden'); box.scrollTop = 0; curModal = { onClose };
}
export function closeModal() {
  if (!curModal) return; const c = curModal; curModal = null;
  $('#modal').classList.add('hidden'); $('#modal-box').innerHTML = '';
  if (c.onClose) c.onClose(false);
}
export const isModalOpen = () => !!curModal;

/* ───────────── 3D 공용 도우미 ───────────── */
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.02, ...o });
const bx = (w, h, d, m) => new THREE.Mesh(rboxChar(w, h, d), m);
const sp = (r, m, a = 18, b = 14) => new THREE.Mesh(rsph(r, a, b), m);
const put = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
const zcyl = (p, r, len, m, x, y, z) => { const o = new THREE.Mesh(rcyl(r, r, len, 10), m); o.rotation.x = HP; return put(p, o, x, y, z); };
const shade = (c, a) => new THREE.Color(c).offsetHSL(0, 0, a);
const RARC = ['#9aa5b5', '#4fbf6a', '#4c8dd9', '#b06cf0'];
const rc = (d) => RARC[clamp(((d && d.rarity) || 1) - 1, 0, 3)];
const FAMS = ['AR', 'SMG', 'SR', 'SG', 'HG'];
const famOf = (d) => (d && FAMS.includes(d.fam) ? d.fam : d && FAMS.includes(d.ammo) ? d.ammo : 'AR');

/* ───────────── 총기 모델 (실제 모델명 없음: 계열별 모양) ─────────────
 * 총구가 +Z 방향, 원점이 손잡이 부근. game.js 는 카메라에 붙일 때 rotation.y = π 로 돌려 씁니다. */
export function makeGunMesh(def) {
  const g = new THREE.Group(), f = famOf(def), ac = rc(def);
  const body = mat('#2f343d', { metalness: 0.5, roughness: 0.45 }), metal = mat('#555c68', { metalness: 0.7, roughness: 0.35 }), blk = mat('#16181d'), wood = mat('#7a5230');
  const acc = new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 0.6 });
  const grip = (x, y, z, rx) => { const o = bx(0.05, 0.13, 0.06, blk); o.rotation.x = rx; return put(g, o, x, y, z); };
  if (f === 'SMG') {
    put(g, bx(0.07, 0.1, 0.34, body), 0, 0.02, 0.1); zcyl(g, 0.02, 0.2, metal, 0, 0.03, 0.38); zcyl(g, 0.032, 0.18, blk, 0, 0.03, 0.55);
    put(g, bx(0.04, 0.04, 0.22, body), 0, 0.0, -0.18); put(g, bx(0.05, 0.06, 0.03, blk), 0, 0.0, -0.3);
    grip(0, -0.1, 0.0, 0.3); put(g, bx(0.045, 0.26, 0.06, blk), 0, -0.19, 0.16); put(g, bx(0.03, 0.03, 0.2, metal), 0, 0.085, 0.12); put(g, bx(0.074, 0.015, 0.14, acc), 0, 0.07, 0.2);
  } else if (f === 'SR') {
    put(g, bx(0.06, 0.1, 0.4, body), 0, 0.02, 0.05); zcyl(g, 0.018, 0.7, metal, 0, 0.03, 0.6); zcyl(g, 0.026, 0.08, blk, 0, 0.03, 0.97);
    put(g, bx(0.07, 0.14, 0.38, wood), 0, -0.01, -0.28); put(g, bx(0.075, 0.04, 0.2, acc), 0, 0.07, -0.3);
    zcyl(g, 0.035, 0.26, blk, 0, 0.12, 0.08); const l1 = zcyl(g, 0.04, 0.02, mat('#6fb7ff', { emissive: '#2a6fb0', emissiveIntensity: 0.6 }), 0, 0.12, 0.22);
    put(g, bx(0.02, 0.05, 0.03, metal), 0, 0.085, 0.0); put(g, bx(0.02, 0.05, 0.03, metal), 0, 0.085, 0.16);
    put(g, bx(0.012, 0.18, 0.012, metal), 0.04, -0.06, 0.78).rotation.z = -0.4; put(g, bx(0.012, 0.18, 0.012, metal), -0.04, -0.06, 0.78).rotation.z = 0.4;
    put(g, sp(0.02, metal, 6, 4), 0.05, 0.03, -0.02); grip(0, -0.1, -0.04, 0.3); put(g, bx(0.04, 0.08, 0.1, blk), 0, -0.1, 0.12); l1.name = 'lens';
  } else if (f === 'SG') {
    put(g, bx(0.07, 0.1, 0.3, body), 0, 0.02, 0.0); zcyl(g, 0.028, 0.72, metal, 0, 0.04, 0.5); zcyl(g, 0.022, 0.5, metal, 0, -0.025, 0.4);
    put(g, bx(0.07, 0.05, 0.18, wood), 0, -0.03, 0.42); put(g, bx(0.06, 0.12, 0.3, wood), 0, -0.01, -0.3); put(g, bx(0.074, 0.015, 0.12, acc), 0, 0.075, 0.05); grip(0, -0.1, -0.06, 0.3);
  } else if (f === 'HG') {
    put(g, bx(0.05, 0.07, 0.26, body), 0, 0.045, 0.1); put(g, bx(0.045, 0.04, 0.22, blk), 0, -0.005, 0.1); zcyl(g, 0.012, 0.05, metal, 0, 0.05, 0.25);
    grip(0, -0.07, -0.02, 0.25); put(g, bx(0.01, 0.04, 0.06, blk), 0, -0.03, 0.08); put(g, bx(0.052, 0.012, 0.1, acc), 0, 0.085, 0.1);
  } else {
    put(g, bx(0.07, 0.11, 0.5, body), 0, 0.02, 0.12); put(g, bx(0.08, 0.08, 0.28, blk), 0, 0.015, 0.5); zcyl(g, 0.017, 0.3, metal, 0, 0.03, 0.78); zcyl(g, 0.026, 0.06, blk, 0, 0.03, 0.95);
    put(g, bx(0.06, 0.13, 0.26, blk), 0, -0.01, -0.26); put(g, bx(0.065, 0.14, 0.03, metal), 0, -0.01, -0.4);
    grip(0, -0.1, 0.0, 0.3); const mg = bx(0.05, 0.2, 0.08, blk); mg.rotation.x = -0.15; put(g, mg, 0, -0.15, 0.2);
    put(g, bx(0.03, 0.04, 0.3, metal), 0, 0.085, 0.15); put(g, bx(0.02, 0.05, 0.02, metal), 0, 0.085, 0.92); put(g, bx(0.074, 0.015, 0.2, acc), 0, 0.07, 0.3);
  }
  return g;
}

/* ───────────── 바닥 아이템 모델 ───────────── */
const AMMOC = { AR: '#d9b34a', SMG: '#4c8dd9', SR: '#e0533d', SG: '#d94f6a', HG: '#47b5a2' };
export function makeItemMesh(def) {
  const g = new THREE.Group(), c = rc(def), cm = mat(c, { roughness: 0.5 });
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8 })); ringM.rotation.x = HP; ringM.position.y = -0.1; g.add(ringM);
  const T = def && def.type;
  if (T === 'weapon') { const gn = makeGunMesh(def); gn.scale.setScalar(1.5); gn.position.set(0, 0.5, -0.45); g.add(gn); }
  else if (T === 'helmet') { put(g, new THREE.Mesh(rsph(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(c, { roughness: 0.4, metalness: 0.2 })), 0, 0.45, 0); put(g, bx(0.4, 0.05, 0.05, blkM()), 0, 0.5, 0.28); }
  else if (T === 'vest') { put(g, bx(0.6, 0.55, 0.3, mat(shade(c, -0.22))), 0, 0.5, 0); put(g, bx(0.2, 0.08, 0.26, mat(shade(c, -0.22))), 0.3, 0.8, 0); put(g, bx(0.2, 0.08, 0.26, mat(shade(c, -0.22))), -0.3, 0.8, 0); put(g, bx(0.4, 0.06, 0.32, cm), 0, 0.35, 0); }
  else if (T === 'pack') { const k = 1 + Math.min(0.4, ((def.slots || 4) - 4) * 0.05); put(g, bx(0.5 * k, 0.62 * k, 0.3, mat(shade(c, -0.2))), 0, 0.5, 0); put(g, bx(0.36 * k, 0.22, 0.08, cm), 0, 0.38, 0.18); put(g, bx(0.1, 0.12, 0.1, cm), 0.3, 0.35, 0); put(g, bx(0.1, 0.12, 0.1, cm), -0.3, 0.35, 0); }
  else if (T === 'heal') {
    const k = (def.heal || 30) <= 25 ? 0.75 : 1; put(g, bx(0.5 * k, 0.3 * k, 0.34 * k, mat('#f6f7f9')), 0, 0.3, 0);
    put(g, bx(0.26 * k, 0.02, 0.07 * k, mat('#e0302a')), 0, 0.46 * k + 0.0, 0).position.y = 0.3 + 0.15 * k + 0.01; put(g, bx(0.07 * k, 0.02, 0.26 * k, mat('#e0302a')), 0, 0.3 + 0.15 * k + 0.012, 0);
  } else if (T === 'ammo') {
    put(g, bx(0.5, 0.26, 0.34, mat('#56633a')), 0, 0.25, 0); put(g, bx(0.52, 0.06, 0.1, mat(AMMOC[def.ammo] || '#d9b34a')), 0, 0.3, 0.17);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(rcyl(0.035, 0.035, 0.16, 8), mat('#d9b34a', { metalness: 0.6, roughness: 0.3 })); put(g, b, -0.15 + i * 0.1, 0.46, 0); }
  } else put(g, sp(0.25, cm), 0, 0.4, 0);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
const blkM = () => mat('#16181d');

/* ───────────── 인벤토리 ───────────── */
const BASE_CAP = 6;
export class Inventory {
  constructor() { this.clear(); }
  clear() {
    this.bag = []; this.equip = { main: null, sub: null, helmet: null, vest: null, pack: null };
    this.ammo = { AR: 0, SMG: 0, SR: 0, SG: 0, HG: 0 }; this.active = 'fist';
  }
  cap() { const p = this.equip.pack, d = p && ITEMS[p.id]; return BASE_CAP + (d ? d.slots || 0 : 0); }
  isEmpty() { return !this.bag.length && !Object.values(this.equip).some(Boolean) && !Object.values(this.ammo).some((v) => v > 0); }
  add(id, n = 1, mag) {
    const d = ITEMS[id]; if (!d) return { ok: false, msg: '알 수 없는 아이템이에요' };
    if (d.type === 'ammo') { this.ammo[d.ammo] = (this.ammo[d.ammo] || 0) + (d.amt || 10) * n; return { ok: true }; }
    if (d.type === 'heal') { const e = this.bag.find((b) => b.id === id); if (e) { e.n += n; return { ok: true }; } }
    if (this.bag.length >= this.cap()) return { ok: false, msg: '가방이 가득 찼어요' };
    const e = { id, n: d.type === 'heal' ? n : 1 }; if (d.type === 'weapon') e.mag = mag != null ? mag : d.mag;
    this.bag.push(e); return { ok: true };
  }
  wear(i) {
    const e = this.bag[i]; if (!e) return null; const d = ITEMS[e.id]; let slot = null;
    if (d.type === 'weapon') slot = !this.equip.main ? 'main' : !this.equip.sub ? 'sub' : (this.active === 'sub' ? 'sub' : 'main');
    else if (d.type === 'helmet' || d.type === 'vest' || d.type === 'pack') slot = d.type; else return null;
    const old = this.equip[slot];
    if (slot === 'pack') { const nc = BASE_CAP + (d.slots || 0); if (this.bag.length - (old ? 0 : 1) > nc) return null; }
    this.bag.splice(i, 1);
    if (old) this.bag.splice(i, 0, { id: old.id, n: 1, ...(old.mag != null ? { mag: old.mag } : {}) });
    this.equip[slot] = { id: e.id, ...(e.mag != null ? { mag: e.mag } : {}) };
    if ((slot === 'main' || slot === 'sub') && this.active === 'fist') this.active = slot;
    return slot;
  }
  takeOff(slot) {
    const e = this.equip[slot]; if (!e) return false;
    const room = slot === 'pack' ? BASE_CAP : this.cap(); if (this.bag.length >= room) return false;
    this.bag.push({ id: e.id, n: 1, ...(e.mag != null ? { mag: e.mag } : {}) }); this.equip[slot] = null;
    if (this.active === slot) this.active = this.equip.main ? 'main' : this.equip.sub ? 'sub' : 'fist';
    return true;
  }
  dropAt(i) { const e = this.bag[i]; if (!e) return null; this.bag.splice(i, 1); return e; }
  useAt(i) {
    const e = this.bag[i]; if (!e) return null; const d = ITEMS[e.id]; if (d.type !== 'heal') return null;
    e.n--; if (e.n <= 0) this.bag.splice(i, 1); return d;
  }
  weapon() { return this.active === 'main' || this.active === 'sub' ? this.equip[this.active] : null; }
  armor() { const h = this.equip.helmet, v = this.equip.vest; return { helmet: h ? ITEMS[h.id] : null, vest: v ? ITEMS[v.id] : null }; }
}

/* ───────────── 훈련 드론 (피 표현 없음 · 파괴 시 코인) ───────────── */
const DK = {
  scout: { s: 0.7, hp: 30, dmg: 4, speed: 7, pref: 11, detect: 42, range: 46, rate: 1.3, leash: 40, col: '#4fd1a5', hover: 2.0 },
  guard: { s: 1.0, hp: 70, dmg: 7, speed: 4.4, pref: 15, detect: 34, range: 42, rate: 1.0, leash: 30, col: '#f2b84b', hover: 2.3 },
  heavy: { s: 1.5, hp: 160, dmg: 12, speed: 2.6, pref: 19, detect: 30, range: 50, rate: 1.8, leash: 22, col: '#8e5cf2', hover: 2.8 },
};
export class Drone {
  constructor(parent, { x = 0, z = 0, kind = 'scout' } = {}) {
    const K = DK[kind] || DK.scout; this.K = K; this.kind = kind; this.home = { x, z }; this.x = x; this.z = z;
    this.r = K.s; this.dmg = K.dmg; this.maxHp = K.hp; this.hp = K.hp; this.alive = true; this.y = K.hover;
    this.yaw = Math.random() * 6.28; this.ph = Math.random() * 6.28; this.cd = 1 + Math.random() * 2; this.charge = 0; this.alert = 0; this.flashT = 0; this.wt = 0; this.tgt = { x, z };
    const S = K.s, m = new THREE.Group(); this.mesh = m; parent.add(m);
    this.body = new THREE.Group(); m.add(this.body);
    this.hullM = new THREE.MeshStandardMaterial({ color: '#e9eef5', roughness: 0.4, metalness: 0.3, emissive: '#ff3322', emissiveIntensity: 0 });
    const colM = new THREE.MeshStandardMaterial({ color: K.col, roughness: 0.4, metalness: 0.2 }), darkM = mat('#2a2f3a', { metalness: 0.5 });
    const hull = sp(0.5 * S, this.hullM, 16, 12); hull.scale.y = 0.62; hull.castShadow = true; this.body.add(hull);
    const dome = new THREE.Mesh(rsph(0.46 * S, 16, 8, 0, Math.PI * 2, 0, HP), colM); dome.position.y = 0.06 * S; dome.scale.y = 0.7; this.body.add(dome);
    const belly = sp(0.34 * S, darkM, 12, 8); belly.position.y = -0.17 * S; belly.scale.y = 0.5; this.body.add(belly);
    this.eyeM = new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#4fd0ff', emissiveIntensity: 1.4 });
    const eye = sp(0.15 * S, this.eyeM, 12, 8); eye.position.set(0, 0.02 * S, 0.45 * S); this.body.add(eye);
    const er = new THREE.Mesh(new THREE.TorusGeometry(0.17 * S, 0.025 * S, 6, 16), darkM); er.position.copy(eye.position); this.body.add(er);
    const an = new THREE.Mesh(rcyl(0.01 * S, 0.01 * S, 0.3 * S, 5), darkM); an.position.set(0.15 * S, 0.45 * S, -0.1 * S); this.body.add(an);
    this.rot = [];
    const rm = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * HP, ax = Math.cos(a) * 0.62 * S, az = Math.sin(a) * 0.62 * S;
      const arm = bx(0.06 * S, 0.05 * S, 0.62 * S, darkM); arm.position.set(ax / 2, 0.04 * S, az / 2); arm.rotation.y = -a + HP; this.body.add(arm);
      const hub = new THREE.Mesh(rcyl(0.06 * S, 0.06 * S, 0.1 * S, 8), colM); hub.position.set(ax, 0.1 * S, az); this.body.add(hub);
      const disc = new THREE.Mesh(rcyl(0.34 * S, 0.34 * S, 0.012, 20), rm); disc.position.set(ax, 0.17 * S, az); this.body.add(disc); this.rot.push(disc);
    }
    if (kind === 'guard') for (const sx of [-1, 1]) { const pod = bx(0.12 * S, 0.14 * S, 0.34 * S, colM); pod.position.set(sx * 0.5 * S, -0.05 * S, 0.1 * S); this.body.add(pod); }
    if (kind === 'heavy') {
      for (const sx of [-1, 1]) { const pl = bx(0.1 * S, 0.3 * S, 0.5 * S, colM); pl.position.set(sx * 0.48 * S, 0, 0); this.body.add(pl); const cn = new THREE.Mesh(rcyl(0.05 * S, 0.05 * S, 0.5 * S, 8), darkM); cn.rotation.x = HP; cn.position.set(sx * 0.3 * S, -0.16 * S, 0.4 * S); this.body.add(cn); }
    }
    this.barC = document.createElement('canvas'); this.barC.width = 64; this.barC.height = 8;
    this.barT = new THREE.CanvasTexture(this.barC); this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.barT, transparent: true, depthWrite: false, fog: false }));
    this.bar.scale.set(1.5 * S + 0.4, 0.2, 1); this.bar.position.y = 0.85 * S + 0.3; this.bar.visible = false; m.add(this.bar);
    m.position.set(x, this.y, z); this.drawBar();
  }
  drawBar() {
    const c = this.barC.getContext('2d'); c.clearRect(0, 0, 64, 8); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, 64, 8);
    const p = clamp(this.hp / this.maxHp, 0, 1); c.fillStyle = p > 0.5 ? '#3fd17a' : p > 0.25 ? '#f2b84b' : '#e0533d'; c.fillRect(1, 1, 62 * p, 6); this.barT.needsUpdate = true;
  }
  center() { return new THREE.Vector3(this.x, this.y, this.z); }
  update(dt, t, px, pz) {
    if (!this.alive) return false; const K = this.K;
    this.rot.forEach((r, i) => { r.rotation.y += dt * 32 * (i % 2 ? 1 : -1); });
    if (this.flashT > 0) { this.flashT -= dt; this.hullM.emissiveIntensity = Math.max(0, this.flashT / 0.15); }
    this.alert = Math.max(0, this.alert - dt); this.cd -= dt;
    const dx = px - this.x, dz = pz - this.z, dist = Math.hypot(dx, dz) || 0.001, aggro = dist < K.detect || this.alert > 0;
    let mx = 0, mz = 0, want = this.yaw;
    if (aggro) {
      const nx = dx / dist, nz = dz / dist; let rad = 0; if (dist > K.pref + 2) rad = 1; else if (dist < K.pref - 3) rad = -1;
      const sd = Math.sin(t * 0.8 + this.ph); mx = nx * rad - nz * sd * 0.7; mz = nz * rad + nx * sd * 0.7; want = Math.atan2(dx, dz);
      const hx = this.home.x - this.x, hz = this.home.z - this.z, hd = Math.hypot(hx, hz); if (hd > K.leash) { mx = hx / hd; mz = hz / hd; }
    } else {
      this.wt -= dt; if (this.wt <= 0) { this.wt = 3 + Math.random() * 3; const a = Math.random() * 6.28, r = Math.random() * 8; this.tgt = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
      const hx = this.tgt.x - this.x, hz = this.tgt.z - this.z, hd = Math.hypot(hx, hz); if (hd > 1) { mx = (hx / hd) * 0.4; mz = (hz / hd) * 0.4; want = Math.atan2(hx, hz); }
    }
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    this.x += mx * K.speed * dt; this.z += mz * K.speed * dt;
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.yaw += d * Math.min(1, 6 * dt);
    this.y = K.hover + Math.sin(t * 2 + this.ph) * 0.12;
    this.mesh.position.set(this.x, this.y, this.z); this.mesh.rotation.y = this.yaw;
    const fwd = mx * Math.sin(this.yaw) + mz * Math.cos(this.yaw), sd2 = mx * Math.cos(this.yaw) - mz * Math.sin(this.yaw);
    this.body.rotation.x += (fwd * 0.22 - this.body.rotation.x) * Math.min(1, 6 * dt); this.body.rotation.z += (sd2 * 0.22 - this.body.rotation.z) * Math.min(1, 6 * dt);
    if (aggro && dist < K.range && this.cd <= 0) {
      this.charge += dt; this.eyeM.color.set('#ff6b5a'); this.eyeM.emissive.set('#ff3322');
      if (this.charge >= 0.45) { this.charge = 0; this.cd = K.rate * (0.8 + Math.random() * 0.5); this.eyeM.color.set('#7fe3ff'); this.eyeM.emissive.set('#4fd0ff'); return true; }
    } else if (this.charge > 0) { this.charge = 0; this.eyeM.color.set('#7fe3ff'); this.eyeM.emissive.set('#4fd0ff'); }
    return false;
  }
  hit(dmg) {
    if (!this.alive) return false; this.hp -= dmg; this.flashT = 0.15; this.alert = 8; this.bar.visible = true; this.drawBar();
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.mesh.visible = false; return true; }
    return false;
  }
  respawn() {
    this.hp = this.maxHp; this.alive = true; this.x = this.home.x; this.z = this.home.z; this.y = this.K.hover; this.alert = 0; this.charge = 0; this.cd = 1 + Math.random() * 2;
    this.mesh.position.set(this.x, this.y, this.z); this.mesh.visible = true; this.bar.visible = false; this.drawBar();
    this.eyeM.color.set('#7fe3ff'); this.eyeM.emissive.set('#4fd0ff');
  }
}

/* ───────────── 굴러가는 공 (누구나 찰 수 있음) ───────────── */
function ballTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  if (kind === 'soccer') {
    x.fillStyle = '#fafafa'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#222';
    for (let i = 0; i < 8; i++) { const px = 16 + (i % 4) * 64 + (i >= 4 ? 32 : 0), py = 28 + Math.floor(i / 4) * 64; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; x.lineTo(px + Math.cos(a) * 16, py + Math.sin(a) * 16); } x.fill(); }
  } else if (kind === 'big') {
    const cols = ['#ff5d6c', '#ffb84d', '#ffe14d', '#4ddb8a', '#4db8ff', '#8a6dff'];
    for (let i = 0; i < 12; i++) { x.fillStyle = cols[i % 6]; x.fillRect(i * 256 / 12, 0, 256 / 12 + 1, 128); }
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('CNU', 64, 76); x.fillText('CNU', 192, 76);
  } else { x.fillStyle = kind; x.fillRect(0, 0, 256, 128); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) x.fillRect(i * 44, 0, 14, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Ball {
  constructor(scene, { r = 1, x = 0, z = 0, kind = 'soccer' }) {
    this.r = r; this.home = { x, z }; this.mass = Math.max(0.6, r); this.gc = 0;
    this.p = new THREE.Vector3(x, r, z); this.v = new THREE.Vector3(); this.vy = 0; this.cool = 0;
    this.mesh = new THREE.Mesh(rsph(r, 28, 20), new THREE.MeshStandardMaterial({ map: ballTexture(kind), roughness: 0.5 }));
    this.mesh.castShadow = true; scene.add(this.mesh); this.mesh.position.copy(this.p);
  }
  reset() { this.p.set(this.home.x, this.r, this.home.z); this.v.set(0, 0, 0); this.vy = 0; this.mesh.position.copy(this.p); }
  update(dt, colliders, limit) {
    const p = this.p, v = this.v; this.cool = Math.max(0, this.cool - dt);
    this.vy -= 22 * dt; p.y += this.vy * dt;
    if (p.y < this.r) { p.y = this.r; this.vy = this.vy < -2.5 ? -this.vy * 0.55 : 0; }
    const grounded = p.y <= this.r + 0.02;
    p.x += v.x * dt; p.z += v.z * dt;
    v.multiplyScalar(Math.exp(-(grounded ? 0.55 : 0.08) * dt));
    if (grounded && Math.hypot(v.x, v.z) < 0.05) { v.x = 0; v.z = 0; }
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, min = this.r + c.r;
      if (dx * dx + dz * dz < min * min) {
        const d = Math.hypot(dx, dz) || 0.0001, nx = dx / d, nz = dz / d;
        p.x = c.x + nx * min; p.z = c.z + nz * min;
        const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= 1.6 * vn * nx; v.z -= 1.6 * vn * nz; }
      }
    }
    const rr = Math.hypot(p.x, p.z);
    if (rr > limit - this.r) {
      const nx = p.x / rr, nz = p.z / rr; p.x = nx * (limit - this.r); p.z = nz * (limit - this.r);
      const vn = v.x * nx + v.z * nz; if (vn > 0) { v.x -= 1.7 * vn * nx; v.z -= 1.7 * vn * nz; }
    }
    const s = Math.hypot(v.x, v.z);
    if (s > 0.01) this.mesh.rotateOnWorldAxis(new THREE.Vector3(v.z, 0, -v.x).normalize(), (s * dt) / this.r);
    this.mesh.position.copy(p);
  }
  // 사람·카트와 부딪히면 자동으로 차짐
  touch(ax, az, avx, avz, ar) {
    const p = this.p, v = this.v;
    if (p.y > this.r + ar * 1.4 + 0.5) return false;
    const dx = p.x - ax, dz = p.z - az, min = this.r + ar;
    if (dx * dx + dz * dz >= min * min) return false;
    const d = Math.hypot(dx, dz) || 0.0001, nx = dx / d, nz = dz / d;
    p.x = ax + nx * min; p.z = az + nz * min;
    const rel = (v.x - avx) * nx + (v.z - avz) * nz;
    if (rel < 0) {
      const imp = (-rel * 1.2 + Math.hypot(avx, avz) * 0.35 + 1.2) / Math.sqrt(this.mass);
      v.x += nx * imp + (avx * 0.35) / this.mass; v.z += nz * imp + (avz * 0.35) / this.mass;
      const s = Math.hypot(v.x, v.z); if (s > 38) { v.x *= 38 / s; v.z *= 38 / s; }
      if (this.cool <= 0 && imp > 3) { this.cool = 0.2; return true; }
    }
    return false;
  }
  // F키 / 좌·우클릭: 강하게 차기
  kick(ax, az, power) {
    const dx = this.p.x - ax, dz = this.p.z - az, d = Math.hypot(dx, dz);
    if (d > this.r + 2.8) return false;
    this.v.x += (dx / (d || 1)) * power / Math.sqrt(this.mass); this.v.z += (dz / (d || 1)) * power / Math.sqrt(this.mass);
    this.vy = 5 + 2 / this.mass; return true;
  }
}

/* ───────────── 레이싱 카트 ───────────── */
export function makeKartMesh(color = '#e0533d') {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.8 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(rbox(1.5, 0.45, 2.8), body, 0, 0.55, 0);
  add(rbox(1.1, 0.35, 1.0), body, 0, 0.8, 1.0);
  add(rbox(1.7, 0.1, 0.5), dark, 0, 1.15, -1.35);
  add(rbox(0.1, 0.4, 0.1), dark, 0.6, 0.95, -1.35);
  add(rbox(0.1, 0.4, 0.1), dark, -0.6, 0.95, -1.35);
  add(rbox(0.9, 0.5, 0.15), dark, 0, 0.95, -0.55);
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff7b0', emissive: '#fff7b0', emissiveIntensity: 0.8 });
  add(rbox(0.25, 0.12, 0.05), lamp, 0.4, 0.72, 1.42);
  add(rbox(0.25, 0.12, 0.05), lamp, -0.4, 0.72, 1.42);
  const wg = rcyl(0.38, 0.38, 0.34, 16); wg.rotateZ(Math.PI / 2);
  g.userData.wheels = [[0.88, 0.95], [-0.88, 0.95], [0.88, -0.95], [-0.88, -0.95]].map(([x, z]) => add(wg, dark, x, 0.38, z));
  return g;
}
export class Kart {
  constructor(scene) {
    this.group = makeKartMesh('#e0533d'); scene.add(this.group);
    this.x = 110; this.z = -12; this.yaw = -Math.PI / 2; this.v = 0; this.active = false; this.boost = 0; this.frozen = false; this.roll = 0; this.wheelSpin = 0;
    this.sync();
  }
  sync() { this.group.position.set(this.x, 0, this.z); this.group.rotation.y = this.yaw; this.group.rotation.z = this.roll; }
  place(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.v = 0; this.boost = 0; this.sync(); }
  update(dt, inp, colliders, W, onBump) {
    const rr = Math.hypot(this.x, this.z), onTrack = Math.abs(rr - W.TRACK_R) < W.TRACK_W / 2 + 1.5;
    let maxF = 38 * (onTrack ? 1 : 0.5);
    if (this.boost > 0) { this.boost -= dt; maxF = 56; }
    if (!this.frozen) {
      if (inp.up) this.v += (this.v < maxF ? 26 : 0) * dt;
      else if (inp.down) this.v -= (this.v > 0 ? 42 : 14) * dt;
      else this.v *= Math.exp(-0.9 * dt);
      if (inp.brake) this.v *= Math.exp(-3 * dt);
    } else this.v *= Math.exp(-3 * dt);
    if (this.v > maxF) this.v -= (this.v - maxF) * Math.min(1, 2.5 * dt);
    if (this.v < -12) this.v = -12;
    const steer = this.frozen ? 0 : (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    const rate = (2.1 - Math.min(1, Math.abs(this.v) / 40) * 0.8) * Math.min(1, Math.abs(this.v) / 6);
    this.yaw += steer * rate * dt * (this.v >= 0 ? 1 : -1);
    this.x += Math.sin(this.yaw) * this.v * dt; this.z += Math.cos(this.yaw) * this.v * dt;
    for (const c of colliders) {
      const dx = this.x - c.x, dz = this.z - c.z, min = c.r + 1.5;
      if (dx * dx + dz * dz < min * min) {
        const d = Math.hypot(dx, dz) || 0.0001; this.x = c.x + (dx / d) * min; this.z = c.z + (dz / d) * min;
        if (Math.abs(this.v) > 6 && onBump) onBump();
        this.v *= -0.3;
      }
    }
    const r2 = Math.hypot(this.x, this.z);
    if (r2 > W.LIMIT - 2) { this.x *= (W.LIMIT - 2) / r2; this.z *= (W.LIMIT - 2) / r2; this.v *= 0.5; }
    this.roll += ((-steer * Math.min(1, Math.abs(this.v) / 40) * 0.12) - this.roll) * Math.min(1, 8 * dt);
    this.wheelSpin += (this.v * dt) / 0.38;
    this.group.userData.wheels.forEach((w, i) => { w.rotation.x = this.wheelSpin; if (i < 2) w.rotation.y = steer * 0.4; });
    this.sync();
    return onTrack;
  }
}