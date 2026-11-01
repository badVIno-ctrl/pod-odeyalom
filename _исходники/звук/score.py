# Tiny score engine: melody/chord parsing, voicing, accompaniment generators, rendering with per-part balance.
import re, math
import numpy as np
import au
import synth as S

SR = au.SR
PCN = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
        'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14], 'dim': [0, 3, 6], '6': [0, 4, 7, 9],
        'm6': [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], 'm7b5': [0, 3, 6, 10], 'aug': [0, 4, 8], '7sus4': [0, 5, 7, 10]}

def pc(name):
    n = PCN[name[0]]
    for ch in name[1:]: n += 1 if ch == '#' else -1 if ch == 'b' else 0
    return n % 12

def parse_chord(sym):
    m = re.match(r'^([A-G][#b]?)(maj7|m7b5|7sus4|m7|m6|m|dim|aug|sus2|sus4|add9|7|6|9)?(?:/([A-G][#b]?))?$', sym)
    if not m: raise ValueError('chord ' + sym)
    root = pc(m.group(1)); q = m.group(2) or ''
    ints = QUAL[q]
    pcs = [(root + i) % 12 for i in ints]
    bass = pc(m.group(3)) if m.group(3) else root
    return {'root': root, 'pcs': pcs, 'bass': bass, 'ints': ints, 'sym': sym}

def parse_melody(s, bpb, bar0=0):
    """'A4 D5:2 r:.5 D5+F#5:1 | ...' -> [(beat, dur, midi, vel_mult)]"""
    ev = []
    bars = [b for b in s.replace('\n', ' ').split('|')]
    for bi, bar in enumerate(bars):
        t = 0.0
        for tok in bar.split():
            acc = 1.0
            if tok.startswith('>'): acc = 1.15; tok = tok[1:]
            if ':' in tok: n, d = tok.split(':'); d = float(d)
            else: n, d = tok, 1.0
            if n != 'r':
                for nn in n.split('+'):
                    ev.append(((bar0 + bi) * bpb + t, d, S.ntom(nn), acc))
            t += d
        if abs(t - bpb) > 1e-6: raise ValueError(f'bar {bar0 + bi + 1} has {t} beats: {bar}')
    return ev

def parse_chords(s, bpb, bar0=0):
    out = []
    for bi, bar in enumerate(s.replace('\n', ' ').split('|')):
        toks = bar.split(); t = 0.0
        for tok in toks:
            if ':' in tok: sym, d = tok.split(':'); d = float(d)
            else: sym, d = tok, bpb / len(toks)
            out.append(((bar0 + bi) * bpb + t, d, parse_chord(sym)))
            t += d
        if abs(t - bpb) > 1e-6: raise ValueError(f'chord bar {bar0 + bi + 1}: {bar}')
    return out

def notes_in(pcs, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]

def voicing(ch, lo, hi, n=3, prev=None, center=None):
    pcs = list(dict.fromkeys(ch['pcs']))
    if n == 3 and len(pcs) >= 4: pcs = [pcs[0], pcs[1], pcs[3]]  # root, 3rd, 7th
    cands = []
    for start in notes_in(pcs, lo, hi):
        v = [start]; used = {start % 12}; m = start + 1
        while len(v) < n and m <= hi + 9:
            if m % 12 in pcs and m % 12 not in used:
                v.append(m); used.add(m % 12)
                if len(used) == len(pcs): used = set()
            m += 1
        if len(v) == n and v[-1] <= hi + 4: cands.append(v)
    if not cands: cands = [notes_in(pcs, lo, hi + 12)[:n]]
    if prev:
        return min(cands, key=lambda v: sum(abs(a - b) for a, b in zip(sorted(v), sorted(prev))) + 0.3 * abs(np.mean(v) - (lo + hi) / 2))
    c = center if center is not None else (lo + hi) / 2
    return min(cands, key=lambda v: abs(np.mean(v) - c))

def bass_note(ch, lo=36, hi=50):
    return notes_in([ch['bass']], lo, hi)[0]

# ---------------- accompaniment generators -> list of (beat, dur, midi, vel)
def in_bars(beat, bpb, bars):
    if bars is None: return True
    b = int(beat // bpb) + 1
    return bars[0] <= b <= bars[1]

def waltz(chords, bpb=3, bars=None, lo=54, hi=66, blo=38, bhi=50, vb=0.5, vc=0.32, pedal=True):
    ev = []; prev = None
    for beat, dur, ch in chords:
        if not in_bars(beat, bpb, bars): continue
        b = bass_note(ch, blo, bhi)
        ev.append((beat, dur if pedal else 1.0, b, vb))
        v = voicing(ch, lo, hi, 3, prev); prev = v
        for k in range(1, int(round(dur))):
            for i, m in enumerate(v): ev.append((beat + k + 0.012 * i, 0.9, m, vc * (0.92 if k == 2 else 1)))
    return ev

def arp(chords, bpb, pattern, step=0.5, bars=None, blo=38, bhi=50, vel=0.35, span=4, hold=1.5, accent=0.12):
    ev = []
    for beat, dur, ch in chords:
        if not in_bars(beat, bpb, bars): continue
        b = bass_note(ch, blo, bhi)
        tones = [b]; m = b + 5
        while len(tones) < span:
            if m % 12 in ch['pcs']: tones.append(m)
            m += 1
        n = int(round(dur / step))
        for i in range(n):
            idx = pattern[i % len(pattern)]
            v = vel * (1 + (accent if i == 0 else 0)) * (0.94 + 0.06 * ((i + 1) % 2))
            ev.append((beat + i * step, hold, tones[idx % len(tones)], v))
    return ev

def pads(chords, bpb, bars=None, lo=50, hi=66, n=3, vel=0.4):
    ev = []; prev = None
    for beat, dur, ch in chords:
        if not in_bars(beat, bpb, bars): continue
        v = voicing(ch, lo, hi, n, prev); prev = v
        for m in v: ev.append((beat, dur, m, vel))
    return ev

def bassline(chords, bpb, pattern=((0, 0, 1.0),), bars=None, lo=35, hi=50, vel=0.5, dur=None):
    """pattern: (beat offset, interval above bass, vel mult)"""
    ev = []
    for beat, d, ch in chords:
        if not in_bars(beat, bpb, bars): continue
        b = bass_note(ch, lo, hi)
        for off, iv, vm in pattern:
            if off < d - 1e-6: ev.append((beat + off, dur or min(1.0, d - off), b + iv, vel * vm))
    return ev

def from_melody(mel, bars=None, bpb=3, transpose=0, vel=0.55, legato=1.0, phrase=4):
    ev = []
    for beat, d, m, acc in mel:
        if not in_bars(beat, bpb, bars): continue
        bar = beat / bpb
        arc = 1 + 0.08 * math.sin(math.pi * ((bar % phrase) / phrase))
        down = 1.05 if abs(beat % bpb) < 1e-6 else 1.0
        ev.append((beat, d * legato, m + transpose, vel * acc * arc * down))
    return ev

# ---------------- rendering
class Part:
    def __init__(self, name, inst, events, level=-20.0, pan=0.0, send=0.2, human=0.006, roll=0.0, width=1.0):
        self.name, self.inst, self.events = name, inst, events
        self.level, self.pan, self.send, self.human, self.roll, self.width = level, pan, send, human, roll, width

def _pan_st(y, p, width=1.0):
    if y.ndim == 1: y = np.stack([y, y], axis=1)
    if width != 1.0:
        mid = (y[:, 0] + y[:, 1]) / 2; side = (y[:, 0] - y[:, 1]) / 2 * width
        y = np.stack([mid + side, mid - side], axis=1)
    a = (p + 1) * math.pi / 4
    return y * np.array([math.cos(a), math.sin(a)]) * math.sqrt(2)

def render(parts, bpm, total_beats, ir, tail=5.0, loop=True, seed=1, master_lufs=-22.0, ceiling=-1.5, verbose=True, eq=None):
    rng = np.random.default_rng(seed)
    spb = 60.0 / bpm
    L = int(round(total_beats * spb * SR))
    N = L + int(tail * SR)
    mix = np.zeros((N, 2)); send = np.zeros((N, 2))
    for p in parts:
        buf = np.zeros((N, 2))
        for beat, d, m, v in p.events:
            t = beat * spb + (rng.normal(0, p.human) if p.human else 0)
            t = max(0.0, t)
            vv = v * (1 + rng.normal(0, 0.04))
            y = p.inst(m, max(0.02, min(1.0, vv)), d * spb)
            y = _pan_st(np.asarray(y, dtype=np.float64), p.pan, p.width)
            i = int(t * SR); k = min(len(y), N - i)
            if k > 0: buf[i:i + k] += y[:k]
        lv = au.lufs(buf[:L] if loop else buf)
        g = au.undb(p.level - lv) if lv > -69 else 0.0
        if verbose: print(f'   part {p.name:10s} raw {lv:6.1f} -> {p.level:6.1f}')
        buf *= g
        mix += buf; send += buf * p.send
    wet = au.reverb(send, ir, wet=1.0, dry=0.0)[:N]
    out = mix + wet
    if eq: out = eq(out)
    if loop:
        y = out[:L].copy()
        tl = out[L:]
        y[:len(tl)] += tl[:L]
    else:
        y = out
    if master_lufs is not None: y = au.norm_lufs(y, master_lufs, ceiling=ceiling)
    return y
