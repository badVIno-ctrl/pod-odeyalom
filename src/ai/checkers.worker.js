// Web Worker: ИИ шашек считает ход в отдельном потоке, чтобы анимации не замирали
// (на «Сложном» поиск идёт до 3,2 с). variant: 'giveaway' — поддавки («Вторая зима»).
import { chooseMove } from './checkers.js';
import { chooseGiveawayMove } from './giveaway.js';

self.onmessage = (e) => {
  const { id, board, moveCount, forcedPiece, difficulty, variant } = e.data;
  let move = null;
  try {
    move = variant === 'giveaway'
      ? chooseGiveawayMove({ board, forcedPiece }, difficulty)
      : chooseMove({ board, color: 'dark', moveCount, forcedPiece }, difficulty);
  } catch (err) { move = null; }
  self.postMessage({ id, move });
};
