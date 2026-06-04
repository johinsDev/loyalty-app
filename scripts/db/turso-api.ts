// Thin wrapper over the Turso Platform API, used by the preview pipeline to
// clone prod into a per-PR database and tear it down. Auth is a Platform API
// token (creates/destroys databases) — distinct from a per-database auth token.
//
// Env:
//   TURSO_API_TOKEN  Platform API token (turso auth api-tokens mint …)
//   TURSO_ORG        organization slug (e.g. johinsdev)

const ORG = process.env.TURSO_ORG;
const API_TOKEN = process.env.TURSO_API_TOKEN;

if (!ORG) throw new Error("TURSO_ORG is not set");
if (!API_TOKEN) throw new Error("TURSO_API_TOKEN is not set");

const BASE = `https://api.turso.tech/v1/organizations/${ORG}`;

// Turso's Platform API sits behind CloudFront, which intermittently returns a
// 403 "Request blocked" (WAF / rate-limit on shared GitHub Actions IPs) — plus
// the usual transient 429 / 5xx. Retry those (and network errors); throw
// immediately on deterministic codes (401 bad token, 404 not found — callers
// rely on the 404 throw). See `project-preview-pipeline` memory.
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Exponential backoff + jitter: ~0.5s, 1s, 2s.
const backoffMs = (attempt: number) =>
  Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      console.warn(
        `Turso API ${method} ${path} → network error, retrying (${attempt}/${MAX_ATTEMPTS - 1})`,
      );
      await sleep(backoffMs(attempt));
      continue;
    }

    if (res.ok) return res.json() as Promise<T>;

    const body = await res.text();
    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
      console.warn(
        `Turso API ${method} ${path} → ${res.status}, retrying (${attempt}/${MAX_ATTEMPTS - 1})`,
      );
      await sleep(backoffMs(attempt));
      continue;
    }
    throw new Error(`Turso API ${method} ${path} → ${res.status} ${body}`);
  }
}

export interface TursoDatabase {
  Name: string;
  Hostname: string;
  DbId: string;
}

/** Create a new database seeded from `source`'s current data (a clone). */
export async function createPreviewDatabase(args: {
  name: string;
  source: string;
  group?: string;
}): Promise<TursoDatabase> {
  const { database } = await api<{ database: TursoDatabase }>("/databases", {
    method: "POST",
    body: JSON.stringify({
      name: args.name,
      group: args.group ?? "default",
      seed: { type: "database", name: args.source },
    }),
  });
  return database;
}

/** Fetch an existing database (its Hostname etc.). Throws 404 if missing. */
export async function getDatabase(name: string): Promise<TursoDatabase> {
  const { database } = await api<{ database: TursoDatabase }>(
    `/databases/${name}`,
  );
  return database;
}

/** Mint a full-access auth token for a database. */
export async function mintDatabaseToken(name: string): Promise<string> {
  const { jwt } = await api<{ jwt: string }>(
    `/databases/${name}/auth/tokens`,
    { method: "POST" },
  );
  return jwt;
}

/** Destroy a database. Throws 404 if it doesn't exist (callers may ignore). */
export async function deleteDatabase(name: string): Promise<void> {
  await api(`/databases/${name}`, { method: "DELETE" });
}

/** The libsql:// connection URL for a database hostname. */
export function libsqlUrl(hostname: string): string {
  return `libsql://${hostname}`;
}

/** Conventional per-PR preview database name. */
export function previewDbName(pr: string | number): string {
  return `preview-pr-${pr}`;
}
