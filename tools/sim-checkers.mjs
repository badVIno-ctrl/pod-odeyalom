// Баланс шашек: node tools/sim-checkers.mjs <партий> '<конфиг паука JSON>' '<конфиг игрока JSON>'. Игрок — светлые, ИИ через зеркальную доску.
import * as CK from '../src/ai/checkers.js';
import { DrawTracker } from '../src/ai/checkersDraw.js';
import { DIFFICULTY } from '../src/config/difficulty.js';
const { createInitialBoard, getLegalMovesState, applyMoveState, chooseMove, countPieces } = CK;
const mirrorBoard = (b) => b.map((row, r) => row.map((_, c) => { const p = b[7 - r][7 - c]; return p ? { color: p.color === 'dark' ? 'light' : 'dark', king: p.king } : null; }));
const mirrorMove = (m) => m && ({ fromRow: 7 - m.fromRow, fromCol: 7 - m.fromCol, toRow: 7 - m.toRow, toCol: 7 - m.toCol, ...(m.capRow !== undefined ? { capRow: 7 - m.capRow, capCol: 7 - m.capCol } : {}) });
const mirrorSq = (s) => s && ({ row: 7 - s.row, col: 7 - s.col });
// конфиг для «мальчика» (светлые) — через временный уровень 'kid'
const games = +(process.argv[2] || 20);
const spiderCfg = JSON.parse(process.argv[3]);
const kidCfg = JSON.parse(process.argv[4]);
DIFFICULTY.spider = { ...DIFFICULTY.medium, checkers: spiderCfg };
DIFFICULTY.kid = { ...DIFFICULTY.medium, checkers: kidCfg };
let res = { spider: 0, kid: 0, draw: 0 }; let plies = []; let tSpider = []; let maxT = 0;
for (let g = 0; g < games; g++) {
  let state = { board: createInitialBoard(), color: 'light', forcedPiece: null };
  const dt = new DrawTracker(); let spiderMoves = 0; let kidMoves = 0; let outcome = null; let n = 0;
  while (!outcome) {
    const legal = getLegalMovesState(state.board, state.color, state.forcedPiece);
    if (!legal.length) { outcome = state.color === 'dark' ? 'kid' : 'spider'; break; }
    let mv;
    if (state.color === 'dark') {
      const t0 = performance.now();
      mv = chooseMove({ board: state.board, color: 'dark', moveCount: spiderMoves, forcedPiece: state.forcedPiece }, 'spider');
      const dtm = performance.now() - t0; if (!state.forcedPiece) { tSpider.push(dtm); maxT = Math.max(maxT, dtm); }
      if (!state.forcedPiece) spiderMoves++;
    } else {
      mv = mirrorMove(chooseMove({ board: mirrorBoard(state.board), color: 'dark', moveCount: kidMoves, forcedPiece: mirrorSq(state.forcedPiece) }, 'kid'));
      if (!state.forcedPiece) kidMoves++;
    }
    if (!mv) { outcome = state.color === 'dark' ? 'kid' : 'spider'; break; }
    const piece = state.board[mv.fromRow][mv.fromCol];
    const next = applyMoveState(state, mv); n++;
    if (next.color !== state.color) {
      const d = dt.push(next.board, next.color, { capture: mv.capRow !== undefined, manMoved: piece && !piece.king });
      if (d) { outcome = 'draw'; }
    }
    state = next;
  }
  res[outcome]++; plies.push(n);
}
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(JSON.stringify(spiderCfg), 'vs', JSON.stringify(kidCfg), res, 'avg plies', avg(plies).toFixed(0), 'spider ms avg', avg(tSpider).toFixed(0), 'max', maxT.toFixed(0));
