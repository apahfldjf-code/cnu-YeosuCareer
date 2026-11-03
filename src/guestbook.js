/* ═══════════════════════════════════════════════════════════════
 * src/guestbook.js (신규) — 방명록 → Google 시트(Apps Script 웹 앱) 기록
 *
 * 1) '탐험 시작'을 누르면 방명록 창이 먼저 떠요. [남기고 시작] / [건너뛰고 시작]
 * 2) 남기면 Apps Script 웹 앱으로 보내 시트에 한 줄이 추가돼요.
 * 3) 전송이 실패하면 폰에 보관했다가 다음 접속 때 다시 보내요.
 *
 * 설치
 *   ① 'Code.gs 설정 안내' 문서대로 웹 앱을 배포하고 주소(…/exec)를 복사
 *   ② 아래 GB.url 의 따옴표 안에 붙여넣기  (비어 있으면 방명록 창이 뜨지 않고 게임은 그대로 시작돼요)
 *   ③ game.js 맨 위 import 들에 한 줄 추가:  import './guestbook.js';
 *
 * 콘솔 확인: __gb()  (설정·대기열 상태)   /   __gbtest()  (테스트 한 줄 보내기)
 * ═══════════════════════════════════════════════════════════════ */
import { isTouch } from './input.js';

const GB = {
  url: 'https://script.google.com/a/macros/jnu.ac.kr/s/AKfycbyxpIGZmUr5rtxfZ0Okeflban1-G6krZuZ7G_v5FLqKQTw1-tNw1ONRNiX14dSZeVM5/exec',                        // ← Apps Script 웹 앱 주소(…/exec)
  once: true,                     // 브라우저를 켠 뒤 한 번만 묻기 (타이틀로 돌아가도 다시 묻지 않음)
  keep: '행사 종료 후 30일',        // 동의 문구에 들어가는 보관 기간 (실제 기간에 맞게 수정)
};

const $ = (s) => document.querySelector(s);
const QKEY = 'cq_gb_queue', SKEY = 'cq_gb_sid', DKEY = 'cq_gb_done';
const state = { last: null };

const sid = (() => {
  let v = null;
  try { v = sessionStorage.getItem(SKEY); } catch (e) { /* 무시 */ }
  if (!v) {
    v = ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)).slice(0, 36);
    try { sessionStorage.setItem(SKEY, v); } catch (e) { /* 무시 */ }
  }
  return v;
})();

/* ── 전송 + 실패 시 보관 ── */
const loadQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } };
const saveQ = (q) => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-30))); } catch (e) { /* 무시 */ } };

async function post(d) {
  if (!GB.url) return false;
  try {
    /* no-cors + text/plain: Apps Script 가 바로 받을 수 있는 방식 (응답 내용은 읽을 수 없어요) */
    await fetch(GB.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d), keepalive: true });
    return true;
  } catch (e) { return false; }
}
async function flush() {
  const q = loadQ(); if (!q.length || !GB.url) return;
  const rest = [];
  for (const d of q) { if (!(await post(d))) rest.push(d); }
  saveQ(rest);
}
async function submit(d) {
  const ok = await post(d);
  state.last = (ok ? '전송 요청함 ' : '실패 → 대기열 ') + new Date().toLocaleTimeString();
  if (!ok) saveQ([...loadQ(), d]);
  return ok;
}

/* ── 방명록 창 ── */
const CSS = `
#gb-wrap{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(5,12,28,.74);padding:8px;font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
#gb-box{width:min(580px,100%);max-height:100%;overflow:auto;background:#12284a;color:#fff;border:1px solid #4a74b0;border-radius:14px;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.5);box-sizing:border-box}
#gb-box h2{margin:0 0 4px;font-size:18px}
#gb-box p{margin:0 0 8px;font-size:12px;opacity:.85;line-height:1.4}
#gb-box .gb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#gb-box .gb-grid .full{grid-column:1/-1}
#gb-box label{display:block;font-size:12px;margin-bottom:3px;opacity:.92}
#gb-box input[type=text],#gb-box select,#gb-box textarea{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #4a74b0;background:#0b1a33;color:#fff;font-size:15px;font-family:inherit}
#gb-box textarea{resize:none;height:52px}
#gb-box .gb-agree{display:flex!important;gap:8px;align-items:flex-start;font-size:11px;line-height:1.45;opacity:.92;margin:8px 0 0}
#gb-box .gb-agree input{margin-top:2px;width:18px;height:18px;flex:none}
#gb-err{color:#ffb3a8;font-size:12px;min-height:16px;margin-top:4px}
#gb-box .gb-row{display:flex;gap:8px;margin-top:8px}
#gb-box .gb-row button{flex:1;padding:11px 8px;border-radius:10px;border:0;font-size:15px;font-weight:700;color:#fff;background:#2d4a78;font-family:inherit}
#gb-box .gb-row button.pri{background:#2f7bf0;flex:1.7}
#gb-box .gb-row button:disabled{opacity:.5}
`;

const GRADES = ['선택 안 함', '초등학교', '중학교','고등학교', '대학생', '기타(주민)', '학부모', '교사'];
const INTERESTS = ['선택 안 함', '공학', '수산해양', '문화사회과학', '아직 잘 모르겠어요'];
const opts = (a) => a.map((t, i) => `<option value="${i ? t : ''}">${t}</option>`).join('');

function remember() { try { sessionStorage.setItem(DKEY, '1'); } catch (e) { /* 무시 */ } }

function openForm(done) {
  if ($('#gb-wrap')) return;
  const w = document.createElement('div'); w.id = 'gb-wrap';
  w.innerHTML = `
  <div id="gb-box" role="dialog" aria-label="방명록">
    <h2>📖 방명록을 남겨 주세요</h2>
    <p>여수캠퍼스 진로탐험에 오신것을 환영합니다! 즐거운 체험 되시기 바랍니다.</p>
    <div class="gb-grid">
      <div><label>이름 *</label><input id="gb-name" type="text" maxlength="20" autocomplete="off"></div>
      <div><label>학교 (선택)</label><input id="gb-school" type="text" maxlength="30" autocomplete="off"></div>
      <div><label>구분 (선택)</label><select id="gb-grade">${opts(GRADES)}</select></div>
      <div><label>관심 분야 (선택)</label><select id="gb-int">${opts(INTERESTS)}</select></div>
      <div class="full"><label>한마디 (선택, 100자까지)</label><textarea id="gb-msg" maxlength="100" placeholder="오늘 체험하고 싶은 학과나 소감을 적어 주세요"></textarea></div>
    </div>
    <input id="gb-hp" type="text" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0">
    <label class="gb-agree"><input id="gb-ok" type="checkbox"><span>방명록 내용(이름·학교·구분·관심 계열·한마디)과 접속 기기 종류를 행사 운영과 통계 목적으로 수집하며, ${GB.keep}에 파기합니다. 동의하지 않아도 체험은 할 수 있어요.</span></label>
    <div id="gb-err"></div>
    <div class="gb-row"><button id="gb-skip" type="button">건너뛰고 시작</button><button id="gb-send" class="pri" type="button">남기고 시작 ▶</button></div>
  </div>`;
  document.body.append(w);
  w.addEventListener('keydown', (e) => e.stopPropagation());   // 글자 입력이 게임 키로 새지 않게

  const gn = $('#in-name'); $('#gb-name').value = ((gn && gn.value) || '').trim();
  const close = () => w.remove();

  $('#gb-skip').onclick = () => { remember(); close(); done(); };
  $('#gb-send').onclick = () => {
    const name = $('#gb-name').value.trim(), err = $('#gb-err');
    if (!name) { err.textContent = '이름을 적어 주세요.'; return; }
    if (!$('#gb-ok').checked) { err.textContent = '동의하면 남길 수 있어요. 동의하지 않으면 "건너뛰고 시작"을 눌러 주세요.'; return; }
    const d = {
      name, school: $('#gb-school').value.trim(), grade: $('#gb-grade').value, interest: $('#gb-int').value, msg: $('#gb-msg').value.trim(),
      device: isTouch ? '모바일' : 'PC', screen: innerWidth + 'x' + innerHeight, sid, consent: true, hp: $('#gb-hp').value,
    };
    $('#gb-send').disabled = true; $('#gb-send').textContent = '저장 중…';
    submit(d);                                   // 기다리지 않고 바로 시작 (전체화면 전환이 터치 직후여야 해서)
    if (gn) gn.value = name;                     // 게임 속 이름도 같이 맞춰요
    remember(); close(); done();
  };
}

/* ── '탐험 시작' 가로채기 ── */
function hook() {
  const start = $('#b-start'); if (!start) return;
  let pass = false;
  start.addEventListener('click', (e) => {
    if (pass || !GB.url) return;
    let asked = false; try { asked = !!sessionStorage.getItem(DKEY); } catch (er) { /* 무시 */ }
    if (GB.once && asked) return;
    e.preventDefault(); e.stopImmediatePropagation();
    openForm(() => { pass = true; start.click(); pass = false; });
  }, true);
}

function init() {
  const st = document.createElement('style'); st.id = 'cq-guestbook'; st.textContent = CSS; document.head.append(st);
  hook(); flush();
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
addEventListener('online', flush);

/* 콘솔 확인용 */
window.__gb = () => ({ url: GB.url ? GB.url.slice(0, 48) + '…' : '(비어 있음)', queue: loadQ().length, last: state.last, sid });
window.__gbtest = () => submit({ name: '테스트', school: '테스트학교', grade: '', interest: '', msg: '연결 확인 ' + new Date().toLocaleString(), device: isTouch ? '모바일' : 'PC', screen: innerWidth + 'x' + innerHeight, sid: 'test-' + Date.now(), consent: true, hp: '' });
