// Письмо Тихона по-английски: те же «памятные моменты» и тот же отбор, что в letter.js, — другой язык.
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function memoryOfEn(h) {
  const win = h.result === 'win';
  const L = h.labels || {};
  switch (h.game) {
    case 'TicTacToe': {
      const s = h.score || { X: 0, O: 0 };
      if (win && h.draws > 0) return { weight: 3 + h.draws, text: `Remember tic-tac-toe? We drew ${times(h.draws)}, and then you beat me after all. Stubborn, just like your mom.` };
      if (win) return { weight: 3, text: `You beat me at tic-tac-toe, ${s.X}:${s.O}. I spent half the night recounting the squares.` };
      return { weight: 1, text: `Tic-tac-toe went to me, but you held out for ${nOf(h.rounds || 3, 'round', 'rounds')}. For a first night, that’s a lot.` };
    }
    case 'Gomoku': {
      const mv = h.moves || 0;
      if (win && h.blocks) return { weight: 5 + h.blocks, text: `You got five in a row first, and you blocked my four ${h.blocks > 1 ? times(h.blocks) : 'just in time'}. I spent three moves weaving it, you know.` };
      if (win) return { weight: 4, text: `On the big squared sheet you lined up five crosses in ${nOf(mv, 'move', 'moves')}. I folded the sheet in four and I’m keeping it.` };
      return { weight: 1, text: 'I got five in a row first. But you covered the sheet with so many crosses that your mom said: “Now that’s a game.”' };
    }
    case 'SeaBattle': {
      const sunk = L['Потоплен'] || 0;
      if (h.mines && h.spiderMine) return { weight: 6, text: 'Remember when I stepped on your paper mine? You laughed so hard that I laughed too. Missing a turn was worth it.' };
      if (h.mines && win && !h.boyMine) return { weight: 5, text: 'In Battleship with mines you didn’t step on a single one of mine. You steered around them like a real captain.' };
      if (win && h.shots) {
        const acc = h.hits / h.shots;
        if (acc >= 0.45) return { weight: 5, text: `In Battleship you fired ${nOf(h.shots, 'shot', 'shots')} and hit ${times(h.hits)}. Only real captains shoot like that.` };
        return { weight: 3, text: 'You sank my whole paper fleet, down to the last little boat. I fished them out from under the bed afterwards.' };
      }
      if (sunk > 0) return { weight: 2, text: `I won Battleship, but you managed to sink ${sunk === 1 ? 'one of my little ships' : `${sunk} of my little ships`}. I’m still drying them on the radiator.` };
      return { weight: 1, text: 'I won Battleship, but you fired bravely. Bravery is a thread too.' };
    }
    case 'Hangman': {
      // слово из русской партии (язык переключили посреди зимы) в английском письме не цитируем
      const latin = h.word && !/[А-Яа-яЁё]/.test(h.word);
      const q = latin ? ` “${h.word[0]}${h.word.slice(1).toLowerCase()}”` : '';
      const threads = nOf(h.misses || 0, 'little thread', 'little threads');
      if (h.phrase) {
        if (win && !h.misses) return { weight: 6, text: `You guessed the proverb${q} without a single mistake. Grandmothers would be proud of you, and I even more so.` };
        if (win) return { weight: 4, text: `You guessed the proverb${q}, even though I managed to weave ${threads}. Keep it safe.` };
        return { weight: 2, text: `${latin ? `The proverb was${q}.` : 'That proverb got away from you.'} Grandmothers wove it slowly and for good, so don’t you hurry either.` };
      }
      if (win && !h.misses) return { weight: 6, text: `You guessed ${latin ? `the word${q}` : 'my word'} without a single mistake. I just threw up my paws.` };
      if (win) return { weight: 3, text: `You guessed ${latin ? `the word${q}` : 'my word'}, even though I managed to weave ${threads}.` };
      return { weight: 1, text: `${latin ? `The word was${q}.` : 'My word got away from you.'} Don’t be sad: even grown-ups don’t always guess it.` };
    }
    case 'Dots': {
      const chain = h.chain || 0;
      const boy = h.boy || 0;
      if (chain >= 3) return { weight: 4 + chain, text: `Remember when you closed ${chain} boxes in one move? I nearly fell off my web.` };
      if (win && h.big) return { weight: 4, text: `On the big five-by-five board you took ${nOf(boy, 'box', 'boxes')}, and I only got ${h.spider || 0}.` };
      if (win) return { weight: 3, text: `In dots you took ${nOf(boy, 'box', 'boxes')}, and I only got ${h.spider || 0}.` };
      return { weight: 1, text: `I took more boxes in dots. But ${boy === 1 ? 'one box is' : `${boy} boxes are`} yours forever, I won’t touch them.` };
    }
    case 'Checkers': {
      if (h.giveaway) {
        if (win) return { weight: 6, text: 'You outwitted me at giveaway: you gave away all your pieces, and I just couldn’t manage to lose. The first time in my life I tried, and it didn’t work.' };
        return { weight: 2, text: 'At giveaway I lost better than you did. Sounds strange, but you know what I mean.' };
      }
      const kings = L['Дамка'] || 0; const caps = L['Срубил'] || 0;
      if (win && kings) return { weight: 6, text: 'And your king! I still see it in my dreams, wearing a golden crown.' };
      if (win) return { weight: 4, text: `In checkers you captured ${caps === 1 ? 'one of my pieces' : `${caps} of my pieces`}. I sewed the buttons back on.` };
      if (caps) return { weight: 2, text: `Checkers went to me, but you won ${caps === 1 ? 'a button' : `${caps} buttons`} off me.` };
      return { weight: 1, text: 'Checkers went to me. But you never once gave up, and that matters more.' };
    }
    default: return { weight: 0, text: '' };
  }
}

const CLOSING_W2 = {
  dawn: 'We made it through a second winter. Come in the third one just for fun, without a fever: I’ll teach you to weave a real web.',
  ambulance: 'The hospital again… Never mind. I know the way now: I’ll guard your bed and wait, like last time.',
};

export const CLOSING_EN = {
  dawn: 'Ember is an ordinary white moth now. Let her sit on the windowsill: she doesn’t burn anymore.',
  tikhon: 'Tell little Anya I remember her too. And that two crosses at a time is still cheating.',
  ambulance: 'Hospitals have corners under the ceiling too. Get well, and I’ll guard your bed.',
  companion: 'I’m coming with you. Look up, into the corner of your ward: someone is waving a paw.',
  anya: 'Thirty winters have passed, and I remember everything. You and your son are very alike: you both cheat with a smile.',
};

export function composeLetterEn(state, ending = state.ending, seed = 0) {
  const hs = (state.highlights || []).filter((h) => h && h.game);
  const mem = hs.map((h) => ({ ...memoryOfEn(h), day: h.day })).filter((m) => m.text);
  const best = mem.slice().sort((a, b) => b.weight - a.weight || a.day - b.day).slice(0, 3).sort((a, b) => a.day - b.day);
  const paragraphs = [];
  const winter2 = state.mode === 'winter2';
  paragraphs.push(winter2
    ? 'So here’s the second winter. I’m writing to you in spider silk on the back of the calendar while you sleep.'
    : pick(['I’m writing to you in spider silk on the back of the calendar while you sleep.', 'I’m writing to you with a silver thread while your mom warms the milk.'], seed));
  for (const m of best) paragraphs.push(m.text);
  const hints = state.stats ? state.stats.hints : 0;
  const made = (state.choices || []).filter((c) => c !== null && c !== undefined).length;
  if (hints > 0 && best.length < 3) paragraphs.push(`Mom’s hint came in handy ${times(hints)}. There’s no shame in asking for help: that’s what holds any web together.`);
  if (made > 0) {
    paragraphs.push(state.trust >= Math.min(3, made)
      ? 'Thank you for talking to me kindly. Spiders don’t hear that often.'
      : 'You were a little afraid of me, and rightly so: I’m scary. But not wicked, remember?');
  }
  const closing = (winter2 && CLOSING_W2[ending]) || CLOSING_EN[ending];
  if (closing) paragraphs.push(closing);
  const ps = (state.wins || 0) > 0
    ? 'P.S. Put out some crumbs for the bullfinch. He was rooting for you.'
    : 'P.S. Don’t take off the woolen socks. That wasn’t my idea, it was your mom’s.';
  return { greeting: 'Little one!', paragraphs, sign: 'Your Tikhon', ps, ending, lang: 'en' };
}

const WORDS = { 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };

export function anyaLetterEn({ cheats = 0 } = {}) {
  const paragraphs = ['I’m writing to you in spider silk on the back of the calendar. Thirty winters ago you tore off its pages yourself, one a day.'];
  if (cheats > 1) paragraphs.push(`Remember how you put two crosses at a time? ${cheats > 2 ? `${WORDS[cheats] || cheats} times!` : 'Twice in a row!'} I saw it all. And I never said a word: you laughed so hard that Ember cooled off outside the window.`);
  else if (cheats === 1) paragraphs.push('Remember when you put two crosses at once? I saw. And I didn’t say a word: you laughed so hard that Ember cooled off outside the window.');
  else paragraphs.push('Remember how we played until morning and nobody won? You never cheated once. I’ve never woven a stronger thread than that.');
  paragraphs.push('Your drawing still hangs above the bed. It hasn’t faded, just as I promised.');
  paragraphs.push(cheats > 0 ? CLOSING_EN.anya : 'Thirty winters have passed, and I remember everything. You and your son are very alike: neither of you gives up.');
  const ps = cheats > 0 ? 'P.S. Two crosses at a time is still cheating. But funny.' : 'P.S. Don’t take off the woolen socks. That wasn’t my idea, it was your mom’s.';
  return { greeting: 'Dear Anya!', paragraphs, sign: 'Your Tikhon', ps, ending: 'anya', lang: 'en' };
}
