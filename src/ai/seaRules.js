// Правила морского боя (как в seabattle-main): поле 10×10, флот 4+3+3+2+2+2+1+1+1+1,
// корабли не касаются даже углами, попал — стреляешь ещё раз, потопленный корабль обводится ореолом.
import { N, FLEET, SHOT, idx, inside } from './battleship.js';
import { I18n } from '../i18n/index.js';

// Буквы столбцов: по-русски — как в школьной тетради (без Й), по-английски — A…J.
export const LETTERS_RU = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
export const LETTERS_EN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const LETTERS = I18n.lang === 'en' ? LETTERS_EN : LETTERS_RU;

export const shipCells = (ship) => Array.from({ length: ship.size }, (_, k) => (ship.horiz ? { c: ship.c + k, r: ship.r } : { c: ship.c, r: ship.r + k }));

// grid: массив 100, -1 — пусто, иначе индекс корабля.
export function emptyGrid() { return Array(N * N).fill(-1); }

export function gridOf(ships) {
  const g = emptyGrid();
  ships.forEach((s, i) => shipCells(s).forEach(({ c, r }) => { g[idx(c, r)] = i; }));
  return g;
}

// Можно ли поставить корабль (не выходит за поле, не касается других, в т. ч. углами).
export function canPlace(ships, cand, ignore = -1) {
  const cells = shipCells(cand);
  if (!cells.every(({ c, r }) => inside(c, r))) return false;
  const g = gridOf(ships.filter((_, i) => i !== ignore));
  for (const { c, r } of cells) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc; const rr = r + dr;
      if (inside(cc, rr) && g[idx(cc, rr)] !== -1) return false;
    }
  }
  return true;
}

// Случайная расстановка всего флота (как autoPlace в исходнике), с перезапуском при тупике.
export function autoPlace(rng = Math.random, fleet = FLEET) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ships = [];
    let ok = true;
    for (const size of fleet) {
      let placed = false;
      for (let k = 0; k < 400 && !placed; k++) {
        const horiz = rng() < 0.5;
        const c = Math.floor(rng() * (horiz ? N - size + 1 : N));
        const r = Math.floor(rng() * (horiz ? N : N - size + 1));
        const cand = { size, c, r, horiz };
        if (canPlace(ships, cand)) { ships.push(cand); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships.map((s) => ({ ...s, hits: 0, sunk: false }));
  }
  throw new Error('autoPlace failed');
}

export function validFleet(ships, fleet = FLEET) {
  const sizes = ships.map((s) => s.size).sort((a, b) => b - a);
  const need = fleet.slice().sort((a, b) => b - a);
  if (sizes.join() !== need.join()) return false;
  return ships.every((s, i) => canPlace(ships, s, i));
}

// Поле для стрельбы: { ships, grid, shots[100] }.
export function createBoard(ships) {
  return { ships: ships.map((s) => ({ ...s, hits: 0, sunk: false })), grid: gridOf(ships), shots: Array(N * N).fill(SHOT.NONE) };
}

// Выстрел. → { result: 'miss'|'hit'|'sunk'|'repeat', ship?, halo?: [{c,r}], allSunk }
export function fire(board, c, r) {
  const i = idx(c, r);
  if (!inside(c, r) || board.shots[i] !== SHOT.NONE) return { result: 'repeat', allSunk: allSunk(board) };
  const si = board.grid[i];
  if (si === -1) { board.shots[i] = SHOT.MISS; return { result: 'miss', allSunk: false }; }
  const ship = board.ships[si];
  ship.hits += 1;
  board.shots[i] = SHOT.HIT;
  if (ship.hits < ship.size) return { result: 'hit', ship, allSunk: false };
  ship.sunk = true;
  const cells = shipCells(ship);
  const halo = [];
  for (const { c: sc, r: sr } of cells) board.shots[idx(sc, sr)] = SHOT.SUNK;
  for (const { c: sc, r: sr } of cells) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = sc + dc; const rr = sr + dr;
      if (inside(cc, rr) && board.shots[idx(cc, rr)] === SHOT.NONE) { board.shots[idx(cc, rr)] = SHOT.HALO; halo.push({ c: cc, r: rr }); }
    }
  }
  return { result: 'sunk', ship, cells, halo, allSunk: allSunk(board) };
}

export const allSunk = (board) => board.ships.every((s) => s.sunk);
export const shipsLeft = (board) => board.ships.filter((s) => !s.sunk).length;
export const cellName = (c, r) => `${LETTERS[c]}${r + 1}`;

// ---------- «Вторая зима»: мины ----------
// Мина — клетка без корабля и не рядом с ним (иначе её «закроет» ореол потопленного корабля), мины не касаются
// друг друга. Попал в чужую мину — это промах, и ход переходит сопернику; мина видна обоим.
export function placeMines(board, n = 2, rng = Math.random) {
  const free = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let near = false;
    for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc; const rr = r + dr;
      if (inside(cc, rr) && board.grid[idx(cc, rr)] !== -1) { near = true; break; }
    }
    if (!near) free.push(idx(c, r));
  }
  const mines = [];
  while (mines.length < n && free.length) {
    const i = free.splice(Math.floor(rng() * free.length), 1)[0];
    const touches = mines.some((m) => Math.abs((m % N) - (i % N)) <= 1 && Math.abs(Math.floor(m / N) - Math.floor(i / N)) <= 1);
    if (!touches) mines.push(i);
  }
  board.mines = mines;
  board.minesHit = [];
  return mines;
}

// Выстрел с учётом мин → как fire(), плюс { result: 'mine' }.
export function fireMined(board, c, r) {
  const i = idx(c, r);
  if (inside(c, r) && board.mines && board.mines.includes(i) && board.shots[i] === SHOT.NONE) {
    board.shots[i] = SHOT.MISS;
    board.minesHit.push(i);
    return { result: 'mine', allSunk: false };
  }
  return fire(board, c, r);
}
