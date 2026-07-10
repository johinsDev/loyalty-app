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
