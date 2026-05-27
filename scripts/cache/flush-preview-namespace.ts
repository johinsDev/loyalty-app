// Flush a PR's cache namespace (`pr-<n>:*`) from the shared preview Upstash
// when the PR closes. Previews write under CACHE_KEY_PREFIX=pr-<n>: and every
// entry has a default TTL, so this is belt-and-suspenders — it reclaims the
// space immediately instead of waiting for TTLs to expire. Idempotent.
//
// Env in: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, PR_NUMBER

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const url = need("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
const token = need("UPSTASH_REDIS_REST_TOKEN");
const pr = need("PR_NUMBER");
const pattern = `pr-${pr}:*`;

async function redis<T>(...args: (string | number)[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || body.error) {
    throw new Error(`Upstash ${args[0]} → ${res.status}: ${body.error ?? ""}`);
  }
  return body.result as T;
}

let cursor = "0";
let deleted = 0;
do {
  const [next, keys] = await redis<[string, string[]]>(
    "SCAN",
    cursor,
    "MATCH",
    pattern,
    "COUNT",
    "500",
  );
  if (keys.length > 0) {
    await redis("DEL", ...keys);
    deleted += keys.length;
  }
  cursor = next;
} while (cursor !== "0");

console.info(`✓ flushed ${deleted} cache keys matching ${pattern}`);
