# Instrument and SFX synthesis primitives (numpy). All return float64 mono arrays at SR unless noted.
import math
import numpy as np
from scipy import signal
import au

SR = au.SR
RNG = np.random.default_rng(7)

def t_axis(dur, sr=SR):
    return np.arange(int(dur * sr)) / sr

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

NOTE_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def ntom(name):
    # 'F#5', 'Bb3', 'C4'
    n = NOTE_IDX[name[0].upper()]; i = 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1; i += 1
    octv = int(name[i:])
    return 12 * (octv + 1) + n

def adsr(n, a=0.005, d=0.1, s=0.7, r=0.2, sr=SR, hold=None):
    """n samples total; hold = sustain end (s) before release."""
    env = np.zeros(n)
    A = int(a * sr); D = int(d * sr); R = int(r * sr)
    H = int(hold * sr) if hold is not None else max(0, n - R)
    i = 0
    if A: env[:min(A, n)] = np.linspace(0, 1, A)[:min(A, n)]
    i = A
    if i < n and D:
        k = min(D, n - i); env[i:i + k] = np.linspace(1, s, D)[:k]
    i = A + D
    if i < H: env[i:min(H, n)] = s
    if H < n:
        lvl = env[H - 1] if H > 0 else s
        k = min(R, n - H)
        env[H:H + k] = np.linspace(lvl, 0, R)[:k]
        env[H + k:] = 0
    return env

def noise(n, color='white', rng=RNG):
    w = rng.standard_normal(n)
    if color == 'white': return w
    if color == 'pink':
        # Voss-McCartney approx via filtering
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        return signal.lfilter(b, a, w) * 3.5
    if color == 'brown':
        y = np.cumsum(w); y = y - signal.lfilter([1], [1, -0.995], y) * 0.005
        y = au.hp(y, 20)
        return y / (np.std(y) + 1e-9)
    return w

# ---------- tonal instruments ----------

def partial_sum(f0, ratios, amps, decays, dur, sr=SR, phase_rng=RNG, attack=0.002, detune_cents=0.0):
    n = int(dur * sr); t = np.arange(n) / sr
    y = np.zeros(n)
    for r, a, d in zip(ratios, amps, decays):
        f = f0 * r * (2 ** (detune_cents / 1200))
        if f >= sr * 0.45 or a == 0: continue
        ph = phase_rng.random() * 2 * math.pi
        y += a * np.sin(2 * math.pi * f * t + ph) * np.exp(-t / d)
    if attack > 0:
        k = min(n, int(attack * sr)); y[:k] *= np.linspace(0, 1, k) ** 1.5
    return y

def music_box(m, vel=0.8, sr=SR):
    f = mtof(m)
    T = float(np.clip(2.6 * (880 / f) ** 0.55, 0.7, 4.0))
    dur = T * 2.2
    y = partial_sum(f, [1.0, 1.0016, 2.0, 5.93, 11.8], [1.0, 0.35, 0.10, 0.22 * vel, 0.06 * vel],
                    [T, T * 0.8, T * 0.3, 0.11, 0.035], dur, attack=0.0015)
    n = len(y)
    click = au.hp(noise(int(0.004 * sr)), 3500) * 0.06 * vel
    y[:len(click)] += click
    return y * vel

def celesta(m, vel=0.8, sr=SR):
    f = mtof(m)
    T = float(np.clip(2.0 * (660 / f) ** 0.6, 0.5, 3.2))
    y = partial_sum(f, [1.0, 2.0, 3.0, 4.17, 6.9], [1.0, 0.16, 0.06, 0.10 * vel, 0.04 * vel],
                    [T, T * 0.45, T * 0.3, 0.22, 0.08], T * 2.0, attack=0.003)
    click = au.lp(au.hp(noise(int(0.006 * sr)), 1500), 6000) * 0.04 * vel
    y[:len(click)] += click
    return y * vel

def glock(m, vel=0.7, sr=SR):
    f = mtof(m)
    T = float(np.clip(1.6 * (1046 / f) ** 0.5, 0.4, 2.5))
    y = partial_sum(f, [1.0, 2.76, 5.40, 8.93], [1.0, 0.25, 0.10, 0.04], [T, T * 0.3, 0.12, 0.05], T * 2.0, attack=0.001)
    return y * vel

def felt_piano(m, vel=0.6, hold=1.0, sr=SR, bright=1.0):
    f = mtof(m)
    T1 = float(np.clip(5.0 * (262 / f) ** 0.75, 1.2, 11.0))
    dur = min(hold + 0.35, T1 * 2.5) if hold < T1 * 2.5 else T1 * 2.5
    dur = max(dur, 0.4)
    n = int((dur + 0.4) * sr); t = np.arange(n) / sr
    B = 0.00035
    y = np.zeros(n)
    cutoff = (1300 + 2600 * vel) * bright
    for k in range(1, 16):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > sr * 0.45: break
        a = 1.0 / k ** (1.55 - 0.5 * vel)
        a *= 1.0 / (1 + (fk / cutoff) ** 2.2)
        if k == 1: a *= 1.0
        tau = T1 / (1 + 0.55 * (k - 1))
        env = 0.72 * np.exp(-t / (tau * 0.45)) + 0.28 * np.exp(-t / (tau * 1.6))
        for det in ((-0.45, 0.5), (0.45, 0.5)) if m < 84 else ((0.0, 1.0),):
            ff = fk * 2 ** (det[0] / 1200)
            y += det[1] * a * env * np.sin(2 * math.pi * ff * t + RNG.random() * 6.28)
    # hammer felt thump
    hn = int(0.018 * sr)
    y[:hn] += au.lp(noise(hn), 900 + 1500 * vel) * 0.025 * vel * np.linspace(1, 0, hn)
    a = int(0.003 * sr); y[:a] *= np.linspace(0, 1, a)
    # damper release
    rel_start = int(hold * sr)
    if rel_start < n:
        r = int(0.28 * sr)
        e = np.ones(n); e[rel_start:rel_start + r] = np.linspace(1, 0, min(r, n - rel_start))[:len(e[rel_start:rel_start + r])]
        e[rel_start + r:] = 0
        y *= e
    return y * vel

def pluck(m, vel=0.7, pos=0.16, T=None, sr=SR, bright=1.0):
    """Harp / pizzicato-like additive pluck."""
    f = mtof(m)
    T = T or float(np.clip(3.2 * (220 / f) ** 0.6, 0.35, 4.5))
    dur = T * 2.0
    n = int(dur * sr); t = np.arange(n) / sr
    y = np.zeros(n)
    for k in range(1, 22):
        fk = f * k
        if fk > sr * 0.45: break
        a = abs(math.sin(math.pi * k * pos)) / k ** 1.1
        a *= 1 / (1 + (fk / (3500 * bright * (0.6 + 0.5 * vel))) ** 2)
        tau = T / (1 + 0.35 * (k - 1) ** 1.2)
        y += a * np.exp(-t / tau) * np.sin(2 * math.pi * fk * t + RNG.random() * 6.28)
    a = int(0.0025 * sr); y[:a] *= np.linspace(0, 1, a)
    return y * vel

def pizz(m, vel=0.7, sr=SR):
    y = pluck(m, vel, pos=0.22, T=0.42 * (98 / mtof(m)) ** 0.3 + 0.15, bright=0.7)
    return au.peq(y, 180, 3.0, 1.0)

def soft_bass(m, vel=0.6, hold=0.8, sr=SR):
    f = mtof(m)
    n = int((hold + 0.5) * sr); t = np.arange(n) / sr
    y = np.sin(2 * math.pi * f * t) + 0.25 * np.sin(4 * math.pi * f * t + 0.3) + 0.06 * np.sin(6 * math.pi * f * t)
    env = adsr(n, 0.012, 0.25, 0.55, 0.35, hold=hold)
    return y * env * vel

def pad_voice(m, dur, vel=0.4, sr=SR, cutoff=1100, attack=1.2, release=1.8, voices=5, spread=1.0):
    """Warm detuned-saw pad. Returns stereo (n,2)."""
    f = mtof(m)
    total = dur + release
    n = int(total * sr); t = np.arange(n) / sr
    out = np.zeros((n, 2))
    dets = np.linspace(-6, 6, voices)
    for i, dc in enumerate(dets):
        ff = f * 2 ** (dc / 1200)
        y = np.zeros(n)
        ph0 = RNG.random() * 6.28
        for k in range(1, 40):
            fk = ff * k
            if fk > min(sr * 0.45, cutoff * 2.6): break
            y += (1 / k) * np.sin(2 * math.pi * fk * t + ph0 * k)
        p = (i / (voices - 1) * 2 - 1) * 0.7 * spread
        out[:, 0] += y * math.cos((p + 1) * math.pi / 4)
        out[:, 1] += y * math.sin((p + 1) * math.pi / 4)
    out = au.lp(out, cutoff, sr, 4)
    env = adsr(n, attack, 0.5, 0.85, release, hold=dur)
    lfo = 1 + 0.06 * np.sin(2 * math.pi * 0.18 * t + RNG.random() * 6)
    return out * (env * lfo)[:, None] * vel / voices

def breath_flute(m, dur, vel=0.5, sr=SR):
    f = mtof(m)
    n = int((dur + 0.3) * sr); t = np.arange(n) / sr
    vib = 1 + 0.004 * np.sin(2 * math.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1)
    ph = 2 * math.pi * np.cumsum(f * vib) / sr
    y = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    br = au.bp(noise(n), f * 0.8, min(f * 3, 9000)) * 0.08
    env = adsr(n, 0.08, 0.2, 0.85, 0.25, hold=dur)
    return (y + br) * env * vel

# ---------- percussion ----------

def shaker(vel=0.3, sr=SR):
    n = int(0.09 * sr)
    y = au.bp(noise(n), 4500, 11000) * np.exp(-np.arange(n) / (0.022 * sr))
    a = int(0.006 * sr); y[:a] *= np.linspace(0, 1, a)
    return y * vel

def woodblock(m=79, vel=0.5, sr=SR):
    f = mtof(m)
    y = partial_sum(f, [1, 1.62, 2.83], [1, 0.4, 0.15], [0.05, 0.03, 0.015], 0.2, attack=0.0008)
    return y * vel

def soft_kick(vel=0.5, sr=SR, f0=58):
    n = int(0.35 * sr); t = np.arange(n) / sr
    f = f0 + 60 * np.exp(-t / 0.025)
    ph = 2 * math.pi * np.cumsum(f) / sr
    y = np.sin(ph) * np.exp(-t / 0.12)
    return au.lp(y, 400) * vel

def heartbeat_thump(vel=0.5, sr=SR):
    a = soft_kick(vel, f0=52)
    b = soft_kick(vel * 0.6, f0=48)
    gap = int(0.21 * sr)
    y = np.zeros(len(a) + gap); y[:len(a)] += a; y[gap:gap + len(b)] += b
    return y

# ---------- new voices (wow-pack): струнные, гармошка, «паутинная арфа» ----------

def string_ens(m, dur, vel=0.4, sr=SR, cutoff=2600, attack=0.45, release=0.9, voices=4):
    """Тёплый струнный ансамбль: несколько пил с вибрато, мягкий смычок. Stereo (n,2)."""
    f = mtof(m)
    total = dur + release
    n = int(total * sr); t = np.arange(n) / sr
    out = np.zeros((n, 2))
    fade_in = np.clip(t / 0.7, 0, 1)
    for i in range(voices):
        dc = (i - (voices - 1) / 2) * 4.5
        rate = 4.8 + RNG.random() * 0.9
        vib = 1 + 0.0032 * np.sin(2 * math.pi * rate * t + RNG.random() * 6.28) * fade_in
        ff = f * 2 ** (dc / 1200)
        ph = 2 * math.pi * np.cumsum(ff * vib) / sr + RNG.random() * 6.28
        y = np.zeros(n)
        for k in range(1, 48):
            if ff * k > min(sr * 0.45, cutoff * 2.4): break
            y += np.sin(k * ph) / k
        p = (i / max(1, voices - 1) * 2 - 1) * 0.6
        out[:, 0] += y * math.cos((p + 1) * math.pi / 4)
        out[:, 1] += y * math.sin((p + 1) * math.pi / 4)
    out = au.lp(out, cutoff, sr, 4)
    out = au.peq(out, 300, 2.0, 0.8)
    bow = au.bp(noise(n), 2000, 6000) * 0.012
    out += np.stack([bow, bow], axis=1)
    env = adsr(n, attack, 0.3, 0.9, release, hold=dur)
    return out * env[:, None] * vel / voices

def reed(m, dur, vel=0.5, sr=SR):
    """Гармошка/баян из старого радио: два язычка с биением, узкий спектр. Mono."""
    f = mtof(m)
    n = int((dur + 0.12) * sr); t = np.arange(n) / sr
    y = np.zeros(n)
    for det in (0.0, 2.2):
        ff = f + det
        for k, a in ((1, 1.0), (2, 0.7), (3, 0.5), (4, 0.33), (5, 0.25), (6, 0.15), (7, 0.1)):
            if ff * k > 6000: break
            y += a * np.sin(2 * math.pi * ff * k * t + k * 0.7)
    env = adsr(n, 0.03, 0.08, 0.85, 0.1, hold=dur)
    return y * env * vel * 0.35

def silk_harp(m, vel=0.6, sr=SR):
    """«Паутинная арфа»: тонкая серебряная струна — яркий щипок, стеклянный обертон, долгий хвост."""
    f = mtof(m)
    T = float(np.clip(2.8 * (440 / f) ** 0.45, 1.2, 4.8))
    y = pluck(m, vel, pos=0.09, T=T, bright=1.7)
    n = len(y)
    glass = partial_sum(f, [2.0, 3.003, 4.01, 6.02], [0.10, 0.07, 0.035, 0.015], [T * 0.6, T * 0.4, T * 0.25, 0.25], n / sr, attack=0.003, detune_cents=3)
    k2 = min(n, len(glass)); y[:k2] += glass[:k2] * vel
    # шелест нити в момент щипка
    k = int(0.02 * sr)
    y[:k] += au.bp(noise(k), 3000, 9000) * np.linspace(1, 0, k) * 0.05 * vel
    return y
