"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@loyalty/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Heart, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { FeaturedBanner } from "./featured-banner";
import { FeaturedCard } from "./featured-card";
import { MenuGridSkeleton } from "./menu-skeleton";
import { MenuSection } from "./menu-section";
import { ProductCard } from "./product-card";

/**
 * The menu: a promo banner + a destacado (featured product) that stay pinned,
 * curated section carousels shown only when browsing, and an infinite product
 * grid with category / section / search / favorites filters in the URL (nuqs).
 * Products + sections are public + cached; favorites are a per-user query.
 */
export function MenuCatalog() {
  const t = useTranslations("Menu");
  const trpc = useTRPC();
  const fade = useFadeUp();

  const [q, setQ] = useQueryStates({
    search: parseAsString.withDefault(""),
    cat: parseAsString.withDefault(""),
    section: parseAsString.withDefault(""),
    fav: parseAsBoolean.withDefault(false),
  });

  const [input, setInput] = useState(q.search);
  const debounced = useDebounce(input, { wait: 300 });
  useEffect(() => {
    if (debounced !== q.search) void setQ({ search: debounced || null });
  }, [debounced, q.search, setQ]);

  const filtering = Boolean(q.cat || q.section || q.search || q.fav);

  const categories = useQuery(trpc.menu.categories.queryOptions());
  const sections = useQuery(trpc.menu.sections.queryOptions({ placement: "menu" }));

  const list = useInfiniteQuery(
    trpc.menu.list.infiniteQueryOptions(
      {
        pageSize: 8,
        categorySlug: q.cat || undefined,
        sectionSlug: q.section || undefined,
        search: q.search || undefined,
      },
      {
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        initialCursor: null,
        enabled: !q.fav,
      },
    ),
  );
  const favorites = useQuery({
    ...trpc.menu.myFavorites.queryOptions(),
    enabled: q.fav,
  });

  const items = q.fav
    ? (favorites.data ?? [])
    : (list.data?.pages.flatMap((p) => p.items) ?? []);
  const loadingFirst = q.fav ? favorites.isPending : list.isPending;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.fav) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting &&
        list.hasNextPage &&
        !list.isFetchingNextPage
      ) {
        void list.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [q.fav, list.hasNextPage, list.isFetchingNextPage, list]);

  const bannerSection = sections.data?.find((s) => s.kind === "banner");
  const featuredSection = sections.data?.find((s) => s.kind === "featured");
  const carouselSections = sections.data?.filter((s) => s.kind === "carousel") ?? [];
  const chips = ["", ...(categories.data ?? []).map((c) => c.slug)];
  const catName = (slug: string) =>
    categories.data?.find((c) => c.slug === slug)?.name ?? slug;
  const sectionName = (slug: string) =>
    sections.data?.find((s) => s.slug === slug)?.name ?? slug;

  const gridTitle = q.fav
    ? t("favorites")
    : q.section
      ? sectionName(q.section)
      : q.cat
        ? catName(q.cat)
        : q.search
          ? t("results")
          : t("allProducts");

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <button
          type="button"
          onClick={() => void setQ({ fav: q.fav ? null : true })}
          aria-pressed={q.fav}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors ${
            q.fav
              ? "border-rose-300 bg-rose-50 text-rose-500 dark:bg-rose-950/40"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Heart className={`size-4 ${q.fav ? "fill-rose-500 text-rose-500" : ""}`} />
          {t("favorites")}
        </button>
      </header>

      {/* Promo banner pinned at top. */}
      {bannerSection ? <FeaturedBanner section={bannerSection} /> : null}

      <InputGroup className="bg-card h-12 rounded-full border-transparent px-1.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <InputGroupAddon>
          <Search className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
      </InputGroup>

      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chips.map((cat) => {
          const active = !q.section && q.cat === cat;
          return (
            <button
              key={cat || "all"}
              type="button"
              // Selecting a category clears any section filter.
              onClick={() => void setQ({ cat: cat || null, section: null })}
              aria-pressed={active}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {cat ? catName(cat) : t("all")}
            </button>
          );
        })}
      </div>

      {/* Destacado (featured product) — below the filters, stays pinned. */}
      {featuredSection ? <FeaturedCard section={featuredSection} /> : null}

      {/* Carousels only when browsing (not filtering). */}
      {!filtering && carouselSections.length > 0 ? (
        <div className="flex flex-col gap-6">
          {carouselSections.map((s) => (
            <MenuSection key={s.id} section={s} />
          ))}
        </div>
      ) : null}

      {loadingFirst ? (
        <MenuGridSkeleton />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {gridTitle}
          </h2>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            {items.map((product, i) => (
              <ProductCard key={product.id} product={product} style={fade(i % 8)} />
            ))}
          </div>
          {!q.fav && list.hasNextPage ? (
            <div ref={sentinel} className="grid place-items-center py-6">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
