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

// ── Hours ───────────────────────────────────────────────────────────────────
// (Location now lives on the `store` model — edited inline via stores.update.)
export type DayHours = {
  day: string; // i18n key: mon..sun
  open: string;
  close: string;
  closed: boolean;
};
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// ── Loyalty rules ───────────────────────────────────────────────────────────
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
