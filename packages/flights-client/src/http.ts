// Realistic browser headers — important for GH Actions datacenter IPs

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://www.ryanair.com/',
  Origin: 'https://www.ryanair.com',
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }

    try {
      const res = await fetch(url, {
        headers: { ...BROWSER_HEADERS, ...extraHeaders },
      });

      if (res.status === 429 || res.status === 403) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) throw lastError;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
