import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof createDb>;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(databaseUrl), { schema, casing: "snake_case" });
}

let cached: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  cached ??= createDb();
  return cached;
}

/**
 * Lazy Drizzle client. Connecting (and the `DATABASE_URL` check) is
 * deferred to the first property access instead of running at module
 * load.
 *
 * Why: tools that only need to *import* a module that transitively
 * pulls in `@loyalty/db` — Trigger.dev's deploy bundler indexing task
 * files, Next's build tracing, vitest collecting suites — would
 * otherwise crash with "DATABASE_URL is not set" before any query
 * runs. A top-level `throw` makes the package import-unsafe.
 *
 * The Proxy forwards every access to the real client and binds
 * methods so drizzle's `this` stays intact (`db.select()`,
 * `db.query.x`, `db.transaction(...)`, etc. all work unchanged).
 * First real use still throws if `DATABASE_URL` is genuinely missing.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Database = DrizzleDb;
