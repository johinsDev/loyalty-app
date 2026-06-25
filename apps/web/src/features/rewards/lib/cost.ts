import type { RewardCurrency, RewardListItem } from "../types";

/** Currencies this reward accepts a cost in (a `required` value set). */
export function acceptedCurrencies(reward: RewardListItem): RewardCurrency[] {
  const out: RewardCurrency[] = [];
  if (reward.stamps.required != null) out.push("stamps");
  if (reward.points.required != null) out.push("points");
  return out;
}

/**
 * The currency to spend when the user taps "Canjear" — only meaningful when the
 * choice is unambiguous (a single accepted currency, or an "and" reward where
 * both must be paid). Returns null when the user must pick (an "or" reward that
 * takes both currencies).
 */
export function autoCurrency(
  reward: RewardListItem,
): RewardCurrency | "both" | null {
  const accepted = acceptedCurrencies(reward);
  if (reward.costMode === "and" && accepted.length === 2) return "both";
  if (accepted.length === 1) return accepted[0] ?? null;
  return null;
}
