/**
 * Multi-variant flags return a string (the variant name); kill-switch /
 * boolean flags return a boolean. PostHog mirrors this — `getFeatureFlag`
 * returns either, `isFeatureEnabled` collapses to a boolean.
 */
export type FlagValue = string | boolean;

/**
 * Canonical flag keys. Adding a flag = extend this union AND note it in
 * `.claude/skills/feature-flags/SKILL.md`. Strings are still accepted at
 * runtime so a new flag isn't blocked on a type bump.
 */
export type FlagKey =
  | "new-stamp-flow"
  | "new-rewards-page"
  | (string & {});

export interface FlagsLogger {
  debug(bindings: Record<string, unknown>, msg?: string): void;
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

/** Server strategy — every provider implements this shape. */
export interface FlagsStrategy {
  readonly name: string;
  isEnabled(args: { distinctId: string; key: FlagKey }): Promise<boolean | undefined>;
  getValue(args: { distinctId: string; key: FlagKey }): Promise<FlagValue | undefined>;
  getAllFlags(args: { distinctId: string }): Promise<Record<string, FlagValue>>;
  shutdown(): Promise<void>;
}

export interface NullProviderConfig {
  provider: "null";
}

export interface PostHogProviderConfig {
  provider: "posthog";
  /** PostHog project API key (`phc_...`). Public, embeddable. */
  apiKey: string;
  /** `https://us.i.posthog.com` (default) or your self-hosted host. */
  host?: string;
}

export type ProviderConfig = NullProviderConfig | PostHogProviderConfig;

/**
 * Per-request shape bound on the tRPC ctx. `distinctId` is pre-resolved
 * so routers just call `await ctx.flags?.isEnabled("new-stamp-flow")`.
 */
export interface FlagsBinding {
  isEnabled(key: FlagKey, defaultValue?: boolean): Promise<boolean>;
  getValue(key: FlagKey, defaultValue?: FlagValue): Promise<FlagValue>;
  getAllFlags(): Promise<Record<string, FlagValue>>;
}

/** Browser-side surface returned by `createFlags` + exposed by the React Context. */
export interface Flags {
  isEnabled(key: FlagKey, defaultValue?: boolean): boolean;
  getValue(key: FlagKey, defaultValue?: FlagValue): FlagValue;
  /** Force a refresh of the cached flag state. */
  reload(): void;
  /** True once posthog's initial flag fetch has resolved. */
  isLoaded(): boolean;
  /**
   * Subscribe to flag updates. Returns an unsubscribe fn. The React
   * provider uses this to re-render consumers when flags load/change.
   */
  onChange(cb: () => void): () => void;
}
