// «Пять в ряд» (гомоку, свободный вариант): поле N×N в клетку, мальчик — крестики (ходит первым),
// паук — нолики. Пять и больше в ряд по горизонтали, вертикали или диагонали — победа.
// ИИ — оценка клеток по шаблонам линий (девять клеток через кандидата: «открытая четвёрка», «тройка» и т. п.)
// для атаки и защиты; «Сложный» ещё смотрит ответ соперника на полход вперёд.
export const GOMOKU_N = 13;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function createGomoku(n = GOMOKU_N) {
  return { n, cells: Array(n * n).fill(null), moves: [], turn: 'X', winner: null, line: null };
}

export const at = (st, c, r) => (c < 0 || r < 0 || c >= st.n || r >= st.n ? 'B' : st.cells[r * st.n + c]);
export const isFull = (st) => st.moves.length >= st.n * st.n;

// Линия из пяти и больше через клетку i для того, кто там стоит → массив индексов или null.
export function lineThrough(st, i) {
  const who = st.cells[i]; if (!who) return null;
  const c0 = i % st.n; const r0 = Math.floor(i / st.n);
  for (const [dc, dr] of DIRS) {
    const run = [i];
    for (let k = 1; at(st, c0 + dc * k, r0 + dr * k) === who; k++) run.push((r0 + dr * k) * st.n + c0 + dc * k);
    for (let k = 1; at(st, c0 - dc * k, r0 - dr * k) === who; k++) run.unshift((r0 - dr * k) * st.n + c0 - dc * k);
    if (run.length >= 5) return run;
  }
  return null;
}

// Ход → { ok, win, line, full }.
export function play(st, i, who = st.turn) {
  if (st.winner || who !== st.turn || i < 0 || i >= st.cells.length || st.cells[i]) return { ok: false };
  st.cells[i] = who; st.moves.push(i);
  const line = lineThrough(st, i);
  if (line) { st.winner = who; st.line = line; }
  st.turn = who === 'X' ? 'O' : 'X';
  return { ok: true, win: !!line, line, full: !line && isFull(st) };
}

// ---------- оценка ----------
// Шаблоны: x — свой камень, _ — пусто; всё остальное (чужой или край) — стена. Берётся лучший шаблон,
// который проходит через центр (кандидат стоит в позиции 4 строки из девяти клеток).
const P = [
  ['xxxxx', 'five', 1e6],
  ['_xxxx_', 'open4', 1e5],
  ['xxxx_', 'four', 1.2e4], ['_xxxx', 'four', 1.2e4], ['xxx_x', 'four', 1.2e4], ['x_xxx', 'four', 1.2e4], ['xx_xx', 'four', 1.2e4],
  ['__xxx_', 'open3', 5e3], ['_xxx__', 'open3', 5e3], ['_xx_x_', 'open3', 4e3], ['_x_xx_', 'open3', 4e3],
  ['_xxx_', 'three', 900],
  ['xxx__', 'three', 400], ['__xxx', 'three', 400], ['xx_x_', 'three', 380], ['_x_xx', 'three', 380], ['x_xx_', 'three', 380], ['_xx_x', 'three', 380],
  ['x__xx', 'three', 300], ['xx__x', 'three', 300], ['x_x_x', 'three', 300],
  ['__xx__', 'open2', 120], ['_x_x__', 'open2', 90], ['__x_x_', 'open2', 90], ['__xx_', 'two', 40], ['_xx__', 'two', 40], ['_x__x_', 'two', 30],
  ['xx___', 'two', 15], ['___xx', 'two', 15], ['_x_x_', 'two', 25],
  ['__x__', 'one', 6], ['_x_', 'one', 2],
];

function lineString(st, c0, r0, dc, dr, who) {
  let s = '';
  for (let k = -4; k <= 4; k++) {
    if (k === 0) { s += 'x'; continue; }
    const v = at(st, c0 + dc * k, r0 + dr * k);
    s += v === who ? 'x' : v === null ? '_' : 'o';
  }
  return s;
}

function bestPattern(s) {
  for (const [p, kind, score] of P) {
    for (let k = Math.max(0, 4 - p.length + 1); k <= 4 && k + p.length <= 9; k++) {
      if (s.startsWith(p, k)) return { kind, score };
    }
  }
  return null;
}

// Оценка клетки i для игрока who (как если бы он туда походил).
export function cellValue(st, i, who) {
  const c0 = i % st.n; const r0 = Math.floor(i / st.n);
  let score = 0; const kinds = { five: 0, open4: 0, four: 0, open3: 0, three: 0 };
  for (const [dc, dr] of DIRS) {
    const b = bestPattern(lineString(st, c0, r0, dc, dr, who));
    if (!b) continue;
    score += b.score;
    if (kinds[b.kind] !== undefined) kinds[b.kind] += 1;
  }
  // связки: две четвёрки, четвёрка с открытой тройкой, две открытые тройки — почти победа
  const fours = kinds.four + kinds.open4;
  if (fours >= 2) score += 5e5;
  else if (fours && kinds.open3) score += 2e5;
  else if (kinds.open3 >= 2) score += 5e4;
  return { score, kinds };
}

// Кандидаты: пустые клетки не дальше двух от любого камня.
export function candidates(st, radius = 2) {
  const n = st.n; const out = [];
  if (!st.moves.length) return [Math.floor(n / 2) * n + Math.floor(n / 2)];
  const near = new Uint8Array(n * n);
  for (const m of st.moves) {
    const c0 = m % n; const r0 = Math.floor(m / n);
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const c = c0 + dc; const r = r0 + dr;
      if (c >= 0 && r >= 0 && c < n && r < n) near[r * n + c] = 1;
    }
  }
  for (let i = 0; i < n * n; i++) if (near[i] && !st.cells[i]) out.push(i);
  return out;
}

// blindThree — шанс не заметить чужую открытую тройку (из неё получается открытая четвёрка, а её не закрыть).
// Четвёрки и пятёрки паук видит всегда — он не поддаётся, просто на «Лёгком» и «Среднем» бывает рассеян.
const LEVEL = {
  easy: { defense: 0.6, randomTop: 4, randomChance: 0.45, blindThree: 0.6 },
  medium: { defense: 0.85, randomTop: 2, randomChance: 0.15, blindThree: 0.25 },
  hard: { defense: 1.05, randomTop: 1, randomChance: 0, blindThree: 0, lookahead: 6 },
};

function scored(st, who, cfg, rng) {
  const opp = who === 'X' ? 'O' : 'X';
  const center = (st.n - 1) / 2;
  return candidates(st).map((i) => {
    const a = cellValue(st, i, who); const d = cellValue(st, i, opp);
    let def = d.score;
    // «Лёгкий» иногда не замечает чужую открытую тройку (но четвёрки и пятёрки видит всегда)
    if (cfg.blindThree && !d.kinds.five && !d.kinds.open4 && !d.kinds.four && d.kinds.open3 && rng() < cfg.blindThree) def *= 0.15;
    const c = i % st.n; const r = Math.floor(i / st.n);
    const centr = 3 - (Math.abs(c - center) + Math.abs(r - center)) * 0.2;
    return { i, a, d, s: a.score + def * cfg.defense + centr };
  }).sort((x, y) => y.s - x.s);
}

export function chooseGomokuMove(st, level = 'medium', rng = Math.random, who = st.turn) {
  const cfg = LEVEL[level] || LEVEL.medium;
  const list = scored(st, who, cfg, rng);
  if (!list.length) return -1;
  // обязательное: своя пятёрка → чужая пятёрка → своя открытая четвёрка/связка → закрыть чужую
  const win = list.find((x) => x.a.kinds.five); if (win) return win.i;
  const block = list.find((x) => x.d.kinds.five); if (block) return block.i;
  const myWin = list.find((x) => x.a.score >= 1e5); if (myWin) return myWin.i;
  const theirWin = list.filter((x) => x.d.score >= 1e5).sort((x, y) => (y.d.score + y.a.score) - (x.d.score + x.a.score));
  if (theirWin.length) return theirWin[0].i;
  if (cfg.lookahead) {
    const opp = who === 'X' ? 'O' : 'X';
    let best = list[0]; let bv = -Infinity;
    for (const x of list.slice(0, cfg.lookahead)) {
      st.cells[x.i] = who; st.moves.push(x.i);
      const reply = scored(st, opp, LEVEL.medium, rng)[0];
      st.cells[x.i] = null; st.moves.pop();
      const v = x.s - (reply ? (reply.a.score + reply.d.score * 0.5) * 0.6 : 0);
      if (v > bv) { bv = v; best = x; }
    }
    return best.i;
  }
  if (cfg.randomChance && rng() < cfg.randomChance) {
    const top = list.slice(0, cfg.randomTop).filter((x) => x.s >= list[0].s * 0.45);
    return top[Math.floor(rng() * top.length)].i;
  }
  return list[0].i;
}

// Мамин совет: лучший ход для крестиков (оценка «Среднего» без случайности).
export function hintGomokuMove(st) {
  const list = scored(st, 'X', { ...LEVEL.medium, randomChance: 0 }, Math.random);
  if (!list.length) return -1;
  const win = list.find((x) => x.a.kinds.five); if (win) return win.i;
  const block = list.find((x) => x.d.kinds.five); if (block) return block.i;
  return list[0].i;
}

// Что ход сделал для who: четвёрки (в т. ч. открытые) и открытые тройки через клетку — для реплик паука.
export function threatsAt(st, i, who = st.cells[i]) {
  if (!who) return { fours: 0, open3: 0 };
  const c0 = i % st.n; const r0 = Math.floor(i / st.n);
  let fours = 0; let open3 = 0;
  for (const [dc, dr] of DIRS) {
    const s = lineString(st, c0, r0, dc, dr, who);
    const b = bestPattern(s);
    if (!b) continue;
    if (b.kind === 'open4' || b.kind === 'four') fours += 1;
    else if (b.kind === 'open3') open3 += 1;
  }
  return { fours, open3 };
}
