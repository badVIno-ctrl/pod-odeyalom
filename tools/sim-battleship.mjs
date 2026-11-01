// Баланс морского боя: node tools/sim-battleship.mjs <easy|medium|hard> [партий]. Модель ребёнка: наугад + добивание в 85% случаев.
import { chooseMove, SHOT, idx, targetCandidates, openCells } from '../src/ai/battleship.js';
import { autoPlace, createBoard, fire, allSunk } from '../src/ai/seaRules.js';

const level = process.argv[2] || 'medium';
const games = +(process.argv[3] || 300);
// модель игрока-ребёнка: случайная охота, добивание с вероятностью aim
function kidMove(board, aim = 0.85) {
  const t = targetCandidates(board); const open = openCells(board);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (t.length && Math.random() < aim) return pick(t);
  return pick(open);
}
function shotsToKill(mover) {
  const b = createBoard(autoPlace()); let n = 0;
  while (!allSunk(b) && n < 100) { const m = mover(b); fire(b, m.c, m.r); n++; }
  return n;
}
const spiderMover = (b) => chooseMove({ shots: b.shots, ships: b.ships }, level);
const st = []; for (let g = 0; g < games; g++) st.push(shotsToKill(spiderMover));
const kid = []; for (let g = 0; g < games; g++) kid.push(shotsToKill((b) => kidMove(b)));
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
// матч: монетка, попал — стреляешь ещё
let kidWins = 0;
for (let g = 0; g < games; g++) {
  const bk = createBoard(autoPlace()); const bs = createBoard(autoPlace()); // bk — поле мальчика (стреляет паук), bs — поле паука
  let turn = Math.random() < 0.5 ? 'kid' : 'spider';
  while (true) {
    if (turn === 'kid') {
      const m = kidMove(bs); const r = fire(bs, m.c, m.r);
      if (allSunk(bs)) { kidWins++; break; }
      if (r.result === 'miss') turn = 'spider';
    } else {
      const m = spiderMover(bk); const r = fire(bk, m.c, m.r);
      if (allSunk(bk)) break;
      if (r.result === 'miss') turn = 'kid';
    }
  }
}
console.log(level, 'spider avg shots', avg(st).toFixed(1), 'kid avg', avg(kid).toFixed(1), 'kid win %', (100 * kidWins / games).toFixed(1));
