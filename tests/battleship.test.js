import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove, SHOT, N, idx, FLEET } from '../src/ai/battleship.js';

const fresh = () => ({ shots: Array(N * N).fill(SHOT.NONE), remaining: FLEET.slice() });

for (const level of ['easy', 'medium', 'hard']) {
  test(`морской бой (${level}): выстрел в нестрелянную клетку`, () => {
    const s = fresh();
    for (let k = 0; k < 60; k++) {
      const m = chooseMove(s, level);
      assert.ok(m && m.c >= 0 && m.c < N && m.r >= 0 && m.r < N);
      assert.equal(s.shots[idx(m.c, m.r)], SHOT.NONE);
      s.shots[idx(m.c, m.r)] = SHOT.MISS;
    }
  });
}

test('после попадания средний и сложный паук добивают корабль рядом', () => {
  for (const level of ['medium', 'hard']) {
    const s = fresh();
    s.shots[idx(5, 5)] = SHOT.HIT;
    const m = chooseMove(s, level, { rng: () => 0.99 });
    assert.equal(m.mode, 'target');
    assert.equal(Math.abs(m.c - 5) + Math.abs(m.r - 5), 1);
  }
});
