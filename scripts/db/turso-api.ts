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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Turso API ${init?.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`,
    );
  }
  return res.json() as Promise<T>;
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
