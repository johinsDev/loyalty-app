"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { PROMO_THEME, featuredPromos, promoGradient } from "@/features/promos/data";
import { Link } from "@/i18n/navigation";

/**
 * Promos / banners as a horizontal snap carousel with arrow controls, a "see
 * all" link to the promos hub, and cards that deep-link to a promo's detail.
 * Shows the featured subset of the shared promos dataset (`features/promos/data`)
 * so a tapped card resolves to the same detail drawer on `/promos`. Each card's
 * gradient is data-driven so the org can theme campaigns; the track keeps
 * vertical padding so card shadows aren't clipped.
 */
export function PromosCarousel() {
  const t = useTranslations("Home");
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) =>
    trackRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-bold tracking-wider">
          {t("forYouToday")}
        </p>
        <div className="flex items-center gap-2">
          <Link href="/promos" className="text-primary text-xs font-bold">
            {t("seeAll")}
          </Link>
          <button
            type="button"
            aria-label="‹"
            onClick={() => scrollByCard(-1)}
            className="bg-card text-primary grid size-8 place-items-center rounded-full shadow-md shadow-black/5 active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="›"
            onClick={() => scrollByCard(1)}
            className="bg-card text-primary grid size-8 place-items-center rounded-full shadow-md shadow-black/5 active:scale-95"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pt-1 pb-6"
      >
        {featuredPromos.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              href={{ pathname: "/promos", query: { promo: p.id } }}
              className="shadow-primary/30 flex h-48 w-72 flex-none snap-center flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg"
              style={{
                backgroundImage: promoGradient(PROMO_THEME[p.theme].card),
              }}
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold tracking-wider">
                  {p.badge}
                </span>
                <Icon className="size-10" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight">
                  {p.name}
                </h3>
                <p className="line-clamp-2 text-sm text-white/90">
                  {p.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
