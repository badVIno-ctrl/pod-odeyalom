import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialBoard, getAllMoves, chooseMove, applyMove, countPieces } from '../src/ai/checkers.js';

const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
const fakeClock = () => { let t = 0; return () => (t += 50); };

test('начальная позиция: по 12 шашек, у тёмных 7 ходов', () => {
  const b = createInitialBoard();
  const c = countPieces(b);
  assert.equal(c.dark + (c.darkKings || 0), 12);
  assert.equal(c.light + (c.lightKings || 0), 12);
  assert.equal(getAllMoves(b, 'dark').length, 7);
});

test('взятие обязательно', () => {
  const b = empty();
  b[2][1] = { color: 'dark', king: false };
  b[3][2] = { color: 'light', king: false };
  b[0][7] = { color: 'dark', king: false };
  const moves = getAllMoves(b, 'dark');
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.capRow !== undefined));
  assert.deepEqual(moves.map((m) => [m.toRow, m.toCol]), [[4, 3]]);
});

for (const level of ['easy', 'medium', 'hard']) {
  test(`паук (${level}) возвращает допустимый ход`, () => {
    const b = createInitialBoard();
    const legal = getAllMoves(b, 'dark');
    const m = chooseMove({ board: b, color: 'dark', moveCount: 10 }, level, { rng: () => 0.9, now: fakeClock() });
    assert.ok(m, 'ход найден');
    assert.ok(legal.some((l) => l.fromRow === m.fromRow && l.fromCol === m.fromCol && l.toRow === m.toRow && l.toCol === m.toCol));
    const after = applyMove(b, m);
    assert.equal(after[m.toRow][m.toCol].color, 'dark');
  });
}
