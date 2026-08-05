"use client";

import type { AppRouter } from "@loyalty/api";
import {
  cn,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import { GlassWater, Image as ImageIcon, Leaf, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";
import { useCashierMoney } from "../format";
import { useActiveStoreId } from "../use-active-store";

import {
  CASHIER,
  CashierBadge,
  CashierChip,
  CashierEmpty,
  CashierListSkeleton,
  CashierMedia,
  CashierPage,
  CashierRow,
  CashierSearchField,
  CashierSection,
} from "./chrome";

type ProductDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["productBySlug"]>;
type DetailVariant = ProductDetail["variants"][number];

/** The rich-text description arrives as HTML; the cashier reads it as plain text. */
const plainText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Menú tab — the real product catalog the cashier can browse: search + category
 * filter (both in the URL via nuqs), and tap a product to see its recipe
 * (ingredients), sizes with prices and add-ons. Read-only lookup, wired to
 * `menu.list` / `menu.categories` / `menu.productBySlug` with a long shift cache.
 */
export function MenuView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const money = useCashierMoney();
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
    <CashierPage title={t("menuTitle")}>
      <CashierSearchField
        value={q}
        onChange={(v) => void setQuery({ q: v || null })}
        placeholder={t("menuSearch")}
      />

      <div className="scrollbar-hide -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <CashierChip active={!cat} onClick={() => void setQuery({ cat: null })}>
          {t("all")}
        </CashierChip>
        {(categories.data ?? []).map((c) => (
          <CashierChip
            key={c.id}
            active={cat === c.slug}
            onClick={() => void setQuery({ cat: cat === c.slug ? null : c.slug })}
          >
            {c.name}
          </CashierChip>
        ))}
      </div>

      {menu.isPending ? (
        <CashierListSkeleton grid />
      ) : items.length === 0 ? (
        <CashierEmpty icon={<Search className="size-6" />} title={t("menuEmpty")} />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <CashierRow
              key={item.id}
              style={fade(i)}
              onClick={() => void setQuery({ p: item.slug })}
              media={<CashierMedia url={item.imageUrl} icon={<GlassWater className="size-5" />} />}
              title={item.name}
              // The register's tile shows the price as the loud line; the
              // catalog kept it as grey supporting text, so the same product
              // read as two different things a tab apart.
              meta={
                <span className="text-primary text-sm font-extrabold">
                  {item.variantFromCents != null
                    ? item.priceFrom
                      ? t("priceFrom", { price: money(item.variantFromCents) })
                      : money(item.variantFromCents)
                    : money(item.promoPriceCents ?? item.priceCents)}
                </span>
              }
              // Under the name, not beside it: three cards to a row left the
              // price barely a hundred pixels once a trailing badge took its
              // share, and "desde 16.500 COP" came out as "desde 16.500 C…".
              badges={<EarnBadge earn={item.earn} t={t} />}
            />
          ))}
        </div>
      )}

      {(banners.data?.length ?? 0) > 0 ? (
        <CashierSection icon={<ImageIcon className="size-3.5" />} label={t("bannersHeading")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {banners.data?.map((b, i) => (
              <CashierRow
                key={b.id}
                style={fade(i)}
                media={<CashierMedia url={b.mainImageUrl} icon={<ImageIcon className="size-5" />} />}
                title={b.name}
                meta={b.shortDescription ?? undefined}
                badges={
                  <>
                    <StateBadge state={b.displayState} t={t} />
                    <CashierBadge>
                      {(b.storeIds?.length ?? 0) > 0
                        ? t("scopeStoreSpecific")
                        : t("scopeAllStores")}
                    </CashierBadge>
                  </>
                }
              />
            ))}
          </div>
        </CashierSection>
      ) : null}

      <ResponsiveModal
        open={p !== ""}
        onOpenChange={(o) => !o && void setQuery({ p: null })}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-lg">
          <ProductDetailBody slug={p} />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </CashierPage>
  );
}

/**
 * The catalog's product sheet.
 *
 * It mirrors `ProductPicker` — the same product opened from the register — in
 * order and in styling, because they answer the same question and only differ
 * in what the cashier does next (read here, add to the cart there). They used
 * to disagree on more than looks: this sheet listed `modifierGroups`, the
 * legacy field add-ons replaced, so a product's real add-ons and its removable
 * ingredients were invisible from the catalog and visible from the register.
 */
function ProductDetailBody({ slug }: { slug: string }) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const money = useCashierMoney();
  const detail = useQuery(
    trpc.menu.productBySlug.queryOptions(
      { slug },
      { staleTime: CATALOG_STALE_MS, enabled: slug !== "" },
    ),
  );
  const product = detail.data ?? null;

  if (!product) {
    return (
      <div className="flex flex-col gap-4 px-6 py-10">
        <ResponsiveModalTitle className="sr-only">{t("menuTitle")}</ResponsiveModalTitle>
        <CashierListSkeleton count={3} />
      </div>
    );
  }

  // Build a readable variant label from its option-value ids.
  const valueLabel = new Map<string, string>();
  for (const o of product.options) for (const v of o.values) valueLabel.set(v.id, v.label);
  const variantLabel = (v: DetailVariant): string =>
    v.optionValueIds
      .map((id) => valueLabel.get(id))
      .filter(Boolean)
      .join(" · ");

  /** A per-variant promo price is the effective charge when set. */
  const effective = (v: DetailVariant): number => v.promoPriceCents ?? v.priceCents;
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const baseRef = defaultVariant ? effective(defaultVariant) : 0;
  const variantPrices = product.variants.map(effective);
  const minVariant = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
  const variantRange = minVariant != null && Math.max(...variantPrices) !== minVariant;

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex flex-col px-6 pt-2 pb-4">
        <div className="flex items-center gap-3">
          <CashierMedia
            url={product.images[0]?.url ?? null}
            icon={<GlassWater className="size-7" />}
            large
          />
          <div className="min-w-0 flex-1">
            <ResponsiveModalTitle className="font-display truncate text-xl font-semibold tracking-tight">
              {product.name}
            </ResponsiveModalTitle>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-extrabold">
                {/* A product with variants is always sold as one, so show the
                    real variant price ("desde $X"); the product-level promo
                    only applies to simple ones. */}
                {minVariant != null ? (
                  <span className="text-primary">
                    {variantRange
                      ? t("priceFrom", { price: money(minVariant) })
                      : money(minVariant)}
                  </span>
                ) : product.promoPriceCents != null ? (
                  <>
                    <span className="text-primary">{money(product.promoPriceCents)}</span>{" "}
                    <span className="text-muted-foreground/60 font-semibold line-through">
                      {money(product.basePriceCents)}
                    </span>
                  </>
                ) : (
                  money(product.basePriceCents)
                )}
              </span>
              <EarnBadge earn={product.earn} t={t} />
            </div>
          </div>
        </div>

        {product.description ? (
          <ResponsiveModalDescription className="bg-muted text-foreground mt-3 rounded-2xl p-3 text-sm leading-relaxed">
            <span className="text-muted-foreground/70 mb-1 block text-[0.6875rem] font-extrabold tracking-wider uppercase">
              {t("pickerContains")}
            </span>
            {plainText(product.description)}
          </ResponsiveModalDescription>
        ) : null}
      </div>

      <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-6 pb-4">
        {/* Recipe — the "Contiene…" ingredients the cashier can read out. */}
        {product.ingredients.length > 0 ? (
          <Group icon={<Leaf className="size-3.5" />} title={t("menuIngredients")}>
            <div className="flex flex-wrap gap-2">
              {product.ingredients.map((ing) => (
                <Pill key={ing}>{ing}</Pill>
              ))}
            </div>
          </Group>
        ) : null}

        {/* Tamaño — same price cards as the picker, minus the selection. */}
        {product.variants.length > 1 ? (
          <Group title={t("pickerSize")}>
            <div className="grid grid-cols-3 gap-2">
              {product.variants.map((v) => {
                const delta = effective(v) - baseRef;
                return (
                  <div key={v.id} className="border-border rounded-2xl border-2 p-3 text-center">
                    <div className="text-sm font-extrabold">
                      {variantLabel(v) || t("pickerDefaultVariant")}
                    </div>
                    <div className="mt-0.5 text-sm font-bold">
                      {money(effective(v))}
                      {v.promoPriceCents != null && v.promoPriceCents < v.priceCents ? (
                        <span className="text-muted-foreground/50 ml-1 text-xs font-semibold line-through">
                          {money(v.priceCents)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground/70 text-[0.6875rem] font-bold">
                      {delta === 0 ? "base" : `${delta > 0 ? "+" : ""}${money(delta)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Group>
        ) : null}

        {/* Add-ons — the field the register actually sells from. */}
        {product.addonGroups.map((g) => (
          <Group key={g.id} title={g.name || t("pickerAddons")}>
            <div className="flex flex-wrap gap-2">
              {g.items.map((it) => (
                <Pill key={it.addonId}>
                  {it.name}
                  {it.priceDeltaCents > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · +{money(it.priceDeltaCents)}
                    </span>
                  ) : null}
                </Pill>
              ))}
            </div>
          </Group>
        ))}

        {/* What the customer can ask to leave out. */}
        {product.removableIngredients.length > 0 ? (
          <Group title={t("pickerRemove")}>
            <div className="flex flex-wrap gap-2">
              {product.removableIngredients.map((r) => (
                <Pill key={r.ingredientId} muted>
                  {t("pickerWithout", { name: r.name })}
                </Pill>
              ))}
            </div>
          </Group>
        ) : null}

        {/* Legacy modifier groups (sugar level and friends). The register can't
            record them — the picker sells from `addonGroups` — but the catalog
            is where the cashier looks an answer up, so dropping them outright
            would take away one they used to have. Muted, and below the add-ons
            a sale can actually carry. */}
        {product.modifierGroups.map((g) => (
          <Group key={g.id} title={g.name}>
            <div className="flex flex-wrap gap-2">
              {g.options.map((o) => (
                <Pill key={o.id} muted>
                  {o.name}
                  {o.priceDeltaCents > 0 ? (
                    <span className="text-foreground font-extrabold">
                      {" "}
                      · +{money(o.priceDeltaCents)}
                    </span>
                  ) : null}
                </Pill>
              ))}
            </div>
          </Group>
        ))}
      </div>

      <div className="border-border flex-none border-t px-6 py-4">
        <ResponsiveModalClose
          variant="secondary"
          className={cn(CASHIER.action, "w-full rounded-2xl text-base")}
        >
          {t("close")}
        </ResponsiveModalClose>
      </div>
    </div>
  );
}

/** The picker's group heading, so both sheets label their sections the same. */
function Group({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

/** A read-only echo of the picker's add-on chip. */
function Pill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "border-border inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold",
        muted && "text-muted-foreground",
      )}
    >
      {children}
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
  return (
    <CashierBadge tone="primary">
      {earn.stamp ? `+1 ${t("stampOne")}` : t("earnPoints", { points: earn.points })}
    </CashierBadge>
  );
}

function StateBadge({
  state,
  t,
}: {
  state: "draft" | "scheduled" | "active" | "expired";
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <CashierBadge
      tone={state === "active" ? "primary" : state === "scheduled" ? "warning" : "neutral"}
    >
      {state === "active"
        ? t("bannerActive")
        : state === "scheduled"
          ? t("bannerScheduled")
          : t("bannerExpired")}
    </CashierBadge>
  );
}
