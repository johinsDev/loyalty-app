"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { PromoCard } from "./promo-card";

/**
 * Customer promos hub (/promos) — category chips + a grid of published promos,
 * wired to the cached, localized `listPublic`. Detail opens at `/promo/[slug]`
 * (intercepted modal). Chips are derived from the loaded promos' categories.
 */
export function Promos() {
  const t = useTranslations("Promos");
  const trpc = useTRPC();
  const [category, setCategory] = useState<string | null>(null);
  const { data, isLoading } = useQuery(
    trpc.promociones.listPublic.queryOptions({ category: category ?? undefined, pageSize: 40 }),
  );

  const items = data?.items ?? [];
  const categories = Array.from(
    new Set(items.map((p) => p.category).filter((c): c is string => Boolean(c))),
  );

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {categories.length > 0 ? (
        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            {t("all")}
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-44 rounded-3xl lg:h-52" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">{t("empty")}</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((promo) => (
            <PromoCard key={promo.id} promo={promo} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
