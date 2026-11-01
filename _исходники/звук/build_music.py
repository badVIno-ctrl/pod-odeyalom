#!/usr/bin/env python3
# Оригинальная музыка «Пять дней жара»: колыбельная тема (ре мажор, 3/4) и её варианты,
# тема паука Тихона (си минор), музыка мини-игр, стингеры. Инструменты: CC0-сэмплы VCSL
# (пианино Knight, арфа, глокеншпиль, вибрафон, маримба, шейкер, вудблок, треугольник, колокольчики)
# + синтез (музыкальная шкатулка, челеста, пэд, пиццикато).
import sys, os, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import au, synth as S, sampler as SM
from score import *

SR = au.SR
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAW = os.environ.get('SFX_SRC', os.path.join(HERE, 'сырьё'))
OUT_M = os.path.join(ROOT, 'assets', 'audio', 'music')
OUT_S = os.path.join(ROOT, 'assets', 'audio', 'sfx')
REV = os.path.join(HERE, 'review')
IR_HALL = au.make_ir(t60=2.2, predelay=0.025, damp=5200, seed=12, size=1.4)
IR_ROOMY = au.make_ir(t60=1.3, predelay=0.015, damp=5000, seed=13, size=1.0)

# ---------------- instruments: f(midi, vel, dur_sec) -> stereo
def st(y): return np.stack([y, y], axis=1)
def I_piano(m, v, d): return SM.note('piano', m, v, dur=max(d, 0.3), release=0.5)
def I_piano_stac(m, v, d): return SM.note('piano', m, v, dur=min(d, 0.22), release=0.12)
def I_harp(m, v, d): return SM.note('harp', m, v, dur=max(d, 1.4), release=0.9)
def I_harp_stac(m, v, d): return SM.note('harp', m, v, dur=0.16, release=0.1)
def I_glock(m, v, d): return SM.note('glock', m, v, None, max_len=2.8, release=0.6)
def I_vibes(m, v, d): return SM.note('vibes', m, v, dur=max(d, 0.6) + 0.25, release=0.7)
def I_marimba(m, v, d): return SM.note('marimba', m, v, None, max_len=1.8, release=0.4)
def I_mbox(m, v, d): return st(S.music_box(m, v))
def I_cel(m, v, d): return st(S.celesta(m, v))
def I_pizz(m, v, d): return st(S.pizz(m, v))
def I_sbass(m, v, d): return st(S.soft_bass(m, v, hold=max(0.2, d * 0.9)))
def I_pad(cut=1200, att=1.0, rel=1.6):
    return lambda m, v, d: S.pad_voice(m, d, v, cutoff=cut, attack=att, release=rel)

_perc = {}
def perc_set(key, pattern):
    if key not in _perc: _perc[key] = SM.sample_file(pattern)
    return _perc[key]
def I_shaker(m, v, d):
    xs = perc_set('sh_down', '*Shaker_Small__Mid_ShakerHighFaster_Down_*.wav') if m % 2 == 0 else perc_set('sh_up', '*Shaker_Small__Mid_ShakerHighFaster_Up_*.wav')
    x = xs[np.random.randint(len(xs))]
    return x * (v / 0.7) ** 1.3
def I_wood(m, v, d):
    xs = perc_set('wood', '*Woodblock__wood_click_pp_rr*.wav')
    return au.fade(xs[np.random.randint(len(xs))][: int(0.35 * SR)], 0, 0.1) * (v / 0.7) ** 1.3
def I_tri(m, v, d):
    x = perc_set('tri', '*Triangles__Legacy__1__triangle1_hit_mp.wav')[0]
    return au.fade(x[: int(4 * SR)], 0, 1.5) * (v / 0.7)
def I_chimes(m, v, d):
    x = perc_set('chimes', '*Mark_Trees__Legacy__windchimes_slowAsc1.wav')[0]
    return au.fade(x, 0, 1.0) * (v / 0.7)

# ---------------- material
MEL_A = "A4 D5 F#5 | G5:2 F#5 | E5 F#5 A5 | E5:3 | D5 F#5 B5 | A5:2 G5 | F#5 E5 C#5 | D5:3"
MEL_A2 = "A4 D5 F#5 | G5:2 F#5 | E5 F#5 A5 | B5:2 A5 | D6 C#6 B5 | A5 G5 E5 | G5 F#5 E5 | D5:3"
MEL_B = "F#5:1.5 G5:.5 F#5 | E5:2 C#5 | D5 E5 G5 | F#5:3 | G5:1.5 A5:.5 G5 | F#5:2 D5 | E5 G5 B5 | A5:3"
CH_A = "D | G | D/F# | A | Bm | G | Em7:2 A7:1 | D"
CH_A2 = "D | G | D/F# | A | Bm | G | A7 | D"
CH_B = "Bm | F#m7 | G | D | Em | Bm/D | G | A"

def full_theme():
    return parse_melody(' | '.join([MEL_A, MEL_A2, MEL_B, MEL_A2]), 3), parse_chords(' | '.join([CH_A, CH_A2, CH_B, CH_A2]), 3)

MEL_G = """F#5:.5 A5:.5 r:.5 A5:.5 B5:.5 A5:.5 F#5:1 | G5:.5 B5:.5 r:.5 B5:.5 D6:.5 B5:.5 G5:1 | A5:.5 F#5:.5 D5:.5 F#5:.5 A5:1 D6:1 | C#6:1.5 B5:.5 A5:2 |
F#5:.5 A5:.5 r:.5 A5:.5 B5:.5 A5:.5 F#5:1 | G5:.5 B5:.5 r:.5 D6:.5 E6:.5 D6:.5 B5:1 | G5:.5 B5:.5 E6:1 C#6:.5 E6:.5 A5:1 | D6:2 r:2 |
B5:.5 F#5:.5 D5:.5 F#5:.5 B5:1 A5:1 | G5:.5 D5:.5 B4:.5 D5:.5 G5:1 F#5:1 | F#5:.5 E5:.5 D5:.5 E5:.5 F#5:1 A5:1 | E5:1.5 F#5:.5 E5:2 |
D5:.5 F#5:.5 B5:.5 D6:.5 C#6:1 B5:1 | B5:.5 G5:.5 D6:.5 B5:.5 A5:1 G5:1 | A5:.5 B5:.5 C#6:.5 E6:.5 G5:1 C#6:1 | D6:1 A5:.5 F#5:.5 D5:2"""
CH_G = "D | G | D | A | D | G | Em:2 A:2 | D | Bm | G | D | A | Bm | G | A7 | D"

MEL_T = """B4:.5 r:.5 D5:.5 r:.5 F#5:.5 E5:.5 D5:1 | C#5:.5 r:.5 E5:.5 r:.5 A#4:1 r:1 | B4:.5 r:.5 D5:.5 r:.5 F#5:.5 G5:.5 A5:1 | G5:1 F#5:.5 E5:.5 F#5:2 |
B5:.5 r:.5 A5:.5 G5:.5 F#5:1 E5:1 | F#5:.5 r:.5 E5:.5 D5:.5 C#5:1 D5:1 | E5:.5 G5:.5 B5:.5 G5:.5 E5:1 C#5:1 | A#4:1 C#5:1 F#5:2 |
B4:.5 r:.5 D5:.5 r:.5 F#5:.5 E5:.5 D5:1 | C#5:.5 r:.5 E5:.5 r:.5 A#4:1 r:1 | B4:.5 r:.5 D5:.5 r:.5 F#5:.5 G5:.5 A5:1 | G5:1 F#5:.5 E5:.5 F#5:2 |
D6:1 B5:.5 G5:.5 E5:1 G5:1 | F#5:1.5 E5:.5 D5:1 E5:1 | C#5:.5 D5:.5 E5:.5 F#5:.5 A#5:1 C#6:1 | B5:2 r:2"""
CH_T = "Bm | F#7 | Bm | Em:2 F#:2 | G | D/F# | Em | F#7 | Bm | F#7 | Bm | Em:2 F#:2 | G | Em | F#7 | Bm"

MEL_X = """r:2 F#5:1 G5:1 | F#5:2 D5:2 | r:2 D5:1 E5:1 | D5:2 B4:2 | r:2 E5:1 G5:1 | B5:2 A5:1 G5:1 | A#4:2 C#5:2 | F#5:3 r:1 |
r:2 F#5:1 G5:1 | A5:2 F#5:2 | r:1 B5:1 A5:1 G5:1 | G5:2 E5:2 | r:1 E5:1 G5:1 C6:1 | A#5:2 C#6:2 | B5:3 r:1 | r:2 A#4:1 C#5:1"""
CH_X = "Bm | Bm | G | G | Em | Em | F# | F# | Bm | Bm | G | Em | C | F# | Bm | F#7"

def first_beats(mel, bpb, bars, dur=None):
    out = []
    for b, d, m, a in mel:
        if abs(b % bpb) < 1e-6 and in_bars(b, bpb, bars): out.append((b, dur or d, m, a))
    return out

def sel(ev, bars, bpb):
    return [e for e in ev if in_bars(e[0], bpb, bars)]

def cat(*evs):
    out = []
    for e in evs: out += e
    return out

# ---------------- tracks
def mus_menu():
    mel, ch = full_theme(); bpb = 3
    parts = [
        Part('mbox', I_mbox, cat(from_melody(mel, (1, 8), 3, 12, 0.62), from_melody(mel, (25, 32), 3, 12, 0.42)), level=-23, pan=0.15, send=0.3),
        Part('piano_mel', I_piano, cat(from_melody(mel, (9, 16), 3, 0, 0.5, 1.15), from_melody(mel, (25, 32), 3, 0, 0.48, 1.15)), level=-23, pan=-0.05, send=0.25),
        Part('vibes_mel', I_vibes, from_melody(mel, (17, 24), 3, 0, 0.5), level=-23.5, pan=0.1, send=0.3),
        Part('piano_lh', I_piano, cat(waltz(ch, 3, (1, 8), vb=0.42, vc=0.24), waltz(ch, 3, (17, 24), vb=0.42, vc=0.24)), level=-28, pan=-0.15, send=0.22, roll=0.01),
        Part('harp', I_harp, cat(arp(ch, 3, [0, 1, 2, 3, 2, 1], 0.5, (9, 16), vel=0.34), arp(ch, 3, [0, 1, 2, 3, 2, 1], 0.5, (25, 32), vel=0.32)), level=-29, pan=-0.25, send=0.3),
        Part('bass', I_piano, cat(bassline(ch, 3, ((0, 0, 1.0),), (9, 16), 38, 50, 0.4, dur=2.8), bassline(ch, 3, ((0, 0, 1.0),), (25, 32), 38, 50, 0.4, dur=2.8)), level=-31, pan=-0.1, send=0.2),
        Part('pad', I_pad(1000, 1.6, 2.2), pads(ch, 3, (5, 32), 50, 64, 3, 0.4), level=-33, send=0.4, width=1.0),
    ]
    return parts, 72, 32 * bpb, IR_HALL

def mus_morning():
    mel = parse_melody(MEL_A + ' | ' + MEL_A2, 3); ch = parse_chords(CH_A + ' | ' + CH_A2, 3)
    parts = [
        Part('piano_mel', I_piano, from_melody(mel, None, 3, 0, 0.5, 1.1), level=-22.5, pan=0.05, send=0.22),
        Part('piano_arp', I_piano, arp(ch, 3, [0, 2, 1, 3, 2, 1], 0.5, None, vel=0.3, hold=1.6), level=-28, pan=-0.12, send=0.22),
        Part('pad', I_pad(900, 2.0, 2.5), pads(ch, 3, (9, 16), 50, 64, 3, 0.35), level=-36, send=0.4),
        Part('glock', I_glock, [(0, 1, S.ntom('A6'), 0.25), (8 * 3, 1, S.ntom('F#6'), 0.22)], level=-34, pan=0.3, send=0.5),
    ]
    return parts, 66, 16 * 3, IR_HALL

def mus_night():
    melA = parse_melody(MEL_A, 3); melA2 = parse_melody(MEL_A2, 3, bar0=8)
    ch = parse_chords(CH_A + ' | ' + CH_A2, 3)
    frag = [(b, 3, m, a) for (b, d, m, a) in melA2 if abs(b % 3) < 1e-6 and int(b // 3) % 2 == 0]
    parts = [
        Part('mbox', I_mbox, from_melody(melA, None, 3, 12, 0.5), level=-24, pan=0.1, send=0.4),
        Part('vibes', I_vibes, from_melody(frag, None, 3, 0, 0.4), level=-26, pan=-0.1, send=0.45),
        Part('pad', I_pad(800, 2.5, 3.0), pads(ch, 3, None, 50, 62, 3, 0.35), level=-30, send=0.45),
        Part('bass', I_piano, bassline(ch, 3, ((0, 0, 1.0),), None, 38, 50, 0.3, dur=3.0), level=-31, pan=-0.1, send=0.3),
    ]
    return parts, 56, 16 * 3, IR_HALL

def mus_dawn():
    mel, ch = full_theme()
    tri = [(24 * 3, 1, 80, 0.4)]
    chimes = [(23 * 3 + 1, 1, 80, 0.5)]
    glk = cat([(b, d, m + 12, a * 0.8) for (b, d, m, a) in first_beats(mel, 3, (17, 24))], from_melody(mel, (29, 32), 3, 12, 0.3))
    parts = [
        Part('piano_mel', I_piano, from_melody(mel, None, 3, 0, 0.6, 1.1), level=-22, pan=0.0, send=0.22),
        Part('celesta', I_cel, cat(from_melody(mel, (9, 16), 3, 12, 0.4), from_melody(mel, (25, 32), 3, 12, 0.4)), level=-28, pan=0.25, send=0.3),
        Part('harp', I_harp, arp(ch, 3, [0, 1, 2, 3, 2, 1], 0.5, None, vel=0.36), level=-27, pan=-0.25, send=0.3),
        Part('pad', I_pad(1500, 1.2, 1.8), pads(ch, 3, None, 52, 67, 4, 0.42), level=-30, send=0.35),
        Part('bass', I_piano, bassline(ch, 3, ((0, 0, 1.0),), None, 38, 50, 0.45, dur=2.8), level=-29, pan=-0.1, send=0.2),
        Part('glock', I_glock, glk, level=-31, pan=0.35, send=0.4),
        Part('tri', I_tri, tri, level=-36, pan=0.4, send=0.4),
        Part('chimes', I_chimes, chimes, level=-34, pan=-0.3, send=0.3),
    ]
    return parts, 80, 32 * 3, IR_HALL

def mus_hospital():
    mel = parse_melody(MEL_B + ' | ' + MEL_A2, 3); ch = parse_chords(CH_B + ' | ' + CH_A2, 3)
    parts = [
        Part('piano_mel', I_piano, from_melody(mel, None, 3, 0, 0.46, 1.15), level=-22.5, send=0.25),
        Part('piano_lh', I_piano, waltz(ch, 3, None, vb=0.36, vc=0.2), level=-28.5, pan=-0.12, send=0.25),
        Part('pad', I_pad(850, 2.2, 2.8), pads(ch, 3, None, 50, 62, 3, 0.35), level=-32, send=0.45),
    ]
    return parts, 60, 16 * 3, IR_HALL

def mus_tikhon():
    mel = parse_melody(MEL_T, 4); ch = parse_chords(CH_T, 4)
    stabs = []
    prev = None
    for beat, d, c in ch:
        v = voicing(c, 57, 69, 3, prev); prev = v
        for k in range(int(round(d))):
            for i, m in enumerate(v): stabs.append((beat + k + 0.5 + 0.006 * i, 0.2, m, 0.3 if k % 2 == 0 else 0.26))
    parts = [
        Part('celesta', I_cel, from_melody(mel, None, 4, 0, 0.6), level=-23, pan=0.1, send=0.25, human=0.004),
        Part('marimba', I_marimba, from_melody(mel, (9, 16), 4, 0, 0.42), level=-28, pan=-0.2, send=0.2, human=0.004),
        Part('pizz', I_pizz, bassline(ch, 4, ((0, 0, 1.0), (1, 7, 0.8), (2, 12, 0.9), (3, 7, 0.75)), None, 35, 47, 0.6), level=-25, pan=-0.05, send=0.12, human=0.003),
        Part('stabs', I_harp_stac, stabs, level=-29, pan=0.2, send=0.18, human=0.003),
        Part('wood', I_wood, [(b * 4 + k, 0.2, 0, 0.35) for b in range(16) for k in (1, 3)], level=-33, pan=0.3, send=0.15, human=0.002),
        Part('pad', I_pad(650, 1.5, 2.0), pads(ch, 4, None, 47, 62, 3, 0.3), level=-34, send=0.35),
    ]
    return parts, 96, 16 * 4, IR_ROOMY

def mus_game():
    mel = parse_melody(MEL_G, 4); ch = parse_chords(CH_G, 4)
    sh = [(b * 4 + k * 0.5, 0.25, k % 2, 0.32 if k % 2 else 0.24) for b in range(16) for k in range(8)]
    wood = [(b * 4 + 3, 0.2, 0, 0.35) for b in range(16) if b % 2 == 1]
    parts = [
        Part('marimba', I_marimba, from_melody(mel, None, 4, 0, 0.6), level=-22.5, pan=0.05, send=0.18, human=0.004),
        Part('celesta', I_cel, cat(from_melody(mel, (5, 8), 4, 12, 0.3), from_melody(mel, (13, 16), 4, 12, 0.3)), level=-29, pan=0.3, send=0.25),
        Part('harp', I_harp, arp(ch, 4, [0, 2, 1, 2, 3, 2, 1, 2], 0.5, None, vel=0.3, hold=0.9), level=-28, pan=-0.25, send=0.22, human=0.004),
        Part('pizz', I_pizz, bassline(ch, 4, ((0, 0, 1.0), (2, 7, 0.85), (3.5, 12, 0.55)), None, 38, 50, 0.6), level=-25.5, pan=-0.05, send=0.1, human=0.003),
        Part('shaker', I_shaker, sh, level=-35, pan=0.25, send=0.1, human=0.003),
        Part('wood', I_wood, wood, level=-34, pan=-0.3, send=0.15),
        Part('pad', I_pad(1200, 0.8, 1.2), pads(ch, 4, (9, 16), 52, 66, 3, 0.3), level=-34, send=0.3),
    ]
    return parts, 104, 16 * 4, IR_ROOMY

def mus_game_tense():
    mel = parse_melody(MEL_X, 4); ch = parse_chords(CH_X, 4)
    ost = arp(ch, 4, [0, 1, 2, 1], 0.5, None, blo=35, bhi=47, vel=0.3, span=3, hold=0.55, accent=0.15)
    boom = []
    for b in (0, 4, 8, 12):
        c = ch[b][2]; bn = bass_note(c, 23, 35)
        boom += [(b * 4, 3.5, bn, 0.42), (b * 4, 3.5, bn + 12, 0.36)]
    parts = [
        Part('vibes', I_vibes, from_melody(mel, None, 4, 0, 0.48), level=-24, pan=0.15, send=0.35),
        Part('ostinato', I_piano, ost, level=-26, pan=-0.15, send=0.2, human=0.004),
        Part('pad', I_pad(750, 2.0, 2.5), pads(ch, 4, None, 47, 62, 3, 0.35), level=-30, send=0.4),
        Part('boom', I_piano, boom, level=-30, pan=-0.05, send=0.3),
        Part('tick', I_wood, [(k, 0.1, 0, 0.22) for k in range(64)], level=-37, pan=0.35, send=0.1, human=0.001),
    ]
    return parts, 84, 16 * 4, IR_HALL

def musicbox_loop():
    mel = parse_melody(MEL_A + ' | ' + MEL_A2, 3); ch = parse_chords(CH_A + ' | ' + CH_A2, 3)
    bass = bassline(ch, 3, ((0, 0, 1.0),), None, 62, 73, 0.42, dur=1.0)
    harm = []
    for beat, d, c in ch:
        v = voicing(c, 69, 78, 2)
        harm += [(beat + 1, 1, v[0], 0.25), (beat + 2, 1, v[1], 0.22)]
    parts = [
        Part('mel', I_mbox, from_melody(mel, None, 3, 12, 0.6), level=-23, send=0.25),
        Part('bass', I_mbox, bass, level=-28, pan=-0.1, send=0.25),
        Part('harm', I_mbox, harm, level=-31, pan=0.1, send=0.25),
    ]
    return parts, 72, 16 * 3, IR_ROOMY

# ---------------- stingers (no loop)
def ev_at(times_notes, bpm=60):
    return [(t * bpm / 60.0, d, m, v) for (t, d, m, v) in times_notes]

def st_win():
    gl = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6']
    harp = [(i * 0.045, 1.5, S.ntom(n), 0.3 + 0.03 * i) for i, n in enumerate(gl)]
    chord = [(0.5 + 0.012 * i, 2.6, S.ntom(n), 0.55) for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4'])]
    glk = [(0.5, 1, S.ntom('D6'), 0.5), (0.62, 1, S.ntom('F#6'), 0.5), (0.74, 1, S.ntom('A6'), 0.55), (0.9, 1, S.ntom('D7'), 0.45)]
    parts = [Part('harp', I_harp, ev_at(harp), level=-24, pan=-0.2, send=0.3, human=0),
             Part('piano', I_piano, ev_at(chord), level=-22, send=0.3, human=0),
             Part('glock', I_glock, ev_at(glk), level=-25, pan=0.25, send=0.35, human=0),
             Part('pad', I_pad(1400, 0.4, 1.8), ev_at([(0.45, 2.2, S.ntom(n), 0.4) for n in ('D4', 'F#4', 'A4')]), level=-30, send=0.4, human=0)]
    return parts, 60, 4.5, IR_HALL

def st_lose():
    mb = [(0.0, 1, S.ntom('A5'), 0.5), (0.36, 1, S.ntom('F#5'), 0.46), (0.72, 1, S.ntom('D5'), 0.42), (1.12, 1, S.ntom('B4'), 0.4)]
    chord = [(1.12 + 0.015 * i, 2.6, S.ntom(n), 0.32) for i, n in enumerate(['B2', 'F#3', 'B3', 'D4'])]
    parts = [Part('cel', I_cel, ev_at(mb), level=-23, pan=0.1, send=0.35, human=0),
             Part('piano', I_piano, ev_at(chord), level=-25, send=0.3, human=0),
             Part('pad', I_pad(800, 0.8, 2.0), ev_at([(1.0, 2.0, S.ntom(n), 0.4) for n in ('B3', 'D4', 'F#4')]), level=-31, send=0.4, human=0)]
    return parts, 60, 5.0, IR_HALL

def st_day():
    mb = [(0.0, 1, S.ntom('A5'), 0.55), (0.3, 1, S.ntom('B5'), 0.5), (0.6, 1, S.ntom('D6'), 0.55), (0.95, 1, S.ntom('A5'), 0.45)]
    parts = [Part('mbox', I_mbox, ev_at(mb), level=-23, send=0.35, human=0),
             Part('tri', I_tri, [(0.0, 1, 80, 0.3)], level=-33, pan=0.3, send=0.3, human=0),
             Part('pad', I_pad(1000, 0.6, 1.8), ev_at([(0.0, 1.8, S.ntom(n), 0.35) for n in ('D4', 'A4')]), level=-33, send=0.4, human=0)]
    return parts, 60, 3.6, IR_HALL

TRACKS = {
    'mus_menu': (mus_menu, -22, True, OUT_M), 'mus_morning': (mus_morning, -23, True, OUT_M), 'mus_night': (mus_night, -24, True, OUT_M),
    'mus_dawn': (mus_dawn, -21, True, OUT_M), 'mus_hospital': (mus_hospital, -23, True, OUT_M), 'mus_tikhon': (mus_tikhon, -22, True, OUT_M),
    'mus_game': (mus_game, -22, True, OUT_M), 'mus_game_tense': (mus_game_tense, -23, True, OUT_M),
    'musicbox': (musicbox_loop, -23, True, OUT_S),
    'win': (st_win, -19, False, OUT_S), 'lose': (st_lose, -20, False, OUT_S), 'daycard': (st_day, -21, False, OUT_S),
}

def build(key):
    fn, target, loop, out = TRACKS[key]
    parts, bpm, beats, ir = fn()
    print(f'== {key}: {bpm} bpm, {beats} beats = {beats * 60 / bpm:.1f}s')
    y = render(parts, bpm, beats, ir, tail=5.0 if loop else 0.5, loop=loop, master_lufs=target, seed=hash(key) % 1000)
    if not loop:
        # stingers: natural tail, then trim
        L = int((beats * 60 / bpm) * SR)
        y = au.fade(y[:L + int(0.5 * SR)], 0.0, 0.8)
    au.encode(y, os.path.join(out, key), mp3=True, ogg=loop, kbps=128, ogg_q=4)
    au.spectro_png(y, os.path.join(REV, key + '.png'), title=f'{key} {len(y)/SR:.1f}s I={au.lufs(y):.1f} pk={au.db(au.peak(y)):.1f}')
    au.save_wav(os.path.join(REV, key + '.wav'), y)
    print(f'   -> {len(y)/SR:.2f}s I={au.lufs(y):.1f} pk={au.db(au.peak(y)):.1f}')

if __name__ == '__main__':
    os.makedirs(OUT_M, exist_ok=True)
    for k in (sys.argv[1:] or list(TRACKS)): build(k)
