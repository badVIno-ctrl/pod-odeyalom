import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, boyKeyForTemp, roomStateFor, formatTemp } from '../src/state.js';

test('новая игра: 38,7°, средняя сложность, дни не сыграны', () => {
  GameState.reset('medium');
  assert.equal(GameState.temp, 38.7);
  assert.equal(GameState.difficulty, 'medium');
  assert.deepEqual(GameState.dayResults, [null, null, null, null, null]);
  assert.equal(GameState.wins + GameState.losses, 0);
  assert.equal(GameState.finished, false);
});

test('победа −0,7°, поражение +0,5°', () => {
  GameState.reset();
  GameState.recordDay('win', 1);
  assert.equal(GameState.temp, 38.0);
  GameState.reset();
  GameState.recordDay('loss', 1);
  assert.equal(GameState.temp, 39.2);
  assert.equal(GameState.roomState(), 'B');
});

test('повторная запись того же дня не меняет счёт', () => {
  GameState.reset();
  GameState.recordDay('win', 1);
  GameState.recordDay('win', 1);
  assert.equal(GameState.wins, 1);
});

test('три победы — выздоровел, три поражения — больница', () => {
  GameState.reset();
  ['win', 'loss', 'win', 'loss'].forEach((r, i) => assert.equal(GameState.recordDay(r, i + 1), null));
  assert.equal(GameState.recordDay('win', 5), 'recovered');
  GameState.reset();
  ['loss', 'win', 'loss'].forEach((r, i) => GameState.recordDay(r, i + 1));
  assert.equal(GameState.recordDay('loss', 4), 'hospital');
});

test('спрайт мальчика по температуре (границы включительно)', () => {
  assert.equal(boyKeyForTemp(37.5), 'boy_bed_healthy');
  assert.equal(boyKeyForTemp(37.6), 'boy_bed_sick');
  assert.equal(boyKeyForTemp(38.9), 'boy_bed_sick');
  assert.equal(boyKeyForTemp(39.0), 'boy_bed_very_sick');
  assert.equal(boyKeyForTemp(39.7), 'boy_bed_very_sick');
  assert.equal(boyKeyForTemp(39.8), 'boy_bed_critical');
});

test('состояние комнаты A/B/C и формат температуры', () => {
  assert.equal(roomStateFor(0), 'A');
  assert.equal(roomStateFor(1), 'B');
  assert.equal(roomStateFor(2), 'C');
  assert.equal(formatTemp(38), '38,0°');
  assert.equal(formatTemp(39.2), '39,2°');
});

test('события по общему счёту побед и поражений', async () => {
  const { eventFor, wellbeingFor } = await import('../src/state.js');
  GameState.reset();
  const seq = ['win', 'loss', 'win', 'loss'];
  const ev = seq.map((r, i) => { GameState.recordDay(r, i + 1); return GameState.lastEvent; });
  assert.deepEqual(ev, ['win1', 'loss1', 'win2', 'loss2']);
  assert.equal(GameState.day, 1); // recordDay не двигает день
  assert.equal(GameState.outcome(), null); // W,L,W,L → игра доходит до 5-го дня
  GameState.recordDay('loss', 5);
  assert.equal(GameState.lastEvent, 'loss3');
  assert.equal(GameState.outcome(), 'hospital');
  assert.equal(eventFor('win', 3, 0), 'win3');
  assert.equal(wellbeingFor(38.7).label, 'Нехорошо');
  assert.equal(wellbeingFor(36.6).label, 'Почти здоров');
  assert.equal(wellbeingFor(40.2).label, 'Очень плохо');
});

test('три победы подряд заканчивают игру на 3-м дне, награды по счёту побед', () => {
  GameState.reset();
  assert.equal(GameState.recordDay('win', 1), null);
  assert.equal(GameState.recordDay('win', 2), null);
  assert.equal(GameState.recordDay('win', 3), 'recovered');
  assert.equal(GameState.temp, 36.6);
  GameState.reset();
  ['loss', 'loss'].forEach((r, i) => GameState.recordDay(r, i + 1));
  assert.equal(GameState.recordDay('loss', 3), 'hospital');
  assert.equal(GameState.temp, 40.2);
  assert.equal(GameState.spiderPower(), 3);
});

test('смелость и подсказка', () => {
  GameState.reset();
  assert.equal(GameState.canHint(), false);
  GameState.addCourage(60); GameState.addCourage(60);
  assert.equal(GameState.courage, 100);
  assert.equal(GameState.spendHint(), true);
  assert.equal(GameState.courage, 0);
  assert.equal(GameState.spendHint(), false);
});

// Строгие сценарии из ТЗ: считаются итоги, а не серии; финал наступает сразу после третьей победы/поражения.
const SCENARIOS = [
  { seq: 'WWW', outcome: 'recovered', day: 3, events: ['win1', 'win2', 'win3'] },
  { seq: 'WLWLW', outcome: 'recovered', day: 5, events: ['win1', 'loss1', 'win2', 'loss2', 'win3'] },
  { seq: 'LLL', outcome: 'hospital', day: 3, events: ['loss1', 'loss2', 'loss3'] },
  { seq: 'LWLWL', outcome: 'hospital', day: 5, events: ['loss1', 'win1', 'loss2', 'win2', 'loss3'] },
];
for (const sc of SCENARIOS) {
  test(`сценарий ${sc.seq}: ${sc.outcome} на ${sc.day}-м дне`, () => {
    GameState.reset('medium');
    const events = [];
    let out = null; let day = 0;
    for (const ch of sc.seq) {
      day += 1;
      assert.equal(out, null, 'после финала дни не играются');
      out = GameState.recordDay(ch === 'W' ? 'win' : 'loss', day);
      events.push(GameState.lastEvent);
    }
    assert.equal(out, sc.outcome);
    assert.equal(day, sc.day);
    assert.deepEqual(events, sc.events);
    // отметки дней: сыгранные заполнены, остальные пустые
    assert.deepEqual(GameState.dayResults.map((r) => (r ? r[0].toUpperCase() : '-')).join(''), (sc.seq.replace(/W/g, 'W').replace(/L/g, 'L') + '-----').slice(0, 5));
    // лишний результат после финала не засчитывается
    GameState.recordDay('win', Math.min(5, day + 1));
    assert.equal(GameState.wins + GameState.losses, sc.seq.length);
  });
}

test('выбор реплики засчитывается один раз за день, доверие и секреты', () => {
  GameState.reset();
  assert.equal(GameState.choose(1, 0, { secret: 'ogonek' }), true);
  assert.equal(GameState.choose(1, 1, { secret: 'strashny' }), false);
  assert.equal(GameState.trust, 1);
  assert.deepEqual(GameState.secrets, ['ogonek']);
  assert.equal(GameState.choose(2, 1, { secret: 'domovoy' }), true);
  assert.equal(GameState.trust, 1);
  assert.equal(GameState.choicesMade(), 2);
});

test('вариант финала: добрый мальчик открывает тайные финалы', () => {
  GameState.reset();
  ['win', 'win', 'win'].forEach((r, i) => { GameState.choose(i + 1, 0); GameState.recordDay(r, i + 1); });
  assert.equal(GameState.endingVariant(), 'tikhon');
  GameState.reset();
  ['win', 'win', 'win'].forEach((r, i) => { GameState.choose(i + 1, 1); GameState.recordDay(r, i + 1); });
  assert.equal(GameState.endingVariant(), 'dawn');
  GameState.reset();
  ['loss', 'loss', 'loss'].forEach((r, i) => { GameState.choose(i + 1, 0); GameState.recordDay(r, i + 1); });
  assert.equal(GameState.endingVariant(), 'companion');
  GameState.reset();
  ['loss', 'loss', 'loss'].forEach((r, i) => GameState.recordDay(r, i + 1));
  assert.equal(GameState.endingVariant(), 'ambulance');
});

test('финал засчитывается ровно один раз', () => {
  GameState.reset();
  ['win', 'win', 'win'].forEach((r, i) => GameState.recordDay(r, i + 1));
  assert.equal(GameState.finish(), true);
  assert.equal(GameState.finish(), false);
  assert.equal(GameState.ending, 'dawn');
  GameState.reset();
  assert.equal(GameState.finished, false);
  assert.equal(GameState.ending, null);
});

test('сброс сохраняет сложность, обнуляет счёт и отметки', () => {
  GameState.reset('hard');
  ['loss', 'win'].forEach((r, i) => GameState.recordDay(r, i + 1));
  GameState.addCourage(50);
  GameState.reset();
  assert.equal(GameState.difficulty, 'hard');
  assert.deepEqual(GameState.dayResults, [null, null, null, null, null]);
  assert.equal(GameState.courage, 0);
  assert.equal(GameState.day, 1);
});

test('дневник: секрет открывается один раз, финал увеличивает число забегов', async () => {
  const { Journal, SECRETS, ENDINGS } = await import('../src/systems/journal.js');
  Journal.clear();
  assert.equal(Journal.unlock('ogonek'), true);
  assert.equal(Journal.unlock('ogonek'), false);
  assert.equal(Journal.unlock('nope'), false);
  assert.equal(Journal.recordEnding('dawn'), true);
  assert.equal(Journal.recordEnding('dawn'), false);
  assert.equal(Journal.recordEnding('nope'), false);
  const c = Journal.counts();
  assert.equal(c.secrets, 1); assert.equal(c.secretsTotal, SECRETS.length);
  assert.equal(c.endings, 1); assert.equal(c.endingsTotal, ENDINGS.length);
  assert.equal(c.runs, 2);
  assert.equal(Journal.lastGroup(), 'recovered');
  Journal.clear();
});

test('отладочный переход к дню N засчитывает прошлые дни по очереди и не ломает финал', () => {
  GameState.reset();
  GameState.jumpToDay(5);
  assert.equal(GameState.day, 5);
  assert.deepEqual(GameState.dayResults.slice(0, 4), ['win', 'loss', 'win', 'loss']);
  assert.equal(GameState.wins, 2); assert.equal(GameState.losses, 2);
  assert.equal(GameState.recordDay('loss'), 'hospital');
  GameState.jumpToDay(1);
  assert.equal(GameState.wins + GameState.losses, 0);
  assert.equal(GameState.day, 1);
});
