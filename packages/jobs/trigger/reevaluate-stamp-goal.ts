import { db, listCustomersWithStampsAtLeast } from "@loyalty/db";
import { isAffordable, RewardsRepository } from "@loyalty/api/features/rewards";
import { logger, task } from "@trigger.dev/sdk/v3";

// Untyped at the boundary on purpose — the settings service enqueues this by
// id (`tasks.trigger("reevaluate-stamp-goal", …)`) to avoid an api → jobs cycle.
type Payload = {
  organizationId: string;
  rewardId: string;
};

/**
 * After the stamps goal is lowered (or the card prize relinked), customers may
 * already sit at/over the new goal — but `newlyReady` only runs on purchase,
 * so without this they'd wait for their next sale to see the prize unlocked.
 * Walks the candidate cards and arms `reward_availability` for everyone who
 * now qualifies (tier gate + once-claimed + affordability, same guards as the
 * purchase path). NO immediate push: the armed rows enter the existing
 * d2/d7/d30 reminder cron, and the PWA shows the prize as ready on next open.
 * Raising the goal never revokes availability (handled by never enqueueing).
 */
export const reevaluateStampGoalTask = task({
  id: "reevaluate-stamp-goal",
  maxDuration: 300,
  run: async ({ organizationId, rewardId }: Payload) => {
    const repo = new RewardsRepository(db);
    const reward = await repo.getReward(organizationId, rewardId);
    if (!reward || reward.status !== "published" || reward.stampsRequired == null) {
      logger.info("reevaluate-stamp-goal skipped: link not healthy", {
        organizationId,
        rewardId,
      });
      return { skipped: true as const };
    }

    const candidates = await listCustomersWithStampsAtLeast(
      organizationId,
      reward.stampsRequired,
    );

    let armed = 0;
    for (const customerId of candidates) {
      // Same guards as the post-purchase unlock path (tier, once, cost).
      if (reward.allowedTiers) {
        const tier = await repo.tierKey(organizationId, customerId);
        if (!reward.allowedTiers.includes(tier)) continue;
      }
      if (reward.limitPerCustomer === "once") {
        const claimed = await repo.claimedRewardIds(organizationId, customerId);
        if (claimed.has(reward.id)) continue;
      }
      const balances = await repo.balances(organizationId, customerId);
      if (!isAffordable(reward, balances)) continue;

      await repo.upsertAvailable(organizationId, customerId, reward.id);
      armed += 1;
    }

    const result = { candidates: candidates.length, armed };
    logger.info("reevaluate-stamp-goal done", result);
    return result;
  },
});
