// «Виселица» (в игре — «Паутинка»): паук загадывает слово, мальчик угадывает по буквам.
// Е и Ё считаются одной буквой (как в детских кроссвордах); в слове показывается настоящая буква.
// Повторная буква не стоит ошибки. Слова — простые существительные, понятные ребёнку.
export const WORDS = {
  // 4–5 букв, 8 ошибок
  easy: ['ЗИМА', 'СНЕГ', 'ШАРФ', 'ЛЫЖИ', 'САНКИ', 'ГОРКА', 'ЁЛКА', 'ШАПКА', 'КОШКА', 'ЛАМПА', 'КНИГА', 'ПЕЧКА',
    'ЧАШКА', 'ЛОЖКА', 'ПИРОГ', 'СОВА', 'ЛИСА', 'ВОЛК', 'ЗАЯЦ', 'МУХА', 'ОКНО', 'ДВЕРЬ', 'НОСКИ', 'РЫБА', 'ЛОДКА',
    'ЯКОРЬ', 'ПАРУС', 'КУБИК', 'МЯЧИК', 'КАКАО', 'БЕЛКА', 'ТУЧКА', 'ГНОМ', 'ЕНОТ', 'КЕДЫ', 'УТКА', 'ЛУНА', 'ДОЖДЬ', 'ПЕНАЛ'],
  // 6–7 букв, 7 ошибок
  medium: ['ВАРЕНЬЕ', 'ПОДУШКА', 'ОДЕЯЛО', 'ВАРЕЖКИ', 'КОНЬКИ', 'ЗВЕЗДА', 'ТАРЕЛКА', 'КОРАБЛЬ', 'ПАУТИНА', 'МАЛИНА',
    'ЧАЙНИК', 'ПЕЧЕНЬЕ', 'КОНФЕТА', 'КРОВАТЬ', 'ИГРУШКА', 'ТЕТРАДЬ', 'ФОНАРИК', 'БАБОЧКА', 'ДЕЛЬФИН', 'РАКЕТА',
    'ПЛАНЕТА', 'МЕДВЕДЬ', 'СНЕЖОК', 'САМОЛЁТ', 'ПОДАРОК', 'ЛИМОНАД', 'КОМПОТ', 'ПОЕЗДКА'],
  // 8+ букв, 6 ошибок
  hard: ['СНЕГОВИК', 'СОСУЛЬКА', 'ГРАДУСНИК', 'КАРТОШКА', 'ВЕРТОЛЁТ', 'ЛЕКАРСТВО', 'ШКАТУЛКА', 'КАРАНДАШ',
    'ЧЕРЕПАХА', 'ПРОСТУДА', 'СНЕЖИНКА', 'КОЛОКОЛЬЧИК', 'ВЕЛОСИПЕД', 'ТЕЛЕВИЗОР', 'ХОЛОДИЛЬНИК', 'КРОКОДИЛ',
    'ПОДОКОННИК', 'ВОЛШЕБНИК', 'ОДУВАНЧИК', 'ШОКОЛАДКА', 'МАРМЕЛАД', 'БУТЕРБРОД', 'МЕТЕЛИЦА', 'КАЛЕНДАРЬ',
    'ПУТЕШЕСТВИЕ', 'ПРИКЛЮЧЕНИЕ', 'ВЕСНУШКА'],
};
export const LEN = { easy: [4, 5], medium: [6, 7], hard: [8, 99] };
export const MAX_MISSES = { easy: 8, medium: 7, hard: 6 };

// «Вторая зима»: пословицы. Пробелы, тире и запятые открыты сразу. Длиннее слова — и ниточек больше.
// Раскладка — две строки по 19 знаков максимум на тетрадном листе (wrapPhrase).
export const PROVERBS = {
  easy: ['УТРО ВЕЧЕРА МУДРЕНЕЕ', 'СЛОВО НЕ ВОРОБЕЙ', 'НЕТ ДЫМА БЕЗ ОГНЯ', 'ДОРОГА ЛОЖКА К ОБЕДУ', 'ДЕЛУ ВРЕМЯ — ПОТЕХЕ ЧАС',
    'ДРУГ ПОЗНАЁТСЯ В БЕДЕ', 'ЗДОРОВЬЕ ДОРОЖЕ ЗОЛОТА'],
  medium: ['ТИШЕ ЕДЕШЬ — ДАЛЬШЕ БУДЕШЬ', 'БЕРЕГИ НОС В БОЛЬШОЙ МОРОЗ', 'ВСЯКОМУ ОВОЩУ СВОЁ ВРЕМЯ', 'ГЛАЗА БОЯТСЯ, А РУКИ ДЕЛАЮТ',
    'КОНЧИЛ ДЕЛО — ГУЛЯЙ СМЕЛО', 'ЛУЧШЕ ПОЗДНО, ЧЕМ НИКОГДА', 'ЦЫПЛЯТ ПО ОСЕНИ СЧИТАЮТ'],
  hard: ['СТАРЫЙ ДРУГ ЛУЧШЕ НОВЫХ ДВУХ', 'ТЕРПЕНИЕ И ТРУД ВСЁ ПЕРЕТРУТ', 'СЕМЬ РАЗ ОТМЕРЬ — ОДИН РАЗ ОТРЕЖЬ',
    'НЕ ИМЕЙ СТО РУБЛЕЙ, А ИМЕЙ СТО ДРУЗЕЙ', 'НА ВКУС И ЦВЕТ ТОВАРИЩА НЕТ'],
};
export const MAX_MISSES_PHRASE = { easy: 10, medium: 9, hard: 8 };

// Английская версия: свои слова (той же длины по уровням) и настоящие английские пословицы
// (в каждой — до двух строк по 19 знаков). Апостроф и запятая открыты сразу, как тире в русских.
export const WORDS_EN = {
  easy: ['SNOW', 'SLED', 'SCARF', 'SKIS', 'HILL', 'TREE', 'COAT', 'BOOTS', 'LAMP', 'BOOK', 'STOVE', 'SPOON', 'PLATE',
    'CAKE', 'WOLF', 'BEAR', 'HARE', 'DOOR', 'SOCKS', 'FISH', 'BOAT', 'SAIL', 'BALL', 'COCOA', 'ROBOT', 'STAR', 'MOON',
    'RAIN', 'CLOUD', 'HONEY', 'BREAD', 'APPLE', 'CHAIR', 'CLOCK', 'MOUSE', 'DUCK', 'KITE', 'DRUM'],
  medium: ['BLANKET', 'PILLOW', 'MITTENS', 'SKATES', 'ROCKET', 'PLANET', 'TEAPOT', 'COOKIE', 'CANDLE', 'DOLPHIN',
    'SPIDER', 'RABBIT', 'WINDOW', 'PENCIL', 'PUZZLE', 'JACKET', 'LANTERN', 'CASTLE', 'PIRATE', 'DRAGON', 'KITTEN',
    'MUFFIN', 'PARROT', 'TURTLE', 'BUTTON', 'PRESENT', 'SNOWMAN', 'PANCAKE', 'ICICLE'],
  hard: ['THERMOMETER', 'SNOWFLAKE', 'BLIZZARD', 'MEDICINE', 'HELICOPTER', 'CROCODILE', 'DANDELION', 'CHOCOLATE',
    'SANDWICH', 'CALENDAR', 'ADVENTURE', 'BUTTERFLY', 'TELESCOPE', 'DINOSAUR', 'ELEPHANT', 'KANGAROO', 'MARSHMALLOW',
    'STRAWBERRY', 'RASPBERRY', 'SNOWBALL', 'TREASURE', 'HEDGEHOG', 'SPACESHIP', 'FIREPLACE', 'BLUEBERRY', 'UMBRELLA',
    'PINEAPPLE'],
};
export const PROVERBS_EN = {
  easy: ['NO SMOKE WITHOUT FIRE', 'TOMORROW IS ANOTHER DAY', 'PRACTICE MAKES PERFECT', 'LOOK BEFORE YOU LEAP',
    'EASY DOES IT', 'KNOWLEDGE IS POWER', 'HEALTH IS BETTER THAN WEALTH'],
  medium: ['SLOW AND STEADY WINS THE RACE', 'BETTER LATE THAN NEVER', 'OLD FRIENDS ARE BEST', 'PATIENCE IS A VIRTUE',
    'HOME IS WHERE THE HEART IS', 'MANY HANDS MAKE LIGHT WORK', 'TWO HEADS ARE BETTER THAN ONE'],
  hard: ['A STITCH IN TIME SAVES NINE', 'EVERY CLOUD HAS A SILVER LINING', 'A FRIEND IN NEED IS A FRIEND INDEED',
    'MEASURE TWICE, CUT ONCE', 'LAUGHTER IS THE BEST MEDICINE', 'GOOD THINGS COME TO THOSE WHO WAIT',
    'WHERE THERE\'S A WILL, THERE\'S A WAY'],
};

export function pickProverb(level, rng = Math.random, avoid = [], lang = 'ru') {
  const P = lang === 'en' ? PROVERBS_EN : PROVERBS;
  const list = (P[level] || P.medium).filter((w) => !avoid.includes(w));
  const pool = list.length ? list : P[level] || P.medium;
  return pool[Math.floor(rng() * pool.length)];
}

// Раскладка фразы по строкам (по словам, не длиннее max знаков в строке).
export function wrapPhrase(phrase, max = 19) {
  const lines = []; let cur = '';
  for (const w of phrase.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
export const ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
export const ALPHABET_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const alphabetFor = (lang = 'ru') => (lang === 'en' ? ALPHABET_EN : ALPHABET);

export const norm = (ch) => (ch === 'Ё' ? 'Е' : ch);
export const isLetter = (ch) => ALPHABET.includes(norm(ch)) || ALPHABET_EN.includes(ch);

export function wordsFor(level, lang = 'ru') {
  const [a, b] = LEN[level] || LEN.medium;
  return Object.values(lang === 'en' ? WORDS_EN : WORDS).flat().filter((w) => w.length >= a && w.length <= b);
}

export function pickWord(level, rng = Math.random, avoid = [], lang = 'ru') {
  const pool = wordsFor(level, lang).filter((w) => !avoid.includes(w));
  const list = pool.length ? pool : wordsFor(level, lang);
  return list[Math.floor(rng() * list.length)];
}

export function createHangman(word, level = 'medium', { phrase = false } = {}) {
  const max = phrase ? MAX_MISSES_PHRASE[level] || 9 : MAX_MISSES[level] || 7;
  const up = word.toUpperCase();
  const lang = /[А-ЯЁ]/.test(up) ? 'ru' : 'en'; // алфавит партии — по самому слову
  return { word: up, level, tried: [], misses: 0, max, phrase, lang };
}

// Ход: → 'repeat' | 'invalid' | 'hit' | 'miss'. Состояние меняется только для hit/miss.
export function guess(state, raw) {
  const ch = norm(String(raw || '').toUpperCase());
  if (ch.length !== 1 || !isLetter(ch) || ch === 'Ё') return 'invalid';
  if (!alphabetFor(state.lang || 'ru').includes(ch)) return 'invalid'; // латиница в русской партии и наоборот
  if (status(state) !== 'play') return 'invalid';
  if (state.tried.includes(ch)) return 'repeat';
  state.tried.push(ch);
  const hit = [...state.word].some((w) => isLetter(w) && norm(w) === ch);
  if (!hit) state.misses += 1;
  return hit ? 'hit' : 'miss';
}

export const revealed = (state) => [...state.word].map((w) => (!isLetter(w) || state.tried.includes(norm(w)) ? w : null));
export const lettersLeft = (state) => new Set([...state.word].filter((w) => isLetter(w) && !state.tried.includes(norm(w))).map(norm)).size;
export const letterCount = (word) => [...word].filter(isLetter).length;

export function status(state) {
  if ([...state.word].every((w) => !isLetter(w) || state.tried.includes(norm(w)))) return 'win';
  if (state.misses >= state.max) return 'loss';
  return 'play';
}

// Мамина подсказка: самая частая ещё не открытая буква слова (честно — паук слово не меняет).
export function hintLetter(state) {
  const counts = new Map();
  for (const w of state.word) { if (!isLetter(w)) continue; const n = norm(w); if (!state.tried.includes(n)) counts.set(n, (counts.get(n) || 0) + 1); }
  let best = null; let bc = 0;
  for (const [k, v] of counts) if (v > bc) { best = k; bc = v; }
  return best;
}

// Физическая клавиатура: e.key (русская раскладка) или e.code (ЙЦУКЕН при английской раскладке).
export const CODE_TO_RU = {
  KeyQ: 'Й', KeyW: 'Ц', KeyE: 'У', KeyR: 'К', KeyT: 'Е', KeyY: 'Н', KeyU: 'Г', KeyI: 'Ш', KeyO: 'Щ', KeyP: 'З',
  BracketLeft: 'Х', BracketRight: 'Ъ', KeyA: 'Ф', KeyS: 'Ы', KeyD: 'В', KeyF: 'А', KeyG: 'П', KeyH: 'Р', KeyJ: 'О',
  KeyK: 'Л', KeyL: 'Д', Semicolon: 'Ж', Quote: 'Э', KeyZ: 'Я', KeyX: 'Ч', KeyC: 'С', KeyV: 'М', KeyB: 'И', KeyN: 'Т',
  KeyM: 'Ь', Comma: 'Б', Period: 'Ю', Backquote: 'Ё',
};
export function letterFromKey(e, lang = 'ru') {
  const k = String(e.key || '').toUpperCase();
  if (lang === 'en') {
    // английские слова: буква с клавиши, а при русской раскладке — по физической клавише (KeyA → A)
    if (k.length === 1 && ALPHABET_EN.includes(k)) return k;
    const m = /^Key([A-Z])$/.exec(e.code || '');
    return m ? m[1] : null;
  }
  if (k.length === 1 && (ALPHABET.includes(k) || k === 'Ё')) return norm(k);
  return CODE_TO_RU[e.code] ? norm(CODE_TO_RU[e.code]) : null;
}
