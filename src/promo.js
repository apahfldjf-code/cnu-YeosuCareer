/* ═══════════════════════════════════════════════════════════════
 * src/promo.js (신규, C1)
 *  - makeJnuLogo(parent, opts)  : 전남대학교 로고가 천천히 도는 전시물 (돔 안에 놓아요)
 *  - makePromoBoard(root, opts) : 돔 옆 홍보영상 전광판 + 화면 오른쪽 [📺 홍보영상] 버튼 + 영상 창
 *
 *  ▶ 홍보영상 링크는 아래 PROMO.url 한 곳에만 적으면 돼요.
 *     · YouTube 주소  : https://www.youtube.com/watch?v=XXXXXXXXXXX  /  https://youtu.be/XXXXXXXXXXX
 *     · mp4/webm 주소 : https://내서버/promo.mp4  (전광판 화면에서 소리 없이 바로 재생돼요)
 *  ▶ 로고 파일: img/jnu-logo.png (선택). 파일이 없으면 코드로 그린 임시 로고를 써요.
 *     설치형(Electron)에서 PNG 가 막히면 make-logo.cjs 를 한 번 실행해 src/logo-data.js 를 만들어 주세요.
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export const PROMO = {
  url: 'https://player.vimeo.com/progressive_redirect/download/1211873885/container/ec1ddaa3-366c-4d78-bc47-98393ecfe518/b753c0f9-6a7d6d7f/2026_%EC%A0%84%EB%82%A8%EB%8C%80%ED%95%99%EA%B5%90_%ED%99%8D%EB%B3%B4%EC%98%81%EC%83%81_%EA%B5%AD%EB%AC%B8_%EC%B5%9C%EC%A2%85%20%28720p%29.mp4?expires=1793422837&loc=external&signature=fc45328d3b6fb414998854a43c1899301c6ebe089271ade91dfa498b1d1e37b0',                                /* ← 여기에 홍보영상 링크를 붙여 넣으세요 (비워 두면 '준비 중' 화면) */
  title: '전남대학교 여수캠퍼스 홍보영상',
  logoFile: 'img/jnu-logo.png',
  hearNear: 17,   /* 이 거리(m) 안에서는 소리 100% */
  hearFar: 32,    /* 이 거리(m) 밖에서는 소리 0 */
};

const FONT = '"Malgun Gothic","Noto Sans KR",sans-serif';
const GREEN = '#0a8a3a';
const TAU = Math.PI * 2;

/* ───────────── 공용 도구 ───────────── */
const ytId = (u) => {
  const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
};
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** 3D 텍스처로 써도 안전한 그림인지 검사해요 (file:// 나 다른 서버 그림은 막혀서 화면 전체가 멈출 수 있어요) */
function clean(src) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); return true;
  } catch (e) { return false; }
}
function loadImage(src) {
  return new Promise((ok) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => ok(clean(im) ? im : null);
    im.onerror = () => ok(null);
    im.src = src;
  });
}
async function loadLogo() {
  let im = null;
  try { const m = await import('./logo-data.js'); if (m && m.default) im = await loadImage(m.default); } catch (e) { /* 파일이 없으면 무시 */ }
  if (!im) im = await loadImage(PROMO.logoFile);
  return im;
}
let audioMod = null;
import('./audio.js').then((m) => { audioMod = m; }).catch(() => {});
const duck = (sec) => { try { if (audioMod && audioMod.duck) audioMod.duck(sec); } catch (e) { /* 무시 */ } };

/* ───────────── 임시 로고 (PNG 가 없을 때) ───────────── */
function drawLogo(x, S) {
  const c = S / 2;
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(c, c, c, 0, TAU); x.fill();
  x.strokeStyle = GREEN; x.lineWidth = S * 0.014;
  x.beginPath(); x.arc(c, c, c * 0.97, 0, TAU); x.stroke();
  x.beginPath(); x.arc(c, c, c * 0.64, 0, TAU); x.stroke();
  x.fillStyle = GREEN; x.textAlign = 'center'; x.textBaseline = 'middle';
  const ring = (txt, R, a0, step, size, up) => {
    x.font = `900 ${size}px ${FONT}`; const n = txt.length;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * step, a = up ? a0 + off : a0 - off;
      x.save(); x.translate(c + Math.cos(a) * R, c + Math.sin(a) * R); x.rotate(up ? a + Math.PI / 2 : a - Math.PI / 2); x.fillText(txt[i], 0, 0); x.restore();
    }
  };
  ring('전남대학교', c * 0.8, -Math.PI / 2, 0.27, S * 0.11, true);
  ring('CHONNAM NATIONAL UNIVERSITY', c * 0.8, Math.PI / 2, 0.105, S * 0.058, false);
  const e = S * 0.21, rr = S * 0.05;
  x.fillStyle = GREEN; x.beginPath();
  x.moveTo(c - e + rr, c - e); x.arcTo(c + e, c - e, c + e, c + e, rr); x.arcTo(c + e, c + e, c - e, c + e, rr);
  x.arcTo(c - e, c + e, c - e, c - e, rr); x.arcTo(c - e, c - e, c + e, c - e, rr); x.closePath(); x.fill();
  x.fillStyle = '#ffffff'; x.font = `900 ${S * 0.115}px ${FONT}`; x.fillText('전남대', c, c - S * 0.035);
  x.font = `800 ${S * 0.07}px ${FONT}`; x.fillText('JNU', c, c + S * 0.085);
}

/* ═════════════ 1) 회전 로고 ═════════════ */
export function makeJnuLogo(parent, o = {}) {
  const { x = 0, y = 4.9, z = 0, r = 3.1, speed = 0.9, anims = null } = o;
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const fallback = canvasTexture(512, 512, (c) => drawLogo(c, 512));
  const mk = () => new THREE.MeshBasicMaterial({ map: fallback, transparent: true, fog: false, toneMapped: false });
  const geo = new THREE.CircleGeometry(r, 64), mf = mk(), mb = mk();
  const front = new THREE.Mesh(geo, mf); front.position.z = 0.08;
  const back = new THREE.Mesh(geo, mb); back.rotation.y = Math.PI; back.position.z = -0.08;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 64), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
  core.rotation.x = Math.PI / 2; core.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 10, 64), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.4, metalness: 0.2 }));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.8, 10), new THREE.MeshStandardMaterial({ color: '#9aa7b3', metalness: 0.6, roughness: 0.4 }));
  pole.position.y = -r;
  g.add(core, front, back, rim, pole);
  loadLogo().then((im) => {
    if (!im) return;
    const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    mf.map = t; mb.map = t; mf.needsUpdate = true; mb.needsUpdate = true;
  });
  if (anims) anims.push((dt) => { g.rotation.y += dt * speed; });
  return g;
}

/* ═════════════ 2) 전광판 + 영상 창 ═════════════ */
function drawIdle(x, w, h, m1, m2) {
  const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#06361c'); gr.addColorStop(1, '#0b2447'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 2;
  for (let i = -h; i < w; i += 48) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
  const lc = document.createElement('canvas'); lc.width = lc.height = 256; drawLogo(lc.getContext('2d'), 256);
  x.drawImage(lc, 70, h / 2 - 128, 256, 256);
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillStyle = '#ffffff'; x.font = `bold 58px ${FONT}`; x.fillText('전남대학교', 380, h / 2 - 90);
  x.fillStyle = '#9be7b5'; x.font = `bold 44px ${FONT}`; x.fillText('여수캠퍼스 진로탐험', 380, h / 2 - 20);
  x.fillStyle = '#d9e6ff'; x.font = `28px ${FONT}`; x.fillText(m1, 380, h / 2 + 60); x.fillText(m2, 380, h / 2 + 104);
}
function drawPoster(x, w, h, im) {
  x.drawImage(im, 0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(w / 2, h / 2, 74, 0, TAU); x.fill();
  x.fillStyle = GREEN; x.beginPath(); x.moveTo(w / 2 - 22, h / 2 - 40); x.lineTo(w / 2 + 44, h / 2); x.lineTo(w / 2 - 22, h / 2 + 40); x.closePath(); x.fill();
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = `bold 34px ${FONT}`; x.fillText('오른쪽 📺 홍보영상 버튼으로 보기', w / 2, h - 46);
}

let btn = null, ov = null;
function closeOverlay() {
  if (!ov) return;
  document.removeEventListener('keydown', onKey, true);
  ov.remove(); ov = null; duck(0.05);
}
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeOverlay(); } }
function openOverlay(url, yid) {
  if (ov) return;
  ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:8px;box-sizing:border-box;font:600 14px/1.5 "Malgun Gothic","Noto Sans KR",sans-serif;color:#fff';
  ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend', 'click'].forEach((ev) => ov.addEventListener(ev, (e) => e.stopPropagation()));
  const head = document.createElement('div'); head.style.cssText = 'display:flex;gap:10px;align-items:center;width:min(94vw,calc((100vh - 120px)*16/9))';
  const ttl = document.createElement('div'); ttl.textContent = '📺 ' + PROMO.title; ttl.style.cssText = 'flex:1;font-size:16px';
  const close = document.createElement('button'); close.textContent = '✕ 닫기';
  close.style.cssText = 'font:inherit;color:#fff;background:#c0392b;border:0;border-radius:10px;padding:8px 14px;cursor:pointer';
  close.onclick = closeOverlay; head.append(ttl, close); ov.append(head);
  const box = document.createElement('div'); box.style.cssText = 'width:min(94vw,calc((100vh - 120px)*16/9));aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center';
  if (yid) {
    const f = document.createElement('iframe'); f.src = `https://www.youtube.com/embed/${yid}?autoplay=1&rel=0&playsinline=1`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.style.cssText = 'width:100%;height:100%;border:0;background:#000';
    box.append(f);
  } else if (url) {
    const v = document.createElement('video'); v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.style.cssText = 'width:100%;height:100%;background:#000'; box.append(v); v.play().catch(() => {});
  } else {
    box.textContent = '홍보영상 링크가 아직 등록되지 않았어요.\nsrc/promo.js 의 PROMO.url 에 주소를 적어 주세요.'; box.style.whiteSpace = 'pre-wrap'; box.style.padding = '16px';
  }
  ov.append(box);
  if (yid) {
    const row = document.createElement('div'); row.style.cssText = 'font-size:12px;opacity:.85;text-align:center';
    const a = document.createElement('a'); a.href = 'https://www.youtube.com/watch?v=' + yid; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '▶ 영상이 안 나오면 YouTube 에서 열기'; a.style.color = '#9be7b5';
    row.append(a); ov.append(row);
  }
  document.body.append(ov); document.addEventListener('keydown', onKey, true); duck(3600);
}
function makeBtn(onClick) {
  if (btn && btn.isConnected) return btn;
  btn = document.createElement('button'); btn.textContent = '📺 홍보영상';
  btn.style.cssText = 'position:fixed;right:10px;top:42%;z-index:30;display:none;font:700 14px "Malgun Gothic","Noto Sans KR",sans-serif;color:#fff;background:rgba(10,138,58,.92);border:2px solid #fff;border-radius:12px;padding:9px 12px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)';
  ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend'].forEach((ev) => btn.addEventListener(ev, (e) => e.stopPropagation()));
  btn.onclick = onClick; document.body.append(btn); return btn;
}

/**
 * 전광판을 세워요.  opts: { x, z, w(가로 m), anims, col(충돌 등록), label(글자 표지 만들기) }
 * 전광판 앞면은 월드 중심(0,0)을 바라봐요.
 */
export function makePromoBoard(root, o = {}) {
  const { x = 19, z = -11, w = 10, anims = null, col = null, label = null, face = null } = o;
  const h = (w * 9) / 16, ry = face === null ? Math.atan2(-x, -z) : face, c = Math.cos(ry), s = Math.sin(ry);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  const url = (PROMO.url || '').trim(), yid = ytId(url);
  const idle = url ? ['오른쪽의 📺 홍보영상 버튼을', '눌러 보세요!'] : ['홍보영상 준비 중이에요', '곧 만나요!'];
  const idleTex = canvasTexture(1024, 576, (cx, cw, ch) => drawIdle(cx, cw, ch, idle[0], idle[1]));
  const sm = new THREE.MeshBasicMaterial({ map: idleTex, toneMapped: false, fog: false });
  const mesh = (geo, mat, px, py, pz, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const dark = new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 0.6, metalness: 0.4 });
  const baseY = 3.4;
  for (const sx of [-(w / 2 - 0.8), w / 2 - 0.8]) { mesh(new THREE.BoxGeometry(0.35, baseY, 0.35), dark, sx, baseY / 2, -0.1); mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), dark, sx, 0.12, -0.1); }
  mesh(new THREE.BoxGeometry(w + 0.7, h + 0.7, 0.45), dark, 0, baseY + h / 2, 0);
  mesh(new THREE.BoxGeometry(w + 0.7, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: '#103a22', emissive: GREEN, emissiveIntensity: 1.4 }), 0, baseY - 0.34, 0.02, false);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm); screen.position.set(0, baseY + h / 2, 0.24); g.add(screen);
  if (label) { const l = label(PROMO.title, { bg: GREEN, scale: 9 }); l.position.set(0, baseY + h + 1.5, 0); g.add(l); }
  if (col) for (const sx of [-4.2, -2.1, 0, 2.1, 4.2]) col(x + sx * c, z - sx * s, 0.7, 8);

  /* 화면 내용: YouTube → 썸네일, mp4/webm → 전광판에서 바로 재생 (막히면 영상 창으로 대신해요) */
  let video = null, mode = 'idle';
  if (yid) {
    loadImage(`https://img.youtube.com/vi/${yid}/hqdefault.jpg`).then((im) => {
      if (!im) return;
      sm.map = canvasTexture(1024, 576, (cx, cw, ch) => drawPoster(cx, cw, ch, im)); sm.needsUpdate = true; mode = 'poster';
    });
  } else if (url) {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous'; video.loop = true; video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto'; video.src = url;
    video.addEventListener('loadeddata', () => {
      if (!clean(video)) { mode = 'overlay'; return; }
      const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace; sm.map = vt; sm.needsUpdate = true; mode = 'texture';
    });
    video.addEventListener('error', () => { mode = 'overlay'; });
    video.load();
  }

    makeBtn(() => { if (video) video.pause(); openOverlay(url, yid); });

  /* ── D1 : 가까이 가면 소리가 들려요 (거리 기반 볼륨) ── */
  const hearNear = PROMO.hearNear || 12, hearFar = Math.max(hearNear + 1, PROMO.hearFar || 44);
  const camP = new THREE.Vector3(), scrP = new THREE.Vector3();
  let want = 0, cur = 0, unlocked = false, volFixed = null, ducked = false, soundOn = true;
  try { soundOn = localStorage.getItem('cq_promo_snd') !== '0'; } catch (e) { /* 무시 */ }
  const unlockEv = ['pointerup', 'touchend', 'mousedown', 'keydown'];
  const unlock = () => { if (unlocked) return; unlocked = true; unlockEv.forEach((ev) => window.removeEventListener(ev, unlock, true)); };
  unlockEv.forEach((ev) => window.addEventListener(ev, unlock, true));

  const applyVol = () => {
    if (!video || mode !== 'texture') return;
    const on = unlocked && soundOn && !ov && root.visible && !document.hidden;
    if (!on) cur = 0; else { cur += (want - cur) * 0.2; if (Math.abs(want - cur) < 0.004) cur = want; }
    if (cur > 0.01) {
      if (volFixed === null && cur > 0.05 && cur < 0.9) { video.volume = cur; volFixed = Math.abs(video.volume - cur) > 0.05; }
      const m = volFixed ? cur < 0.35 : false;
      if (video.muted !== m) video.muted = m;
      if (!volFixed) video.volume = Math.min(1, cur);
    } else if (!video.muted) video.muted = true;
    if (ov) ducked = false;
    const loud = on && want > 0.3 && cur > 0.2;
    if (loud && !ducked) { ducked = true; duck(3600); }
    else if (ducked && (!on || cur < 0.12)) { ducked = false; duck(0.05); }
  };

  /* 화면을 그릴 때마다 카메라와 전광판의 거리를 재요 (화면 밖을 봐도 계산되도록 culling 해제) */
  let camDist = 9999, nearBtn = false;   /* 카메라와 전광판 사이 거리, 버튼 표시 여부 */
  screen.frustumCulled = false;
  screen.onBeforeRender = (rd, sc, cam) => {
    if (!cam || !cam.isPerspectiveCamera) return;
    cam.getWorldPosition(camP); screen.getWorldPosition(scrP);
    const d = Math.hypot(camP.x - scrP.x, camP.z - scrP.z);
    camDist = d;
    if (!video || mode !== 'texture') return;
    const t = Math.min(1, Math.max(0, (d - hearNear) / (hearFar - hearNear)));
    want = (1 - t) * (1 - t);
    applyVol();
  };

  /* 🔊 소리 켜기/끄기 버튼 (📺 버튼 아래) */
  let sbtn = null;
  if (video) {
    sbtn = document.createElement('button');
    sbtn.style.cssText = 'position:fixed;right:10px;top:calc(42% + 52px);z-index:30;display:none;min-height:40px;font:700 13px "Malgun Gothic","Noto Sans KR",sans-serif;color:#fff;background:rgba(20,30,50,.88);border:2px solid #fff;border-radius:12px;padding:8px 12px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)';
    const paint = () => { sbtn.textContent = soundOn ? '🔊 소리 켬' : '🔇 소리 끔'; };
    ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend'].forEach((ev) => sbtn.addEventListener(ev, (e) => e.stopPropagation()));
    sbtn.onclick = () => { soundOn = !soundOn; try { localStorage.setItem('cq_promo_snd', soundOn ? '1' : '0'); } catch (e) { /* 무시 */ } unlock(); paint(); applyVol(); };
    paint(); document.body.append(sbtn);
  }
  /* 월드가 숨겨졌을 때(레이싱 등)는 화면 그리기가 호출되지 않으니 여기서도 확인해요 */
  setInterval(() => {
    if (sbtn) sbtn.style.display = (btn && btn.style.display === 'block' && mode === 'texture') ? 'block' : 'none';
    applyVol();
  }, 300);

  /* 월드가 보일 때만 버튼을 보여 주고, 영상은 보일 때만 재생해요 */
  setInterval(() => {
    const vis = root.visible && !document.hidden, busy = !!document.querySelector('.screen:not(.hidden)');
    const show = vis && !busy && !ov;
    const R = PROMO.btnDist || 20;   /* 이 거리(m) 안에 들어오면 버튼 표시 */
    nearBtn = nearBtn ? camDist < R + 3 : camDist < R;   /* 경계에서 깜빡이지 않게 3m 여유 */
    if (btn) btn.style.display = (show && nearBtn) ? 'block' : 'none';
    if (video && mode === 'texture') {
      if (show && video.paused) video.play().catch(() => {});
      else if (!show && !video.paused) video.pause();
    }
  }, 400);
  if (anims) anims.push(() => { /* 영상 텍스처는 three.js 가 알아서 갱신해요 */ });
  return g;
}