"use client";

import { Button } from "@loyalty/ui";
import {
  Clock,
  Globe,
  Languages,
  Plug,
  Sparkles,
  Stamp,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

import { SECTIONS, type SettingsSection } from "../data";
import { BrandSection } from "./brand-section";
import { HoursSection } from "./hours-section";
import { IntegrationsSection } from "./integrations-section";
import { LocalizationSection } from "./localization-section";
import { LoyaltySection } from "./loyalty-section";
import { OnboardingSection } from "./onboarding-section";
import { SeoSection } from "./seo-section";
import { TeamSection } from "./team-section";

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

/**
 * Ajustes — a settings hub with a left section nav (brand, hours, loyalty,
 * onboarding, team, integrations) and the active section on the right, plus the
 * theme + language toggles. The /settings/team and /settings/integrations
 * routes deep-link a section via `section`. Design-first / hardcoded.
 */
export function SettingsView({
  section = "brand",
}: {
  section?: SettingsSection;
}) {
  const t = useTranslations("Settings");
  const [active, setActive] = useState<SettingsSection>(section);

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
          <Button
            className="h-10 rounded-xl font-semibold"
            onClick={() => toast.success(t("saved"))}
          >
            {t("save")}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Section nav */}
        <nav className="lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = ICON[s];
              const on = active === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActive(s)}
                  className={`flex h-10 flex-none items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {t(`nav.${s}`)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section */}
        <div className="bg-card border-border rounded-3xl border p-6 shadow-sm lg:col-span-3">
          {active === "brand" ? (
            <BrandSection />
          ) : active === "localization" ? (
            <LocalizationSection />
          ) : active === "seo" ? (
            <SeoSection />
          ) : active === "hours" ? (
            <HoursSection />
          ) : active === "loyalty" ? (
            <LoyaltySection />
          ) : active === "onboarding" ? (
            <OnboardingSection />
          ) : active === "team" ? (
            <TeamSection />
          ) : (
            <IntegrationsSection />
          )}
        </div>
      </div>
    </div>
  );
}
