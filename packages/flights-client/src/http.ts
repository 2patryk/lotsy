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

const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff with jitter, so concurrent retries don't all fire at once.
function backoffMs(attempt: number): number {
  const base = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
  return base + Math.floor(Math.random() * RETRY_DELAY_MS);
}

export async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  return request<T>(url, { extraHeaders });
}

/**
 * POST a JSON body and parse a JSON response, with the same retry/backoff and
 * browser-header handling as fetchJson. Used by carriers whose fare search is a
 * POST endpoint (e.g. Wizz Air timetable).
 */
export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    extraHeaders: { 'Content-Type': 'application/json;charset=UTF-8', ...extraHeaders },
  });
}

/**
 * GET a raw text body (no JSON parsing). Used to scrape the current Wizz Air API
 * version out of the public site.
 */
export async function fetchText(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  return request<string>(url, { extraHeaders, raw: true });
}

interface RequestOptions {
  method?: string;
  body?: string;
  extraHeaders?: Record<string, string>;
  raw?: boolean;
}

async function request<T>(url: string, opts: RequestOptions): Promise<T> {
  const { method = 'GET', body, extraHeaders, raw = false } = opts;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs(attempt));
    }

    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { ...BROWSER_HEADERS, ...extraHeaders },
      });

      // Transient: rate-limit, edge blocks, and 5xx (Wizz's backend throws 503
      // under load). Back off and retry rather than dropping the route.
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }

      return (raw ? await res.text() : await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) throw lastError;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
