"""Procedural soundtrack for the Froggy Ballin trailer. 150 BPM, A minor, everything synthesised (no samples).
usage: python audio.py events.json out.wav [duration]
"""
import sys, json
import numpy as np
from scipy import signal
import wave

SR = 44100
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 19.8
N = int(SR * DUR)
BEAT = 0.4
rng = np.random.default_rng(11)

# ------------------------------------------------------------------ buses
music = np.zeros((2, N)); drums = np.zeros((2, N)); sfx = np.zeros((2, N)); verb = np.zeros((2, N))

def put(bus, x, t0, gain=1.0, pan=0.0, send=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0: return
    a = max(0, -i); b = min(len(x), N - i)
    seg = x[a:b] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    bus[0, i + a:i + b] += seg * l
    bus[1, i + a:i + b] += seg * r
    if send:
        verb[0, i + a:i + b] += seg * send * l
        verb[1, i + a:i + b] += seg * send * r

def T(d): return np.arange(int(d * SR)) / SR
def expd(d, tau): t = T(d); return np.exp(-t / tau)
def noise(d): return rng.uniform(-1, 1, int(d * SR))
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, min(f, SR / 2 - 100), 'lowpass', fs=SR, output='sos'), x)
def bp(x, f0, f1, o=2): return signal.sosfilt(signal.butter(o, [f0, min(f1, SR / 2 - 100)], 'bandpass', fs=SR, output='sos'), x)

def osc(kind, f, d, f2=None):
    t = T(d)
    if f2 is None: fr = np.full_like(t, f)
    else: fr = f * (f2 / f) ** (t / d)  # exponential sweep like WebAudio
    ph = 2 * np.pi * np.cumsum(fr) / SR
    if kind == 'sine': return np.sin(ph)
    if kind == 'square': return np.sign(np.sin(ph))
    if kind == 'sawtooth': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'triangle': return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    raise ValueError(kind)

def tone(f, f2=None, d=0.1, kind='square', v=0.15):
    x = osc(kind, f, d, f2)
    env = v * np.exp(np.log(0.0001 / v) * T(d) / d) if v > 0 else 0
    return x * env

def nz(d=0.1, v=0.2, lpf=None, hpf=None):
    x = noise(d)
    x = hp(x, hpf) if hpf else lp(x, lpf or 3000)
    return x * v * np.exp(np.log(0.0001 / v) * T(d) / d)

def S(*arrs):
    L = max(len(a) for a in arrs); out = np.zeros(L)
    for a in arrs: out[:len(a)] += a
    return out

def mix_at(parts):
    """parts: list of (offset_seconds, array) -> single array"""
    L = max(int((o) * SR) + len(a) for o, a in parts)
    out = np.zeros(L)
    for o, a in parts:
        i = int(o * SR); out[i:i + len(a)] += a
    return out

# ------------------------------------------------------------------ instruments
def kick(punch=1.0, dec=0.26):
    d = 0.5; t = T(d)
    fr = 46 + 130 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) * np.exp(-t / dec)
    x += hp(noise(0.012), 2500) * 0.6 * punch if False else 0
    click = np.zeros_like(t); c = hp(noise(0.01), 1800) * np.exp(-T(0.01) / 0.003); click[:len(c)] = c
    return np.tanh((x * 1.5 + click * 0.5 * punch)) * 0.95

def snare(v=1.0):
    d = 0.3
    n = hp(noise(d), 1400) * np.exp(-T(d) / 0.085)
    b = np.sin(2 * np.pi * 190 * T(d) * (1 + 0.3 * np.exp(-T(d) / 0.02))) * np.exp(-T(d) / 0.06)
    return (n * 0.8 + b * 0.7) * v

def clap(v=1.0):
    d = 0.35; x = np.zeros(int(d * SR))
    for o in (0, 0.011, 0.023):
        n = bp(noise(0.12), 900, 3200) * np.exp(-T(0.12) / 0.018); i = int(o * SR); x[i:i + len(n)] += n
    tail = bp(noise(d), 900, 2600) * np.exp(-T(d) / 0.09) * 0.5
    return (x + tail) * 1.6 * v

def hat(op=False, v=1.0):
    d = 0.22 if op else 0.06
    return hp(noise(d), 7000, 3) * np.exp(-T(d) / (0.09 if op else 0.016)) * v

def crash(d=2.0, v=1.0):
    n = hp(noise(d), 4500, 3) * np.exp(-T(d) / 0.7)
    return n * v

def rev_crash(d=1.2, v=1.0):
    n = hp(noise(d), 3500, 2) * (T(d) / d) ** 2.2
    return n * v

def bass(f, d=0.2, v=1.0, bright=900):
    t = T(d)
    x = osc('sawtooth', f, d) * 0.6 + osc('square', f * 1.003, d) * 0.4
    x = lp(x, bright, 2)
    sub = np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / 0.004) * np.exp(-t / (d * 0.9)) * np.minimum(1, (d - t) / 0.02 + 0.0)
    return np.tanh((x * 0.6 + sub * 0.9) * env * 1.4) * v

def stab(freqs, d=0.45, v=1.0, bright=3500, det=0.006):
    t = T(d); x = np.zeros_like(t)
    for f in freqs:
        for k in (-1, 0, 1):
            x += osc('sawtooth', f * (1 + k * det), d)
    x = lp(x / (len(freqs) * 1.5), bright)
    return x * np.exp(-t / (d * 0.45)) * np.minimum(1, t / 0.003) * v

def pluck(f, d=0.35, v=1.0, kind='triangle', bright=5000):
    t = T(d)
    x = osc(kind, f, d) + 0.4 * osc('sine', f * 2, d)
    return lp(x, bright) * np.exp(-t / (d * 0.3)) * np.minimum(1, t / 0.002) * v

def pad(freqs, d, v=1.0, att=0.5, bright=2500):
    t = T(d); x = np.zeros_like(t)
    for f in freqs:
        for k, dt in enumerate((-0.004, 0.0, 0.004)):
            x += np.sin(2 * np.pi * f * (1 + dt) * t + k) + 0.35 * osc('sawtooth', f * (1 + dt), d)
    x = lp(x / (len(freqs) * 3), bright)
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / 0.3)
    return x * env * v

def impact(d=2.4, f_end=34, v=1.0, rumble=True):
    t = T(d)
    fr = f_end + 110 * np.exp(-t / 0.18)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) * np.exp(-t / 0.9)
    if rumble: x += lp(noise(d), 260) * np.exp(-t / 0.6) * 1.4
    burst = np.zeros_like(t); b = hp(noise(0.3), 900) * np.exp(-T(0.3) / 0.07); burst[:len(b)] = b
    return np.tanh((x * 1.2 + burst * 0.7)) * v

def riser(d, f0=150, f1=3000, v=1.0):
    t = T(d)
    fr = f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.4 + np.sin(ph) * 0.3
    n = hp(noise(d), 2500) * 0.5
    env = (t / d) ** 2
    return (lp(x, 6000) + n) * env * v

def whoosh(d=0.35, up=True, v=1.0):
    t = T(d); n = noise(d); out = np.zeros_like(t)
    ch = 256; zi = None
    for i in range(0, len(t), ch):
        k = i / len(t); k = k if up else 1 - k
        fc = 300 * (6000 / 300) ** k
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 200)], 'bandpass', fs=SR, output='sos')
        seg, _ = signal.sosfilt(sos, n[i:i + ch], zi=signal.sosfilt_zi(sos) * 0)
        out[i:i + len(seg)] = seg
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return out * env * 2.2 * v

def glass(d=1.0, v=1.0):
    x = np.zeros(int(d * SR))
    for k in range(14):
        f = rng.uniform(1800, 7500); o = rng.uniform(0, 0.12); dd = rng.uniform(0.15, 0.6)
        s = np.sin(2 * np.pi * f * T(dd)) * np.exp(-T(dd) / (dd * 0.3)); i = int(o * SR); x[i:i + len(s)] += s * 0.25
    x += hp(noise(d), 5000) * np.exp(-T(d) / 0.12) * 0.5
    return x * v

def clang(streak=1, big=False, v=1.0):
    p = 2 ** ((min(streak, 9) - 1) * 2 / 12)
    parts = []
    for i, m in enumerate((1, 2.76, 5.4)):
        parts.append((0, tone(880 * p * m, None, 0.5 - i * 0.12, 'triangle' if i == 0 else 'sine', 0.22 / (i + 1))))
    parts.append((0, nz(0.06, 0.32, hpf=5000)))
    parts.append((0, tone(120 if big else 160, 40, 0.5 if big else 0.24, 'sine', 0.55 if big else 0.38)))
    parts.append((0, nz(0.14, 0.25, lpf=320)))
    if big:
        parts.append((0.05, tone(62, 28, 0.9, 'sawtooth', 0.14))); parts.append((0.08, tone(1760 * p, None, 0.7, 'sine', 0.08)))
    return mix_at(parts) * v * 2.0

def tick(v=1.0, hi=False):
    d = 0.07; f = 2400 if hi else 1700
    return (np.sin(2 * np.pi * f * T(d)) * np.exp(-T(d) / 0.008) + hp(noise(d), 4000) * np.exp(-T(d) / 0.004) * 0.4) * v

# ------------------------------------------------------------------ game SFX (recipes follow audio/Sfx.js)
def sfx_by_name(n, s=None):
    M = mix_at
    if n == 'slash': return M([(0, nz(0.14, 0.18, hpf=1800)), (0, tone(500, 200, 0.12, 'sawtooth', 0.05))]) * 1.6
    if n == 'slam': return M([(0, nz(0.3, 0.3, lpf=600)), (0, tone(140, 40, 0.3, 'sine', 0.3))]) * 1.4
    if n == 'hit': return M([(0, nz(0.08, 0.2, lpf=1500)), (0, tone(180, 80, 0.08, 'square', 0.1))]) * 1.5
    if n == 'crit': return M([(0, tone(900, 300, 0.2, 'sawtooth', 0.2)), (0, nz(0.2, 0.25, lpf=2500))]) * 1.3
    if n == 'shoot': return M([(0, tone(900, 120, 0.12, 'square', 0.15)), (0, nz(0.05, 0.12, lpf=4000))]) * 1.4
    if n == 'tongue': return tone(300, 900, 0.1, 'sine', 0.15) * 1.6
    if n == 'gulp': return M([(0, tone(250, 90, 0.15, 'sine', 0.2)), (0.1, tone(180, 70, 0.15, 'sine', 0.15))]) * 1.6
    if n == 'hurt': return M([(0, tone(220, 60, 0.25, 'sawtooth', 0.2)), (0, nz(0.15, 0.15, lpf=800))]) * 1.3
    if n == 'dodge': return nz(0.15, 0.12, hpf=900) * 1.6
    if n == 'jump': return tone(250, 520, 0.12, 'sine', 0.1) * 1.4
    if n == 'power': return M([(i * 0.06, tone(f, None, 0.1, 'square', 0.1)) for i, f in enumerate((400, 500, 650, 800))]) * 1.2
    if n == 'shatter': return S(M([(i * 0.04, tone(1200 + i * 300, 400, 0.3, 'triangle', 0.1)) for i in range(5)]) * 1.2, glass(0.9, 0.8))
    if n == 'boss': return M([(0, tone(90, 40, 1.0, 'sawtooth', 0.3)), (0, nz(0.8, 0.25, lpf=400))])
    if n == 'break': return M([(0, nz(0.3, 0.3, hpf=2500)), (0, tone(1500, 300, 0.35, 'sawtooth', 0.2)), (0.05, tone(600, 90, 0.4, 'square', 0.15))]) * 1.5
    if n == 'rank': return M([(i * 0.05, tone(f, None, 0.09, 'triangle', 0.1)) for i, f in enumerate((660, 880, 1320))]) * 1.8
    if n == 'boom': return M([(0, nz(0.55, 0.4, lpf=500)), (0, tone(90, 28, 0.5, 'sine', 0.45)), (0, nz(0.12, 0.2, hpf=2500))]) * 1.6
    if n == 'ult': return M([(0, tone(110, 880, 0.6, 'sawtooth', 0.22)), (0.05, tone(220, 1760, 0.6, 'square', 0.08)), (0, nz(0.5, 0.25, hpf=1500))]) * 1.6
    if n == 'ultEnd': return M([(0, tone(900, 60, 0.5, 'sawtooth', 0.18)), (0, nz(0.25, 0.2, hpf=3000))])
    if n == 'ultWarn': return M([(i * 0.14, tone(620 if i % 2 else 880, None, 0.12, 'square', 0.12)) for i in range(4)]) * 1.4
    if n == 'peril': return M([(0, tone(1900, 1500, 0.18, 'sawtooth', 0.16)), (0, tone(95, 60, 0.3, 'sine', 0.3)), (0, nz(0.1, 0.18, hpf=4000))])
    if n == 'perilC': return M([(0, tone(1300, 1700, 0.16, 'square', 0.11)), (0, tone(120, 70, 0.25, 'sine', 0.25))])
    if n == 'riposte': return M([(0, tone(600, 2400, 0.2, 'sawtooth', 0.16)), (0, nz(0.08, 0.2, hpf=5000))]) * 1.5
    if n == 'warn': return tone(440, None, 0.08, 'square', 0.07)
    if n == 'block': return M([(0, tone(210, 130, 0.09, 'square', 0.09)), (0, nz(0.07, 0.12, lpf=700))])
    if n == 'pickup': return M([(0, tone(600, None, 0.07, 'square', 0.1)), (0.07, tone(900, None, 0.1, 'square', 0.1))])
    if n == 'echo': return tone(700, 200, 0.3, 'sine', 0.15)
    if n == 'parry2': return clang(int((s or {}).get('s', 1) or 1), False, 0.9)
    if n == 'parryBig': return clang(int((s or {}).get('s', 1) or 1), True, 1.0)
    if n == 'web': return M([(0, tone(1300, 500, 0.16, 'sine', 0.12)), (0, nz(0.12, 0.12, hpf=2000))])
    return None

# per-name level and min spacing so chaos stays readable
SFX_LEVEL = dict(slash=0.55, slam=0.7, hit=0.5, crit=0.6, shoot=0.5, tongue=0.7, gulp=0.7, hurt=0.5, dodge=0.4, jump=0.3, power=0.5, shatter=1.0, boss=0.7,
                 **{'break': 0.9}, rank=0.5, boom=0.8, ult=0.9, ultEnd=0.6, ultWarn=0.6, peril=0.4, perilC=0.4, riposte=0.7, warn=0.0, block=0.4, pickup=0.25, echo=0.3, parry2=0.85, parryBig=1.0, web=0.3)
SFX_GAP = dict(crit=0.05, hit=0.05, slash=0.08, warn=1, shoot=0.06, dodge=0.2, jump=0.2)

# ------------------------------------------------------------------ arrangement
A, F, C, G = 55.0, 43.65, 65.41, 49.0  # bass roots (A1, F1, C2, G1)
ROOTS = [A, F, C, G]
def nf(semi, base=55.0): return base * 2 ** (semi / 12)
CHORDS = {  # triads (semitones above A1) for stabs / pads
    A: [24, 27, 31], F: [20, 24, 27], C: [27, 31, 34], G: [22, 26, 29],
}
def chord_for(t):
    bar = int(max(0, t - 1.6) // 1.6)
    return ROOTS[bar % 4]
def sidechain_mask():
    m = np.ones(N)
    for k in np.arange(0, DUR, BEAT):
        i = int(k * SR); n = int(0.28 * SR)
        e = 1 - 0.65 * np.exp(-T(0.28) / 0.07)
        m[i:i + n] *= e[:max(0, min(n, N - i))]
    return m

def arrange():
    # ---- bar 0: tension (0 - 1.6)
    for k in range(4): put(drums, kick(0.8), k * BEAT, 0.55 + 0.08 * k)
    put(music, impact(1.6, 40, 0.8), 0.0, 0.9, 0, 0.2)
    put(sfx, S(tone(3200, 2800, 0.5, 'triangle', 0.2), nz(0.4, 0.25, hpf=5000)), 0.0, 0.6, 0, 0.25)           # blade "shing"
    put(music, riser(1.6, 120, 3400, 1.0), 0.0, 0.55, 0, 0.1)
    put(drums, rev_crash(1.0), 0.6, 0.5)
    put(music, pad([nf(36), nf(43), nf(48), nf(51)], 1.2, 0.5, 0.15), 0.4, 0.35, 0, 0.5)                    # ghostly pad
    put(sfx, whoosh(0.4, True, 0.8), 0.8, 0.5, 0)
    for t in (1.1, 1.2, 1.3, 1.4, 1.5):                                                                        # build ticks
        put(drums, snare(0.5), t, 0.4 + 0.8 * (t - 1.1))
    # ---- DROP (1.6)
    put(music, impact(2.6, 32, 1.0), 1.6, 1.0, 0, 0.35)
    put(drums, crash(2.2, 0.9), 1.6, 0.7, 0, 0.2)
    put(music, stab([nf(24), nf(31), nf(36), nf(40)], 0.9, 1.0), 1.6, 0.8, 0, 0.3)
    for t in np.arange(2.0, 4.8, BEAT): pass
    # steady groove from 2.0 through the end of the montage (to 17.9)
    END = 17.92
    for t in np.arange(1.6, END, BEAT):
        sec_boss = 7.6 <= t < 10.8
        sec_ui = 6.4 <= t < 7.6
        put(drums, kick(1.0), t, 0.95 if not sec_ui else 0.7)
        b = (t - 1.6) / BEAT
        beat_in_bar = int(round(b)) % 4
        if beat_in_bar in (1, 3) and not sec_boss: put(drums, snare(1.0), t, 0.75); put(drums, clap(0.8), t, 0.55, 0, 0.1)
        if sec_boss and beat_in_bar in (1, 3): put(drums, snare(1.1), t, 0.9); put(drums, clap(1.0), t, 0.8, 0, 0.12)
        # hats
        put(drums, hat(False), t, 0.28, -0.2)
        put(drums, hat(True), t + BEAT / 2, 0.3, 0.2)
        if t >= 14.0 and not sec_ui:
            put(drums, hat(False, 0.8), t + BEAT / 4, 0.2, -0.3); put(drums, hat(False, 0.8), t + 3 * BEAT / 4, 0.2, 0.3)
    # ---- bass: syncopated 8ths following the chord roots
    pat = [1, 0, 1, 1, 0, 1, 1, 0]
    for t in np.arange(1.6, END, 0.2):
        step = int(round((t - 1.6) / 0.2)) % 8
        if not pat[step]: continue
        root = chord_for(t)
        octv = 2 if step in (3, 6) else 1
        f = root * octv * (1.5 if step == 5 else 1)
        sec = 10.8 <= t < 14.0
        put(music, bass(f, 0.18, 0.9, 700 if not sec else 1100), t, 0.62)
    # ---- chord stabs on each bar downbeat + off-beat
    for t in np.arange(2.4, END, 1.6):
        pass
    for t in np.arange(3.2, END - 0.1, 1.6):
        ch = chord_for(t); fr = [nf(s) for s in CHORDS[ch]]
        put(music, stab(fr, 0.5, 0.8), t, 0.5, 0, 0.2)
        put(music, stab(fr, 0.3, 0.8), t + 1.0, 0.4, 0, 0.2)
    # ---- BOSS section (4.8 - 8.8): heavy hits on each reveal, snarl on each attack cut
    boss_roots = [A, 73.42, 98.0]
    for i, r in enumerate(boss_roots):
        t = [7.6, 9.2, 10.8][i]
        put(music, impact(1.4, r * 0.5, 1.0), t, 0.95, 0, 0.25)
        put(music, stab([r * 4, r * 6, r * 8, r * 12], 0.6, 1.0, 4200), t, 0.7, 0, 0.3)
        put(sfx, whoosh(0.4, True, 0.9), t - 0.3, 0.5)
        put(drums, crash(0.9, 0.7), t, 0.45)
        put(music, bass(r * 2, 0.35, 1.0, 1400), t + 0.4, 0.8)
        put(sfx, nz(0.3, 0.3, lpf=900) * np.linspace(1, 0, int(0.3 * SR)), t + 0.4, 0.8)
    # ---- GHOST section (8.8 - 12.0): ticking clock + eerie 16th arp w/ delay
    for t in np.arange(10.8, 14.0, 0.2):
        put(sfx, tick(0.5, int(round((t - 10.8) / 0.2)) % 2 == 0), t, 0.35, 0.3 if int(round((t - 10.8) / 0.2)) % 2 else -0.3, 0.1)
    arp = [0, 7, 12, 15, 19, 15, 12, 7]
    for t in np.arange(11.6, 14.0, 0.1):
        i = int(round((t - 11.6) / 0.1))
        ch = chord_for(t); base = ch * 4
        put(music, pluck(base * 2 ** (arp[i % 8] / 12), 0.28, 0.9, 'triangle', 6000), t, 0.22, -0.4 + 0.8 * (i % 2), 0.3)
    put(music, rev_crash(0.9, 1.0), 9.9, 0.4)
    put(sfx, whoosh(0.5, False, 0.9), 10.4, 0.4)
    # ghost kill hit (10.8): big boom + glass
    put(music, riser(1.0, 200, 4500, 1.0), 13.0, 0.45, 0, 0.1)
    put(music, impact(1.4, 30, 1.0), 14.0, 0.8, 0, 0.2)
    # ---- UI section (14 - 16.4): bright pentatonic plucks + whooshes
    pent = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27]
    for i, t in enumerate(np.arange(6.4, 7.6, 0.2)):
        put(music, pluck(nf(pent[i % len(pent)] + 36), 0.4, 1.0, 'triangle', 7000), t, 0.45, -0.5 + (i % 4) * 0.33, 0.35)
    for t in np.arange(6.4, 7.6, 0.4):
        put(sfx, whoosh(0.3, True, 0.7), t - 0.25, 0.4)
        put(sfx, tone(700, None, 0.05, 'square', 0.08), t, 0.5)
    # ---- HYPE (16.4 - 18.0): snare roll that accelerates + riser; cut to silence at 17.92
    put(music, riser(1.5, 200, 5000, 1.0), 16.4, 0.8, 0, 0.1)
    t = 16.4; step = 0.2
    while t < 17.92:
        put(drums, snare(1.0), t, 0.45 + 0.5 * (t - 16.4) / 1.5)
        if step > 0.05: step = max(0.05, step * 0.9 if t > 16.8 else step)
        t += step
    for t in np.arange(16.4, 17.92, 0.2): put(drums, kick(1.0), t, 0.6)
    for t in np.arange(16.4, 17.92, 0.2): put(music, bass(chord_for(t) * 2, 0.15, 1.0, 1500), t, 0.5)
    # ---- FINAL (18.0): huge hit, choir pad, sparkle arps, fade
    put(music, impact(3.0, 30, 1.0), 18.0, 1.0, 0, 0.45)
    put(drums, crash(2.6, 1.0), 18.0, 0.85, 0, 0.3)
    put(drums, kick(1.2, 0.5), 18.0, 1.0)
    put(music, stab([nf(24), nf(31), nf(36), nf(40), nf(43)], 1.7, 1.0, 4500), 18.0, 0.8, 0, 0.5)
    put(music, pad([nf(12), nf(19), nf(24), nf(27), nf(31)], 1.8, 1.0, 0.25, 3000), 18.0, 0.55, 0, 0.5)
    for i, s in enumerate((36, 43, 48, 51, 55, 60)):
        put(music, pluck(nf(s + 12), 0.8, 1.0, 'triangle', 9000), 18.3 + i * 0.2, 0.3, -0.6 + i * 0.24, 0.5)
    put(sfx, S(tone(3200, 2800, 0.8, 'triangle', 0.2), nz(0.6, 0.2, hpf=5000)), 18.0, 0.4, 0, 0.3)

ALIAS = dict(swing='slash', swing3='slam', dash='dodge', cast='tongue', spit='shoot', spitHit='hit', bossRoar='boss', stomp='slam', sting='riposte', charge='peril', bubble='gulp', lid='parry2', roomClear='rank', boon='power', door='power', heal='heal', kill='crit', steam='ultEnd', enrage='ultWarn', spawn='warn', boom='boom')

def game_sfx(events):
    last = {}
    for e in sorted(events, key=lambda e: e['t']):
        n = ALIAS.get(e['n'], e['n']); lv = SFX_LEVEL.get(n)
        if not lv: continue
        t = e['t']
        if t < 0 or t >= DUR: continue
        if t - last.get(n, -9) < SFX_GAP.get(n, 0.03): continue
        last[n] = t
        x = sfx_by_name(n, e)
        if x is None: continue
        put(sfx, x, t, lv, rng.uniform(-0.35, 0.35), 0.12 if n in ('parry2', 'parryBig', 'shatter', 'boom', 'break') else 0.04)

def reverb_bus():
    d = 1.3; t = T(d)
    ir = hp(noise(d), 300) * np.exp(-t / 0.35)
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    out = np.zeros_like(verb)
    for c in range(2):
        irc = ir if c == 0 else np.roll(ir, 37) * 0.97
        out[c] = signal.fftconvolve(verb[c], irc)[:N] * 0.06
    return out

if __name__ == '__main__':
    ev = json.load(open(sys.argv[1])) if len(sys.argv) > 1 and sys.argv[1] != '-' else []
    arrange()
    game_sfx(ev)
    sc = sidechain_mask()
    mus = music * sc
    # soften the music when game SFX are busy so hits stay clear
    wet = reverb_bus()
    mix = mus * 0.9 + drums * 0.95 + sfx * 0.95 + wet
    # hard silence-before-the-hit at 17.92-18.0 for punch (reverb tails off too)
    i0, i1 = int(17.93 * SR), int(18.0 * SR)
    mix[:, i0:i1] *= np.linspace(0.15, 0.0, i1 - i0)
    # master: highpass, soft clip, fade the very end
    sos = signal.butter(2, 28, 'highpass', fs=SR, output='sos'); mix = signal.sosfilt(sos, mix, axis=1)
    mix = np.tanh(mix * 0.6) / np.tanh(0.6)
    fade = int(0.35 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade)[None, :] ** 1.5
    mix *= 0.93 / max(1e-6, np.abs(mix).max())
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.copy()
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', sys.argv[2], f'{N / SR:.2f}s', 'peak', float(np.abs(mix).max()))
