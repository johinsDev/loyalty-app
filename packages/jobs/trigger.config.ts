import { defineConfig } from "@trigger.dev/sdk/v3";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Trigger CLI corre desde packages/jobs, así que el .env del monorepo
// queda dos niveles arriba. Lo cargamos explícitamente para que
// TRIGGER_PROJECT_ID, DATABASE_URL, etc. estén disponibles tanto al
// evaluar este config como al ejecutar las tasks en dev.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

if (!process.env.TRIGGER_PROJECT_ID) {
  throw new Error(
    "TRIGGER_PROJECT_ID no está definido. Agregalo al .env del root del monorepo.",
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
});
