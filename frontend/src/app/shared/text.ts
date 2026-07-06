// Diacritic- and case-insensitive normalization, e.g. "wlochy" matches "Włochy".
export function normalize(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // NFD does not decompose stroked letters, so map Polish l-stroke by hand.
      .replace(/[łŁ]/g, 'l')
      .toLowerCase()
  );
}
