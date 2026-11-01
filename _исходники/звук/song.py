#!/usr/bin/env python3
# «Ниточка» — колыбельная Тихона, песня для титров. Всё для записи живого голоса — из одного источника:
# мелодия и аккорды (build_music.py: MEL_A, MEL_A2, MEL_B, CH_*), аранжировка (build_music2.credits()),
# текст с разбивкой на слоги (ниже; сверяется с src/config/credits.js и src/i18n/en.js).
#
#   python3 song.py check            — текст ложится на мелодию (слог на ноту) и совпадает с текстом в игре
#   python3 song.py midi             — docs/песня/ниточка.mid, little-thread.mid (голос с текстом + вся аранжировка)
#   python3 song.py xml              — docs/песня/ноты/*.musicxml (лид-шит: мелодия, аккорды, два куплета)
#   python3 song.py pdf              — docs/песня/ниточка-ноты.pdf (+ превью PNG); нужен pip-пакет verovio и chromium
#   SFX_SRC=… python3 song.py audio [сдвиг]  — минус (без мелодии) и мелодия отдельно; в ре мажоре (без сдвига) заодно
#                                     и сам трек игры mus_credits (= минус + мелодия). Сдвиг — в полутонах: 3 = фа мажор
#   python3 song.py all              — check + midi + xml + pdf (без рендера звука)
import sys, os, re, math, json, struct, subprocess, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'песня')
BPM, BPB, INTRO = 72, 3, 4
BAR_S = 60 / BPM * BPB

# ---------------------------------------------------------------- текст по слогам
# пробел — граница слов, «-» — граница слогов внутри слова, «=» — настоящий дефис (он же граница слогов: «Кто=то»),
# «_» — два слова на одной ноте («в_ком» поётся как «вком»)
LYRICS = {
    'ru': [[
        'Снег за о-кош-ком, в_ком-на-те свет.',
        'Кто=то в_у-глу не спит столь-ко лет.',
        'Сто-рож он ти-хий, сто-рож хо-ро-ший —',
        'ни-точ-ку тя-нет до са-мых пла-нет.',
        'Бьёт-ся в_о-кош-ко ба-боч-ка=жар.',
        'Та-ет от нит-ки ог-нен-ный шар.',
        'Ут-ром прос-нёшь-ся — ма-ма с_то-бо-ю.',
        'Снег за о-кош-ком, и в_ком-на-те — свет.',
    ], [
        'Ма-ма ус-ну-ла, плед на пле-чах.',
        'Крес-тик и но-лик в_тёп-лых ру-ках.',
        'Ло-доч-ки, бук-вы, точ-ки и клет-ки —',
        'ут-ро ша-га-ет на мяг-ких но-гах.',
        'Ес-ли од-наж-ды ста-нет тем-но,',
        'вспом-ни: в_у-глу не спит он дав-но.',
        'Спи, мой хо-ро-ший, спи, мой лю-би-мый.',
        'Снег за о-кош-ком и сказ-ка в_гла-зах.',
    ]],
    'en': [[
        'Snow at the win-dow, light in the room.',
        'Some-one’s kept watch for years in the gloom.',
        'Qui-et old watch-man, kind lit-tle keep-er —',
        'spin-ning a thread all the way to the moon.',
        'Em-ber, the moth, is beat-ing the pane.',
        'Thread af-ter thread, the fi-re will wane.',
        'Morn-ing will come, and Ma-ma is near you.',
        'Snow at the win-dow, and light in the room.',
    ], [
        'Ma-ma’s a-sleep, her blan-ket pulled tight.',
        'Cross-es and noughts in warm hands to-night.',
        'Lit-tle boats, let-ters, dots and the box-es —',
        'morn-ing comes soft-ly on paws made of light.',
        'If it gets dark, and shad-ows grow deep,',
        'think of the cor-ner, nev-er a-sleep.',
        'Sleep now, my dar-ling, sleep now, my dear-est.',
        'Snow at the win-dow, and dreams in your sight.',
    ]],
}
TITLE = {'ru': '«Ниточка»', 'en': '“Little Thread”'}
SUBTITLE = {'ru': 'колыбельная Тихона', 'en': 'Tikhon’s lullaby'}
FROM = {'ru': 'песня для титров игры «Под одеялом: пять дней жара»', 'en': 'credits song from “Under the Blanket: Five Days of Fever”'}
SUB = {'ru': 'колыбельная Тихона · песня для титров игры «Под одеялом: пять дней жара»',
       'en': 'Tikhon’s lullaby · credits song from “Under the Blanket: Five Days of Fever”'}

def syllables(line):
    """'Снег за о-кош-ком, в_ком-на-те свет.' -> [(text, syllabic)], syllabic: single/begin/middle/end"""
    out = []
    for w in line.split():
        if w in ('—', '–'):                      # тире — к предыдущему слогу
            t, s = out[-1]; out[-1] = (t + ' —', s); continue
        parts = re.split('[-=]', w)
        for i, p in enumerate(parts):
            p = p.replace('_', '\u00a0')
            syl = 'single' if len(parts) == 1 else 'begin' if i == 0 else 'end' if i == len(parts) - 1 else 'middle'
            out.append((p, syl))
    return out

def plain(line):
    return line.replace('-', '').replace('=', '-').replace('_', ' ')

def game_lines():
    """Строки песни из игры: RU — src/config/credits.js, EN — перевод в src/i18n/en.js."""
    js = open(os.path.join(ROOT, 'src', 'config', 'credits.js'), encoding='utf-8').read()
    en = open(os.path.join(ROOT, 'src', 'i18n', 'en.js'), encoding='utf-8').read()
    verses = []
    for name in ('SONG_VERSE_1', 'SONG_VERSE_2'):
        body = re.search(name + r' = \[(.*?)\];', js, re.S).group(1)
        lines = [l for l in re.findall(r"'([^']*)'", body) if l]
        verses.append(lines)
    def tr(ru):
        m = re.search(re.escape("'" + ru + "'") + r":\s*'([^']*)'", en)
        if not m: raise SystemExit('нет перевода: ' + ru)
        return m.group(1)
    return {'ru': verses, 'en': [[tr(l) for l in v] for v in verses]}

# ---------------------------------------------------------------- мелодия
def theme():
    from build_music import full_theme
    mel, ch = full_theme()                      # 32 такта (A A2 B A2), доли от 0
    return mel, ch

def line_notes(mel, line):
    """ноты строки line (0…7): такты 4·line … 4·line+3"""
    lo, hi = line * 4 * BPB, (line + 1) * 4 * BPB
    return [e for e in mel if lo - 1e-6 <= e[0] < hi - 1e-6]

STRESS_RU = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ'

def check():
    mel, _ = theme()
    game = game_lines()
    ok = True
    for lang in ('ru', 'en'):
        for v, verse in enumerate(LYRICS[lang]):
            for l, line in enumerate(verse):
                syl = syllables(line); notes = line_notes(mel, l)
                want = game[lang][v][l]
                if plain(line) != want:
                    print(f'  ✗ {lang} {v + 1}.{l + 1}: текст в игре «{want}», здесь «{plain(line)}»'); ok = False
                if len(syl) != len(notes):
                    print(f'  ✗ {lang} {v + 1}.{l + 1}: {len(syl)} слогов на {len(notes)} нот: {line}'); ok = False
    print('текст ложится на мелодию: слог на ноту, строки совпадают с игрой' if ok else 'есть расхождения')
    return ok

# ---------------------------------------------------------------- аккорды
NAMES_D = {2: ('D', 0), 4: ('E', 0), 6: ('F', 1), 7: ('G', 0), 9: ('A', 0), 11: ('B', 0), 1: ('C', 1), 0: ('C', 0), 5: ('F', 0), 10: ('B', -1), 3: ('E', -1), 8: ('G', 1)}
NAMES_F = {5: ('F', 0), 7: ('G', 0), 9: ('A', 0), 10: ('B', -1), 0: ('C', 0), 2: ('D', 0), 4: ('E', 0), 1: ('D', -1), 3: ('E', -1), 6: ('G', -1), 8: ('A', -1), 11: ('B', 0)}
KEYS = {0: ('ре мажор', 'D major', 2, NAMES_D), 3: ('фа мажор', 'F major', -1, NAMES_F)}

def spell(pc, names):
    s, a = names[pc % 12]
    return s + ('#' if a > 0 else 'b' if a < 0 else '')

def chord_name(ch, shift=0, names=NAMES_D):
    q = ch['sym'].split('/')[0]
    q = re.sub(r'^[A-G][#b]?', '', q)
    root = spell(ch['root'] + shift, names)
    bass = '/' + spell(ch['bass'] + shift, names) if ch['bass'] != ch['root'] else ''
    return root + q + bass

# ---------------------------------------------------------------- MIDI (формат 1, без библиотек)
def vlq(n):
    b = [n & 0x7F]; n >>= 7
    while n: b.append((n & 0x7F) | 0x80); n >>= 7
    return bytes(reversed(b))

def meta(t, data): return b'\xff' + bytes([t]) + vlq(len(data)) + data

class Track:
    def __init__(self, name): self.ev = []; self.add(0, meta(0x03, name.encode('utf-8')), -1)
    def add(self, tick, data, order=0): self.ev.append((int(round(tick)), order, len(self.ev), data))
    def bytes(self):
        out = b''; last = 0
        for tick, _, _, data in sorted(self.ev):
            out += vlq(tick - last) + data; last = tick
        out += vlq(0) + b'\xff\x2f\x00'
        return b'MTrk' + struct.pack('>I', len(out)) + out

PPQ = 480
def write_midi(path, tracks):
    data = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), PPQ) + b''.join(t.bytes() for t in tracks)
    open(path, 'wb').write(data)

def notes_track(name, ch, program, events, vol=100, pan=64, lyrics=None):
    """events: [(beat, dur, midi, vel 0..1)]; lyrics: {индекс события: текст}"""
    t = Track(name)
    t.add(0, bytes([0xC0 | ch, program]))
    t.add(0, bytes([0xB0 | ch, 7, vol])); t.add(0, bytes([0xB0 | ch, 10, pan]))
    evs = sorted(enumerate(events), key=lambda x: (x[1][0], x[1][2]))
    # одна высота не перекрывается сама с собой: предыдущая нота кончается там, где начинается следующая
    last_on = {}
    ends = {}
    for i, (b, d, m, v) in evs:
        on = b * PPQ; off = (b + max(d, 0.06)) * PPQ
        if m in last_on:
            j, pon = last_on[m]
            if ends[j] > on: ends[j] = on
        last_on[m] = (i, on); ends[i] = off
    for i, (b, d, m, v) in evs:
        on = b * PPQ
        vel = max(1, min(127, int(round(18 + v * 110))))
        if lyrics and i in lyrics: t.add(on, meta(0x05, lyrics[i].encode('utf-8')), 1)
        t.add(on, bytes([0x90 | ch, m, vel]), 2)
        t.add(max(on + 10, ends[i]), bytes([0x80 | ch, m, 0]), 0)
    return t

GM = {  # часть аранжировки → (программа GM, громкость, панорама, понятное имя)
    'mbox_intro': (10, 90, 76, 'Music box (intro)'),
    'silk_mel': (46, 100, 68, 'Web harp - melody, verse 1'),
    'piano_lh': (0, 84, 52, 'Piano waltz, verse 1'),
    'str_mel': (48, 96, 64, 'Strings - melody, verse 2'),
    'celesta': (8, 74, 84, 'Celesta, verse 2'),
    'piano_lh2': (0, 80, 52, 'Piano waltz, verse 2'),
    'harp': (46, 74, 44, 'Harp arpeggios'),
    'bass': (32, 84, 56, 'Bass (piano, low)'),
    'pad': (89, 64, 64, 'Pad'),
    'final': (46, 90, 64, 'Final chord - harp'),
    'final_glock': (9, 80, 84, 'Final chord - glockenspiel'),
}

def vocal_events(lang, transpose=-12):
    """Партия голоса: два куплета после вступления, ноты на октаву ниже мелодии инструмента (A3–D5)."""
    mel, _ = theme()
    ev = []; lyr = {}
    for v in range(2):
        for l in range(8):
            notes = line_notes(mel, l); syl = syllables(LYRICS[lang][v][l])
            for k, (b, d, m, acc) in enumerate(notes):
                beat = b + (INTRO + 32 * v) * BPB
                text, s = syl[k]
                if k == 0 and l == 0: text = f'{v + 1}. {text}'
                # текст в MIDI — UTF-8; типографский апостроф заменяем обычным, чтобы его поняли любые редакторы
                lyr[len(ev)] = text.replace('\u00a0', ' ').replace('’', "'") + ('-' if s in ('begin', 'middle') else ' ')
                ev.append((beat, d * 0.96, m + transpose, 0.62 * acc))
    return ev, lyr

def midi():
    from build_music2 import credits
    parts, bpm, beats, _ = credits()
    _, ch = theme()
    for lang, fname in (('ru', 'ниточка.mid'), ('en', 'little-thread.mid')):
        conductor = Track('Nitochka (Little Thread)' if lang == 'ru' else 'Little Thread')
        conductor.add(0, meta(0x51, struct.pack('>I', round(60e6 / bpm))[1:]))
        conductor.add(0, meta(0x58, bytes([3, 2, 24, 8])))
        conductor.add(0, meta(0x59, bytes([2, 0])))          # ре мажор
        marks = [(0, 'Intro'), (INTRO * BPB, 'Verse 1'), ((INTRO + 32) * BPB, 'Verse 2'), ((INTRO + 64) * BPB, 'Final chord')]
        for b, s in marks: conductor.add(b * PPQ, meta(0x06, s.encode()))
        # символы аккордов — текстом, в такт
        for rep in range(2):
            for b, d, c in ch:
                conductor.add((b + (INTRO + 32 * rep) * BPB) * PPQ, meta(0x01, chord_name(c).encode()))
        for b, s in ((0, 'D'), (BPB, 'G'), (2 * BPB, 'D/F#'), (3 * BPB, 'A'), ((INTRO + 64) * BPB, 'D')):
            conductor.add(b * PPQ, meta(0x01, s.encode()))
        ev, lyr = vocal_events(lang)
        tracks = [conductor, notes_track('Vocal (' + lang.upper() + ' lyrics)', 0, 53, ev, vol=110, lyrics=lyr)]
        chn = 1
        for p in parts:
            if p.name == 'tri':
                t = Track('Triangle'); t.add(0, bytes([0xB9, 7, 70]))
                for b, d, m, v in p.events:
                    t.add(b * PPQ, bytes([0x99, 81, 60]), 2); t.add((b + 2) * PPQ, bytes([0x89, 81, 0]), 0)
                tracks.append(t); continue
            prog, vol, pan, name = GM[p.name]
            tracks.append(notes_track(name, chn, prog, p.events, vol=vol, pan=pan))
            chn += 1
            if chn == 9: chn = 10
        write_midi(os.path.join(OUT, fname), tracks)
        print('  →', os.path.relpath(os.path.join(OUT, fname), ROOT), f'({len(tracks)} дорожек)')

# ---------------------------------------------------------------- MusicXML (лид-шит)
DIV = 2  # долей на четверть: восьмая = 1
TYPES = {1: ('eighth', 0), 2: ('quarter', 0), 3: ('quarter', 1), 4: ('half', 0), 6: ('half', 1)}

def kind_xml(ch):
    q = re.sub(r'^[A-G][#b]?', '', ch['sym'].split('/')[0])
    return {'': ('major', ''), 'm': ('minor', 'm'), '7': ('dominant', '7'), 'm7': ('minor-seventh', 'm7')}[q]

def harmony_xml(ch, shift, names, offset=0):
    rs, ra = names[(ch['root'] + shift) % 12]
    kind, text = kind_xml(ch)
    x = f'<harmony print-frame="no"><root><root-step>{rs}</root-step>' + (f'<root-alter>{ra}</root-alter>' if ra else '') + '</root>'
    x += f'<kind text="{text}">{kind}</kind>'
    if ch['bass'] != ch['root']:
        bs, ba = names[(ch['bass'] + shift) % 12]
        x += f'<bass><bass-step>{bs}</bass-step>' + (f'<bass-alter>{ba}</bass-alter>' if ba else '') + '</bass>'
    if offset: x += f'<offset>{offset}</offset>'
    return x + '</harmony>'

def pitch_xml(m, names):
    s, a = names[m % 12]
    octv = (m - a) // 12 - 1
    return f'<pitch><step>{s}</step>' + (f'<alter>{a}</alter>' if a else '') + f'<octave>{octv}</octave></pitch>'

def musicxml(lang, shift=0, male=False):
    from score import parse_chord
    mel, ch = theme()
    key_ru, key_en, fifths, names = KEYS[shift]
    # голос звучит на октаву ниже мелодии инструмента (A3–D5); баритон — ещё на октаву ниже (ключ соль с восьмёркой внизу;
    # в MusicXML высоты — звучащие, ключ сам опускает их на нотоносце)
    tr = shift - 12 - (12 if male else 0)
    intro = [(0, 3, parse_chord('D')), (3, 3, parse_chord('G')), (6, 3, parse_chord('D/F#')), (9, 3, parse_chord('A'))]
    lyr = [[syllables(l) for l in LYRICS[lang][v]] for v in range(2)]
    title = TITLE[lang]
    keyname = key_ru if lang == 'ru' else key_en
    voice = ('для Тихона (баритон), звучит октавой ниже' if male else 'голос: женский или детский; мужской — октавой ниже') if lang == 'ru' else \
            ('for Tikhon (baritone), sounds an octave lower' if male else 'female or child voice; male voice an octave lower')
    tempo_txt = 'Нежно, не спеша' if lang == 'ru' else 'Gently, unhurried'
    X = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
         '<score-partwise version="4.0">',
         f'<work><work-title>{html.escape(title)}</work-title></work>',
         f'<movement-title>{html.escape(SUBTITLE[lang])}</movement-title>',
         '<identification>',
         f'<creator type="composer">{html.escape(keyname + " · " + voice)}</creator>',
         f'<creator type="lyricist">{html.escape(FROM[lang])}</creator>',
         '<encoding><software>song.py (Под одеялом)</software></encoding></identification>',
         '<defaults><lyric-font font-family="Times New Roman" font-size="10.5"/><word-font font-family="Times New Roman" font-size="10"/></defaults>',
         '<part-list><score-part id="P1"><part-name print-object="no">' + ('Голос' if lang == 'ru' else 'Voice') + '</part-name></score-part></part-list>',
         '<part id="P1">']
    n = 0
    def measure(num, body, attrs='', left='', right='', new_system=False):
        X.append(f'<measure number="{num}">' + ('<print new-system="yes"/>' if new_system else '') + left + attrs + body + right + '</measure>')
    # вступление: 4 такта паузы одной «многотактовой» паузой — в одной строке с первой строкой текста
    intro_txt = ('Вступление: 4 такта шкатулки (D – G – D/F♯ – A)' if lang == 'ru' else 'Intro: 4 bars of music box (D – G – D/F♯ – A)') if not shift else \
                ('Вступление: 4 такта шкатулки (F – B♭ – F/A – C)' if lang == 'ru' else 'Intro: 4 bars of music box (F – B♭ – F/A – C)')
    for i in range(INTRO):
        attrs = ''
        if i == 0:
            clef = '<clef><sign>G</sign><line>2</line>' + ('<clef-octave-change>-1</clef-octave-change>' if male else '') + '</clef>'
            attrs = (f'<attributes><divisions>{DIV}</divisions><key><fifths>{fifths}</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time>{clef}'
                     f'<measure-style><multiple-rest>{INTRO}</multiple-rest></measure-style></attributes>')
            attrs += f'<direction placement="above"><direction-type><words font-weight="bold">{html.escape(tempo_txt)}</words></direction-type></direction>'
            attrs += '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>72</per-minute></metronome></direction-type><sound tempo="72"/></direction>'
            attrs += '<direction placement="below"><direction-type><words font-style="italic">' + html.escape(intro_txt) + '</words></direction-type></direction>'
        body = f'<note><rest measure="yes"/><duration>{3 * DIV}</duration></note>'
        measure(i + 1, body, attrs, new_system=(i == 0))
    # куплет (32 такта, с повтором — второй куплет второй строкой текста)
    sections = {0: 'A', 8: 'A′', 16: 'B', 24: 'A′'}
    for bar in range(32):
        num = INTRO + bar + 1
        b0 = bar * BPB
        notes = [e for e in mel if b0 - 1e-6 <= e[0] < b0 + BPB - 1e-6]
        chords = [c for c in ch if b0 - 1e-6 <= c[0] < b0 + BPB - 1e-6]
        body = ''
        if bar in sections:
            body += f'<direction placement="above"><direction-type><rehearsal font-weight="bold">{sections[bar]}</rehearsal></direction-type></direction>'
        line, idx0 = bar // 4, None
        lnotes = line_notes(mel, line)
        for (b, d, m, acc) in notes:
            for c in [c for c in chords if c[0] <= b + 1e-6 and not c[3:]]:
                off = int(round((c[0] - b) * DIV))
                body += harmony_xml(c[2], shift, names, off)
                chords = [cc for cc in chords if cc is not c]
            dur = int(round(d * DIV)); typ, dot = TYPES[dur]
            k = lnotes.index((b, d, m, acc))
            body += '<note>' + pitch_xml(m + tr, names) + f'<duration>{dur}</duration><type>{typ}</type>' + ('<dot/>' * dot)
            for v in range(2):
                text, syl = lyr[v][line][k]
                if k == 0 and line == 0: text = f'{v + 1}. {text}'
                body += f'<lyric number="{v + 1}"><syllabic>{syl}</syllabic><text>{html.escape(text)}</text></lyric>'
            body += '</note>'
        # аккорд внутри последней ноты такта (такт 7: Em7 — A7)
        for c in chords:
            body = body.replace('<note>', harmony_xml(c[2], shift, names) + '<note>', 0)
        left = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>' if bar == 0 else ''
        right = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>' if bar == 31 else ''
        measure(num, body, '', left, right, new_system=(bar % 4 == 0 and bar > 0))
    # финальный аккорд
    fin = '<direction placement="above"><direction-type><words font-style="italic">' + html.escape('Финал: аккорд арфы и колокольчики' if lang == 'ru' else 'Ending: harp chord and bells') + '</words></direction-type></direction>'
    fin += harmony_xml(parse_chord('D'), shift, names) + f'<note><rest measure="yes"/><duration>{3 * DIV}</duration><notations><fermata type="upright"/></notations></note>'
    measure(INTRO + 33, fin, '', '', '<barline location="right"><bar-style>light-heavy</bar-style></barline>', new_system=True)
    X += ['</part>', '</score-partwise>']
    return '\n'.join(X)

def xml():
    d = os.path.join(OUT, 'ноты'); os.makedirs(d, exist_ok=True)
    made = []
    for lang in ('ru', 'en'):
        for shift, male in ((0, False), (3, True)):
            base = ('ниточка' if lang == 'ru' else 'little-thread') + ('-ре-мажор' if lang == 'ru' else '-D') * (shift == 0) + ('-фа-мажор-тихон' if lang == 'ru' else '-F-tikhon') * (shift == 3)
            p = os.path.join(d, base + '.musicxml')
            open(p, 'w', encoding='utf-8').write(musicxml(lang, shift, male))
            made.append(p)
    for p in made: print('  →', os.path.relpath(p, ROOT))
    return made

# ---------------------------------------------------------------- PDF через Verovio + Chromium
FONTS = os.path.join(ROOT, 'node_modules', '@fontsource')

def font_css():
    css = ''
    for fam, d in (('Literata', 'literata'), ('Caveat', 'caveat')):
        for w in (400, 700):
            for st in ('normal', 'italic'):
                for sub in ('cyrillic', 'latin'):
                    f = os.path.join(FONTS, d, 'files', f'{d}-{sub}-{w}-{st}.woff2')
                    if os.path.exists(f):
                        css += f"@font-face {{ font-family: '{fam}'; font-weight: {w}; font-style: {st}; src: url('file://{f}') format('woff2'); }}\n"
    return css

def svg_fit(svg, box_w, box_h):
    """вписать SVG Verovio (viewBox без размеров) в рамку box_w × box_h (мм), сохранив пропорции"""
    m = re.search(r'<svg viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    w, h = float(m.group(1)), float(m.group(2))
    k = min(box_w / w, box_h / h)
    return svg.replace('<svg viewBox=', f'<svg width="{w * k:.1f}mm" height="{h * k:.1f}mm" viewBox=', 1)

def chord_chart(lang):
    """текст с аккордами над слогами — для гитары/фортепиано; аккорд висит над началом слога и не разрывает слово"""
    mel, ch = theme()
    starts = {round(c[0], 3): chord_name(c[2]) for c in ch}
    out = []
    for v in range(2):
        out.append(f'<h3>{"Куплет" if lang == "ru" else "Verse"} {v + 1}</h3>')
        for l in range(8):
            if l in (4, 6): out.append('<div class="gap"></div>')
            notes = line_notes(mel, l)
            chords = [starts.get(round(b, 3), '') for (b, d, m, acc) in notes]
            words, k = [], 0
            for w in LYRICS[lang][v][l].split():
                if w in ('—', '–'): words[-1] += ' —'; continue
                toks = re.split('([-=])', w); syl = ''
                for i in range(0, len(toks), 2):
                    t = toks[i].replace('_', ' ') + ('-' if i + 1 < len(toks) and toks[i + 1] == '=' else '')
                    c = chords[k]; nxt = chords[k + 1] if k + 1 < len(chords) else ''
                    # если следом тоже аккорд, а этот шире слога — раздвинуть ровно настолько, чтобы аккорды не слиплись
                    cw = len(c) * 0.66 * 8.6 + 3; sw = len(t) * 0.56 * 10.8
                    style = f' style="min-width:{cw:.0f}pt"' if (c and nxt and cw > sw) else ''
                    syl += (f'<span class="s"{style}><b>{html.escape(c)}</b>' if c else '<span class="s">') + html.escape(t) + '</span>'
                    k += 1
                words.append(syl)
            out.append('<div class="ln">' + ' '.join(f'<span class="w">{w}</span>' for w in words) + '</div>')
    return '\n'.join(out)

# четвертная нота для «♩ = 72» (в текстовых шрифтах этого знака нет)
QUARTER = ('<svg style="height:1.05em;vertical-align:-0.18em" viewBox="0 0 10 20"><ellipse cx="4.2" cy="16.2" rx="4" ry="2.7" '
           'transform="rotate(-22 4.2 16.2)" fill="currentColor"/><rect x="7.2" y="1" width="1.2" height="15" fill="currentColor"/></svg>')

def pdf():
    import verovio
    files = xml()
    css = font_css() + """
@page { size: A4; margin: 0 }
html, body { margin: 0; background: #fff; color: #231a14 }
section { width: 210mm; height: 297mm; box-sizing: border-box; padding: 13mm 14mm 10mm; page-break-after: always; overflow: hidden; position: relative; font-family: 'Literata', serif }
header { text-align: center; border-bottom: 0.4mm solid #c9b9a3; padding-bottom: 3mm; margin-bottom: 4mm }
h1 { font-size: 26pt; margin: 0; color: #8c2f25; font-weight: 700 }
.sub { font-style: italic; font-size: 12pt; margin-top: 1mm }
.meta { display: flex; justify-content: space-between; font-size: 8.6pt; margin-top: 3mm; color: #5a4a3c; text-align: left }
.meta span:last-child { text-align: right }
.music { display: flex; justify-content: center }
.intro { font-size: 9pt; font-style: italic; text-align: center; color: #5a4a3c; margin: -1mm 0 2mm }
footer { position: absolute; left: 14mm; right: 14mm; bottom: 8mm; font-size: 7.6pt; color: #7a6a5c; border-top: 0.3mm solid #e0d4c2; padding-top: 2mm; display: flex; justify-content: space-between }
.cols { display: flex; gap: 10mm } .cols > div { flex: 1 }
h2 { font-size: 15pt; color: #8c2f25; margin: 0 0 1mm } h3 { font-size: 10.5pt; margin: 4mm 0 1.5mm; color: #5a4a3c }
.ln { font-size: 10.8pt; line-height: 1; margin: 0 0 1.6mm; padding-top: 5.2mm; white-space: nowrap }
.w { white-space: nowrap } .s { position: relative; white-space: pre; display: inline-block }
.s b { position: absolute; left: 0; bottom: 1.32em; font-size: 8.6pt; color: #8c2f25; font-weight: 700; font-family: 'Literata', serif; white-space: nowrap }
.gap { height: 2.2mm }
.note { font-size: 8.4pt; color: #5a4a3c; margin-top: 5mm; line-height: 1.45 }
"""
    sections = []
    for p in files:
        name = os.path.basename(p)
        lang = 'ru' if name.startswith('ниточка') else 'en'
        shift = 3 if ('фа' in name or '-F-' in name) else 0
        male = shift == 3
        key_ru, key_en, _, _ = KEYS[shift]
        tk = verovio.toolkit()
        tk.setOptions({'pageWidth': 2100, 'pageHeight': 6000, 'pageMarginTop': 10, 'pageMarginBottom': 10, 'pageMarginLeft': 20, 'pageMarginRight': 20,
                       'scale': 40, 'breaks': 'encoded', 'header': 'none', 'footer': 'none', 'lyricSize': 4.0, 'spacingSystem': 8,
                       'adjustPageHeight': True, 'svgViewBox': True, 'harmDist': 2.0, 'spacingLinear': 0.3, 'spacingNonLinear': 0.55})
        tk.loadData(open(p, encoding='utf-8').read())
        if tk.getPageCount() != 1: print('  ! страниц Verovio:', tk.getPageCount(), name)
        svg = svg_fit(tk.renderToSVG(1), 182, 222)
        if lang == 'ru':
            voice = 'для Тихона: баритон (ключ соль с «8» — звучит октавой ниже)' if male else 'голос: женский или детский; мужской — октавой ниже'
            minus = f'ниточка-минус-{"фа" if male else "ре"}.mp3'
            meta = (f'<span>Слова и музыка — для игры<br>«Под одеялом: пять дней жара»</span>'
                    f'<span>{key_ru} · {QUARTER} = 72 · 3/4<br>{voice}</span>')
            foot = (f'<span>Минус: {minus} · вступление 10 с · строка = 4 такта = 10 с · второй куплет с 1:30</span><span>docs/песня</span>')
        else:
            voice = 'for Tikhon: baritone (treble-8 clef, sounds an octave lower)' if male else 'female or child voice; male voice an octave lower'
            minus = f'ниточка-минус-{"фа" if male else "ре"}.mp3'
            meta = (f'<span>Words and music written for the game<br>“Under the Blanket: Five Days of Fever”</span>'
                    f'<span>{key_en} · {QUARTER} = 72 · 3/4<br>{voice}</span>')
            foot = (f'<span>Backing track: {minus} · intro 10 s · one line = 4 bars = 10 s · verse 2 at 1:30</span><span>docs/песня</span>')
        chords = 'F – B♭ – F/A – C' if shift else 'D – G – D/F♯ – A'
        intro = (f'Нежно, не спеша. Вступление — 4 такта шкатулки ({chords}); голос вступает на 10-й секунде.' if lang == 'ru' else
                 f'Gently, unhurried. Intro: 4 bars of music box ({chords}); the voice comes in at 0:10.')
        sections.append(f'<section><header><h1>{html.escape(TITLE[lang])}</h1><div class="sub">{html.escape(SUBTITLE[lang])}</div>'
                        f'<div class="meta">{meta}</div></header><div class="intro">{html.escape(intro)}</div><div class="music">{svg}</div><footer>{foot}</footer></section>')
    # текст с аккордами (ре мажор)
    note_ru = ('Аккорды — ре мажор (для фа мажора: D→F, G→B♭, A→C, Bm→Dm, Em→Gm, F♯m→Am). Аккорд стоит над слогом, на котором он берётся; '
               'в 7-м такте A-части два аккорда (Em7 — A7). Каждая строка — 4 такта по 3 доли. Последний слог строки тянется весь такт.')
    note_en = ('Chords in D major (for F major: D→F, G→B♭, A→C, Bm→Dm, Em→Gm, F♯m→Am). Each chord sits over the syllable where it changes; '
               'bar 7 of the A part has two chords (Em7 — A7). Every line is 4 bars of 3 beats; the last syllable is held for the whole bar.')
    sections.append('<section><header><h1>«Ниточка» · “Little Thread”</h1><div class="sub">текст с аккордами · lyrics with chords</div></header>'
                    f'<div class="cols"><div><h2>«Ниточка»</h2>{chord_chart("ru")}<div class="note">{note_ru}</div></div>'
                    f'<div><h2>“Little Thread”</h2>{chord_chart("en")}<div class="note">{note_en}</div></div></div>'
                    '<footer><span>Текст сверяется с игрой: python3 _исходники/звук/song.py check</span><span>docs/песня</span></footer></section>')
    doc = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{"".join(sections)}</body></html>'
    tmp = os.path.join(OUT, 'ноты', '_print.html')
    open(tmp, 'w', encoding='utf-8').write(doc)
    out = os.path.join(OUT, 'ниточка-ноты.pdf')
    subprocess.run(['chromium', '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={out}', 'file://' + tmp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(tmp)
    # превью первой страницы (для README)
    png = os.path.join(OUT, 'ниточка-ноты-превью.png')
    subprocess.run(['pdftoppm', '-r', '80', '-png', '-f', '1', '-l', '1', '-singlefile', out, png[:-4]], check=True)
    print('  →', os.path.relpath(out, ROOT), f'({len(sections)} стр.)')

# ---------------------------------------------------------------- звук: минус и мелодия отдельно (один проход рендера)
MELODY = {'silk_mel', 'str_mel'}

def audio(shift=0):
    import au
    from score import _pan_st
    from build_music2 import credits
    SR = au.SR
    parts, bpm, beats, ir = credits()
    if shift:
        for p in parts: p.events = [(b, d, m + shift, v) for (b, d, m, v) in p.events]
    # один проход рендера (как score.render(…, tail=6, loop=False, seed=1)), части раскладываются по группам:
    # минус + мелодия = полный трек; в ре мажоре полный трек пишется в игру (assets/audio/music/mus_credits)
    rng = np.random.default_rng(1)
    spb = 60.0 / bpm
    L = int(round(beats * spb * SR)); N = L + int(6.0 * SR)
    groups = {'minus': [np.zeros((N, 2)), np.zeros((N, 2))], 'melody': [np.zeros((N, 2)), np.zeros((N, 2))]}
    for p in parts:
        buf = np.zeros((N, 2))
        for beat, d, m, v in p.events:
            t = max(0.0, beat * spb + (rng.normal(0, p.human) if p.human else 0))
            vv = v * (1 + rng.normal(0, 0.04))
            y = _pan_st(np.asarray(p.inst(m, max(0.02, min(1.0, vv)), d * spb), dtype=np.float64), p.pan, p.width)
            i = int(t * SR); k = min(len(y), N - i)
            if k > 0: buf[i:i + k] += y[:k]
        lv = au.lufs(buf)
        g = au.undb(p.level - lv) if lv > -69 else 0.0
        mix, send = groups['melody' if p.name in MELODY else 'minus']
        mix += buf * g; send += buf * g * p.send
    outs = {}
    for name, (mix, send) in groups.items():
        outs[name] = mix + au.reverb(send, ir, wet=1.0, dry=0.0)[:N]
    full = outs['minus'] + outs['melody']
    gain = au.undb(-21 - au.lufs(full))
    key = {0: 'ре', 3: 'фа', 2: 'ми', 5: 'соль', -2: 'до', -5: 'ля'}.get(shift, f'{shift:+d}')
    if not shift:
        y = au.fade(full * gain, 0.0, 3.0)
        if au.peak(y) > au.undb(-1.5): y = au.soft_limit(y, au.undb(-1.5))
        base = os.path.join(ROOT, 'assets', 'audio', 'music', 'mus_credits')
        au.encode(y, base, mp3=True, ogg=True, kbps=128, ogg_q=4)
        print(f'  → {os.path.relpath(base, ROOT)}.ogg/.mp3  {len(y) / SR:.1f} с, I={au.lufs(y):.1f} LUFS (игра)')
    for name, y in outs.items():
        if name == 'melody' and shift: continue
        y = au.fade(y * gain, 0.0, 3.0)
        pk = au.peak(y)
        if pk > au.undb(-1.0): y = au.soft_limit(y, au.undb(-1.0))
        base = os.path.join(OUT, f'ниточка-{"минус" if name == "minus" else "мелодия"}-{key}')
        au.encode(y, base, mp3=True, ogg=False, kbps=160 if name == 'minus' else 128)
        if os.environ.get('SONG_WAV'): au.save_wav(base + '.wav', y)
        print(f'  → {os.path.relpath(base, ROOT)}.mp3  {len(y) / SR:.1f} с, I={au.lufs(y):.1f} LUFS, пик {au.db(au.peak(y)):.1f} dBFS')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd == 'check': sys.exit(0 if check() else 1)
    elif cmd == 'midi': midi()
    elif cmd == 'xml': xml()
    elif cmd == 'pdf': pdf()
    elif cmd == 'audio': audio(int(sys.argv[2]) if len(sys.argv) > 2 else 0)
    elif cmd == 'all':
        if not check(): sys.exit(1)
        midi(); pdf()
    else: raise SystemExit(__doc__)
