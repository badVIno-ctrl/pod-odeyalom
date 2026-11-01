# Sampler over CC0 VCSL recordings (Versilian Community Sample Library, github.com/sgossner/VCSL).
import os, re, glob, math
from fractions import Fraction
import numpy as np
from scipy import signal
import au
import synth as S

SR = au.SR
VDIR = os.path.join(os.environ.get('SFX_SRC', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'сырьё')), 'vcsl')

# set name -> (glob, octave offset in semitones, layer regex -> layer id)
SETS = {
    'piano':   ('*Knight__Sustains__Player_vl*_rr1_*.wav', 12, r'_vl(\d)_'),
    'harp':    ('*Concert_Harp__KSHarp_*_mf1.wav', 0, None),
    'glock':   ('*Glockenspiel__glock_*.wav', 12, r'glock_(soft|medium|loud)_'),
    'vibes':   ('*Soft_Mallets__Vibes_soft_*_Main.wav', 12, r'_v(\d)_'),
    'marimba': ('*Marimba__Marimba_hit_Outrigger_*.wav', 12, r'_(soft|med)_'),
}
LAYER_ORDER = {'1': 0, '2': 1, 'soft': 0, 'medium': 1, 'med': 1, 'loud': 2}
NOTE_RX = r'_([A-G]#?-?\d)(?:_|\.wav)'

_cache = {}
_index = {}

def _load(path):
    if path not in _cache:
        x = au.load(path, mono=False)
        a = np.abs(x).max(axis=1)
        pk = a.max()
        i0 = int(np.argmax(a > pk * 10 ** (-45 / 20)))
        i0 = max(0, i0 - int(0.001 * SR))
        x = x[i0:]
        # remove DC / rumble
        x = au.hp(x, 25)
        _cache[path] = x
    return _cache[path]

def _refine_root(x, m_exp):
    mono = x.mean(axis=1)
    seg = mono[int(0.02 * SR): int(0.9 * SR)]
    if len(seg) < 4096: seg = mono[:8192]
    w = seg * np.hanning(len(seg))
    nfft = 1 << 18
    F = np.abs(np.fft.rfft(w, nfft)); f = np.fft.rfftfreq(nfft, 1 / SR)
    def peak_near(fr, cents=70):
        lo, hi = fr * 2 ** (-cents / 1200), fr * 2 ** (cents / 1200)
        idx = np.where((f >= lo) & (f <= hi))[0]
        if not len(idx): return None, 0
        i = idx[np.argmax(F[idx])]
        if 0 < i < len(F) - 1:
            a, b, c = np.log(F[i - 1] + 1e-12), np.log(F[i] + 1e-12), np.log(F[i + 1] + 1e-12)
            p = 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
        else: p = 0
        return (i + p) * SR / nfft, F[i]
    f1, a1 = peak_near(S.mtof(m_exp))
    f2, a2 = peak_near(S.mtof(m_exp + 12))
    fr = f1
    if f1 is None or (f2 is not None and a1 < a2 * 0.03): fr = f2 / 2 if f2 else S.mtof(m_exp)
    m = 69 + 12 * math.log2(fr / 440)
    if abs(m - m_exp) > 0.7: m = m_exp
    return m

def index(name):
    if name in _index: return _index[name]
    pat, off, lrx = SETS[name]
    out = []
    for p in sorted(glob.glob(os.path.join(VDIR, pat))):
        base = p.split('__')[-1]
        mm = re.findall(NOTE_RX, base)
        if not mm: continue
        m_exp = S.ntom(mm[0]) + off
        layer = LAYER_ORDER.get(re.search(lrx, base).group(1), 0) if lrx else 0
        x = _load(p)
        root = _refine_root(x, m_exp)
        out.append({'path': p, 'root': root, 'layer': layer, 'name': mm[0]})
    _index[name] = out
    return out

def _ratio_frac(r):
    fr = Fraction(r).limit_denominator(400)
    return fr.numerator, fr.denominator

_shift_cache = {}

def note(name, m, vel=0.6, dur=None, release=0.35, layer=None, max_len=None, bright=0.0):
    """Stereo (n,2) note. dur: seconds until note-off (None = natural decay)."""
    idx = index(name)
    layers = sorted(set(e['layer'] for e in idx))
    if layer is None:
        if len(layers) == 1: layer = layers[0]
        elif name == 'piano': layer = 0 if vel < 0.62 else 1
        elif name == 'glock': layer = 0 if vel < 0.45 else (1 if vel < 0.75 else 2)
        else: layer = layers[0] if vel < 0.6 else layers[-1]
    cands = [e for e in idx if e['layer'] == layer] or idx
    e = min(cands, key=lambda e: (abs(e['root'] - m), e['root'] < m))
    x = _load(e['path'])
    ratio = 2 ** ((m - e['root']) / 12)
    need = None
    if dur is not None: need = dur + release
    if max_len is not None: need = min(need, max_len) if need else max_len
    if need is not None:
        src_len = int((need + 0.05) * SR * ratio) + 64
        x = x[:src_len]
    key = (e['path'], round(m, 3), len(x))
    if key in _shift_cache: y = _shift_cache[key]
    else:
        p, q = _ratio_frac(ratio)
        y = signal.resample_poly(x, q, p, axis=0) if (p, q) != (1, 1) else x.copy()
        if len(_shift_cache) > 600: _shift_cache.clear()
        _shift_cache[key] = y
    y = y.copy()
    if need is not None:
        n_off = int((dur if dur is not None else need - release) * SR)
        n_end = min(len(y), int(need * SR))
        y = y[:n_end]
        if n_off < n_end:
            r = n_end - n_off
            env = np.ones(len(y)); env[n_off:] = np.cos(np.linspace(0, math.pi / 2, r)) ** 2
            y *= env[:, None]
    g = (max(vel, 0.02) / 0.7) ** 1.4
    if bright: y = au.shelf(y, 3000, bright * 6.0)
    return y * g

def mono_inst(fn):
    def f(m, vel=0.6, dur=None, **k):
        y = fn(m, vel)
        return np.stack([y, y], axis=1)
    return f

def sample_file(pattern):
    ps = sorted(glob.glob(os.path.join(VDIR, pattern)))
    return [_load(p) for p in ps]
