import { defineConfig } from "@trigger.dev/sdk/v3";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `trigger dev` evaluates this file in place, so the monorepo .env
// (two levels up) is loadable and gives tasks DATABASE_URL etc.
//
// `trigger deploy` bundles + evaluates the config inside an isolated
// sandbox where `import.meta.url` is `file:///trigger.config.ts` and
// the relative `../../.env` resolves to nothing — dotenv loads 0 vars.
// That's expected: on deploy, env comes from the Trigger.dev project
// dashboard, not the repo .env. So the load is best-effort and must
// never throw, and the project ref must NOT depend on it.
//
// The project ref (`proj_…`) is a public identifier (it shows up in
// build logs + the AI-help URLs), not a secret — safe to hardcode as
// the fallback so config evaluation survives the deploy sandbox.
const TRIGGER_PROJECT_REF = "proj_pwqxhdhrlurljnctiqdz";

try {
  const here = dirname(fileURLToPath(import.meta.url));
  // `override: true` so the monorepo .env wins over a stale value already
  // exported into the shell (direnv's `dotenv` loads .env on cd, so a shell
  // opened before an .env edit carries the old value — and plain dotenv
  // won't replace it). In the deploy sandbox the path resolves to nothing,
  // so this loads 0 vars and override is a no-op.
  loadEnv({ path: resolve(here, "../../.env"), override: true });
} catch {
  // No-op: deploy sandbox has no repo .env. Env is injected by the
  // Trigger.dev dashboard at runtime there.
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? TRIGGER_PROJECT_REF,
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
  build: {
    // Mark every optional provider dep as external so esbuild stops
    // tracing the dynamic `await import("…")` chains in
    // @loyalty/{whatsapp,sms,cache,email,push}. They're only loaded
    // when the matching provider is selected at runtime; if a task
    // ever needs one, install it in this package so it resolves then.
    external: [
      "twilio",
      "ioredis",
      "@upstash/redis",
      "resend",
      "expo-server-sdk",
      "web-push",
    ],
  },
});
