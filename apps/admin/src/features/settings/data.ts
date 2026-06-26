// Hardcoded settings for the design-first Ajustes screen. Seam: an org settings
// table + the storage channel (logo) + the loyalty config that drives earn /
// redeem. Each section maps to a future tRPC `settings.*` mutation.

export type SettingsSection =
  | "brand"
  | "localization"
  | "seo"
  | "hours"
  | "loyalty"
  | "onboarding"
  | "team"
  | "integrations";

export const SECTIONS: SettingsSection[] = [
  "brand",
  "localization",
  "seo",
  "hours",
  "loyalty",
  "onboarding",
  "team",
  "integrations",
];

// Brand + SEO are now wired to real data (`settings.branding` / `settings.seo`),
// so their mock constants were removed. The sections below stay design-first.

// ── Hours & location ────────────────────────────────────────────────────────
export type DayHours = {
  day: string; // i18n key: mon..sun
  open: string;
  close: string;
  closed: boolean;
};
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const hours: DayHours[] = DAYS.map((day) => ({
  day,
  open: "10:00",
  close: day === "sat" || day === "sun" ? "22:00" : "21:00",
  closed: false,
}));
export type StoreLocation = { address: string; city: string; mapsUrl: string };
export const location: StoreLocation = {
  address: "Cra 13 #85-32",
  city: "Bogotá",
  mapsUrl: "https://maps.google.com/?q=T4+Lovers",
};

// ── Loyalty rules ───────────────────────────────────────────────────────────
export type LoyaltyMode = "stamps" | "points" | "both";
export type LoyaltyRules = {
  mode: LoyaltyMode;
  stampsPerReward: number;
  pointsPerCurrency: number;
  expiryDays: number;
};
export const loyalty: LoyaltyRules = {
  mode: "stamps",
  stampsPerReward: 10,
  pointsPerCurrency: 1,
  expiryDays: 365,
};

// ── Onboarding slides ───────────────────────────────────────────────────────
export type OnboardingSlide = {
  id: string;
  emoji: string;
  title: string;
  body: string;
};
export const onboardingSlides: OnboardingSlide[] = [
  { id: "o1", emoji: "🧋", title: "Bienvenido a T4 Lovers", body: "Suma sellos en cada compra y canjea premios." },
  { id: "o2", emoji: "📱", title: "Tu tarjeta, siempre contigo", body: "Muestra tu QR en caja para sumar." },
  { id: "o3", emoji: "🎁", title: "Premios que amas", body: "Bubble teas gratis, toppings y más." },
];
export const SLIDE_EMOJIS = ["🧋", "📱", "🎁", "⭐", "🎉", "💚", "🥤", "🧁"];

// ── Team ────────────────────────────────────────────────────────────────────
export type Role = "owner" | "manager" | "staff";
export const ROLES: Role[] = ["owner", "manager", "staff"];
export type Member = { id: string; name: string; email: string; role: Role };
export const team: Member[] = [
  { id: "m1", name: "Johan Villamil", email: "johan@t4lovers.com", role: "owner" },
  { id: "m2", name: "Ana Gómez", email: "ana@t4lovers.com", role: "manager" },
  { id: "m3", name: "Luis Pérez", email: "luis@t4lovers.com", role: "staff" },
  { id: "m4", name: "Sofía Ruiz", email: "sofia@t4lovers.com", role: "staff" },
];

// ── Integrations ────────────────────────────────────────────────────────────
export type Integration = {
  id: string;
  emoji: string;
  connected: boolean;
};
export const integrations: Integration[] = [
  { id: "whatsapp", emoji: "💬", connected: true },
  { id: "instagram", emoji: "📸", connected: true },
  { id: "google", emoji: "🔎", connected: false },
  { id: "resend", emoji: "✉️", connected: true },
  { id: "posthog", emoji: "📊", connected: false },
];
