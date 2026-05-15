import { defineConfig } from "@trigger.dev/sdk/v3";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Trigger CLI runs from packages/jobs so the monorepo .env sits two
// levels up. Load it explicitly so TRIGGER_PROJECT_ID, DATABASE_URL,
// etc. are available both when evaluating this config and when tasks
// execute in dev.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

if (!process.env.TRIGGER_PROJECT_ID) {
  throw new Error(
    "TRIGGER_PROJECT_ID is not set. Add it to the monorepo root .env.",
  );
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID,
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
