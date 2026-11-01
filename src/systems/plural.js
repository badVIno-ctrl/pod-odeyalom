// Русские числительные: plural(5, 'буква', 'буквы', 'букв') → 'букв'.
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

// «5 букв», «2 раза» — число вместе со словом.
export const count = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
