import { create } from "zustand";

/** Which reward loop minted the active claim code — selects the cancel mutation. */
export type ClaimCodeKind = "reward" | "streak";

/** A single payable currency the customer can pick for an OR reward. */
export type ClaimCurrency = "stamps" | "points";

/**
 * The cashier-initiated 6-digit claim code the customer currently holds (the
 * "no scanner" path). Pushed over realtime as `reward.claim-code`. Kept here so
 * it survives closing the code sheet: the customer can re-view it from a
 * persistent banner and cancel it (server-side revoke) until it's claimed or
 * expires.
 */
export interface ActiveClaimCode {
  pendingId: string;
  code: string;
  rewardName?: string;
  /** Reward cost (rewards only); streaks deduct a fixed reward. */
  cost?: { stamps?: number; points?: number };
  /** ISO timestamp the code expires — drives the live countdown + auto-clear. */
  expiresAt: string;
  kind: ClaimCodeKind;
  /** Currencies the customer can pay this reward with (rewards only). When
   *  length > 1 the customer picks one on their phone (the sellos/puntos toggle). */
  affordableWith?: ClaimCurrency[];
  /** The currency the customer chose (or the server decided). `undefined` while
   *  an OR-both reward is still awaiting the customer's pick. */
  currency?: ClaimCurrency;
}

/**
 * App-wide active-claim-code state. Set when a `reward.claim-code` event
 * arrives; cleared on `reward.claimed`, `reward.claim-code-cancelled`, an
 * explicit customer cancel, or the countdown reaching zero. Mounted once
 * (alongside `RealtimeNotifications`) so the banner + sheet show over any
 * screen.
 */
type ActiveClaimCodeState = {
  active: ActiveClaimCode | null;
  set: (claim: ActiveClaimCode) => void;
  /** Optimistically record the customer's currency pick (OR-both reward). */
  setCurrency: (currency: ClaimCurrency) => void;
  clear: () => void;
};

export const useActiveClaimCode = create<ActiveClaimCodeState>((set) => ({
  active: null,
  set: (claim) => set({ active: claim }),
  setCurrency: (currency) =>
    set((s) => (s.active ? { active: { ...s.active, currency } } : s)),
  clear: () => set({ active: null }),
}));
