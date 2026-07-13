"use client";

import {
  Clock,
  Globe,
  Languages,
  Lock,
  Plug,
  Sparkles,
  Stamp,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

import { SECTIONS, type SettingsSection } from "../data";
import { BrandSection } from "./brand-section";
import { HoursSection } from "./hours-section";
import { LoyaltySection } from "./loyalty-section";
import { LocalizationSection } from "./localization-section";
import { OnboardingSection } from "./onboarding-section";
import { SeoSection } from "./seo-section";

const ICON: Record<SettingsSection, LucideIcon> = {
  brand: Store,
  localization: Languages,
  seo: Globe,
  hours: Clock,
  loyalty: Stamp,
  onboarding: Sparkles,
  team: Users,
  integrations: Plug,
};

/** Sections whose editors aren't wired to a real backend yet — shown with a
 *  "coming soon" placeholder instead of the mock content. Team/roles now live in
 *  the Empleados feature; loyalty rules + integrations are pending. */
const COMING_SOON = new Set<SettingsSection>(["team", "integrations"]);

/**
 * Ajustes — a settings hub with a left section nav and the active section on the
 * right, plus theme + language toggles. The active tab lives in the URL
 * (`?tab=`, nuqs) so it's shareable + reload-safe. Not-yet-wired sections show a
 * "coming soon" placeholder.
 */
export function SettingsView({
  section = "brand",
}: {
  section?: SettingsSection;
}) {
  const t = useTranslations("Settings");
  const [active, setActive] = useQueryState(
    "tab",
    parseAsStringLiteral(SECTIONS).withDefault(section),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Section nav */}
        <nav className="lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = ICON[s];
              const on = active === s;
              const soon = COMING_SOON.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => void setActive(s)}
                  className={`flex h-10 flex-none items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{t(`nav.${s}`)}</span>
                  {soon ? (
                    <span className="bg-muted text-muted-foreground/70 rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold">
                      {t("soon")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section */}
        <div className="bg-card border-border rounded-3xl border p-6 shadow-sm lg:col-span-3">
          {COMING_SOON.has(active) ? (
            <ComingSoon />
          ) : active === "brand" ? (
            <BrandSection />
          ) : active === "localization" ? (
            <LocalizationSection />
          ) : active === "seo" ? (
            <SeoSection />
          ) : active === "hours" ? (
            <HoursSection />
          ) : active === "loyalty" ? (
            <LoyaltySection />
          ) : (
            <OnboardingSection />
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoon() {
  const t = useTranslations("Settings");
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground grid size-14 place-items-center rounded-2xl">
        <Lock className="size-6" />
      </span>
      <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
        {t("comingSoon.title")}
      </h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {t("comingSoon.hint")}
      </p>
    </div>
  );
}
