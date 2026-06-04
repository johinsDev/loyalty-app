export { baseProperties, resolveDistinctId } from "./analytics";
export { appRouter, type AppRouter } from "./routers/_app";
export { type CaptureError, createContext, type Context } from "./trpc";
// FE wizard step schemas are shared via the client-safe subpath
// `@loyalty/api/features/promotions/schemas` (NOT this barrel — it pulls in
// `@trpc/server`). See `.claude/skills/wizard/SKILL.md`.
