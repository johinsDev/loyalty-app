"use client";

import type { AppRouter } from "@loyalty/api";
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import { GlassWater, Leaf, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";
import { useActiveStoreId } from "../use-active-store";

type ProductDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["productBySlug"]>;

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Menú tab — the real product catalog the cashier can browse: search + category
 * filter (both in the URL via nuqs), and tap a product to see its recipe
 * (ingredients), variants with prices and toppings. Read-only lookup, wired to
 * `menu.list` / `menu.categories` / `menu.productBySlug` with a long shift cache.
 */
export function MenuView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const activeStoreId = useActiveStoreId();
  const [{ q, cat, p }, setQuery] = useQueryStates({
    q: parseAsString.withDefault(""),
    cat: parseAsString.withDefault(""),
    p: parseAsString.withDefault(""),
  });

  const debouncedQ = useDebounce(q.trim(), { wait: 250 });
  const categories = useQuery(
    trpc.menu.categories.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );
  const menu = useQuery(
    trpc.menu.list.queryOptions(
      {
        search: debouncedQ || undefined,
        categorySlug: cat || undefined,
        storeId: activeStoreId ?? undefined,
        pageSize: 40,
      },
      { staleTime: CATALOG_STALE_MS },
    ),
  );
  const items = menu.data?.items ?? [];

  // Active banners — so the cashier can confirm what's live and where.
  const banners = useQuery(
    trpc.banners.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("menuTitle")}</h1>

      <div className="border-border bg-card mt-4 flex h-12 items-center gap-2 rounded-2xl border px-4">
        <Search className="text-muted-foreground/70 size-4" />
        <input
          value={q}
          onChange={(e) => void setQuery({ q: e.target.value || null })}
          placeholder={t("menuSearch")}
          className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
        />
      </div>

      <div className="scrollbar-hide -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={!cat} onClick={() => void setQuery({ cat: null })}>
          {t("all")}
        </Chip>
        {(categories.data ?? []).map((c) => (
          <Chip
            key={c.id}
            active={cat === c.slug}
            onClick={() => void setQuery({ cat: cat === c.slug ? null : c.slug })}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      {menu.isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">{t("searching")}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">{t("menuEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void setQuery({ p: item.slug })}
              style={fade(i)}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm"
            >
              <Thumb url={item.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{item.name}</div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {item.promoPriceCents != null
                    ? formatCop(item.promoPriceCents)
                    : formatCop(item.priceCents)}
                </div>
              </div>
              <EarnBadge earn={item.earn} t={t} />
            </button>
          ))}
        </div>
      )}

      {(banners.data?.length ?? 0) > 0 ? (
        <div className="mt-8">
          <div className="text-muted-foreground/70 mb-2.5 text-xs font-extrabold tracking-wider">
            {t("bannersHeading")}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {banners.data?.map((b, i) => (
              <div
                key={b.id}
                style={fade(i)}
                className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3 shadow-sm"
              >
                <Thumb url={b.mainImageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{b.name}</div>
                  {b.shortDescription ? (
                    <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                      {b.shortDescription}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StateBadge state={b.displayState} t={t} />
                    <ScopeBadge specific={(b.storeIds?.length ?? 0) > 0} t={t} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ResponsiveModal
        open={p !== ""}
        onOpenChange={(o) => !o && void setQuery({ p: null })}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <ProductDetailBody slug={p} onClose={() => void setQuery({ p: null })} />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

/** The detail sheet — fetches the product and shows recipe + variants + toppings. */
function ProductDetailBody({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const detail = useQuery(
    trpc.menu.productBySlug.queryOptions({ slug }, { staleTime: CATALOG_STALE_MS, enabled: slug !== "" }),
  );
  const product = detail.data ?? null;

  if (!product) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-muted-foreground text-sm font-semibold">{t("searching")}</p>
      </div>
    );
  }

  // Build a readable variant label from its option-value ids.
  const valueLabel = new Map<string, string>();
  for (const o of product.options) for (const v of o.values) valueLabel.set(v.id, v.label);
  const variantLabel = (v: ProductDetail["variants"][number]): string =>
    v.optionValueIds
      .map((id) => valueLabel.get(id))
      .filter(Boolean)
      .join(" · ");

  const price =
    product.promoPriceCents != null ? product.promoPriceCents : product.basePriceCents;

  return (
    <div className="flex max-h-[80vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
      <div className="flex items-center gap-3">
        <Thumb url={product.images[0]?.url ?? null} large />
        <div className="min-w-0 flex-1">
          <ResponsiveModalTitle className="font-display truncate text-xl font-semibold tracking-tight">
            {product.name}
          </ResponsiveModalTitle>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-extrabold">
              {product.promoPriceCents != null ? (
                <>
                  <span className="text-primary">{formatCop(product.promoPriceCents)}</span>{" "}
                  <span className="text-muted-foreground/60 font-semibold line-through">
                    {formatCop(product.basePriceCents)}
                  </span>
                </>
              ) : (
                formatCop(price)
              )}
            </span>
            <EarnBadge earn={product.earn} t={t} />
          </div>
        </div>
      </div>

      {product.description ? (
        <ResponsiveModalDescription className="text-foreground mt-3 text-sm leading-relaxed">
          {product.description}
        </ResponsiveModalDescription>
      ) : null}

      {/* Recipe — the "Contiene…" ingredients the cashier can read out. */}
      {product.ingredients.length > 0 ? (
        <Section icon={<Leaf className="size-3.5" />} title={t("menuIngredients")}>
          <div className="flex flex-wrap gap-1.5">
            {product.ingredients.map((ing) => (
              <span
                key={ing}
                className="bg-muted text-foreground rounded-full px-2.5 py-1 text-xs font-semibold"
              >
                {ing}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Variants + prices. */}
      {product.variants.length > 1 ? (
        <Section icon={<GlassWater className="size-3.5" />} title={t("menuVariants")}>
          <div className="space-y-1.5">
            {product.variants.map((v) => (
              <div
                key={v.id}
                className="border-border flex items-center justify-between gap-3 rounded-xl border p-2.5"
              >
                <span className="truncate text-sm font-semibold">
                  {variantLabel(v) || t("pickerDefaultVariant")}
                </span>
                <span className="text-sm font-bold">{formatCop(v.priceCents)}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Toppings / modifier groups with their price deltas. */}
      {product.modifierGroups.map((g) => (
        <Section key={g.id} title={g.name}>
          <div className="space-y-1">
            {g.options.map((o) => (
              <div
                key={o.id}
                className="text-muted-foreground flex items-center justify-between gap-3 text-sm font-semibold"
              >
                <span className="truncate">{o.name}</span>
                {o.priceDeltaCents > 0 ? (
                  <span className="text-foreground font-bold">+{formatCop(o.priceDeltaCents)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ))}

      <ResponsiveModalClose
        variant="secondary"
        onClick={onClose}
        className="mt-6 h-12 w-full rounded-2xl text-base"
      >
        {t("close")}
      </ResponsiveModalClose>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-muted-foreground/70 mb-2 flex items-center gap-1 text-[0.6875rem] font-extrabold tracking-wider uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Thumb({ url, large }: { url: string | null; large?: boolean }) {
  const size = large ? "size-16 rounded-2xl" : "size-11 rounded-xl";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`bg-muted flex-none object-cover ${size}`} />
    );
  }
  return (
    <span className={`bg-muted text-muted-foreground/40 grid flex-none place-items-center ${size}`}>
      <GlassWater className={large ? "size-7" : "size-5"} />
    </span>
  );
}

function EarnBadge({
  earn,
  t,
}: {
  earn: { points: number; stamp: boolean };
  t: ReturnType<typeof useTranslations>;
}) {
  if (!earn.stamp && earn.points <= 0) return null;
  const label = earn.stamp
    ? `+1 ${t("stampOne")}`
    : t("earnPoints", { points: earn.points });
  return (
    <span className="bg-primary/10 text-primary flex-none rounded-full px-2 py-1 text-[0.6875rem] font-extrabold">
      {label}
    </span>
  );
}

function ScopeBadge({
  specific,
  t,
}: {
  specific: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold">
      {specific ? t("scopeStoreSpecific") : t("scopeAllStores")}
    </span>
  );
}

function StateBadge({
  state,
  t,
}: {
  state: "draft" | "scheduled" | "active" | "expired";
  t: ReturnType<typeof useTranslations>;
}) {
  const cls =
    state === "active"
      ? "bg-primary/10 text-primary"
      : state === "scheduled"
        ? "bg-amber-500/15 text-amber-600"
        : "bg-muted text-muted-foreground/70";
  const label =
    state === "active"
      ? t("bannerActive")
      : state === "scheduled"
        ? t("bannerScheduled")
        : t("bannerExpired");
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{label}</span>
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
      className={`h-9 flex-none rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${active ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"}`}
    >
      {children}
    </button>
  );
}
