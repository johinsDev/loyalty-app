import type { RewardRow } from "@loyalty/db/schema";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import {
  type ActiveClaimView,
  activeClaimKey,
  cancelPendingClaim,
  type ClaimCurrencyChoice,
  claimCodeExpiresAt,
  CLAIM_CODE_TTL_SECONDS,
  generateClaimCode,
  loadActiveClaim,
  type PendingClaim,
  pendingClaimKey,
  requireCache,
  setPendingClaimCurrency,
  verifyPendingClaim,
} from "../_shared/claim-code";
import { invalidateLoyaltyConfig } from "../_shared/localize";
import { TIERS } from "../points/config";
import { tierFor } from "../points/tier-calc";
import type { WizardState } from "../_shared/wizard";
import type { CacheBinding, RealtimeBinding } from "../../trpc";
import { rewardTemplate } from "./templates";
import { rewardWizard } from "./wizard";
import {
  signRewardClaimToken,
  verifyRewardClaimToken,
} from "./claim-token";
import { affordableWith, deriveItem } from "./derive";
import { rewardBenefitSummary } from "./format";
import {
  type Balances,
  isAffordable,
  newlyReady,
  type RewardsRepository,
} from "./repository";
import type {
  AvailableRewardItem,
  HistoryInput,
  LevelsView,
  ListInput,
  RedemptionHistoryView,
  RequestClaimResult,
  ResolveClaimView,
  RewardAdminListInput,
  RewardDetail,
  RewardListItem,
  RewardListView,
  RewardPatchContentInput,
  RewardSection,
} from "./schemas";

export interface RewardWizardResult {
  reward: RewardRow;
  state: WizardState;
}

type NotificationKey =
  | "reward-claimed"
  | "reward-available"
  | "reward-claim-code"
  | "purchase-rewards-recap";

/** A reward that just became claimable for the customer (for the recap). */
export interface UnlockedReward {
  rewardId: string;
  name: string;
}

/** A tier transition detected during the purchase (folded into the recap). */
export interface TierUpEvent {
  tierName: string;
}

type EnqueuePayload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

export type Enqueue = (payload: EnqueuePayload) => Promise<void>;

// Untyped trigger by id — typing the payload would create an
// @loyalty/api → @loyalty/jobs cycle (mirrors StampsService / PointsService).
const defaultEnqueue: Enqueue = async (payload) => {
  await tasks.trigger("send-notification", payload);
};

export interface RewardsServiceOptions {
  realtime?: RealtimeBinding;
  /** HS256 secret for claim tokens (`REALTIME_AUTH_SECRET`). */
  signSecret: string;
  /** Read-through cache for the org catalog (optional → no caching in tests). */
  cache?: CacheBinding;
  enqueue?: Enqueue;
}

const CATALOG_TTL_SECONDS = 300;
/** Upper bound on the catalog we derive+filter in-memory before paginating.
 *  Comfortably above any realistic single-tenant reward count. */
const CATALOG_MAX = 1000;
/** Curated section keys, in display order. */
const SECTION_ORDER = ["novedades", "destacados"] as const;

/**
 * Rewards business logic: the customer catalog (status/progress derived from the
 * spendable balances + tier), the claim flow (issue signed QR → staff confirm →
 * deduct + record), the levels view, and the cashier "available now" nudge.
 * Side effects on claim are best-effort: realtime fires inline; the durable
 * confirmation goes through the Trigger.dev `send-notification` job.
 */
export class RewardsService {
  constructor(
    private readonly repo: RewardsRepository,
    private readonly opts: RewardsServiceOptions,
  ) {}

  async list(
    organizationId: string,
    customerId: string,
    input: ListInput,
  ): Promise<RewardListView> {
    // Derive + filter happen per-customer (balances/tier), so they MUST run
    // before pagination — otherwise a page of raw catalog rows can filter down
    // to nothing (e.g. "Listas para canjear" comes back empty) while ready
    // rewards sit on later pages the client never fetches. We fetch the whole
    // (search-filtered) catalog once, derive every item, apply the status
    // filter, THEN page the filtered list so each page is full and the cursor
    // tracks the filtered set.
    const rows = await this.cachedCatalog(organizationId, input.search, input.storeId);
    const [balances, tierKey, claimedCount, lastRedeemed] = await Promise.all([
      this.repo.balances(organizationId, customerId),
      this.repo.tierKey(organizationId, customerId),
      this.repo.claimedCountByReward(organizationId, customerId),
      this.repo.lastRedeemedAtByReward(organizationId, customerId),
    ]);

    const filtered = rows
      .map((rw) =>
        deriveItem(rw, {
          balances,
          tierKey,
          claimedCount: claimedCount.get(rw.id) ?? 0,
          redeemedAt: lastRedeemed.get(rw.id) ?? null,
        }),
      )
      .filter((it) => matchesFilter(it, input.filter));

    // Keyset paginate the filtered list on the stable item id.
    const startIdx = input.cursor
      ? filtered.findIndex((it) => it.id === input.cursor) + 1
      : 0;
    const page = filtered.slice(startIdx, startIdx + input.limit);
    const nextCursor =
      startIdx + input.limit < filtered.length
        ? (page[page.length - 1]?.id ?? null)
        : null;

    return {
      items: page,
      nextCursor,
      // Curated rows reflect the whole filtered set (not just this page).
      sections: buildSections(filtered),
    };
  }

  async detail(
    organizationId: string,
    customerId: string,
    rewardId: string,
  ): Promise<RewardDetail> {
    const rw = await this.repo.getReward(organizationId, rewardId);
    if (!rw || rw.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "REWARD_NOT_FOUND" });
    }
    const [balances, tierKey, claimedCount, lastRedeemed] = await Promise.all([
      this.repo.balances(organizationId, customerId),
      this.repo.tierKey(organizationId, customerId),
      this.repo.claimedCountByReward(organizationId, customerId),
      this.repo.lastRedeemedAtByReward(organizationId, customerId),
    ]);
    return deriveItem(rw, {
      balances,
      tierKey,
      claimedCount: claimedCount.get(rw.id) ?? 0,
      redeemedAt: lastRedeemed.get(rw.id) ?? null,
    });
  }

  async levels(organizationId: string, customerId: string): Promise<LevelsView> {
    const total = await this.repo.pointsTierTotal(organizationId, customerId);
    const view = tierFor(total);
    return {
      current: view.current,
      next: view.next,
      progress: view.progress,
      remainingToNext: view.remainingToNext,
      all: TIERS,
    };
  }

  recentRedemptions(organizationId: string, customerId: string) {
    return this.repo.recentRedemptions(organizationId, customerId, 3);
  }

  async history(
    organizationId: string,
    customerId: string,
    input: HistoryInput,
  ): Promise<RedemptionHistoryView> {
    return this.repo.redemptionHistory(organizationId, customerId, {
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      cursor: input.cursor,
      limit: input.limit,
    });
  }

  // ── Admin wizard (server-driven) ────────────────────────────────────────────
  async createDraft(
    orgId: string,
    userId: string,
    templateKey: string | undefined,
    locale: "es" | "en",
  ): Promise<RewardWizardResult> {
    let preseed = {};
    if (templateKey) {
      const tpl = rewardTemplate(templateKey);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: `template "${templateKey}"` });
      preseed = {
        name: locale === "en" ? tpl.name.en : tpl.name.es,
        type: tpl.type,
        benefit: tpl.benefit,
        description: locale === "en" ? tpl.description.en : tpl.description.es,
        icon: tpl.icon,
        backgroundCss: tpl.backgroundCss,
        fulfillmentNote: tpl.fulfillmentNote ?? null,
        stampsRequired: tpl.costPreset?.stampsRequired ?? null,
        pointsCost: tpl.costPreset?.pointsCost ?? null,
      };
    }
    const row = await this.repo.createDraft(orgId, userId, preseed);
    return { reward: row, state: rewardWizard.state(row) };
  }

  async getState(orgId: string, id: string): Promise<RewardWizardResult> {
    const row = await this.loadReward(orgId, id);
    return { reward: row, state: rewardWizard.state(row) };
  }

  async advance(
    orgId: string,
    userId: string,
    id: string,
    step: string,
    input: unknown,
  ): Promise<RewardWizardResult> {
    const current = await this.loadReward(orgId, id);
    if (current.status !== "draft")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Published rewards are immutable — archive and create a new one",
      });
    const { draft, state } = await rewardWizard.advance(
      { db: this.repo.db, organizationId: orgId, userId, services: { repo: this.repo } },
      current,
      step,
      input,
    );
    return { reward: draft, state };
  }

  async publishReward(orgId: string, id: string): Promise<RewardRow> {
    const current = await this.loadReward(orgId, id);
    if (current.status === "published") return current;
    if (current.status === "archived")
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Archived rewards can't be republished" });
    const state = rewardWizard.state(current);
    if (!state.canPublish)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Complete step "${state.current}" before publishing`,
      });
    if (current.type === "experience" && !current.fulfillmentNote?.trim())
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Experience rewards need a fulfillment note",
      });
    const published = await this.repo.markPublished(orgId, id);
    await this.invalidateCatalog(orgId);
    return published;
  }

  async archive(orgId: string, id: string): Promise<RewardRow> {
    const current = await this.loadReward(orgId, id);
    if (current.status === "archived") return current;
    const archived = await this.repo.markArchived(orgId, id);
    await this.invalidateCatalog(orgId);
    // Archiving the stamps-card prize breaks the link — drop the cached goal
    // so purchases/PWA fall back immediately instead of after the TTL.
    if (await this.repo.isCardReward(orgId, id)) {
      await invalidateLoyaltyConfig(orgId);
    }
    return archived;
  }

  async patchContent(orgId: string, input: RewardPatchContentInput): Promise<RewardRow> {
    await this.loadReward(orgId, input.id);
    const { id, imageUrl, ...rest } = input;
    const updated = await this.repo.patch(orgId, id, {
      ...rest,
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
    });
    await this.invalidateCatalog(orgId);
    return updated;
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    await this.loadReward(orgId, id);
    const uses = await this.repo.redemptionCount(id);
    if (uses > 0)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Reward has redemptions — archive it instead of deleting",
      });
    const wasCardReward = await this.repo.isCardReward(orgId, id);
    await this.repo.remove(orgId, id);
    await this.invalidateCatalog(orgId);
    if (wasCardReward) await invalidateLoyaltyConfig(orgId);
    return { ok: true };
  }

  adminList(orgId: string, input: RewardAdminListInput) {
    return this.repo.adminList(orgId, input);
  }

  getAdmin(orgId: string, id: string): Promise<RewardRow> {
    return this.loadReward(orgId, id);
  }

  private async loadReward(orgId: string, id: string): Promise<RewardRow> {
    const row = await this.repo.getReward(orgId, id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `reward "${id}" not found` });
    return row;
  }

  private async invalidateCatalog(orgId: string): Promise<void> {
    // The catalog cache is keyed per search term; clear the base key + drop the
    // whole namespace best-effort (mirrors how the reads warm it).
    await this.opts.cache?.delete(`rewards:catalog:${orgId}:`).catch(() => {});
  }

  /** Validate eligibility (active + tier + balance + once) then sign a token. */
  async issueClaimToken(
    organizationId: string,
    customerId: string,
    rewardId: string,
    currency: "stamps" | "points" | "both",
  ): Promise<{ token: string; expiresAt: string; rewardId: string }> {
    const rw = await this.assertEligible(
      organizationId,
      customerId,
      rewardId,
      currency,
    );

    const { token, expiresAt } = await signRewardClaimToken({
      customerId,
      rewardId: rw.id,
      currency,
      secret: this.opts.signSecret,
    });
    return { token, expiresAt, rewardId: rw.id };
  }

  /**
   * Cashier-initiated, code-based claim (the "no scanner" path). The customer
   * picks the currency on their phone, so the cashier no longer passes one. We
   * compute which currencies the customer can afford and:
   *   - "and" reward → decide `"both"` server-side (no choice).
   *   - single affordable currency → decide it server-side.
   *   - OR reward affordable with BOTH → leave `currency` undecided and persist
   *     `affordableWith` so the customer's app shows a sellos/puntos toggle;
   *     `setClaimCurrency` later records their pick.
   * Eligibility is still re-validated; a 6-digit code is held in the cache
   * (bound to the staff member). The code is delivered out-of-band (realtime +
   * WhatsApp) — never returned over HTTP.
   */
  async requestClaim(
    organizationId: string,
    staffId: string,
    customerId: string,
    rewardId: string,
    currency?: "stamps" | "points" | "both",
  ): Promise<RequestClaimResult> {
    const cache = requireCache(this.opts.cache);

    const rw = await this.repo.getReward(organizationId, rewardId);
    if (!rw || rw.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "REWARD_NOT_FOUND" });
    }

    // Decide the currency / affordable set. When the cashier passed an explicit
    // currency (legacy / single-option), honor it; otherwise derive from what
    // the customer can pay with right now.
    const balances = await this.repo.balances(organizationId, customerId);
    const isAndReward =
      rw.stampsRequired != null &&
      rw.pointsCost != null &&
      rw.costMode === "and";
    const affordable = affordableWith(rw, balances);

    let decided: "stamps" | "points" | "both" | undefined;
    let affordableWithChoices: ClaimCurrencyChoice[] | undefined;
    if (isAndReward) {
      decided = "both";
    } else if (currency != null) {
      // Honor an explicit pick from the caller (back-compat).
      decided = currency;
    } else if (affordable.length > 1) {
      // OR reward affordable with both → defer to the customer.
      decided = undefined;
      affordableWithChoices = affordable;
    } else {
      // Single affordable currency → decide it here.
      decided = affordable[0];
      affordableWithChoices = affordable;
    }

    // Eligibility gate: when undecided, validate against each affordable option;
    // otherwise validate the decided currency exactly like the token path.
    if (decided != null) {
      await this.assertEligible(organizationId, customerId, rewardId, decided);
    } else {
      // Undecided OR-both: assert both options are eligible (tier/once/balance).
      for (const c of affordable) {
        await this.assertEligible(organizationId, customerId, rewardId, c);
      }
    }

    const pendingId = crypto.randomUUID();
    const code = generateClaimCode();
    const expiresAt = claimCodeExpiresAt();
    const cost = {
      stamps: rw.stampsRequired ?? undefined,
      points: rw.pointsCost ?? undefined,
    };
    const pending: PendingClaim = {
      kind: "reward",
      customerId,
      organizationId,
      rewardId: rw.id,
      currency: decided,
      affordableWith: affordableWithChoices,
      code,
      staffId,
      rewardName: rw.name,
      cost,
      expiresAt,
      attempts: 0,
    };
    await cache.set(pendingClaimKey(pendingId), pending, CLAIM_CODE_TTL_SECONDS);
    // Secondary index so the customer's app can rehydrate the active code on
    // reload (the realtime event won't re-fire). One active claim per customer.
    await cache.set(
      activeClaimKey(customerId),
      pendingId,
      CLAIM_CODE_TTL_SECONDS,
    );

    // Surface the code to the customer's device (best-effort). `expiresAt` lets
    // the app run a live countdown and auto-clear the active-code state.
    // `affordableWith` + the (maybe-undecided) `currency` drive the on-phone
    // sellos/puntos toggle for an OR-both reward.
    await this.publish(customerId, {
      event: "reward.claim-code",
      data: {
        kind: "reward",
        pendingId,
        rewardName: rw.name,
        cost,
        code,
        expiresAt,
        affordableWith: affordableWithChoices,
        currency:
          decided === "stamps" || decided === "points" ? decided : undefined,
      },
    });
    await this.enqueue({
      customerIds: [customerId],
      organizationId,
      notificationKey: "reward-claim-code",
      payload: { rewardName: rw.name, code },
    });

    return { pendingId, expiresAt };
  }

  /**
   * Customer-initiated currency pick for an OR reward affordable with both
   * stamps and points (the chooser lives on the customer's phone). Verifies the
   * pending belongs to this customer and the currency is in its `affordableWith`,
   * then records the choice under the same TTL. `confirmClaimWithCode` then
   * deducts from the chosen balance.
   */
  async setClaimCurrency(
    customerId: string,
    pendingId: string,
    currency: ClaimCurrencyChoice,
  ): Promise<{ ok: true }> {
    const cache = requireCache(this.opts.cache);
    return setPendingClaimCurrency(cache, pendingId, customerId, currency);
  }

  /**
   * Customer-initiated cancel of a pending code-based claim. Idempotent (a
   * missing pending → `{ ok: true }`), ownership-checked against the customer,
   * and it publishes `reward.claim-code-cancelled` so the customer's other
   * tabs/devices clear their active-code state.
   */
  async cancelClaim(
    customerId: string,
    pendingId: string,
  ): Promise<{ ok: true }> {
    const cache = requireCache(this.opts.cache);
    const { cancelled } = await cancelPendingClaim(cache, pendingId, customerId);
    if (cancelled) {
      await this.publish(customerId, {
        event: "reward.claim-code-cancelled",
        data: { pendingId },
      });
    }
    return { ok: true };
  }

  /**
   * Confirm a code-based claim: validate the OTP (existence, staff binding,
   * lockout, code match) then run the SAME deduction the scanner path uses.
   */
  /**
   * Staff: verify a no-scanner 6-digit code and RESOLVE it (v2 — no redemption
   * here). Keeps the pending-claim lockout/attempts/staff-binding, clears the
   * pending + active code (so the customer's phone sheet closes), and returns
   * the reward for the register to preselect. Redemption happens in
   * `recordPurchase`.
   */
  async resolveClaimWithCode(
    organizationId: string,
    staffId: string,
    pendingId: string,
    code: string,
  ): Promise<ResolveClaimView> {
    const cache = requireCache(this.opts.cache);
    const pending = await verifyPendingClaim(cache, pendingId, code, staffId);

    const rw = await this.repo.getReward(organizationId, pending.rewardId);
    if (!rw || rw.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "REWARD_NOT_FOUND" });
    }

    const currency = pending.currency ?? pending.affordableWith?.[0] ?? "stamps";
    await cache.delete(pendingClaimKey(pendingId));
    await cache.delete(activeClaimKey(pending.customerId));
    // Close the customer's active-code sheet (reuse the cancel event).
    await this.publish(pending.customerId, {
      event: "reward.claim-code-cancelled",
      data: { rewardId: rw.id },
    });
    return this.resolveView(pending.customerId, rw, currency);
  }

  /**
   * Server-authoritative read of the customer's current active claim code, used
   * by the app to rehydrate the active-code banner/sheet after a reload (when
   * the realtime `reward.claim-code` event won't re-fire). Covers both reward
   * and streak claims (they share the cache index). Returns null when nothing is
   * active (no cache, no pending, expired, or foreign).
   */
  myActiveClaim(customerId: string): Promise<ActiveClaimView | null> {
    return loadActiveClaim(this.opts.cache, customerId);
  }

  /**
   * Staff: verify a scanned reward token and RESOLVE it (v2 — no redemption
   * here). Returns the customer + reward so the register opens with the reward
   * preselected; redemption happens in `recordPurchase`. The token stays valid
   * (stateless HMAC) until consumed by the sale — the once/balance guards run
   * inside that tx, so resolving without redeeming introduces no replay hole.
   */
  async resolveClaim(organizationId: string, token: string): Promise<ResolveClaimView> {
    let parsed: {
      customerId: string;
      rewardId: string;
      currency: "stamps" | "points" | "both";
    };
    try {
      parsed = await verifyRewardClaimToken(token, this.opts.signSecret);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_TOKEN" });
    }

    const rw = await this.repo.getReward(organizationId, parsed.rewardId);
    if (!rw || rw.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "REWARD_NOT_FOUND" });
    }
    return this.resolveView(parsed.customerId, rw, parsed.currency);
  }

  /** Shared reward → resolve payload (staff-facing; includes fulfillmentNote). */
  private resolveView(
    customerId: string,
    rw: RewardRow,
    currency: "stamps" | "points" | "both",
  ): ResolveClaimView {
    return {
      customerId,
      currency,
      reward: {
        id: rw.id,
        name: rw.name,
        type: rw.type,
        benefitSummary: rewardBenefitSummary(rw.benefit, "es"),
        fulfillmentNote: rw.fulfillmentNote,
        costMode: rw.costMode as ResolveClaimView["reward"]["costMode"],
        stampsRequired: rw.stampsRequired,
        pointsCost: rw.pointsCost,
      },
    };
  }

  /** Staff: rewards the customer can claim right now (cashier nudge). */
  async availableForCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<AvailableRewardItem[]> {
    const { rows } = await this.repo.listCatalog(organizationId, { limit: 500 });
    const [balances, tierKey, claimed] = await Promise.all([
      this.repo.balances(organizationId, customerId),
      this.repo.tierKey(organizationId, customerId),
      this.repo.claimedRewardIds(organizationId, customerId),
    ]);
    return rows
      .filter((rw) => {
        if (rw.allowedTiers && !rw.allowedTiers.includes(tierKey)) return false;
        if (rw.limitPerCustomer === "once" && claimed.has(rw.id)) return false;
        return isAffordable(rw, balances);
      })
      .map((rw) => ({
        rewardId: rw.id,
        name: rw.name,
        stampsRequired: rw.stampsRequired,
        pointsCost: rw.pointsCost,
        costMode: rw.costMode as "or" | "and",
        // Only the currencies the customer can actually pay with right now, so
        // the cashier shows affordable options and defaults to the first.
        affordableWith: affordableWith(rw, balances),
      }));
  }

  /**
   * Post-purchase unlock detection + aggregated outcome. Given the customer's
   * points+stamps balances BEFORE and AFTER the purchase (plus any tier-up the
   * points recompute reported), finds the rewards that just became claimable,
   * arms their availability rows, and emits ONE aggregated notification:
   *   - Realtime: a single combined `rewards.unlocked` to `customer:<id>`.
   *   - WhatsApp + Push: ONE combined recap summarizing all events.
   *   - Database: N granular feed rows (the recap line + one per unlocked reward).
   * Best-effort: never throws (the purchase already committed). Returns the
   * unlocked rewards so the caller can log / test.
   */
  async processPurchaseUnlocks(
    organizationId: string,
    customerId: string,
    before: Balances,
    after: Balances,
    opts: { tierUp?: TierUpEvent | null } = {},
  ): Promise<UnlockedReward[]> {
    try {
      const [{ rows }, tierKey, claimedIds] = await Promise.all([
        this.repo.listCatalog(organizationId, { limit: 500 }),
        this.repo.tierKey(organizationId, customerId),
        this.repo.claimedRewardIds(organizationId, customerId),
      ]);

      const unlocked = newlyReady(rows, before, after, {
        tierKey,
        claimedRewardIds: claimedIds,
      }).map((rw) => ({ rewardId: rw.id, name: rw.name }));

      // Arm availability for each newly-ready reward (drives the reminder cron).
      await Promise.all(
        unlocked.map((u) =>
          this.repo
            .upsertAvailable(organizationId, customerId, u.rewardId)
            .catch(() => {}),
        ),
      );

      const tierUp = opts.tierUp ?? null;
      // Nothing notable beyond routine earn → the stamps/points recap already
      // covers it; don't double up.
      if (unlocked.length === 0 && !tierUp) return unlocked;

      // ONE combined realtime celebration (tier-up + every unlocked reward), so
      // the app shows a single moment instead of stacking animations. The
      // dedicated tier-up notification (from the points recompute) already owns
      // the tier WhatsApp/push/feed; here tierUp only enriches this one event.
      await this.publish(customerId, {
        event: "rewards.unlocked",
        data: {
          rewards: unlocked,
          tierUp: tierUp ? { tierName: tierUp.tierName } : null,
        },
      });

      if (unlocked.length > 0) {
        // ONE combined WhatsApp + push recap summarizing all unlocked rewards
        // (never N WhatsApps). It writes a single "rewards unlocked" feed row.
        await this.enqueue({
          customerIds: [customerId],
          organizationId,
          notificationKey: "purchase-rewards-recap",
          payload: { rewards: unlocked },
        });

        // N granular DB rows — one per unlocked reward (database channel only).
        await Promise.all(
          unlocked.map((u) =>
            this.enqueue({
              customerIds: [customerId],
              organizationId,
              notificationKey: "reward-available",
              payload: {
                rewardId: u.rewardId,
                rewardName: u.name,
                channelsOnly: "database",
              },
            }),
          ),
        );
      }

      return unlocked;
    } catch {
      // best-effort: a failure here never affects the committed purchase.
      return [];
    }
  }

  // ---- helpers --------------------------------------------------------------

  /**
   * Eligibility gate shared by the token path (`issueClaimToken`) and the
   * code path (`requestClaim`): active reward + tier allowed + currency valid +
   * balance sufficient + not already-claimed-if-once. Returns the reward row.
   * Throws the typed errors NOT_ELIGIBLE / INSUFFICIENT_BALANCE / TIER_LOCKED /
   * ALREADY_CLAIMED / REWARD_NOT_FOUND so both paths can't drift.
   */
  private async assertEligible(
    organizationId: string,
    customerId: string,
    rewardId: string,
    currency: "stamps" | "points" | "both",
  ): Promise<RewardRow> {
    const rw = await this.repo.getReward(organizationId, rewardId);
    if (!rw || rw.status !== "published") {
      throw new TRPCError({ code: "NOT_FOUND", message: "REWARD_NOT_FOUND" });
    }

    // Tier gate.
    const tierKey = await this.repo.tierKey(organizationId, customerId);
    if (rw.allowedTiers && !rw.allowedTiers.includes(tierKey)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "TIER_LOCKED" });
    }

    // Once-limit.
    if (rw.limitPerCustomer === "once") {
      const claimed = await this.repo.claimedRewardIds(organizationId, customerId);
      if (claimed.has(rw.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "ALREADY_CLAIMED" });
      }
    }

    // The chosen currency must be accepted by the reward; "both" only for "and".
    this.assertCurrencyValid(rw, currency);

    // Balance check for the chosen currency/currencies.
    const balances = await this.repo.balances(organizationId, customerId);
    if (!this.canPayWith(rw, balances, currency)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "INSUFFICIENT_BALANCE",
      });
    }

    return rw;
  }

  /** The whole (search-filtered) active catalog, ordered. Cached per search
   *  term only — pagination + the per-customer filter happen in `list`, so the
   *  cache key never includes a cursor. */
  private async cachedCatalog(
    organizationId: string,
    search: string | undefined,
    storeId?: string,
  ): Promise<RewardRow[]> {
    const load = async () =>
      (await this.repo.listCatalog(organizationId, { search, storeId, limit: CATALOG_MAX }))
        .rows;
    if (!this.opts.cache) return load();
    const key = `rewards:catalog:${organizationId}:${storeId ?? ""}:${search ?? ""}`;
    return this.opts.cache.getOrSet(key, load, CATALOG_TTL_SECONDS);
  }

  private assertCurrencyValid(
    rw: { stampsRequired: number | null; pointsCost: number | null; costMode: string },
    currency: "stamps" | "points" | "both",
  ): void {
    const hasStamps = rw.stampsRequired != null;
    const hasPoints = rw.pointsCost != null;
    // An "and" reward (both costs set) must be paid with "both".
    const isAndReward = hasStamps && hasPoints && rw.costMode === "and";
    if (currency === "both") {
      if (!isAndReward) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "NOT_ELIGIBLE" });
      }
      return;
    }
    if (isAndReward) {
      // A single currency can't satisfy an "and" reward.
      throw new TRPCError({ code: "BAD_REQUEST", message: "NOT_ELIGIBLE" });
    }
    if (currency === "stamps" && !hasStamps) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "NOT_ELIGIBLE" });
    }
    if (currency === "points" && !hasPoints) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "NOT_ELIGIBLE" });
    }
  }

  private canPayWith(
    rw: { stampsRequired: number | null; pointsCost: number | null },
    balances: { stamps: number; points: number },
    currency: "stamps" | "points" | "both",
  ): boolean {
    const stampsOk =
      rw.stampsRequired == null || balances.stamps >= rw.stampsRequired;
    const pointsOk =
      rw.pointsCost == null || balances.points >= rw.pointsCost;
    if (currency === "stamps") return rw.stampsRequired != null && balances.stamps >= rw.stampsRequired;
    if (currency === "points") return rw.pointsCost != null && balances.points >= rw.pointsCost;
    // both
    return stampsOk && pointsOk;
  }

  private async publish(
    customerId: string,
    event: { event: string; data: Record<string, unknown> },
  ): Promise<void> {
    if (!this.opts.realtime) return;
    await this.opts.realtime.publish(`customer:${customerId}`, event).catch(() => {
      // best-effort
    });
  }

  private async enqueue(payload: EnqueuePayload): Promise<void> {
    const fn = this.opts.enqueue ?? defaultEnqueue;
    try {
      await fn(payload);
    } catch {
      // best-effort
    }
  }
}

/** Apply the customer-facing filter to a derived item. */
function matchesFilter(it: RewardListItem, filter: ListInput["filter"]): boolean {
  switch (filter) {
    case "listos":
      return it.status === "ready";
    case "proximos":
      return it.status === "upcoming";
    case "canjeados":
      return it.status === "redeemed";
    default:
      return true;
  }
}

/** Group items into curated rows by their `sections`, in display order. */
function buildSections(items: RewardListItem[]): RewardSection[] {
  const out: RewardSection[] = [];
  for (const key of SECTION_ORDER) {
    const matched = items.filter((it) => it.sections.includes(key));
    if (matched.length > 0) out.push({ key, items: matched });
  }
  return out;
}
