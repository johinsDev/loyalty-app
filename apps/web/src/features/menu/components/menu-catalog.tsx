"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useDebounce } from "ahooks";
import { Heart, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
} from "nuqs";
import { useEffect, useMemo, useState } from "react";

import { CATEGORIES, type Drink, drinks } from "../data";

/**
 * The interactive drinks menu: a seasonal banner, a debounced search, the
 * favorites toggle + category filter chips, a featured card, the drink grid, and
 * a bottom Drawer with a drink's detail (size + toppings). Search, category,
 * favorites-only and the open drawer all live in the URL via nuqs, so views are
 * shareable and survive a reload. Hearts (which drinks are favorited) are client
 * state seeded from the data. Client component.
 */
export function MenuCatalog() {
  const t = useTranslations("Menu");

  const [q, setQ] = useQueryStates({
    search: parseAsString.withDefault(""),
    cat: parseAsString.withDefault(""),
    fav: parseAsBoolean.withDefault(false),
    drink: parseAsString,
  });

  // The input is local + debounced; the debounced value is what hits the URL.
  const [input, setInput] = useState(q.search);
  const debounced = useDebounce(input, { wait: 300 });
  useEffect(() => {
    if (debounced !== q.search) void setQ({ search: debounced || null });
  }, [debounced, q.search, setQ]);

  const [favorites, setFavorites] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(drinks.map((d) => [d.id, !!d.favorite])),
  );
  const toggleFav = (id: string) =>
    setFavorites((f) => ({ ...f, [id]: !f[id] }));

  const query = q.search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      drinks.filter((d) => {
        if (q.cat && d.category !== q.cat) return false;
        if (q.fav && !favorites[d.id]) return false;
        if (
          query &&
          !`${d.name} ${d.description}`.toLowerCase().includes(query)
        )
          return false;
        return true;
      }),
    [query, q.cat, q.fav, favorites],
  );

  const featured = visible.find((d) => d.featured);
  const grid = visible.filter((d) => !d.featured);
  const selected = q.drink
    ? (drinks.find((d) => d.id === q.drink) ?? null)
    : null;

  const chips = ["", ...CATEGORIES];

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
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
          <Heart
            className={`size-4 ${q.fav ? "fill-rose-500 text-rose-500" : ""}`}
          />
          {t("favorites")}
        </button>
      </header>

      {/* seasonal banner */}
      <div className="from-primary relative overflow-hidden rounded-3xl bg-gradient-to-br to-orange-300 p-5 shadow-lg shadow-primary/20">
        <span className="absolute -top-6 -right-8 size-32 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <span className="text-4xl">🌸</span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-widest text-white/90">
              {t("seasonalTag")}
            </p>
            <p className="font-display text-xl leading-tight font-semibold text-white">
              {t("seasonalTitle")}
            </p>
            <p className="truncate text-sm text-white/90">
              {t("seasonalSub")}
            </p>
          </div>
        </div>
      </div>

      {/* search */}
      <InputGroup className="bg-card h-12 rounded-full border-transparent px-1.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <InputGroupAddon>
          <Search className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
      </InputGroup>

      {/* category chips */}
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chips.map((cat) => {
          const active = q.cat === cat;
          return (
            <button
              key={cat || "all"}
              type="button"
              onClick={() => void setQ({ cat: cat || null })}
              aria-pressed={active}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {cat || t("all")}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          {featured ? (
            <DrinkCard
              drink={featured}
              featured
              isFav={!!favorites[featured.id]}
              onOpen={() => void setQ({ drink: featured.id })}
              onFav={() => toggleFav(featured.id)}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            {grid.map((drink) => (
              <DrinkCard
                key={drink.id}
                drink={drink}
                isFav={!!favorites[drink.id]}
                onOpen={() => void setQ({ drink: drink.id })}
                onFav={() => toggleFav(drink.id)}
              />
            ))}
          </div>
        </>
      )}

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(open) => !open && void setQ({ drink: null })}
      >
        <ResponsiveModalContent
          mobileClassName="mx-auto w-full max-w-md"
          showCloseButton={false}
        >
          {selected ? (
            <DrinkDetail
              drink={selected}
              isFav={!!favorites[selected.id]}
              onFav={() => toggleFav(selected.id)}
            />
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function HeartButton({
  isFav,
  onClick,
}: {
  isFav: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("Menu");
  return (
    <button
      type="button"
      aria-label={t("favorites")}
      aria-pressed={isFav}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="bg-card absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full shadow-md shadow-black/20"
    >
      <Heart
        className={`size-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
      />
    </button>
  );
}

function DrinkCard({
  drink,
  featured = false,
  isFav,
  onOpen,
  onFav,
}: {
  drink: Drink;
  featured?: boolean;
  isFav: boolean;
  onOpen: () => void;
  onFav: () => void;
}) {
  const t = useTranslations("Menu");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card relative flex w-full flex-col overflow-hidden rounded-3xl text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-95 dark:ring-white/10"
    >
      <HeartButton isFav={isFav} onClick={onFav} />
      <div
        className={`from-primary/15 to-primary/5 grid place-items-center bg-gradient-to-br ${
          featured ? "h-44 text-7xl" : "h-28 text-5xl"
        }`}
      >
        {drink.featured ? (
          <span className="bg-foreground text-background absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wider">
            {t("featured")}
          </span>
        ) : null}
        {drink.emoji}
      </div>
      <div className={featured ? "p-4" : "p-3.5"}>
        <p
          className={`text-foreground leading-tight font-bold ${
            featured ? "text-lg" : "text-sm"
          }`}
        >
          {drink.name}
        </p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
          {drink.description}
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="font-display text-primary font-semibold tracking-tight">
            {drink.price}
          </span>
          <span className="text-muted-foreground text-xs font-semibold">
            {drink.points}
          </span>
        </div>
      </div>
    </button>
  );
}

const TOPPINGS = ["Perlas", "Pudín", "Jelly"];

function DrinkDetail({
  drink,
  isFav,
  onFav,
}: {
  drink: Drink;
  isFav: boolean;
  onFav: () => void;
}) {
  const t = useTranslations("Menu");
  const [size, setSize] = useState<"m" | "l">("m");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="from-primary/15 to-primary/5 relative mx-4 mt-2 grid h-44 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br text-8xl">
        <div className="absolute top-3 left-3 flex gap-2">
          {drink.seasonal ? (
            <span className="bg-card text-primary rounded-full px-3 py-1 text-xs font-extrabold tracking-wider">
              🌸 {t("seasonalTag")}
            </span>
          ) : null}
          {drink.featured ? (
            <span className="bg-foreground text-background rounded-full px-3 py-1 text-xs font-extrabold tracking-wider">
              {t("featured")}
            </span>
          ) : null}
        </div>
        <HeartButton isFav={isFav} onClick={onFav} />
        {drink.emoji}
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {drink.name}
          </ResponsiveModalTitle>
          <span className="font-display text-primary text-2xl font-semibold whitespace-nowrap">
            {drink.price}
          </span>
        </div>
        <ResponsiveModalDescription className="text-muted-foreground mt-2 text-left text-sm leading-relaxed">
          {drink.description}
        </ResponsiveModalDescription>
        <span className="text-primary mt-1 block text-sm font-bold">
          {drink.points} {t("onRedeem")}
        </span>

        <p className="mt-5 mb-2 text-sm font-bold">{t("size")}</p>
        <div className="flex gap-2.5">
          <SizeButton active={size === "m"} onClick={() => setSize("m")}>
            {t("sizeM")}
          </SizeButton>
          <SizeButton active={size === "l"} onClick={() => setSize("l")}>
            {t("sizeL")}
          </SizeButton>
        </div>

        <p className="mt-5 mb-2 text-sm font-bold">{t("toppings")}</p>
        <div className="flex flex-wrap gap-2">
          {TOPPINGS.map((top) => (
            <span
              key={top}
              className="border-border text-muted-foreground rounded-full border px-3.5 py-2 text-sm font-semibold"
            >
              ＋ {top}
            </span>
          ))}
        </div>

        <div className="mt-6 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <ResponsiveModalClose variant="gradient" className="w-full">
            {t("addToOrder", { price: drink.price })}
          </ResponsiveModalClose>
        </div>
      </div>
    </div>
  );
}

function SizeButton({
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
      aria-pressed={active}
      className={`h-12 flex-1 rounded-2xl border text-sm font-bold transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
