import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, chooseMove, bestMoves, freeCells } from '../src/ai/tictactoe.js';

const B = (s) => s.split('').map((c) => (c === '.' ? null : c));

test('evaluate: линия, ничья, игра продолжается', () => {
  assert.deepEqual(evaluate(B('XXX......')), { winner: 'X', line: [0, 1, 2] });
  assert.equal(evaluate(B('O...O...O')).winner, 'O');
  assert.equal(evaluate(B('XOXXOOOXX')).winner, 'draw');
  assert.equal(evaluate(B('X........')).winner, null);
});

test('лучший ход: выиграть сразу или закрыть угрозу', () => {
  assert.deepEqual(bestMoves(B('OO.XX....'), 'O'), [2]);
  assert.deepEqual(bestMoves(B('XX..O....'), 'O'), [2]);
});

test('сложный паук (всегда лучший ход) не проигрывает случайному мальчику', () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let g = 0; g < 200; g++) {
    const board = Array(9).fill(null);
    let turn = g % 2 ? 'O' : 'X';
    while (!evaluate(board).winner) {
      if (turn === 'X') { const f = freeCells(board); board[f[Math.floor(rnd() * f.length)]] = 'X'; }
      else board[chooseMove({ board, player: 'O' }, 'hard', () => 0)] = 'O'; // rng 0 → всегда лучший ход
      turn = turn === 'X' ? 'O' : 'X';
    }
    assert.notEqual(evaluate(board).winner, 'X');
  }
});

test('лёгкий паук ходит в случайную свободную клетку; на полном поле хода нет', () => {
  const board = B('XO.......');
  for (let k = 0; k < 50; k++) {
    const i = chooseMove({ board, player: 'O' }, 'easy');
    assert.ok(i >= 2 && i <= 8);
  }
  assert.equal(chooseMove({ board: B('XOXXOOOXX'), player: 'O' }, 'medium'), null);
});
