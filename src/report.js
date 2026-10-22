import { DEPTS, AXES, BYID } from './data.js';

// 체험 점수 + 재미(별점) + 설문 성향을 합쳐 8개 성향 프로필을 만들고, 학과별 적합도를 계산
export function analyze(S) {
  const keys = AXES.map((a) => a.k), prof = {}; keys.forEach((k) => { prof[k] = 0; });
  const rows = [];
  for (const [id, rec] of Object.entries(S.played)) {
    const d = BYID[id]; if (!d) continue;
    const w = ((rec.stars || 3) / 5) * 0.65 + (rec.score / 100) * 0.35;
    rows.push({ d, rec, w });
    if (id !== 'cre') for (const k in d.tr) prof[k] += w * d.tr[k];
    if (rec.traits) for (const k in rec.traits) prof[k] += rec.traits[k] * 0.45;
  }
  const vals = keys.map((k) => prof[k]), max = Math.max(...vals, 1e-9), sum = vals.reduce((a, b) => a + b, 0);
  const norm = vals.map((v) => v / max);
  const cos = (a, b) => { let d = 0, x = 0, y = 0; a.forEach((v, i) => { d += v * b[i]; x += v * v; y += b[i] * b[i]; }); return x && y ? d / Math.sqrt(x * y) : 0; };
  const recs = DEPTS.filter((d) => d.id !== 'cre').map((d) => {
    const dv = keys.map((k) => d.tr[k] || 0), own = rows.find((r) => r.d.id === d.id), aff = cos(vals, dv) * 0.75 + (own ? own.w * 0.25 : 0);
    const why = keys.map((k, i) => ({ k, v: (vals[i] / max) * dv[i] })).sort((a, b) => b.v - a.v).slice(0, 2).filter((t) => t.v > 0.15).map((t) => AXES.find((a) => a.k === t.k).name);
    return { dept: d, aff, fit: Math.min(99, Math.round(aff * 100)), own, why };
  }).sort((a, b) => b.aff - a.aff);
  const jobs = AXES.map((a, i) => ({ ...a, pct: Math.round(norm[i] * 100) })).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const flat = rows.length < 5 || (sum > 0 && max / sum < 0.2);
  return { count: rows.length, total: DEPTS.length, norm, recs, top: recs.slice(0, 3), jobs, flat,
    best: [...rows].sort((a, b) => b.rec.score - a.rec.score).slice(0, 3), fav: rows.filter((r) => r.rec.stars >= 5).map((r) => r.d.name) };
}

export function drawRadar(cv, norm) {
  const x = cv.getContext('2d'), w = cv.width, c = w / 2, R = w * 0.31, n = AXES.length;
  x.clearRect(0, 0, w, w);
  const pt = (i, r) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [c + Math.cos(a) * R * r, c + Math.sin(a) * R * r]; };
  x.strokeStyle = 'rgba(160,200,255,.35)'; x.lineWidth = 1;
  for (let l = 1; l <= 4; l++) { x.beginPath(); for (let i = 0; i < n; i++) { const [px, py] = pt(i, l / 4); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); }
  for (let i = 0; i < n; i++) { const [px, py] = pt(i, 1); x.beginPath(); x.moveTo(c, c); x.lineTo(px, py); x.stroke(); }
  x.beginPath(); norm.forEach((v, i) => { const [px, py] = pt(i, Math.max(0.05, v)); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
  x.fillStyle = 'rgba(255,210,74,.35)'; x.fill(); x.strokeStyle = '#ffd24a'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#fff'; x.font = `bold ${Math.round(w * 0.038)}px "Malgun Gothic","Apple SD Gothic Neo",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  AXES.forEach((a, i) => { const [px, py] = pt(i, 1.22); x.fillText(a.icon + ' ' + a.name, px, py); });
}

function wrapText(x, text, X, Y, maxW, lh) {
  let line = ''; for (const ch of text) { const t = line + ch; if (x.measureText(t).width > maxW && line) { x.fillText(line, X, Y); line = ch; Y += lh; } else line = t; }
  x.fillText(line, X, Y); return Y + lh;
}

// 리포트를 PNG 이미지(dataURL)로 만들어 저장
export function reportPNG(a, S) {
  const cv = document.createElement('canvas'); cv.width = 900; cv.height = 1300; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1300); g.addColorStop(0, '#0d2a52'); g.addColorStop(1, '#07162e'); x.fillStyle = g; x.fillRect(0, 0, 900, 1300);
  const F = '"Malgun Gothic","Apple SD Gothic Neo",sans-serif'; x.textBaseline = 'alphabetic';
  x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = `bold 40px ${F}`; x.fillText('🧭 여수캠퍼스 진로탐험 리포트', 40, 70);
  x.font = `22px ${F}`; x.fillStyle = '#9fe3ff'; x.fillText(`${S.name || '탐험가'} · 체험 ${a.count}/${a.total}개 · ${new Date().toLocaleDateString('ko-KR')}`, 40, 110);
  const rc = document.createElement('canvas'); rc.width = rc.height = 460; drawRadar(rc, a.norm); x.drawImage(rc, 220, 130);
  let y = 640; x.textAlign = 'left';
  x.fillStyle = '#ffd24a'; x.font = `bold 28px ${F}`; x.fillText('나에게 어울리는 학과 TOP 3', 40, y); y += 14;
  a.top.forEach((r, i) => {
    y += 34; x.fillStyle = '#fff'; x.font = `bold 24px ${F}`; x.fillText(`${i + 1}. ${r.dept.icon} ${r.dept.name}  (적합도 ${r.fit}%)`, 40, y);
    x.font = `19px ${F}`; x.fillStyle = '#cfe6ff'; y = wrapText(x, `${r.dept.job} · ${r.why.join('·')} 성향과 잘 맞아요`, 56, y + 28, 790, 26);
    x.fillStyle = '#9fb8d8'; y = wrapText(x, '진출: ' + r.dept.careers.slice(0, 3).join(' / '), 56, y + 2, 790, 24);
  });
  y += 24; x.fillStyle = '#ffd24a'; x.font = `bold 28px ${F}`; x.fillText('관심 직업군', 40, y);
  a.jobs.forEach((j) => { y += 38; x.fillStyle = '#fff'; x.font = `22px ${F}`; x.fillText(`${j.icon} ${j.job} (${j.pct}%)`, 56, y); });
  y += 50; x.fillStyle = '#9fb8d8'; x.font = `16px ${F}`;
  wrapText(x, '※ 체험 결과는 참고용이에요. 학과별 모집 방식과 모집 요강은 전남대 입학처(ao.jnu.ac.kr)에서 꼭 확인하세요.', 40, y, 820, 22);
  return cv.toDataURL('image/png');
}