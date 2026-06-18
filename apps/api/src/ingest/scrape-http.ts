/**
 * Minimal HTML fetcher for scrape adapters. Only used when INGEST_LIVE=1 to
 * refresh a committed snapshot; tests and default runs read the fixture instead.
 */
class NonRetryableError extends Error {}

export async function httpGet(
  url: string,
  opts: { method?: "GET" | "POST"; body?: string } = {},
): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": "research-atlas-ingest" };
  if (opts.body) headers["Content-Type"] = "application/json";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { method: opts.method ?? "GET", body: opts.body, headers });
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new NonRetryableError(`GET ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastErr = err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(`scrape GET failed after retries: ${url} (${String(lastErr)})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
