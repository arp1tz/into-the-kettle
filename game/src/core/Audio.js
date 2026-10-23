// Fully synthesized audio (WebAudio only, no samples). Silent no-op until Audio.init().
let ctx = null, master, sfxBus, musBus, noiseBuf, muted = false, shaper;
const vols = { master: 0.8, sfx: 0.9, music: 0.45 };
const lastPlay = {};
let curKind = 'none', curBus = null, timer = null, nextT = 0, step = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const jit = () => 1 + rnd(-0.04, 0.04);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
// Oscillator with pitch sweep f0 -> f1 and attack/decay envelope. `at` = seconds from now.
function osc(dest, type, f0, f1, dur, vol, at = 0, o = {}) {
  const t = ctx.currentTime + at, a = o.attack || 0.004;
  const os = ctx.createOscillator(), g = ctx.createGain();
  os.type = type; os.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  if (o.detune) os.detune.value = o.detune;
  env(g, t, a, dur, vol);
  let n = os;
  if (o.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; os.connect(f); n = f; }
  n.connect(g); g.connect(dest);
  os.start(t); os.stop(t + dur + a + 0.05);
}
// Filtered noise burst with cutoff sweep f0 -> f1.
function noise(dest, type, f0, f1, dur, vol, at = 0, q = 1, a = 0.003) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  env(g, t, a, dur, vol);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + a + 0.05);
}

// ---- SFX: name -> (destGain, pitch) ----
const S = {
  swing: (d, p) => { noise(d, 'bandpass', 600 * p, 3200 * p, 0.16, 0.5, 0, 1.2, 0.05); osc(d, 'sine', 300 * p, 800 * p, 0.12, 0.08); },
  swing3: (d, p) => { noise(d, 'bandpass', 300 * p, 2400 * p, 0.28, 0.7, 0, 1, 0.09); osc(d, 'sawtooth', 120 * p, 360 * p, 0.25, 0.12, 0, { filter: 900 }); },
  hit: (d, p) => { noise(d, 'lowpass', 3500, 400, 0.12, 0.7); osc(d, 'sine', 220 * p, 55, 0.18, 0.9); },
  crit: (d, p) => { S.hit(d, p); osc(d, 'square', 2200 * p, 2200 * p, 0.35, 0.12, 0.01); osc(d, 'sine', 3300 * p, 3300 * p, 0.45, 0.14, 0.01); },
  kill: (d, p) => {
    osc(d, 'sine', 500 * p, 90, 0.2, 0.7); noise(d, 'bandpass', 1800, 300, 0.12, 0.5, 0, 3);
    [1200, 1600, 2000, 2600].forEach((f, i) => osc(d, 'triangle', f * p, f * p, 0.12, 0.1, 0.07 + i * 0.045));
  },
  spit: (d, p) => { osc(d, 'sine', 250 * p, 900 * p, 0.09, 0.6); noise(d, 'bandpass', 1500, 600, 0.06, 0.3, 0, 4); },
  spitHit: (d, p) => { noise(d, 'bandpass', 1200, 250, 0.15, 0.6, 0, 3); osc(d, 'sine', 400 * p, 80, 0.14, 0.5); },
  dash: (d, p) => { noise(d, 'highpass', 800 * p, 4500 * p, 0.28, 0.35, 0, 0.7, 0.08); },
  cast: (d, p) => { for (let i = 0; i < 4; i++) osc(d, 'sine', (300 + i * 90) * p, (700 + i * 160) * p, 0.1, 0.35, i * 0.06); },
  boom: (d, p) => { osc(d, 'sine', 120 * p, 30, 0.7, 1.1); noise(d, 'lowpass', 2500, 120, 0.6, 0.9); osc(d, 'sawtooth', 80, 30, 0.4, 0.3, 0, { filter: 300 }); },
  hurt: (d, p) => { osc(d, 'sawtooth', 520 * p, 90, 0.3, 0.55); osc(d, 'square', 260 * p, 60, 0.25, 0.25); noise(d, 'lowpass', 2000, 300, 0.12, 0.4); },
  heal: (d, p) => [523, 659, 784, 1047].forEach((f, i) => { osc(d, 'sine', f * p, f * p, 0.4, 0.3, i * 0.07); osc(d, 'triangle', f * 2 * p, f * 2 * p, 0.3, 0.08, i * 0.07); }),
  pickup: (d, p) => { osc(d, 'square', 880 * p, 880 * p, 0.08, 0.2); osc(d, 'square', 1320 * p, 1320 * p, 0.14, 0.2, 0.07); },
  door: (d, p) => { noise(d, 'lowpass', 400, 80, 0.9, 0.9, 0, 1, 0.1); osc(d, 'sine', 70, 40, 0.9, 0.7); osc(d, 'sine', 880 * p, 880 * p, 0.7, 0.2, 0.55); osc(d, 'sine', 1320 * p, 1320 * p, 0.7, 0.15, 0.6); },
  boon: (d, p) => [0, 4, 7, 11, 12, 16, 19, 24].forEach((k, i) => {
    const f = mtof(72 + k) * p; osc(d, 'sine', f, f, 0.5, 0.25, i * 0.06); osc(d, 'triangle', f * 2.01, f * 2.01, 0.35, 0.07, i * 0.06 + 0.01);
  }),
  roomClear: (d, p) => [523, 659, 784].forEach((f, i) => {
    const len = i === 2 ? 0.6 : 0.2; osc(d, 'square', f * p, f * p, len, 0.2, i * 0.13, { filter: 3000 }); osc(d, 'triangle', f * p, f * p, len, 0.3, i * 0.13);
  }),
  spawn: (d, p) => { osc(d, 'sine', 40, 160 * p, 0.35, 0.9); noise(d, 'lowpass', 200, 2000, 0.35, 0.5, 0, 2, 0.15); osc(d, 'sine', 700 * p, 200, 0.3, 0.2, 0.15); },
  bossRoar: (d, p) => {
    [-9, 0, 11].forEach(c => osc(d, 'sawtooth', 90 * p, 55 * p, 1, 0.45, 0, { detune: c * 6, attack: 0.15, filter: 700 }));
    noise(d, 'bandpass', 500, 150, 1, 0.6, 0, 2, 0.2);
  },
  charge: (d, p) => { osc(d, 'sawtooth', 100 * p, 900 * p, 0.7, 0.35, 0, { attack: 0.5, filter: 2500 }); osc(d, 'square', 100.5 * p, 905 * p, 0.7, 0.15, 0, { attack: 0.5 }); },
  stomp: (d, p) => { osc(d, 'sine', 90 * p, 25, 0.5, 1.2); noise(d, 'lowpass', 600, 60, 0.7, 0.9); osc(d, 'sine', 45, 30, 0.8, 0.5, 0.05); },
  sting: (d, p) => { osc(d, 'sawtooth', 3000 * p, 1200 * p, 0.12, 0.35); osc(d, 'sine', 2400 * p, 2400 * p, 0.2, 0.3); },
  steam: (d) => { noise(d, 'highpass', 2500, 5000, 0.8, 0.4, 0, 0.8, 0.15); noise(d, 'bandpass', 1500, 3000, 0.8, 0.2, 0, 0.5, 0.2); },
  bubble: (d, p) => { osc(d, 'sine', 200 * p, 600 * p, 0.1, 0.6); osc(d, 'sine', 400 * p, 900 * p, 0.06, 0.2, 0.04); },
  lid: (d, p) => {
    [830, 1370, 2210, 3170].forEach((f, i) => osc(d, 'square', f * p, f * p * 0.99, 0.5 - i * 0.08, 0.12));
    noise(d, 'highpass', 3000, 3000, 0.08, 0.5); osc(d, 'sine', 150, 70, 0.2, 0.6);
  },
  enrage: (d, p) => {
    for (let i = 0; i < 4; i++) { const f = i % 2 ? 600 : 800; osc(d, 'square', f, f, 0.16, 0.22, i * 0.17, { filter: 2500 }); }
    S.bossRoar(d, p);
  },
  win: (d, p) => [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.7], [1047, 0.85], [1319, 1]].forEach(([f, t], i) => {
    const len = i > 3 ? 0.5 : 0.2; osc(d, 'square', f * p, f * p, len, 0.2, t, { filter: 3500 }); osc(d, 'sawtooth', f / 2 * p, f / 2 * p, len, 0.15, t, { filter: 1200 });
  }),
  lose: (d, p) => [392, 349, 311, 262, 196].forEach((f, i) => osc(d, 'sawtooth', f * p, f * p * 0.97, 0.4, 0.3, i * 0.25, { filter: 1200 })),
  ui: (d, p) => { osc(d, 'square', 1200 * p, 800 * p, 0.04, 0.2); },
};
const JITTER = new Set(['hit', 'swing', 'swing3', 'kill', 'crit']);

// ---- Music voices (t = absolute ctx time) ----
const rel = (t) => t - ctx.currentTime;
const pluck = (d, f, t, v) => { osc(d, 'triangle', f, f, 0.45, v, rel(t)); osc(d, 'sine', f * 2, f * 2, 0.2, v * 0.4, rel(t)); };
const pad = (d, f, t, dur, v) => [-7, 7].forEach(c => osc(d, 'sawtooth', f, f, dur, v, rel(t), { detune: c, attack: dur * 0.4, filter: 900 }));
const kick = (d, t) => osc(d, 'sine', 150, 42, 0.18, 0.9, rel(t));
const clap = (d, t, heavy) => { noise(d, 'bandpass', 1800, 1500, 0.14, 0.5, rel(t), 1.2); if (heavy) osc(d, 'triangle', 220, 120, 0.12, 0.4, rel(t)); };
const hat = (d, t, v) => noise(d, 'highpass', 7000, 7000, 0.04, v, rel(t), 0.7, 0.001);
const tom = (d, t, f) => osc(d, 'sine', f * 1.6, f, 0.22, 0.6, rel(t));
const brass = (d, f, t, dur) => [-8, 8].forEach(c => osc(d, 'sawtooth', f, f * 0.99, dur, 0.18, rel(t), { detune: c, attack: 0.04, filter: 600 }));
function bass(d, f, t, dur, v, dirty) {
  const os = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  os.type = 'sawtooth'; os.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(150, t + dur);
  env(g, t, 0.005, dur, v);
  os.connect(fl);
  if (dirty) {
    if (!shaper) { shaper = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) c[i] = Math.tanh((i / 128 - 1) * 5); shaper.curve = c; }
    fl.connect(shaper); shaper.connect(g);
  } else fl.connect(g);
  g.connect(d); os.start(t); os.stop(t + dur + 0.1);
}

const A2 = 45;
const SONGS = {
  title: { bpm: 90, step(s, t, d, sd) {
    const pent = [0, 3, 5, 7, 10];
    if (s % 4 === 0 && Math.random() < 0.8) pluck(d, mtof(57 + pent[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0)), t, 0.25);
    if (s % 32 === 0) [0, 7, 10].forEach(k => pad(d, mtof(A2 + 12 + k), t, sd * 32, 0.1));
  } },
  combat: { bpm: 140, step(s, t, d, sd) {
    const bar = Math.floor(s / 16) % 8, i = s % 16;
    if (i % 4 === 0) kick(d, t);
    if (i === 4 || i === 12) clap(d, t);
    if (i % 2 === 0) hat(d, t, 0.18);
    const roots = [0, 0, -4, -2, 0, 0, 3, -2]; // Am, F, G, ...
    if (i % 2 === 0 || i === 7 || i === 15) bass(d, mtof(A2 + roots[bar]) * (i % 4 === 3 ? 2 : 1), t, sd * 1.8, 0.3);
    const motif = [0, 3, 6, 8, 10], k = motif.indexOf(i);
    if (bar % 2 === 1 && k >= 0) pluck(d, mtof(69 + [0, 3, 7, 5, 3][k]), t, 0.16);
  } },
  boss: { bpm: 150, step(s, t, d, sd) {
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    if ([0, 3, 6, 8, 11].includes(i)) kick(d, t);
    if (i === 4 || i === 12) clap(d, t, true);
    if (i % 2 === 0) hat(d, t, 0.15);
    if (i === 10 || i === 14) tom(d, t, i === 10 ? 140 : 100);
    const root = A2 - 2 + [0, 0, 1, -1][bar];
    if (i % 2 === 0) bass(d, mtof(root), t, sd * 1.8, 0.35, true);
    if (i === 0 && bar % 2 === 0) { brass(d, mtof(root + 12), t, sd * 6); brass(d, mtof(root + 15), t, sd * 6); }
  } },
};
SONGS.final = { bpm: 156, step(s, t, d, sd) {
  SONGS.boss.step(s, t, d, sd);
  if (s % 2 === 1) hat(d, t, 0.1);
  if (s % 32 === 0) [0, 7, 12, 15].forEach(k => { const f = mtof(A2 + 12 + k); pad(d, f, t, sd * 32, 0.1); pad(d, f * 1.006, t, sd * 32, 0.08); });
} };

function tick() {
  const song = SONGS[curKind];
  if (!song || !ctx) return;
  const sd = 60 / song.bpm / 4;
  while (nextT < ctx.currentTime + 0.12) { song.step(step++, nextT, curBus, sd); nextT += sd; }
}

export const Audio = {
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musBus = ctx.createGain();
    sfxBus.connect(master); musBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    this.setVolume(vols.master, vols.sfx, vols.music);
  },
  play(name, { pitch = 1, vol = 1 } = {}) {
    if (!ctx || !S[name]) return;
    const now = ctx.currentTime;
    if (now - (lastPlay[name] ?? -1) < 0.03) return;
    lastPlay[name] = now;
    const g = ctx.createGain(); g.gain.value = vol; g.connect(sfxBus);
    S[name](g, pitch * (JITTER.has(name) ? jit() : 1));
    setTimeout(() => g.disconnect(), 3000);
  },
  music(kind) {
    if (!ctx || kind === curKind) return;
    const t = ctx.currentTime;
    if (curBus) {
      const old = curBus;
      old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + 1);
      setTimeout(() => old.disconnect(), 1300);
    }
    curKind = kind; clearInterval(timer); timer = null; curBus = null;
    if (!SONGS[kind]) return;
    curBus = ctx.createGain(); curBus.gain.setValueAtTime(0, t); curBus.gain.linearRampToValueAtTime(1, t + 1); curBus.connect(musBus);
    step = 0; nextT = t + 0.05;
    timer = setInterval(tick, 25); tick();
  },
  toggleMute() {
    muted = !muted;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : vols.master, ctx.currentTime, 0.02);
    return muted;
  },
  setVolume(m = vols.master, s = vols.sfx, mu = vols.music) {
    vols.master = m; vols.sfx = s; vols.music = mu;
    if (!ctx) return;
    master.gain.value = muted ? 0 : m; sfxBus.gain.value = s; musBus.gain.value = mu;
  },
};
