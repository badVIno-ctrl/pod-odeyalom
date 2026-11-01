// Ничьи в шашках. В исходнике online-heckers-main правил ничьей нет — добавлены стандартные
// правила русских шашек (упрощённо):
//  1) трёхкратное повторение позиции (с той же очередью хода);
//  2) 15 ходов каждого (30 полуходов) подряд без взятий и без ходов простыми шашками — только дамки;
//  3) страховка: 200 полуходов без результата.
// По ТЗ ничья — партия переигрывается.
export function positionKey(board, toMove) {
  let h = toMove === 'dark' ? 'D' : 'L';
  for (const row of board) for (const p of row) h += !p ? '0' : p.color === 'dark' ? (p.king ? 'K' : 'd') : (p.king ? 'Q' : 'l');
  return h;
}

export class DrawTracker {
  constructor() { this.counts = new Map(); this.quiet = 0; this.plies = 0; }

  // Вызывать после завершения хода (включая всю серию взятий): board — позиция, toMove — кто ходит дальше.
  push(board, toMove, { capture = false, manMoved = false } = {}) {
    this.plies += 1;
    this.quiet = capture || manMoved ? 0 : this.quiet + 1;
    const k = positionKey(board, toMove);
    const n = (this.counts.get(k) || 0) + 1;
    this.counts.set(k, n);
    if (n >= 3) return 'repetition';
    if (this.quiet >= 30) return 'kings';
    if (this.plies >= 200) return 'limit';
    return null;
  }
}
