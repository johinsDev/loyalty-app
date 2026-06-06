// Post-deploy smoke test of the per-PR preview API Worker: asserts the deployed
// Worker actually SERVES on its custom domain (not just that `wrangler deploy`
// exited 0), so a broken / misconfigured Worker fails the preview job (a required
// merge check) instead of shipping a dead preview. Waits out the custom-domain
// cert on a fresh deploy. Runnable manually:
//   PR_NUMBER=83 bun run scripts/cloudflare/smoke-preview-worker.ts
//
// Env: PR_NUMBER (required), PREVIEW_ZONE (default t4diverclub.app),
//      SMOKE_TIMEOUT_MS (default 600000 — first-deploy custom-domain cert
//      propagation; the Worker has workers_dev=false so the cert is on the
//      critical path, and a fresh hostname's edge cert can take several
//      minutes — 4 min was too tight and flaked. The preview-db job's
//      timeout-minutes=20 accommodates this).
import process from "node:process";

const need = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};

const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
const base = `https://api.pr-${pr}.${zone}`;
const adminOrigin = `https://admin.pr-${pr}.${zone}`;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 600000);
const startedAt = Date.now();
const deadline = startedAt + timeoutMs;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const elapsedS = () => Math.round((Date.now() - startedAt) / 1000);

// Wait for the custom-domain cert + edge route to come up (fresh deploys take a
// few minutes while the edge cert provisions; re-deploys are instant since the
// domain already exists). Logs elapsed time so a slow cert is visible in the run.
async function waitReady(): Promise<void> {
  for (;;) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        console.info(`✓ ${base} serving after ${elapsedS()}s`);
        return;
      }
    } catch {
      // not resolving / cert not ready yet — keep waiting
    }
    if (Date.now() > deadline) {
      throw new Error(
        `${base} did not start serving within ${Math.round(timeoutMs / 1000)}s ` +
          `(custom-domain cert likely still provisioning) — re-run the job`,
      );
    }
    console.info(`… waiting for ${base} to serve (${elapsedS()}s elapsed)`);
    await sleep(8000);
  }
}

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  results.push({ name, ok, detail });
};

await waitReady();

// 1. Root route.
const root = await (await fetch(`${base}/`)).text();
check("GET /", root.includes("loyalty-api ok"), root.slice(0, 60));

// 2. tRPC health.ping (public, no DB) — proves the tRPC mount + fetch adapter.
const ping = (await (
  await fetch(`${base}/trpc/health.ping?batch=1&input=%7B%7D`)
).json()) as [{ result?: { data?: { json?: { ok?: boolean } } } }];
check(
  "GET /trpc/health.ping",
  ping?.[0]?.result?.data?.json?.ok === true,
  JSON.stringify(ping).slice(0, 80),
);

// 3. Better Auth is mounted + reachable (null session is the 200 we expect).
const session = await fetch(`${base}/api/auth/get-session`);
check("GET /api/auth/get-session", session.status === 200, `HTTP ${session.status}`);

// 4. CORS reflects the FE admin origin with credentials (the cutover contract).
const cors = await fetch(`${base}/trpc/health.ping`, {
  method: "OPTIONS",
  headers: {
    Origin: adminOrigin,
    "Access-Control-Request-Method": "POST",
  },
});
const allowOrigin = cors.headers.get("access-control-allow-origin");
check("CORS reflects admin origin", allowOrigin === adminOrigin, allowOrigin ?? "none");

for (const r of results) {
  console.info(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
}
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`✗ preview Worker smoke FAILED (${failed.length}/${results.length}) at ${base}`);
  process.exit(1);
}
console.info(`✓ preview Worker smoke passed — ${base}`);
