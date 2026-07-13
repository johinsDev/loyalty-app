"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Gift,
  Medal,
  Package,
  Palette,
  Smartphone,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useHasRole } from "@/lib/role-context";
import { useTRPC } from "@/lib/trpc/client";

type ChecklistKey =
  | "brand"
  | "store"
  | "products"
  | "loyalty"
  | "rewards"
  | "promos"
  | "onboarding";

/** Order = the natural setup journey; each row deep-links to its screen. */
const ITEMS: {
  key: ChecklistKey;
  icon: LucideIcon;
  href: { pathname: string; query?: Record<string, string> };
}[] = [
  { key: "brand", icon: Palette, href: { pathname: "/settings", query: { tab: "brand" } } },
  { key: "store", icon: Store, href: { pathname: "/stores" } },
  { key: "products", icon: Package, href: { pathname: "/products" } },
  { key: "loyalty", icon: Medal, href: { pathname: "/loyalty" } },
  { key: "rewards", icon: Gift, href: { pathname: "/rewards" } },
  { key: "promos", icon: Sparkles, href: { pathname: "/promotions" } },
  {
    key: "onboarding",
    icon: Smartphone,
    href: { pathname: "/settings", query: { tab: "onboarding" } },
  },
];

/**
 * "Configurá tu negocio" — the minimum-setup checklist at the top of the
 * dashboard. Every flag is computed from live data (≥1 active product, logo +
 * color set, loyalty rules saved, …), each row jumps straight to the screen
 * that completes it, and the card disappears on its own at 100% — no stored
 * dismissal state. Manager+ only (the underlying reads are manager-gated).
 */
export function SetupChecklist() {
  const t = useTranslations("Dashboard");
  const trpc = useTRPC();
  const router = useRouter();
  const isManager = useHasRole("manager");

  const { data } = useQuery({
    ...trpc.dashboard.setupChecklist.queryOptions(),
    enabled: isManager,
    staleTime: 60_000,
  });

  if (!isManager || !data) return null;
  const done = ITEMS.filter((i) => data[i.key]).length;
  if (done === ITEMS.length) return null;

  return (
    <section className="bg-card border-border mb-5 rounded-3xl border p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("setup.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("setup.subtitle")}</p>
        </div>
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold">
          {t("setup.progress", { done, total: ITEMS.length })}
        </span>
      </div>

      <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
        <div
          className="from-primary to-primary/60 h-full rounded-full bg-gradient-to-r transition-all"
          style={{ width: `${(done / ITEMS.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ key, icon: Icon, href }) => {
          const isDone = data[key];
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => router.push(href as never)}
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  isDone ? "opacity-60" : "hover:bg-muted/60"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-5 flex-none text-emerald-600" />
                ) : (
                  <Circle className="text-muted-foreground/40 size-5 flex-none" />
                )}
                <Icon className="text-muted-foreground size-4 flex-none" />
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                    isDone ? "line-through" : ""
                  }`}
                >
                  {t(`setup.items.${key}`)}
                </span>
                {!isDone ? (
                  <ChevronRight className="text-muted-foreground size-4 flex-none opacity-0 transition-opacity group-hover:opacity-100" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
