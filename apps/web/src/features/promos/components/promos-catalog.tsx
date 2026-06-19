"use client";

import { Drawer, DrawerContent } from "@loyalty/ui";
import { ArrowRight, Clock, Search, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo } from "react";

import {
  PROMO_THEME,
  type Promo,
  featuredPromos,
  promoById,
  promoGradient,
  promos,
} from "../data";
import { PromoDetail } from "./promo-detail";

const CATEGORY_FILTER = [
  "todas",
  "descuentos",
  "combos",
  "puntos",
  "especiales",
] as const;
type CategoryFilter = (typeof CATEGORY_FILTER)[number];

/**
 * The interactive heart of the promos hub: the destacadas hero carousel, the
 * category filter chips, the list of all active promos, and a bottom Drawer with
 * a promo's detail. Both the hero cards and the list rows open the same drawer.
 * Filter + open-drawer state lives in the URL via nuqs (`?f=` / `?promo=`), so
 * views are shareable, survive a reload, and the home carousel can deep-link a
 * card straight to its detail. Client component.
 */
export function PromosCatalog() {
  const t = useTranslations("Promos");

  const [q, setQ] = useQueryStates({
    f: parseAsStringLiteral(CATEGORY_FILTER).withDefault("todas"),
    promo: parseAsString,
  });

  const chips: { key: CategoryFilter; label: string }[] = [
    { key: "todas", label: t("filterAll") },
    { key: "descuentos", label: t("catDescuentos") },
    { key: "combos", label: t("catCombos") },
    { key: "puntos", label: t("catPuntos") },
    { key: "especiales", label: t("catEspeciales") },
  ];

  const list = useMemo(
    () =>
      promos.filter(
        (p) => !p.featured && (q.f === "todas" || p.category === q.f),
      ),
    [q.f],
  );

  const selected = q.promo ? promoById(q.promo) : null;
  const open = (id: string) => void setQ({ promo: id });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider">
            <Star className="size-3.5" />
            {t("featured")}
          </span>
          <span className="text-muted-foreground text-xs font-bold">
            {t("swipe")}
          </span>
        </div>
        <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pt-1 pb-2 lg:mx-0 lg:px-0">
          {featuredPromos.map((p) => (
            <FeaturedCard key={p.id} promo={p} onSelect={() => open(p.id)} />
          ))}
        </div>
      </section>

      <section>
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => {
            const active = q.f === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => void setQ({ f: chip.key })}
                aria-pressed={active}
                className={`h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="text-muted-foreground mb-3 text-xs font-extrabold tracking-wider">
          {t("allPromos")}
        </div>

        {list.length === 0 ? (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
            <Search className="mx-auto mb-2 size-7 opacity-60" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => (
              <PromoRow key={p.id} promo={p} onSelect={() => open(p.id)} />
            ))}
          </div>
        )}
      </section>

      <Drawer
        open={selected !== null}
        onOpenChange={(next) => !next && void setQ({ promo: null })}
      >
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          {selected ? <PromoDetail promo={selected} /> : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function FeaturedCard({
  promo,
  onSelect,
}: {
  promo: Promo;
  onSelect: () => void;
}) {
  const t = useTranslations("Promos");
  const Icon = promo.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex h-52 w-[19rem] flex-none snap-center flex-col justify-between overflow-hidden rounded-[1.75rem] p-[1.375rem] text-left text-white shadow-xl shadow-black/20 transition-transform active:scale-[0.99]"
      style={{ backgroundImage: promoGradient(PROMO_THEME[promo.theme].card) }}
    >
      <Icon className="pointer-events-none absolute -right-5 -bottom-6 size-36 rotate-[-12deg] opacity-15" />
      <span className="inline-flex w-fit items-center rounded-full bg-white/25 px-3 py-1.5 text-[0.6875rem] font-extrabold tracking-wide">
        {promo.badge}
      </span>
      <div className="relative">
        <h3 className="font-display text-2xl leading-tight font-semibold tracking-tight">
          {promo.name}
        </h3>
        <p className="mt-1.5 max-w-[14rem] text-sm leading-snug text-white/90">
          {promo.description}
        </p>
        <div className="mt-3.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.8125rem] font-extrabold text-[#000323]">
            {t("viewPromo")}
            <ArrowRight className="size-3.5" />
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-white/90">
            <Clock className="size-3.5" />
            {promo.validity}
          </span>
        </div>
      </div>
    </button>
  );
}

function PromoRow({ promo, onSelect }: { promo: Promo; onSelect: () => void }) {
  const Icon = promo.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-card flex w-full items-center gap-3.5 rounded-[1.375rem] p-3.5 text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
    >
      <span
        className="grid size-[3.375rem] flex-none place-items-center rounded-[1.0625rem]"
        style={{ backgroundImage: promoGradient(PROMO_THEME[promo.theme].tint) }}
      >
        <Icon className="size-7 text-[#000323]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-[1.0625rem] font-bold">
          {promo.name}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 truncate text-[0.8125rem]">
          <Clock className="size-3.5 shrink-0" />
          {promo.validity}
        </span>
      </div>
      <span className="bg-primary/10 text-primary inline-flex flex-none items-center rounded-full px-3 py-2 text-[0.8125rem] font-extrabold">
        {promo.badge}
      </span>
    </button>
  );
}
