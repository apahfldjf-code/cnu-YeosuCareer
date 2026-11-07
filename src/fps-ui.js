/* ═══════════════════════════════════════════════════════════════
 * src/fps-ui.js (신규) — FPS 월드 전용 HUD
 *
 * 기존 DOGBAR / #hpbox / #ammobox 는 FPS 월드에서 숨기고(body.fpsw) 이 HUD 가 대신합니다.
 *   상단 중앙 : 체력바 · 처치 수 · 방어구(🪖🦺🎒)
 *   하단 중앙 : 무기 4칸 [1 주무기][2 보조][3 맨손][4 회복] + 🎒 가방  → 칸 안에 탄약 "12/36"
 *   화면 가운데: 피격 방향(붉은 호) · 재장전 안내
 *   우측 위   : 획득/처치 피드 (최대 3줄)
 *   좌측 아래 : 왼손 발사 버튼 (모바일만)
 *
 * game.js 가 매 프레임 set(state) 을 부르면, 바뀐 때만 화면을 다시 그립니다.
 * 설치: game.js 패치 P1·P3 참고
 * ═══════════════════════════════════════════════════════════════ */
const CSS = `
#fpsui{position:fixed;inset:0;pointer-events:none;z-index:15;display:none;color:#fff;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
body.fpsw #fpsui{display:block}
body.fpsw #bar,body.fpsw #hpbox,body.fpsw #ammobox{display:none!important}
body.fpsw{--bh:60px}

/* 상단: 체력 · 처치 · 방어구 */
#fu-top{position:absolute;left:50%;top:40px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px}
#fu-hprow{display:flex;align-items:center;gap:6px}
#fu-hp{position:relative;width:170px;height:16px;border-radius:8px;background:rgba(0,0,0,.55);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
#fu-hpf{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#3fd17a,#9be36a);transition:width .15s}
#fu-hp.lo #fu-hpf{background:linear-gradient(90deg,#ff5a4a,#ff9a5a);animation:fuBlink .7s infinite}
#fu-hpt{position:absolute;left:0;right:0;top:0;text-align:center;font:800 11px/16px "Malgun Gothic",sans-serif;text-shadow:0 1px 2px #000}
#fu-kill{padding:0 8px;border-radius:9px;background:rgba(10,30,60,.65);font-weight:800;font-size:11px;line-height:16px;white-space:nowrap}
#fu-gear{display:flex;gap:4px;font-size:10px;font-weight:700}
#fu-gear span{padding:0 6px;border-radius:8px;background:rgba(10,30,60,.6);line-height:15px;white-space:nowrap}
#fu-gear span.off{opacity:.35}
@keyframes fuBlink{50%{opacity:.55}}

/* 구역 이름 */
#fu-zone{position:absolute;left:50%;top:92px;transform:translateX(-50%);padding:4px 16px;border-radius:14px;background:rgba(10,30,60,.72);
  font-weight:800;font-size:14px;opacity:0;transition:opacity .35s;white-space:nowrap}
#fu-zone.on{opacity:1}

/* 획득/처치 피드 */
#fu-feed{position:absolute;right:8px;top:calc(var(--mm,190px) + 14px);display:flex;flex-direction:column;align-items:flex-end;max-width:210px}
.fu-f{margin-top:3px;padding:2px 9px;border-radius:9px;background:rgba(10,30,60,.72);font-size:11px;font-weight:700;border-left:3px solid #9aa5b5;animation:fuIn .2s}
@keyframes fuIn{from{opacity:0;transform:translateX(14px)}}

/* 피격 방향 */
#fu-dmg{position:absolute;left:50%;top:50%;width:0;height:0}
.fu-d{position:absolute;left:-110px;top:-110px;width:220px;height:220px;animation:fuD .9s forwards}
.fu-d::before{content:'';position:absolute;left:50%;top:0;width:90px;height:18px;margin-left:-45px;border-radius:50% 50% 0 0/100% 100% 0 0;
  background:radial-gradient(ellipse at 50% 100%,rgba(255,60,50,.95),rgba(255,60,50,0) 72%)}
@keyframes fuD{to{opacity:0}}

/* 재장전 안내 */
#fu-low{position:absolute;left:50%;top:62%;transform:translateX(-50%);padding:4px 14px;border-radius:12px;background:rgba(160,30,30,.78);
  font-weight:800;font-size:13px;display:none;white-space:nowrap}

/* 하단 무기 칸 */
#fu-strip{position:absolute;left:50%;bottom:calc(5px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:4px;align-items:flex-end}
.fu-s{position:relative;flex:none;width:74px;height:46px;border-radius:10px;box-sizing:border-box;padding:4px 6px 4px 8px;
  background:rgba(8,20,40,.62);border:2px solid rgba(255,255,255,.14);pointer-events:auto;overflow:hidden;
  display:flex;flex-direction:column;justify-content:space-between;touch-action:manipulation}
body.touch .fu-s{width:68px;height:44px}
.fu-s.on{border-color:#6fb4ff;background:rgba(40,90,180,.58)}
.fu-s.empty{opacity:.5;border-style:dashed}
.fu-s.dn{filter:brightness(1.4);transform:scale(.95)}
.fu-s i{position:absolute;top:1px;left:5px;font:700 9px/1 sans-serif;opacity:.8;font-style:normal}
.fu-s p{position:absolute;left:0;top:0;bottom:0;width:3px;margin:0}
.fu-s .r1{display:flex;align-items:center;justify-content:space-between;gap:2px;margin-top:6px}
.fu-s b{font-size:19px;line-height:1}
.fu-s em{font-style:normal;font-weight:800;font-size:13px;line-height:1;white-space:nowrap}
.fu-s em s{text-decoration:none;font-size:9px;opacity:.75;font-weight:600}
.fu-s em.lo{color:#ff7a6a}
.fu-s small{font-size:9px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
.fu-s u{position:absolute;left:0;bottom:0;height:3px;width:0;background:#ffd24a;text-decoration:none}
.fu-s.fu-g{width:42px;align-items:center;justify-content:center;gap:1px}
body.touch .fu-s.fu-g{width:40px}
.fu-s.fu-g .r1{margin-top:0}

/* 왼손 발사 버튼 (모바일) */
#fu-fire{position:absolute;left:calc(18px + env(safe-area-inset-left,0px));bottom:clamp(120px,36vh,170px);width:64px;height:64px;border-radius:50%;
  display:none;align-items:center;justify-content:center;font-size:28px;background:rgba(220,80,60,.55);border:2px solid rgba(255,255,255,.7);
  pointer-events:auto;touch-action:none}
body.touch.fpsw #fu-fire{display:flex}
#fu-fire.dn{transform:scale(.92);background:rgba(255,110,80,.85)}
`;

const RARC = ['#9aa5b5', '#4fbf6a', '#4c8dd9', '#b06cf0'];

export function createFpsUI(opt) {
  const { isTouch, onSlot, onGear, onFire } = opt;
  const st = document.createElement('style'); st.id = 'cq-fps-ui'; st.textContent = CSS; document.head.append(st);
  const root = document.createElement('div'); root.id = 'fpsui';
  root.innerHTML = '<div id="fu-top"><div id="fu-hprow"><div id="fu-hp"><div id="fu-hpf"></div><span id="fu-hpt"></span></div><span id="fu-kill"></span></div><div id="fu-gear"></div></div>'
    + '<div id="fu-zone"></div><div id="fu-feed"></div><div id="fu-dmg"></div><div id="fu-low"></div><div id="fu-strip"></div><div id="fu-fire" class="fu-t">🔫</div>';
  document.body.append(root);
  const q = (s) => root.querySelector(s);
  const hpEl = q('#fu-hp'), hpf = q('#fu-hpf'), hpt = q('#fu-hpt'), killEl = q('#fu-kill'), gearEl = q('#fu-gear'),
    strip = q('#fu-strip'), low = q('#fu-low'), zoneEl = q('#fu-zone'), feedEl = q('#fu-feed'), dmgEl = q('#fu-dmg');
  let key = '', zt = 0;

  function draw(s) {
    hpf.style.width = Math.max(0, Math.min(1, s.hp / s.hpMax)) * 100 + '%';
    hpEl.classList.toggle('lo', s.hp / s.hpMax < 0.3);
    hpt.textContent = `❤ ${Math.ceil(s.hp)} / ${s.hpMax}`;
    killEl.textContent = `🎯 ${s.kills}`;
    gearEl.innerHTML = [['🪖', 'helmet'], ['🦺', 'vest'], ['🎒', 'pack']]
      .map(([ic, k]) => `<span class="${s.gear[k] ? '' : 'off'}">${ic}${s.gear[k] ? ' ' + s.gear[k] : ''}</span>`).join('');
    strip.innerHTML = s.slots.map((x) => `<div class="fu-s fu-t${x.on ? ' on' : ''}${x.empty ? ' empty' : ''}" data-slot="${x.k}">`
      + `<i>${x.k}</i>${x.rar ? `<p style="background:${RARC[Math.min(3, x.rar - 1)]}"></p>` : ''}`
      + `<div class="r1"><b>${x.icon}</b><em class="${x.lo ? 'lo' : ''}">${x.val}${x.sub ? `<s>${x.sub}</s>` : ''}</em></div>`
      + `<small>${x.name}</small><u></u></div>`).join('')
      + '<div class="fu-s fu-t fu-g" data-gear="1"><div class="r1"><b>🎒</b></div><small>가방</small></div>';
    low.style.display = s.low ? 'block' : 'none';
    low.textContent = s.low === 'reload' ? (isTouch ? '🔄 재장전하세요' : 'R 키로 재장전') : '탄약이 없어요! 바닥에서 찾아요';
  }
  function set(s) {
    const k = JSON.stringify([s.hp, s.kills, s.low, s.gear, s.slots]);
    if (k !== key) { key = k; draw(s); }
    const bar = strip.querySelector('.fu-s.on u');            // 재장전 진행바는 매 프레임
    if (bar) bar.style.width = s.reload >= 0 ? Math.round(s.reload * 100) + '%' : '0';
  }
  function hurt(rel) {                                          // rel: 화면 시계방향 각도(rad), 0 = 위쪽
    const d = document.createElement('div'); d.className = 'fu-d'; d.style.transform = `rotate(${(rel * 180 / Math.PI).toFixed(0)}deg)`;
    dmgEl.append(d); setTimeout(() => d.remove(), 950);
  }
  function feed(text, rar) {                                    // rar: 등급 숫자(1~4) 또는 색 문자열
    const d = document.createElement('div'); d.className = 'fu-f'; d.textContent = text;
    d.style.borderLeftColor = typeof rar === 'string' ? rar : RARC[Math.min(3, Math.max(0, (rar || 1) - 1))];
    feedEl.append(d); while (feedEl.children.length > 3) feedEl.firstChild.remove();
    setTimeout(() => d.remove(), 3400);
  }
  const kill = (text) => feed(text, '#ff7a59');
  function zone(name) {
    zoneEl.textContent = '📍 ' + name; zoneEl.classList.add('on');
    clearTimeout(zt); zt = setTimeout(() => zoneEl.classList.remove('on'), 2400);
  }
  function reset() { key = ''; feedEl.innerHTML = ''; dmgEl.innerHTML = ''; zoneEl.classList.remove('on'); low.style.display = 'none'; }
  function show(on) { document.body.classList.toggle('fpsw', !!on); if (!on) reset(); }

  /* ── 터치/클릭: 칸을 누르는 손가락이 조이스틱·시점 드래그로 새지 않게 window 캡처 단계에서 가로챔 ── */
  const hot = (e) => (e.target && e.target.closest ? e.target.closest('.fu-t') : null);
  const act = (h) => { if (h.dataset.slot) onSlot(+h.dataset.slot); else if (h.dataset.gear) onGear(); };
  ['touchmove', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup']
    .forEach((t) => addEventListener(t, (e) => { if (hot(e)) e.stopPropagation(); }, { capture: true, passive: true }));
  addEventListener('touchstart', (e) => {
    const h = hot(e); if (!h) return; e.stopPropagation(); h.classList.add('dn');
    if (h.id === 'fu-fire') onFire(true);
  }, { capture: true, passive: true });
  const endTouch = (e, cancel) => {
    const h = hot(e); if (!h) return; e.stopPropagation(); if (e.cancelable) e.preventDefault();
    h.classList.remove('dn');
    if (h.id === 'fu-fire') onFire(false); else if (!cancel) act(h);
  };
  addEventListener('touchend', (e) => endTouch(e, false), { capture: true, passive: false });
  addEventListener('touchcancel', (e) => endTouch(e, true), { capture: true, passive: false });
  addEventListener('click', (e) => { const h = hot(e); if (!h) return; e.stopPropagation(); if (h.id !== 'fu-fire') act(h); }, { capture: true });

  return { show, reset, set, hurt, feed, kill, zone };
}