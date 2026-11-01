import {
  TEMP_START, TEMP_WIN_DELTA, TEMP_LOSS_DELTA, TOTAL_DAYS, WINS_TO_RECOVER, LOSSES_TO_HOSPITAL, BOY_STATES,
} from './config/game.js';
import { DEFAULT_DIFFICULTY, DIFFICULTY_IDS } from './config/difficulty.js';

const round1 = (v) => Math.round(v * 10) / 10;

// Состояние одного забега. Живёт в памяти; общий прогресс между забегами — systems/journal.js.
export function createState() {
  return {
    difficulty: DEFAULT_DIFFICULTY,
    day: 1,
    wins: 0, // серебряные нити Тихона
    losses: 0, // искры Огнёвки
    temp: TEMP_START, // внутренняя «температура»: от неё вид мальчика и шкала «Жар» (числа на экране не показываются)
    dayResults: Array(TOTAL_DAYS).fill(null), // null | 'win' | 'loss'
    lastEvent: null, // 'win1'…'win3' | 'loss1'…'loss3' — событие по общему счёту
    courage: 0, // «Смелость» 0..100: копится за удачные ходы, тратится на мамину подсказку
    trust: 0, // доверие к Тихону: сколько раз мальчик ответил по-доброму
    choices: Array(TOTAL_DAYS).fill(null), // индекс выбранной реплики по дням
    secrets: [], // секреты, открытые в этом забеге
    finished: false, // финал уже засчитан (защита от двойного запуска)
    ending: null, // 'dawn' | 'tikhon' | 'ambulance' | 'companion'
    stats: { moves: 0, goodMoves: 0, draws: 0, hints: 0 },
    // иней на окне: паутинки (по победам) и проталины от ударов Огнёвки — остаются на стекле до конца забега
    frost: { webs: [], melts: [] },
    // памятные моменты дней (для письма Тихона): { day, game, result, labels, ... } — см. MiniGameBase.finish
    highlights: [],
    mode: 'main', // 'main' | 'winter2' — «Вторая зима» (новая игра+)
    archived: false, // письмо и последний рисунок уже записаны в альбом
  };
}

export const GameState = {
  ...createState(),
  soundOn: true,

  setDifficulty(id) {
    if (DIFFICULTY_IDS.includes(id)) this.difficulty = id;
  },

  // Новая игра с той же сложностью: обнуляются победы, поражения, отметки дней и «здоровье».
  reset(difficulty = this.difficulty, mode = 'main') {
    Object.assign(this, createState(), { difficulty, mode });
  },

  // Итог дня: победа → −0,7°, поражение → +0,5°. День засчитывается один раз; после финала — не засчитывается.
  recordDay(result, day = this.day) {
    if (result !== 'win' && result !== 'loss') throw new Error(`Unknown day result: ${result}`);
    if (this.dayResults[day - 1] || this.outcome()) return this.outcome();
    this.dayResults[day - 1] = result;
    if (result === 'win') {
      this.wins += 1;
      this.temp = round1(this.temp + TEMP_WIN_DELTA);
    } else {
      this.losses += 1;
      this.temp = round1(this.temp + TEMP_LOSS_DELTA);
    }
    this.lastEvent = eventFor(result, this.wins, this.losses);
    return this.outcome();
  },

  // Памятный момент дня (один на день: повтор дня заменяет запись).
  addHighlight(h) {
    if (!h || !h.day) return;
    this.highlights = this.highlights.filter((x) => x.day !== h.day).concat([h]).sort((a, b) => a.day - b.day);
  },

  // Конец игры — по общему счёту (не подряд): 3 победы или 3 поражения. Может наступить уже на 3-й день.
  outcome() {
    if (this.wins >= WINS_TO_RECOVER) return 'recovered';
    if (this.losses >= LOSSES_TO_HOSPITAL) return 'hospital';
    return null;
  },

  // Выбор реплики дня: 0 — доверчивый ответ (+доверие), 1 — осторожный. Засчитывается один раз за день.
  choose(day, index, { kind = index === 0, secret = null } = {}) {
    if (this.choices[day - 1] !== null && this.choices[day - 1] !== undefined) return false;
    this.choices[day - 1] = index;
    if (kind) { this.trust += 1; this.addCourage(10); }
    if (secret && !this.secrets.includes(secret)) this.secrets.push(secret);
    return true;
  },

  choicesMade() { return this.choices.filter((c) => c !== null && c !== undefined).length; },

  // Вариант финала: тайный («Тихон» / «Попутчик»), если мальчик всегда, кроме, может быть, пары раз, был добр к пауку.
  endingVariant(outcome = this.outcome()) {
    const made = this.choicesMade();
    const warm = made > 0 && this.trust >= Math.min(3, made);
    if (outcome === 'recovered') return warm ? 'tikhon' : 'dawn';
    if (outcome === 'hospital') return warm ? 'companion' : 'ambulance';
    return null;
  },

  // Финал засчитывается ровно один раз (быстрые клики, пропуск, повторный вход в сцену).
  finish() {
    if (this.finished) return false;
    this.finished = true;
    this.ending = this.endingVariant();
    return true;
  },

  // Художественная шкала «Жар» 0..1 (не медицинская): 0 — прохладно, 1 — очень жарко.
  heat(temp = this.temp) { return Math.max(0, Math.min(1, (round1(temp) - 36.6) / (40.2 - 36.6))); },

  // Совместимость со старыми мини-играми: «сила» паука = поражения − победы.
  spiderPower() { return this.losses - this.wins; },

  wellbeing(temp = this.temp) { return wellbeingFor(temp); },

  addCourage(n) { this.courage = Math.max(0, Math.min(100, this.courage + n)); return this.courage; },

  // Подсказка стоит 100 «смелости» (одна полная шкала).
  canHint() { return this.courage >= 100; },
  spendHint() {
    if (!this.canHint()) return false;
    this.courage = 0; this.stats.hints += 1;
    return true;
  },

  nextDay() {
    this.day = Math.min(TOTAL_DAYS, this.day + 1);
    return this.day;
  },

  // Для отладки: перейти к дню N. Прошлые дни засчитываются по очереди (победа, поражение, …), как будто
  // их сыграли: счёт настоящий, и к концу пятого дня финал наступает всегда (раньше день 5 мог начаться заново).
  jumpToDay(n) {
    const day = Math.max(1, Math.min(TOTAL_DAYS, n));
    this.reset(this.difficulty, this.mode); // во «Второй зиме» прыжок остаётся во второй зиме
    for (let d = 1; d < day; d++) this.recordDay(d % 2 ? 'win' : 'loss', d);
    this.day = day;
    return this.day;
  },

  boyKey(temp = this.temp) {
    return boyKeyForTemp(temp);
  },

  // A — обычное утро; B — после 1-го поражения (холоднее); C — после 2-го (паутина Тихона на окне, тревожно).
  roomState() {
    return roomStateFor(this.losses);
  },
};

export function boyKeyForTemp(temp) {
  const t = round1(temp);
  return BOY_STATES.find((s) => t <= s.max).key;
}

// Событие дня — по ОБЩЕМУ числу побед/поражений, а не по номеру дня.
export function eventFor(result, wins, losses) {
  return result === 'win' ? `win${Math.min(3, wins)}` : `loss${Math.min(3, losses)}`;
}

// Самочувствие словами (без цифр) — для шкалы «Жар».
export const WELLBEING = [
  { max: 37.5, key: 'good', label: 'Почти здоров', color: 0x7cc47f },
  { max: 38.2, key: 'better', label: 'Получше', color: 0xb9cf6a },
  { max: 38.9, key: 'sick', label: 'Нехорошо', color: 0xf2a65a },
  { max: 39.7, key: 'bad', label: 'Плохо', color: 0xd9603b },
  { max: Infinity, key: 'worst', label: 'Очень плохо', color: 0xe0574f },
];
export function wellbeingFor(temp) {
  const t = round1(temp);
  return WELLBEING.find((w) => t <= w.max);
}

export function roomStateFor(losses) {
  if (losses >= 2) return 'C';
  if (losses === 1) return 'B';
  return 'A';
}

export const formatTemp = (t) => `${round1(t).toFixed(1).replace('.', ',')}°`;
