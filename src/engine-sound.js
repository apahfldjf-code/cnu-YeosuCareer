/* ═══════════════════════════════════════════════════════════════
 * src/engine-sound.js (신규, A2) — 카트 엔진 소리
 *   · 기존 비프음처럼 들리던 소리를 "부르릉" 하는 둥근 저음 엔진으로 교체
 *   · game.js 의 engine.start() / engine.stop() / engine.set(속도) 호출은 그대로 동작
 *
 * 소리 원리
 *   낮은 톱니파·사각파(약 40~100Hz) → 저역통과 필터로 둥글게 깎기
 *   → 8~25Hz 떨림으로 엔진 고동 표현 → 속도에 따라 바람 소리 추가
 *   → 4단 기어 변속(속도가 오르면 회전수가 올랐다가 변속할 때 뚝 떨어짐)
 *   가장 높은 소리도 약 1.1kHz 아래로 막아서 '삐-' 소리가 나지 않아요.
 *
 * 이 파일은 자체 AudioContext 를 쓰므로 audio.js 를 건드리지 않아요.
 * 소리 끄기(core.js 의 isSoundOn)는 있으면 따라가요.
 * ═══════════════════════════════════════════════════════════════ */
import * as CORE from './core.js';

const GEAR = [0, 0.17, 0.37, 0.60, 0.84];  // 각 단이 시작되는 속도 비율 (최고속 대비)
const VMAX = 36;                           // 기준 최고 속도(m/s). 부스트로 넘어가면 마지막 단에서 계속 올라가요

let ctx = null, N = null, level = 0.6;     // level: 엔진 소리 크기(0~1)

const soundOn = () => {
  try { return typeof CORE.isSoundOn === 'function' ? CORE.isSoundOn() !== false : true; } catch (e) { return true; }
};

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* 갈색 잡음(낮은 음이 센 바람 소리) 2초 반복 */
function noiseBuffer(c) {
  const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  return b;
}

function build() {
  const c = getCtx(); if (!c) return null;
  const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);

  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.7; lp.connect(out);
  const amp = c.createGain(); amp.gain.value = 0.72; amp.connect(lp);          // 엔진 고동으로 흔들리는 진폭

  const o1 = c.createOscillator(); o1.type = 'sawtooth';
  const o2 = c.createOscillator(); o2.type = 'square';                         // 한 옥타브 아래 묵직한 소리
  const g1 = c.createGain(); g1.gain.value = 0.55; o1.connect(g1); g1.connect(amp);
  const g2 = c.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(amp);

  const lfo = c.createOscillator(); lfo.type = 'sine';
  const lg = c.createGain(); lg.gain.value = 0.28; lfo.connect(lg); lg.connect(amp.gain);

  const ns = c.createBufferSource(); ns.buffer = noiseBuffer(c); ns.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.7;
  const ng = c.createGain(); ng.gain.value = 0.01;
  ns.connect(bp); bp.connect(ng); ng.connect(out);

  [o1, o2, lfo, ns].forEach((s) => s.start());
  return { out, lp, o1, o2, lfo, bp, ng, srcs: [o1, o2, lfo, ns] };
}

/* 속도 비율 → 회전수(0~1). 기어가 바뀔 때 회전수가 떨어져요 */
function rpmOf(sn) {
  if (sn < 0.02) return 0.18;                                   // 공회전
  let g = 0;
  for (let i = 0; i < GEAR.length; i++) if (sn >= GEAR[i]) g = i;
  const lo = GEAR[g], hi = GEAR[g + 1] != null ? GEAR[g + 1] : 1.1;
  const base = g === 0 ? 0.18 : 0.30;
  return base + (1 - base) * Math.min(1, (sn - lo) / (hi - lo));
}

function apply(sn) {
  if (!N || !ctx) return;
  const t = ctx.currentTime, rpm = rpmOf(sn), f0 = 34 + 70 * rpm, s = Math.min(1, sn);
  N.o1.frequency.setTargetAtTime(f0, t, 0.06);
  N.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.06);
  N.lfo.frequency.setTargetAtTime(f0 * 0.25, t, 0.06);
  N.lp.frequency.setTargetAtTime(220 + 900 * rpm, t, 0.08);
  N.bp.frequency.setTargetAtTime(500 + 1800 * s, t, 0.1);
  N.ng.gain.setTargetAtTime(0.01 + 0.07 * s, t, 0.1);
  N.out.gain.setTargetAtTime(soundOn() ? level * (0.09 + 0.11 * rpm) : 0, t, 0.08);
}

function kill(n) {
  try {
    const t = ctx.currentTime;
    n.out.gain.cancelScheduledValues(t); n.out.gain.setTargetAtTime(0, t, 0.06);
  } catch (e) { /* 무시 */ }
  setTimeout(() => { try { n.srcs.forEach((s) => s.stop()); n.out.disconnect(); } catch (e) { /* 무시 */ } }, 400);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (N) ctx.resume().catch(() => {});
});

export const engine = {
  start() { if (N) return; N = build(); if (N) apply(0); },
  stop() { if (!N) return; const n = N; N = null; kill(n); },
  set(v) { apply(Math.abs(v || 0) / VMAX); },
  setVolume(v) { level = Math.max(0, Math.min(1, v)); },
};