// ИИ морского боя — порт логики выбора выстрела из проекта пользователя
// seabattle-main/seabattle/game/index.html (localShot и помощники), без UI и Three.js.
// Поле 10×10, флот 4 + 3×2 + 2×3 + 1×4, корабли не касаются друг друга (ореол).
//
// Интерфейс (единый для всех ИИ):
//   chooseMove(gameState, difficulty) → { c, r, mode: 'target' | 'hunt' } | null
//   gameState = {
//     shots: массив 100 клеток поля мальчика со значениями SHOT (NONE/MISS/HIT/SUNK/HALO), индекс = r * 10 + c,
//     ships: [{ size, sunk }] — флот мальчика (паук знает только, какие корабли уже потоплены),
//   }
// Уровни (config/difficulty.js → battleship.engine):
//   'random' (Юнга)  — наугад; при раненом корабле 35% выстрелов всё равно наугад;
//   'hunt'   (Мичман) — шахматный паттерн с шагом минимального корабля, шум 18%;
//   'prob'   (Капитан) — карта вероятностей по остатку флота, шум 5%;
//   'monte'  (Адмирал) — перебор совместимых расстановок (Монте-Карло), без шума. В меню не используется.
// TODO (сцена 3 — день 2): расстановка флота, UI, реплики паука.
import { getDifficulty } from '../config/difficulty.js';

export const N = 10;
export const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
export const SHOT = { NONE: 0, MISS: 1, HIT: 2, SUNK: 3, HALO: 4 };

export const idx = (c, r) => r * N + c;
export const inside = (c, r) => c >= 0 && c < N && r >= 0 && r < N;

export function remainingSizes(gameState) {
  if (Array.isArray(gameState.remaining)) return gameState.remaining.slice().sort((a, b) => b - a);
  return (gameState.ships || []).filter((s) => s && !s.sunk).map((s) => s.size).sort((a, b) => b - a);
}

export function openCells(board) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board.shots[idx(c, r)] === SHOT.NONE) out.push({ c, r });
  return out;
}

function activeHits(board) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board.shots[idx(c, r)] === SHOT.HIT) out.push({ c, r });
  return out;
}

const isOpen = (board, c, r) => inside(c, r) && board.shots[idx(c, r)] === SHOT.NONE;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Добивание: продолжаем линию от самой длинной группы попаданий.
export function targetCandidates(board) {
  const hits = activeHits(board);
  if (!hits.length) return [];
  const key = (h) => idx(h.c, h.r);
  const set = new Map(hits.map((h) => [key(h), h]));
  const seen = new Set();
  const groups = [];
  for (const h of hits) {
    if (seen.has(key(h))) continue;
    const stack = [h]; const grp = [];
    seen.add(key(h));
    while (stack.length) {
      const cur = stack.pop(); grp.push(cur);
      for (const [dc, dr] of DIRS4) {
        const k = key({ c: cur.c + dc, r: cur.r + dr });
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(set.get(k)); }
      }
    }
    groups.push(grp);
  }
  const grp = groups.sort((a, b) => b.length - a.length)[0];
  const out = [];
  if (grp.length === 1) {
    const h = grp[0];
    for (const [dc, dr] of DIRS4) if (isOpen(board, h.c + dc, h.r + dr)) out.push({ c: h.c + dc, r: h.r + dr });
  } else if (grp.every((h) => h.r === grp[0].r)) {
    const rr = grp[0].r; const cs = grp.map((h) => h.c);
    const lo = Math.min(...cs) - 1; const hi = Math.max(...cs) + 1;
    if (isOpen(board, lo, rr)) out.push({ c: lo, r: rr });
    if (isOpen(board, hi, rr)) out.push({ c: hi, r: rr });
  } else {
    const cc = grp[0].c; const rs = grp.map((h) => h.r);
    const lo = Math.min(...rs) - 1; const hi = Math.max(...rs) + 1;
    if (isOpen(board, cc, lo)) out.push({ c: cc, r: lo });
    if (isOpen(board, cc, hi)) out.push({ c: cc, r: hi });
  }
  return out;
}

export function huntCandidates(board, sizes) {
  const minSize = sizes.length ? Math.min(...sizes) : 1;
  const open = openCells(board);
  const pattern = open.filter((p) => (p.c + p.r) % minSize === 0);
  return pattern.length ? pattern : open;
}

const shipCells = (size, c, r, horiz) => Array.from({ length: size }, (_, k) => (horiz ? { c: c + k, r } : { c, r: r + k }));

// Сколько допустимых положений оставшихся кораблей проходит через клетку; попадания усиливают вес ×30.
export function probabilityMap(board, sizes) {
  const map = new Float32Array(N * N);
  const free = (i) => board.shots[i] === SHOT.NONE || board.shots[i] === SHOT.HIT;
  for (const size of new Set(sizes)) {
    const count = sizes.filter((s) => s === size).length;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const horiz of [true, false]) {
      if (size === 1 && !horiz) continue;
      const cells = shipCells(size, c, r, horiz);
      if (cells.some((p) => !inside(p.c, p.r) || !free(idx(p.c, p.r)))) continue;
      const hitCount = cells.filter((p) => board.shots[idx(p.c, p.r)] === SHOT.HIT).length;
      const w = count * (hitCount > 0 ? 30 ** hitCount : 1);
      for (const p of cells) { const i = idx(p.c, p.r); if (board.shots[i] === SHOT.NONE) map[i] += w; }
    }
  }
  return map;
}

export function bestByMap(board, map, rng = Math.random) {
  let best = -1; let out = [];
  for (let i = 0; i < map.length; i++) {
    if (board.shots[i] !== SHOT.NONE) continue;
    if (map[i] > best) { best = map[i]; out = [i]; } else if (map[i] === best) out.push(i);
  }
  if (!out.length) return null;
  const i = out[Math.floor(rng() * out.length)];
  return { c: i % N, r: Math.floor(i / N), weight: best };
}

// «Адмирал»: семплирование расстановок, совместимых с историей выстрелов (с запретом касаний).
export function monteCarloMap(board, sizes, { timeBudgetMs = 60, rng = Math.random, now = () => performance.now() } = {}) {
  const blocked = new Uint8Array(N * N); const hits = [];
  for (let i = 0; i < N * N; i++) {
    const s = board.shots[i];
    if (s === SHOT.MISS || s === SHOT.HALO || s === SHOT.SUNK) blocked[i] = 1;
    if (s === SHOT.HIT) hits.push(i);
  }
  const order = sizes.slice().sort((a, b) => b - a);
  const counts = new Float64Array(N * N); const occ = new Uint8Array(N * N); const body = new Uint8Array(N * N);
  const cache = new Map();
  const posFor = (size) => {
    if (cache.has(size)) return cache.get(size);
    const list = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const horiz of (size === 1 ? [true] : [true, false])) {
      const cells = []; let ok = true;
      for (let k = 0; k < size; k++) {
        const cc = horiz ? c + k : c; const rr = horiz ? r : r + k;
        if (!inside(cc, rr) || blocked[idx(cc, rr)]) { ok = false; break; }
        cells.push(idx(cc, rr));
      }
      if (ok) list.push(cells);
    }
    cache.set(size, list);
    return list;
  };
  const fits = (cells) => cells.every((i) => !occ[i]);
  const mark = (cells) => {
    for (const i of cells) {
      body[i] = 1;
      const c = i % N; const r = Math.floor(i / N);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inside(c + dc, r + dr)) occ[idx(c + dc, r + dr)] += 1;
    }
  };
  const t0 = now(); let samples = 0; let attempts = 0;
  while (samples < 4000 && attempts < 60000 && now() - t0 < timeBudgetMs) {
    attempts++; occ.fill(0); body.fill(0);
    let ok = true;
    for (const size of order) {
      const list = posFor(size); let placed = null;
      for (let t = 0; t < 60; t++) { const cand = list[Math.floor(rng() * list.length)]; if (cand && fits(cand)) { placed = cand; break; } }
      if (!placed) { ok = false; break; }
      mark(placed);
    }
    if (!ok || hits.some((h) => !body[h])) continue;
    samples++;
    for (let i = 0; i < N * N; i++) if (body[i] && board.shots[i] === SHOT.NONE) counts[i] += 1;
  }
  return { map: counts, samples };
}

function admiralShot(board, sizes, rng) {
  const res = monteCarloMap(board, sizes, { rng });
  if (res.samples >= 25) { const best = bestByMap(board, res.map, rng); if (best) return best; }
  return bestByMap(board, probabilityMap(board, sizes), rng);
}

export function chooseMove(gameState, difficulty, { rng = Math.random } = {}) {
  const cfg = getDifficulty(difficulty).battleship;
  const board = gameState;
  const pick = (arr) => (arr.length ? arr[Math.floor(rng() * arr.length)] : null);
  const open = openCells(board);
  if (!open.length) return null;
  const sizes = remainingSizes(gameState);
  const targets = targetCandidates(board);
  if (targets.length) {
    let cell;
    // «Отвлёкся»: с вероятностью targetRandomChance паук не добивает раненый корабль, а стреляет наугад.
    if (rng() < (cfg.targetRandomChance ?? 0)) cell = pick(open);
    else if (cfg.engine === 'monte') cell = admiralShot(board, sizes, rng) || pick(targets);
    else if (cfg.engine === 'prob') cell = bestByMap(board, probabilityMap(board, sizes), rng) || pick(targets);
    else cell = pick(targets);
    if (!cell || board.shots[idx(cell.c, cell.r)] !== SHOT.NONE) cell = pick(targets);
    return { c: cell.c, r: cell.r, mode: 'target' };
  }
  if (rng() < cfg.noise) { const cell = pick(open); return { c: cell.c, r: cell.r, mode: 'hunt' }; }
  let cell;
  if (cfg.engine === 'random') cell = pick(open);
  else if (cfg.engine === 'hunt') cell = pick(huntCandidates(board, sizes));
  else if (cfg.engine === 'monte') cell = admiralShot(board, sizes, rng);
  else cell = bestByMap(board, probabilityMap(board, sizes), rng);
  if (!cell) cell = pick(open);
  return { c: cell.c, r: cell.r, mode: 'hunt' };
}
