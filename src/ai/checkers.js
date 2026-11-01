// ИИ шашек — порт логики сложности из проекта пользователя online-heckers-main/index.html
// (только логика, без UI и Three.js). Правила русских шашек как в исходнике: дамка ходит и бьёт
// на любое расстояние, простая бьёт назад, взятие обязательно, превращение на последней горизонтали.
//
// Интерфейс (единый для всех ИИ):
//   chooseMove(gameState, difficulty) → move | null
//   gameState = {
//     board: 8×8, клетка — null | { color: 'light' | 'dark', king: boolean },
//     color: 'dark',        // кто ходит; ИИ (паук) играет тёмными, как в исходнике
//     moveCount: number,    // сколько ходов ИИ уже сделал (для дебютной книги на 'hard')
//     forcedPiece: { row, col } | null, // продолжение серии взятий
//   }
//   move = { fromRow, fromCol, toRow, toCol, capRow?, capCol? }
// Серию взятий сцена доигрывает через chooseFollowUpCapture(...) — как chooseBestFollowUpCapture в исходнике.
// TODO (сцена 6 — день 5): UI доски, анимации, реплики паука.
import { getDifficulty } from '../config/difficulty.js';

export const SIZE = 8;

export function createInitialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = { color: 'dark', king: false };
  for (let r = 5; r < 8; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = { color: 'light', king: false };
  return board;
}

export const cloneBoard = (board) => board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const ALL_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function getCaptureMoves(board, row, col, color, king, chainCaptures = []) {
  const enemy = color === 'light' ? 'dark' : 'light';
  const captures = [];
  for (const [dr, dc] of ALL_DIRS) {
    if (king) {
      let sr = row + dr; let sc = col + dc;
      let found = false; let fr = -1; let fc = -1;
      while (inside(sr, sc)) {
        const cell = board[sr][sc];
        if (cell) {
          if (cell.color === enemy && !chainCaptures.find((cp) => cp.row === sr && cp.col === sc)) {
            if (!found) { found = true; fr = sr; fc = sc; } else break;
          } else break;
        } else if (found) {
          captures.push({ toRow: sr, toCol: sc, capRow: fr, capCol: fc });
        }
        sr += dr; sc += dc;
      }
    } else {
      const mr = row + dr; const mc = col + dc; const lr = row + 2 * dr; const lc = col + 2 * dc;
      if (inside(lr, lc) && board[mr][mc] && board[mr][mc].color === enemy
        && !chainCaptures.find((cp) => cp.row === mr && cp.col === mc) && board[lr][lc] === null) {
        captures.push({ toRow: lr, toCol: lc, capRow: mr, capCol: mc });
      }
    }
  }
  return captures;
}

export function getSimpleMoves(board, row, col, color, king) {
  const dirs = king ? ALL_DIRS : (color === 'light' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
  const moves = [];
  for (const [dr, dc] of dirs) {
    if (king) {
      let sr = row + dr; let sc = col + dc;
      while (inside(sr, sc) && !board[sr][sc]) { moves.push({ toRow: sr, toCol: sc }); sr += dr; sc += dc; }
    } else {
      const nr = row + dr; const nc = col + dc;
      if (inside(nr, nc) && !board[nr][nc]) moves.push({ toRow: nr, toCol: nc });
    }
  }
  return moves;
}

// Взятие обязательно: если есть хоть одно — возвращаются только взятия.
export function getAllMoves(board, color) {
  const caps = []; const simple = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const pc = getCaptureMoves(board, r, c, color, p.king);
      pc.forEach((mv) => caps.push({ fromRow: r, fromCol: c, ...mv }));
      if (!pc.length) getSimpleMoves(board, r, c, color, p.king).forEach((mv) => simple.push({ fromRow: r, fromCol: c, ...mv }));
    }
  }
  return caps.length ? caps : simple;
}

export function applyMove(board, move) {
  const nb = cloneBoard(board);
  const piece = nb[move.fromRow][move.fromCol];
  nb[move.toRow][move.toCol] = piece;
  nb[move.fromRow][move.fromCol] = null;
  if (move.capRow !== undefined) nb[move.capRow][move.capCol] = null;
  if (piece.color === 'light' && move.toRow === 0) piece.king = true;
  if (piece.color === 'dark' && move.toRow === 7) piece.king = true;
  return nb;
}

export function countPieces(board) {
  let light = 0; let dark = 0; let lightK = 0; let darkK = 0;
  for (const row of board) for (const p of row) {
    if (!p) continue;
    if (p.color === 'light') { light++; if (p.king) lightK++; } else { dark++; if (p.king) darkK++; }
  }
  return { light, dark, lightK, darkK };
}

// Базовая оценка («Легко», «Стандарт»): шашка 1, дамка 1 + 2.5. Плюс — в пользу тёмных (ИИ).
export function evaluateBoard(board) {
  const n = countPieces(board);
  return (n.dark + n.darkK * 2.5) - (n.light + n.lightK * 2.5);
}

function minimax(board, depth, alpha, beta, maximizing) {
  const moves = getAllMoves(board, maximizing ? 'dark' : 'light');
  if (depth === 0 || !moves.length) return evaluateBoard(board);
  if (maximizing) {
    let best = -Infinity;
    for (const mv of moves) {
      const ev = minimax(applyMove(board, mv), depth - 1, alpha, beta, false);
      best = Math.max(best, ev); alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const mv of moves) {
    const ev = minimax(applyMove(board, mv), depth - 1, alpha, beta, true);
    best = Math.min(best, ev); beta = Math.min(beta, ev);
    if (beta <= alpha) break;
  }
  return best;
}

export function getBestMoveBasic(board, depth = 3) {
  const moves = getAllMoves(board, 'dark');
  let best = null; let bestScore = -Infinity;
  for (const mv of moves) {
    const s = minimax(applyMove(board, mv), depth - 1, -Infinity, Infinity, false);
    if (s > bestScore) { bestScore = s; best = mv; }
  }
  return best;
}

// ---------- «Сложно»: расширенная оценка, упорядочивание, quiescence, TT, итеративное углубление ----------
const DARK_TABLE = [
  [0, 4, 0, 4, 0, 4, 0, 4], [4, 0, 3, 0, 3, 0, 3, 0], [0, 3, 0, 2, 0, 2, 0, 3], [4, 0, 2, 0, 1, 0, 2, 0],
  [0, 2, 0, 1, 0, 1, 0, 2], [3, 0, 1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 0, 0, 1], [2, 0, 2, 0, 2, 0, 2, 0],
];
const LIGHT_TABLE = [
  [2, 0, 2, 0, 2, 0, 2, 0], [0, 1, 0, 0, 0, 0, 0, 1], [3, 0, 1, 0, 0, 0, 1, 0], [0, 2, 0, 1, 0, 1, 0, 2],
  [4, 0, 2, 0, 1, 0, 2, 0], [0, 3, 0, 2, 0, 2, 0, 3], [4, 0, 3, 0, 3, 0, 3, 0], [0, 4, 0, 4, 0, 4, 0, 4],
];
export const OPENING_MOVES = [
  { fromRow: 2, fromCol: 1, toRow: 3, toCol: 0 }, { fromRow: 2, fromCol: 1, toRow: 3, toCol: 2 },
  { fromRow: 2, fromCol: 3, toRow: 3, toCol: 2 }, { fromRow: 2, fromCol: 3, toRow: 3, toCol: 4 },
  { fromRow: 2, fromCol: 5, toRow: 3, toCol: 4 }, { fromRow: 2, fromCol: 5, toRow: 3, toCol: 6 },
  { fromRow: 2, fromCol: 7, toRow: 3, toCol: 6 },
];
const MATE_SCORE = 100000;

export function evaluateBoardEnhanced(board) {
  const n = countPieces(board);
  let score = (n.dark - n.light) * 120 + (n.darkK - n.lightK) * 290;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const p = board[r][c];
    if (!p) continue;
    if (p.color === 'dark') score += p.king ? 16 : DARK_TABLE[r][c] * 5 + r * 2;
    else score -= p.king ? 16 : LIGHT_TABLE[r][c] * 5 + (7 - r) * 2;
    if ((r === 3 || r === 4) && (c === 3 || c === 4)) score += p.color === 'dark' ? 8 : -8;
  }
  const dm = getAllMoves(board, 'dark'); const lm = getAllMoves(board, 'light');
  score += (dm.length - lm.length) * 5;
  score += (dm.filter((m) => m.capRow !== undefined).length - lm.filter((m) => m.capRow !== undefined).length) * 20;
  for (let c = 0; c < SIZE; c++) {
    if (board[0][c] && board[0][c].color === 'dark') score += 6;
    if (board[7][c] && board[7][c].color === 'light') score -= 6;
  }
  return score;
}

function hashState(board, color, forced) {
  let h = (color === 'dark' ? 'D' : 'L') + (forced ? `${forced.row}${forced.col}` : '__');
  for (const row of board) for (const p of row) h += !p ? '0' : p.color === 'dark' ? (p.king ? 'K' : 'd') : (p.king ? 'Q' : 'l');
  return h;
}

export function getLegalMovesState(board, color, forcedPiece = null) {
  if (forcedPiece) {
    const piece = board[forcedPiece.row] && board[forcedPiece.row][forcedPiece.col];
    if (!piece || piece.color !== color) return [];
    return getCaptureMoves(board, forcedPiece.row, forcedPiece.col, color, piece.king)
      .map((m) => ({ fromRow: forcedPiece.row, fromCol: forcedPiece.col, ...m }));
  }
  return getAllMoves(board, color);
}

export function applyMoveState(state, move) {
  const board = applyMove(state.board, move);
  let color = state.color === 'dark' ? 'light' : 'dark';
  let forcedPiece = null;
  if (move.capRow !== undefined) {
    const moved = board[move.toRow][move.toCol];
    if (getCaptureMoves(board, move.toRow, move.toCol, state.color, moved && moved.king).length) {
      color = state.color; forcedPiece = { row: move.toRow, col: move.toCol };
    }
  }
  return { board, color, forcedPiece };
}

function orderMoves(board, moves, color) {
  return moves.map((mv) => {
    let s = 0;
    if (mv.capRow !== undefined) {
      s += 260;
      const cap = board[mv.capRow] && board[mv.capRow][mv.capCol];
      if (cap && cap.king) s += 140;
    }
    const p = board[mv.fromRow] && board[mv.fromRow][mv.fromCol];
    if (p && !p.king) {
      if (p.color === 'dark' && mv.toRow === 7) s += 220;
      if (p.color === 'light' && mv.toRow === 0) s += 220;
      if (p.color === 'dark') s += DARK_TABLE[mv.toRow][mv.toCol] - DARK_TABLE[mv.fromRow][mv.fromCol];
      else s -= LIGHT_TABLE[mv.toRow][mv.toCol] - LIGHT_TABLE[mv.fromRow][mv.fromCol];
    }
    return { mv, s: color === 'light' ? -s : s };
  }).sort((a, b) => b.s - a.s).map((x) => x.mv);
}

function createSearch({ quiescenceDepth, timeLimitMs, now }) {
  const tt = new Map();
  const startedAt = now();
  const outOfTime = () => now() - startedAt > timeLimitMs;
  const terminal = (state, depth) => (state.color === 'dark' ? -MATE_SCORE + depth : MATE_SCORE - depth);

  function quiescence(state, alpha, beta, depth) {
    const max = state.color === 'dark';
    const standPat = evaluateBoardEnhanced(state.board);
    if (depth >= quiescenceDepth) return standPat;
    if (max) { if (standPat >= beta) return beta; if (standPat > alpha) alpha = standPat; } else { if (standPat <= alpha) return alpha; if (standPat < beta) beta = standPat; }
    const moves = getLegalMovesState(state.board, state.color, state.forcedPiece).filter((m) => m.capRow !== undefined);
    if (!moves.length) return standPat;
    for (const mv of orderMoves(state.board, moves, state.color)) {
      const s = quiescence(applyMoveState(state, mv), alpha, beta, depth + 1);
      if (max) { if (s > alpha) alpha = s; if (alpha >= beta) return beta; } else { if (s < beta) beta = s; if (beta <= alpha) return alpha; }
    }
    return max ? alpha : beta;
  }

  function search(state, depth, alpha, beta) {
    const a0 = alpha; const b0 = beta;
    const key = `${depth}|${hashState(state.board, state.color, state.forcedPiece)}`;
    const cached = tt.get(key);
    if (cached) {
      if (cached.flag === 'exact') return cached.score;
      if (cached.flag === 'lower' && cached.score > alpha) alpha = cached.score;
      if (cached.flag === 'upper' && cached.score < beta) beta = cached.score;
      if (alpha >= beta) return cached.score;
    }
    const moves = getLegalMovesState(state.board, state.color, state.forcedPiece);
    if (!moves.length) return terminal(state, depth);
    if (depth === 0) return quiescence(state, alpha, beta, 0);
    const max = state.color === 'dark';
    let best = max ? -Infinity : Infinity;
    for (const mv of orderMoves(state.board, moves, state.color)) {
      const s = search(applyMoveState(state, mv), depth - 1, alpha, beta);
      if (max) { if (s > best) best = s; if (s > alpha) alpha = s; } else { if (s < best) best = s; if (s < beta) beta = s; }
      if (alpha >= beta) break;
    }
    tt.set(key, { score: best, flag: best <= a0 ? 'upper' : best >= b0 ? 'lower' : 'exact' });
    return best;
  }
  return { search, outOfTime };
}

// margin > 0: на последней полностью просчитанной глубине паук выбирает случайно среди ходов,
// которые хуже лучшего не больше чем на margin (шашка = 120). Так «Средний» играет живо, а не по шаблону.
export function getBestMoveIterativeDeepening(board, {
  maxDepth = 8, timeLimitMs = 3200, quiescenceDepth = 6, now = Date.now, margin = 0, rng = Math.random,
} = {}) {
  const root = { board, color: 'dark', forcedPiece: null };
  const moves = getLegalMovesState(board, 'dark');
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const { search, outOfTime } = createSearch({ quiescenceDepth, timeLimitMs, now });
  let bestMove = moves[0];
  let scored = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (outOfTime()) break;
    let localBest = null; let localScore = -Infinity; const local = [];
    let complete = true;
    for (const mv of orderMoves(board, moves, 'dark')) {
      if (outOfTime()) { complete = false; break; }
      const s = search(applyMoveState(root, mv), depth - 1, -Infinity, Infinity);
      local.push({ mv, s });
      if (s > localScore) { localScore = s; localBest = mv; }
    }
    if (localBest) bestMove = localBest;
    if (complete) scored = local;
  }
  if (margin > 0 && scored && scored.length > 1) {
    const top = Math.max(...scored.map((x) => x.s));
    if (Math.abs(top) < MATE_SCORE / 2) {
      const near = scored.filter((x) => x.s >= top - margin);
      if (near.length > 1) return near[Math.floor(rng() * near.length)].mv;
    }
  }
  return bestMove;
}

function getOpeningMove(board) {
  const legal = getAllMoves(board, 'dark');
  for (const op of OPENING_MOVES) {
    const found = legal.find((m) => m.fromRow === op.fromRow && m.fromCol === op.fromCol && m.toRow === op.toRow && m.toCol === op.toCol);
    if (found) return found;
  }
  return null;
}

export function chooseMove(gameState, difficulty, { rng = Math.random, now = Date.now } = {}) {
  const { board, moveCount = 0, forcedPiece = null } = gameState;
  if (forcedPiece) return chooseFollowUpCapture(board, forcedPiece.row, forcedPiece.col, 'dark', difficulty);
  const cfg = getDifficulty(difficulty).checkers;
  const moves = getAllMoves(board, 'dark');
  if (!moves.length) return null;
  if (cfg.engine === 'basic') {
    if (cfg.randomMoveChance && rng() < cfg.randomMoveChance) return moves[Math.floor(rng() * moves.length)];
    return getBestMoveBasic(board, cfg.depth);
  }
  if (moveCount < (cfg.openingBookMoves || 0)) {
    const opening = getOpeningMove(board);
    if (opening) return opening;
  }
  return getBestMoveIterativeDeepening(board, {
    maxDepth: cfg.maxDepth, timeLimitMs: cfg.timeLimitMs, quiescenceDepth: cfg.quiescenceDepth, now, margin: cfg.margin || 0, rng,
  });
}

// Продолжение серии взятий той же шашкой (chooseBestFollowUpCapture в исходнике).
export function chooseFollowUpCapture(board, row, col, color, difficulty) {
  const piece = board[row] && board[row][col];
  if (!piece || piece.color !== color) return null;
  const caps = getCaptureMoves(board, row, col, color, piece.king);
  if (!caps.length) return null;
  const evalFn = getDifficulty(difficulty).checkers.engine === 'enhanced' ? evaluateBoardEnhanced : evaluateBoard;
  let best = null; let bestScore = color === 'dark' ? -Infinity : Infinity;
  for (const cap of caps) {
    const cand = { fromRow: row, fromCol: col, ...cap };
    const s = evalFn(applyMove(board, cand));
    if (color === 'dark' ? s > bestScore : s < bestScore) { bestScore = s; best = cand; }
  }
  return best;
}
