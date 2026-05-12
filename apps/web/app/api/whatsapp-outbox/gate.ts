// Single source of truth for the env gate lives in `lib/dev-only.ts`.
// Kept here as a re-export so the API route handlers don't change.
export { isDevOnlyEnabled as isOutboxEndpointEnabled } from "@/lib/dev-only";
