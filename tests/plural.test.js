import test from 'node:test';
import assert from 'node:assert/strict';
import { plural, count } from '../src/systems/plural.js';

test('числительные: буква / буквы / букв', () => {
  const f = (n) => plural(n, 'буква', 'буквы', 'букв');
  assert.equal(f(1), 'буква');
  assert.equal(f(4), 'буквы');
  assert.equal(f(5), 'букв');
  assert.equal(f(7), 'букв');
  assert.equal(f(11), 'букв');
  assert.equal(f(12), 'букв');
  assert.equal(f(21), 'буква');
  assert.equal(f(22), 'буквы');
  assert.equal(count(6, 'буква', 'буквы', 'букв'), '6 букв');
  assert.equal(count(3, 'раз', 'раза', 'раз'), '3 раза');
});
