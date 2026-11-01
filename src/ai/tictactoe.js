// ИИ крестиков-ноликов (день 1). Единый интерфейс всех ИИ:
//   chooseMove(gameState, difficulty) → move
// gameState: { board: Array(9) из 'X' | 'O' | null, player: 'O' } — player ходит сейчас.
// move: индекс клетки 0..8 (слева направо, сверху вниз) или null, если ходить некуда.
// Сложность — только сила ИИ: с вероятностью bestMoveChance берётся лучший ход по minimax,
// иначе случайная свободная клетка (config/difficulty.js).
import { getDifficulty } from '../config/difficulty.js';

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (p) => (p === 'X' ? 'O' : 'X');
export const freeCells = (board) => board.reduce((acc, v, i) => (v ? acc : (acc.push(i), acc)), []);

// → { winner: 'X' | 'O' | 'draw' | null, line: [a, b, c] | null }
export function evaluate(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
  }
  return { winner: board.every(Boolean) ? 'draw' : null, line: null };
}

const memo = new Map();

// Оценка позиции для `me`, когда ходит `turn`. Быстрая победа лучше медленной, поражение — чем позже, тем лучше.
function score(board, turn, me, depth) {
  const key = board.map((v) => v || '-').join('') + turn + me;
  const cached = memo.get(key);
  if (cached !== undefined) return cached - (cached > 0 ? depth : cached < 0 ? -depth : 0);
  const { winner } = evaluate(board);
  let s;
  if (winner === me) s = 10;
  else if (winner === other(me)) s = -10;
  else if (winner === 'draw') s = 0;
  else {
    const moves = freeCells(board);
    const results = moves.map((i) => {
      board[i] = turn;
      const v = score(board, other(turn), me, 1);
      board[i] = null;
      return v;
    });
    s = turn === me ? Math.max(...results) : Math.min(...results);
  }
  memo.set(key, s);
  return s - (s > 0 ? depth : s < 0 ? -depth : 0);
}

// Все ходы с лучшей оценкой для player.
export function bestMoves(board, player) {
  const b = board.slice();
  const moves = freeCells(b);
  if (!moves.length) return [];
  let best = -Infinity;
  let out = [];
  for (const i of moves) {
    b[i] = player;
    const v = score(b, other(player), player, 0);
    b[i] = null;
    if (v > best) { best = v; out = [i]; } else if (v === best) out.push(i);
  }
  return out;
}

export const isBestMove = (boardBefore, index, player) => bestMoves(boardBefore, player).includes(index);

export function chooseMove(gameState, difficulty, rng = Math.random) {
  const board = gameState.board;
  const player = gameState.player || 'O';
  const free = freeCells(board);
  if (!free.length || evaluate(board).winner) return null;
  const { bestMoveChance } = getDifficulty(difficulty).tictactoe;
  if (rng() < bestMoveChance) {
    const best = bestMoves(board, player);
    return best[Math.floor(rng() * best.length)];
  }
  return free[Math.floor(rng() * free.length)];
}
