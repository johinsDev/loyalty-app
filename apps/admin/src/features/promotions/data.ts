// Hardcoded promotions data for the design-first Promociones CRUD. Seam: the
// Phase D promo engine (wallet/ledger rules) + the notifications fan-out on
// publish. Reward types mirror the eventual rule shapes.

export type PromoType = "percent" | "fixed" | "free" | "points";
export const PROMO_TYPES: PromoType[] = ["percent", "fixed", "free", "points"];

export type Status = "active" | "scheduled" | "ended" | "draft";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const TIERS = ["bronze", "silver", "gold", "diamond"] as const;

export type Promo = {
  id: string;
  name: string;
  type: PromoType;
  reach: number;
  status: Status;
};

export const promos: Promo[] = [
  { id: "pr_001", name: "2×1 entre semana", type: "percent", reach: 1240, status: "active" },
  { id: "pr_002", name: "$5 de descuento en combos", type: "fixed", reach: 860, status: "active" },
  { id: "pr_003", name: "Topping gratis de bienvenida", type: "free", reach: 318, status: "scheduled" },
  { id: "pr_004", name: "Doble puntos fin de semana", type: "points", reach: 2100, status: "ended" },
  { id: "pr_005", name: "20% socios diamante", type: "percent", reach: 140, status: "draft" },
];

export type PromoDraft = {
  name: string;
  description: string;
  code: string;
  type: PromoType;
  value: number;
  freeProduct: string;
  start: Date | null;
  end: Date | null;
  days: string[];
  hours: string;
  tier: string;
  notify: boolean;
};

export const emptyPromoDraft: PromoDraft = {
  name: "",
  description: "",
  code: "",
  type: "percent",
  value: 20,
  freeProduct: "",
  start: null,
  end: null,
  days: [...DAYS],
  hours: "",
  tier: "all",
  notify: true,
};

const SAMPLE: PromoDraft = {
  name: "2×1 entre semana",
  description: "Trae a un amigo: lleva dos bubble teas al precio de uno, de lunes a jueves.",
  code: "PROMO2X1",
  type: "percent",
  value: 50,
  freeProduct: "",
  start: null,
  end: null,
  days: ["mon", "tue", "wed", "thu"],
  hours: "14:00 – 18:00",
  tier: "all",
  notify: true,
};

/** Resolve a promo into an editable draft. Hardcoded — unknown ids fall back to
 * a representative sample so deep links never 404 in the design build. */
export function getPromoDraft(id: string): PromoDraft {
  const p = promos.find((x) => x.id === id);
  if (!p) return SAMPLE;
  return {
    ...SAMPLE,
    name: p.name,
    type: p.type,
  };
}
