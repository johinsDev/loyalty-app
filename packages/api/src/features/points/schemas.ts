import { z } from "zod";

import type { TierConfig } from "./config";
import { WINDOW_DAYS } from "./config";

export { WINDOW_DAYS };

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

export const historyInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/** The customer's points + tier, shaped for the FE. `current`/`next` are the
 *  full tier configs (name, color, icon, benefits, terms) so the card + the
 *  level-up celebration render straight from this. */
export interface PointsSummary {
  balance: number;
  /** Points earned within the rolling window (drives the tier). */
  tierPoints: number;
  windowDays: number;
  current: TierConfig;
  next: TierConfig | null;
  /** 0..1 toward the next tier. */
  progress: number;
  remainingToNext: number;
  nearNext: boolean;
}

export interface PointsHistoryItem {
  id: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  reason: string | null;
  createdAt: Date;
}

export type HistoryInput = z.infer<typeof historyInputSchema>;
