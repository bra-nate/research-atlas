import { env } from "../env.js";

const BASE = "https://api.openalex.org";

class NonRetryableError extends Error {}

/** GET one OpenAlex resource by path, with polite-pool mailto + retry/backoff. */
export async function oaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (env.openalexMailto) url.searchParams.set("mailto", env.openalexMailto);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "research-atlas-ingest" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new NonRetryableError(`OpenAlex ${res.status} for ${url.pathname}`);
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastErr = err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(`OpenAlex request failed after retries: ${url.href} (${String(lastErr)})`);
}

/** Page through a list endpoint with cursor pagination, up to `cap` items. */
export async function oaPaginate<T>(
  path: string,
  filter: string,
  cap: number,
  extra: Record<string, string> = {},
): Promise<T[]> {
  const out: T[] = [];
  let cursor = "*";
  while (out.length < cap && cursor) {
    const page = await oaGet<{ results: T[]; meta: { next_cursor: string | null } }>(path, {
      filter,
      "per-page": "200",
      cursor,
      ...extra,
    });
    out.push(...page.results);
    cursor = page.meta.next_cursor ?? "";
  }
  return out.slice(0, cap);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
