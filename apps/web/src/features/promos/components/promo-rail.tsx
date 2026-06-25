"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PromoCard } from "./promo-card";

/**
 * Home promos rail — featured published promos (within their window), localized.
 * Nav arrows on mobile + desktop; renders nothing when there are none.
 */
export function PromoRail() {
  const t = useTranslations("Promos");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.promociones.homePromos.queryOptions());
  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, data]);

  const scrollBy = (dir: 1 | -1) =>
    rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: "smooth" });

  if (isLoading) return <Skeleton className="h-44 w-full rounded-3xl lg:h-52" />;
  if (!data || data.length === 0) return null;

  const showArrows = canLeft || canRight;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Link href="/promos" className="text-primary text-xs font-bold">
            {t("seeAll")}
          </Link>
          {showArrows ? (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => scrollBy(-1)}
                disabled={!canLeft}
                className="bg-card text-foreground grid size-8 place-items-center rounded-full shadow-sm ring-1 ring-black/5 disabled:opacity-30 dark:ring-white/10"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => scrollBy(1)}
                disabled={!canRight}
                className="bg-card text-foreground grid size-8 place-items-center rounded-full shadow-sm ring-1 ring-black/5 disabled:opacity-30 dark:ring-white/10"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div
        ref={rowRef}
        className="scrollbar-hide -mr-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pr-5 pb-1 lg:mr-0"
      >
        {data.map((promo) => (
          <div key={promo.id} className="w-[86%] shrink-0 snap-start sm:w-[22rem] lg:w-[28rem]">
            <PromoCard promo={promo} />
          </div>
        ))}
      </div>
    </section>
  );
}
