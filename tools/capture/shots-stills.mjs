// Скриншоты для itch.io (1920×1080, WebGL) + исходник обложки + короткий ролик для GIF.
// node capture.mjs <out> ./shots-stills.mjs "debug=1&lang=ru"
export default async ({ page, ev, ff, wait, still, rec, press, logs }) => {
  const heard = (id) => ev((id) => window.__voiceLog.some((v) => v.src.endsWith('/' + id + '.mp3')), id);
  const untilVoice = (id, sec = 90) => ff((id) => window.__voiceLog.some((v) => v.src.endsWith('/' + id + '.mp3')), sec, id);
  const active = (k) => ff((k) => window.__game.scene.isActive(k), 60, k);
  const sc = (k) => `window.__game.scene.getScene('${k}')`;
  const step = async (name, fn) => { try { await fn(); } catch (e) { logs.push(`[stills ${name}] ${e.stack}`); } };
  // ответы Тихону и выбор — первой репликой; партия — дебаг-победой
  const answer = async () => { if (await ff(() => !!(window.__bedroom && window.__bedroom.choice), 90)) { await wait(0.8); await press('Digit1'); } };

  await step('menu', async () => { await wait(1.5); await still('01_menu'); });

  await step('prologue', async () => {
    await ev(() => window.__menu.startGame());
    await untilVoice('B01'); await wait(1.2); await still('02_road');
    await untilVoice('M03'); await wait(0.9); await still('03_porch');
  });

  await step('day1', async () => {
    await press('Digit1');
    await untilVoice('M05'); await wait(2.2); await still('04_morning');
    await ff(() => window.__bedroom && window.__bedroom.phase === 'talk', 90);
    await rec('gif_descent', 6.5);
    await wait(0.3); await still('cover_src', { hideSubs: true });
    await still('05_tikhon');
    await answer(); await wait(0.3);
    await active('TicTacToe');
    const board = () => ev(() => { const s = window.__game.scene.getScene('TicTacToe'); return { turn: s.turn, busy: s.busy, board: s.board.slice() }; });
    for (const i of [4, 0, 8]) {
      await ff(() => { const s = window.__game.scene.getScene('TicTacToe'); return s.turn === 'X' && !s.busy; }, 30);
      const b = await board(); const j = b.board[i] ? b.board.findIndex((x) => !x) : i;
      await ev((j) => window.__game.scene.getScene('TicTacToe').boyMove(j), j);
      await wait(0.2);
    }
    await ff(() => { const s = window.__game.scene.getScene('TicTacToe'); return s.turn === 'X' && !s.busy; }, 30);
    await wait(0.4); await still('06_ttt');
    await press('KeyW');
  });

  await step('day2', async () => {
    await press('Digit2');
    await active('SeaBattle');
    await ff(() => window.__game.scene.getScene('SeaBattle').phase === 'place', 90);
    await wait(1);
    await ev(() => { const s = window.__game.scene.getScene('SeaBattle'); s.randomize(); });
    await wait(0.6);
    await ev(() => window.__game.scene.getScene('SeaBattle').startBattle());
    await ff(() => { const s = window.__game.scene.getScene('SeaBattle'); return s.phase === 'battle' && s.turn === 'boy' && !s.busy; }, 60);
    // несколько выстрелов: промахи и попадания в двухпалубник
    for (let k = 0; k < 6; k++) {
      await ff(() => { const s = window.__game.scene.getScene('SeaBattle'); return s.turn === 'boy' && !s.busy; }, 30);
      await ev((k) => {
        const s = window.__game.scene.getScene('SeaBattle'); const b = s.spiderBoard; const N = 10;
        const free = []; for (let i = 0; i < N * N; i++) if (b.shots[i] === 0) free.push(i);
        const ship = free.filter((i) => b.grid[i] >= 0 && b.ships[b.grid[i]].size >= 3);
        const miss = free.filter((i) => b.grid[i] < 0);
        const i = (k % 3 === 2 ? miss : ship)[0] ?? free[0];
        s.boyShoot({ c: i % N, r: Math.floor(i / N) });
      }, k);
      await wait(0.25);
    }
    await ff(() => { const s = window.__game.scene.getScene('SeaBattle'); return s.turn === 'boy' && !s.busy; }, 30);
    await wait(0.3); await still('07_sea');
    await press('KeyW');
  });

  await step('day3', async () => {
    await press('Digit3');
    await untilVoice('S79'); await wait(3.0); await still('08_ognyovka');
    await answer();
    await active('Hangman');
    await ff(() => !!window.__game.scene.getScene('Hangman').word, 30); await wait(1.5);
    const letters = await ev(() => { const s = window.__game.scene.getScene('Hangman'); const w = s.word.replace(/[^\p{L}]/gu, ''); const keys = [...s.keys.keys()]; return { good: [...new Set(w)], bad: keys.filter((k) => !w.includes(k)) }; });
    const seq = [letters.good[0], letters.bad[0], letters.good[1], letters.good[2], letters.bad[1], letters.good[3]].filter(Boolean);
    for (const ch of seq) { await ev((ch) => window.__game.scene.getScene('Hangman').press(ch), ch); await wait(1.1); }
    await wait(0.6); await still('09_hangman');
    await press('KeyW');
  });

  await step('day4', async () => {
    await press('Digit4');
    await untilVoice('S80'); await wait(3.2); await still('10_mom_asleep');
    await answer();
    await active('Dots');
    for (let k = 0; k < 5; k++) {
      await ff(() => { const s = window.__game.scene.getScene('Dots'); return s.st.turn === 'boy' && !s.busy; }, 40);
      await ev(() => {
        const s = window.__game.scene.getScene('Dots'); const G = s.G;
        const free = G.freeEdges(s.st); const safe = free.filter((e) => !G.isUnsafe(s.st, e));
        const e = (safe.length ? safe : free)[Math.floor(safe.length / 2) || 0];
        s.boyMove(e);
      });
      await wait(0.3);
    }
    await ff(() => { const s = window.__game.scene.getScene('Dots'); return s.st.turn === 'boy' && !s.busy; }, 40);
    await wait(0.3); await still('11_dots');
    await press('KeyW');
    // три победы → ловим Огнёвку
    await ff(() => !!(window.__catch && window.__catch.pins && !window.__catch.done), 120);
    await wait(1.0);
    await ev(() => window.__catch.attach(0)); await wait(1.4);
    await ev(() => window.__catch.attach(1)); await wait(1.2);
    await still('12_catch');
    await ev(() => window.__catch.attach(2));
    await active('Ending');
    await wait(3.5); await still('13_dawn');
  });

  await step('day5', async () => {
    await press('Digit5');
    await active('Checkers');
    await ff(() => { const s = window.__game.scene.getScene('Checkers'); return s.state && s.state.color === 'light' && !s.busy; }, 60);
    for (let k = 0; k < 4; k++) {
      await ff(() => { const s = window.__game.scene.getScene('Checkers'); return s.state.color === 'light' && !s.busy && !s.finished; }, 40);
      await ev(() => {
        const s = window.__game.scene.getScene('Checkers'); const m = s.legal(); if (!m.length) return;
        const mv = m.find((x) => x.capRow !== undefined) || m[Math.floor(m.length / 2)];
        const a = s.sqPos(mv.fromRow, mv.fromCol); const b = s.sqPos(mv.toRow, mv.toCol);
        s.onTap({ worldX: a.x, worldY: a.y }); s.onTap({ worldX: b.x, worldY: b.y });
      });
      await wait(0.4);
    }
    await ff(() => { const s = window.__game.scene.getScene('Checkers'); return s.state.color === 'light' && !s.busy; }, 40);
    // выбранная шашка с подсветкой ходов
    await ev(() => { const s = window.__game.scene.getScene('Checkers'); const m = s.legal(); if (m.length) { const a = s.sqPos(m[0].fromRow, m[0].fromCol); s.onTap({ worldX: a.x, worldY: a.y }); } });
    await wait(0.5); await still('14_checkers');
  });

  await step('credits', async () => {
    await ev(() => {
      const g = window.__game; for (const k of ['Bedroom', 'Checkers', 'Ending', 'Pov']) if (g.scene.isActive(k) || g.scene.isPaused(k)) g.scene.stop(k);
      g.scene.start('Credits');
    });
    await ff(() => !!window.__credits && window.__game.scene.isActive('Credits'), 30);
    await wait(2);
    await ev(() => window.__credits.seek && window.__credits.seek(31));
    await wait(2.5); await still('15_credits');
  });
};
