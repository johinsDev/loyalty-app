export const TIERS = ["hoja", "flor", "oro"] as const;
export type Tier = (typeof TIERS)[number];

export type AudienceFilter = {
  tiers?: Tier[];
  lastPurchase?: { op: "gte" | "lte"; days: number };
  minPurchases?: number;
  signedUpAfter?: Date;
  signedUpBefore?: Date;
};

/** The controlled value the audience editor round-trips — the raw form slice
 *  (string inputs kept as strings so the fields stay uncontrolled-friendly). */
export type AudienceValue = {
  tiers: Tier[];
  lastPurchaseOp: "gte" | "lte";
  lastPurchaseDays: string;
  minPurchases: string;
  signedUpAfter: Date | null;
  signedUpBefore: Date | null;
};

export const EMPTY_AUDIENCE: AudienceValue = {
  tiers: [],
  lastPurchaseOp: "gte",
  lastPurchaseDays: "",
  minPurchases: "",
  signedUpAfter: null,
  signedUpBefore: null,
};

export function buildAudienceFilter(v: AudienceValue): AudienceFilter | undefined {
  const f: AudienceFilter = {};
  if (v.tiers.length > 0) f.tiers = v.tiers;
  const days = Number.parseInt(v.lastPurchaseDays, 10);
  if (v.lastPurchaseDays.trim() && !Number.isNaN(days))
    f.lastPurchase = { op: v.lastPurchaseOp, days };
  const min = Number.parseInt(v.minPurchases, 10);
  if (v.minPurchases.trim() && !Number.isNaN(min)) f.minPurchases = min;
  if (v.signedUpAfter) f.signedUpAfter = v.signedUpAfter;
  if (v.signedUpBefore) f.signedUpBefore = v.signedUpBefore;
  return Object.keys(f).length > 0 ? f : undefined;
}
