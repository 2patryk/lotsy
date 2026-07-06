// Polish relative time for "refreshed X ago" labels, e.g. "5 minut temu",
// "3 godziny temu", "wczoraj". Shared by all tabs.
export function relativeTimePl(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return 'przed chwilą';
  const rtf = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

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
