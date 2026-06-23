import { z } from "zod";

import { STREAK_GOAL_DAYS } from "./config";

export { STREAK_GOAL_DAYS };

// Customer ids mirror Better Auth `user.id`, so all customer-id inputs are a
// non-empty string (not necessarily a UUID).
export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

export const claimInputSchema = z.object({
  token: z.string().min(1),
});

export type StreakStatus = "active" | "completed" | "claimed";

/** Per-day state for the L-D week strip on the card. */
export type DayState = "done" | "closed" | "missed" | "today" | "future";

export interface StreakDay {
  date: string; // YYYY-MM-DD (store-local)
  weekday: number; // 0 = Sun … 6 = Sat
  state: DayState;
}

/** The customer's current streak, shaped for the FE. `rewardPending` = a
 *  completed streak waiting to be claimed (paused until then). `week` is the
 *  current calendar week (Mon→Sun) for the strip. */
export interface StreakView {
  currentCount: number;
  goalDays: number;
  status: StreakStatus;
  rewardPending: boolean;
  week: StreakDay[];
}

export interface StreakHistoryItem {
  id: string;
  sequence: number;
  status: "completed" | "claimed";
  completedAt: Date | null;
  claimedAt: Date | null;
}
