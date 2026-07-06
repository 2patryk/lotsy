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

// Flag emoji from a 2-letter ISO country code, e.g. "IT" → "🇮🇹".
export function countryFlag(iso: string | null | undefined): string {
  if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return '';
  const code = iso.toUpperCase();
  // Kosovo (XK) has no widely supported flag emoji; render nothing.
  if (code === 'XK') return '';
  return String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65);
}

// Polish country name (as used by charter and one-way feeds) → ISO code, for
// flag lookup. Keys are normalize()d: lowercase, no diacritics.
const PL_COUNTRY_ISO: Record<string, string> = {
  albania: 'AL',
  'arabia saudyjska': 'SA',
  armenia: 'AM',
  austria: 'AT',
  azerbejdzan: 'AZ',
  belgia: 'BE',
  bosnia: 'BA',
  'bosnia i hercegowina': 'BA',
  bulgaria: 'BG',
  chorwacja: 'HR',
  cypr: 'CY',
  czarnogora: 'ME',
  czechy: 'CZ',
  dania: 'DK',
  dominikana: 'DO',
  egipt: 'EG',
  estonia: 'EE',
  finlandia: 'FI',
  francja: 'FR',
  grecja: 'GR',
  gruzja: 'GE',
  hiszpania: 'ES',
  holandia: 'NL',
  indonezja: 'ID',
  irlandia: 'IE',
  islandia: 'IS',
  izrael: 'IL',
  jordania: 'JO',
  katar: 'QA',
  kazachstan: 'KZ',
  kenia: 'KE',
  kuba: 'CU',
  litwa: 'LT',
  lotwa: 'LV',
  luksemburg: 'LU',
  macedonia: 'MK',
  'macedonia polnocna': 'MK',
  madera: 'PT',
  malediwy: 'MV',
  malta: 'MT',
  maroko: 'MA',
  meksyk: 'MX',
  moldawia: 'MD',
  niderlandy: 'NL',
  niemcy: 'DE',
  norwegia: 'NO',
  oman: 'OM',
  polska: 'PL',
  portugalia: 'PT',
  rumunia: 'RO',
  serbia: 'RS',
  slowacja: 'SK',
  slowenia: 'SI',
  szwajcaria: 'CH',
  szwecja: 'SE',
  tajlandia: 'TH',
  tanzania: 'TZ',
  tunezja: 'TN',
  turcja: 'TR',
  ukraina: 'UA',
  wegry: 'HU',
  'wielka brytania': 'GB',
  wlochy: 'IT',
  'wyspy kanaryjskie': 'ES',
  'wyspy zielonego przyladka': 'CV',
  zanzibar: 'TZ',
  'zjednoczone emiraty arabskie': 'AE',
};

// Flag emoji from a Polish country name, e.g. "Grecja" → "🇬🇷".
export function countryFlagPl(name: string | null | undefined): string {
  if (!name) return '';
  return countryFlag(PL_COUNTRY_ISO[normalize(name)]);
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
