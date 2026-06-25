"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { BannerCard } from "./banner-card";

/**
 * Home banner rail — a horizontal, scroll-snapping row of published banners
 * (within their display window), ordered by the admin. On desktop, prev/next
 * arrows scroll the row (drag/swipe on mobile). Renders nothing when empty.
 */
export function BannerRail() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.banners.homeBanners.queryOptions());
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

  const scrollBy = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({
      left: dir * rowRef.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  if (isLoading) {
    return <Skeleton className="h-44 w-full rounded-3xl lg:h-52" />;
  }
  if (!data || data.length === 0) return null;

  const showArrows = canLeft || canRight;

  return (
    <div>
      {/* Nav arrows — visible on all sizes when the rail can scroll (mobile
          also keeps swipe). */}
      {showArrows ? (
        <div className="mb-2 flex justify-end gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            className="bg-card text-foreground grid size-9 place-items-center rounded-full shadow-sm ring-1 ring-black/5 transition-opacity disabled:opacity-30 dark:ring-white/10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            className="bg-card text-foreground grid size-9 place-items-center rounded-full shadow-sm ring-1 ring-black/5 transition-opacity disabled:opacity-30 dark:ring-white/10"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : null}

      <div
        ref={rowRef}
        className="scrollbar-hide -mr-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pr-5 pb-1 lg:mr-0"
      >
        {data.map((banner) => (
          <div
            key={banner.id}
            className="w-[86%] shrink-0 snap-start sm:w-[22rem] lg:w-[28rem]"
          >
            <BannerCard banner={banner} />
          </div>
        ))}
      </div>
    </div>
  );
}
