// Единый конфиг сложности для всех пяти мини-игр.
// Сложность выбирается в меню и действует на все дни. Паук играет честно:
// результат не подкручивается, меняется только сила ИИ.
//
// Параметры шашек и морского боя перенесены из проектов пользователя
// (online-heckers-main/index.html и seabattle-main/seabattle/game/index.html),
// подробности — docs/notes.md.

export const DIFFICULTY_IDS = ['easy', 'medium', 'hard'];
export const DEFAULT_DIFFICULTY = 'medium';

export const DIFFICULTY = {
  easy: {
    id: 'easy',
    label: 'Лёгкий',
    hint: 'Паук поддаётся',
    introLine: 'S03',
    // День 1. ТЗ: случайная свободная клетка.
    tictactoe: { bestMoveChance: 0 },
    // Шашки «Легко» (getEasyMove): 45% — случайный ход, иначе minimax глубиной 2,
    // оценка = шашки + дамки×2.5 (дамка весит 3.5).
    checkers: { engine: 'basic', randomMoveChance: 0.45, depth: 2 },
    // Морской бой «Юнга» (cabin): стреляет наугад; при раненом корабле 85% выстрелов всё равно наугад.
    // Симуляция (tools/balance.md): паук топит флот в среднем за 68 выстрелов, ребёнок выигрывает ≈ 84% партий.
    battleship: { engine: 'random', noise: 1, targetRandomChance: 0.85, sourceLevel: 'cabin' },
  },
  medium: {
    id: 'medium',
    label: 'Средний',
    hint: 'Паук играет всерьёз',
    introLine: 'S04',
    tictactoe: { bestMoveChance: 0.6 },
    // Шашки: усиленный поиск (оценка позиции, форсированные взятия до 4, глубина до 4 полуходов, до 0,8 с),
    // случайный выбор среди ходов не хуже лучшего на 0,4 шашки. Раньше (minimax глубины 4 по одному
    // материалу) паук проигрывал слишком быстро: 0 из 20 партий против позиционного игрока за ≈ 62 полухода;
    // теперь 6 побед, 8 поражений, 6 ничьих за ≈ 82 полухода (tools/sim-checkers.mjs).
    checkers: { engine: 'enhanced', openingBookMoves: 0, maxDepth: 4, timeLimitMs: 800, quiescenceDepth: 4, margin: 50 },
    // Морской бой «Мичман» (mate): шахматный паттерн, 70% выстрелов поиска наугад; раненый корабль
    // добивает не сразу: 70% выстрелов уходят в сторону. Раньше паук выигрывал слишком быстро (≈ 58 выстрелов,
    // ребёнок выигрывал 47% партий); теперь ≈ 62 выстрела, ребёнок выигрывает ≈ 66%.
    battleship: { engine: 'hunt', noise: 0.7, targetRandomChance: 0.7, sourceLevel: 'mate' },
  },
  hard: {
    id: 'hard',
    label: 'Сложный',
    hint: 'Паук не прощает ошибок',
    introLine: 'S05',
    // Не 100%: идеальный паук не проигрывает, и раунды уходили бы в бесконечные ничьи.
    tictactoe: { bestMoveChance: 0.85 },
    // Шашки «Сложно»: дебютная книга в первые 8 ходов, итеративное углубление до 8 полуходов
    // за 3200 мс, таблица транспозиций, форсированные взятия (quiescence) до 6, расширенная оценка.
    checkers: {
      engine: 'enhanced', openingBookMoves: 8, maxDepth: 8, timeLimitMs: 3200, quiescenceDepth: 6,
    },
    // Морской бой «Капитан» (captain): карта вероятностей по остатку флота, шум 5%.
    // Четвёртый уровень проекта («Адмирал», Монте-Карло без шума) оставлен в ai/battleship.js как 'monte'.
    battleship: { engine: 'prob', noise: 0.05, targetRandomChance: 0, sourceLevel: 'captain' },
  },
};

export function getDifficulty(id) {
  return DIFFICULTY[id] || DIFFICULTY[DEFAULT_DIFFICULTY];
}
