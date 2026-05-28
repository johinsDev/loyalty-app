import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

type Db = LibSQLDatabase<typeof schema>;

// Lazy: the real client is built on first use, not at import. Importing
// `@loyalty/db` must be side-effect free so it can be bundled where env isn't
// present yet — e.g. `trigger deploy` indexes task files in a sandbox with no
// DATABASE_URL, and `next build` traces routes. The throw + connection are
// deferred to the first actual query.
let instance: Db | undefined;

function resolve(): Db {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  instance = drizzle(client, { schema, casing: "snake_case" });
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = resolve() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Database = Db;
