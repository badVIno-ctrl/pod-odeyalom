#!/usr/bin/env python3
# Сборка звуковых эффектов «Пять дней жара».
# Источники: CC0-библиотеки (см. docs/credits.md) + синтез (numpy/scipy).
# Запуск: python3 build_sfx.py [ключ ...]   → assets/audio/sfx/<ключ>.mp3 (+ .ogg для петель)
import sys, os, math
import numpy as np
from scipy import signal
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import au
import synth as S

SR = au.SR
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAW = os.environ.get('SFX_SRC', os.path.join(HERE, 'сырьё'))
SRC = RAW
OUT = os.path.join(ROOT, 'assets', 'audio', 'sfx')
REV = os.path.join(HERE, 'review')  # спектрограммы для проверки
rng = np.random.default_rng(2024)

def src(p): return au.load(os.path.join(SRC, p))
def T(d): return np.arange(int(d * SR)) / SR
def st(x): return au.stereo(x)

def place(buf, x, t, gain=1.0, circ=False):
    x = np.asarray(x, dtype=np.float64)
    if buf.ndim == 2 and x.ndim == 1: x = np.stack([x, x], axis=1)
    i = int(round(t * SR)); n = len(buf); m = len(x)
    if circ:
        i %= n; pos = 0
        while pos < m:
            j = (i + pos) % n; k = min(m - pos, n - j)
            buf[j:j + k] += x[pos:pos + k] * gain; pos += k
    else:
        if i < 0: x = x[-i:]; i = 0
        k = min(len(x), n - i)
        if k > 0: buf[i:i + k] += x[:k] * gain
    return buf

def env_exp(n, tau, sr=SR):
    return np.exp(-np.arange(n) / (tau * sr))

def tv_band_noise(n, fc_fn, bw_oct=0.9, color='pink', seed=None, nper=1024):
    """Noise with a time-varying band (STFT mask). fc_fn(t array) -> centre Hz."""
    g = np.random.default_rng(seed)
    w = S.noise(n + nper, color, rng=g)
    f, t, Z = signal.stft(w, fs=SR, nperseg=nper, noverlap=nper * 3 // 4)
    fc = np.maximum(fc_fn(t), 40.0)
    lf = np.log2(np.maximum(f, 1.0))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (bw_oct / 2.355 * 2)) ** 2)
    _, y = signal.istft(Z * mask, fs=SR, nperseg=nper, noverlap=nper * 3 // 4)
    return y[:n] / (np.std(y[:n]) + 1e-9)

IR_ROOM = au.make_ir(t60=0.45, predelay=0.004, damp=5000, seed=3, size=0.6)
IR_BED = au.make_ir(t60=0.7, predelay=0.008, damp=4500, seed=4, size=0.8)
IR_HALL = au.make_ir(t60=1.6, predelay=0.02, damp=6000, seed=5, size=1.2)
IR_OUT = au.make_ir(t60=1.3, predelay=0.03, damp=2500, seed=6, size=1.6)

def to_mono_safe(x): return x if x.ndim == 1 else x.mean(axis=1)

def mix(*xs):
    n = max(len(x) for x in xs); y = np.zeros(n)
    for x in xs: y[:len(x)] += x
    return y

# ---------------------------------------------------------------- from recordings
def clean(x, hpf=60, lpf=None, fin=0.002, fout=0.04):
    y = au.hp(x, hpf)
    if lpf: y = au.lp(y, lpf)
    y = au.trim(y, -45, pre=0.003, post=0.06)
    return au.fade(y, fin, fout)

def wood(i):
    if i == 1: x = au.seg(src('x/oga100/wooden_02.ogg'), 0.035, 0.225)
    elif i == 2: x = au.seg(src('x/oga100/wooden_03.ogg'), 0.015, 0.165)
    else: x = src('x/oga100/hit_02.ogg')
    x = clean(x, 90, 10000, fout=0.03)
    x = au.peq(x, 260, 2.5, 0.9)
    y = au.reverb(x, IR_ROOM, wet=0.09)
    return au.fade(to_mono_safe(y)[: int(len(x) + 0.18 * SR)], 0.001, 0.08)

def spoon(i):
    x = src('x/oga100/glass_04.ogg' if i == 1 else 'x/oga100/glass_05.ogg')
    x = clean(x, 500, 12000, fout=0.12)
    y = au.reverb(x, IR_ROOM, wet=0.12)
    return to_mono_safe(y)

def cup():
    x = src('x/oga100/dishes_04.ogg')
    x = clean(x, 120, 6500, fout=0.08)
    x = au.peq(x, 400, 2.0, 0.8)
    return to_mono_safe(au.reverb(x, IR_ROOM, wet=0.1))

def pop():
    x = clean(src('x/oga100/plop_02.ogg'), 120, 9000, fout=0.05)
    return to_mono_safe(au.reverb(x, IR_ROOM, wet=0.08))

def splash(i):
    x = src('x/oga100/splash_01.ogg' if i == 1 else 'x/oga100/splash_02.ogg')
    x = clean(x, 140, 8000, fout=0.12)
    return to_mono_safe(au.reverb(x, IR_ROOM, wet=0.12))

def boom():
    n = int(1.6 * SR); y = np.zeros(n)
    t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t / 0.05)
    ph = 2 * math.pi * np.cumsum(f) / SR
    thump = np.tanh(2.2 * np.sin(ph) * np.exp(-t / 0.22)) * 0.8
    thump[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    y += thump
    ex = au.lp(src('x/oga100/explosion.ogg'), 3400)
    ex = au.fade(ex, 0.001, 0.25)
    place(y, ex / (au.peak(ex) + 1e-9) * 0.8, 0.0)
    body = au.bp(S.noise(int(0.35 * SR), 'pink'), 150, 900) * env_exp(int(0.35 * SR), 0.07) * 0.18
    place(y, body, 0.0)
    puff = au.lp(S.noise(int(0.9 * SR), 'brown'), 700) * env_exp(int(0.9 * SR), 0.18) * 0.25
    place(y, puff, 0.01)
    y = au.soft_limit(y / (au.peak(y) + 1e-9), 0.95)
    out = au.reverb(y, IR_BED, wet=0.22)
    return au.fade(out[: int(1.7 * SR)], 0.0, 0.3)

def paper(i):
    f = {1: 'x/flips/book_flip.4.ogg', 2: 'x/flips/book_flip.6.ogg', 3: 'x/flips/book_flip.8.ogg'}[i]
    x = clean(src(f), 220, 11000, fout=0.06)
    return x

def page():
    return clean(src('x/flips/book_flip.1.ogg'), 200, 11000, fout=0.08)

def pencil(i):
    x = src('x/pencil/ogg/pencil_write.ogg')
    a, b = {1: (0.0, 0.262), 2: (0.266, 0.548), 3: (0.552, 0.875)}[i]
    y = au.seg(x, a, b)
    y = au.hp(y, 300)
    return au.fade(y, 0.004, 0.05)

def pencil_scribble():
    x = src('x/pencil/ogg/pencil_write.ogg')
    y = au.hp(au.seg(x, 0.0, 1.12), 300)
    return au.fade(y, 0.004, 0.12)

def erase():
    x = au.seg(src('x/pencil/ogg/pencil_erase.ogg'), 0.0, 0.5)
    return au.fade(au.hp(x, 250), 0.004, 0.09)

def gull(i):
    f = {1: 'Seagull_Ambient_4.wav', 2: 'Seagull_Ambient_5.wav', 3: 'Seagull_Ambient_6.wav'}[i]
    x = clean(src(f), 450, 4800, fout=0.15)
    y = au.reverb(x, IR_OUT, wet=0.35, dry=0.8)
    return au.fade(y[: int(len(x) + 1.0 * SR)], 0.0, 0.5)

def heartbeat():
    x = au.hp(src('heartbeat_slow_0.wav'), 25)
    x = au.lp(x, 650)
    cyc = [au.seg(x, 0.0, 0.9), au.seg(x, 0.9, 1.8)]
    cyc = [au.fade(c, 0.003, 0.12) for c in cyc]
    beat = 0.9; nb = 16; L = int(round(beat * nb * SR))
    buf = np.zeros(L)
    g = np.random.default_rng(11)
    for k in range(nb):
        c = cyc[k % 2]
        jit = g.uniform(-0.008, 0.008)
        gain = 10 ** (g.uniform(-1.2, 0.6) / 20)
        place(buf, c, k * beat + jit, gain, circ=True)
    y = au.circ_reverb(buf, IR_BED, wet=0.12)
    return y

def drink(f, a=None, b=None, hpf=110, lpf=9000):
    x = src('x/more/Drink/' + f)
    if a is not None: x = au.seg(x, a, b)
    x = clean(x, hpf, lpf, fin=0.004, fout=0.06)
    x = au.peq(x, 3500, -3.0, 0.8)   # мягче «чмок»
    return to_mono_safe(au.reverb(x, IR_ROOM, wet=0.08))

def sip(i):
    if i == 1:
        # хлюп из чашки, через полсекунды — глоток
        s1 = drink('Drink_06.wav', 0.05, 0.78)
        g = drink('Drink_03.wav') * 0.55
        return mix(s1, np.concatenate([np.zeros(int(0.6 * SR)), g]))
    return drink('Drink_04.wav')

def gulp(i):
    return drink('Drink_03.wav') if i == 1 else drink('Drink_02.wav', 0.15, 0.44)

# ---------------------------------------------------------------- loops (synth)
def siren():
    L = 24.0; n = int(L * SR); t = np.arange(n) / SR
    cyc = 3.0
    u = (t % cyc) / cyc
    rise = 0.46
    shape = np.where(u < rise, np.sin(0.5 * math.pi * np.clip(u / rise, 0, 1)) ** 1.3,
                     np.cos(0.5 * math.pi * np.clip((u - rise) / (1 - rise), 0, 1)) ** 1.6)
    f = 640 + 520 * shape
    # integer number of cycles per loop for every harmonic
    total = np.sum(f) / SR; f = f * (round(total) / total)
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.zeros(n)
    for k, a in zip(range(1, 9), [1, 0.55, 0.42, 0.24, 0.18, 0.1, 0.07, 0.04]):
        y += a * np.sin(k * ph)
    # distant: bandlimit, wind flutter (periodic in L), outdoor reverb
    y = au.circ_filter(y, signal.butter(2, [380, 1700], 'bandpass', fs=SR, output='sos'))
    flutter = 1 + 0.18 * np.sin(2 * math.pi * t * 2 / L + 0.5) + 0.08 * np.sin(2 * math.pi * t * 7 / L + 1.7)
    y = y * flutter
    air = np.fft.irfft(np.fft.rfft(S.noise(n, 'pink', rng=np.random.default_rng(5))), n)
    air = au.circ_filter(air, signal.butter(2, 900, 'lowpass', fs=SR, output='sos'))
    y = y / (np.std(y) + 1e-9) + air / (np.std(air) + 1e-9) * 0.05
    return au.circ_reverb(y, IR_OUT, wet=0.7, dry=0.55)

def sea():
    L = 24.0; n = int(L * SR); t = np.arange(n) / SR
    g = np.random.default_rng(21)
    def circ_noise(color, seed):
        w = S.noise(n, color, rng=np.random.default_rng(seed))
        return w / (np.std(w) + 1e-9)
    # wave swells: crash times within loop
    crashes = [1.6, 7.4, 12.9, 18.8]
    lowenv = np.zeros(n); hienv = np.zeros(n)
    for c in crashes:
        for sh in (-L, 0, L):
            d = t - (c + sh)
            lowenv += np.exp(-0.5 * (d / 1.9) ** 2) * (0.85 + 0.3 * g.random())
            hienv += np.where(d < 0, np.exp(-0.5 * (d / 0.6) ** 2), np.exp(-d / 2.2)) * (d > -3) * (0.8 + 0.3 * g.random())
    lowenv = 0.35 + lowenv; hienv = 0.12 + hienv
    out = np.zeros((n, 2))
    for ch in range(2):
        lo = au.circ_filter(circ_noise('brown', 30 + ch), signal.butter(2, 320, 'lowpass', fs=SR, output='sos'))
        hi = au.circ_filter(circ_noise('pink', 40 + ch), signal.butter(2, [700, 4200], 'bandpass', fs=SR, output='sos'))
        lag = int((0.12 if ch else 0) * SR)
        out[:, ch] = lo / (np.std(lo) + 1e-9) * np.roll(lowenv, lag) * 0.55 + hi / (np.std(hi) + 1e-9) * np.roll(hienv, lag) * 0.28
    # real wave recordings at the crashes
    waves = [src(f'wave_0{i}_cc0-11505__transitking__wavesound.flac') for i in (1, 2, 3, 4)]
    for j, c in enumerate(crashes):
        w = au.lp(au.hp(waves[j % 4], 90), 5200)
        w = au.fade(w, 0.25, 0.8)
        w = w / (np.std(w) + 1e-9) * 0.35
        p = [-0.35, 0.3, -0.15, 0.4][j]
        place(out, au.pan(w, p), c - 0.25, circ=True)
    out = au.circ_filter(out, signal.butter(2, 6000, 'lowpass', fs=SR, output='sos'))
    return au.circ_reverb(out, IR_OUT, wet=0.18)

def stove():
    L = 20.0; n = int(L * SR); t = np.arange(n) / SR
    g = np.random.default_rng(31)
    out = np.zeros((n, 2))
    for ch in range(2):
        r = S.noise(n, 'brown', rng=np.random.default_rng(50 + ch))
        r = au.circ_filter(r, signal.butter(2, [40, 220], 'bandpass', fs=SR, output='sos'))
        mod = 1 + 0.25 * np.sin(2 * math.pi * t * 3 / L + ch) + 0.15 * np.sin(2 * math.pi * t * 11 / L + 2 * ch)
        out[:, ch] = r / (np.std(r) + 1e-9) * mod * 0.30
        hiss = au.circ_filter(S.noise(n, 'pink', rng=np.random.default_rng(60 + ch)),
                              signal.butter(2, [1500, 5000], 'bandpass', fs=SR, output='sos'))
        out[:, ch] += hiss / (np.std(hiss) + 1e-9) * 0.018
    # crackles in clusters
    tt = 0.0
    while tt < L:
        burst = g.random() < 0.3
        k = g.integers(3, 9) if burst else 1
        for _ in range(k):
            dur = g.uniform(0.0015, 0.007)
            m = max(8, int(dur * SR))
            fc = g.uniform(1300, 6500)
            gr = au.bp(g.standard_normal(m + 64), fc * 0.6, min(fc * 1.6, 15000))[:m] * env_exp(m, dur / 3)
            amp = 10 ** (g.uniform(-30, -6) / 20)
            place(out, au.pan(gr, g.uniform(-0.6, 0.6)), tt, amp * 1.4, circ=True)
            tt += g.uniform(0.006, 0.05)
        if g.random() < 0.07:  # wood pop
            m = int(0.03 * SR)
            pp = au.lp(g.standard_normal(m), 900) * env_exp(m, 0.008) * 0.6
            pp[:30] += g.standard_normal(30) * 0.5
            place(out, au.pan(pp, g.uniform(-0.4, 0.4)), tt, 0.5, circ=True)
        tt += g.exponential(0.18)
    return au.circ_reverb(out, IR_ROOM, wet=0.15)

def drone():
    L = 24.0; n = int(L * SR); t = np.arange(n) / SR
    q = lambda f: round(f * L) / L
    out = np.zeros((n, 2))
    voices = [(S.ntom('B1'), 0.5, 0.0), (S.ntom('F#2'), 0.32, 1.1), (S.ntom('B2'), 0.26, 2.3), (S.ntom('D3'), 0.12, 0.6)]
    for m, amp, ph0 in voices:
        f0 = S.mtof(m)
        for ch in range(2):
            for det in (-2, 1, 3):
                f = q(f0) + det / L * (1 + ch)
                bright = 0.55 + 0.45 * np.sin(2 * math.pi * t * 1 / L + ph0 + ch)
                y = np.zeros(n)
                for k in range(1, 11):
                    if f * k > 2400: break
                    wk = (1 / k ** 1.6) * (bright ** (0.35 * (k - 1)))
                    y += wk * np.sin(2 * math.pi * q(f * k) * t + rng.random() * 6.28)
                swell = 0.7 + 0.3 * np.sin(2 * math.pi * t * 2 / L + ph0 * 1.7 + ch * 0.5)
                out[:, ch] += y * amp * swell / 3
    # faint tension tone (C4, b2 of B minor), swells once per loop
    for ch in range(2):
        out[:, ch] += 0.03 * np.sin(math.pi * t / L) ** 4 * np.sin(2 * math.pi * q(S.mtof(S.ntom('C4'))) * t + ch)
    air = np.stack([au.circ_filter(S.noise(n, 'pink', rng=np.random.default_rng(70 + c)),
                                   signal.butter(2, 260, 'lowpass', fs=SR, output='sos')) for c in range(2)], axis=1)
    out += air / (np.std(air) + 1e-9) * 0.05
    return au.circ_reverb(out, IR_HALL, wet=0.3)

# ---------------------------------------------------------------- tonal one-shots
def bar_tone(f, dur, Tdec, vel=1.0, beat=0.7):
    t = T(dur)
    y = np.zeros(len(t))
    for r, a, d in ((1, 1, 1), (2.756, 0.30, 0.35), (5.404, 0.10, 0.16), (8.933, 0.035, 0.07)):
        for det in (0, beat):
            y += 0.5 * a * np.sin(2 * math.pi * (f * r + det * r) * t + rng.random() * 6.28) * np.exp(-t / (Tdec * d))
    a = int(0.002 * SR); y[:a] *= np.linspace(0, 1, a)
    m = int(0.012 * SR)
    y[:m] += au.lp(S.noise(m), 2500) * np.linspace(1, 0, m) * 0.08
    return y * vel

def doorbell():
    n = int(2.8 * SR); y = np.zeros(n)
    place(y, bar_tone(S.mtof(S.ntom('E5')), 2.6, 1.5, 0.9), 0.0)
    place(y, bar_tone(S.mtof(S.ntom('C5')), 2.2, 1.7, 0.85), 0.52)
    y = au.lp(y, 7000)
    out = au.reverb(y, IR_BED, wet=0.22)
    return au.fade(out[:n], 0.0, 0.5)

def notes_seq(seq, inst, dur, ir=IR_HALL, wet=0.3):
    n = int(dur * SR); y = np.zeros(n)
    for tt, m, v in seq: place(y, inst(m, v), tt)
    out = au.reverb(y, ir, wet=wet)
    return au.fade(out[:n], 0.0, min(0.4, dur * 0.3))

def chime():
    seq = [(0.0, S.ntom('A5'), 0.5), (0.07, S.ntom('D6'), 0.55), (0.14, S.ntom('F#6'), 0.5), (0.21, S.ntom('A6'), 0.42)]
    inst = lambda m, v: mix(S.celesta(m, v) * 0.7, S.glock(m + 12, v * 0.25))
    return notes_seq(seq, inst, 1.8)

def combo():
    seq = [(0.0, S.ntom('D6'), 0.5), (0.06, S.ntom('F#6'), 0.5), (0.12, S.ntom('A6'), 0.55), (0.2, S.ntom('D7'), 0.25)]
    return notes_seq(seq, lambda m, v: S.celesta(m, v), 1.2, wet=0.25)

def shimmer(dur, f1=5000, f2=11000, seed=1):
    n = int(dur * SR)
    w = au.bp(np.random.default_rng(seed).standard_normal(n), f1, f2)
    t = np.arange(n) / SR
    trem = 0.5 + 0.5 * np.abs(np.sin(2 * math.pi * 23 * t + 3 * np.sin(2 * math.pi * 3 * t)))
    return w / (np.std(w) + 1e-9) * trem

def sparkle():
    dur = 1.7; n = int(dur * SR); y = np.zeros(n)
    notes = ['D7', 'A6', 'F#7', 'B6', 'E7', 'A6', 'D7']
    tt = 0.0
    for i, nm in enumerate(notes):
        v = 0.5 * (1 - i / 9)
        place(y, mix(S.glock(S.ntom(nm), v) * 0.8, S.celesta(S.ntom(nm) - 12, v * 0.3)), tt)
        tt += 0.045 + rng.random() * 0.02
    sh = shimmer(0.9, seed=3) * np.exp(-np.arange(int(0.9 * SR)) / (0.14 * SR)) * 0.018
    sh[: int(0.03 * SR)] *= np.linspace(0, 1, int(0.03 * SR))
    place(y, sh, 0.0)
    out = au.reverb(y, IR_HALL, wet=0.35)
    return au.fade(out[:n], 0.0, 0.5)

def magic():
    dur = 2.2; n = int(dur * SR); y = np.zeros(n)
    # rising airy swell
    sw = int(0.55 * SR)
    rise = (np.linspace(0, 1, sw) ** 2.5)
    sh = shimmer(0.55, 2500, 9000, seed=8) * rise * 0.06
    place(y, sh, 0.0)
    tt = T(0.55); fgl = 500 * 2 ** (2.2 * tt / 0.55)
    gl = np.sin(2 * math.pi * np.cumsum(fgl) / SR) * rise * 0.05
    place(y, gl, 0.0)
    # poof
    pm = int(0.35 * SR)
    poof = au.lp(S.noise(pm, 'pink'), 1400) * env_exp(pm, 0.07) * 0.35
    place(y, poof, 0.55)
    place(y, S.soft_kick(0.35, f0=70), 0.55)
    # descending sparkle in key
    for i, nm in enumerate(['A6', 'F#6', 'D6', 'B5', 'A5']):
        place(y, S.celesta(S.ntom(nm), 0.32 - i * 0.04), 0.6 + i * 0.075)
    out = au.reverb(y, IR_HALL, wet=0.38)
    return au.fade(out[:n], 0.0, 0.5)

def web():
    dur = 1.4; n = int(dur * SR); t = np.arange(n) / SR
    f0 = S.mtof(S.ntom('B5'))
    bend = 1 + 0.018 * np.exp(-t / 0.05)
    y = np.zeros(n)
    for k, a, d in ((1, 1, 0.55), (2.01, 0.35, 0.3), (3.03, 0.18, 0.18), (4.07, 0.08, 0.1)):
        ph = 2 * math.pi * np.cumsum(f0 * k * bend) / SR
        y += a * np.sin(ph + rng.random() * 6) * np.exp(-t / d)
    a = int(0.002 * SR); y[:a] *= np.linspace(0, 1, a)
    # silk stretch creak before the twang
    cm = int(0.12 * SR); creak = np.zeros(cm)
    for i in range(10):
        j = int(rng.uniform(0, cm - 60))
        creak[j:j + 40] += rng.standard_normal(40) * np.exp(-np.arange(40) / 10)
    creak = au.bp(creak, 1200, 3500) * np.linspace(0.3, 1, cm) * 0.25
    out = np.zeros(n + cm)
    place(out, creak, 0.0); place(out, y * 0.8, cm / SR)
    # faint octave shimmer with slow tremolo
    tt = np.arange(len(out)) / SR
    sh = 0.05 * np.sin(2 * math.pi * f0 * 2 * tt) * np.exp(-tt / 0.6) * (0.6 + 0.4 * np.sin(2 * math.pi * 6 * tt))
    sh[:cm] = 0
    out += sh
    out = au.reverb(out, IR_BED, wet=0.2)
    return au.fade(out[: n + cm], 0.0, 0.3)

def buzz():
    dur = 1.0; n = int(dur * SR); t = np.arange(n) / SR
    g = np.random.default_rng(9)
    walk = signal.lfilter([0.002], [1, -0.998], g.standard_normal(n)); walk /= (np.max(np.abs(walk)) + 1e-9)
    f = 205 * (1 + 0.035 * np.sin(2 * math.pi * 3.3 * t) + 0.04 * walk)
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.zeros(n)
    for k in range(1, 16):
        if 205 * k > 5000: break
        y += (1 / k ** 0.9) * np.sin(k * ph + k * 0.7)
    am = 0.75 + 0.25 * np.sin(2 * math.pi * 4.2 * t + 1)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    y = au.bp(y * am * e, 160, 3800)
    p = np.linspace(-0.6, 0.5, n)
    return np.stack([y * np.cos((p + 1) * math.pi / 4), y * np.sin((p + 1) * math.pi / 4)], axis=1)

def blink():
    n = int(0.36 * SR); y = np.zeros(n)
    for tt, d, a in ((0.0, 0.07, 1.0), (0.17, 0.09, 0.8)):
        m = int(d * SR)
        e = np.sin(np.pi * np.linspace(0, 1, m)) ** 2
        p = au.lp(S.noise(m, 'pink'), 650) * e * a
        p += 0.6 * np.sin(2 * math.pi * 95 * np.arange(m) / SR) * e * a
        place(y, p, tt)
    return au.fade(y, 0.002, 0.05)

def tap():
    n = int(0.12 * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for f, a, d in ((1850, 1.0, 0.022), (3120, 0.5, 0.013), (4700, 0.25, 0.007), (920, 0.35, 0.015)):
        y += a * np.sin(2 * math.pi * f * t + rng.random()) * np.exp(-t / d)
    y[:40] += rng.standard_normal(40) * np.exp(-np.arange(40) / 8) * 0.4
    a = int(0.0006 * SR); y[:a] *= np.linspace(0, 1, a)
    return au.fade(au.hp(y, 400), 0.0, 0.03)

def whoosh():
    dur = 0.6; n = int(dur * SR)
    fc = lambda tt: 380 + 1500 * np.exp(-0.5 * ((tt - 0.24) / 0.11) ** 2)
    y = tv_band_noise(n, fc, bw_oct=1.3, color='pink', seed=4)
    tt = np.arange(n) / SR
    e = np.where(tt < 0.24, (tt / 0.24) ** 1.6, np.exp(-(tt - 0.24) / 0.12))
    y = y * e
    p = np.linspace(-0.35, 0.35, n)
    return np.stack([y * np.cos((p + 1) * math.pi / 4), y * np.sin((p + 1) * math.pi / 4)], axis=1)

def moth_flutter():
    dur = 1.15; n = int(dur * SR); y = np.zeros(n)
    g = np.random.default_rng(13)
    tt = 0.0; i = 0
    while tt < dur - 0.03:
        rate = 21 + 4 * math.sin(2 * math.pi * 1.4 * tt)
        m = int(g.uniform(0.012, 0.02) * SR)
        b = au.bp(g.standard_normal(m + 128), 200, 1700)[128:] * np.sin(np.pi * np.linspace(0, 1, m)) ** 2
        amp = (0.7 if i % 2 else 1.0) * (0.85 + 0.3 * g.random())
        place(y, b, tt, amp)
        tt += 1 / rate; i += 1
    tt_ = np.arange(n) / SR
    env = np.clip(tt_ / 0.08, 0, 1) * np.exp(-np.maximum(0, tt_ - 0.35) / 0.45)
    y *= env
    # faint warm embers
    for k in range(7):
        m = 30
        e = g.standard_normal(m) * np.exp(-np.arange(m) / 6)
        place(y, au.hp(e, 3000), g.uniform(0.05, 0.9), 0.04)
    y = au.lp(y, 3200)
    return au.reverb(y, IR_BED, wet=0.12)[: n + int(0.2 * SR)]

def bullfinch():
    dur = 2.0; n = int(dur * SR); y = np.zeros(n)
    calls = [(0.05, 0.24, 2330, 1980), (0.66, 0.17, 2280, 2010), (0.92, 0.25, 2380, 1950)]
    g = np.random.default_rng(17)
    for start, d, f0, f1 in calls:
        m = int(d * SR); tt = np.arange(m) / SR
        u = tt / d
        f = np.where(u < 0.08, f0 - 160 * (1 - np.clip(u / 0.08, 0, 1)) ** 2, f0 + (f1 - f0) * (np.clip((u - 0.08) / 0.92, 0, 1)) ** 0.8)
        f *= 1 + 0.004 * np.sin(2 * math.pi * 31 * tt)
        ph = 2 * math.pi * np.cumsum(f) / SR
        tone = np.sin(ph) + 0.1 * np.sin(2 * ph) + 0.03 * np.sin(3 * ph)
        e = np.clip(u / 0.07, 0, 1) ** 1.5 * np.clip((1 - u) / 0.35, 0, 1) ** 1.2
        br = au.bp(g.standard_normal(m), 1800, 3200) * 0.035
        place(y, (tone + br) * e, start)
    y = au.lp(y, 4500)
    out = au.reverb(y, IR_OUT, wet=0.22)
    return au.fade(out[:n], 0.0, 0.4)

def engine():
    dur = 5.8; n = int(dur * SR); t = np.arange(n) / SR
    g = np.random.default_rng(19)
    y = np.zeros(n)
    # starter cranking 0..0.95 s
    sm = int(0.95 * SR); ts = np.arange(sm) / SR
    crank = 0.55 + 0.45 * np.clip(np.sin(2 * math.pi * 9.5 * ts), 0, None) ** 2
    whine = np.zeros(sm)
    for k in range(1, 12): whine += (1 / k) * np.sin(2 * math.pi * 165 * k * ts * (1 + 0.04 * ts))
    starter = au.lp(whine, 1600) * crank * np.clip(ts / 0.05, 0, 1) * 0.35
    place(y, starter, 0.0)
    # combustion pulses (firing frequency)
    fire = np.interp(t, [0, 0.9, 1.15, 1.6, 2.4, 4.4, 5.8], [0, 0, 32, 26, 22, 23, 24])
    ph = np.cumsum(fire) / SR
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    imp = np.zeros(n)
    for i in idx: imp[min(n - 1, i + int(g.uniform(0, 0.0015) * SR))] += g.uniform(0.75, 1.0)
    tir = np.arange(int(0.06 * SR)) / SR
    ex_ir = (np.sin(2 * math.pi * 68 * tir) * np.exp(-tir / 0.018) + 0.5 * np.sin(2 * math.pi * 137 * tir) * np.exp(-tir / 0.01))
    pulses = signal.fftconvolve(imp, ex_ir)[:n]
    noisy = signal.fftconvolve(imp, au.lp(g.standard_normal(len(tir)), 500) * np.exp(-tir / 0.012))[:n] * 0.4
    body = pulses + noisy
    body *= np.clip((t - 0.9) / 0.06, 0, 1)
    y += body * 0.7
    rumble = au.lp(S.noise(n, 'brown', rng=g), 120) * 0.12 * np.clip((t - 0.9) / 0.3, 0, 1)
    y += rumble
    y = au.lp(au.hp(y, 28), 900)
    y *= np.clip((dur - t) / 1.3, 0, 1) ** 1.2
    return au.reverb(y, IR_ROOM, wet=0.12)[:n]

# ---------------------------------------------------------------- UI
def ui_hover():
    n = int(0.07 * SR); t = np.arange(n) / SR
    y = 0.6 * np.sin(2 * math.pi * 2600 * t) * np.exp(-t / 0.012) + 0.25 * np.sin(2 * math.pi * 3900 * t) * np.exp(-t / 0.006)
    y[:30] += rng.standard_normal(30) * np.exp(-np.arange(30) / 6) * 0.2
    a = int(0.0008 * SR); y[:a] *= np.linspace(0, 1, a)
    return au.fade(y, 0.0, 0.02)

def ui_click():
    n = int(0.26 * SR); y = np.zeros(n)
    place(y, au.fade(S.woodblock(S.ntom('E6'), 0.6), 0, 0.08) * 0.8, 0.0)
    place(y, au.fade(S.woodblock(S.ntom('B6'), 0.25), 0, 0.08), 0.012)
    tk = au.hp(rng.standard_normal(50), 2000) * np.exp(-np.arange(50) / 9) * 0.25
    place(y, tk, 0.0)
    return au.fade(au.reverb(y, IR_ROOM, wet=0.08)[:n].mean(axis=1), 0.0, 0.06)

def tear():
    dur = 0.55; n = int(dur * SR); y = np.zeros(n)
    g = np.random.default_rng(23)
    # rip: micro-crackle train, density bell-shaped
    tt = 0.02
    while tt < 0.36:
        dens = 900 * math.exp(-0.5 * ((tt - 0.18) / 0.09) ** 2) + 80
        m = int(g.uniform(0.0003, 0.0016) * SR) + 4
        gr = g.standard_normal(m) * np.exp(-np.arange(m) / (m / 3))
        place(y, gr, tt, 10 ** (g.uniform(-14, 0) / 20))
        tt += g.exponential(1 / dens)
    y = au.bp(y, 900, 7500) * 0.7
    # paper body
    body = au.bp(S.noise(n, 'pink', rng=g), 500, 3500)
    tt_ = np.arange(n) / SR
    body *= np.exp(-0.5 * ((tt_ - 0.2) / 0.1) ** 2) * 0.08
    y += body
    flip = clean(src('x/flips/book_flip.8.ogg'), 200, 9000)
    flip = flip / (au.peak(flip) + 1e-9) * 0.25
    place(y, flip, 0.3)
    return au.fade(y, 0.002, 0.08)


# ---------------------------------------------------------------- wow-pack: дом
def creak(i):
    """Скрип половицы: «прилипание-срыв» (серия импульсов с плавающей частотой) через деревянные моды."""
    g = np.random.default_rng(700 + i)
    dur = [0.55, 0.8, 0.42][i - 1]
    n = int(dur * SR); y = np.zeros(n)
    t = 0.0
    f_lo, f_hi = [(70, 140), (45, 110), (90, 180)][i - 1]
    while t < dur - 0.03:
        k = t / dur
        f = f_lo + (f_hi - f_lo) * math.sin(math.pi * k) + g.normal(0, 6)
        amp = math.sin(math.pi * min(1, k * 1.15)) ** 0.7 * (0.6 + 0.4 * g.random())
        j = int(t * SR)
        if j < n: y[j] += amp
        t += 1.0 / max(25, f)
    modes = [(190, 0.035), (430, 0.025), (780, 0.018), (1350, 0.012), (2300, 0.006)]
    out = np.zeros(n)
    for f, tau in modes:
        f *= 1 + g.uniform(-0.06, 0.06)
        h = np.exp(-np.arange(int(tau * 6 * SR)) / (tau * SR)) * np.sin(2 * math.pi * f * np.arange(int(tau * 6 * SR)) / SR)
        out += signal.fftconvolve(y, h)[:n] * (1.0 if f < 900 else 0.5)
    out = au.bp(out, 120, 3200)
    out = np.tanh(out * 1.5)
    return au.fade(out, 0.004, 0.08)

def switch():
    x = clean(src('x/oga100/switch_01.ogg'), 150, 9000)
    x = au.trim(x, -45, 0.002, 0.06)
    return au.reverb(x, IR_BED, wet=0.12)[:len(x) + int(0.1 * SR)]

def clock_strike():
    """Бой старых настенных часов: мягкий гонг-пружина (одна нота с долгим хвостом)."""
    dur = 4.2; t = T(dur)
    f = 196.0
    y = np.zeros(len(t))
    for r, a, d in ((0.5, 0.35, 3.0), (1.0, 1.0, 2.2), (1.19, 0.35, 1.4), (1.5, 0.3, 1.1), (2.0, 0.45, 0.9), (2.52, 0.2, 0.5), (3.01, 0.12, 0.35), (4.1, 0.06, 0.2)):
        for det in (0, 0.9):
            y += 0.5 * a * np.sin(2 * math.pi * (f * r + det) * t + rng.random() * 6.28) * np.exp(-t / d)
    m = int(0.01 * SR)
    y[:m] += au.bp(S.noise(m), 1500, 6000) * np.linspace(1, 0, m) * 0.15
    y = au.lp(y, 5000)
    out = au.reverb(y, IR_BED, wet=0.25)
    return au.fade(out[:len(t)], 0.0, 0.8)

# ---------------------------------------------------------------- registry
# key: (fn, target, mode, loop)  mode: 'm' = momentary max, 'i' = integrated
REG = {
    'wood_1': (lambda: wood(1), -22, 'm', False), 'wood_2': (lambda: wood(2), -22, 'm', False), 'wood_3': (lambda: wood(3), -22, 'm', False),
    'spoon_1': (lambda: spoon(1), -25, 'm', False), 'spoon_2': (lambda: spoon(2), -25, 'm', False),
    'cup': (cup, -24, 'm', False), 'pop': (pop, -25, 'm', False),
    'splash_1': (lambda: splash(1), -22, 'm', False), 'splash_2': (lambda: splash(2), -22, 'm', False),
    'boom': (boom, -19, 'm', False),
    'paper_1': (lambda: paper(1), -25, 'm', False), 'paper_2': (lambda: paper(2), -25, 'm', False), 'paper_3': (lambda: paper(3), -25, 'm', False),
    'page': (page, -26, 'm', False),
    'pencil_1': (lambda: pencil(1), -26, 'm', False), 'pencil_2': (lambda: pencil(2), -26, 'm', False), 'pencil_3': (lambda: pencil(3), -26, 'm', False),
    'pencil_scribble': (pencil_scribble, -26, 'm', False), 'erase': (erase, -26, 'm', False),
    'gull_1': (lambda: gull(1), -26, 'm', False), 'gull_2': (lambda: gull(2), -26, 'm', False), 'gull_3': (lambda: gull(3), -26, 'm', False),
    'heartbeat': (heartbeat, -28, 'i', True), 'siren': (siren, -26, 'i', True), 'sea': (sea, -26, 'i', True),
    'stove': (stove, -28, 'i', True), 'drone': (drone, -30, 'i', True),
    'doorbell': (doorbell, -20, 'm', False), 'chime': (chime, -22, 'm', False), 'combo': (combo, -22, 'm', False),
    'sparkle': (sparkle, -24, 'm', False), 'magic': (magic, -22, 'm', False), 'web': (web, -24, 'm', False),
    'buzz': (buzz, -29, 'm', False), 'blink': (blink, -31, 'm', False), 'tap': (tap, -27, 'm', False),
    'whoosh': (whoosh, -26, 'm', False), 'moth_flutter': (moth_flutter, -25, 'm', False), 'bullfinch': (bullfinch, -24, 'm', False),
    'engine': (engine, -21, 'm', False),
    'sip_1': (lambda: sip(1), -26, 'm', False), 'sip_2': (lambda: sip(2), -26, 'm', False),
    'gulp_1': (lambda: gulp(1), -25, 'm', False), 'gulp_2': (lambda: gulp(2), -25, 'm', False),
    'ui_hover': (ui_hover, -34, 'm', False), 'ui_click': (ui_click, -29, 'm', False), 'tear': (tear, -23, 'm', False),
    'creak_1': (lambda: creak(1), -27, 'm', False), 'creak_2': (lambda: creak(2), -27, 'm', False), 'creak_3': (lambda: creak(3), -27, 'm', False),
    'switch': (switch, -27, 'm', False), 'clock_strike': (clock_strike, -26, 'm', False),
}

def build(key):
    fn, target, mode, loop = REG[key]
    x = fn()
    x = np.asarray(x, dtype=np.float64)
    if mode == 'i': x = au.norm_lufs(x, target, ceiling=-1.5)
    else: x = au.norm_mmax(x, target, ceiling=-1.0)
    if not loop: x = au.fade(x, 0.0, 0.01)
    au.encode(x, os.path.join(OUT, key), mp3=True, ogg=loop, kbps=(128 if (x.ndim == 2) else 96))
    au.spectro_png(x, os.path.join(REV, key + '.png'), title=f'{key} {len(x)/SR:.2f}s I={au.lufs(x):.1f} M={au.mmax(x):.1f} pk={au.db(au.peak(x)):.1f}')
    print(f'{key:16s} {len(x)/SR:6.2f}s  I={au.lufs(x):6.1f}  M={au.mmax(x):6.1f}  pk={au.db(au.peak(x)):5.1f}')

if __name__ == '__main__':
    keys = sys.argv[1:] or list(REG)
    os.makedirs(OUT, exist_ok=True); os.makedirs(REV, exist_ok=True)
    for k in keys: build(k)
