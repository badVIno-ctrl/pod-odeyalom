# Сценарий для студийной записи живыми актёрами: docs/озвучка/СЦЕНАРИЙ ЗАПИСИ.md и сценарий-записи.xlsx.
# Источник — lines.py (тексты, ударения, пресеты) и directions.py (кастинг и подача каждой реплики).
# Запуск из корня проекта: python3 _исходники/голоса/studio_script.py
import os, re, sys, unicodedata
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from directions import CAST, PRESET, NOTE, NONVERBAL  # noqa: E402

OUT = os.path.join(ROOT, 'docs', 'озвучка')
VOICE = os.path.join(ROOT, 'assets', 'audio', 'voice')
os.makedirs(OUT, exist_ok=True)

# ---- реплики и сцены в порядке lines.py ----
SCENES = {
    'пролог': 'Пролог: улица, пурга, дом',
    'день 1': 'День 1: жар, мама уходит в аптеку, знакомство с Тихоном',
    'утро дней 2–5': 'Утро дней 2–5',
    'паук, дни 2–5': 'Тихон, дни 2–5: разговоры и правила игр',
    'события после партии': 'После партии: победа или поражение',
    'ночи': 'Ночи',
    '7А «Рассвет»': 'Финал «Рассвет»',
    '7Б «Скорая»': 'Финал «Скорая»',
    'реплики в мини-играх': 'Реплики во время игр (короткие)',
    'wow-пакет: ловля руками, колыбельная, реакции, радио': 'Ловля Огнёвки, колыбельная, реакции, радио',
    'тайная глава «Аня»: тридцать зим назад': 'Тайная глава «Аня»: тридцать зим назад',
    'вторая зима (новая игра+)': '«Вторая зима» (новая игра+)',
}
rows = []
scene = ''
src = open(os.path.join(HERE, 'lines.py'), encoding='utf-8').read()
env = {}
exec(compile(src, 'lines.py', 'exec'), env)
by_id = {l[0]: l for l in env['L']}
for line in src.splitlines():
    m = re.match(r'# -+ (.+?) -+\s*$', line)
    if m:
        scene = SCENES.get(m.group(1), m.group(1))
        continue
    m = re.match(r"a\('(\w+)'", line)
    if m and m.group(1) in by_id:
        id_, spk, preset, text, tts = by_id[m.group(1)]
        rows.append(dict(id=id_, spk=spk, preset=preset, text=text, tts=tts, scene=scene))

missing = [r['id'] for r in rows if r['id'] not in NOTE]
extra = [k for k in NOTE if k not in by_id]
if missing or extra:
    sys.exit(f'directions.py: нет подачи для {missing}; лишние {extra}')

# ---- ударения: «+» перед гласной → знак ударения над ней ----
def stress(t):
    t = re.sub(r'\+([аеёиоуыэюяАЕЁИОУЫЭЮЯ])', lambda m: m.group(1) + '\u0301', t)
    return unicodedata.normalize('NFC', t.replace('\u0435\u0301', 'е\u0301'))

def dur(id_):
    p = os.path.join(VOICE, id_ + '.mp3')
    try:
        from mutagen.mp3 import MP3
        return round(MP3(p).info.length, 1)
    except Exception:
        return None

for i, r in enumerate(rows):
    r['n'] = i + 1
    r['stress'] = stress(r['tts'])
    r['dur'] = dur(r['id'])
    r['how'] = NOTE[r['id']]
    r['base'] = PRESET.get(r['preset'], '')
    r['who'] = CAST[r['spk']]['name']
    # контекст: предыдущая реплика той же сцены (другого персонажа), чтобы актёр знал, на что отвечает
    prev = next((q for q in reversed(rows[:i]) if q['scene'] == r['scene'] and q['spk'] != r['spk']), None)
    r['ctx'] = f"{CAST[prev['spk']]['name']}: {prev['text']}" if prev and rows[i - 1]['scene'] == r['scene'] else ''

order = ['Паук', 'Мальчик', 'Мама', 'Аня', 'Мама Ани', 'Врач', 'Фельдшер']
per = OrderedDict((k, [r for r in rows if r['spk'] == k]) for k in order)
words = lambda rs: sum(len(re.findall(r'[\wё-]+', r['text'])) for r in rs)
secs = lambda rs: sum(r['dur'] or 0 for r in rs)
# студийное время: ~45 реплик в час для эмоциональных сцен с тремя дублями, реакции быстрее
def studio_h(rs):
    short = sum(1 for r in rs if (r['dur'] or 0) < 2.2)
    return (len(rs) - short) / 45 + short / 90 + 0.25  # +15 минут на разогрев и настройку

total_lines = len(rows)

# ================= Markdown =================
md = []
P = md.append
P('# «Под одеялом» — сценарий студийной записи голосов\n')
P('Сейчас в игре временная синтезированная озвучка (Silero TTS). Этот сценарий — для записи живыми актёрами: '
  'тексты, ударения, подача каждой реплики и контекст сцены. ID реплики = имя файла: запись `S72` заменяет '
  '`assets/audio/voice/S72.mp3`, субтитры и движение губ пересобираются автоматически.\n')
P('Английская версия игры — это субтитры; голос остаётся русским, поэтому записывается один язык.\n')
P('## Сводка\n')
P('| Персонаж | Реплик | Слов | Звучания сейчас, мин | Студия, ч (оценка) |')
P('| --- | ---: | ---: | ---: | ---: |')
for k, rs in per.items():
    P(f"| {CAST[k]['name']} | {len(rs)} | {words(rs)} | {secs(rs) / 60:.1f} | {studio_h(rs):.1f} |")
P(f"| **Всего** | **{total_lines}** | **{words(rows)}** | **{secs(rows) / 60:.1f}** | **{sum(studio_h(rs) for rs in per.values()):.1f}** |\n")
P('Оценка студийного времени: около 45 реплик в час для сцен с тремя дублями, короткие реакции вдвое быстрее, '
  'плюс 15 минут на разогрев. Детскую роль лучше делить на смены по 1,5–2 часа с перерывами.\n')

P('## Кастинг\n')
for k in order:
    c = CAST[k]
    P(f"### {c['name']}\n\n**Возраст:** {c['age']}. **Реплик:** {len(per[k])}.\n\n{c['brief']}\n")

P('## Технические требования\n')
for t in [
    'WAV 48 кГц, 24 бит, моно. Без обработки: без компрессии, эквалайзера, шумодава и реверберации (всё это делаем сами одной цепочкой для всех голосов).',
    'Тихая заглушённая комната, фон не громче −60 dBFS. Конденсаторный микрофон, поп-фильтр, 20–30 см; для шёпота — ближе, 10–15 см, без перегруза.',
    'Пики не выше −6 dBFS; громкие реплики (пурга, «Вот она! Держись!») — отдельный уровень усиления, отметить в листе.',
    'Перед каждой репликой 0,3 с тишины, после — 0,5 с. Вдохи не вырезать.',
    'Три дубля на реплику, разные по подаче; короткие реакции из мини-игр — 2–3 разные интонации подряд в одном файле.',
    'Имена файлов: `ID_дубль.wav`, например `S72_2.wav`. Лучший дубль отметить в таблице (колонка «Лучший»).',
    'Реплики с пометкой «на улице», «издалека», «по телефону» записываются сухо и прямо в микрофон — пространство добавим обработкой. Играть их надо как надо по сцене (проекция голоса, а не расстояние до микрофона).',
]:
    P(f'- {t}')
P('')
P('## Ударения и произношение\n')
P('В колонке «Ударения» знак над гласной — ударный слог (как в синтезе). Имена и слова, которые важно произнести одинаково во всей игре:\n')
for t in ['Ти́хон', 'Огнёвка (огнё́вка — бабочка-огонёк, «приносит пурга»)', 'А́ня, А́нечка', 'ба́ба Ва́ля (соседка за стенкой)',
          'Тише е́дешь — да́льше бу́дешь', 'Тридцать во́семь и семь (температура — главная цифра игры)']:
    P(f'- {t}')
P('')
P('## Порядок записи\n')
P('1. **Тихон** — самая большая роль: сначала основная история (пролог → финалы), потом «Вторая зима», затем глава «Аня» (моложе, бодрее) и в конце короткие реакции пачкой, пока голос не устал.')
P('2. **Мальчик** — две смены: «обычный/радостный» и отдельно «слабый» (болезнь), чтобы не сажать голос. Кашель — в конце второй смены.')
P('3. **Мама**, затем **Аня** (если одна актриса — сначала взрослая роль), **Мама Ани**, **Врач**, **Фельдшер**.')
P('4. Ключевые сцены лучше писать в паре (партнёр читает реплики за кадром): знакомство (S01–S10), финал «Рассвет» (S120–M66), финал «Скорая» (S55–S128), глава «Аня».\n')
P('## Невербальное\n')
P('| Звук | Кто | Файл в игре | Что записать |')
P('| --- | --- | --- | --- |')
for n, who, f, what in NONVERBAL:
    P(f'| {n} | {who} | `{f}` | {what} |')
P('')
P('## Как заменить голос в игре\n')
P('1. Лучший дубль каждой реплики: обработка `_исходники/голоса/synth2.py` (функция `process`: срез низов, разборчивость, лёгкая комната, −18 LUFS) или своя, но одинаковая для всех.')
P('2. Сохранить как `assets/audio/voice/ID.mp3` (моно, 44,1 или 48 кГц, 128–160 кбит/с).')
P('3. `python3 _исходники/голоса/build_data.py` — пересоберёт субтитры и движение губ (`data/lipsync.json`) по новой записи.')
P('4. `node tools/make-voice-page.mjs` — обновит страницу «ПРОСЛУШАТЬ ГОЛОСА.html» для проверки на слух.\n')
P('Длительность новой записи может отличаться от синтезированной: паузы и субтитры подстраиваются под файл сами.\n')

P('## Сценарий по персонажам\n')
P('Колонка «Перед этим» — предыдущая реплика сцены: на что отвечает персонаж.\n')
for k in order:
    P(f"### {CAST[k]['name']}\n")
    cur = None
    for r in per[k]:
        if r['scene'] != cur:
            cur = r['scene']
            P(f'\n**{cur}**\n')
            P('| ID | Реплика | Ударения | Как играть | Перед этим |')
            P('| --- | --- | --- | --- | --- |')
        how = r['how'] if not r['base'] or r['base'] == 'обычная подача' else f"*{r['base']}.* {r['how']}"
        esc = lambda s: s.replace('|', '\\|')
        P(f"| {r['id']} | {esc(r['text'])} | {esc(r['stress'])} | {esc(how)} | {esc(r['ctx'])} |")
    P('')
open(os.path.join(OUT, 'СЦЕНАРИЙ ЗАПИСИ.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')

# ================= XLSX =================
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FILL = {'Паук': 'F3E3C8', 'Мальчик': 'DCE8F5', 'Мама': 'F6DCDC', 'Аня': 'F7E6F0', 'Мама Ани': 'EDE3F3',
        'Врач': 'DDEFE0', 'Фельдшер': 'E3EFE9'}
thin = Side(style='thin', color='C9C2B4')
HEAD = ['№', 'ID', 'Сцена', 'Персонаж', 'Реплика (субтитр)', 'Ударения', 'Как играть', 'Подача (общая)', 'Перед этим',
        'Сейчас, с', 'Дубли записаны', 'Лучший', 'Комментарий']
WID = [5, 7, 26, 15, 46, 46, 40, 22, 40, 8, 10, 8, 30]

def sheet(ws, rs):
    ws.append(HEAD)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='3A3550')
        c.alignment = Alignment(vertical='center', wrap_text=True); c.border = Border(bottom=thin)
    for r in rs:
        ws.append([r['n'], r['id'], r['scene'], r['who'], r['text'], r['stress'], r['how'], r['base'], r['ctx'],
                   r['dur'], '', '', ''])
        row = ws.max_row
        for c in ws[row]:
            c.alignment = Alignment(vertical='top', wrap_text=True)
            c.border = Border(bottom=thin)
        ws.cell(row, 4).fill = PatternFill('solid', fgColor=FILL[r['spk']])
        ws.cell(row, 2).font = Font(bold=True)
    for i, w in enumerate(WID, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'C2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(HEAD))}{ws.max_row}'
    dv = DataValidation(type='list', formula1='"1,2,3"', allow_blank=True)
    ws.add_data_validation(dv); dv.add(f'L2:L{ws.max_row}')
    dv2 = DataValidation(type='list', formula1='"—,1,2,3"', allow_blank=True)
    ws.add_data_validation(dv2); dv2.add(f'K2:K{ws.max_row}')
    ws.sheet_view.zoomScale = 110

wb = Workbook()
ws = wb.active; ws.title = 'Весь сценарий'
sheet(ws, rows)
for k in order:
    sheet(wb.create_sheet(CAST[k]['name'][:31].replace('(', '').replace(')', '')), per[k])

wc = wb.create_sheet('Кастинг', 1)
wc.append(['Персонаж', 'Возраст', 'Реплик', 'Слов', 'Сейчас, мин', 'Студия, ч', 'Описание роли'])
for c in wc[1]:
    c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='3A3550')
for k in order:
    c = CAST[k]; rs = per[k]
    wc.append([c['name'], c['age'], len(rs), words(rs), round(secs(rs) / 60, 1), round(studio_h(rs), 1), c['brief']])
    wc.cell(wc.max_row, 1).fill = PatternFill('solid', fgColor=FILL[k])
wc.append(['Всего', '', total_lines, words(rows), round(secs(rows) / 60, 1), round(sum(studio_h(rs) for rs in per.values()), 1), ''])
for row in wc.iter_rows(min_row=2):
    for c in row: c.alignment = Alignment(vertical='top', wrap_text=True)
wc.cell(wc.max_row, 1).font = Font(bold=True)
for i, w in enumerate([22, 26, 8, 8, 11, 10, 100], 1):
    wc.column_dimensions[get_column_letter(i)].width = w

wt = wb.create_sheet('Требования', 2)
for t in ['Формат: WAV 48 кГц, 24 бит, моно, без обработки.', 'Фон ≤ −60 dBFS, пики ≤ −6 dBFS, микрофон 20–30 см (шёпот 10–15 см).',
          'Три дубля на реплику; реакции из мини-игр — 2–3 интонации в одном файле.', 'Файлы: ID_дубль.wav (S72_2.wav). Лучший дубль — колонка «Лучший».',
          '0,3 с тишины до реплики и 0,5 с после; вдохи не вырезать.', '«На улице», «издалека», «по телефону» — писать сухо, пространство добавим сами.',
          'Ударение — знак над гласной в колонке «Ударения».', 'Замена в игре: assets/audio/voice/ID.mp3 → python3 _исходники/голоса/build_data.py.']:
    wt.append([t])
wt.column_dimensions['A'].width = 120
wn = wb.create_sheet('Невербальное', 3)
wn.append(['Звук', 'Кто', 'Файл в игре', 'Что записать'])
for c in wn[1]: c.font = Font(bold=True)
for n in NONVERBAL: wn.append(list(n))
for i, w in enumerate([18, 16, 40, 80], 1):
    wn.column_dimensions[get_column_letter(i)].width = w
wb.save(os.path.join(OUT, 'сценарий-записи.xlsx'))
print(f'{total_lines} реплик; ' + ', '.join(f"{CAST[k]['name']}: {len(v)}" for k, v in per.items()))
