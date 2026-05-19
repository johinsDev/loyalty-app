import { neonConfig } from "@neondatabase/serverless";

/**
 * Local Docker dev: redirect the `neon-http` driver to the
 * `local-neon-http-proxy` sidecar instead of the real Neon HTTP API.
 *
 * `DATABASE_URL` stays a plain Postgres URL (so drizzle-kit's direct
 * `pg` connection for `db:push` / `db:studio` works against the same
 * Postgres). Only the serverless driver's fetch is rerouted.
 *
 * Gated entirely on `NEON_HTTP_PROXY_URL`:
 *   - set (compose: `http://neon-proxy:4444/sql`, host: `http://localhost:4444/sql`)
 *       → fetch goes to the proxy.
 *   - unset (preview / prod / non-Docker local) → ZERO behavior change,
 *       the driver talks to real Neon exactly as before.
 *
 * Import this module for its side effect BEFORE the first `neon()` call.
 */
const proxyUrl = process.env.NEON_HTTP_PROXY_URL;

if (proxyUrl) {
  neonConfig.fetchEndpoint = proxyUrl;
}
