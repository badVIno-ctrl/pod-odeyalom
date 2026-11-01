// Шашки в поддавки («Вторая зима», день 5): правила те же (бить обязательно, серия взятий, дамки),
// но цель обратная — выигрывает тот, кто первым отдал все шашки или остался без ходов.
// Паук (тёмные) старается проиграть по-настоящему: альфа-бета с обратной оценкой.
import {
  SIZE, countPieces, getAllMoves, getLegalMovesState, applyMoveState,
} from './checkers.js';

const MATE = 100000;
// глубина в полуходах (каждое взятие серии — отдельный полуход), время на ход
const LEVEL = {
  easy: { depth: 2, timeMs: 300, random: 0.35 },
  medium: { depth: 4, timeMs: 900, random: 0.12 },
  hard: { depth: 6, timeMs: 1800, random: 0 },
};

// Оценка для тёмных: чем меньше своих шашек и больше чужих — тем лучше. Дамка в поддавках — обуза:
// она далеко бьёт и её трудно отдать, поэтому весит больше. Своих ходов лучше иметь поменьше.
export function evalGiveaway(board) {
  const n = countPieces(board);
  const dark = (n.dark - n.darkK) * 100 + n.darkK * 160;
  const light = (n.light - n.lightK) * 100 + n.lightK * 160;
  let score = light - dark;
  // продвинутые вперёд шашки чаще подставляются под удар — тёмным это выгодно
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const p = board[r][c];
    if (!p || p.king) continue;
    if (p.color === 'dark') score += r * 2; else score -= (7 - r) * 2;
  }
  const dm = getAllMoves(board, 'dark').length; const lm = getAllMoves(board, 'light').length;
  score += (lm - dm) * 3;
  return score;
}

function search(state, depth, alpha, beta, deadline) {
  const moves = getLegalMovesState(state.board, state.color, state.forcedPiece);
  // нет ходов у того, кто ходит, — он ВЫИГРАЛ (поддавки)
  if (!moves.length) return state.color === 'dark' ? MATE + depth : -MATE - depth;
  if (depth <= 0 || Date.now() > deadline) return evalGiveaway(state.board);
  const max = state.color === 'dark';
  let best = max ? -Infinity : Infinity;
  for (const mv of moves) {
    const s = search(applyMoveState(state, mv), depth - 1, alpha, beta, deadline);
    if (max) { if (s > best) best = s; if (s > alpha) alpha = s; } else { if (s < best) best = s; if (s < beta) beta = s; }
    if (alpha >= beta) break;
  }
  return best;
}

// gameState = { board, forcedPiece } — ход тёмных (паука). → move | null
export function chooseGiveawayMove(gameState, difficulty = 'medium', rng = Math.random) {
  const cfg = LEVEL[difficulty] || LEVEL.medium;
  const root = { board: gameState.board, color: 'dark', forcedPiece: gameState.forcedPiece || null };
  const moves = getLegalMovesState(root.board, 'dark', root.forcedPiece);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const deadline = Date.now() + cfg.timeMs;
  let scored = moves.map((mv) => ({ mv, s: search(applyMoveState(root, mv), cfg.depth - 1, -Infinity, Infinity, deadline) }));
  scored = scored.sort((a, b) => b.s - a.s);
  if (cfg.random && rng() < cfg.random && Math.abs(scored[0].s) < MATE / 2) {
    const near = scored.filter((x) => x.s >= scored[0].s - 120);
    return near[Math.floor(rng() * near.length)].mv;
  }
  return scored[0].mv;
}

// Мамин совет в поддавках: лучший ход светлых — зеркалим доску и спрашиваем тот же поиск.
export function hintGiveawayMove(state) {
  const mir = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const p = state.board[r][c];
    if (p) mir[SIZE - 1 - r][SIZE - 1 - c] = { color: p.color === 'light' ? 'dark' : 'light', king: p.king };
  }
  const fp = state.forcedPiece ? { row: SIZE - 1 - state.forcedPiece.row, col: SIZE - 1 - state.forcedPiece.col } : null;
  const m = chooseGiveawayMove({ board: mir, forcedPiece: fp }, 'medium', () => 1);
  if (!m) return null;
  const back = { fromRow: SIZE - 1 - m.fromRow, fromCol: SIZE - 1 - m.fromCol, toRow: SIZE - 1 - m.toRow, toCol: SIZE - 1 - m.toCol };
  if (m.capRow !== undefined) { back.capRow = SIZE - 1 - m.capRow; back.capCol = SIZE - 1 - m.capCol; }
  return back;
}
