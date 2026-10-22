// 모든 미니게임은 (host, cfg, finish) 형태. finish(score0~100, extra, delayMs)
import { el, sfx } from './core.js';

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export function runGame(host, cfg, done) {
  host.innerHTML = ''; host.append(el('p', 'mg-desc', cfg.desc || ''));
  const body = el('div', 'mg-body'); host.append(body);
  let ended = false;
  const fin = (s, e, delay = 700) => { if (ended) return; ended = true; setTimeout(() => done(clamp(Math.round(s), 0, 100), e), delay); };
  const disp = GAMES[cfg.type](body, cfg, fin);
  return () => { ended = true; if (disp) disp(); };
}

/* 1) 순서 맞추기 */
function sequence(host, cfg, fin) {
  const items = cfg.items, n = items.length;
  let pool = shuffle(items.map((t, i) => ({ t, i })));
  for (let k = 0; k < 9 && pool.every((p, j) => p.t === items[j]); k++) pool = shuffle(pool);
  let ans = [], tries = 0, over = false; const bad = new Set();
  const ansBox = el('div', 'seq'), poolBox = el('div', 'seq pool'), msg = el('div', 'mg-msg'), btn = el('button', 'btn primary', '제출하기');
  host.append(el('div', 'mg-label', '아래 카드를 순서대로 눌러 쌓으세요 (쌓은 카드를 다시 누르면 취소)'), ansBox, poolBox, msg, btn);
  const card = (p, cls, fn) => { const b = el('button', 'card ' + (cfg.mono ? 'mono ' : '') + cls); b.textContent = p.t; b.onclick = fn; return b; };
  const render = () => {
    ansBox.innerHTML = ''; poolBox.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = el('div', 'slot'); s.append(el('span', 'num', String(i + 1))); const p = ans[i];
      if (p) s.append(card(p, bad.has(i) ? 'bad' : '', () => { if (over) return; ans.splice(i, 1); pool.push(p); bad.clear(); sfx.click(); render(); }));
      ansBox.append(s);
    }
    pool.forEach((p) => poolBox.append(card(p, '', () => { if (over) return; pool = pool.filter((q) => q !== p); ans.push(p); bad.clear(); sfx.click(); render(); })));
    btn.disabled = over || ans.length !== n;
  };
  btn.onclick = () => {
    tries++; const ok = ans.filter((p, i) => p.t === items[i]).length;
    if (ok === n) { over = true; msg.textContent = '🎉 완벽해요!'; sfx.ok(); fin(Math.max(50, 100 - (tries - 1) * 20)); }
    else if (tries >= 3) { over = true; sfx.bad(); msg.innerHTML = '정답 순서<br>' + items.map((t, i) => `${i + 1}. ${t.replace(/ /g, '&nbsp;')}`).join('<br>'); fin((ok / n) * 60, null, 3800); }
    else { sfx.bad(); ans.forEach((p, i) => { if (p.t !== items[i]) bad.add(i); }); msg.textContent = `${ok}/${n}칸이 맞았어요. 빨간 카드를 바꿔 보세요! (기회 ${3 - tries}번 남음)`; }
    render();
  };
  render();
}

/* 2) 짝 맞추기 */
function match(host, cfg, fin) {
  const L = cfg.pairs.map((p, i) => ({ t: p[0], i })), R = shuffle(cfg.pairs.map((p, i) => ({ t: p[1], i })));
  let sel = null, mis = 0; const doneSet = new Set();
  const wrap = el('div', 'match'), lc = el('div', 'mcol'), rc = el('div', 'mcol'), msg = el('div', 'mg-msg');
  wrap.append(lc, rc); host.append(wrap, msg);
  const render = () => {
    lc.innerHTML = ''; rc.innerHTML = '';
    L.forEach((o) => { const b = el('button', 'card' + (doneSet.has(o.i) ? ' ok' : '') + (sel === o.i ? ' sel' : '')); b.textContent = o.t; b.disabled = doneSet.has(o.i); b.onclick = () => { sel = sel === o.i ? null : o.i; sfx.click(); render(); }; lc.append(b); });
    R.forEach((o) => {
      const b = el('button', 'card' + (doneSet.has(o.i) ? ' ok' : '')); b.textContent = o.t; b.disabled = doneSet.has(o.i);
      b.onclick = () => {
        if (sel === null) { msg.textContent = '먼저 왼쪽 카드를 선택하세요.'; return; }
        if (sel === o.i) { doneSet.add(o.i); sel = null; sfx.ok(); msg.textContent = '✅ 정답!'; if (doneSet.size === L.length) { render(); fin(Math.max(30, 100 - mis * 12)); return; } }
        else { mis++; sfx.bad(); msg.textContent = '❌ 다시 생각해 보세요.'; }
        render();
      };
      rc.append(b);
    });
  };
  render();
}

/* 3) 부품 조립(끌어서 놓기) */
function assemble(host, cfg, fin) {
  const NS = 'http://www.w3.org/2000/svg', W = 520, H = 330, n = cfg.parts.length;
  const mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'asm' });
  mk('rect', { width: W, height: H, rx: 14, fill: '#0f2742' }, svg); mk('rect', { x: 10, y: 240, width: W - 20, height: 82, rx: 10, fill: '#16365a' }, svg);
  mk('text', { x: 20, y: 256, fill: '#8fb4de', 'font-size': 11 }, svg).textContent = '부품 보관함 (끌어서 번호 칸에 놓기)';
  (cfg.links || []).forEach(([a, b]) => { const A = cfg.parts[a], B = cfg.parts[b]; mk('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#2f5d92', 'stroke-width': 3, 'stroke-dasharray': '6 5' }, svg); });
  const gear = (r) => { let s = ''; const T = 10; for (let i = 0; i < T; i++) { const a = (i / T) * 6.2832, st = 6.2832 / T; [[0, 0.78], [0.15, 1], [0.4, 1], [0.55, 0.78]].forEach(([o, k]) => { const q = a + st * o; s += `${(Math.cos(q) * r * k).toFixed(1)},${(Math.sin(q) * r * k).toFixed(1)} `; }); } return s; };
  const shape = (g, p, ghost) => {
    const at = ghost ? { fill: 'rgba(120,170,230,.08)', stroke: '#7fb2ee', 'stroke-width': 2, 'stroke-dasharray': '5 4' } : { fill: p.c, stroke: '#fff', 'stroke-width': 1.5 };
    if (p.s === 'circle') mk('circle', { r: p.w / 2, ...at }, g);
    else if (p.s === 'gear') { mk('polygon', { points: gear(p.w / 2), ...at }, g); if (!ghost) mk('circle', { r: p.w / 8, fill: '#0f2742' }, g); }
    else if (p.s === 'tri') mk('polygon', { points: `0,${-p.h / 2} ${p.w / 2},${p.h / 2} ${-p.w / 2},${p.h / 2}`, ...at }, g);
    else mk('rect', { x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: 6, ...at }, g);
  };
  cfg.parts.forEach((p, i) => { const g = mk('g', { transform: `translate(${p.x},${p.y})` }, svg); shape(g, p, true); const b = mk('g', { transform: `translate(${-p.w / 2},${-p.h / 2})` }, g); mk('circle', { r: 9, fill: '#ffcf4a' }, b); mk('text', { y: 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#222' }, b).textContent = i + 1; });
  const msg = el('div', 'mg-msg'), legend = el('ul', 'legend');
  const lis = cfg.parts.map((p, i) => { const li = el('li'); li.textContent = `${i + 1}번 칸 · ${p.hint}`; legend.append(li); return li; });
  host.append(svg, msg, legend);
  const toSvg = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const occupied = []; let mis = 0, placed = 0, over = false;
  const put = (o, big) => { const k = big ? 1 : Math.min(1, 64 / Math.max(o.p.w, o.p.h)); o.g.setAttribute('transform', `translate(${o.cx},${o.cy}) scale(${k})`); };
  shuffle([...Array(n).keys()]).forEach((i, k) => {
    const p = cfg.parts[i], o = { i, p, hx: ((k + 0.5) * W) / n, hy: 280, placed: false, drag: false };
    o.cx = o.hx; o.cy = o.hy; o.g = mk('g', { class: 'part' }, svg); shape(o.g, p, false);
    o.lab = mk('text', { y: p.h / 2 + 13, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'paint-order': 'stroke', stroke: '#0f2742', 'stroke-width': 3 }, o.g); o.lab.textContent = p.n; put(o, false);
    o.g.addEventListener('pointerdown', (e) => { if (o.placed || over) return; o.drag = true; o.g.setPointerCapture(e.pointerId); svg.appendChild(o.g); const pt = toSvg(e); o.cx = pt.x; o.cy = pt.y; put(o, true); e.preventDefault(); });
    o.g.addEventListener('pointermove', (e) => { if (!o.drag) return; const pt = toSvg(e); o.cx = pt.x; o.cy = pt.y; put(o, true); });
    o.g.addEventListener('pointerup', () => {
      if (!o.drag) return; o.drag = false; let hit = -1, bd = 1e9;
      cfg.parts.forEach((s, j) => { if (occupied[j]) return; const d = Math.hypot(o.cx - s.x, o.cy - s.y); if (d < bd) { bd = d; hit = j; } });
      if (bd < 36) {
        if (hit === o.i) { o.cx = p.x; o.cy = p.y; o.placed = true; occupied[hit] = true; o.lab.setAttribute('opacity', 0); put(o, true); sfx.ok(); placed++; msg.textContent = `✅ ${p.n} 조립 완료!`; lis[hit].classList.add('on'); lis[hit].textContent = `✔ ${hit + 1}번 칸 · ${p.n} — ${p.hint}`; if (placed === n) { over = true; fin(Math.max(30, 100 - mis * 10)); } return; }
        mis++; sfx.bad(); msg.textContent = `❌ ${p.n}은(는) 그 자리가 아니에요. 설명을 다시 읽어 보세요.`;
      }
      o.cx = o.hx; o.cy = o.hy; put(o, false);
    });
  });
}

/* 4) 다이얼 맞추기 */
function dial(host, cfg, fin) {
  const S = cfg.sliders.map((s) => { let v = s.t + (Math.random() < 0.5 ? -1 : 1) * rnd(0.25, 0.45) * (s.max - s.min); v = clamp(v, s.min, s.max); return { ...s, v: Math.round(v / s.step) * s.step }; });
  const close = () => clamp(1 - (S.reduce((a, s) => a + Math.abs(s.v - s.t) / (s.max - s.min), 0) / S.length) * 3.5, 0, 1);
  const meter = el('div', 'meter', '<i></i><b></b>'), timeEl = el('div', 'mg-label'), btn = el('button', 'btn primary', '🔒 잠금(결과 확인)');
  host.append(el('div', 'mg-label', cfg.meter + ' (100%에 가깝게!)'), meter, timeEl);
  const fmt = (s) => s.v.toFixed(s.step < 1 ? 1 : 0) + ' ' + s.u;
  const upd = () => { const c = close(); meter.firstChild.style.width = c * 100 + '%'; meter.lastChild.textContent = Math.round(c * 100) + '%'; };
  S.forEach((s) => {
    const row = el('div', 'srow'), inp = el('input'), val = el('span');
    inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = s.v; val.textContent = fmt(s);
    inp.oninput = () => { s.v = +inp.value; val.textContent = fmt(s); upd(); };
    row.append(el('b', '', s.k), inp, val); host.append(row);
  });
  host.append(btn); upd();
  let left = 45, over = false;
  const lock = () => { if (over) return; over = true; clearInterval(tm); btn.disabled = true; const c = close(); sfx[c > 0.7 ? 'ok' : 'bad'](); fin(c * 100); };
  const tm = setInterval(() => { left--; timeEl.textContent = `⏱ 남은 시간 ${left}초 (끝나면 자동 잠금)`; if (left <= 0) lock(); }, 1000);
  timeEl.textContent = `⏱ 남은 시간 ${left}초 (끝나면 자동 잠금)`;
  btn.onclick = lock;
  return () => clearInterval(tm);
}

/* 5) 그림에서 위치 찾기(해부/구조) */
const DIAG = {
  fish: {
    n: { brain: '뇌', gill: '아가미', heart: '심장', liver: '간', stomach: '위', swim: '부레', intestine: '장', gonad: '생식소' },
    reg: { brain: [[118, 128, 16, 11]], gill: [[160, 160, 15, 40]], heart: [[205, 195, 14, 13]], liver: [[250, 178, 28, 16]], stomach: [[304, 162, 24, 17]], swim: [[355, 116, 50, 16]], intestine: [[370, 184, 46, 11]], gonad: [[428, 158, 20, 12]] },
    col: { brain: '#f4a6c0', gill: '#e04a5a', heart: '#c01c3a', liver: '#9a5a2e', stomach: '#e9b55b', swim: '#f6f2cf', intestine: '#d68b60', gonad: '#f0b7ff' },
    base(x) {
      x.fillStyle = '#16507a'; x.fillRect(0, 0, 520, 300); x.fillStyle = '#8fc7e0';
      x.beginPath(); x.ellipse(270, 150, 205, 88, 0, 0, 7); x.fill();
      x.beginPath(); x.moveTo(460, 150); x.lineTo(515, 95); x.lineTo(515, 205); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(230, 70); x.lineTo(300, 30); x.lineTo(350, 78); x.closePath(); x.fill();
      x.fillStyle = '#f6d8cf'; x.beginPath(); x.ellipse(285, 158, 172, 62, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(88, 132, 9, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(88, 132, 4, 0, 7); x.fill();
    },
  },
  body: {
    n: { brain: '뇌', lung: '폐', heart: '심장', liver: '간', stomach: '위', intestine: '소장' },
    reg: { brain: [[260, 38, 17, 12]], lung: [[222, 118, 22, 34], [298, 118, 22, 34]], heart: [[262, 142, 13, 14]], liver: [[236, 180, 32, 15]], stomach: [[290, 182, 20, 14]], intestine: [[260, 232, 48, 26]] },
    col: { brain: '#f4a6c0', lung: '#f7a0a8', heart: '#c01c3a', liver: '#9a5a2e', stomach: '#e9b55b', intestine: '#e8a99a' },
    base(x) {
      x.fillStyle = '#0f2742'; x.fillRect(0, 0, 520, 300); x.fillStyle = '#f1c7a0';
      x.beginPath(); x.arc(260, 40, 28, 0, 7); x.fill(); x.fillRect(248, 62, 24, 14);
      x.beginPath(); x.moveTo(220, 72); x.lineTo(300, 72); x.quadraticCurveTo(334, 72, 334, 110); x.lineTo(330, 270); x.quadraticCurveTo(326, 290, 300, 290); x.lineTo(220, 290); x.quadraticCurveTo(194, 290, 190, 270); x.lineTo(186, 110); x.quadraticCurveTo(186, 72, 220, 72); x.fill();
    },
  },
  ship: {
    n: { bridge: '브리지(조타실)', funnel: '연돌(굴뚝)', cargo: '화물창(컨테이너 적재)', engine: '기관실', bow: '선수(뱃머리)', propeller: '프로펠러' },
    reg: { bridge: [[125, 138, 45, 37]], funnel: [[122, 82, 17, 20]], cargo: [[315, 158, 115, 17]], engine: [[155, 210, 45, 18]], bow: [[488, 165, 22, 22]], propeller: [[44, 212, 16, 16]] },
    col: null,
    base(x) {
      x.fillStyle = '#bfe3ff'; x.fillRect(0, 0, 520, 300); x.fillStyle = '#1c6fa8'; x.fillRect(0, 215, 520, 85);
      x.fillStyle = '#3b4a5e'; x.beginPath(); x.moveTo(50, 175); x.lineTo(470, 175); x.lineTo(508, 150); x.lineTo(462, 238); x.lineTo(92, 238); x.closePath(); x.fill();
      x.fillStyle = '#222c3a'; x.fillRect(110, 192, 90, 36); x.fillStyle = '#e0a43a'; x.fillRect(125, 200, 60, 20);
      ['#e0533d', '#4c8dd9', '#f2b84b', '#47b5a2', '#c06bd8', '#e0533d', '#4c8dd9'].forEach((c, i) => { x.fillStyle = c; x.fillRect(205 + i * 32, 140, 30, 35); });
      x.fillStyle = '#f4f4f4'; x.fillRect(80, 100, 90, 75); x.fillStyle = '#4aa3d8'; x.fillRect(90, 112, 70, 14);
      x.fillStyle = '#d9433a'; x.fillRect(105, 62, 34, 40); x.fillStyle = '#fff'; x.fillRect(105, 76, 34, 6);
      x.fillStyle = '#c9a24a'; x.beginPath(); x.arc(44, 212, 14, 0, 7); x.fill(); x.fillStyle = '#6b5420'; x.fillRect(40, 196, 8, 32);
    },
  },
};
function hotspot(host, cfg, fin) {
  const D = DIAG[cfg.diagram], cv = el('canvas', 'cv hs'); cv.width = 520; cv.height = 300; const x = cv.getContext('2d');
  const qs = shuffle(cfg.ids), found = new Set(); let qi = 0, mis = 0;
  const q = el('div', 'mg-q'), msg = el('div', 'mg-msg'); host.append(q, cv, msg);
  const ask = () => { q.textContent = `🔎 "${D.n[qs[qi]]}"의 위치를 클릭하세요 (${qi + 1}/${qs.length})`; };
  const draw = () => {
    D.base(x);
    if (D.col) for (const id in D.reg) { x.fillStyle = D.col[id]; D.reg[id].forEach(([a, b, c, d]) => { x.beginPath(); x.ellipse(a, b, c, d, 0, 0, 7); x.fill(); }); }
    found.forEach((id) => {
      const [a, b, c, d] = D.reg[id][0]; x.strokeStyle = '#38e07b'; x.lineWidth = 3; x.beginPath(); x.ellipse(a, b, c + 4, d + 4, 0, 0, 7); x.stroke();
      x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; const tw = x.measureText(D.n[id]).width;
      x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(a - tw / 2 - 4, b - d - 26, tw + 8, 18); x.fillStyle = '#0a3a1c'; x.fillText(D.n[id], a, b - d - 12);
    });
  };
  cv.onclick = (e) => {
    if (qi >= qs.length) return;
    const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) * 520) / r.width, py = ((e.clientY - r.top) * 300) / r.height;
    const hit = (id) => D.reg[id].some(([a, b, c, d]) => ((px - a) / (c * 1.15)) ** 2 + ((py - b) / (d * 1.15)) ** 2 <= 1);
    const id = qs[qi];
    if (hit(id)) {
      found.add(id); qi++; sfx.ok(); msg.textContent = `✅ ${D.n[id]} 정답!`;
      if (qi >= qs.length) { q.textContent = '🎉 모두 찾았어요!'; draw(); fin(Math.max(30, 100 - mis * 10)); return; }
    } else { mis++; sfx.bad(); const other = Object.keys(D.reg).find(hit); msg.textContent = other ? `❌ 거기는 "${D.n[other]}"이에요.` : '❌ 다시 찾아보세요.'; }
    ask(); draw();
  };
  ask(); draw();
}

/* 6) 타이밍 */
function timing(host, cfg, fin) {
  const rounds = cfg.labels.length, scores = []; let r = 0, pos = 0, dir = 1, zc = 0.5, zw = 0.2, speed = 1, locked = false, over = false, raf, last = performance.now();
  const lab = el('div', 'mg-q'), bar = el('div', 'tm-bar'), zone = el('div', 'tm-zone'), cur = el('div', 'tm-cur'), fb = el('div', 'mg-msg'), btn = el('button', 'btn primary big', '정지! (스페이스)');
  bar.append(zone, cur); host.append(lab, bar, fb, btn);
  const setup = () => { zw = Math.max(0.07, 0.2 - r * 0.03); zc = zw / 2 + 0.05 + Math.random() * (1 - zw - 0.1); zone.style.left = (zc - zw / 2) * 100 + '%'; zone.style.width = zw * 100 + '%'; speed = 0.8 + r * 0.22; pos = 0; dir = 1; lab.textContent = `${r + 1}/${rounds} · ${cfg.labels[r]}`; };
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!locked) { pos += dir * speed * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } } cur.style.left = pos * 100 + '%'; raf = requestAnimationFrame(loop); };
  const stop = () => {
    if (locked || over) return; locked = true; const d = Math.abs(pos - zc), hit = d <= zw / 2;
    const s = hit ? 60 + 40 * (1 - d / (zw / 2)) : Math.max(0, 35 * (1 - (d - zw / 2) / 0.4)); scores.push(s);
    fb.textContent = hit ? `✅ 성공! (${Math.round(s)}점)` : `❌ 아쉬워요 (${Math.round(s)}점)`; sfx[hit ? 'ok' : 'bad']();
    setTimeout(() => { if (over) return; r++; if (r >= rounds) { over = true; fin(scores.reduce((a, b) => a + b, 0) / rounds); } else { setup(); locked = false; fb.textContent = ''; } }, 800);
  };
  const kd = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); stop(); } };
  addEventListener('keydown', kd); btn.onclick = stop; setup(); raf = requestAnimationFrame(loop);
  return () => { over = true; cancelAnimationFrame(raf); removeEventListener('keydown', kd); };
}

/* 7) 떨어지는 것 받기 */
function catchGame(host, cfg, fin) {
  const cv = el('canvas', 'cv'); cv.width = 520; cv.height = 320; host.append(cv); const x = cv.getContext('2d');
  let bx = 260, tx = 260, pts = 0, left = cfg.time, spawn = 0, items = [], pops = [], run = true, raf, last = performance.now(); const keys = {};
  const move = (e) => { const r = cv.getBoundingClientRect(); tx = ((e.clientX - r.left) * 520) / r.width; };
  const kd = (e) => { keys[e.code] = true; }, ku = (e) => { keys[e.code] = false; };
  cv.addEventListener('pointermove', move); addEventListener('keydown', kd); addEventListener('keyup', ku);
  const loop = (now) => {
    if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; left -= dt;
    if (keys.ArrowLeft || keys.KeyA) tx -= 420 * dt; if (keys.ArrowRight || keys.KeyD) tx += 420 * dt;
    tx = clamp(tx, 30, 490); bx += (tx - bx) * Math.min(1, 14 * dt);
    spawn -= dt; if (spawn <= 0) { spawn = rnd(0.35, 0.7); const g = Math.random() < 0.6, set = g ? cfg.good : cfg.bad; items.push({ x: rnd(24, 496), y: -20, v: rnd(110, 210), e: set[(Math.random() * set.length) | 0], g }); }
    items.forEach((it) => { it.y += it.v * dt; });
    items = items.filter((it) => {
      if (it.y > 270 && it.y < 305 && Math.abs(it.x - bx) < 42) {
        if (it.g) { pts += 10; sfx.coin(); pops.push({ x: it.x, y: 270, t: 0.7, s: '+10', c: '#7dff9b' }); } else { pts -= 15; sfx.bad(); pops.push({ x: it.x, y: 270, t: 0.7, s: '-15', c: '#ff7d7d' }); }
        return false;
      }
      return it.y < 340;
    });
    pops.forEach((p) => { p.t -= dt; p.y -= 30 * dt; }); pops = pops.filter((p) => p.t > 0);
    const gr = x.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, cfg.bg[0]); gr.addColorStop(1, cfg.bg[1]); x.fillStyle = gr; x.fillRect(0, 0, 520, 320);
    x.textAlign = 'center'; x.font = '30px serif'; items.forEach((it) => x.fillText(it.e, it.x, it.y)); x.font = '40px serif'; x.fillText(cfg.basket, bx, 300);
    x.font = 'bold 15px sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(`점수 ${Math.max(0, pts)}  ·  남은 시간 ${Math.max(0, Math.ceil(left))}초`, 12, 22);
    pops.forEach((p) => { x.fillStyle = p.c; x.font = 'bold 18px sans-serif'; x.fillText(p.s, p.x, p.y); });
    if (left <= 0) { run = false; fin(clamp((pts / cfg.target) * 100, 0, 100)); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { run = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
}

/* 8) 건물 쌓기 */
function stack(host, cfg, fin) {
  const cv = el('canvas', 'cv'); cv.width = 520; cv.height = 340; host.append(cv); const x = cv.getContext('2d');
  const BH = 22, N = cfg.floors, tower = [{ x: 150, w: 220 }]; let cur = { x: 10, w: 220, d: 1 }, perfect = 0, run = true, over = false, raf, last = performance.now();
  const msg = el('div', 'mg-msg', '스페이스 또는 클릭으로 층을 내려놓으세요!'); host.append(msg);
  const finish = (ok) => { over = true; const fl = tower.length - 1; msg.textContent = ok ? `🎉 ${N}층 완공! (완벽 정렬 ${perfect}회)` : `🏗️ 무너졌어요… ${fl}층까지 지었어요.`; sfx[ok ? 'win' : 'bad'](); fin((fl / N) * 80 + (perfect / N) * 20); };
  const drop = () => {
    if (!run || over) return; const t = tower[tower.length - 1], l = Math.max(t.x, cur.x), r = Math.min(t.x + t.w, cur.x + cur.w), ov = r - l;
    if (ov <= 2) { finish(false); return; }
    if (Math.abs(cur.x - t.x) < 5) { perfect++; sfx.coin(); tower.push({ x: t.x, w: t.w }); } else { sfx.click(); tower.push({ x: l, w: ov }); }
    if (tower.length - 1 >= N) { finish(true); return; }
    cur = { x: 10, w: tower[tower.length - 1].w, d: 1 };
  };
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); drop(); } };
  addEventListener('keydown', kd); cv.addEventListener('pointerdown', drop);
  const loop = (now) => {
    if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!over) { cur.x += cur.d * (140 + tower.length * 16) * dt; if (cur.x + cur.w > 510) { cur.x = 510 - cur.w; cur.d = -1; } if (cur.x < 10) { cur.x = 10; cur.d = 1; } }
    const gr = x.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#6ec3ff'); gr.addColorStop(1, '#d9f0ff'); x.fillStyle = gr; x.fillRect(0, 0, 520, 340);
    x.fillStyle = '#5a8a4a'; x.fillRect(0, 328, 520, 12);
    const blk = (b, k, y) => { x.fillStyle = `hsl(${200 + k * 14},60%,55%)`; x.fillRect(b.x, y, b.w, BH - 1); x.fillStyle = 'rgba(255,255,255,.6)'; for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 18) x.fillRect(wx, y + 6, 8, 9); };
    tower.forEach((b, k) => blk(b, k, 328 - (k + 1) * BH));
    if (!over) blk(cur, tower.length, 328 - (tower.length + 1) * BH);
    x.fillStyle = '#12335f'; x.font = 'bold 15px sans-serif'; x.textAlign = 'left'; x.fillText(`${tower.length - 1} / ${N}층  ·  완벽 ${perfect}회`, 12, 22);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { run = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); };
}

/* 9) 격자 이동(배송 / 로봇 프로그래밍) */
function grid(host, cfg, fin) {
  const rows = cfg.map, R = rows.length, C = rows[0].length, cs = Math.min(64, Math.floor(520 / C));
  const cv = el('canvas', 'cv'); cv.width = C * cs; cv.height = R * cs; const x = cv.getContext('2d');
  let S, E; const stops = [];
  rows.forEach((r, y) => [...r].forEach((ch, xx) => { if (ch === 'S') S = { x: xx, y }; if (ch === 'E') E = { x: xx, y }; if (ch === 'P') stops.push({ x: xx, y }); }));
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }, SYM = { U: '⬆️', D: '⬇️', L: '⬅️', R: '➡️' };
  let pos, got, moves, cmds = [], attempts = 0, running = false, over = false, timer = null;
  const info = el('div', 'mg-msg'), pad = el('div', 'pad'), q = el('div', 'mg-msg');
  const reset = () => { pos = { ...S }; got = new Set(); moves = 0; };
  const wall = (a, b) => a < 0 || b < 0 || a >= C || b >= R || rows[b][a] === '#';
  const draw = () => {
    for (let yy = 0; yy < R; yy++) for (let xx = 0; xx < C; xx++) {
      x.fillStyle = rows[yy][xx] === '#' ? '#13233a' : (xx + yy) % 2 ? '#2a4a73' : '#31567f'; x.fillRect(xx * cs, yy * cs, cs, cs);
      if (rows[yy][xx] === '#') { x.strokeStyle = '#2a3f5c'; x.strokeRect(xx * cs + 2, yy * cs + 2, cs - 4, cs - 4); }
    }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${cs * 0.62}px serif`;
    stops.forEach((s, i) => { x.globalAlpha = got.has(i) ? 0.25 : 1; x.fillText(cfg.icons.p, s.x * cs + cs / 2, s.y * cs + cs / 2); }); x.globalAlpha = 1;
    x.fillText(cfg.icons.e, E.x * cs + cs / 2, E.y * cs + cs / 2); x.fillText(cfg.icons.h, pos.x * cs + cs / 2, pos.y * cs + cs / 2);
    info.textContent = cfg.mode === 'live' ? `이동 ${moves}/${cfg.maxMoves} · ${cfg.icons.p} ${got.size}/${stops.length}` : `명령 ${cmds.length}/${cfg.maxCmds} · ${cfg.icons.p} ${got.size}/${stops.length}`;
  };
  const step = (dx, dy) => { const nx = pos.x + dx, ny = pos.y + dy; if (wall(nx, ny)) return false; pos = { x: nx, y: ny }; moves++; stops.forEach((s, i) => { if (s.x === nx && s.y === ny && !got.has(i)) { got.add(i); sfx.coin(); } }); return true; };
  const solved = () => got.size === stops.length && pos.x === E.x && pos.y === E.y;
  host.append(cv, info, pad, q); reset();
  let kd = null;
  if (cfg.mode === 'live') {
    const go = (k) => {
      if (over) return; const d = DIRS[k]; step(d[0], d[1]); draw();
      if (solved()) { over = true; sfx.win(); fin(moves <= cfg.par ? 100 : clamp(100 - 5 * (moves - cfg.par), 40, 100)); }
      else if (moves >= cfg.maxMoves) { over = true; sfx.bad(); q.textContent = '이동 횟수를 모두 사용했어요…'; fin(20); }
    };
    ['U', 'L', 'D', 'R'].forEach((k) => { const b = el('button', 'btn', SYM[k]); b.onclick = () => go(k); pad.append(b); });
    const map = { ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R' };
    kd = (e) => { if (map[e.code]) { e.preventDefault(); go(map[e.code]); } }; addEventListener('keydown', kd);
  } else {
    const showQ = () => { q.textContent = '명령 순서: ' + (cmds.map((c) => SYM[c]).join(' ') || '(비어 있음)'); draw(); };
    ['U', 'L', 'D', 'R'].forEach((k) => { const b = el('button', 'btn', SYM[k]); b.onclick = () => { if (running || over || cmds.length >= cfg.maxCmds) return; cmds.push(k); sfx.click(); showQ(); }; pad.append(b); });
    const undo = el('button', 'btn', '⌫ 하나 지우기'), clr = el('button', 'btn', '🗑 전체 지우기'), run = el('button', 'btn primary', '▶ 실행');
    undo.onclick = () => { if (!running) { cmds.pop(); showQ(); } }; clr.onclick = () => { if (!running) { cmds = []; reset(); showQ(); } };
    run.onclick = () => {
      if (running || over || !cmds.length) return; attempts++; reset(); running = true; let i = 0; draw();
      const tick = () => {
        if (i >= cmds.length) {
          running = false;
          if (solved()) { over = true; sfx.win(); fin(Math.max(40, 100 - 5 * Math.max(0, cmds.length - cfg.par)) - (attempts - 1) * 10); }
          else { sfx.bad(); if (attempts >= 3) { over = true; q.textContent = '3번 모두 도착하지 못했어요… 다음에 다시 도전!'; fin(20); } else q.textContent = `❌ 아직 도착하지 못했어요. 명령을 고쳐 보세요. (기회 ${3 - attempts}번 남음)`; }
          draw(); return;
        }
        const d = DIRS[cmds[i++]]; step(d[0], d[1]); draw(); timer = setTimeout(tick, 230);
      };
      tick();
    };
    pad.append(undo, clr, run); showQ();
  }
  draw();
  return () => { over = true; clearTimeout(timer); if (kd) removeEventListener('keydown', kd); };
}

/* 10) 배 조종(구조/입항) */
function pilot(host, cfg, fin) {
  const Wd = 560, Hd = 340, cv = el('canvas', 'cv'); cv.width = Wd; cv.height = Hd; host.append(cv); const x = cv.getContext('2d');
  const ship = { x: Wd / 2, y: Hd - 40, a: -Math.PI / 2, v: 0 }, rocks = [], targets = [], keys = {};
  const free = (px, py, m) => Math.hypot(px - ship.x, py - ship.y) > 90 && [...rocks, ...targets].every((o) => Math.hypot(o.x - px, o.y - py) > m);
  let g = 0; while (rocks.length < 7 && g++ < 500) { const px = rnd(30, Wd - 30), py = rnd(30, Hd - 90); if (free(px, py, 60)) rocks.push({ x: px, y: py, r: rnd(14, 22) }); }
  g = 0; while (targets.length < cfg.total && g++ < 900) { const px = rnd(35, Wd - 35), py = rnd(35, Hd - 100); if (free(px, py, 55)) targets.push({ x: px, y: py, vx: cfg.mode === 'rescue' ? rnd(-8, 8) : 0, vy: cfg.mode === 'rescue' ? rnd(-8, 8) : 0, done: false }); }
  const total = targets.length; let next = 0, got = 0, hits = 0, inv = 0, left = cfg.time, run = true, raf, last = performance.now();
  const kd = (e) => { keys[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); }, ku = (e) => { keys[e.code] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const end = () => { run = false; const s = (got / total) * 85 + (got === total ? 15 : 0) - hits * 6; sfx[got === total ? 'win' : 'ok'](); fin(clamp(s, 0, 100)); };
  const loop = (now) => {
    if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; left -= dt; inv -= dt;
    if (keys.ArrowLeft || keys.KeyA) ship.a -= 2.4 * dt; if (keys.ArrowRight || keys.KeyD) ship.a += 2.4 * dt;
    if (keys.ArrowUp || keys.KeyW) ship.v = Math.min(140, ship.v + 90 * dt); else if (keys.ArrowDown || keys.KeyS) ship.v = Math.max(0, ship.v - 110 * dt); else ship.v *= Math.exp(-0.4 * dt);
    ship.x += Math.cos(ship.a) * ship.v * dt; ship.y += Math.sin(ship.a) * ship.v * dt;
    if (ship.x < 10 || ship.x > Wd - 10 || ship.y < 10 || ship.y > Hd - 10) { ship.x = clamp(ship.x, 10, Wd - 10); ship.y = clamp(ship.y, 10, Hd - 10); ship.v *= 0.5; }
    rocks.forEach((r) => { const d = Math.hypot(ship.x - r.x, ship.y - r.y); if (d < r.r + 10) { const nx = (ship.x - r.x) / (d || 1), ny = (ship.y - r.y) / (d || 1); ship.x = r.x + nx * (r.r + 10); ship.y = r.y + ny * (r.r + 10); ship.v *= 0.25; if (inv <= 0) { hits++; inv = 0.7; sfx.bump(); } } });
    targets.forEach((t, i) => {
      if (t.done) return; t.x = clamp(t.x + t.vx * dt, 20, Wd - 20); t.y = clamp(t.y + t.vy * dt, 20, Hd - 20);
      if (Math.hypot(ship.x - t.x, ship.y - t.y) < 24 && (cfg.mode === 'rescue' || i === next)) { t.done = true; got++; next++; sfx.coin(); }
    });
    x.fillStyle = '#0f5f93'; x.fillRect(0, 0, Wd, Hd); x.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(0, i * 30 + ((now / 40) % 30)); x.lineTo(Wd, i * 30 + ((now / 40) % 30)); x.stroke(); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '30px serif';
    rocks.forEach((r) => { x.fillStyle = '#5b6470'; x.beginPath(); x.arc(r.x, r.y, r.r, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = `${r.r * 1.4}px serif`; x.fillText('🪨', r.x, r.y); });
    targets.forEach((t, i) => { if (t.done) return; x.font = '28px serif'; x.fillText(cfg.mode === 'rescue' ? '🆘' : '🔴', t.x, t.y); if (cfg.mode === 'buoys') { x.font = 'bold 14px sans-serif'; x.fillStyle = i === next ? '#ffd24a' : '#fff'; x.fillText(String(i + 1), t.x, t.y - 22); } });
    x.save(); x.translate(ship.x, ship.y); x.rotate(ship.a); x.globalAlpha = inv > 0 && Math.floor(now / 80) % 2 ? 0.4 : 1; x.fillStyle = cfg.mode === 'rescue' ? '#ffffff' : '#ffd24a'; x.beginPath(); x.moveTo(16, 0); x.lineTo(-12, 9); x.lineTo(-8, 0); x.lineTo(-12, -9); x.closePath(); x.fill(); x.fillStyle = '#d9433a'; x.fillRect(-8, -3, 8, 6); x.restore();
    x.font = 'bold 15px sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(`${cfg.mode === 'rescue' ? '구조' : '통과'} ${got}/${total} · 충돌 ${hits} · ${Math.max(0, Math.ceil(left))}초`, 10, 18);
    if (got === total || left <= 0) { end(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { run = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
}

/* 11) 상황 판단 / 관심 설문 */
function scenario(host, cfg, fin) {
  let i = 0, sum = 0, locked = false; const tr = {}, box = el('div', 'scn'); host.append(box);
  const next = () => { i++; if (i >= cfg.steps.length) fin((sum / (cfg.steps.length * 10)) * 100, { traits: tr }); else show(); };
  function show() {
    const s = cfg.steps[i]; locked = false; box.innerHTML = '';
    box.append(el('div', 'mg-label', `질문 ${i + 1} / ${cfg.steps.length}`), el('div', 'mg-q', s.q));
    const fb = el('div', 'mg-msg'), nx = el('button', 'btn primary', '다음 ▶'); nx.style.display = 'none'; nx.onclick = next;
    s.opts.forEach((o) => {
      const b = el('button', 'card opt'); b.textContent = o.t;
      b.onclick = () => {
        if (locked) return; locked = true; const p = o.p === undefined ? 10 : o.p; sum += p;
        if (o.tr) for (const k in o.tr) tr[k] = (tr[k] || 0) + o.tr[k];
        b.classList.add(p >= 8 ? 'ok' : p < 5 ? 'bad' : 'sel'); sfx.click(); fb.textContent = o.fb || '';
        if (cfg.survey) setTimeout(next, 350); else nx.style.display = '';
      };
      box.append(b);
    });
    box.append(fb, nx);
  }
  show();
}

const GAMES = { sequence, match, assemble, dial, hotspot, timing, catch: catchGame, stack, grid, pilot, scenario };