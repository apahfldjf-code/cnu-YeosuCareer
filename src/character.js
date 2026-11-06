/* ═══════════════════════════════════════════════════════════════
 * src/character.js  (신규, Q5) — 캐릭터 꾸미기 목록 + 캐릭터 제작 (이미지·모델 파일 없음, 전부 코드로 생성)
 *
 *  얼굴    얼굴형 3 · 눈 8 · 눈썹 6 · 입 7 · 볼터치/주근깨 · 점/반창고/별 스티커 · 코 · 귀
 *  머리    스타일 13 (앞머리·옆머리·뒷머리 덩이로 분리) · 포인트 가닥 · 끝 염색
 *  옷      상의 10 · 무늬 5 · 가슴 마크 5 · 하의 6 · 목장식 4 · 양말 · 신발 5
 *  꾸미기  모자·머리장식 16 · 목도리/목걸이/행사 목걸이/손목시계/귀걸이 · 가방 5 · 가방 인형 5
 *  체형    7
 *
 *  - core.js 가 이 파일을 불러와 같은 이름으로 다시 내보냅니다.
 *    그래서 game.js · world.js · npc.js 는 고칠 필요가 없습니다.
 *  - 예전 저장 데이터(없는 항목)는 기본값으로 채워져 그대로 동작합니다.
 *  - 고정 부품은 재질별로 하나로 합쳐 그리기 부담을 줄였습니다.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { rboxChar } from './round.js';

const HP = Math.PI / 2, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let gunMaker = null;
export function setGunMaker(fn) { gunMaker = fn; }

/* ───────────── 꾸미기 목록 ───────────── */
export const SKINS = ['#ffe9d6', '#ffe0c7', '#f5c9a0', '#e2b184', '#c68e5e', '#a9744a', '#6d4529'];
export const HAIRC = ['#15110d', '#2b1b12', '#5a3a22', '#8a5a2b', '#c9a24a', '#e8d28a', '#d94f6a', '#ff8fb3', '#3a5bd9', '#7b4fd9', '#4fbf6a', '#eeeeee', '#7a1f2b', '#2fb8c9', '#ff8a3d', '#9aa5b5'];
export const UNIFORMS = ['#1f3b73', '#3a3a3a', '#8a1f2d', '#1e6b4a', '#6b3fa0', '#d8d8d8', '#2f6fed', '#e0533d', '#f2b84b', '#0aa6b7', '#ff8fb3', '#4a4f5a', '#f4f4f4', '#111827', '#f08a24', '#a6c8ff'];
export const BAGS = ['#e0a43a', '#e0533d', '#47b5a2', '#4c8dd9', '#333333', '#8e5cf2', '#ff8fb3', '#6b7a3a'];
export const HAIRSTYLES = [['short', '짧은 머리'], ['buzz', '스포츠'], ['spiky', '뾰족'], ['side', '가르마'], ['bob', '단발'], ['long', '긴 머리'], ['wavy', '웨이브'], ['curly', '곱슬'], ['pony', '포니테일'], ['twin', '양갈래'], ['bun', '똥머리'], ['braid', '땋은 머리'], ['wolf', '레이어드']];
const PANTS = ['#2b2f3a', '#1f3b73', '#3a3a3a', '#6b5a3a', '#8a1f2d', '#d8d8d8', '#4a6a4a', '#e8dcc0', '#111827', '#7a8aa6'];
const SHOEC = ['#2a2d35', '#f4f4f4', '#e0533d', '#4c8dd9', '#8a5a2b', '#f2b84b', '#ff8fb3', '#4fbf6a'];
const ACCC = ['#e0533d', '#4c8dd9', '#f2b84b', '#4fbf6a', '#ff8fb3', '#222222', '#ffffff', '#8e5cf2'];
const SOCKC = ['#f4f4f4', '#222222', '#1f3b73', '#e0533d', '#ff8fb3', '#f2b84b'];
const EYEC = ['#3a2a1a', '#2b5fa0', '#2f8f5a', '#8a4fd0', '#c0392b', '#555a66', '#d98a2b'];
const NECKC = ['#c8323c', '#2a4f8a', '#f2b84b', '#1e6b4a', '#6b3fa0', '#222222', '#ffffff'];
const FACES = [['round', '동글'], ['wide', '넓적'], ['long', '갸름']];
const EYES = [['dot', '점눈'], ['round', '동그란'], ['big', '크고 반짝'], ['happy', '웃는'], ['sharp', '또렷한'], ['sleepy', '졸린'], ['wink', '윙크'], ['lash', '속눈썹']];
const BROWS = [['normal', '기본'], ['thick', '짙은'], ['up', '올라간'], ['down', '처진'], ['angry', '또렷'], ['none', '없음']];
const MOUTHS = [['smile', '미소'], ['flat', '무표정'], ['open', '활짝'], ['grin', '이빨 웃음'], ['cat', '고양이'], ['smirk', '씩'], ['o', '놀람']];
const CHEEKS = [['none', '없음'], ['blush', '볼터치'], ['freckle', '주근깨'], ['both', '둘 다']];
const MARKS = [['none', '없음'], ['mole', '점'], ['bandaid', '반창고'], ['star', '별 스티커']];
const HAIRHI = [['none', '없음'], ['streak', '포인트 가닥'], ['tips', '끝 염색']];
const TOPS = [['blazer', '교복 재킷'], ['shirt', '반팔 셔츠'], ['tee', '티셔츠'], ['hoodie', '후드티'], ['sports', '체육복'], ['cardigan', '가디건'], ['lab', '실험 가운'], ['work', '작업복'], ['vest', '구명조끼'], ['apron', '앞치마']];
const PATTERNS = [['none', '없음'], ['stripe', '가로줄'], ['vstripe', '세로줄'], ['check', '체크'], ['dots', '물방울']];
const EMBLEMS = [['none', '없음'], ['gear', '톱니(공학)'], ['wave', '물결(수산해양)'], ['book', '책(문화사회)'], ['star', '별'], ['anchor', '닻']];
const BOTTOMS = [['pants', '긴바지'], ['skirt', '치마'], ['pleat', '체크 치마'], ['shorts', '반바지'], ['jogger', '조거팬츠'], ['cargo', '카고바지']];
const NECKS = [['tie', '넥타이'], ['ribbon', '리본'], ['bowtie', '나비넥타이'], ['none', '없음']];
const SHOES = [['sneaker', '운동화'], ['loafer', '로퍼'], ['boots', '부츠'], ['hightop', '하이탑'], ['rain', '장화']];
const SOCKS = [['auto', '기본'], ['none', '맨다리'], ['ankle', '발목 양말'], ['knee', '무릎 양말']];
const BAGT = [['backpack', '책가방'], ['sling', '크로스백'], ['tote', '손가방'], ['waist', '힙색'], ['none', '없음']];
const CHARMS = [['none', '없음'], ['star', '별'], ['heart', '하트'], ['fish', '물고기'], ['gear', '톱니'], ['bear', '곰돌이']];
const ACCS = [['none', '없음'], ['glasses', '안경'], ['sunglasses', '선글라스'], ['cap', '야구모자'], ['beanie', '비니'], ['bucket', '벙거지'], ['beret', '베레모'], ['hardhat', '안전모'], ['captain', '선장 모자'], ['headband', '머리띠'], ['catears', '고양이 귀'], ['crown', '왕관'], ['headphones', '헤드폰'], ['bow', '리본핀'], ['flower', '꽃핀'], ['mask', '마스크']];
const ACC2 = [['none', '없음'], ['scarf', '목도리'], ['necklace', '목걸이'], ['lanyard', '행사 목걸이'], ['watch', '손목시계'], ['earring', '귀걸이']];
const BODIES = [['std', '표준'], ['slim', '슬림'], ['sturdy', '듬직'], ['small', '아담'], ['tall', '키 큼'], ['chubby', '통통'], ['mini', '꼬마']];

export const CUSTOM = [
  { key: 'hairStyle', label: '머리', tab: '머리', list: HAIRSTYLES },
  { key: 'hair', label: '머리색', tab: '머리', list: HAIRC },
  { key: 'hairHi', label: '포인트', tab: '머리', list: HAIRHI },
  { key: 'hairHiColor', label: '포인트색', tab: '머리', list: HAIRC },
  { key: 'face', label: '얼굴형', tab: '얼굴', list: FACES },
  { key: 'skin', label: '피부', tab: '얼굴', list: SKINS },
  { key: 'eye', label: '눈', tab: '얼굴', list: EYES },
  { key: 'eyeColor', label: '눈동자', tab: '얼굴', list: EYEC },
  { key: 'brow', label: '눈썹', tab: '얼굴', list: BROWS },
  { key: 'mouth', label: '입', tab: '얼굴', list: MOUTHS },
  { key: 'cheek', label: '볼', tab: '얼굴', list: CHEEKS },
  { key: 'mark', label: '얼굴 장식', tab: '얼굴', list: MARKS },
  { key: 'top', label: '상의', tab: '옷', list: TOPS },
  { key: 'uniform', label: '상의색', tab: '옷', list: UNIFORMS },
  { key: 'pattern', label: '무늬', tab: '옷', list: PATTERNS },
  { key: 'emblem', label: '가슴 마크', tab: '옷', list: EMBLEMS },
  { key: 'bottom', label: '하의', tab: '옷', list: BOTTOMS },
  { key: 'pants', label: '하의색', tab: '옷', list: PANTS },
  { key: 'neck', label: '목장식', tab: '옷', list: NECKS },
  { key: 'neckColor', label: '장식색', tab: '옷', list: NECKC },
  { key: 'shoes', label: '신발', tab: '신발·가방', list: SHOES },
  { key: 'shoeColor', label: '신발색', tab: '신발·가방', list: SHOEC },
  { key: 'socks', label: '양말', tab: '신발·가방', list: SOCKS },
  { key: 'sockColor', label: '양말색', tab: '신발·가방', list: SOCKC },
  { key: 'bagType', label: '가방', tab: '신발·가방', list: BAGT },
  { key: 'bag', label: '가방색', tab: '신발·가방', list: BAGS },
  { key: 'charm', label: '가방 인형', tab: '신발·가방', list: CHARMS },
  { key: 'acc', label: '모자·머리장식', tab: '꾸미기', list: ACCS },
  { key: 'accColor', label: '색', tab: '꾸미기', list: ACCC },
  { key: 'acc2', label: '목·몸 장식', tab: '꾸미기', list: ACC2 },
  { key: 'acc2Color', label: '장식 색', tab: '꾸미기', list: ACCC },
  { key: 'body', label: '체형', tab: '체형', list: BODIES },
];

export const DEFAULT_LOOK = {
  skin: '#ffe0c7', hair: '#2b1b12', hairStyle: 'short', hairHi: 'none', hairHiColor: '#ff8fb3',
  uniform: '#1f3b73', bag: '#e0a43a',
  top: 'blazer', pattern: 'none', emblem: 'none', bottom: 'pants', pants: '#2b2f3a', neck: 'tie', neckColor: '#c8323c',
  shoes: 'sneaker', shoeColor: '#2a2d35', socks: 'auto', sockColor: '#f4f4f4', bagType: 'backpack', charm: 'none',
  face: 'round', eye: 'dot', eyeColor: '#3a2a1a', brow: 'normal', mouth: 'smile', cheek: 'none', mark: 'none',
  acc: 'none', accColor: '#e0533d', acc2: 'none', acc2Color: '#f2b84b', body: 'std',
};

/* 무작위: 장식류는 일부러 '없음'을 자주 뽑아 너무 어수선해지지 않게 */
const RARE = { acc: 0.55, acc2: 0.6, charm: 0.5, mark: 0.7, hairHi: 0.6, pattern: 0.6, emblem: 0.55 };
export function randomLook() {
  const out = {};
  CUSTOM.forEach((o) => {
    if (RARE[o.key] && Math.random() < RARE[o.key]) { out[o.key] = 'none'; return; }
    const v = o.list[(Math.random() * o.list.length) | 0];
    out[o.key] = Array.isArray(v) ? v[0] : v;
  });
  return { ...DEFAULT_LOOK, ...out };
}

/* ───────────── 글자 없는 무늬 텍스처(캔버스, 한 번만 만들어 공유) ───────────── */
const texCache = new Map();
function canvasTex(key, w, h, draw, rep) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  texCache.set(key, t); return t;
}
function patternTex(kind) {
  return canvasTex('pat:' + kind, 128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.fillStyle = '#ffffff';
    if (kind === 'stripe') for (let y = 0; y < h; y += 16) x.fillRect(0, y + 4, w, 7);
    else if (kind === 'vstripe') for (let xx = 0; xx < w; xx += 16) x.fillRect(xx + 4, 0, 7, h);
    else if (kind === 'check') { for (let y = 0; y < h; y += 32) x.fillRect(0, y + 12, w, 8); for (let xx = 0; xx < w; xx += 32) x.fillRect(xx + 12, 0, 8, h); }
    else if (kind === 'dots') for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.beginPath(); x.arc(16 + c * 32 + (r % 2 ? 16 : 0), 16 + r * 32, 6, 0, TAU); x.fill(); }
  });
}
function plaidTex(base) {
  return canvasTex('plaid:' + base, 64, 64, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.30)'; x.fillRect(0, 8, w, 6); x.fillRect(8, 0, 6, h);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 36, w, 12); x.fillRect(36, 0, 12, h);
  }, [6, 1]);
}
function emblemTex(kind) {
  return canvasTex('emb:' + kind, 96, 96, (x) => {
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(48, 48, 44, 0, TAU); x.fill();
    x.strokeStyle = '#1f3b73'; x.fillStyle = '#1f3b73'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round';
    x.translate(48, 48);
    if (kind === 'gear') {
      x.beginPath(); x.arc(0, 0, 17, 0, TAU); x.stroke();
      for (let i = 0; i < 8; i++) { x.save(); x.rotate((i * TAU) / 8); x.fillRect(-4, -31, 8, 12); x.restore(); }
      x.beginPath(); x.arc(0, 0, 6, 0, TAU); x.fill();
    } else if (kind === 'wave') {
      for (const y of [-15, 0, 15]) { x.beginPath(); for (let i = -30; i <= 30; i += 2) { const yy = y + Math.sin(i * 0.18) * 5; if (i === -30) x.moveTo(i, yy); else x.lineTo(i, yy); } x.stroke(); }
    } else if (kind === 'book') {
      x.beginPath(); x.moveTo(0, -14); x.lineTo(0, 22); x.moveTo(0, -14); x.quadraticCurveTo(-16, -24, -30, -16); x.lineTo(-30, 18); x.quadraticCurveTo(-16, 10, 0, 22);
      x.quadraticCurveTo(16, 10, 30, 18); x.lineTo(30, -16); x.quadraticCurveTo(16, -24, 0, -14); x.stroke();
    } else if (kind === 'star') {
      x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 13 : 31, a = -HP + (i * Math.PI) / 5; if (i) x.lineTo(Math.cos(a) * r, Math.sin(a) * r); else x.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill();
    } else if (kind === 'anchor') {
      x.beginPath(); x.arc(0, -25, 6, 0, TAU); x.stroke();
      x.beginPath(); x.moveTo(0, -19); x.lineTo(0, 24); x.moveTo(-12, -9); x.lineTo(12, -9); x.moveTo(-26, 6); x.quadraticCurveTo(-24, 26, 0, 26); x.quadraticCurveTo(24, 26, 26, 6); x.stroke();
    }
  });
}

/* ───────────── 합치기: 같은 재질의 고정 부품을 한 덩이로 ───────────── */
function bake(container, skip) {
  container.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const buckets = new Map(), rm = [];
  container.traverse((o) => {
    if (o === container || !o.isMesh) return;
    for (let p = o.parent; p && p !== container; p = p.parent) if (skip.has(p)) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.map || (o.userData && o.userData.keep)) return;
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    let b = buckets.get(m); if (!b) { b = { pos: [], nor: [], shadow: false }; buckets.set(m, b); }
    b.pos.push(geo.attributes.position.array); b.nor.push(geo.attributes.normal.array); b.shadow = b.shadow || !!o.castShadow;
    rm.push(o);
  });
  rm.forEach((o) => { if (o.parent) o.parent.remove(o); if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  const cat = (arrs) => { let n = 0; arrs.forEach((a) => { n += a.length; }); const out = new Float32Array(n); let off = 0; arrs.forEach((a) => { out.set(a, off); off += a.length; }); return out; };
  buckets.forEach((b, m) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cat(b.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(cat(b.nor), 3));
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = b.shadow; container.add(mesh);
  });
}

const RARC = ['#9aa5b5', '#4fbf6a', '#4c8dd9', '#b06cf0'];
const rc = (d) => RARC[clamp(((d && d.rarity) || 1) - 1, 0, 3)];
const BODY = { std: [1, 1], slim: [0.88, 1.03], sturdy: [1.15, 1], small: [0.95, 0.88], tall: [0.95, 1.12], chubby: [1.22, 0.97], mini: [0.9, 0.78] };
const FACESHAPE = { round: [1, 1, 1], wide: [1.1, 0.95, 1.02], long: [0.92, 1.1, 1] };

/* ───────────── 캐릭터 : 앞쪽이 +Z ─────────────
 * createCharacter(look,{coat}) → { group, walk(t,amt), sit(on), wave(t), stopWave(), swing('L'|'R'), tick(dt), hold(def|null), kick(), setGear({helmet,vest,pack}) }
 * 팔 회전: rotation.x 음수 = 앞으로 들기 / 오른팔(-x쪽) rotation.z 음수 = 옆으로 들기  */
export function createCharacter(look = {}, opts = {}) {
  const { coat = null } = opts;
  const L = { ...DEFAULT_LOOK, ...look };
  const matCache = new Map();
  const M = (c, o = {}) => {
    const col = new THREE.Color(c), k = col.getHexString() + JSON.stringify(o);
    let m = matCache.get(k);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, metalness: 0.02, ...o }); matCache.set(k, m); }
    return m;
  };
  const mb = (c, o = {}) => {
    const col = new THREE.Color(c), k = 'b' + col.getHexString() + JSON.stringify(o);
    let m = matCache.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: col, ...o }); matCache.set(k, m); }
    return m;
  };
  const bx = (w, h, d, m) => new THREE.Mesh(rboxChar(w, h, d), m);
  const tb = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const sp = (r, m, a = 16, b = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, a, b), m);
  const put = (p, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const shade = (c, a) => new THREE.Color(c).offsetHSL(0, 0, a);

  const g = new THREE.Group(), rig = new THREE.Group(), up = new THREE.Group(); g.add(rig); rig.add(up);
  const bs = BODY[L.body] || BODY.std; rig.scale.set(bs[0], bs[1], bs[0]);

  const skinM = M(L.skin), hairM = M(L.hair), hiM = M(L.hairHiColor);
  const top = coat ? 'blazer' : (TOPS.some((t) => t[0] === L.top) ? L.top : 'blazer');
  const topC = coat || L.uniform;
  const LONGSLV = ['blazer', 'hoodie', 'cardigan', 'lab', 'work'];
  const longSleeve = LONGSLV.includes(top);
  const uni = M(topC), torsoM = top === 'vest' ? M('#f4f4f4') : uni;
  const pantsM = M(L.pants), white = M('#f4f4f4'), dark = M('#15171c'), shoeM = M(L.shoeColor);
  const whiteM = M('#f8f8fa'), pupilM = M('#0b0c10'), irisM = M(L.eyeColor, { roughness: 0.3 }), shineM = mb('#ffffff');
  const hairDark = M(new THREE.Color(L.hair).offsetHSL(0, 0, -0.08));

  /* ── 얼굴 바탕(머리 공) ── */
  const [fw, fh, fd] = FACESHAPE[L.face] || FACESHAPE.round;
  const HC = 1.8, HR = 0.3, hA = HR * fw, hB = HR * fh, hC = HR * fd;
  const fz = (x, y) => hC * Math.sqrt(Math.max(0.02, 1 - (x / hA) ** 2 - ((y - HC) / hB) ** 2));
  const onFace = (x, y, off = 0) => {
    const z = fz(x, y) + off, gr = new THREE.Group(); gr.rotation.order = 'YXZ';
    const nx = x / (hA * hA), ny = (y - HC) / (hB * hB), nz = fz(x, y) / (hC * hC);
    gr.rotation.y = Math.atan2(nx, nz); gr.rotation.x = -Math.atan2(ny, Math.hypot(nx, nz));
    gr.position.set(x, y, z); up.add(gr); return gr;
  };

  /* ── 몸통 ── */
  put(up, bx(0.62, 0.72, 0.36, torsoM), 0, 1.15, 0);
  put(up, bx(0.16, 0.14, 0.15, skinM), 0, 1.52, 0);
  if (top !== 'hoodie') put(rig, bx(0.64, 0.06, 0.38, dark), 0, 0.82, 0);
  const trim = M(shade(topC, -0.12));
  if (top === 'blazer') {
    put(up, bx(0.26, 0.12, 0.02, white), 0, 1.46, 0.19); put(up, bx(0.2, 0.3, 0.01, white), 0, 1.31, 0.185);
    const gold = M('#e8c25a', { metalness: 0.5 }); put(up, sp(0.02, gold, 8, 6), 0.1, 1.05, 0.185); put(up, sp(0.02, gold, 8, 6), 0.1, 0.92, 0.185);
    put(up, bx(0.14, 0.1, 0.02, M(shade(topC, -0.12))), -0.18, 1.2, 0.185);
  } else if (top === 'shirt') {
    put(up, bx(0.3, 0.1, 0.03, white), 0, 1.47, 0.19);
    for (let i = 0; i < 4; i++) put(up, sp(0.015, white, 6, 4), 0, 1.3 - i * 0.15, 0.185);
  } else if (top === 'tee') {
    put(up, bx(0.25, 0.05, 0.03, trim), 0, 1.485, 0.185); put(up, bx(0.64, 0.04, 0.38, trim), 0, 0.84, 0);
  } else if (top === 'hoodie') {
    const hd = sp(0.25, uni, 14, 10); hd.scale.set(1.25, 0.6, 0.65); put(up, hd, 0, 1.52, -0.2);
    put(up, bx(0.42, 0.18, 0.02, M(shade(topC, -0.1))), 0, 0.95, 0.185);
    put(up, bx(0.02, 0.2, 0.02, white), 0.07, 1.38, 0.19); put(up, bx(0.02, 0.2, 0.02, white), -0.07, 1.38, 0.19);
  } else if (top === 'sports') {
    put(up, bx(0.04, 0.72, 0.37, white), 0.31, 1.15, 0); put(up, bx(0.04, 0.72, 0.37, white), -0.31, 1.15, 0);
    put(up, bx(0.2, 0.06, 0.02, white), 0, 1.47, 0.19); put(up, bx(0.14, 0.14, 0.01, white), 0, 1.2, 0.185);
  } else if (top === 'cardigan') {
    put(up, bx(0.22, 0.62, 0.01, white), 0, 1.19, 0.186);
    put(up, bx(0.04, 0.68, 0.02, trim), 0.12, 1.15, 0.19); put(up, bx(0.04, 0.68, 0.02, trim), -0.12, 1.15, 0.19);
    for (let i = 0; i < 3; i++) put(up, sp(0.016, M('#e8c25a', { metalness: 0.4 }), 6, 4), 0, 1.28 - i * 0.17, 0.2);
    put(up, bx(0.64, 0.05, 0.38, trim), 0, 0.85, 0);
  } else if (top === 'lab') {
    put(rig, bx(0.66, 0.34, 0.4, uni), 0, 0.66, 0);
    const lp = M(shade(topC, -0.06));
    for (const s of [-1, 1]) { const c = bx(0.14, 0.1, 0.03, lp); c.rotation.z = -s * 0.5; put(up, c, s * 0.09, 1.46, 0.19); }
    put(up, bx(0.14, 0.2, 0.01, white), 0, 1.36, 0.186); put(up, bx(0.03, 0.74, 0.02, lp), 0, 1.1, 0.19);
    put(rig, bx(0.15, 0.12, 0.03, lp), 0.17, 0.72, 0.205); put(rig, bx(0.15, 0.12, 0.03, lp), -0.17, 0.72, 0.205);
    put(up, tb(0.1, 0.04, 0.012, M('#2f6fed')), -0.16, 1.3, 0.19);
  } else if (top === 'work') {
    const hv = M('#d6ef3a', { roughness: 0.5 });
    put(up, bx(0.3, 0.08, 0.04, trim), 0, 1.49, 0.17);
    put(up, bx(0.14, 0.11, 0.025, trim), 0.16, 1.26, 0.19); put(up, bx(0.14, 0.11, 0.025, trim), -0.16, 1.26, 0.19);
    put(up, bx(0.635, 0.05, 0.365, hv), 0, 0.98, 0); put(up, bx(0.635, 0.05, 0.365, hv), 0, 0.89, 0);
    put(up, tb(0.06, 0.55, 0.02, hv), 0.17, 1.2, 0.185); put(up, tb(0.06, 0.55, 0.02, hv), -0.17, 1.2, 0.185);
  } else if (top === 'vest') {
    put(up, bx(0.67, 0.5, 0.4, uni), 0, 1.2, 0);
    for (const s of [-1, 1]) put(up, bx(0.2, 0.13, 0.4, trim), s * 0.2, 1.48, 0);
    put(up, tb(0.05, 0.22, 0.02, dark), 0, 1.2, 0.205);
    put(up, tb(0.12, 0.07, 0.01, M('#e8eef5')), 0.18, 1.3, 0.205); put(up, tb(0.12, 0.07, 0.01, M('#e8eef5')), -0.18, 1.3, 0.205);
    put(up, tb(0.6, 0.04, 0.02, M('#e8eef5')), 0, 1.03, 0.205);
  } else if (top === 'apron') {
    const cr = M('#f1e7d2');
    put(up, bx(0.5, 0.56, 0.03, cr), 0, 1.0, 0.2); put(up, bx(0.3, 0.2, 0.03, cr), 0, 1.38, 0.2);
    for (const s of [-1, 1]) { const st = tb(0.035, 0.22, 0.02, cr); st.rotation.z = s * 0.35; put(up, st, s * 0.12, 1.5, 0.19); }
    put(up, tb(0.22, 0.12, 0.02, M('#d9ccb0')), 0, 0.9, 0.222); put(up, tb(0.64, 0.035, 0.38, cr), 0, 0.88, 0);
  }

  /* 상의 무늬(몸통 앞·뒤에 투명 덧판) */
  if (!coat && L.pattern !== 'none' && ['shirt', 'tee', 'hoodie', 'sports', 'cardigan'].includes(top)) {
    const lum = new THREE.Color(topC).getHSL({}).l, pc = lum > 0.55 ? shade(topC, -0.28) : shade(topC, 0.3);
    const pm = new THREE.MeshStandardMaterial({ color: pc, map: patternTex(L.pattern), transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.66), pm); f.position.set(0, 1.15, 0.1835); up.add(f);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.66), pm); b.position.set(0, 1.15, -0.1835); b.rotation.y = Math.PI; up.add(b);
  }
  /* 가슴 마크 */
  if (L.emblem !== 'none' && top !== 'apron') {
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: emblemTex(L.emblem), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    em.position.set(0.15, 1.31, top === 'vest' ? 0.208 : 0.19); up.add(em);
  }
  /* 목장식 */
  if (['blazer', 'shirt', 'cardigan'].includes(top)) {
    const nc = M(L.neckColor);
    if (L.neck === 'tie') { put(up, bx(0.07, 0.34, 0.02, nc), 0, 1.27, 0.2); put(up, bx(0.09, 0.07, 0.025, nc), 0, 1.43, 0.2); }
    else if (L.neck === 'ribbon') {
      const a = bx(0.13, 0.09, 0.03, nc); a.rotation.z = 0.35; put(up, a, 0.08, 1.42, 0.2);
      const b = bx(0.13, 0.09, 0.03, nc); b.rotation.z = -0.35; put(up, b, -0.08, 1.42, 0.2);
      put(up, bx(0.06, 0.06, 0.04, nc), 0, 1.42, 0.205); put(up, bx(0.04, 0.2, 0.02, nc), -0.03, 1.28, 0.2); put(up, bx(0.04, 0.2, 0.02, nc), 0.03, 1.28, 0.2);
    } else if (L.neck === 'bowtie') {
      const a = bx(0.1, 0.08, 0.03, nc); a.rotation.z = 0.3; put(up, a, 0.07, 1.43, 0.2);
      const b = bx(0.1, 0.08, 0.03, nc); b.rotation.z = -0.3; put(up, b, -0.07, 1.43, 0.2); put(up, bx(0.045, 0.06, 0.04, nc), 0, 1.43, 0.205);
    }
  }

  /* ── 얼굴 ── */
  const head = sp(HR, skinM, 30, 22); head.scale.set(fw, fh, fd); put(up, head, 0, HC, 0);
  for (const s of [-1, 1]) { const ear = sp(0.06, skinM, 10, 8); ear.scale.set(0.6, 1, 0.8); put(up, ear, s * (hA + 0.004), 1.78, -0.01); }
  { const nose = sp(0.02, M(shade(L.skin, -0.07)), 8, 6); nose.scale.set(1, 0.85, 0.9); const gr = onFace(0, 1.737, 0.003); put(gr, nose, 0, 0, 0.004); }

  const eyeX = 0.108 * fw, eyeY = 1.765;
  const buildEye = (sx, style) => {
    const gr = onFace(sx * eyeX, eyeY, 0);
    const A = (m, x, y, z, a = 1, b = 1, c = 0.35) => { m.scale.set(a, b, c); return put(gr, m, x, y, z); };
    const shine = (x, y, z, r = 0.012) => A(sp(r, shineM, 6, 4), x, y, z, 1, 1, 0.5);
    const lid = (w, y, rz, th = 0.012) => { const o = tb(w, th, 0.012, dark); o.rotation.z = rz; return put(gr, o, 0, y, 0.016); };
    const open = (big) => {
      A(sp(0.058, whiteM, 14, 10), 0, 0, 0.004, 1, big ? 1.18 : 1.05);
      A(sp(big ? 0.05 : 0.04, irisM, 14, 10), 0, big ? -0.005 : -0.002, 0.014, 1, big ? 1.18 : 1.1);
      A(sp(big ? 0.027 : 0.021, pupilM, 10, 8), 0, big ? -0.005 : -0.002, 0.024);
      shine(0.016, 0.02, 0.034); if (big) shine(-0.015, -0.022, 0.034, 0.008);
    };
    if (style === 'happy' || (style === 'wink' && sx === 1)) { put(gr, new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 6, 14, Math.PI), dark), 0, -0.014, 0.01); }
    else if (style === 'dot') { A(sp(0.04, pupilM, 10, 8), 0, 0, 0.012, 0.85, 1.2, 0.5); shine(0.01, 0.014, 0.026, 0.01); }
    else if (style === 'big') { open(true); lid(0.13, 0.068, -sx * 0.1); }
    else if (style === 'sharp') {
      A(sp(0.056, whiteM, 14, 10), 0, 0, 0.004, 1.15, 0.62); A(sp(0.034, irisM, 12, 8), 0, -0.002, 0.012, 1, 0.85); A(sp(0.02, pupilM, 8, 6), 0, -0.002, 0.02);
      shine(0.012, 0.008, 0.03, 0.009); lid(0.14, 0.034, sx * 0.22, 0.018);
    } else if (style === 'sleepy') {
      open(false); put(gr, tb(0.14, 0.05, 0.03, skinM), 0, 0.04, 0.03); put(gr, tb(0.12, 0.01, 0.012, dark), 0, 0.013, 0.047);
    } else if (style === 'lash') {
      open(false);
      for (let k = 0; k < 3; k++) { const l = tb(0.006, 0.03, 0.008, dark); l.rotation.z = -sx * (0.5 + k * 0.3); put(gr, l, sx * (0.046 + k * 0.01), 0.05 - k * 0.013, 0.02); }
    } else open(false);
  };
  const BROW_ROT = { normal: 0.06, thick: 0.05, up: 0.16, down: -0.22, angry: 0.3 };
  const buildBrow = (sx) => {
    const t = L.brow; if (t === 'none') return;
    const gr = onFace(sx * eyeX, 1.845 + (t === 'up' ? 0.012 : 0), 0);
    const b = tb(t === 'thick' ? 0.1 : 0.088, t === 'thick' ? 0.026 : 0.015, 0.016, hairDark);
    b.rotation.z = sx * (BROW_ROT[t] !== undefined ? BROW_ROT[t] : 0.06); put(gr, b, 0, 0, 0.008);
  };
  for (const s of [-1, 1]) { buildEye(s, L.eye); buildBrow(s); }

  if (L.acc !== 'mask') {
    const gr = onFace(0, 1.698, 0), mm = M('#a0524a'), mr = M('#7a2a2a'), pink = M('#e8707a');
    const arc = (r, x, y, rz = Math.PI, t = 0.011) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 12, Math.PI), mm); o.rotation.z = rz; return put(gr, o, x, y, 0.006); };
    switch (L.mouth) {
      case 'open': { const m = sp(0.04, mr, 10, 8); m.scale.set(1, 0.8, 0.35); put(gr, m, 0, 0.005, 0.006); const tg = sp(0.022, pink, 8, 6); tg.scale.set(1.2, 0.6, 0.4); put(gr, tg, 0, -0.012, 0.016); put(gr, tb(0.06, 0.014, 0.01, whiteM), 0, 0.022, 0.018); break; }
      case 'grin': put(gr, tb(0.11, 0.05, 0.012, mr), 0, 0.005, 0.008); put(gr, tb(0.095, 0.024, 0.012, whiteM), 0, 0.014, 0.016); arc(0.05, 0, 0.03, Math.PI, 0.008); break;
      case 'cat': arc(0.022, -0.022, 0.02, Math.PI, 0.009); arc(0.022, 0.022, 0.02, Math.PI, 0.009); put(gr, tb(0.01, 0.025, 0.01, mm), 0, 0.03, 0.006); break;
      case 'smirk': arc(0.045, 0.012, 0.03, Math.PI + 0.18); put(gr, sp(0.008, mm, 4, 4), 0.058, 0.032, 0.008); break;
      case 'o': { const m = sp(0.022, mr, 10, 8); m.scale.set(1, 1.2, 0.35); put(gr, m, 0, 0, 0.008); break; }
      case 'flat': put(gr, tb(0.09, 0.014, 0.01, mm), 0, 0.005, 0.006); break;
      default: arc(0.045, 0, 0.03);
    }
  }
  if (L.cheek === 'blush' || L.cheek === 'both') {
    for (const s of [-1, 1]) { const gr = onFace(s * 0.17 * fw, 1.72, 0.002); put(gr, new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), mb('#ff8fa3', { transparent: true, opacity: 0.55 })), 0, 0, 0.001).castShadow = false; }
  }
  if (L.cheek === 'freckle' || L.cheek === 'both') {
    const fk = M('#9a6a45');
    for (const s of [-1, 1]) for (const [dx, dy] of [[-0.02, 0.012], [0.02, 0.018], [0, -0.012], [0.035, -0.008]]) { const gr = onFace(s * 0.12 * fw + dx, 1.727 + dy, 0.002); put(gr, sp(0.007, fk, 4, 4), 0, 0, 0.002); }
  }
  if (L.mark === 'mole') { const gr = onFace(0.07, 1.69, 0.002); put(gr, sp(0.009, M('#3a2a1a'), 5, 4), 0, 0, 0.002); }
  else if (L.mark === 'bandaid') {
    const gr = onFace(-0.15 * fw, 1.74, 0.004), b = tb(0.1, 0.034, 0.008, M('#f0c9a0')); b.rotation.z = 0.5; put(gr, b, 0, 0, 0.004);
    const c = tb(0.04, 0.034, 0.01, M('#e6b88a')); c.rotation.z = 0.5; put(gr, c, 0, 0, 0.006);
  } else if (L.mark === 'star') {
    const gr = onFace(0.15 * fw, 1.725, 0.004), sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.014 : 0.034, a = HP + (i * Math.PI) / 5; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    sh.closePath(); put(gr, new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), M('#ffd34d', { emissive: '#7a5a00', emissiveIntensity: 0.4 })), 0, 0, 0.002);
  }

  /* ── 머리카락 ── */
  const style = HAIRSTYLES.some((h) => h[0] === L.hairStyle) ? L.hairStyle : 'short';
  const hairBox = (w, h, d, x, y, z, m = hairM, rx = 0, rz = 0) => { const o = bx(w, h, d, m); o.rotation.set(rx, 0, rz); return put(up, o, x, y, z); };
  const dome = (r, te) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 16, 0, TAU, 0, te * Math.PI), hairM); o.scale.set(fw, fh, fd * 1.02); return put(up, o, 0, 1.81, 0); };
  const shell = (te) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.322, 26, 14, Math.PI - 0.55, Math.PI + 1.1, 0.3 * Math.PI, (te - 0.3) * Math.PI), hairM); o.scale.set(fw, fh, fd * 1.02); return put(up, o, 0, 1.81, 0); };
  const bangPiece = (a, len, w, m = hairM, tz = 0, fwd = 0) => {
    const rho = 0.305 - len * 0.12, o = bx(w, len, 0.045, m); o.rotation.order = 'YXZ'; o.rotation.set(0.25, a, tz);
    return put(up, o, Math.sin(a) * rho * fw, 1.925 - len / 2, Math.cos(a) * rho + fwd);
  };
  const bangs = (kind) => {
    if (kind === 'straight') { const ln = [0.05, 0.066, 0.078, 0.066, 0.05]; [-2, -1, 0, 1, 2].forEach((i) => bangPiece(i * 0.34, ln[i + 2], 0.12)); }
    else if (kind === 'center') { const ln = { 1: 0.085, 2: 0.075, 3: 0.06 }; [-3, -2, -1, 1, 2, 3].forEach((i) => bangPiece(i * 0.3 - Math.sign(i) * 0.04, ln[Math.abs(i)], 0.11, hairM, Math.sign(i) * 0.3)); }
    else if (kind === 'sweep') [-3, -2, -1, 0, 1, 2, 3].forEach((i) => bangPiece(i * 0.3, 0.045 + (i + 3) * 0.012, 0.11, hairM, 0.45));
  };
  const sideLocks = (h, y, z = -0.04) => { for (const s of [-1, 1]) hairBox(0.08, h, 0.3, s * 0.31 * fw, y, z); };
  const frontLocks = (y) => { for (const s of [-1, 1]) hairBox(0.09, 0.4, 0.1, s * 0.26, y, 0.17); };
  const tips = L.hairHi === 'tips';
  const tipBand = (w, h, d, x, y, z) => { if (tips) hairBox(w, h, d, x, y, z, hiM); };
  const tipBall = (r, x, y, z) => { if (tips) put(up, sp(r, hiM, 8, 6), x, y, z); };

  if (style === 'buzz') dome(0.312, 0.47);
  else {
    dome(0.328, 0.4);
    shell(style === 'bob' ? 0.66 : ['long', 'wavy', 'wolf', 'braid'].includes(style) ? 0.62 : style === 'curly' ? 0.5 : 0.52);
  }
  switch (style) {
    case 'short': bangs('straight'); break;
    case 'side': bangs('sweep'); break;
    case 'bob': bangs('straight'); hairBox(0.68, 0.42, 0.2, 0, 1.72, -0.16); sideLocks(0.34, 1.74); tipBand(0.68, 0.08, 0.21, 0, 1.54, -0.16); break;
    case 'long': bangs('center'); hairBox(0.68, 0.85, 0.18, 0, 1.5, -0.2); sideLocks(0.5, 1.66); frontLocks(1.34); tipBand(0.68, 0.14, 0.19, 0, 1.14, -0.2); break;
    case 'wavy':
      bangs('center'); hairBox(0.7, 0.78, 0.18, 0, 1.52, -0.2); sideLocks(0.5, 1.64); frontLocks(1.34);
      for (let i = 0; i < 5; i++) put(up, sp(0.1, i % 2 && tips ? hiM : hairM, 8, 6), -0.28 + i * 0.14, 1.1, -0.2);
      put(up, sp(0.1, hairM, 8, 6), 0.34, 1.4, -0.02); put(up, sp(0.1, hairM, 8, 6), -0.34, 1.4, -0.02); break;
    case 'curly': {
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; put(up, sp(0.11, hairM, 8, 6), Math.cos(a) * 0.26 * fw, 1.97, Math.sin(a) * 0.26); }
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.3; put(up, sp(0.11, hairM, 8, 6), Math.cos(a) * 0.15, 2.09, Math.sin(a) * 0.15); }
      put(up, sp(0.12, hairM, 8, 6), 0, 2.18, 0);
      for (let k = 0; k < 7; k++) { const a = Math.PI * 0.85 + (k / 6) * Math.PI * 1.3; put(up, sp(0.1, hairM, 8, 6), Math.cos(a) * 0.27 * fw, 1.8 + (k % 2) * 0.1, Math.sin(a) * 0.27); }
      for (let k = -2; k <= 2; k++) put(up, sp(0.06, hairM, 8, 6), k * 0.1 * fw, 1.9 - Math.abs(k) * 0.008, 0.29 - Math.abs(k) * 0.03);
      break; }
    case 'pony': bangs('straight'); put(up, sp(0.13, hairM), 0, 1.95, -0.32); put(up, new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 4, 8), hairM), 0, 1.62, -0.38); put(up, sp(0.04, M('#e0533d'), 6, 4), 0, 1.99, -0.3); tipBall(0.075, 0, 1.36, -0.38); break;
    case 'twin':
      bangs('straight');
      for (const s of [-1, 1]) { put(up, new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), hairM), s * 0.38, 1.56, -0.04); put(up, sp(0.07, M('#e0533d'), 8, 6), s * 0.36, 1.85, -0.04); tipBall(0.08, s * 0.38, 1.3, -0.04); }
      break;
    case 'bun': bangs('straight'); put(up, sp(0.16, hairM), 0, 2.12, -0.04); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 12), M('#e0533d')); t.rotation.x = HP; put(up, t, 0, 2.0, -0.04); } break;
    case 'braid': {
      bangs('center');
      for (let i = 0; i < 6; i++) put(up, sp(0.078 - i * 0.006, i % 2 && tips ? hiM : hairM, 8, 6), 0.1 + (i % 2) * 0.025, 1.64 - i * 0.1, -0.3);
      put(up, sp(0.035, M('#e0533d'), 6, 4), 0.11, 1.07, -0.3); break; }
    case 'wolf':
      bangs('center'); hairBox(0.62, 0.22, 0.17, 0, 1.64, -0.2, hairM, 0.15); hairBox(0.52, 0.2, 0.15, 0, 1.46, -0.22, hairM, 0.2); hairBox(0.4, 0.16, 0.13, 0, 1.3, -0.24, hairM, 0.25);
      sideLocks(0.38, 1.7, -0.02); for (const s of [-1, 1]) hairBox(0.05, 0.3, 0.05, s * 0.26, 1.7, 0.19); tipBand(0.4, 0.06, 0.14, 0, 1.24, -0.24); break;
    case 'spiky':
      bangs('straight');
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 5), hairM); c.position.set(Math.cos(a) * 0.2, 2.1, Math.sin(a) * 0.2); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); c.castShadow = true; up.add(c); }
      put(up, new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), hairM), 0, 2.16, 0); break;
    default: break;
  }
  if (L.hairHi === 'streak' && style !== 'buzz' && style !== 'curly') {
    bangPiece(-0.6, 0.095, 0.04, hiM, 0.1, 0.008); bangPiece(0.42, 0.105, 0.04, hiM, 0.1, 0.008);
    if (['long', 'wavy', 'wolf', 'bob'].includes(style)) { hairBox(0.04, 0.4, 0.06, 0.29 * fw, 1.66, 0.12, hiM); }
  }

  /* ── 모자 · 머리장식 ── */
  const am = M(L.accColor), amd = M(shade(L.accColor, -0.12)), aml = M(shade(L.accColor, 0.18));
  const hemi = (r, y, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 12, 0, TAU, 0, HP), m); o.scale.set(fw, 1, fd); return put(up, o, 0, y, 0); };
  const visor = (r, y, z, m) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.025, 18, 1, false, -HP, Math.PI), m); o.rotation.x = 0.12; return put(up, o, 0, y, z); };
  const ringH = (r, tube, y, m) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), m); t.rotation.x = HP; return put(up, t, 0, y, 0); };
  const gz = eyeY;
  switch (L.acc) {
    case 'glasses': case 'sunglasses':
      for (const s of [-1, 1]) {
        if (L.acc === 'sunglasses') put(up, tb(0.15, 0.09, 0.02, M('#111418')), s * eyeX, gz, 0.325);
        else put(up, new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 18), am), s * eyeX, gz, 0.325);
        put(up, tb(0.01, 0.01, 0.3, am), s * (hA + 0.002), gz + 0.01, 0.17);
      }
      put(up, tb(0.06, 0.012, 0.012, am), 0, gz + 0.01, 0.327); break;
    case 'cap': hemi(0.35, 1.87, am); visor(0.27, 1.86, 0.2, amd); break;
    case 'hardhat': hemi(0.36, 1.86, am); put(up, tb(0.07, 0.05, 0.52, amd), 0, 2.225, 0); visor(0.28, 1.85, 0.16, am); break;
    case 'beanie': hemi(0.35, 1.84, am); ringH(0.34, 0.05, 1.87, amd); put(up, sp(0.07, aml, 10, 8), 0, 2.2, 0); break;
    case 'bucket': hemi(0.34, 1.87, am); put(up, new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 28), am), 0, 1.9, 0); ringH(0.345, 0.018, 1.92, amd); break;
    case 'beret': { const o = sp(0.38, am, 20, 12); o.scale.set(1, 0.42, 1); o.rotation.z = -0.15; put(up, o, 0.05, 2.0, 0); put(up, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), amd), 0.05, 2.15, 0); break; }
    case 'captain': {
      hemi(0.35, 1.86, white); put(up, new THREE.Mesh(new THREE.CylinderGeometry(0.353, 0.353, 0.07, 24, 1, true), M('#1b2836', { side: THREE.DoubleSide })), 0, 1.9, 0);
      visor(0.26, 1.88, 0.2, dark); put(up, tb(0.09, 0.09, 0.012, M('#e8c25a', { metalness: 0.5 })), 0, 1.96, 0.345); break; }
    case 'headband': ringH(0.31, 0.03, 1.93, am); break;
    case 'catears':
      ringH(0.31, 0.03, 1.93, am);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), am); e.rotation.z = -s * 0.25; put(up, e, s * 0.17, 2.15, 0.02); const i = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), M('#ff9fb8')); i.rotation.z = -s * 0.25; put(up, i, s * 0.17, 2.13, 0.05); }
      break;
    case 'crown': {
      const gm = M(L.accColor, { metalness: 0.45, roughness: 0.4 });
      put(up, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 14, 1, true), M(L.accColor, { metalness: 0.45, roughness: 0.4, side: THREE.DoubleSide })), 0, 2.14, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; put(up, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), gm), Math.cos(a) * 0.21, 2.24, Math.sin(a) * 0.21); }
      break; }
    case 'headphones':
      put(up, new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 20, Math.PI), M('#2a2d35')), 0, 1.8, 0);
      for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 14), am); c.rotation.z = HP; put(up, c, s * 0.34, 1.8, 0); }
      break;
    case 'mask': put(up, bx(0.34, 0.15, 0.07, M(L.accColor === '#222222' ? '#2a2d35' : '#f1f3f6')), 0, 1.688, 0.262); break;
    case 'bow': { const a = bx(0.12, 0.08, 0.03, am); a.rotation.z = 0.5; put(up, a, 0.27, 1.99, 0.1); const b = bx(0.12, 0.08, 0.03, am); b.rotation.z = -0.5; put(up, b, 0.17, 1.99, 0.1); put(up, sp(0.035, am, 6, 4), 0.22, 1.99, 0.1); break; }
    case 'flower':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; put(up, sp(0.04, am, 8, 6), 0.21 + Math.cos(a) * 0.05, 2.045, 0.13 + Math.sin(a) * 0.05); }
      put(up, sp(0.03, M('#ffd34d'), 8, 6), 0.21, 2.05, 0.13); break;
    default: break;
  }
  /* 목·몸 장식(귀걸이·목도리·목걸이·행사 목걸이) */
  const a2 = M(L.acc2Color, { metalness: 0.3 });
  if (L.acc2 === 'earring') { for (const s of [-1, 1]) { put(up, sp(0.018, a2, 6, 4), s * (hA + 0.01), 1.72, -0.01); put(up, sp(0.012, a2, 6, 4), s * (hA + 0.01), 1.69, -0.01); } }
  else if (L.acc2 === 'scarf') { ringH(0.18, 0.065, 1.5, M(L.acc2Color, { roughness: 0.95 })); put(up, bx(0.11, 0.34, 0.06, M(L.acc2Color, { roughness: 0.95 })), 0.1, 1.3, 0.2); put(up, bx(0.11, 0.05, 0.065, M(shade(L.acc2Color, -0.15))), 0.1, 1.17, 0.2); }
  else if (L.acc2 === 'necklace') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 16, Math.PI), a2); t.rotation.z = Math.PI; put(up, t, 0, 1.5, 0.19); put(up, sp(0.028, a2, 8, 6), 0, 1.39, 0.2); }
  else if (L.acc2 === 'lanyard') {
    const ln = M(L.acc2Color, { roughness: 0.9 });
    for (const s of [-1, 1]) { const b = tb(0.025, 0.4, 0.012, ln); b.rotation.z = s * 0.2; put(up, b, s * 0.095, 1.3, 0.2); }
    put(up, tb(0.14, 0.18, 0.012, white), 0, 1.08, 0.205); put(up, tb(0.14, 0.04, 0.014, ln), 0, 1.15, 0.206);
  }

  /* ── 팔 · 다리 ── */
  const mkArm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.47, 0); p.rotation.order = 'YXZ'; up.add(p);
    const slv = top === 'vest' ? white : uni;
    if (longSleeve) { put(p, bx(0.18, 0.5, 0.18, slv), 0, -0.25, 0); put(p, bx(0.19, 0.05, 0.19, M(shade(topC, -0.12))), 0, -0.47, 0); }
    else {
      put(p, bx(0.19, 0.27, 0.19, slv), 0, -0.135, 0); put(p, bx(0.15, 0.25, 0.15, skinM), 0, -0.4, 0);
      if (top === 'sports') put(p, bx(0.2, 0.04, 0.2, white), 0, -0.22, 0);
      if (top === 'tee') put(p, bx(0.2, 0.035, 0.2, trim), 0, -0.25, 0);
    }
    put(p, sp(0.09, skinM, 10, 8), 0, -0.56, 0);
    if (L.acc2 === 'watch' && x > 0) { put(p, bx(0.2, 0.05, 0.2, a2), 0, -0.5, 0); put(p, tb(0.09, 0.012, 0.09, dark), 0, -0.5, 0); put(p, tb(0.07, 0.02, 0.02, white), 0, -0.5, 0.101); }
    return p;
  };
  const bottom = BOTTOMS.some((b) => b[0] === L.bottom) ? L.bottom : 'pants';
  const skirtLike = bottom === 'skirt' || bottom === 'pleat';
  const sockMode = L.socks === 'auto' ? (skirtLike ? 'knee' : bottom === 'shorts' ? 'ankle' : 'none') : L.socks;
  const bare = skirtLike || bottom === 'shorts';
  const sockM = M(L.sockColor);
  const mkLeg = (x, out) => {
    const p = new THREE.Group(); p.position.set(x, 0.8, 0); rig.add(p);
    if (bare) put(p, bx(0.2, 0.72, 0.2, skinM), 0, -0.36, 0); else put(p, bx(0.22, 0.72, 0.22, pantsM), 0, -0.36, 0);
    if (bottom === 'shorts') put(p, bx(0.245, 0.3, 0.245, pantsM), 0, -0.15, 0);
    if (bottom === 'jogger') { put(p, bx(0.24, 0.1, 0.24, M(shade(L.pants, -0.12))), 0, -0.65, 0); put(p, tb(0.012, 0.6, 0.05, white), out * 0.113, -0.34, 0); }
    if (bottom === 'cargo') put(p, bx(0.05, 0.17, 0.15, M(shade(L.pants, -0.08))), out * 0.125, -0.2, 0);
    if (bare && sockMode === 'knee') put(p, bx(0.215, 0.34, 0.215, sockM), 0, -0.55, 0);
    else if (bare && sockMode === 'ankle') put(p, bx(0.215, 0.14, 0.215, sockM), 0, -0.64, 0);
    if (L.shoes === 'loafer') { put(p, bx(0.25, 0.12, 0.34, shoeM), 0, -0.74, 0.05); put(p, bx(0.2, 0.03, 0.1, dark), 0, -0.785, -0.05); }
    else if (L.shoes === 'boots') { put(p, bx(0.26, 0.3, 0.26, shoeM), 0, -0.6, 0); put(p, bx(0.26, 0.1, 0.36, shoeM), 0, -0.73, 0.05); put(p, bx(0.27, 0.04, 0.38, dark), 0, -0.78, 0.05); }
    else if (L.shoes === 'rain') { put(p, bx(0.27, 0.42, 0.27, shoeM), 0, -0.56, 0); put(p, bx(0.27, 0.1, 0.38, shoeM), 0, -0.73, 0.05); put(p, bx(0.275, 0.04, 0.39, dark), 0, -0.78, 0.05); put(p, bx(0.28, 0.04, 0.28, M(shade(L.shoeColor, 0.2))), 0, -0.36, 0); }
    else {
      put(p, bx(0.26, 0.05, 0.36, white), 0, -0.775, 0.05); put(p, bx(0.25, 0.1, 0.3, shoeM), 0, -0.71, 0.03); put(p, bx(0.12, 0.02, 0.1, white), 0, -0.655, 0.1);
      if (L.shoes === 'hightop') { put(p, bx(0.25, 0.16, 0.25, shoeM), 0, -0.64, 0); put(p, bx(0.255, 0.03, 0.255, white), 0, -0.56, 0); }
    }
    return p;
  };
  const armL = mkArm(0.4), armR = mkArm(-0.4), legL = mkLeg(0.15, 1), legR = mkLeg(-0.15, -1);
  if (bottom === 'skirt') put(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.47, 0.3, 20), pantsM), 0, 0.7, 0);
  else if (bottom === 'pleat') {
    const pm = new THREE.MeshStandardMaterial({ map: plaidTex(L.pants), roughness: 0.85, side: THREE.DoubleSide });
    put(rig, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.36, 24, 1, true), pm), 0, 0.68, 0); put(rig, bx(0.64, 0.05, 0.38, M(shade(L.pants, -0.1))), 0, 0.86, 0);
  }

  /* ── 가방(학교) · 가방 인형 ── */
  const bagG = new THREE.Group(); up.add(bagG);
  const bm = M(L.bag), bd = M(shade(L.bag, -0.12));
  const bagType = BAGT.some((b) => b[0] === L.bagType) ? L.bagType : 'backpack';
  if (bagType === 'backpack') {
    put(bagG, bx(0.5, 0.56, 0.2, bm), 0, 1.2, -0.28); put(bagG, bx(0.36, 0.24, 0.06, bd), 0, 1.08, -0.4); put(bagG, bx(0.12, 0.05, 0.05, bd), 0, 1.5, -0.3);
    put(bagG, bx(0.07, 0.5, 0.04, bd), 0.2, 1.25, 0.19); put(bagG, bx(0.07, 0.5, 0.04, bd), -0.2, 1.25, 0.19);
  } else if (bagType === 'sling') {
    const s1 = bx(0.07, 0.95, 0.02, bd); s1.rotation.z = 0.55; put(bagG, s1, 0, 1.15, 0.19); const s2 = bx(0.07, 0.95, 0.02, bd); s2.rotation.z = 0.55; put(bagG, s2, 0, 1.15, -0.19);
    put(bagG, bx(0.3, 0.22, 0.14, bm), 0.2, 0.92, -0.27); put(bagG, bx(0.3, 0.06, 0.15, bd), 0.2, 1.02, -0.27);
  } else if (bagType === 'tote') {
    put(armL, bx(0.3, 0.24, 0.1, bm), 0.02, -0.72, 0.02); const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), bd); put(armL, h, 0.02, -0.6, 0.02);
  } else if (bagType === 'waist') {
    put(bagG, bx(0.66, 0.07, 0.4, bd), 0, 0.93, 0); put(bagG, bx(0.28, 0.18, 0.1, bm), 0.1, 0.9, 0.24); put(bagG, bx(0.26, 0.04, 0.11, bd), 0.1, 0.97, 0.24);
  }
  if (L.charm !== 'none' && bagType !== 'none') {
    const par = bagType === 'tote' ? armL : bagG;
    const at = { backpack: [0.18, 0.93, -0.43], sling: [0.2, 0.82, -0.36], tote: [0.14, -0.82, 0.02], waist: [0.15, 0.78, 0.26] }[bagType];
    const c = new THREE.Group(); c.position.set(at[0], at[1], at[2]); par.add(c);
    put(c, tb(0.01, 0.07, 0.01, M('#c9ced6', { metalness: 0.6 })), 0, -0.035, 0);
    const bd2 = new THREE.Group(); bd2.position.y = -0.1; c.add(bd2);
    if (L.charm === 'star') {
      const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.024 : 0.055, a = HP + (i * Math.PI) / 5; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      sh.closePath(); const st3 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), M('#ffd34d', { emissive: '#7a5a00', emissiveIntensity: 0.4 })); put(bd2, st3, 0, 0, -0.01);
    } else if (L.charm === 'heart') {
      const hm = M('#ff5d8f'); put(bd2, sp(0.03, hm, 8, 6), -0.022, 0.012, 0); put(bd2, sp(0.03, hm, 8, 6), 0.022, 0.012, 0);
      const cn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8), hm); cn.rotation.z = Math.PI; put(bd2, cn, 0, -0.03, 0);
    } else if (L.charm === 'fish') {
      const f = sp(0.04, M('#3dc8e8'), 10, 8); f.scale.set(1.5, 1, 0.5); put(bd2, f, 0.01, 0, 0);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 3), M('#2aa5c4')); t.rotation.z = -HP; put(bd2, t, -0.065, 0, 0); put(bd2, sp(0.006, dark, 4, 4), 0.04, 0.01, 0.018);
    } else if (L.charm === 'gear') {
      put(bd2, new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.013, 6, 12), M('#9aa5b5', { metalness: 0.5 })), 0, 0, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; put(bd2, tb(0.02, 0.02, 0.026, M('#9aa5b5', { metalness: 0.5 })), Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0); }
    } else if (L.charm === 'bear') {
      const bm2 = M('#a8754a'); put(bd2, sp(0.042, bm2, 10, 8), 0, 0, 0); put(bd2, sp(0.018, bm2, 6, 4), -0.034, 0.036, 0); put(bd2, sp(0.018, bm2, 6, 4), 0.034, 0.036, 0);
      put(bd2, sp(0.016, M('#e8c9a0'), 6, 4), 0, -0.01, 0.036);
    }
  }

  /* ── 장비 (헬멧·조끼·전투가방) — FPS 월드에서만 ── */
  const gearG = new THREE.Group(); up.add(gearG);
  function setGear(o = {}) {
    while (gearG.children.length) gearG.remove(gearG.children[0]);
    bagG.visible = !(o.pack);
    if (o.helmet) {
      const c = rc(o.helmet), hm = M(c, { roughness: 0.5, metalness: 0.2 });
      put(gearG, new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 10, 0, TAU, 0, Math.PI * 0.6), hm), 0, 1.83, 0);
      put(gearG, bx(0.46, 0.05, 0.05, dark), 0, 1.85, 0.34); put(gearG, bx(0.08, 0.05, 0.3, M(shade(c, -0.15))), 0, 2.2, 0);
    }
    if (o.vest) {
      const c = rc(o.vest), vm = M(shade(c, -0.22), { roughness: 0.6 });
      put(gearG, bx(0.69, 0.52, 0.43, vm), 0, 1.2, 0); put(gearG, bx(0.2, 0.08, 0.3, vm), 0.34, 1.46, 0); put(gearG, bx(0.2, 0.08, 0.3, vm), -0.34, 1.46, 0);
      put(gearG, bx(0.5, 0.06, 0.45, M(c)), 0, 1.0, 0); put(gearG, bx(0.16, 0.14, 0.05, M(c)), 0, 1.26, 0.22);
    }
    if (o.pack) {
      const c = rc(o.pack), pm = M(shade(c, -0.2)), big = 1 + Math.min(0.5, ((o.pack.slots || 4) - 4) * 0.06);
      put(gearG, bx(0.56 * big, 0.7 * big, 0.3, pm), 0, 1.2, -0.38); put(gearG, bx(0.4 * big, 0.25, 0.08, M(c)), 0, 1.05, -0.58);
      put(gearG, bx(0.1, 0.12, 0.1, M(c)), 0.34, 1.0, -0.38); put(gearG, bx(0.1, 0.12, 0.1, M(c)), -0.34, 1.0, -0.38);
      put(gearG, bx(0.07, 0.5, 0.04, pm), 0.2, 1.25, 0.2); put(gearG, bx(0.07, 0.5, 0.04, pm), -0.2, 1.25, 0.2);
    }
  }
  setGear({});

  /* ── 들고 있는 총 ── */
  const mount = new THREE.Group(); mount.position.set(-0.17, 1.37, 0.5); up.add(mount);
  let gun = null;
  function hold(def) {
    if (gun) { mount.remove(gun); gun = null; }
    st2.holding = !!def; if (def && gunMaker) { gun = gunMaker(def); mount.add(gun); }
    pose();
  }

  /* ── 애니메이션 상태 ── */
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

  /* 고정 부품 합치기(팔·다리·가방은 각자, 몸통과 머리는 한 번에) */
  try {
    g.updateMatrixWorld(true);
    [armL, armR, legL, legR, bagG].forEach((p) => bake(p, new Set()));
    bake(up, new Set([armL, armR, gearG, mount, bagG]));
    bake(rig, new Set([up, legL, legR]));
  } catch (e) { /* 합치기가 실패해도 그대로 보여요 */ }

  const api = {
    group: g, look: L,
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