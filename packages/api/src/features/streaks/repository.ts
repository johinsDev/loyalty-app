import type { db as Db } from "@loyalty/db";
import { streak, type StreakRow } from "@loyalty/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

import { STREAK_GOAL_DAYS } from "./config";
import {
  addDays,
  isOpenDay,
  localDay,
  mostRecentPassedOpenDay,
  openDaysBetween,
  weekdayOf,
} from "./streak-calendar";
import type {
  DayState,
  StreakDay,
  StreakHistoryItem,
  StreakStatus,
  StreakView,
} from "./schemas";

export type AdvanceResult = {
  changed: boolean;
  completed: boolean;
  currentCount: number;
};

export type ClaimResult = { kind: "claimed" } | { kind: "not_pending" };

/** Monday→Sunday `YYYY-MM-DD` for the local week containing `today`. */
function weekDays(today: string): string[] {
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Drizzle access for streaks. Mirrors the stamps repo: the streak `lifecycle`
 * (`active` → `completed` → `claimed`) lives in one row per attempt, advanced
 * transactionally per purchase. The only layer that touches the db.
 */
export class StreaksRepository {
  constructor(private readonly db: typeof Db) {}

  private byStatus(
    orgId: string,
    customerId: string,
    status: StreakStatus,
  ): Promise<StreakRow | undefined> {
    return this.db
      .select()
      .from(streak)
      .where(
        and(
          eq(streak.organizationId, orgId),
          eq(streak.customerId, customerId),
          eq(streak.status, status),
        ),
      )
      .orderBy(desc(streak.sequence))
      .limit(1)
      .then((r) => r[0]);
  }

  /** Advance the streak for a purchase on local `day`. Idempotent per day; a
   *  completed-unclaimed streak is paused (no-op). Runs in its own transaction. */
  async advanceForPurchase(input: {
    orgId: string;
    customerId: string;
    day: string;
  }): Promise<AdvanceResult> {
    const { orgId, customerId, day } = input;
    return this.db.transaction(async (tx) => {
      const latest = async (status: StreakStatus): Promise<StreakRow | undefined> =>
        tx
          .select()
          .from(streak)
          .where(
            and(
              eq(streak.organizationId, orgId),
              eq(streak.customerId, customerId),
              eq(streak.status, status),
            ),
          )
          .orderBy(desc(streak.sequence))
          .limit(1)
          .then((r) => r[0]);

      // Paused: a completed (reward-pending) streak doesn't advance until claimed.
      const pending = await latest("completed");
      if (pending) {
        return { changed: false, completed: false, currentCount: pending.currentCount };
      }

      const active = await latest("active");

      // No active streak → start a fresh one at 1.
      if (!active) {
        const maxRows = await tx
          .select({ sequence: streak.sequence })
          .from(streak)
          .where(and(eq(streak.organizationId, orgId), eq(streak.customerId, customerId)))
          .orderBy(desc(streak.sequence))
          .limit(1);
        const completed = 1 >= STREAK_GOAL_DAYS;
        await tx.insert(streak).values({
          customerId,
          organizationId: orgId,
          currentCount: 1,
          goalDays: STREAK_GOAL_DAYS,
          status: completed ? "completed" : "active",
          sequence: (maxRows[0]?.sequence ?? 0) + 1,
          lastPurchaseDay: day,
          completedAt: completed ? new Date() : null,
        });
        return { changed: true, completed, currentCount: 1 };
      }

      // Already counted today.
      if (active.lastPurchaseDay === day) {
        return { changed: false, completed: false, currentCount: active.currentCount };
      }

      // Continue if no OPEN day was missed since the last purchase; else reset.
      const missed = active.lastPurchaseDay
        ? openDaysBetween(active.lastPurchaseDay, day)
        : 0;
      const newCount = missed === 0 ? active.currentCount + 1 : 1;
      const completed = newCount >= active.goalDays;

      await tx
        .update(streak)
        .set({
          currentCount: newCount,
          lastPurchaseDay: day,
          status: completed ? "completed" : "active",
          completedAt: completed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(streak.id, active.id));

      return { changed: true, completed, currentCount: newCount };
    });
  }

  /** The completed (reward-pending, unclaimed) streak, if any. */
  pendingReward(orgId: string, customerId: string): Promise<StreakRow | undefined> {
    return this.byStatus(orgId, customerId, "completed");
  }

  /** Mark the completed streak claimed. Single-use via the `status = completed`
   *  guard. No new streak is opened — the next purchase starts a fresh one. */
  async claimStreak(input: {
    orgId: string;
    streakId: string;
    customerId: string;
    claimedByUserId: string;
  }): Promise<ClaimResult> {
    const updated = await this.db
      .update(streak)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        claimedByUserId: input.claimedByUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(streak.id, input.streakId),
          eq(streak.organizationId, input.orgId),
          eq(streak.customerId, input.customerId),
          eq(streak.status, "completed"),
        ),
      )
      .returning();
    return updated[0] ? { kind: "claimed" } : { kind: "not_pending" };
  }

  /** The streak shaped for the FE, with break-on-read + the week strip. The
   *  strip's "done" cells are the streak's own days (so the count and the ticks
   *  always agree) — not raw purchases, which could pre-date or sit outside the
   *  current run. */
  async view(orgId: string, customerId: string): Promise<StreakView> {
    const now = new Date();
    const today = localDay(now);

    const current =
      (await this.byStatus(orgId, customerId, "active")) ??
      (await this.byStatus(orgId, customerId, "completed"));

    // Resolve the effective count + the day the run ends on (break-on-read for
    // an active streak whose last purchase is older than the last closed day).
    let count = 0;
    let lastDay: string | null = null;
    let status: StreakStatus = "active";
    let rewardPending = false;
    let goalDays = STREAK_GOAL_DAYS;

    if (current) {
      goalDays = current.goalDays;
      if (current.status === "completed") {
        count = current.currentCount;
        lastDay = current.lastPurchaseDay;
        status = "completed";
        rewardPending = true;
      } else {
        const lastPassed = mostRecentPassedOpenDay(now);
        const broken =
          !current.lastPurchaseDay ||
          (lastPassed !== null && current.lastPurchaseDay < lastPassed);
        count = broken ? 0 : current.currentCount;
        lastDay = broken ? null : current.lastPurchaseDay;
      }
    }

    const runDays = streakRunDays(lastDay, count);
    const week: StreakDay[] = weekDays(today).map((date) => ({
      date,
      weekday: weekdayOf(date),
      state: dayState(date, today, runDays),
    }));

    return { currentCount: count, goalDays, status, rewardPending, week };
  }

  /** Active streaks at risk of breaking today (used by the reminder cron):
   *  intact up to the last closed open day, not bought today, not yet reminded. */
  async atRiskCustomers(
    orgId: string,
    lastPassedDay: string,
    today: string,
  ): Promise<Array<{ id: string; customerId: string; currentCount: number }>> {
    const rows = await this.db
      .select({
        id: streak.id,
        customerId: streak.customerId,
        currentCount: streak.currentCount,
        lastPurchaseDay: streak.lastPurchaseDay,
        lastReminderDay: streak.lastReminderDay,
      })
      .from(streak)
      .where(and(eq(streak.organizationId, orgId), eq(streak.status, "active")));

    return rows
      .filter(
        (r) =>
          r.currentCount >= 1 &&
          r.lastPurchaseDay === lastPassedDay &&
          r.lastPurchaseDay !== today &&
          r.lastReminderDay !== today,
      )
      .map((r) => ({ id: r.id, customerId: r.customerId, currentCount: r.currentCount }));
  }

  async markReminded(streakIds: string[], day: string): Promise<void> {
    if (streakIds.length === 0) return;
    await this.db
      .update(streak)
      .set({ lastReminderDay: day, updatedAt: new Date() })
      .where(inArray(streak.id, streakIds));
  }

  async history(orgId: string, customerId: string): Promise<StreakHistoryItem[]> {
    const rows = await this.db
      .select()
      .from(streak)
      .where(
        and(
          eq(streak.organizationId, orgId),
          eq(streak.customerId, customerId),
          inArray(streak.status, ["completed", "claimed"]),
        ),
      )
      .orderBy(desc(streak.sequence));
    return rows.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      status: s.status as "completed" | "claimed",
      completedAt: s.completedAt,
      claimedAt: s.claimedAt,
    }));
  }
}

/** The calendar days that make up the streak run: walk back `count` OPEN days
 *  from `lastDay` (closed days are skipped, exactly as the streak counts them). */
function streakRunDays(lastDay: string | null, count: number): Set<string> {
  const days = new Set<string>();
  if (!lastDay || count <= 0) return days;
  let d = lastDay;
  let remaining = count;
  // Bound the walk well past any realistic streak length.
  for (let guard = 0; remaining > 0 && guard < 400; guard += 1) {
    if (isOpenDay(d)) {
      days.add(d);
      remaining -= 1;
    }
    if (remaining === 0) break;
    d = addDays(d, -1);
  }
  return days;
}

function dayState(
  date: string,
  today: string,
  runDays: Set<string>,
): DayState {
  if (runDays.has(date)) return "done";
  if (!isOpenDay(date)) return "closed";
  if (date > today) return "future";
  if (date === today) return "today";
  return "missed";
}
