// «Точки и линии» (Dots and Boxes). Поле задаётся числом точек в ряду: 4×4 точки = 3×3 клетки (первая зима),
// 6×6 точек = 5×5 клеток («Вторая зима»). Ходы по очереди; кто замкнул клетку (одну или две сразу) —
// получает её и ходит ещё раз. Отрезки: сначала горизонтальные h(r,c), r 0..DOTS-1, c 0..B-1, затем вертикальные.
// makeDots(n) возвращает набор функций для поля n×n точек; именованные экспорты ниже — поле 4×4 (как раньше).
export function makeDots(DOTS = 4) {
  const B = DOTS - 1;
  const H_COUNT = DOTS * B;
  const EDGES = H_COUNT * 2;
  const BOXES = B * B;
  const hEdge = (r, c) => r * B + c;
  const vEdge = (r, c) => H_COUNT + r * DOTS + c;
  const boxEdges = (r, c) => [hEdge(r, c), hEdge(r + 1, c), vEdge(r, c), vEdge(r, c + 1)];
  const BOX_EDGES = Array.from({ length: BOXES }, (_, i) => boxEdges(Math.floor(i / B), i % B));
  const EDGE_BOXES = Array.from({ length: EDGES }, (_, e) => BOX_EDGES.map((es, b) => (es.includes(e) ? b : -1)).filter((b) => b >= 0));

  function edgeGeom(e) {
    if (e < H_COUNT) { const r = Math.floor(e / B); const c = e % B; return { horiz: true, r, c, a: [c, r], b: [c + 1, r] }; }
    const k = e - H_COUNT; const r = Math.floor(k / DOTS); const c = k % DOTS;
    return { horiz: false, r, c, a: [c, r], b: [c, r + 1] };
  }

  const createDots = () => ({ dots: DOTS, edges: Array(EDGES).fill(null), boxes: Array(BOXES).fill(null), turn: 'boy', score: { boy: 0, spider: 0 } });
  const sides = (edges, b) => BOX_EDGES[b].reduce((n, e) => n + (edges[e] ? 1 : 0), 0);
  const freeEdges = (st) => st.edges.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

  // Ход: → { ok, closed: [boxes], again } ; again — тот же игрок ходит снова.
  function play(st, e, who = st.turn) {
    if (who !== st.turn || e < 0 || e >= EDGES || st.edges[e]) return { ok: false, closed: [], again: false };
    st.edges[e] = who;
    const closed = EDGE_BOXES[e].filter((b) => !st.boxes[b] && sides(st.edges, b) === 4);
    closed.forEach((b) => { st.boxes[b] = who; st.score[who] += 1; });
    if (!closed.length) st.turn = who === 'boy' ? 'spider' : 'boy';
    return { ok: true, closed, again: closed.length > 0 };
  }

  const isOver = (st) => st.edges.every(Boolean);
  // нечётное число клеток (9, 25) — ничьей нет
  const winner = (st) => (st.score.boy > st.score.spider ? 'boy' : st.score.boy < st.score.spider ? 'spider' : 'draw');

  // ---- ИИ ----
  const completing = (edges, e) => EDGE_BOXES[e].filter((b) => sides(edges, b) === 3).length;
  const unsafe = (edges, e) => EDGE_BOXES[e].some((b) => sides(edges, b) === 2); // даст сопернику клетку

  // Сколько клеток отдаст ход e (цепочка, которую соперник заберёт подряд).
  function giveaway(edges, e) {
    const ed = edges.slice(); ed[e] = 'x';
    let taken = 0;
    for (;;) {
      let found = -1;
      for (let i = 0; i < EDGES && found < 0; i++) if (!ed[i] && completing(ed, i)) found = i;
      if (found < 0) break;
      taken += completing(ed, found); ed[found] = 'x';
    }
    return taken;
  }

  // Точный перебор (минимакс с памятью по маске): разница клеток для того, кто ходит. Маска — BigInt,
  // поэтому подходит и для 60 отрезков поля 6×6; перебор запускается, только когда свободных отрезков мало.
  const BIT = Array.from({ length: EDGES }, (_, e) => 1n << BigInt(e));
  function solve(mask, boxesLeft, memo) {
    if (boxesLeft === 0) return 0;
    const hit = memo.get(mask);
    if (hit !== undefined) return hit;
    let best = -Infinity;
    for (let e = 0; e < EDGES; e++) {
      if (mask & BIT[e]) continue;
      const nm = mask | BIT[e];
      let gain = 0;
      for (const b of EDGE_BOXES[e]) { if (BOX_EDGES[b].every((x) => nm & BIT[x])) gain++; }
      const v = gain ? gain + solve(nm, boxesLeft - gain, memo) : -solve(nm, boxesLeft, memo);
      if (v > best) best = v;
    }
    memo.set(mask, best);
    return best;
  }
  const maskOf = (edges) => edges.reduce((m, v, i) => (v ? m | BIT[i] : m), 0n);

  function bestMoveExact(st) {
    const mask = maskOf(st.edges);
    const left = st.boxes.filter((b) => !b).length;
    const memo = new Map();
    let best = -1; let bv = -Infinity;
    for (const e of freeEdges(st)) {
      const nm = mask | BIT[e];
      let gain = 0;
      for (const b of EDGE_BOXES[e]) { if (!st.boxes[b] && BOX_EDGES[b].every((x) => nm & BIT[x])) gain++; }
      const v = gain ? gain + solve(nm, left - gain, memo) : -solve(nm, left, memo);
      if (v > bv) { bv = v; best = e; }
    }
    return best;
  }

  // при ≤ EXACT_LIMIT свободных отрезках — точный перебор (быстро, < 0,3 с)
  const EXACT_LIMIT = DOTS <= 4 ? 17 : 15;

  function chooseDotsMove(st, level = 'medium', rng = Math.random) {
    const free = freeEdges(st);
    if (!free.length) return -1;
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const takers = free.filter((e) => completing(st.edges, e));
    const safe = free.filter((e) => !unsafe(st.edges, e));
    if (level === 'easy') {
      if (takers.length && rng() < 0.6) return pick(takers);
      if (safe.length && rng() < 0.5) return pick(safe);
      return pick(free);
    }
    if (level === 'hard' && free.length <= EXACT_LIMIT) return bestMoveExact(st);
    if (takers.length) return pick(takers);
    if (safe.length) return pick(safe);
    // безопасных нет — отдаём как можно меньше
    let min = Infinity; let cand = [];
    for (const e of free) { const g = giveaway(st.edges, e); if (g < min) { min = g; cand = [e]; } else if (g === min) cand.push(e); }
    return pick(cand);
  }

  // Мамина подсказка: забрать клетку, иначе безопасный ход, иначе ход с наименьшей отдачей.
  function hintDotsMove(st) {
    const free = freeEdges(st);
    const takers = free.filter((e) => completing(st.edges, e));
    if (takers.length) return takers[0];
    const safe = free.filter((e) => !unsafe(st.edges, e));
    if (safe.length) return safe[Math.floor(safe.length / 2)];
    if (free.length <= EXACT_LIMIT) return bestMoveExact(st);
    let min = Infinity; let best = free[0];
    for (const e of free) { const g = giveaway(st.edges, e); if (g < min) { min = g; best = e; } }
    return best;
  }
  const isUnsafe = (st, e) => unsafe(st.edges, e);

  return {
    DOTS, B, H_COUNT, EDGES, BOXES, hEdge, vEdge, boxEdges, BOX_EDGES, EDGE_BOXES, EXACT_LIMIT,
    edgeGeom, createDots, freeEdges, play, isOver, winner, bestMoveExact, chooseDotsMove, hintDotsMove, isUnsafe,
  };
}

const D4 = makeDots(4);
export const {
  DOTS, B, H_COUNT, EDGES, BOXES, hEdge, vEdge, boxEdges, BOX_EDGES, EDGE_BOXES, EXACT_LIMIT,
  edgeGeom, createDots, freeEdges, play, isOver, winner, bestMoveExact, chooseDotsMove, hintDotsMove, isUnsafe,
} = D4;
