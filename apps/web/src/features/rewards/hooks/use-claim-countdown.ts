import { useCountDown } from "ahooks";

/**
 * Live countdown to an ISO `expiresAt`. Returns the remaining time formatted as
 * `mm:ss` plus an `expired` flag the moment it hits zero. `onExpire` fires once
 * when the countdown reaches zero (used to auto-clear the active-code state).
 */
export function useClaimCountdown(
  expiresAt: string | undefined,
  onExpire?: () => void,
): { label: string; expired: boolean } {
  // Pass the ISO string straight through — ahooks keys its internal timer on the
  // `targetDate` value, so constructing a fresh `new Date(...)` each render would
  // re-arm the timer every render and loop. The string is stable across renders.
  const [remaining] = useCountDown({
    targetDate: expiresAt,
    // Only fire the expiry callback when an actual target is set, so a cleared
    // store (no `expiresAt`) doesn't re-trigger `onExpire`.
    onEnd: expiresAt ? onExpire : undefined,
  });

  const totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return { label, expired: expiresAt != null && remaining <= 0 };
}
