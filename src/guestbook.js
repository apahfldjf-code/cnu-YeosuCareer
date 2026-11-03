/* ═══════════════════════════════════════════════════════════════
 * src/guestbook.js (교체) — 필수 방명록 (건너뛰기 없음)
 *  - 「▶ 탐험 시작」을 누르면 방명록이 먼저 뜨고, 작성해야만 게임이 시작돼요.
 *  - 닉네임 = 게임 안 이름(#in-name 에 반영), 이름 = 시트에만 기록.
 *  - 전송 실패 시 기기에 보관했다가 다음에 재전송해요.
 *  - 콘솔 테스트: __gbtest()
 * ═══════════════════════════════════════════════════════════════ */
const CFG = {
  URL: 'https://script.google.com/macros/s/AKfycbzxImE-uStITy0yjomUHGMKlcrPKvs0TPYW9PG6jFOhRPgyfIib-CEi9KQqjWEHeYWa/exec',   // ← 기존 guestbook.js 의 주소를 그대로 붙여 넣기
  ORG: '전남대학교 여수캠퍼스',
  RETENTION: '행사 종료 후 30일',    // ← 실제 보관 기간으로 수정
  ASK: 'load',                       // 'load' = 접속할 때마다 작성 / 'once' = 이 기기에서 한 번만
  VERSION: 'gb2',
};
const LS = { prof: 'cq_gb_profile', queue: 'cq_gb_queue', done: 'cq_gb_done' };
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } };
const SID = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let passed = CFG.ASK === 'once' && !!jget(LS.done, false);
let bypass = false, sending = false;

/* ───────── 전송 (보관 → 재전송) ───────── */
async function flush() {
  if (sending) return; sending = true;
  try {
    let q = jget(LS.queue, []);
    while (q.length) {
      const rec = q[0];
      try {
        await fetch(CFG.URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
        q.shift(); jset(LS.queue, q);
      } catch (e) { break; }      // 오프라인이면 다음에 다시
    }
  } finally { sending = false; }
}
function submit(rec) { const q = jget(LS.queue, []); q.push(rec); jset(LS.queue, q.slice(-50)); flush(); }
window.addEventListener('online', flush);
setTimeout(flush, 2500);

/* ───────── 화면 ───────── */
const css = document.createElement('style');
css.textContent = `
#gb-ov{position:fixed;inset:0;z-index:100000;background:rgba(5,15,35,.84);display:flex;align-items:center;justify-content:center;padding:8px;font-family:"Malgun Gothic","Noto Sans KR",sans-serif;color:#fff}
#gb-card{width:min(720px,100%);max-height:100%;overflow:auto;background:#12284d;border:2px solid #4c8dd9;border-radius:16px;padding:12px 16px;box-sizing:border-box}
#gb-card h2{margin:0 0 2px;font-size:18px}
.gb-p{font-size:12px;opacity:.85;margin:0 0 8px;line-height:1.4}
.gb-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gb-g label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700}
.gb-g .w{grid-column:1/-1}
.gb-g input,.gb-g select,.gb-g textarea{font-size:16px;padding:7px 9px;border-radius:9px;border:1px solid #5b7fb5;background:#0b1b38;color:#fff;font-family:inherit;box-sizing:border-box;width:100%}
.gb-g textarea{resize:none;height:44px}
.gb-g small{font-weight:400;opacity:.7}
.gb-agree{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.07);font-size:11.5px;line-height:1.45}
.gb-agree label{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;font-weight:700}
.gb-agree input{width:20px;height:20px}
#gb-err{min-height:18px;margin-top:6px;color:#ff9c9c;font-size:13px;font-weight:700}
#gb-go{margin-top:4px;width:100%;padding:12px;font-size:17px;font-weight:800;border:0;border-radius:12px;background:#2f7bff;color:#fff;cursor:pointer}
@media (max-width:480px){.gb-g{grid-template-columns:1fr}}
`;
document.head.appendChild(css);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROLES = ['고등학생 1학년', '고등학생 2학년', '고등학생 3학년', '중학생', '학부모', '교사', '기타'];
const INTERESTS = ['아직 잘 모르겠어요', '공학', '수산·해양', '문화·사회과학', '창의융합'];

function openForm() {
  if (document.getElementById('gb-ov')) return;
  const p = jget(LS.prof, {}), nm = document.getElementById('in-name');
  const nickDefault = (nm && nm.value.trim()) || p.nick || '';
  const ov = document.createElement('div'); ov.id = 'gb-ov';
  ov.innerHTML = `
  <form id="gb-card" autocomplete="off" novalidate>
    <h2>📖 방명록 · 탐험 전에 작성해 주세요</h2>
    <p class="gb-p">${esc(CFG.ORG)} 진로탐험에 오신 것을 환영해요! 게임 안에서는 <b>닉네임</b>으로 활동하고, <b>이름</b>은 방명록에만 기록돼요.</p>
    <div class="gb-g">
      <label>닉네임 * <small>게임 안 이름 · 1~8자</small><input id="gb-nick" maxlength="8" value="${esc(nickDefault)}" placeholder="예: 바다탐험가"></label>
      <label>이름 * <small>본인 이름(실명)</small><input id="gb-name" maxlength="10" value="${esc(p.name || '')}" placeholder="예: 홍길동"></label>
      <label>학교 * <input id="gb-school" maxlength="20" value="${esc(p.school || '')}" placeholder="예: 여수고등학교"></label>
      <label>구분 * <select id="gb-role"><option value="">선택하세요</option>${ROLES.map((r) => `<option${p.role === r ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="w">관심 계열 <select id="gb-int">${INTERESTS.map((r) => `<option${p.interest === r ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="w">한마디 <small>(선택)</small><textarea id="gb-msg" maxlength="60" placeholder="남기고 싶은 말을 적어 주세요"></textarea></label>
    </div>
    <div class="gb-agree">
      <b>개인정보 수집·이용 안내</b> · 항목: 이름, 닉네임, 학교, 구분, 관심 계열, 한마디 · 목적: 방문 기록 및 행사 운영 · 보관: ${esc(CFG.RETENTION)} 후 파기 · 동의하지 않으면 참여할 수 없어요.
      <label><input type="checkbox" id="gb-ag"> 위 내용에 동의합니다 *</label>
    </div>
    <div id="gb-err"></div>
    <button type="submit" id="gb-go">✔ 작성 완료하고 탐험 시작</button>
  </form>`;
  document.body.appendChild(ov);
  const $$ = (id) => document.getElementById(id), err = (m, el) => { $$('gb-err').textContent = m; if (el) el.focus(); };
  setTimeout(() => { const f = !$$('gb-nick').value ? $$('gb-nick') : !$$('gb-name').value ? $$('gb-name') : null; if (f) f.focus(); }, 50);

  $$('gb-card').addEventListener('submit', (e) => {
    e.preventDefault();
    const nick = $$('gb-nick').value.trim(), name = $$('gb-name').value.trim(), school = $$('gb-school').value.trim(), role = $$('gb-role').value;
    if (!nick) return err('닉네임을 입력해 주세요.', $$('gb-nick'));
    if (nick.length > 8 || /[<>&"]/.test(nick)) return err('닉네임은 8자 이내, < > & " 는 쓸 수 없어요.', $$('gb-nick'));
    if (!/^[가-힣a-zA-Z·.\s]{2,10}$/.test(name)) return err('이름을 2~10자의 한글/영문으로 입력해 주세요.', $$('gb-name'));
    if (school.length < 2) return err('학교를 입력해 주세요.', $$('gb-school'));
    if (!role) return err('구분을 선택해 주세요.', $$('gb-role'));
    if (!$$('gb-ag').checked) return err('개인정보 수집·이용에 동의해 주세요.', $$('gb-ag'));

    const interest = $$('gb-int').value, msg = $$('gb-msg').value.trim();
    const returning = !!jget(LS.prof, null);
    jset(LS.prof, { nick, name, school, role, interest });
    jset(LS.done, true);
    /* 닉네임 → 게임 안 이름 */
    const inp = document.getElementById('in-name');
    if (inp) { inp.value = nick; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
    submit({
      닉네임: nick, 이름: name, 학교: school, 구분: role, 관심계열: interest, 한마디: msg, 개인정보동의: 'Y', 재방문: returning ? 'Y' : 'N',
      세션: SID, 기기: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '모바일' : 'PC', 화면: `${innerWidth}x${innerHeight}`,
      접속경로: location.origin + location.pathname, 버전: CFG.VERSION, 클라이언트시각: new Date().toISOString(),
    });
    passed = true; ov.remove();
    const b = document.getElementById('b-start');
    if (b) { bypass = true; try { b.click(); } finally { bypass = false; } }
  });
}

/* 「탐험 시작」 가로채기: 방명록을 쓰기 전에는 게임이 시작되지 않아요 */
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest && e.target.closest('#b-start');
  if (!b || bypass || passed) return;
  e.preventDefault(); e.stopImmediatePropagation(); openForm();
}, true);

/* 타이틀의 「이름」 → 「닉네임」 */
(function relabel() {
  const lb = document.querySelector('label.nm'), inp = document.getElementById('in-name');
  if (lb) { const t = [...lb.childNodes].find((n) => n.nodeType === 3); if (t) t.textContent = '닉네임 '; }
  if (inp) inp.placeholder = '닉네임';
})();

/* 콘솔 점검 */
window.__gbtest = () => {
  submit({ 닉네임: '테스트', 이름: '콘솔테스트', 학교: '-', 구분: '기타', 관심계열: '-', 한마디: 'test', 개인정보동의: 'Y', 재방문: 'N', 세션: SID, 기기: 'test', 화면: '-', 접속경로: location.href, 버전: CFG.VERSION, 클라이언트시각: new Date().toISOString(), test: true });
  console.log('[guestbook] 테스트 전송함 · 대기열', jget(LS.queue, []).length, '· URL', CFG.URL.slice(0, 48) + '…');
};
