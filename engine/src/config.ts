// Polish departure airports (all Ryanair-served)
export const ORIGIN_AIRPORTS = ['WAW', 'WMI', 'KTW', 'KRK', 'GDN', 'WRO', 'POZ', 'LCJ'] as const;

// Target destination airports (southern Europe + nearby leisure)
export const DEST_AIRPORTS = new Set([
  // Italy
  'FCO',
  'CIA',
  'MXP',
  'BGY',
  'NAP',
  'BLQ',
  'VCE',
  'TSF',
  'PSA',
  'BRI',
  'CTA',
  'PMO',
  'OLB',
  'CAG',
  // Spain (mainland)
  'BCN',
  'MAD',
  'AGP',
  'PMI',
  'ALC',
  'SVQ',
  'VLC',
  'IBZ',
  'MAH',
  // Spain (Canary Islands)
  'TFS',
  'LPA',
  'FUE',
  'ACE',
  'SPC',
  // Greece
  'ATH',
  'HER',
  'RHO',
  'SKG',
  'CFU',
  'KGS',
  'ZTH',
  'JMK',
  'MJT',
  'CHQ',
  'JTR',
  // Croatia
  'SPU',
  'DBV',
  'ZAD',
  'PUY',
  // Albania
  'TIA',
  // Montenegro
  'TGD',
  'TIV',
  // Portugal
  'LIS',
  'OPO',
  'FAO',
  // Malta
  'MLA',
  // Cyprus
  'LCA',
  'PFO',
  'ECN',
  // Turkey
  'AYT',
  'IST',
  'SAW',
  'ESB',
  'ADB',
  'DLM',
  'BJV',
  // Bulgaria (coast)
  'VAR',
  'BOJ',
  // France (south + Corsica)
  'NCE',
  'MRS',
  'AJA',
  'FSC',
  // Morocco
  'RAK',
  'AGA',
  'CMN',
  'FEZ',
  'TNG',
  // Israel
  'TLV',
  // Jordan
  'AMM',
  // Tunisia
  'TUN',
  'DJE',
  'MIR',
  // Serbia
  'BEG',
  // Romania
  'OTP',
  'CLJ',
  'TSR',
  'IAS',
  // Bosnia & Herzegovina
  'SJJ',
  // North Macedonia
  'SKP',
  // Kosovo
  'PRN',
  // UK
  'STN',
  'LTN',
  'MAN',
  'EDI',
  'BRS',
  'BHX',
  'GLA',
  // Ireland
  'DUB',
  'ORK',
  'KIR',
  // Iceland
  'KEF',
]);

// Max round-trip price per person to qualify as a deal
export const MAX_TOTAL_PRICE = 800;

// Maximum number of deals kept per route
export const TOP_N_PER_ROUTE = 3;

// Rolling search horizon in weeks
export const HORIZON_WEEKS = 6;

// Max concurrent HTTP requests to Ryanair API
export const MAX_CONCURRENT = 3;

// Delay between batches (ms)
export const BATCH_DELAY_MS = 300;

// Deal TTL in hours
export const DEAL_TTL_HOURS = 48;

// Route cache TTL in hours (re-fetch Ryanair routes at most once per day)
export const ROUTE_CACHE_TTL_HOURS = 24;

// Scoring boost for "good-hour" departure/return (reduces price by this factor for ranking)
export const GOOD_HOUR_BONUS = 20;

// "Good" outbound departure: Thu ≥16:00, Fri any, Sat ≤12:00
export const OUTBOUND_GOOD_HOURS: Record<number, { from: number; to: number }> = {
  4: { from: 16, to: 24 }, // Thursday
  5: { from: 0, to: 24 }, // Friday
  6: { from: 0, to: 12 }, // Saturday
};

// "Good" return departure: Sun ≥16:00, Mon ≥16:00, Sat ≥14:00
export const RETURN_GOOD_HOURS: Record<number, { from: number; to: number }> = {
  0: { from: 16, to: 24 }, // Sunday
  1: { from: 16, to: 24 }, // Monday
  6: { from: 14, to: 24 }, // Saturday
};
