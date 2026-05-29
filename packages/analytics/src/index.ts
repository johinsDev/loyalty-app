// Shared, environment-agnostic API of @loyalty/analytics.
// Server-only types/factories: `@loyalty/analytics/server`.
// Browser-only types/factories: `@loyalty/analytics/client`.
// React provider + hook:        `@loyalty/analytics/react`.
// See .claude/skills/analytics/SKILL.md for the full handbook.

export {
  AnalyticsError,
  MissingDependencyError,
  ProviderError,
} from "./errors";

export type {
  Analytics,
  AnalyticsBinding,
  AnalyticsEvent,
  AnalyticsLogger,
  AnalyticsStrategy,
  BaseProperties,
  EventProperties,
  NullProviderConfig,
  PostHogProviderConfig,
  ProviderConfig,
} from "./types";
