// Hardcoded customer data for the design-first Clientes CRUD. Seams map onto the
// Phase A ledger (customer / loyaltyCard / stamp / redemption): the list rows,
// balances and history come from tRPC later. Amounts are the optional cashier
// `amount` that feeds revenue/LTV.

export type Tier = "bronze" | "silver" | "gold" | "diamond";
export type Status = "active" | "inactive";

export type Customer = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  tier: Tier;
  points: number;
  stamps: number;
  visits: number;
  spent: string;
  lastVisit: string;
  lastVisitDays: number;
  status: Status;
};

export const customerKpis = [
  { key: "total", value: "12.8K", delta: "+8.2%", trend: "up" as const },
  { key: "active30", value: "4,210", delta: "+5.1%", trend: "up" as const },
  { key: "newMonth", value: "318", delta: "+12.4%", trend: "up" as const },
  { key: "avgLtv", value: "$48.20", delta: "+3.6%", trend: "up" as const },
];

export const tierColor: Record<Tier, string> = {
  bronze: "bg-amber-700/15 text-amber-700",
  silver: "bg-slate-400/20 text-slate-500",
  gold: "bg-amber-400/20 text-amber-600",
  diamond: "bg-primary/12 text-primary",
};

export const customers: Customer[] = [
  { id: "c_001", name: "María González", initials: "MG", phone: "+57 300 555 0142", tier: "diamond", points: 1840, stamps: 7, visits: 96, spent: "$1,284", lastVisit: "hoy", lastVisitDays: 0, status: "active" },
  { id: "c_002", name: "Andrés Ramírez", initials: "AR", phone: "+57 311 555 0188", tier: "gold", points: 920, stamps: 4, visits: 58, spent: "$742", lastVisit: "ayer", lastVisitDays: 1, status: "active" },
  { id: "c_003", name: "Valentina Cruz", initials: "VC", phone: "+57 320 555 0117", tier: "gold", points: 870, stamps: 9, visits: 51, spent: "$688", lastVisit: "hace 2 d", lastVisitDays: 2, status: "active" },
  { id: "c_004", name: "Camilo Torres", initials: "CT", phone: "+57 301 555 0163", tier: "silver", points: 410, stamps: 2, visits: 27, spent: "$352", lastVisit: "hace 5 d", lastVisitDays: 5, status: "active" },
  { id: "c_005", name: "Daniela Pardo", initials: "DP", phone: "+57 315 555 0124", tier: "silver", points: 380, stamps: 6, visits: 24, spent: "$318", lastVisit: "hace 9 d", lastVisitDays: 9, status: "active" },
  { id: "c_006", name: "Sebastián Rojas", initials: "SR", phone: "+57 318 555 0199", tier: "bronze", points: 140, stamps: 1, visits: 11, spent: "$132", lastVisit: "hace 18 d", lastVisitDays: 18, status: "active" },
  { id: "c_007", name: "Laura Méndez", initials: "LM", phone: "+57 312 555 0150", tier: "diamond", points: 2110, stamps: 8, visits: 104, spent: "$1,492", lastVisit: "hace 3 d", lastVisitDays: 3, status: "active" },
  { id: "c_008", name: "Juan Quintero", initials: "JQ", phone: "+57 304 555 0171", tier: "bronze", points: 95, stamps: 3, visits: 8, spent: "$96", lastVisit: "hace 41 d", lastVisitDays: 41, status: "inactive" },
  { id: "c_009", name: "Paula Castaño", initials: "PC", phone: "+57 313 555 0136", tier: "silver", points: 460, stamps: 5, visits: 31, spent: "$402", lastVisit: "hace 7 d", lastVisitDays: 7, status: "active" },
  { id: "c_010", name: "Felipe Acosta", initials: "FA", phone: "+57 317 555 0182", tier: "gold", points: 780, stamps: 0, visits: 47, spent: "$610", lastVisit: "hace 52 d", lastVisitDays: 52, status: "inactive" },
  { id: "c_011", name: "Natalia Vega", initials: "NV", phone: "+57 319 555 0148", tier: "bronze", points: 60, stamps: 2, visits: 5, spent: "$58", lastVisit: "hace 12 d", lastVisitDays: 12, status: "active" },
  { id: "c_012", name: "Mateo Suárez", initials: "MS", phone: "+57 305 555 0190", tier: "silver", points: 520, stamps: 7, visits: 34, spent: "$448", lastVisit: "hace 64 d", lastVisitDays: 64, status: "inactive" },
];

export type Purchase = {
  id: string;
  item: string;
  store: string;
  amount: string;
  points: number;
  ago: string;
};

export type Redemption = {
  id: string;
  reward: string;
  emoji: string;
  cost: string;
  by: string;
  ago: string;
};

export type CustomerDetail = Customer & {
  birthday: string;
  joined: string;
  email: string;
  stampsTarget: number;
  purchases: Purchase[];
  redemptions: Redemption[];
};

const purchases: Purchase[] = [
  { id: "p1", item: "Taro Milk Tea (L)", store: "T4 Centro", amount: "$6.50", points: 13, ago: "hoy" },
  { id: "p2", item: "Brown Sugar Boba", store: "T4 Centro", amount: "$5.80", points: 12, ago: "hace 3 d" },
  { id: "p3", item: "Matcha Latte (M)", store: "T4 Norte", amount: "$5.20", points: 10, ago: "hace 6 d" },
  { id: "p4", item: "Mango Green Tea", store: "T4 Centro", amount: "$4.90", points: 10, ago: "hace 11 d" },
  { id: "p5", item: "Thai Tea + topping", store: "T4 Centro", amount: "$6.10", points: 12, ago: "hace 16 d" },
];

const redemptions: Redemption[] = [
  { id: "r1", reward: "Bubble tea gratis", emoji: "🧋", cost: "10 sellos", by: "Caja · Ana", ago: "hace 8 d" },
  { id: "r2", reward: "Topping gratis", emoji: "🍮", cost: "200 pts", by: "Caja · Luis", ago: "hace 24 d" },
];

/**
 * Resolve a customer for the detail view. Hardcoded: known ids use their row,
 * everything else falls back to the first customer so deep links never 404 in
 * the design build. The history/redemptions are shared sample data.
 */
export function getCustomer(id: string): CustomerDetail {
  const base = customers.find((c) => c.id === id) ?? customers[0]!;
  return {
    ...base,
    birthday: "14 de marzo",
    joined: "ene 2025",
    email: `${base.initials.toLowerCase()}@example.com`,
    stampsTarget: 10,
    purchases,
    redemptions,
  };
}
