#!/usr/bin/env python3
# Музыка wow-пакета: ночные стемы (слои по нитям), «паутинная арфа» (колыбельная Тихона),
# песня для титров «Ниточка» (инструментальная аранжировка), радио бабы Вали за стенкой.
# Запуск: python3 build_music2.py [ключ ...]
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import au, synth as S, sampler as SM
from score import *
from build_music import (I_piano, I_harp, I_glock, I_vibes, I_mbox, I_cel, I_pizz, I_pad, I_tri, I_chimes,
                         MEL_A, MEL_A2, MEL_B, CH_A, CH_A2, CH_B, full_theme, cat, first_beats, IR_HALL, IR_ROOMY,
                         OUT_M, OUT_S, REV, ROOT)

SR = au.SR
DATA = os.path.join(ROOT, 'data')

def I_strings(att=0.5, rel=1.0, cut=2600):
    return lambda m, v, d: S.string_ens(m, d, v, attack=att, release=rel, cutoff=cut)
def I_silk(m, v, d): return np.stack([S.silk_harp(m, v)] * 2, axis=1)
def I_reed(m, v, d): return np.stack([S.reed(m, d, v)] * 2, axis=1)

# ---------------------------------------------------------------- stems
def render_stems(groups, bpm, beats, ir, target, ceiling=-1.5, seed=7):
    """groups: [(name, [Part...])]. Каждый стем рендерится отдельно (реверб линеен — сумма стемов = полный микс),
    затем ко всем применяется ОДИН общий коэффициент громкости — баланс слоёв сохраняется."""
    outs = []
    for i, (name, parts) in enumerate(groups):
        y = render(parts, bpm, beats, ir, tail=5.0, loop=True, seed=seed + i, master_lufs=None, verbose=False)
        outs.append((name, y))
    total = sum(y for _, y in outs)
    g = au.undb(target - au.lufs(total))
    pk = au.peak(total) * g
    if pk > au.undb(ceiling): g *= au.undb(ceiling) / pk
    return [(n, y * g) for n, y in outs], total * g

def night_stems():
    bpb = 3
    melA = parse_melody(MEL_A, bpb); melA2 = parse_melody(MEL_A2, bpb, bar0=8)
    mel = melA + melA2
    ch = parse_chords(CH_A + ' | ' + CH_A2, bpb)
    frag = [(b, 3, m, a) for (b, d, m, a) in melA2 if abs(b % 3) < 1e-6 and int(b // 3) % 2 == 0]
    # струнные: длинные ноты — терция/квинта аккорда, плавное голосоведение, + виолончель на корне раз в два такта
    line = []; prev = None
    for beat, d, c in ch:
        v = voicing(c, 57, 69, 2, prev); prev = v
        line.append((beat, d, v[-1], 0.42)); line.append((beat, d, v[0], 0.34))
    cello = [(beat, d * 2 - 0.2, bass_note(c, 38, 50), 0.4) for (beat, d, c) in ch if int(beat // 3) % 2 == 0]
    groups = [
        ('mus_night_base', [
            Part('pad', I_pad(800, 2.5, 3.0), pads(ch, bpb, None, 50, 62, 3, 0.35), level=-30, send=0.45),
            Part('bass', I_piano, bassline(ch, bpb, ((0, 0, 1.0),), None, 38, 50, 0.3, dur=3.0), level=-31, pan=-0.1, send=0.3),
            Part('vibes', I_vibes, from_melody(frag, None, bpb, 0, 0.36), level=-29, pan=-0.1, send=0.45),
        ]),
        ('mus_night_box', [Part('mbox', I_mbox, from_melody(mel, None, bpb, 12, 0.5), level=-24, pan=0.12, send=0.4)]),
        ('mus_night_cel', [Part('celesta', I_cel, arp(ch, bpb, [0, 2, 1, 3, 2, 1], 0.5, None, blo=50, bhi=62, vel=0.26, span=4, hold=0.9), level=-29.5, pan=-0.25, send=0.4)]),
        ('mus_night_str', [
            Part('strings', I_strings(0.9, 1.4, 2200), line, level=-27, pan=0.0, send=0.45, width=1.0),
            Part('cello', I_strings(0.6, 1.2, 1400), cello, level=-31, pan=-0.15, send=0.35),
        ]),
    ]
    return groups, 56, 16 * bpb, IR_HALL

STEMS = {'mus_night': (night_stems, -24)}

def build_stems(key):
    fn, target = STEMS[key]
    groups, bpm, beats, ir = fn()
    print(f'== stems {key}: {bpm} bpm, {beats} beats = {beats * 60 / bpm:.1f}s')
    stems, full = render_stems(groups, bpm, beats, ir, target)
    for name, y in stems:
        au.encode(y, os.path.join(OUT_M, name), mp3=True, ogg=True, kbps=112, ogg_q=3)
        print(f'   {name:16s} I={au.lufs(y):6.1f} pk={au.db(au.peak(y)):5.1f}')
    au.save_wav(os.path.join(REV, key + '_stems_full.wav'), full)
    print(f'   full I={au.lufs(full):.1f}')

# ---------------------------------------------------------------- паутинная арфа
# Нить 0 — мелодия, нить 1 — бас, нить 2 — подголоски. Время каждой ноты → data/webharp.json (щипки на экране).
WEB_A_TAIL = "D5 F#5 B5 | A5:2 G5 | F#5 E5 C#5 | D5:3"
WEB_CH_TAIL = "Bm | G | Em7:2 A7:1 | D"

def webharp(n):
    bpb = 3
    if n < 3:
        mel = parse_melody(WEB_A_TAIL, bpb); ch = parse_chords(WEB_CH_TAIL, bpb); bpm = 72; bars = 4
    else:
        mel = parse_melody(MEL_A, bpb); ch = parse_chords(CH_A, bpb); bpm = 76; bars = 8
    events = [(b, d, m + 12 if n < 3 else m + 12, 0.55 * a, 0) for (b, d, m, a) in mel]
    if n >= 2:
        for beat, d, c in ch:
            events.append((beat, d, bass_note(c, 50, 62), 0.42, 1))
    if n >= 3:
        prev = None
        for beat, d, c in ch:
            v = voicing(c, 66, 78, 2, prev); prev = v
            for k in (1, 2):
                if beat + k < bars * bpb: events.append((beat + k, 1, v[(k - 1) % 2], 0.24, 2))
    parts = []
    for th, pan, lvl in ((0, 0.12, -22), (1, -0.2, -27), (2, 0.3, -30)):
        ev = [(b, d, m, v) for (b, d, m, v, t) in events if t == th]
        if ev: parts.append(Part(f'thread{th}', I_silk, ev, level=lvl, pan=pan, send=0.45, human=0.004))
    if n >= 3:
        parts.append(Part('pad', I_strings(1.2, 2.0, 1800), [(0, bars * bpb, m, 0.3) for m in (62, 66, 69)], level=-34, send=0.5))
    spb = 60 / bpm
    timing = sorted([[round(b * spb, 3), t, int(m)] for (b, d, m, v, t) in events], key=lambda x: x[0])
    return parts, bpm, bars * bpb, IR_HALL, timing

# ---------------------------------------------------------------- титры: «Ниточка»
def credits():
    bpb = 3
    mel, ch = full_theme()                                   # 32 такта: A, A2, B, A2
    intro_ch = parse_chords("D | G | D/F# | A", bpb)          # 4 такта вступления (шкатулка одна)
    def shift(ev, bars): return [(b + bars * bpb,) + tuple(e[1:]) for (b, *rest) in ev for e in [(b, *rest)]]
    INTRO = 4
    m1 = shift(mel, INTRO); c1 = [(b + INTRO * bpb, d, c) for (b, d, c) in ch]
    m2 = shift(mel, INTRO + 32); c2 = [(b + (INTRO + 32) * bpb, d, c) for (b, d, c) in ch]
    allc = intro_ch + c1 + c2
    end = (INTRO + 64) * bpb
    final = [(end, 6, m, 0.4) for m in (50, 57, 62, 66, 69)]
    parts = [
        # вступление: шкатулка напевает начало темы
        Part('mbox_intro', I_mbox, from_melody(parse_melody(MEL_A.split('|', 4)[0] + '|' + '|'.join(MEL_A.split('|')[1:4]), bpb), None, bpb, 12, 0.45), level=-25, pan=0.15, send=0.35),
        # 1-й куплет: «голос» — паутинная арфа, под ней фортепиано-вальс и арфа
        Part('silk_mel', I_silk, from_melody(m1, None, bpb, 12, 0.55), level=-22, pan=0.05, send=0.4),
        Part('piano_lh', I_piano, waltz(c1, bpb, None, vb=0.36, vc=0.2), level=-28, pan=-0.15, send=0.25),
        # 2-й куплет: мелодию ведут струнные, подголосок — челеста, шкатулка в бридже
        Part('str_mel', I_strings(0.25, 0.8, 3000), from_melody(m2, None, bpb, 0, 0.5, 1.05), level=-23, pan=0.0, send=0.35),
        Part('celesta', I_cel, arp(c2, bpb, [0, 2, 1, 3, 2, 1], 0.5, None, blo=50, bhi=62, vel=0.24, span=4, hold=0.8), level=-30, pan=0.3, send=0.35),
        Part('piano_lh2', I_piano, waltz(c2, bpb, None, vb=0.34, vc=0.2), level=-29, pan=-0.15, send=0.25),
        Part('harp', I_harp, arp(c1 + c2, bpb, [0, 1, 2, 3, 2, 1], 0.5, (INTRO + 9, INTRO + 64), vel=0.3), level=-30, pan=-0.3, send=0.3),
        Part('bass', I_piano, bassline(allc, bpb, ((0, 0, 1.0),), None, 38, 50, 0.38, dur=2.8), level=-30, pan=-0.1, send=0.2),
        Part('pad', I_pad(1100, 1.6, 2.4), pads(allc, bpb, None, 50, 64, 3, 0.35), level=-33, send=0.4),
        Part('final', I_harp, final, level=-26, send=0.4),
        Part('final_glock', I_glock, [(end + 0.02, 2, 86, 0.35), (end + 0.5, 2, 90, 0.3), (end + 1.0, 2, 93, 0.28)], level=-31, pan=0.3, send=0.45),
        Part('tri', I_tri, [(end, 1, 80, 0.3)], level=-36, pan=0.4, send=0.4),
    ]
    return parts, 72, end + 6, IR_HALL

# ---------------------------------------------------------------- радио бабы Вали (за стенкой)
RADIO_MEL = "B4 D5 G5 | F#5:2 E5 | D5 B4 G4 | A4:3 | C5 E5 A5 | G5:2 F#5 | E5 C5 A4 | B4:3 | B4 D5 G5 | B5:2 A5 | G5 E5 C5 | B4:2 A4 | G4 B4 D5 | F#5 E5 C5 | A4 B4 F#4 | G4:3"
RADIO_CH = "G | D7 | G | D | Am | D7 | G | G | G | G7 | C | G | Em | Am | D7 | G"

def radio_music():
    bpb = 3
    mel = parse_melody(RADIO_MEL, bpb); ch = parse_chords(RADIO_CH, bpb)
    parts = [
        Part('accordion', I_reed, from_melody(mel, None, bpb, 0, 0.6, 0.95), level=-20, send=0.15),
        Part('acc_bass', I_reed, waltz(ch, bpb, None, lo=55, hi=67, blo=43, bhi=55, vb=0.45, vc=0.3), level=-25, send=0.1),
    ]
    y = render(parts, 132, 16 * bpb, IR_ROOMY, tail=1.5, loop=False, master_lufs=-20, verbose=False)
    return y

def murmur(dur, seed=3):
    """Голос диктора за стенкой: слоги — шум через форманты, интонация, паузы между фразами."""
    r = np.random.default_rng(seed)
    n = int(dur * SR); y = np.zeros(n)
    t = 0.15
    while t < dur - 0.4:
        words = r.integers(3, 7)
        f0 = 120 + r.uniform(-10, 15)
        for w in range(words):
            syl = r.integers(1, 4)
            for s in range(syl):
                L = r.uniform(0.09, 0.17); k = int(L * SR)
                tt = np.arange(k) / SR
                f = f0 * (1 + 0.08 * math.sin(t * 2.3)) * (1 - 0.1 * (w / words))
                ph = 2 * math.pi * np.cumsum(np.full(k, f)) / SR
                src = np.sign(np.sin(ph)) * 0.5 + r.standard_normal(k) * 0.15
                f1 = r.uniform(400, 800); f2 = r.uniform(1000, 2200)
                v = au.bp(src, f1 * 0.8, f1 * 1.25) + 0.6 * au.bp(src, f2 * 0.85, f2 * 1.2)
                env = np.sin(np.pi * tt / L) ** 1.5
                i = int(t * SR)
                if i + k < n: y[i:i + k] += v * env
                t += L
            t += r.uniform(0.04, 0.12)
        t += r.uniform(0.35, 0.7)
    return y

def pips():
    """Сигналы точного времени: пять коротких и один длинный, 1 кГц."""
    n = int(6.2 * SR); y = np.zeros(n)
    for i in range(6):
        L = 0.1 if i < 5 else 0.5
        k = int(L * SR); tt = np.arange(k) / SR
        tone = np.sin(2 * math.pi * 1000 * tt) * au.fade(np.ones(k), 0.004, 0.01)
        i0 = int(i * SR); y[i0:i0 + k] += tone * 0.5
    return y

def radio():
    mus = radio_music()
    mus = mus.mean(axis=1) if mus.ndim == 2 else mus
    talk = murmur(9.0)
    pp = pips()
    parts = [mus, np.zeros(int(0.6 * SR)), au.norm_lufs(talk, -27), np.zeros(int(0.4 * SR)), au.norm_lufs(pp, -24), np.zeros(int(1.2 * SR))]
    y = np.concatenate(parts)
    # старый приёмник: узкая полоса, лёгкий перегруз, шипение
    y = au.bp(y, 280, 3200)
    y = np.tanh(y * 2.2) / 2.2
    hiss = au.bp(S.noise(len(y), 'pink'), 800, 5000) * 0.012
    y = y + hiss
    # стена: всё, что выше ~600 Гц, гасится
    y = au.lp(au.lp(y, 650), 900)
    y = au.peq(y, 180, 3, 0.9)
    L = len(y)
    # бесшовная петля: короткий кроссфейд хвоста в начало
    xf = int(0.4 * SR)
    y[:xf] = y[:xf] * np.linspace(0, 1, xf) + y[L - xf:] * np.linspace(1, 0, xf)
    y = y[:L - xf]
    y = au.norm_lufs(y, -30, ceiling=-6)
    return np.stack([y, y], axis=1)

# ---------------------------------------------------------------- build
def build_one(key):
    if key in STEMS: return build_stems(key)
    if key.startswith('webharp_'):
        n = int(key.split('_')[1])
        parts, bpm, beats, ir, timing = webharp(n)
        y = render(parts, bpm, beats, ir, tail=4.0, loop=False, master_lufs=-21, verbose=False)
        L = int((beats * 60 / bpm + 3.5) * SR)
        y = au.fade(y[:L], 0.0, 1.5)
        au.encode(y, os.path.join(OUT_S, key), mp3=True, ogg=False, kbps=128)
        path = os.path.join(DATA, 'webharp.json')
        data = json.load(open(path)) if os.path.exists(path) else {}
        data[key] = {'dur': round(len(y) / SR, 2), 'notes': timing}
        json.dump(data, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
        print(f'== {key}: {len(y)/SR:.1f}s, {len(timing)} нот')
        return
    if key == 'mus_credits':
        # трек титров собирается вместе с минусом и мелодией для записи голоса (song.py → docs/песня)
        import song
        song.audio(0)
        return
    if key == 'radio':
        y = radio()
        au.encode(y, os.path.join(OUT_S, key), mp3=True, ogg=True, kbps=64, ogg_q=1)
        print(f'== radio: {len(y)/SR:.1f}s I={au.lufs(y):.1f}')
        return
    raise SystemExit('unknown ' + key)

KEYS = ['mus_night', 'webharp_1', 'webharp_2', 'webharp_3', 'mus_credits', 'radio']

if __name__ == '__main__':
    os.makedirs(REV, exist_ok=True)
    for k in (sys.argv[1:] or KEYS): build_one(k)
