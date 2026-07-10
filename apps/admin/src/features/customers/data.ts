// Hardcoded customer data, still backing the design-first create/edit wizard.
// The list and the 360 detail are on tRPC now; this file goes away once the
// wizard moves to `customers.create` / `customers.update`.

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

export type Channel = "push" | "email" | "sms" | "whatsapp";
export const CHANNELS: Channel[] = ["push", "email", "sms", "whatsapp"];

export type BirthDate = { day: number; month: number; year: number };

// Full editable customer draft used by the create/edit wizard. Richer than the
// list row: identity + loyalty starting balance + notification preferences. Seam:
// the Phase A customer + loyaltyCard + opt-out model.
export type CustomerDraft = {
  name: string;
  nickname: string;
  phone: string;
  email: string;
  birthday: BirthDate;
  tier: Tier;
  initialStamps: number;
  initialPoints: number;
  channels: Channel[];
  marketingOptIn: boolean;
  notes: string;
};

export const emptyCustomerDraft: CustomerDraft = {
  name: "",
  nickname: "",
  phone: "",
  email: "",
  birthday: { day: 1, month: 1, year: 2000 },
  tier: "bronze",
  initialStamps: 0,
  initialPoints: 0,
  channels: ["push", "email"],
  marketingOptIn: true,
  notes: "",
};

/** Resolve a customer into an editable draft. Hardcoded — unknown ids fall back
 * to the first customer so deep links never 404 in the design build. */
export function getCustomerDraft(id: string): CustomerDraft {
  const base = customers.find((c) => c.id === id) ?? customers[0]!;
  return {
    name: base.name,
    nickname: "",
    phone: base.phone,
    email: `${base.initials.toLowerCase()}@example.com`,
    birthday: { day: 14, month: 3, year: 1996 },
    tier: base.tier,
    initialStamps: base.stamps,
    initialPoints: base.points,
    channels: ["push", "email", "whatsapp"],
    marketingOptIn: true,
    notes: "",
  };
}
