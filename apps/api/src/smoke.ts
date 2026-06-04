// Runtime-agnostic smoke test (run on Bun: `bun run smoke`). Verifies the Hono
// app boots and routes resolve, without needing wrangler/Cloudflare. The tRPC
// health call needs a reachable DB (DATABASE_URL) — it's reported, not asserted.
import app from "./index";

async function hit(path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  const body = await res.text();
  console.log(`${path} → ${res.status} ${body.slice(0, 120)}`);
  return res;
}

const root = await hit("/");
await hit("/trpc/health.ping?batch=1&input=%7B%7D").catch((e) =>
  console.log("/trpc/health.ping → error (expected without DB):", e.message),
);

if (root.status !== 200) {
  console.error("root route failed");
  process.exit(1);
}
console.log("✓ Hono app boots + routes resolve");
