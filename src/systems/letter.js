// Письмо Тихона в финале. Собирается из «памятных моментов» забега (GameState.highlights — по одному
// на сыгранный день, см. MiniGameBase.finish) и варианта финала. Текст — по-русски, с правильными
// числительными (plural.js). Возвращает { greeting, paragraphs, sign, ps } — абзацы короткие, 1–2 фразы.
import { count, plural } from './plural.js';
import { I18n } from '../i18n/index.js';
import { composeLetterEn, anyaLetterEn } from './letter.en.js';

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

// Одна фраза о дне. Возвращает { text, weight } — чем ярче момент, тем больше вес (в письмо идут 3 лучших).
export function memoryOf(h, seed = 0) {
  const win = h.result === 'win';
  const L = h.labels || {};
  switch (h.game) {
    case 'TicTacToe': {
      const s = h.score || { X: 0, O: 0 };
      if (win && h.draws > 0) return { weight: 3 + h.draws, text: `Помнишь крестики-нолики? Мы ${count(h.draws, 'раз', 'раза', 'раз')} сыграли вничью, а потом ты меня всё-таки обыграл. Упрямый, весь в маму.` };
      if (win) return { weight: 3, text: `В крестики-нолики ты обыграл меня ${s.X}:${s.O}. Я потом полночи пересчитывал клеточки.` };
      return { weight: 1, text: `Крестики-нолики остались за мной, но ты продержался ${count(h.rounds || 3, 'раунд', 'раунда', 'раундов')}. Для первой ночи это очень много.` };
    }
    case 'Gomoku': {
      const mv = h.moves || 0;
      if (win && h.blocks) return { weight: 5 + h.blocks, text: `Пять в ряд ты поставил первым, а мою четвёрку закрыл ${h.blocks > 1 ? count(h.blocks, 'раз', 'раза', 'раз') : 'вовремя'}. Я её плёл три хода, между прочим.` };
      if (win) return { weight: 4, text: `На большом листе в клетку ты выстроил пять крестиков в ряд за ${count(mv, 'ход', 'хода', 'ходов')}. Лист я сложил вчетверо и храню.` };
      return { weight: 1, text: 'Пять в ряд первым поставил я. Но лист ты исчеркал так, что мама сказала: «Вот это партия».' };
    }
    case 'SeaBattle': {
      const sunk = L['Потоплен'] || 0;
      if (h.mines && h.spiderMine) return { weight: 6, text: 'А помнишь, как я наступил на твою бумажную мину? Ты так хохотал, что я тоже засмеялся. Пропустить ход было не жалко.' };
      if (h.mines && win && !h.boyMine) return { weight: 5, text: 'В морском бою с минами ты не наступил ни на одну мою мину. Обходил их, как настоящий капитан.' };
      if (win && h.shots) {
        const acc = h.hits / h.shots;
        if (acc >= 0.45) return { weight: 5, text: `В морском бою ты выстрелил ${count(h.shots, 'раз', 'раза', 'раз')} и попал ${count(h.hits, 'раз', 'раза', 'раз')}. Так стреляют только настоящие капитаны.` };
        return { weight: 3, text: `Мой бумажный флот ты потопил весь, до последней лодочки. Я их потом вылавливал из-под кровати.` };
      }
      if (sunk > 0) return { weight: 2, text: `Морской бой я выиграл, но ты успел потопить ${count(sunk, 'мой кораблик', 'моих кораблика', 'моих корабликов')}. Я их до сих пор сушу на батарее.` };
      return { weight: 1, text: 'Морской бой я выиграл, но стрелял ты смело. Смелость — тоже нить.' };
    }
    case 'Hangman': {
      const w = h.word ? `«${h.word[0]}${h.word.slice(1).toLowerCase()}»` : 'моё';
      if (h.phrase) {
        if (win && !h.misses) return { weight: 6, text: `Пословицу ${w} ты угадал без единой ошибки. Бабушки бы тобой гордились, а я — тем более.` };
        if (win) return { weight: 4, text: `Пословицу ${w} ты угадал, хотя я успел сплести ${count(h.misses, 'ниточку', 'ниточки', 'ниточек')}. Береги её.` };
        return { weight: 2, text: `Пословица была ${w}. Её бабушки плели долго и насовсем, вот и ты не торопись.` };
      }
      if (win && !h.misses) return { weight: 6, text: `Слово ${w} ты угадал без единой ошибки. Я даже лапами развёл.` };
      if (win) return { weight: 3, text: `Слово ${w} ты угадал, хотя я успел сплести ${count(h.misses, 'ниточку', 'ниточки', 'ниточек')}.` };
      return { weight: 1, text: `Слово было ${w}. Не грусти: его и взрослые не всегда угадывают.` };
    }
    case 'Dots': {
      const chain = h.chain || 0;
      if (chain >= 3) return { weight: 4 + chain, text: `А помнишь, как ты закрыл ${count(chain, 'клетку', 'клетки', 'клеток')} за один ход? Я чуть с паутины не упал.` };
      if (win && h.big) return { weight: 4, text: `На большом поле, пять на пять, ты захватил ${count(h.boy || 0, 'клетку', 'клетки', 'клеток')}, а мне досталось только ${h.spider || 0}.` };
      if (win) return { weight: 3, text: `В точках ты захватил ${count(h.boy || 0, 'клетку', 'клетки', 'клеток')}, а мне досталось только ${h.spider || 0}.` };
      return { weight: 1, text: `В точках я захватил больше. Но ${count(h.boy || 0, 'клетка', 'клетки', 'клеток')} навсегда твои, я их не трогаю.` };
    }
    case 'Checkers': {
      if (h.giveaway) {
        if (win) return { weight: 6, text: 'В поддавки ты меня перехитрил: отдал все шашки, а я так и не сумел проиграть. Первый раз в жизни старался — и не вышло.' };
        return { weight: 2, text: 'В поддавках я проиграл лучше тебя. Звучит странно, но ты меня понял.' };
      }
      const kings = L['Дамка'] || 0; const caps = L['Срубил'] || 0;
      if (win && kings) return { weight: 6, text: 'А твоя дамка! Я её до сих пор вижу во сне, в золотой короне.' };
      if (win) return { weight: 4, text: `В шашки ты срубил ${caps} ${plural(caps, 'мою шашку', 'мои шашки', 'моих шашек')}. Пуговицы я пришил обратно.` };
      if (caps) return { weight: 2, text: `Шашки остались за мной, но ${count(caps, 'пуговицу', 'пуговицы', 'пуговиц')} ты у меня отвоевал.` };
      return { weight: 1, text: 'Шашки остались за мной. Но ты ни разу не сдался, а это важнее.' };
    }
    default: return { weight: 0, text: '' };
  }
}

// «Вторая зима»: свои концовки письма для рассвета и скорой.
const CLOSING_W2 = {
  dawn: 'Вторую зиму перезимовали. В третью приходи просто так, без жара: научу тебя плести настоящую паутинку.',
  ambulance: 'Опять в больницу… Ничего. Я теперь знаю дорогу: посторожу кровать и буду ждать, как в прошлый раз.',
};

const CLOSING = {
  dawn: 'Огнёвка теперь обычная белая бабочка. Пусть посидит на подоконнике: она больше не жжётся.',
  tikhon: 'Передай Анечке, что я её тоже помню. И что два крестика за раз — это всё-таки нечестно.',
  ambulance: 'В больнице тоже бывают уголки под потолком. Выздоравливай, а твою кровать я посторожу.',
  companion: 'Я еду с тобой. Посмотри наверх, в уголок палаты: там кто-то машет лапой.',
  anya: 'Тридцать зим прошло, а я всё помню. Вы с сыном очень похожи — оба жульничаете с улыбкой.',
};

// state — снимок GameState (highlights, stats, trust, choices, wins, ending). Детерминировано по seed.
// lang — язык письма (по умолчанию — язык интерфейса); английский текст собирает letter.en.js.
export function composeLetter(state, ending = state.ending, seed = 0, lang = I18n.lang) {
  if (lang === 'en') return composeLetterEn(state, ending, seed);
  const hs = (state.highlights || []).filter((h) => h && h.game);
  const mem = hs.map((h, i) => ({ ...memoryOf(h, seed + i), day: h.day })).filter((m) => m.text);
  const best = mem.slice().sort((a, b) => b.weight - a.weight || a.day - b.day).slice(0, 3).sort((a, b) => a.day - b.day);
  const paragraphs = [];
  const winter2 = state.mode === 'winter2';
  paragraphs.push(winter2
    ? 'Вот и вторая зима. Пишу тебе паутинкой на обороте календаря, пока ты спишь.'
    : pick(['Пишу тебе паутинкой на обороте календаря, пока ты спишь.', 'Пишу тебе серебряной ниткой, пока мама греет молоко.'], seed));
  for (const m of best) paragraphs.push(m.text);
  const hints = state.stats ? state.stats.hints : 0;
  const made = (state.choices || []).filter((c) => c !== null && c !== undefined).length;
  if (hints > 0 && best.length < 3) paragraphs.push(`Мамина подсказка пригодилась ${count(hints, 'раз', 'раза', 'раз')}. Просить помощи не стыдно, на этом держится любая сеть.`);
  if (made > 0) {
    paragraphs.push(state.trust >= Math.min(3, made)
      ? 'Спасибо, что разговаривал со мной по-доброму. Пауки такое слышат нечасто.'
      : 'Ты меня побаивался, и правильно: я страшный. Но не злой, помнишь?');
  }
  const closing = (winter2 && CLOSING_W2[ending]) || CLOSING[ending];
  if (closing) paragraphs.push(closing);
  const ps = (state.wins || 0) > 0
    ? 'P.S. Снегирю насыпь крошек. Он за тебя болел.'
    : 'P.S. Шерстяные носки не снимай. Это не я придумал, это мама.';
  return { greeting: 'Малыш!', paragraphs, sign: 'Твой Тихон', ps, ending };
}

// Письмо из тайной главы «Аня»: Тихон пишет маме мальчика — про ту зиму, когда ей было семь.
// cheats — сколько раз Аня ставила лишний крестик, пока Тихон «не смотрел».
const WORDS = { 3: 'три', 4: 'четыре', 5: 'пять', 6: 'шесть', 7: 'семь', 8: 'восемь', 9: 'девять' };

export function anyaLetter({ cheats = 0 } = {}, lang = I18n.lang) {
  if (lang === 'en') return anyaLetterEn({ cheats });
  const paragraphs = ['Пишу тебе паутинкой на обороте календаря. Тридцать зим назад ты сама его отрывала, по листку в день.'];
  if (cheats > 1) paragraphs.push(`Помнишь, как ты ставила по два крестика за раз? ${cheats > 2 ? 'Целых ' + (WORDS[cheats] ? WORDS[cheats] + ' ' + plural(cheats, 'раз', 'раза', 'раз') : count(cheats, 'раз', 'раза', 'раз')) + '!' : 'Два раза подряд!'} Я всё видел. И ни разу не сказал: ты так смеялась, что Огнёвка за окном остывала.`);
  else if (cheats === 1) paragraphs.push('Помнишь, как ты поставила два крестика за раз? Я видел. И не сказал: ты так смеялась, что Огнёвка за окном остывала.');
  else paragraphs.push('Помнишь, как мы играли до самого утра, и никто так и не выиграл? Ты ни разу не схитрила. Крепче той нити я ничего не плёл.');
  paragraphs.push('Твой рисунок до сих пор висит над кроватью. Не выцвел — я же обещал.');
  paragraphs.push(cheats > 0 ? CLOSING.anya : 'Тридцать зим прошло, а я всё помню. Вы с сыном очень похожи — оба не сдаётесь.');
  const ps = cheats > 0 ? 'P.S. Два крестика за раз — это всё-таки нечестно. Но смешно.' : 'P.S. Шерстяные носки не снимай. Это не я придумал, это твоя мама.';
  return { greeting: 'Анечка!', paragraphs, sign: 'Твой Тихон', ps, ending: 'anya' };
}

// Письмо одной строкой (для журнала и тестов).
export const letterText = (l) => [l.greeting, ...l.paragraphs, l.sign, l.ps].join('\n');
