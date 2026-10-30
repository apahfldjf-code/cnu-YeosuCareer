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

/* ───────────── 캐릭터 꾸미기 목록 ───────────── */
export const SKINS = ['#ffe9d6', '#ffe0c7', '#f5c9a0', '#e2b184', '#c68e5e', '#a9744a', '#6d4529'];
export const HAIRC = ['#15110d', '#2b1b12', '#5a3a22', '#8a5a2b', '#c9a24a', '#e8d28a', '#d94f6a', '#ff8fb3', '#3a5bd9', '#7b4fd9', '#4fbf6a', '#eeeeee'];
export const UNIFORMS = ['#1f3b73', '#3a3a3a', '#8a1f2d', '#1e6b4a', '#6b3fa0', '#d8d8d8', '#2f6fed', '#e0533d', '#f2b84b', '#0aa6b7', '#ff8fb3', '#4a4f5a'];
export const BAGS = ['#e0a43a', '#e0533d', '#47b5a2', '#4c8dd9', '#333333', '#8e5cf2', '#ff8fb3', '#6b7a3a'];
export const HAIRSTYLES = [['short', '짧은 머리'], ['buzz', '스포츠'], ['spiky', '뾰족'], ['bob', '단발'], ['long', '긴 머리'], ['wavy', '웨이브'], ['pony', '포니테일'], ['twin', '양갈래'], ['bun', '똥머리']];
const PANTS = ['#2b2f3a', '#1f3b73', '#3a3a3a', '#6b5a3a', '#8a1f2d', '#d8d8d8', '#4a6a4a', '#e8dcc0'];
const SHOEC = ['#2a2d35', '#f4f4f4', '#e0533d', '#4c8dd9', '#8a5a2b', '#f2b84b', '#ff8fb3'];
const ACCC = ['#e0533d', '#4c8dd9', '#f2b84b', '#4fbf6a', '#ff8fb3', '#222222', '#ffffff'];
const EYEC = ['#3a2a1a', '#2b5fa0', '#2f8f5a', '#8a4fd0', '#c0392b', '#555a66'];
const NECKC = ['#c8323c', '#2a4f8a', '#f2b84b', '#1e6b4a', '#6b3fa0', '#222222', '#ffffff'];
const EYES = [['dot', '점눈'], ['round', '동그란'], ['happy', '웃는'], ['sharp', '또렷한']];
const MOUTHS = [['smile', '미소'], ['flat', '무표정'], ['open', '활짝']];
const TOPS = [['blazer', '교복 재킷'], ['shirt', '반팔 셔츠'], ['hoodie', '후드티'], ['sports', '체육복']];
const BOTTOMS = [['pants', '긴바지'], ['skirt', '치마'], ['shorts', '반바지']];
const NECKS = [['tie', '넥타이'], ['ribbon', '리본'], ['none', '없음']];
const SHOES = [['sneaker', '운동화'], ['loafer', '로퍼'], ['boots', '부츠']];
const BAGT = [['backpack', '책가방'], ['sling', '크로스백'], ['tote', '손가방'], ['none', '없음']];
const ACCS = [['none', '없음'], ['glasses', '안경'], ['sunglasses', '선글라스'], ['cap', '모자'], ['headband', '머리띠'], ['headphones', '헤드폰'], ['mask', '마스크'], ['bow', '리본핀']];
const BODIES = [['std', '표준'], ['slim', '슬림'], ['sturdy', '듬직'], ['small', '아담'], ['tall', '키 큼']];

export const CUSTOM = [
  { key: 'hairStyle', label: '머리', tab: '머리', list: HAIRSTYLES },
  { key: 'hair', label: '머리색', tab: '머리', list: HAIRC },
  { key: 'skin', label: '피부', tab: '얼굴', list: SKINS },
  { key: 'eye', label: '눈', tab: '얼굴', list: EYES },
  { key: 'eyeColor', label: '눈동자', tab: '얼굴', list: EYEC },
  { key: 'mouth', label: '입', tab: '얼굴', list: MOUTHS },
  { key: 'cheek', label: '볼터치', tab: '얼굴', list: [['none', '없음'], ['blush', '있음']] },
  { key: 'top', label: '상의', tab: '옷', list: TOPS },
  { key: 'uniform', label: '상의색', tab: '옷', list: UNIFORMS },
  { key: 'bottom', label: '하의', tab: '옷', list: BOTTOMS },
  { key: 'pants', label: '하의색', tab: '옷', list: PANTS },
  { key: 'neck', label: '목장식', tab: '옷', list: NECKS },
  { key: 'neckColor', label: '장식색', tab: '옷', list: NECKC },
  { key: 'shoes', label: '신발', tab: '신발·가방', list: SHOES },
  { key: 'shoeColor', label: '신발색', tab: '신발·가방', list: SHOEC },
  { key: 'bagType', label: '가방', tab: '신발·가방', list: BAGT },
  { key: 'bag', label: '가방색', tab: '신발·가방', list: BAGS },
  { key: 'acc', label: '액세서리', tab: '꾸미기', list: ACCS },
  { key: 'accColor', label: '색', tab: '꾸미기', list: ACCC },
  { key: 'body', label: '체형', tab: '체형', list: BODIES },
];
export function randomLook() {
  const L = {};
  CUSTOM.forEach((o) => { const v = o.list[(Math.random() * o.list.length) | 0]; L[o.key] = Array.isArray(v) ? v[0] : v; });
  if (Math.random() < 0.5) L.acc = 'none';
  return { ...DEFAULT_LOOK, ...L };
}

/* ───────────── 저장(localStorage) — v1 과 같은 키 ───────────── */
const KEY = 'jnu_yeosu_career_quest_v1';
export const DEFAULT_LOOK = {
  skin: '#ffe0c7', hair: '#2b1b12', hairStyle: 'short', uniform: '#1f3b73', bag: '#e0a43a',
  top: 'blazer', bottom: 'pants', pants: '#2b2f3a', neck: 'tie', neckColor: '#c8323c',
  shoes: 'sneaker', shoeColor: '#2a2d35', bagType: 'backpack',
  eye: 'dot', eyeColor: '#3a2a1a', mouth: 'smile', cheek: 'none', acc: 'none', accColor: '#e0533d', body: 'std',
};
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
const bx = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const sp = (r, m, a = 18, b = 14) => new THREE.Mesh(new THREE.SphereGeometry(r, a, b), m);
const put = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
const zcyl = (p, r, len, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m); o.rotation.x = HP; return put(p, o, x, y, z); };
const shade = (c, a) => new THREE.Color(c).offsetHSL(0, 0, a);
const RARC = ['#9aa5b5', '#4fbf6a', '#4c8dd9', '#b06cf0'];
const rc = (d) => RARC[clamp(((d && d.rarity) || 1) - 1, 0, 3)];
const FAMS = ['AR', 'SMG', 'SR', 'SG', 'HG'];
const famOf = (d) => (d && FAMS.includes(d.fam) ? d.fam : d && FAMS.includes(d.ammo) ? d.ammo : 'AR');

/* ───────────── 캐릭터(고등학생) : 앞쪽이 +Z ─────────────
 * createCharacter(look,{coat}) → { group, walk(t,amt), sit(on), wave(t), stopWave(), swing('L'|'R'), tick(dt), hold(def|null), kick(), setGear({helmet,vest,pack}) }
 * 팔 회전: rotation.x 음수 = 앞으로 들기 / 오른팔(-x쪽) rotation.z 음수 = 옆으로 들기  */
const BODY = { std: [1, 1], slim: [0.88, 1.03], sturdy: [1.15, 1], small: [0.95, 0.88], tall: [0.95, 1.12] };

export function createCharacter(look = {}, opts = {}) {
  const { coat = null } = opts;
  const L = { ...DEFAULT_LOOK, ...look };
  const g = new THREE.Group(), rig = new THREE.Group(), up = new THREE.Group(); g.add(rig); rig.add(up);
  const bs = BODY[L.body] || BODY.std; rig.scale.set(bs[0], bs[1], bs[0]);
  const skin = mat(L.skin), hair = mat(L.hair), topC = coat || L.uniform, uni = mat(topC);
  const pantsM = mat(L.pants), white = mat('#f4f4f4'), dark = mat('#15171c'), shoeM = mat(L.shoeColor);
  const top = coat ? 'blazer' : L.top, longSleeve = top === 'blazer' || top === 'hoodie';

  /* 몸통 */
  put(up, bx(0.62, 0.72, 0.36, uni), 0, 1.15, 0);
  if (top !== 'hoodie') put(rig, bx(0.64, 0.06, 0.38, dark), 0, 0.82, 0);
  if (top === 'blazer') {
    put(up, bx(0.26, 0.12, 0.02, white), 0, 1.46, 0.19); put(up, bx(0.2, 0.3, 0.01, white), 0, 1.31, 0.185);
    const gold = mat('#e8c25a', { metalness: 0.5 }); put(up, sp(0.02, gold, 8, 6), 0.1, 1.05, 0.185); put(up, sp(0.02, gold, 8, 6), 0.1, 0.92, 0.185);
    put(up, bx(0.14, 0.1, 0.02, mat(shade(topC, -0.12))), -0.18, 1.2, 0.185);
  } else if (top === 'shirt') {
    put(up, bx(0.3, 0.1, 0.03, white), 0, 1.47, 0.19);
    for (let i = 0; i < 4; i++) put(up, sp(0.015, white, 6, 4), 0, 1.3 - i * 0.15, 0.185);
  } else if (top === 'hoodie') {
    const hd = sp(0.25, uni, 14, 10); hd.scale.set(1.25, 0.6, 0.65); put(up, hd, 0, 1.52, -0.2);
    put(up, bx(0.42, 0.18, 0.02, mat(shade(topC, -0.1))), 0, 0.95, 0.185);
    put(up, bx(0.02, 0.2, 0.02, white), 0.07, 1.38, 0.19); put(up, bx(0.02, 0.2, 0.02, white), -0.07, 1.38, 0.19);
  } else {
    put(up, bx(0.04, 0.72, 0.37, white), 0.31, 1.15, 0); put(up, bx(0.04, 0.72, 0.37, white), -0.31, 1.15, 0);
    put(up, bx(0.2, 0.06, 0.02, white), 0, 1.47, 0.19); put(up, bx(0.14, 0.14, 0.01, white), 0, 1.2, 0.185);
  }
  if (top === 'blazer' || top === 'shirt') {
    const nc = mat(L.neckColor);
    if (L.neck === 'tie') { put(up, bx(0.07, 0.34, 0.02, nc), 0, 1.27, 0.2); put(up, bx(0.09, 0.07, 0.025, nc), 0, 1.43, 0.2); }
    else if (L.neck === 'ribbon') {
      const a = bx(0.13, 0.09, 0.03, nc); a.rotation.z = 0.35; put(up, a, 0.08, 1.42, 0.2);
      const b = bx(0.13, 0.09, 0.03, nc); b.rotation.z = -0.35; put(up, b, -0.08, 1.42, 0.2);
      put(up, bx(0.06, 0.06, 0.04, nc), 0, 1.42, 0.205); put(up, bx(0.04, 0.2, 0.02, nc), -0.03, 1.28, 0.2); put(up, bx(0.04, 0.2, 0.02, nc), 0.03, 1.28, 0.2);
    }
  }

  /* 머리 · 얼굴 */
  put(up, sp(0.3, skin, 24, 18), 0, 1.8, 0);
  put(up, sp(0.06, skin, 8, 6), 0.3, 1.78, 0); put(up, sp(0.06, skin, 8, 6), -0.3, 1.78, 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair); cap.position.y = 1.81; cap.castShadow = true;
  const fringe = () => put(up, bx(0.5, 0.09, 0.08, hair), 0, 1.97, 0.22);
  const side = (h, y, z) => { put(up, bx(0.08, h, 0.3, hair), 0.31, y, z); put(up, bx(0.08, h, 0.3, hair), -0.31, y, z); };
  const st = L.hairStyle || 'short';
  if (st !== 'buzz') up.add(cap); else { cap.scale.setScalar(0.99); up.add(cap); }
  if (['short', 'bob', 'long', 'wavy', 'pony', 'twin', 'bun'].includes(st)) fringe();
  if (st === 'bob') { put(up, bx(0.68, 0.42, 0.2, hair), 0, 1.72, -0.16); side(0.34, 1.74, -0.04); }
  else if (st === 'long') { put(up, bx(0.68, 0.85, 0.18, hair), 0, 1.5, -0.2); side(0.5, 1.66, -0.04); }
  else if (st === 'wavy') {
    put(up, bx(0.7, 0.78, 0.18, hair), 0, 1.52, -0.2); side(0.5, 1.64, -0.04);
    for (let i = 0; i < 5; i++) put(up, sp(0.1, hair, 8, 6), -0.28 + i * 0.14, 1.1, -0.2);
    put(up, sp(0.1, hair, 8, 6), 0.34, 1.4, -0.02); put(up, sp(0.1, hair, 8, 6), -0.34, 1.4, -0.02);
  } else if (st === 'pony') { put(up, sp(0.13, hair), 0, 1.95, -0.32); put(up, new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 4, 8), hair), 0, 1.62, -0.38); }
  else if (st === 'twin') {
    for (const sx of [-1, 1]) { put(up, new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), hair), sx * 0.38, 1.56, -0.04); put(up, sp(0.07, mat('#e0533d'), 8, 6), sx * 0.36, 1.85, -0.04); }
  } else if (st === 'bun') { put(up, sp(0.16, hair), 0, 2.12, -0.04); put(up, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 12), mat('#e0533d')), 0, 2.0, -0.04).rotation.x = HP; }
  else if (st === 'spiky') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 5), hair);
      c.position.set(Math.cos(a) * 0.2, 2.1, Math.sin(a) * 0.2); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); c.castShadow = true; up.add(c);
    }
    put(up, new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), hair), 0, 2.16, 0);
    put(up, bx(0.5, 0.07, 0.07, hair), 0, 1.99, 0.24);
  }

  const eyeM = mat('#101010'), ecol = mat(L.eyeColor);
  for (const sx of [-1, 1]) {
    const ex = sx * 0.1;
    if (L.eye === 'round') { const w = sp(0.058, white, 10, 8); w.scale.z = 0.5; put(up, w, ex, 1.8, 0.272); put(up, sp(0.036, ecol, 8, 6), ex, 1.8, 0.292); put(up, sp(0.018, eyeM, 6, 4), ex, 1.8, 0.304); }
    else if (L.eye === 'happy') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), eyeM); put(up, t, ex, 1.79, 0.288); }
    else if (L.eye === 'sharp') { const b = bx(0.1, 0.028, 0.012, eyeM); b.rotation.z = sx * -0.22; put(up, b, ex, 1.8, 0.288); put(up, sp(0.018, ecol, 6, 4), ex, 1.8, 0.292); }
    else put(up, sp(0.04, eyeM, 8, 6), ex, 1.8, 0.28);
    const br = bx(0.08, 0.018, 0.012, hair); br.rotation.z = sx * (L.eye === 'sharp' ? 0.28 : 0.06); put(up, br, ex, 1.9, 0.272);
    if (L.cheek === 'blush') { const ch = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.6 })); ch.position.set(sx * 0.18, 1.74, 0.238); ch.rotation.y = sx * 0.6; up.add(ch); }
  }
  if (L.acc !== 'mask') {
    if (L.mouth === 'open') { put(up, bx(0.07, 0.05, 0.012, mat('#7a2a2a')), 0, 1.71, 0.29); put(up, bx(0.045, 0.015, 0.012, mat('#e8707a')), 0, 1.695, 0.292); }
    else if (L.mouth === 'flat') put(up, bx(0.09, 0.015, 0.01, mat('#a0524a')), 0, 1.71, 0.295);
    else { const t = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 12, Math.PI), mat('#a0524a')); t.rotation.z = Math.PI; put(up, t, 0, 1.74, 0.288); }
  }

  /* 액세서리 */
  const am = mat(L.accColor);
  if (L.acc === 'glasses' || L.acc === 'sunglasses') {
    const lens = L.acc === 'sunglasses' ? mat('#111418') : null;
    for (const sx of [-1, 1]) {
      if (lens) put(up, bx(0.15, 0.09, 0.02, lens), sx * 0.1, 1.8, 0.3); else put(up, new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16), am), sx * 0.1, 1.8, 0.3);
      put(up, bx(0.01, 0.01, 0.3, am), sx * 0.3, 1.8, 0.14);
    }
    put(up, bx(0.06, 0.012, 0.012, am), 0, 1.81, 0.3);
  } else if (L.acc === 'cap') {
    put(up, new THREE.Mesh(new THREE.SphereGeometry(0.345, 20, 10, 0, Math.PI * 2, 0, HP), am), 0, 1.9, 0);
    put(up, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 16, 1, false, -HP, Math.PI), mat(shade(L.accColor, -0.08))), 0, 1.9, 0.14);
  } else if (L.acc === 'headband') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 24), am); t.rotation.x = HP; put(up, t, 0, 1.93, 0); }
  else if (L.acc === 'headphones') {
    put(up, new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 20, Math.PI), mat('#2a2d35')), 0, 1.8, 0);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 14), am); c.rotation.z = HP; put(up, c, sx * 0.34, 1.8, 0); }
  } else if (L.acc === 'mask') put(up, bx(0.3, 0.14, 0.05, mat(L.accColor === '#222222' ? '#2a2d35' : '#f1f3f6')), 0, 1.7, 0.262);
  else if (L.acc === 'bow') {
    const a = bx(0.12, 0.08, 0.03, am); a.rotation.z = 0.5; put(up, a, 0.27, 1.99, 0.1); const b = bx(0.12, 0.08, 0.03, am); b.rotation.z = -0.5; put(up, b, 0.17, 1.99, 0.1); put(up, sp(0.035, am, 6, 4), 0.22, 1.99, 0.1);
  }

  /* 팔 · 다리 */
  const mkArm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.47, 0); p.rotation.order = 'YXZ'; up.add(p);
    if (longSleeve) { put(p, bx(0.18, 0.5, 0.18, uni), 0, -0.25, 0); put(p, bx(0.19, 0.05, 0.19, mat(shade(topC, -0.12))), 0, -0.47, 0); }
    else { put(p, bx(0.19, 0.27, 0.19, uni), 0, -0.135, 0); put(p, bx(0.15, 0.25, 0.15, skin), 0, -0.4, 0); if (top === 'sports') put(p, bx(0.2, 0.04, 0.2, white), 0, -0.22, 0); }
    put(p, sp(0.09, skin, 10, 8), 0, -0.56, 0); return p;
  };
  const mkLeg = (x) => {
    const p = new THREE.Group(); p.position.set(x, 0.8, 0); rig.add(p);
    if (L.bottom === 'skirt') { put(p, bx(0.2, 0.72, 0.2, skin), 0, -0.36, 0); put(p, bx(0.215, 0.34, 0.215, white), 0, -0.55, 0); }
    else if (L.bottom === 'shorts') { put(p, bx(0.2, 0.72, 0.2, skin), 0, -0.36, 0); put(p, bx(0.245, 0.3, 0.245, pantsM), 0, -0.15, 0); put(p, bx(0.215, 0.14, 0.215, white), 0, -0.62, 0); }
    else put(p, bx(0.22, 0.72, 0.22, pantsM), 0, -0.36, 0);
    if (L.shoes === 'loafer') { put(p, bx(0.25, 0.12, 0.34, shoeM), 0, -0.74, 0.05); put(p, bx(0.2, 0.03, 0.1, dark), 0, -0.785, -0.05); }
    else if (L.shoes === 'boots') { put(p, bx(0.26, 0.3, 0.26, shoeM), 0, -0.6, 0); put(p, bx(0.26, 0.1, 0.36, shoeM), 0, -0.73, 0.05); put(p, bx(0.27, 0.04, 0.38, dark), 0, -0.78, 0.05); }
    else { put(p, bx(0.26, 0.05, 0.36, white), 0, -0.775, 0.05); put(p, bx(0.25, 0.1, 0.3, shoeM), 0, -0.71, 0.03); put(p, bx(0.12, 0.02, 0.1, white), 0, -0.655, 0.1); }
    return p;
  };
  const armL = mkArm(0.4), armR = mkArm(-0.4), legL = mkLeg(0.15), legR = mkLeg(-0.15);
  if (L.bottom === 'skirt') put(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.47, 0.3, 16), pantsM), 0, 0.7, 0);

  /* 가방(학교) */
  const bagG = new THREE.Group(); up.add(bagG); const bm = mat(L.bag), bd = mat(shade(L.bag, -0.12));
  if (L.bagType === 'backpack') {
    put(bagG, bx(0.5, 0.56, 0.2, bm), 0, 1.2, -0.28); put(bagG, bx(0.36, 0.24, 0.06, bd), 0, 1.08, -0.4); put(bagG, bx(0.12, 0.05, 0.05, bd), 0, 1.5, -0.3);
    put(bagG, bx(0.07, 0.5, 0.04, bd), 0.2, 1.25, 0.19); put(bagG, bx(0.07, 0.5, 0.04, bd), -0.2, 1.25, 0.19);
  } else if (L.bagType === 'sling') {
    const s1 = bx(0.07, 0.95, 0.02, bd); s1.rotation.z = 0.55; put(bagG, s1, 0, 1.15, 0.19); const s2 = bx(0.07, 0.95, 0.02, bd); s2.rotation.z = 0.55; put(bagG, s2, 0, 1.15, -0.19);
    put(bagG, bx(0.3, 0.22, 0.14, bm), 0.2, 0.92, -0.27); put(bagG, bx(0.3, 0.06, 0.15, bd), 0.2, 1.02, -0.27);
  } else if (L.bagType === 'tote') {
    put(armL, bx(0.3, 0.24, 0.1, bm), 0.02, -0.72, 0.02); const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), bd); put(armL, h, 0.02, -0.6, 0.02);
  }

  /* 장비 (헬멧·조끼·전투가방) */
  const gearG = new THREE.Group(); up.add(gearG);
  function setGear(o = {}) {
    while (gearG.children.length) gearG.remove(gearG.children[0]);
    bagG.visible = !(o.pack);
    if (o.helmet) {
      const c = rc(o.helmet), hm = mat(c, { roughness: 0.5, metalness: 0.2 });
      put(gearG, new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hm), 0, 1.83, 0);
      put(gearG, bx(0.46, 0.05, 0.05, mat('#15171c')), 0, 1.85, 0.34); put(gearG, bx(0.08, 0.05, 0.3, mat(shade(c, -0.15))), 0, 2.2, 0);
    }
    if (o.vest) {
      const c = rc(o.vest), vm = mat(shade(c, -0.22), { roughness: 0.6 });
      put(gearG, bx(0.69, 0.52, 0.43, vm), 0, 1.2, 0); put(gearG, bx(0.2, 0.08, 0.3, vm), 0.34, 1.46, 0); put(gearG, bx(0.2, 0.08, 0.3, vm), -0.34, 1.46, 0);
      put(gearG, bx(0.5, 0.06, 0.45, mat(c)), 0, 1.0, 0); put(gearG, bx(0.16, 0.14, 0.05, mat(c)), 0, 1.26, 0.22);
    }
    if (o.pack) {
      const c = rc(o.pack), pm = mat(shade(c, -0.2)), big = 1 + Math.min(0.5, ((o.pack.slots || 4) - 4) * 0.06);
      put(gearG, bx(0.56 * big, 0.7 * big, 0.3, pm), 0, 1.2, -0.38); put(gearG, bx(0.4 * big, 0.25, 0.08, mat(c)), 0, 1.05, -0.58);
      put(gearG, bx(0.1, 0.12, 0.1, mat(c)), 0.34, 1.0, -0.38); put(gearG, bx(0.1, 0.12, 0.1, mat(c)), -0.34, 1.0, -0.38);
      put(gearG, bx(0.07, 0.5, 0.04, pm), 0.2, 1.25, 0.2); put(gearG, bx(0.07, 0.5, 0.04, pm), -0.2, 1.25, 0.2);
    }
  }
  setGear({});

  /* 들고 있는 총 */
  const mount = new THREE.Group(); mount.position.set(-0.17, 1.37, 0.5); up.add(mount);
  let gun = null;
  function hold(def) {
    if (gun) { mount.remove(gun); gun = null; }
    st2.holding = !!def; if (def) { gun = makeGunMesh(def); mount.add(gun); }
    pose();
  }

  /* 애니메이션 상태 */
  const st2 = { walkT: 0, amt: 0, sitting: false, waving: false, clock: 0, swing: null, kickT: 0, holding: false };
  function pose() {
    const s = st2.amt, ph = st2.walkT * 11, sw = Math.sin(ph) * 0.85 * s;
    legL.rotation.x = st2.sitting ? -1.45 : sw; legR.rotation.x = st2.sitting ? -1.45 : -sw;
    let aLx = -sw * 0.8, aLy = 0, aLz = 0.06, aRx = sw * 0.8, aRy = 0, aRz = -0.06, tw = 0, lean = 0;
    if (st2.sitting) { aLx = aRx = -0.9; aLy = -0.12; aRy = 0.12; }
    if (st2.holding && !st2.sitting) { aRx = -1.35 + st2.kickT * 0.18; aRy = 0.32; aRz = 0; aLx = -1.45 + st2.kickT * 0.12; aLy = -0.72; aLz = 0; }
    else if (st2.waving && !st2.sitting) { aRx = 0; aRz = -(2.45 + Math.sin(st2.clock * 8) * 0.35); }
    const k = st2.swing;
    if (k) {
      const p = clamp(k.t / k.dur, 0, 1);
      if (k.kind === 'L') {
        const e = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        aLx = aLx * (1 - e) - 1.55 * e; aLy = aLy * (1 - e) - 0.25 * e; aLz = aLz * (1 - e); tw = -0.18 * e; lean = 0.08 * e;
      } else {
        let x, z, y; const base = { x: aRx, y: aRy, z: aRz };
        if (p < 0.45) { const w = p / 0.45; x = 0.9 * w; z = -0.5 * w; y = 0; tw = -0.5 * w; lean = -0.04 * w; aRx = x; aRz = z; aRy = y; }
        else {
          const s2 = (p - 0.45) / 0.55, f = Math.min(1, s2 / 0.3), r = s2 < 0.3 ? 0 : (s2 - 0.3) / 0.7;
          x = 0.9 - 2.4 * f; z = -0.5 * (1 - f); y = 0.3 * f; const t2 = -0.5 + 1.05 * f;
          aRx = x * (1 - r) + base.x * r; aRz = z * (1 - r) + base.z * r; aRy = y * (1 - r) + base.y * r; tw = t2 * (1 - r); lean = 0.1 * f * (1 - r);
        }
      }
    }
    armL.rotation.set(aLx, aLy, aLz); armR.rotation.set(aRx, aRy, aRz);
    up.rotation.y = tw; rig.rotation.x = lean;
    up.position.y = (st2.sitting || st2.holding || k ? 0 : Math.sin(st2.clock * 2.2) * 0.006);
    mount.position.z = 0.5 - st2.kickT * 0.07; mount.rotation.x = -st2.kickT * 0.12;
  }

  const api = {
    group: g,
    walk(t, amt) { st2.walkT = t; st2.amt = amt; pose(); },
    sit(on) { st2.sitting = !!on; rig.position.y = on ? -0.3 : 0; pose(); },
    wave(t) { st2.waving = true; if (typeof t === 'number') st2.clock = t; pose(); },
    stopWave() { st2.waving = false; pose(); },
    swing(kind) { st2.swing = { kind: kind === 'R' ? 'R' : 'L', t: 0, dur: kind === 'R' ? 0.62 : 0.3 }; pose(); },
    tick(dt) {
      st2.clock += dt; st2.kickT = Math.max(0, st2.kickT - dt * 7);
      if (st2.swing) { st2.swing.t += dt; if (st2.swing.t >= st2.swing.dur) st2.swing = null; }
      pose();
    },
    hold, setGear,
    kick() { st2.kickT = 1; },
  };
  pose(); return api;
}

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
  else if (T === 'helmet') { put(g, new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(c, { roughness: 0.4, metalness: 0.2 })), 0, 0.45, 0); put(g, bx(0.4, 0.05, 0.05, blkM()), 0, 0.5, 0.28); }
  else if (T === 'vest') { put(g, bx(0.6, 0.55, 0.3, mat(shade(c, -0.22))), 0, 0.5, 0); put(g, bx(0.2, 0.08, 0.26, mat(shade(c, -0.22))), 0.3, 0.8, 0); put(g, bx(0.2, 0.08, 0.26, mat(shade(c, -0.22))), -0.3, 0.8, 0); put(g, bx(0.4, 0.06, 0.32, cm), 0, 0.35, 0); }
  else if (T === 'pack') { const k = 1 + Math.min(0.4, ((def.slots || 4) - 4) * 0.05); put(g, bx(0.5 * k, 0.62 * k, 0.3, mat(shade(c, -0.2))), 0, 0.5, 0); put(g, bx(0.36 * k, 0.22, 0.08, cm), 0, 0.38, 0.18); put(g, bx(0.1, 0.12, 0.1, cm), 0.3, 0.35, 0); put(g, bx(0.1, 0.12, 0.1, cm), -0.3, 0.35, 0); }
  else if (T === 'heal') {
    const k = (def.heal || 30) <= 25 ? 0.75 : 1; put(g, bx(0.5 * k, 0.3 * k, 0.34 * k, mat('#f6f7f9')), 0, 0.3, 0);
    put(g, bx(0.26 * k, 0.02, 0.07 * k, mat('#e0302a')), 0, 0.46 * k + 0.0, 0).position.y = 0.3 + 0.15 * k + 0.01; put(g, bx(0.07 * k, 0.02, 0.26 * k, mat('#e0302a')), 0, 0.3 + 0.15 * k + 0.012, 0);
  } else if (T === 'ammo') {
    put(g, bx(0.5, 0.26, 0.34, mat('#56633a')), 0, 0.25, 0); put(g, bx(0.52, 0.06, 0.1, mat(AMMOC[def.ammo] || '#d9b34a')), 0, 0.3, 0.17);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), mat('#d9b34a', { metalness: 0.6, roughness: 0.3 })); put(g, b, -0.15 + i * 0.1, 0.46, 0); }
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
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46 * S, 16, 8, 0, Math.PI * 2, 0, HP), colM); dome.position.y = 0.06 * S; dome.scale.y = 0.7; this.body.add(dome);
    const belly = sp(0.34 * S, darkM, 12, 8); belly.position.y = -0.17 * S; belly.scale.y = 0.5; this.body.add(belly);
    this.eyeM = new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#4fd0ff', emissiveIntensity: 1.4 });
    const eye = sp(0.15 * S, this.eyeM, 12, 8); eye.position.set(0, 0.02 * S, 0.45 * S); this.body.add(eye);
    const er = new THREE.Mesh(new THREE.TorusGeometry(0.17 * S, 0.025 * S, 6, 16), darkM); er.position.copy(eye.position); this.body.add(er);
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * S, 0.01 * S, 0.3 * S, 5), darkM); an.position.set(0.15 * S, 0.45 * S, -0.1 * S); this.body.add(an);
    this.rot = [];
    const rm = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * HP, ax = Math.cos(a) * 0.62 * S, az = Math.sin(a) * 0.62 * S;
      const arm = bx(0.06 * S, 0.05 * S, 0.62 * S, darkM); arm.position.set(ax / 2, 0.04 * S, az / 2); arm.rotation.y = -a + HP; this.body.add(arm);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * S, 0.06 * S, 0.1 * S, 8), colM); hub.position.set(ax, 0.1 * S, az); this.body.add(hub);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * S, 0.34 * S, 0.012, 20), rm); disc.position.set(ax, 0.17 * S, az); this.body.add(disc); this.rot.push(disc);
    }
    if (kind === 'guard') for (const sx of [-1, 1]) { const pod = bx(0.12 * S, 0.14 * S, 0.34 * S, colM); pod.position.set(sx * 0.5 * S, -0.05 * S, 0.1 * S); this.body.add(pod); }
    if (kind === 'heavy') {
      for (const sx of [-1, 1]) { const pl = bx(0.1 * S, 0.3 * S, 0.5 * S, colM); pl.position.set(sx * 0.48 * S, 0, 0); this.body.add(pl); const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * S, 0.05 * S, 0.5 * S, 8), darkM); cn.rotation.x = HP; cn.position.set(sx * 0.3 * S, -0.16 * S, 0.4 * S); this.body.add(cn); }
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
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), new THREE.MeshStandardMaterial({ map: ballTexture(kind), roughness: 0.5 }));
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
  add(new THREE.BoxGeometry(1.5, 0.45, 2.8), body, 0, 0.55, 0);
  add(new THREE.BoxGeometry(1.1, 0.35, 1.0), body, 0, 0.8, 1.0);
  add(new THREE.BoxGeometry(1.7, 0.1, 0.5), dark, 0, 1.15, -1.35);
  add(new THREE.BoxGeometry(0.1, 0.4, 0.1), dark, 0.6, 0.95, -1.35);
  add(new THREE.BoxGeometry(0.1, 0.4, 0.1), dark, -0.6, 0.95, -1.35);
  add(new THREE.BoxGeometry(0.9, 0.5, 0.15), dark, 0, 0.95, -0.55);
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff7b0', emissive: '#fff7b0', emissiveIntensity: 0.8 });
  add(new THREE.BoxGeometry(0.25, 0.12, 0.05), lamp, 0.4, 0.72, 1.42);
  add(new THREE.BoxGeometry(0.25, 0.12, 0.05), lamp, -0.4, 0.72, 1.42);
  const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 16); wg.rotateZ(Math.PI / 2);
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