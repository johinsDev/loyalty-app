import type { Notifiable, ResolvedNotifiable } from "./types";

/**
 * Resolves a recipient's contact info from persistent storage. The concrete
 * Drizzle implementation lives in the app/jobs bootstrap (it imports
 * `@loyalty/db`); the package ships only this interface so the engine stays
 * free of a hard DB dependency.
 */
export interface NotifiableRepository {
  /** Full contact info, or `null` if no such customer in the org. */
  resolve(
    customerId: string,
    organizationId: string,
  ): Promise<ResolvedNotifiable | null>;
}

/**
 * True when a `Notifiable` already carries every field a channel might need,
 * so the engine can skip the repository lookup. `phone` is mandatory on the
 * resolved shape, so a missing phone always forces a lookup.
 */
export function isFullyResolved(
  n: Notifiable,
): n is Notifiable & ResolvedNotifiable {
  return (
    typeof n.phone === "string" &&
    n.phone.length > 0 &&
    n.email !== undefined &&
    n.name !== undefined
  );
}
