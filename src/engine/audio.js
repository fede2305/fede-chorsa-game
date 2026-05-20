// Synthetic sound effects via Web Audio API — fire-and-forget.
// AudioContext is created lazily on first call (requires prior user gesture).

let _ctx = null;

function ac() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function osc(freq, type, vol, t0, dur, freqEnd) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function nos(vol, t0, dur) {
  const c = ac();
  const len = Math.ceil(c.sampleRate * (dur + 0.02));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.001, vol), t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

export function sfx(name) {
  try {
    const t = ac().currentTime + 0.02;
    switch (name) {
      case 'tap':        osc(720, 'sine', 0.18, t, 0.07, 260); break;
      case 'crash':      nos(0.45, t, 0.35); osc(65, 'sine', 0.55, t, 0.28, 32); break;
      case 'brake': {
        // Cubierta chirriando: ruido filtrado con pitch descendente
        const c2 = ac();
        const len = Math.ceil(c2.sampleRate * 1.1);
        const buf = c2.createBuffer(1, len, c2.sampleRate);
        const d2 = buf.getChannelData(0);
        for (let i = 0; i < d2.length; i++) d2[i] = Math.random() * 2 - 1;
        const src2 = c2.createBufferSource();
        src2.buffer = buf;
        const flt = c2.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(1800, t);
        flt.frequency.exponentialRampToValueAtTime(400, t + 1.0);
        flt.Q.value = 3.5;
        const gn = c2.createGain();
        gn.gain.setValueAtTime(0.001, t);
        gn.gain.exponentialRampToValueAtTime(0.85, t + 0.04);
        gn.gain.setValueAtTime(0.85, t + 0.05);
        gn.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
        src2.connect(flt); flt.connect(gn); gn.connect(c2.destination);
        src2.start(t); src2.stop(t + 1.15);
        // Tono de chirrido superpuesto
        osc(1200, 'sawtooth', 0.08, t, 0.9, 180);
        break;
      }
      case 'shift':      osc(1100, 'square', 0.11, t, 0.05, 320); break;
      case 'shift_bad':  osc(175, 'sawtooth', 0.2, t, 0.18, 90); break;
      case 'score':
        osc(523, 'sine', 0.22, t, 0.12);
        osc(659, 'sine', 0.22, t + 0.1, 0.12);
        osc(784, 'sine', 0.28, t + 0.2, 0.18);
        break;
      case 'levelup':
        osc(523, 'sine', 0.28, t, 0.1);
        osc(659, 'sine', 0.28, t + 0.09, 0.1);
        osc(784, 'sine', 0.28, t + 0.18, 0.1);
        osc(1047, 'sine', 0.32, t + 0.29, 0.28);
        break;
      case 'wrong':      osc(135, 'sawtooth', 0.22, t, 0.28, 70); break;
      case 'catch':      osc(560, 'sine', 0.16, t, 0.09, 980); break;
      case 'miss':       nos(0.12, t, 0.15); osc(200, 'sine', 0.12, t, 0.15, 120); break;
      case 'tick':       osc(900, 'sine', 0.16, t, 0.07); break;
      case 'go':         osc(1100, 'sine', 0.28, t, 0.12); osc(1320, 'sine', 0.3, t + 0.1, 0.22); break;
      case 'park':
        osc(440, 'sine', 0.22, t, 0.1);
        osc(554, 'sine', 0.22, t + 0.09, 0.1);
        osc(660, 'sine', 0.28, t + 0.18, 0.22);
        break;
      case 'pump':       osc(180, 'sawtooth', 0.07, t, 0.04); break;
    }
  } catch (_) {}
}

// ── BACKGROUND MUSIC ─────────────────────────────────────────────────────────
const BPM = 124;
const BEAT = 60 / BPM;
const GMIN = [196.0, 220.0, 246.9, 261.6, 293.7, 329.6, 370.0, 392.0];
const MEL  = [0, 2, 4, 7, 5, 4, 2, 0, 4, 5, 7, 7, 5, 2, 0, 4];

let _musicOn = false;
let _beat = 0;
let _melIdx = 0;
let _musicT0 = 0;
let _musicTid = null;

function _scheduleBeat(bt, idx) {
  osc(55, 'sine', 0.52, bt, BEAT * 0.18, 28);
  if (idx % 4 === 0 || idx % 4 === 2) osc(98, 'triangle', 0.22, bt, BEAT * 0.35, 72);
  if (idx % 4 === 1 || idx % 4 === 3) nos(0.05, bt, 0.055);
  nos(0.018, bt, 0.03);
  nos(0.015, bt + BEAT * 0.5, 0.025);
  if (idx % 2 === 0) {
    const freq = GMIN[MEL[_melIdx % MEL.length]];
    _melIdx++;
    osc(freq, 'triangle', 0.09, bt, BEAT * 1.7);
  }
}

function _pump() {
  if (!_musicOn) return;
  const lookahead = 0.35;
  const until = ac().currentTime + lookahead;
  while (_musicT0 + _beat * BEAT < until) {
    _scheduleBeat(_musicT0 + _beat * BEAT, _beat);
    _beat++;
  }
  _musicTid = setTimeout(_pump, 110);
}

export function startMusic() {
  if (_musicOn) return;
  _musicOn = true;
  _beat = 0; _melIdx = 0;
  try { _musicT0 = ac().currentTime + 0.1; _pump(); } catch (_) {}
}

export function stopMusic() {
  _musicOn = false;
  if (_musicTid) { clearTimeout(_musicTid); _musicTid = null; }
}
