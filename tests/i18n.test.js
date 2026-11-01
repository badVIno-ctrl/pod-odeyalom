import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORDS_EN, PROVERBS_EN, LEN, wordsFor, pickWord, pickProverb, wrapPhrase, createHangman, guess, status, letterFromKey } from '../src/ai/hangman.js';
import { EN_LINES } from '../src/i18n/lines.en.js';
import { I18n, tr, lineText } from '../src/i18n/index.js';
import { composeLetter, anyaLetter, letterText } from '../src/systems/letter.js';
import { GameState } from '../src/state.js';

const CYR = /[А-Яа-яЁё]/;

test('английская виселица: слова латиницей, длины по уровням, пословицы в две строки', () => {
  Object.values(WORDS_EN).flat().forEach((w) => assert.match(w, /^[A-Z]+$/));
  for (const lv of ['easy', 'medium', 'hard']) {
    const [a, b] = LEN[lv];
    const pool = wordsFor(lv, 'en');
    assert.ok(pool.length >= 15, `${lv}: слов мало`);
    pool.forEach((w) => assert.ok(w.length >= a && w.length <= b, `${w} не подходит для ${lv}`));
    assert.match(pickWord(lv, () => 0.5, [], 'en'), /^[A-Z]+$/);
    assert.ok(PROVERBS_EN[lv].includes(pickProverb(lv, () => 0.3, [], 'en')));
  }
  Object.values(PROVERBS_EN).flat().forEach((p) => {
    const lines = wrapPhrase(p, 19);
    assert.ok(lines.length <= 2, `«${p}» не влезает в две строки`);
  });
});

test('английская виселица: латиница угадывается, кириллица отклоняется, раскладка не мешает', () => {
  const s = createHangman('Apple', 'easy');
  assert.equal(s.lang, 'en');
  assert.equal(guess(s, 'a'), 'hit');
  assert.equal(guess(s, 'Б'), 'invalid');
  assert.equal(guess(s, 'Z'), 'miss');
  ['P', 'L', 'E'].forEach((c) => guess(s, c));
  assert.equal(status(s), 'win');
  const p = createHangman("WHERE THERE'S A WILL, THERE'S A WAY", 'hard', { phrase: true });
  'WHERTSAILY'.split('').forEach((c) => guess(p, c));
  assert.equal(status(p), 'win'); // апостроф, запятая и пробел не нужно угадывать
  assert.equal(letterFromKey({ key: 'q', code: 'KeyQ' }, 'en'), 'Q');
  assert.equal(letterFromKey({ key: 'й', code: 'KeyQ' }, 'en'), 'Q'); // русская раскладка
  assert.equal(letterFromKey({ key: '1', code: 'Digit1' }, 'en'), null);
});

test('все реплики переведены на английский, без кириллицы', () => {
  const data = JSON.parse(readFileSync(new URL('../data/dialogue.json', import.meta.url), 'utf8'));
  const lines = Array.isArray(data) ? data : data.lines || Object.values(data);
  assert.ok(lines.length > 200);
  for (const l of lines) {
    assert.ok(EN_LINES[l.id], `нет перевода ${l.id}`);
    assert.ok(!CYR.test(EN_LINES[l.id]), `кириллица в ${l.id}`);
  }
});

test('tr: интерфейс переводится, русский режим не трогает строки', () => {
  I18n.set('ru');
  assert.equal(tr('Играть'), 'Играть');
  I18n.set('en');
  try {
    assert.ok(!CYR.test(tr('Играть')));
    assert.equal(tr('ТИХОН'), 'TIKHON');
    assert.equal(lineText({ id: 'M01', text: 'x' }), EN_LINES.M01);
    assert.equal(tr('Hello'), 'Hello');
  } finally { I18n.set('ru'); }
});

test('письмо Тихона по-английски: без кириллицы, столько же абзацев, сколько в русском', () => {
  const games = {
    TicTacToe: [{ score: { X: 3, O: 1 }, draws: 2 }, { score: { X: 3, O: 2 } }, { rounds: 4 }],
    Gomoku: [{ moves: 14, blocks: 2 }, { moves: 9 }, {}],
    SeaBattle: [{ mines: true, spiderMine: true }, { mines: true }, { shots: 30, hits: 18 }, { shots: 60, hits: 20 }, { labels: { Потоплен: 3 } }, {}],
    Hangman: [{ word: 'СНЕГ', misses: 0 }, { word: 'SNOW', misses: 3, max: 8 }, { word: 'ТИШЕ ЕДЕШЬ', phrase: true, misses: 0 }, { word: 'X Y', phrase: true, misses: 4 }],
    Dots: [{ boy: 6, spider: 3, chain: 4, big: true }, { boy: 5, spider: 4, chain: 1 }, { boy: 2, spider: 7 }],
    Checkers: [{ kings: 2, captures: 6 }, { captures: 1 }, {}],
  };
  let n = 0;
  for (const [game, variants] of Object.entries(games)) {
    for (const v of variants) {
      for (const result of ['win', 'loss']) {
        const highlights = [{ day: 1, game, result, ...v }, { day: 2, game: 'Dots', result: 'win', boy: 6, spider: 3, chain: 2 }];
        for (const ending of ['recovered', 'tikhon', 'ambulance', 'companion', 'dawn']) {
          for (const mode of ['main', 'winter2']) {
            const st = { highlights, stats: { hints: n % 3 }, choices: [1, 0, n % 2 ? 1 : null], trust: n % 4, wins: n % 3, mode };
            const en = composeLetter(st, ending, n, 'en');
            const ru = composeLetter(st, ending, n, 'ru');
            assert.ok(!CYR.test(letterText(en)), `${game}/${result}/${ending}/${mode}: ${letterText(en)}`);
            assert.ok(CYR.test(letterText(ru)));
            assert.equal(en.paragraphs.length, ru.paragraphs.length, `${game}/${result}/${ending}/${mode}`);
            n += 1;
          }
        }
      }
    }
  }
  for (const cheats of [0, 1, 2, 5]) {
    assert.ok(!CYR.test(letterText(anyaLetter({ cheats }, 'en'))));
    assert.equal(anyaLetter({ cheats }, 'en').paragraphs.length, anyaLetter({ cheats }, 'ru').paragraphs.length);
  }
});

test('прыжок к дню во «Второй зиме» остаётся во второй зиме', () => {
  GameState.reset('medium', 'winter2');
  GameState.jumpToDay(3);
  assert.equal(GameState.mode, 'winter2');
  assert.equal(GameState.day, 3);
  GameState.reset('medium');
  assert.equal(GameState.mode, 'main');
});
