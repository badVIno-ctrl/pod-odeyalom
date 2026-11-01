# Авторы и лицензии

## Звуки (assets/audio/sfx/)

Все записи — **CC0 1.0** (общественное достояние; авторов указываем из уважения). Записи обрезаны, отфильтрованы,
у части добавлена «комната», громкость выровнена, у петель сделаны бесшовные стыки. Скрипт обработки и синтеза —
`_исходники/звук/build_sfx.py`, там же `fetch_sources.py`, который скачивает все исходники.

### Записи с Freesound

| Файл | Что это | Источник |
|---|---|---|
| wind_soft | зимний ветер в деревьях, издалека (петля 30 с) | lwdickens — «windy winter day, wind in trees, from distance» https://freesound.org/people/lwdickens/sounds/259968/ |
| blizzard | сильная метель (петля 40 с) | martypinso — «HEAVYSNOWSTORM» https://freesound.org/people/martypinso/sounds/22606/ |
| snow_steps | шаги в ботинках по снегу (петля) | Nox_Sound — «Footsteps Mountain Boots Snow Walk» https://freesound.org/people/Nox_Sound/sounds/613849/ |
| door | деревянная дверь: открыть-закрыть | Ryding — «Wooden door open-close» https://freesound.org/people/Ryding/sounds/125958/ |
| clock | тиканье часов (петля) | blukotek — «ticking of the clock 01» https://freesound.org/people/blukotek/sounds/412751/ |
| cough_soft_1..3 | лёгкий детский кашель | 15HSindelarovaT — «COUGH» https://freesound.org/people/15HSindelarovaT/sounds/461629/ |
| cough_hard_1..3 | сильный детский кашель | mrrap4food — «LITTLE KID COUGHING!» https://freesound.org/people/mrrap4food/sounds/619075/ |
| move | мел по доске (ход в крестиках-ноликах) | Breviceps — «Write/Draw with chalk on board» https://freesound.org/people/Breviceps/sounds/447925/ |
| spider_laugh | смешок паука «хе-хе-хе» тем же голосом, что и реплики Тихона | Silero TTS (aidar), см. «Голоса» |

### Записи с OpenGameArt

| Файл | Что это | Источник (CC0) |
|---|---|---|
| wood_1..3, spoon_1..2, cup, pop, splash_1..2, boom | стук шашек, ложка о стакан, чашка, «чпок», всплеск промаха, попадание (взрыв под водой) | rubberduck — «100 CC0 SFX» https://opengameart.org/content/100-cc0-sfx |
| paper_1..3, page, tear | шорох бумаги, лист правил, отрыв листка (разрыв досинтезирован) | StarNinjas — «10 Book Page Flips» https://opengameart.org/content/10-book-page-flips (автор: https://opengameart.org/users/starninjas) |
| pencil_1..3, pencil_scribble, erase | карандаш и ластик (точки, отметки дней) | AntumDeluge — «Pencil Sounds» https://opengameart.org/content/pencil-sounds (записи NachtmahrTV и damsur) |
| sip_1..2, gulp_1..2 | глоток чая, «ам» — проглотил лекарство | OwlishMedia — «202 More Sound Effects» https://opengameart.org/content/202-more-sound-effects |
| gull_1..3 | чайки (морской бой) | Rango Mango — «Solo Seagull Sound Effects» https://opengameart.org/content/solo-seagull-sound-effects |
| heartbeat | сердцебиение (третье поражение) | bart — «Heartbeat sounds» https://opengameart.org/content/heartbeat-sounds |
| sea | прибой под одеялом: синтезированная волна + настоящие накаты | transitking, Freesound #11505, через «Water Waves» https://opengameart.org/content/water-waves |

### Синтез (numpy и scipy, без записей)

siren (скорая вдали, с эхом), stove (печка), drone (тревожный гул), doorbell (звонок в дверь), chime и combo (награда, серия),
sparkle и magic (волшебство, «полегчало»), web (паутина), buzz (муха), blink, tap, whoosh, moth_flutter (крылья Огнёвки о стекло),
bullfinch (снегирь утром), engine (мотор скорой), ui_hover и ui_click (кнопки).

## Музыка (assets/audio/music/) и стингеры

Музыка написана специально для этой игры — ноты лежат в коде (`_исходники/звук/score.py`), сборка — `build_music.py`.
Всё построено на одной колыбельной (ре мажор, 3/4): меню, утро и рассвет — её варианты; у паука Тихона своя тема (си минор).

| Файл | Где звучит |
|---|---|
| mus_menu | меню и дорога в прологе |
| mus_morning | утро в спальне, хорошие события дня |
| mus_tikhon | разговоры с Тихоном, виселица |
| mus_game | мини-игры |
| mus_game_tense | шашки в последний день |
| mus_night | ночь, сон |
| mus_hospital | плохие события дня, больница |
| mus_dawn | рассвет, хороший финал |
| sfx/win, sfx/lose, sfx/daycard, sfx/musicbox | стингеры победы и поражения, карточка нового дня, музыкальная шкатулка |

Инструменты — сэмплы **VCSL** (Versilian Community Sample Library, **CC0**) https://github.com/sgossner/VCSL:
пианино Upright Piano Knight, концертная арфа, глокеншпиль, вибрафон, маримба, шейкер, вудблок, треугольник, bell tree.
Музыкальная шкатулка, челеста, пэд и пиццикато — синтез. Лицензионных ограничений у музыки нет.
Громкость тем — −21…−24 LUFS (тише голосов), стингеров — −19…−21 LUFS; под реплики и стингеры музыка приглушается.

## Голоса (assets/audio/voice/)

Все **176 реплик** озвучены синтезом речи **Silero TTS** (модель `v5_2_ru`, https://github.com/snakers4/silero-models).
Работает локально. Ударения расставлены вручную (знак `+` перед ударной гласной), тексты и пресеты —
`_исходники/голоса/lines.py`, инструкция — `_исходники/голоса/README.md`.

| Персонаж | Голос Silero | Темп и обработка |
|---|---|---|
| Мама | baya | обычный или медленный темп, ночью тише и ниже; лёгкая «комната» |
| Мальчик | kseniya, высокий тон | медленно, когда плохо — ещё медленнее и тише |
| Тихон | aidar, низкий | медленно, лёгкое эхо. В финале — тонкий голосок |
| Врач, фельдшер | eugene | 70% скорости |

Перед каждой репликой добавлена короткая тишина, чтобы первый слог не обрезался. Разборчивость поднята
эквалайзером (2–4 кГц), громкость выровнена до −18 LUFS. Каждая реплика проверена распознаванием речи (Whisper).

**Лицензия моделей Silero — CC BY-NC-SA 4.0** (некоммерческое использование, с указанием авторства).
Бесплатно выложить игру (itch.io, «бесплатно») можно. Для продажи реплики нужно переозвучить:
живыми актёрами или моделью с коммерческой лицензией. Старая озвучка Qwen3-TTS (Apache-2.0) ранней версии
сохранена в `_исходники/голоса/qwen-старые/`.

## Шрифты

Все шрифты — **SIL Open Font License 1.1**, подключены пакетами @fontsource (только кириллица и латиница).

- **Literata** (текст реплик и подписи, 400–700) — @fontsource/literata.
- **Kurale** (заголовки, имена и кнопки) — @fontsource/kurale.
- **Neucha** (записки от руки: счёт, табло, дневник) — @fontsource/neucha.
- **Caveat** (рукописные буквы внутри мира: мел, виселица, тетрадное поле) — @fontsource/caveat.

Копии Literata и Kurale для страницы «ПРОСЛУШАТЬ ГОЛОСА.html» — в `assets/fonts/` вместе с текстами лицензий.

## Временные материалы

| Что | Почему временное | Чем заменить |
|---|---|---|
| Все картинки и персонажи | нарисованы кодом (Canvas 2D) как заглушки в едином стиле | PNG художника с ключом из `assets/manifest.json` (фоны и предметы); скелеты персонажей рисуются кодом |
| Голоса | Silero, некоммерческая лицензия | живая озвучка по `_исходники/голоса/lines.py` (ID и тексты те же) |
| Синтезированные звуки | сделаны скриптом, без записи | записи CC0 с теми же именами файлов (или поправить `_исходники/звук/build_sfx.py`) |

## Код

- Phaser 4.2.1 — MIT. Howler.js — MIT. Vite — MIT.
- Логика и сложность ИИ шашек и морского боя — порт из проектов пользователя (online-heckers-main, seabattle-main; копии лежат в `_исходники/`).
- Иконка, персонажи, комнаты и все картинки нарисованы кодом (Canvas 2D) внутри проекта. Исходник иконки — `assets/favicon.svg`.
