import { GameState } from '../state.js';

// Расписание дней. Спальня одна на все дни: меняются утро, куда отлучается мама, разговор с Тихоном,
// выбор реплики и мини-игра. Порядок игр: 1 — крестики-нолики, 2 — морской бой, 3 — «Паутинка» (виселица),
// 4 — точки и линии, 5 — шашки.
//
// away — почему мамы нет рядом во время партии (у каждой отлучки есть причина), back — с чем она возвращается.
// choice — две реплики мальчика: первая доверчивая (+доверие Тихону), вторая осторожная. Каждая открывает секрет.
export const DAYS = [
  {
    day: 1, game: 'tictactoe', gameTitle: 'Крестики-нолики', subtitle: 'Кто первым выиграет три раунда', intro: 'S10',
    away: 'pharmacy', back: 'M40',
    choice: [
      { line: 'B31', reply: 'S71', secret: 'ogonek', kind: true },
      { line: 'B32', reply: 'S72', secret: 'strashny', kind: false },
    ],
  },
  {
    day: 2, game: 'battleship', gameTitle: 'Морской бой', subtitle: 'Флот из бумажных корабликов на одеяле', intro: 'S11',
    away: 'kitchen', back: 'M41',
    choice: [
      { line: 'B35', reply: 'S77', secret: 'anya', kind: true },
      { line: 'B36', reply: 'S78', secret: 'domovoy', kind: false },
    ],
  },
  {
    day: 3, game: 'hangman', gameTitle: 'Паутинка', subtitle: 'Угадай слово по буквам', intro: 'S12',
    away: 'phone', back: 'M42',
    choice: [
      { line: 'B37', reply: 'S84', secret: 'nit', kind: true },
      { line: 'B38', reply: 'S85', secret: 'hitrost', kind: false },
    ],
  },
  {
    day: 4, game: 'dots', gameTitle: 'Точки и линии', subtitle: 'Замыкай клетки на поле четыре на четыре', intro: 'S13',
    away: 'asleep', back: 'M43',
    choice: [
      { line: 'B40', reply: 'S87', secret: 'strah', kind: true },
      { line: 'B41', reply: 'S88', secret: 'babochka', kind: false },
    ],
  },
  {
    day: 5, game: 'checkers', gameTitle: 'Шашки', subtitle: 'Последняя партия', intro: 'S14',
    away: 'neighbor', back: 'M44',
    choice: [
      { line: 'B42', reply: 'S91', secret: 'spasibo', kind: true },
      { line: 'B43', reply: 'S92', secret: 'tkachi', kind: false },
    ],
  },
];

// «Вторая зима» (новая игра+): год спустя. Тихон помнит прошлую зиму, у каждой игры — взрослый вариант:
// пять в ряд на листе в клетку, морской бой с минами, «Паутинка» на пословицах, точки 5×5 и шашки в поддавки
// (единственная игра, где паук старается проиграть). Отлучки мамы — те же, разговоры и секреты — новые.
// variant уходит в мини-игру как data.variant.
export const DAYS_W2 = [
  {
    day: 1, game: 'gomoku', gameTitle: 'Пять в ряд', subtitle: 'Крестики-нолики на целом листе в клетку', intro: 'S220',
    away: 'pharmacy', back: 'M40',
    choice: [
      { line: 'B92', reply: 'S210', secret: 'rosa', kind: true },
      { line: 'B93', reply: 'S211', secret: 'ugol', kind: false },
    ],
  },
  {
    day: 2, game: 'battleship', variant: { mines: 2 }, gameTitle: 'Морской бой с минами', subtitle: 'Две мины у тебя, две у паука', intro: 'S221',
    away: 'kitchen', back: 'M41',
    choice: [
      { line: 'B94', reply: 'S212', secret: 'flagman', kind: true },
      { line: 'B95', reply: 'S213', secret: 'mina', kind: false },
    ],
  },
  {
    day: 3, game: 'hangman', variant: { proverbs: true }, gameTitle: 'Паутинка: пословицы', subtitle: 'Угадай пословицу по буквам', intro: 'S222',
    away: 'phone', back: 'M42',
    choice: [
      { line: 'B96', reply: 'S214', secret: 'tishe', kind: true },
      { line: 'B97', reply: 'S215', secret: 'umnee', kind: false },
    ],
  },
  {
    day: 4, game: 'dots', variant: { dots: 6 }, gameTitle: 'Точки и линии', subtitle: 'Большое поле: пять на пять клеток', intro: 'S223',
    away: 'asleep', back: 'M43',
    choice: [
      { line: 'B98', reply: 'S216', secret: 'vsegda', kind: true },
      { line: 'B99', reply: 'S217', secret: 'zhar', kind: false },
    ],
  },
  {
    day: 5, game: 'checkers', variant: { giveaway: true }, gameTitle: 'Поддавки', subtitle: 'Кто первым отдаст все шашки, тот и выиграл', intro: 'S224',
    away: 'neighbor', back: 'M44',
    choice: [
      { line: 'B101', reply: 'S218', secret: 'chestno', kind: true },
      { line: 'B102', reply: 'S219', secret: 'putanitsa', kind: false },
    ],
  },
];

// Мини-игра → сцена Phaser.
export const GAME_SCENES = {
  tictactoe: 'TicTacToe', battleship: 'SeaBattle', hangman: 'Hangman', words: 'Hangman', dots: 'Dots', checkers: 'Checkers', gomoku: 'Gomoku',
};

export const daysFor = (mode = GameState.mode) => (mode === 'winter2' ? DAYS_W2 : DAYS);
export const getDay = (n, mode = GameState.mode) => { const list = daysFor(mode); return list[Math.max(0, Math.min(list.length - 1, n - 1))]; };
