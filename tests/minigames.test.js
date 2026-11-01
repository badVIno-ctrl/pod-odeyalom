import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPlace, validFleet, createBoard, fire, canPlace, shipCells, allSunk } from '../src/ai/seaRules.js';
import { chooseMove as seaMove, SHOT, idx, FLEET } from '../src/ai/battleship.js';
import { WORDS, LEN, MAX_MISSES, wordsFor, pickWord, createHangman, guess, status, revealed, hintLetter, letterFromKey } from '../src/ai/hangman.js';
import { createDots, play, isOver, winner, chooseDotsMove, freeEdges, bestMoveExact, EDGES, hEdge, vEdge } from '../src/ai/dots.js';
import { createInitialBoard, getAllMoves, applyMoveState, getLegalMovesState, chooseMove as ckMove } from '../src/ai/checkers.js';
import { DrawTracker } from '../src/ai/checkersDraw.js';

let seed = 1;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('морской бой: случайная расстановка всегда по правилам (не касаются даже углами)', () => {
  for (let k = 0; k < 200; k++) assert.ok(validFleet(autoPlace(rng)));
});

test('морской бой: нельзя ставить вплотную, по диагонали и за край', () => {
  const ships = [{ size: 2, c: 0, r: 0, horiz: true }];
  assert.equal(canPlace(ships, { size: 1, c: 2, r: 1, horiz: true }), false); // угол
  assert.equal(canPlace(ships, { size: 1, c: 3, r: 0, horiz: true }), true);
  assert.equal(canPlace(ships, { size: 4, c: 8, r: 5, horiz: true }), false); // за край
});

test('морской бой: попал/потопил/ореол/повтор', () => {
  const b = createBoard([{ size: 2, c: 4, r: 4, horiz: true }]);
  assert.equal(fire(b, 0, 0).result, 'miss');
  assert.equal(fire(b, 0, 0).result, 'repeat');
  assert.equal(fire(b, 4, 4).result, 'hit');
  const s = fire(b, 5, 4);
  assert.equal(s.result, 'sunk');
  assert.equal(s.halo.length, 10);
  assert.equal(b.shots[idx(3, 3)], SHOT.HALO);
  assert.ok(s.allSunk && allSunk(b));
});

for (const level of ['easy', 'medium', 'hard']) {
  test(`морской бой (${level}): паук добивает весь флот, не стреляя дважды`, () => {
    const b = createBoard(autoPlace(rng));
    let shots = 0;
    while (!allSunk(b) && shots < 100) {
      const m = seaMove({ shots: b.shots, ships: b.ships }, level, { rng });
      assert.equal(b.shots[idx(m.c, m.r)], SHOT.NONE);
      fire(b, m.c, m.r); shots++;
    }
    assert.ok(allSunk(b));
  });
}

test('виселица: длины слов и число ошибок по уровням', () => {
  for (const lv of ['easy', 'medium', 'hard']) {
    const [a, z] = LEN[lv];
    const ws = wordsFor(lv);
    assert.ok(ws.length >= 20, lv);
    ws.forEach((w) => assert.ok(w.length >= a && w.length <= z, w));
    assert.equal(createHangman(pickWord(lv, rng), lv).max, MAX_MISSES[lv]);
  }
  assert.deepEqual([MAX_MISSES.easy, MAX_MISSES.medium, MAX_MISSES.hard], [8, 7, 6]);
  Object.values(WORDS).flat().forEach((w) => assert.match(w, /^[А-ЯЁ]+$/));
});

test('виселица: повтор не стоит ошибки, Е=Ё, неверный ввод отклоняется', () => {
  const s = createHangman('ЁЛКА', 'easy');
  assert.equal(guess(s, 'е'), 'hit');
  assert.deepEqual(revealed(s), ['Ё', null, null, null]);
  assert.equal(guess(s, 'Ё'), 'repeat');
  assert.equal(guess(s, 'Z'), 'invalid');
  assert.equal(guess(s, '1'), 'invalid');
  assert.equal(guess(s, 'Б'), 'miss');
  assert.equal(guess(s, 'Б'), 'repeat');
  assert.equal(s.misses, 1);
  assert.equal(hintLetter(s) !== null, true);
  ['Л', 'К', 'А'].forEach((c) => guess(s, c));
  assert.equal(status(s), 'win');
  const t = createHangman('СНЕГ', 'hard');
  'АБВДЖЗ'.split('').forEach((c) => guess(t, c));
  assert.equal(status(t), 'loss');
  assert.equal(guess(t, 'С'), 'invalid'); // после конца партии ходы не принимаются
  assert.equal(letterFromKey({ key: 'f', code: 'KeyF' }), 'А');
  assert.equal(letterFromKey({ key: 'ё', code: 'Backquote' }), 'Е');
});

test('точки: замкнул клетку — ходишь ещё, двойное замыкание, конец игры без ничьей', () => {
  const st = createDots();
  // клетка (0,0): верх, лево, низ — потом право замыкает
  assert.ok(play(st, hEdge(0, 0), 'boy').ok);
  assert.equal(play(st, hEdge(0, 0), 'spider').ok, false); // занятый отрезок
  play(st, vEdge(0, 0), 'spider');
  play(st, hEdge(1, 0), 'boy');
  const r = play(st, vEdge(0, 1), 'spider');
  assert.deepEqual(r.closed, [0]);
  assert.equal(st.turn, 'spider');
  // доигрываем случайно
  while (!isOver(st)) { const e = chooseDotsMove(st, 'easy', rng); assert.ok(play(st, e, st.turn).ok); }
  assert.equal(st.score.boy + st.score.spider, 9);
  assert.ok(['boy', 'spider'].includes(winner(st)));
});

test('точки: средний паук забирает готовую клетку и не отдаёт третью сторону', () => {
  const st = createDots(); st.turn = 'spider';
  [hEdge(0, 0), vEdge(0, 0), hEdge(1, 0)].forEach((e) => { st.edges[e] = 'boy'; });
  assert.equal(chooseDotsMove(st, 'medium', rng), vEdge(0, 1));
  const st2 = createDots(); st2.turn = 'spider';
  [hEdge(0, 0), vEdge(0, 0)].forEach((e) => { st2.edges[e] = 'boy'; });
  for (let k = 0; k < 30; k++) { const e = chooseDotsMove(st2, 'medium', rng); assert.ok(![hEdge(1, 0), vEdge(0, 1)].includes(e)); }
});

test('точки: сложный паук (точный перебор) не хуже среднего', () => {
  let hardWins = 0;
  for (let g = 0; g < 6; g++) {
    const st = createDots();
    while (!isOver(st)) {
      const lv = st.turn === 'spider' ? 'hard' : 'medium';
      play(st, chooseDotsMove(st, lv, rng), st.turn);
    }
    if (winner(st) === 'spider') hardWins++;
  }
  assert.ok(hardWins >= 4, `hard won ${hardWins}/6`);
});

test('шашки: обязательное взятие и ход только своей шашкой', () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[5][2] = { color: 'light', king: false }; b[4][3] = { color: 'dark', king: false }; b[5][6] = { color: 'light', king: false };
  const moves = getAllMoves(b, 'light');
  assert.ok(moves.length > 0 && moves.every((m) => m.capRow !== undefined));
  assert.equal(getLegalMovesState(b, 'light', { row: 5, col: 6 }).length, 0);
});

test('шашки: серия взятий продолжается той же шашкой', () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[6][1] = { color: 'light', king: false }; b[5][2] = { color: 'dark', king: false }; b[3][4] = { color: 'dark', king: false };
  const mv = getAllMoves(b, 'light')[0];
  const st = applyMoveState({ board: b, color: 'light', forcedPiece: null }, mv);
  assert.equal(st.color, 'light');
  assert.deepEqual(st.forcedPiece, { row: 4, col: 3 });
});

test('шашки: ничья повторением и «только дамки 15 ходов»', () => {
  const b = createInitialBoard();
  const t = new DrawTracker();
  assert.equal(t.push(b, 'dark'), null);
  assert.equal(t.push(b, 'dark'), null);
  assert.equal(t.push(b, 'dark'), 'repetition');
  const t2 = new DrawTracker();
  let res = null;
  for (let i = 0; i < 30 && !res; i++) { const bb = createInitialBoard(); bb[0][i % 8 === 0 ? 1 : 1] = null; bb[7][0] = { color: 'light', king: true, i }; res = t2.push(bb.map((r, ri) => r.map((c, ci) => (ri === 3 && ci === (i % 4) * 2 + 1 ? { color: 'dark', king: true } : c))), i % 2 ? 'dark' : 'light'); if (res === 'repetition') res = null; }
  assert.equal(t2.quiet, 30);
});

for (const level of ['easy', 'medium']) {
  test(`шашки (${level}): ИИ делает только легальные ходы до конца партии`, () => {
    let st = { board: createInitialBoard(), color: 'light', forcedPiece: null };
    let plies = 0; let aiMoves = 0;
    while (plies < 300) {
      const legal = getLegalMovesState(st.board, st.color, st.forcedPiece);
      if (!legal.length) break;
      let mv;
      if (st.color === 'dark') { mv = ckMove({ board: st.board, color: 'dark', moveCount: aiMoves, forcedPiece: st.forcedPiece }, level, { rng }); aiMoves++; } else mv = legal[Math.floor(rng() * legal.length)];
      assert.ok(legal.some((m) => m.fromRow === mv.fromRow && m.fromCol === mv.fromCol && m.toRow === mv.toRow && m.toCol === mv.toCol));
      st = applyMoveState(st, mv); plies++;
    }
    assert.ok(plies > 10);
  });
}
