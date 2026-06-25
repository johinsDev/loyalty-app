// Reward-availability reminder cadence — hardcoded for the pilot (becomes
// admin-configurable later, same seam as points/streaks config).

/** Master switch for the daily reward-reminder cron. */
export const REMINDER_ENABLED = true;

const DAY_MS = 86_400_000;

/**
 * Reminder stages by age of the unclaimed availability row. `immediate` is the
 * unlock notification (sent by the purchase flow, not the cron); the cron only
 * advances through these later stages, once each.
 */
export const REMINDER_STAGES: { stage: string; afterMs: number }[] = [
  { stage: "d2", afterMs: 2 * DAY_MS },
  { stage: "d7", afterMs: 7 * DAY_MS },
  { stage: "d30", afterMs: 30 * DAY_MS },
];
