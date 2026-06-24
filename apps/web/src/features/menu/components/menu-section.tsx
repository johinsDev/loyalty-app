"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

import type { SectionView } from "../types";
import { ProductCard } from "./product-card";

/** A curated carousel section: a horizontal, scroll-snapping row of products,
 *  capped server-side, with a "Ver todo" link to the full filtered grid. On
 *  desktop, prev/next arrows scroll the row (drag is the mobile affordance). */
export function MenuSection({ section }: { section: SectionView }) {
  const t = useTranslations("Menu");
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
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({
      left: dir * rowRef.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  if (section.products.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {section.name}
        </h2>
        {section.hasMore ? (
          <Link
            href={{ pathname: "/menu", query: { section: section.slug } }}
            className="text-primary inline-flex items-center gap-1 text-xs font-bold"
          >
            {t("seeAll")}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="group relative">
        <div
          ref={rowRef}
          className="scrollbar-hide -mr-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pr-5 pb-1 lg:mr-0"
        >
          {section.products.map((p) => (
            <div key={p.id} className="w-44 shrink-0 snap-start lg:w-64">
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        {/* Desktop scroll arrows (mobile uses drag/swipe) — only when scrollable. */}
        {canLeft ? (
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="bg-card text-foreground absolute top-1/2 -left-4 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full shadow-lg shadow-black/10 ring-1 ring-black/5 transition-opacity lg:grid lg:opacity-0 lg:group-hover:opacity-100 dark:ring-white/10"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}
        {canRight ? (
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            className="bg-card text-foreground absolute top-1/2 -right-4 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full shadow-lg shadow-black/10 ring-1 ring-black/5 transition-opacity lg:grid lg:opacity-0 lg:group-hover:opacity-100 dark:ring-white/10"
          >
            <ChevronRight className="size-5" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
