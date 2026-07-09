"use client";

import {
  Badge,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Coins, Layers, Lock, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { autoCurrency } from "../lib/cost";
import { REWARD_FILTERS, type RewardCurrency, type RewardListItem } from "../types";

/**
 * The interactive heart of the rewards screen, wired to `rewards.list`: a
 * debounced search field, the todas/próximas/listas/canjeadas filter chips, the
 * curated section rows (Novedades/Destacados), the full infinite catalog with a
 * sentinel for the next page, and a ResponsiveModal reward detail that issues a
 * signed claim QR for ready rewards. All filter/search/open state lives in the
 * URL via nuqs, so views are shareable and survive a reload. Client component.
 */
export function RewardsCatalog() {
  const t = useTranslations("Rewards");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const openClaim = useQrDrawer((s) => s.openClaim);

  const [q, setQ] = useQueryStates({
    f: parseAsStringLiteral(REWARD_FILTERS).withDefault("all"),
    search: parseAsString.withDefault(""),
    reward: parseAsString,
    // Owned by AllLevelsSheet; set here so the detail can open it.
    levels: parseAsBoolean.withDefault(false),
  });

  // The input is local + debounced; the debounced value is what hits the URL.
  const [input, setInput] = useState(q.search);
  const debounced = useDebounce(input, { wait: 300 });
  useEffect(() => {
    if (debounced !== q.search) void setQ({ search: debounced || null });
  }, [debounced, q.search, setQ]);

  const search = q.search.trim();
  const listQuery = useInfiniteQuery(
    trpc.rewards.list.infiniteQueryOptions(
      { filter: q.f, search: search || undefined, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );

  // Redeemed rewards live in the "Canjeadas recientemente" section + its "Ver
  // todo" history view, so there's no redeemed filter chip here.
  const filters: { key: (typeof REWARD_FILTERS)[number]; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "listos", label: t("filterReady") },
    { key: "proximos", label: t("filterSoon") },
  ];

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );
  // Curated rows come from the first page (server returns them per-filter).
  const sections = listQuery.data?.pages[0]?.sections ?? [];

  const selected = q.reward
    ? (items.find((reward) => reward.id === q.reward) ?? null)
    : null;

  // Infinite scroll: a sentinel at the end of the list fetches the next page.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting &&
        listQuery.hasNextPage &&
        !listQuery.isFetchingNextPage
      ) {
        void listQuery.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery]);

  return (
    <div className="flex flex-col gap-4">
      <InputGroup className="bg-card h-12 rounded-full border-transparent px-1.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <InputGroupAddon>
          <Stamp className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
      </InputGroup>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((item) => {
          const active = q.f === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => void setQ({ f: item.key })}
              aria-pressed={active}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {listQuery.isPending ? (
        <CatalogSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          text={search ? t("emptySearch", { query: search }) : t("emptyFilter")}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Curated rows above the full list — only on the unfiltered view. */}
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="text-muted-foreground mb-2.5 px-0.5 text-xs font-bold tracking-wider uppercase">
                {t(`section.${section.key}`)}
              </h2>
              <div className="grid items-stretch gap-3.5 sm:grid-cols-2">
                {section.items.map((reward, i) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    onSelect={() => void setQ({ reward: reward.id })}
                    style={fade(i)}
                  />
                ))}
              </div>
            </section>
          ))}

          <div>
            {sections.length > 0 ? (
              <h2 className="text-muted-foreground mb-2.5 px-0.5 text-xs font-bold tracking-wider uppercase">
                {t("section.todos")}
              </h2>
            ) : null}
            <div className="grid items-stretch gap-3.5 sm:grid-cols-2">
              {items.map((reward, i) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  onSelect={() => void setQ({ reward: reward.id })}
                  style={fade(i)}
                />
              ))}
            </div>
          </div>

          {listQuery.isFetchingNextPage ? <CatalogSkeleton /> : null}
          <div ref={sentinelRef} aria-hidden className="h-px" />
        </div>
      )}

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(open) => !open && void setQ({ reward: null })}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? (
            <RewardDetail
              reward={selected}
              onClaim={(currency) => {
                // Hand the customer straight to the unified QR view, encoded to
                // this reward's signed claim token for the cashier to scan.
                void setQ({ reward: null });
                openClaim({
                  kind: "reward",
                  rewardId: selected.id,
                  currency,
                });
              }}
              onViewLevels={() => void setQ({ reward: null, levels: true })}
            />
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground rounded-3xl border border-dashed py-10 text-center text-sm">
      {text}
    </p>
  );
}

/** "9 sellos", "120 pts", or "9 sellos o 120 pts" / "… y …" per costMode. */
function useCostLabel() {
  const t = useTranslations("Rewards");
  return (reward: RewardListItem) => {
    const parts: string[] = [];
    if (reward.stampsRequired != null)
      parts.push(t("costStamps", { count: reward.stampsRequired }));
    if (reward.pointsCost != null)
      parts.push(t("costPoints", { count: reward.pointsCost }));
    if (parts.length < 2) return parts[0] ?? "";
    return reward.costMode === "and"
      ? t("costAnd", { a: parts[0]!, b: parts[1]! })
      : t("costOr", { a: parts[0]!, b: parts[1]! });
  };
}

function RewardCard({
  reward,
  onSelect,
  style,
}: {
  reward: RewardListItem;
  onSelect: () => void;
  style?: CSSProperties;
}) {
  const t = useTranslations("Rewards");
  const costLabel = useCostLabel();
  const ready = reward.status === "ready";
  const redeemed = reward.status === "redeemed";
  const locked = reward.status === "locked";

  // The dominant progress (the closest-to-affordable accepted currency).
  const progresses = [
    reward.stamps.required != null ? reward.stamps.progress : null,
    reward.points.required != null ? reward.points.progress : null,
  ].filter((p): p is number => p != null);
  const pct = ready
    ? 100
    : Math.round(Math.max(0, ...progresses, 0) * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      className={`bg-card flex h-full w-full flex-col gap-3.5 rounded-3xl p-[1.125rem] text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10 ${
        ready || redeemed ? "" : "opacity-65"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="from-primary/15 to-primary/5 grid size-14 shrink-0 place-items-center overflow-hidden rounded-[1.125rem] bg-gradient-to-br text-2xl"
          // v2 visual: the reward's own gradient/pattern when there's no image.
          style={!reward.imageUrl && reward.backgroundCss ? { background: reward.backgroundCss } : undefined}
        >
          {locked ? (
            <Lock className="text-muted-foreground size-6" />
          ) : reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reward.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            (reward.icon ?? "🎁")
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground text-[1.0625rem] leading-tight font-bold">
            {reward.name}
          </span>
          {reward.description ? (
            <span className="text-muted-foreground text-[0.8125rem] leading-snug">
              {reward.description}
            </span>
          ) : null}
        </div>
        {/* Top-right keeps only the status badge; the cost moves onto its own
            line below the description (FIX 4). */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {redeemed ? (
            <Badge
              variant="secondary"
              className="rounded-full px-2 py-0.5 text-[0.625rem] font-extrabold tracking-wider"
            >
              {t("redeemedBadge")}
            </Badge>
          ) : ready ? (
            <Badge className="rounded-full px-2 py-0.5 text-[0.625rem] font-extrabold tracking-wider">
              {t("ready")}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Cost on its own line below the description. */}
      <span className="font-display text-foreground -mt-1 text-sm leading-tight font-semibold tracking-tight">
        {costLabel(reward)}
      </span>

      {locked ? (
        <p className="text-muted-foreground mt-auto inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
          <Lock className="size-3.5" />
          {reward.allowedTiers && reward.allowedTiers.length > 0
            ? t("exclusiveTier", { tier: reward.allowedTiers[0]! })
            : t("lockedGeneric")}
        </p>
      ) : redeemed ? (
        <p className="text-muted-foreground mt-auto text-[0.8125rem] font-semibold">
          {t("redeemedBadge")}
        </p>
      ) : (
        <div className="mt-auto flex flex-col gap-3.5">
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className="from-primary to-primary/50 h-full rounded-full bg-gradient-to-r transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[0.8125rem] font-semibold">
            <span className="text-muted-foreground inline-flex items-center gap-1">
              {reward.stamps.required != null ? (
                <>
                  <Stamp className="size-3.5" />
                  {t("balanceStamps", {
                    have: reward.stamps.balance,
                    cost: reward.stamps.required,
                  })}
                </>
              ) : (
                <>
                  <Coins className="size-3.5" />
                  {t("balancePoints", {
                    have: reward.points.balance,
                    cost: reward.points.required ?? 0,
                  })}
                </>
              )}
            </span>
            <span className={ready ? "text-primary font-bold" : "text-muted-foreground"}>
              {ready ? t("progressReady") : `${pct}%`}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

function RewardDetail({
  reward,
  onClaim,
  onViewLevels,
}: {
  reward: RewardListItem;
  onClaim: (currency: RewardCurrency | "both") => void;
  onViewLevels: () => void;
}) {
  const t = useTranslations("Rewards");
  const format = useCostLabel();
  const trpc = useTRPC();
  const ready = reward.status === "ready";
  const redeemed = reward.status === "redeemed";
  const locked = reward.status === "locked";

  // Keep the detail fresh while open (the list item is a snapshot).
  const { data } = useQuery(
    trpc.rewards.detail.queryOptions({ rewardId: reward.id }),
  );
  const view = data ?? reward;

  const auto = autoCurrency(view);
  // Default to a currency the customer can actually afford, so the picker never
  // starts on (or Canjear-enables) a balance they can't pay with. For an "or"
  // reward that takes both, prefer the first affordable currency; fall back to
  // the unambiguous `auto` only when nothing is affordable yet.
  const preferred: RewardCurrency | "both" | null =
    view.affordableWith[0] ?? auto;
  // For an "or" reward that accepts both, let the user pick which to spend.
  const [currency, setCurrency] = useState<RewardCurrency | "both" | null>(
    preferred,
  );

  const chooseCurrencies: RewardCurrency[] = [];
  if (view.stamps.required != null) chooseCurrencies.push("stamps");
  if (view.points.required != null) chooseCurrencies.push("points");
  const mustChoose = view.costMode === "or" && chooseCurrencies.length === 2;

  /** Can the customer pay with the given selection right now? */
  const canAfford = (c: RewardCurrency | "both" | null): boolean => {
    if (c === "stamps") return view.stamps.affordable;
    if (c === "points") return view.points.affordable;
    // "both" (an "and"-cost reward) needs BOTH balances.
    if (c === "both") return view.stamps.affordable && view.points.affordable;
    return false;
  };
  const selectedAffordable = canAfford(currency);

  return (
    <div className="flex flex-col items-center px-6 pb-2 text-center">
      <span
        className="from-primary/15 to-primary/5 shadow-primary/10 mt-2 grid size-24 place-items-center overflow-hidden rounded-[1.75rem] bg-gradient-to-br text-5xl shadow-lg"
        style={!view.imageUrl && view.backgroundCss ? { background: view.backgroundCss } : undefined}
      >
        {locked ? (
          <Lock className="text-muted-foreground size-10" />
        ) : view.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          (view.icon ?? "🎁")
        )}
      </span>
      <ResponsiveModalHeader className="items-center gap-2">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {view.name}
        </ResponsiveModalTitle>
        <Badge
          variant="secondary"
          className="text-primary rounded-full px-3 py-1 text-sm font-bold"
        >
          {format(view)}
        </Badge>
        {view.description ? (
          <ResponsiveModalDescription className="text-[0.9375rem] leading-relaxed">
            {view.description}
          </ResponsiveModalDescription>
        ) : null}
      </ResponsiveModalHeader>

      <div className="bg-muted/60 mt-1 w-full rounded-2xl p-4 text-left">
        {redeemed && view.redeemedAt ? (
          <p className="text-foreground text-sm font-bold">
            {t("redeemedOn", {
              date: new Intl.DateTimeFormat(undefined, {
                day: "numeric",
                month: "long",
              }).format(view.redeemedAt),
            })}
          </p>
        ) : locked ? (
          <p className="text-foreground inline-flex items-center gap-2 text-sm font-bold">
            <Lock className="text-muted-foreground size-4" />
            {view.allowedTiers && view.allowedTiers.length > 0
              ? t("exclusiveTier", { tier: view.allowedTiers[0]! })
              : t("lockedGeneric")}
          </p>
        ) : (
          <ProgressRows reward={view} />
        )}
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {t("conditions")}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onViewLevels}
          className="text-primary mt-1 h-9 px-0 text-sm font-bold"
        >
          <Layers className="size-4" />
          {t("viewAllLevels")}
        </Button>
      </div>

      <ResponsiveModalFooter className="w-full gap-2 px-0">
        {ready ? (
          <>
            {mustChoose ? (
              <div className="flex w-full gap-2">
                {chooseCurrencies.map((c) => {
                  const affordable = canAfford(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => affordable && setCurrency(c)}
                      aria-pressed={currency === c}
                      disabled={!affordable}
                      className={`h-11 flex-1 rounded-full border text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        currency === c
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border"
                      }`}
                    >
                      {c === "stamps"
                        ? t("payStamps", { count: view.stamps.required ?? 0 })
                        : t("payPoints", { count: view.points.required ?? 0 })}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <Button
              variant="gradient"
              size="lg"
              disabled={currency === null || !selectedAffordable}
              onClick={() =>
                currency && selectedAffordable && onClaim(currency)
              }
              className="h-13 w-full rounded-full text-base sm:w-auto"
            >
              {t("redeemCta")}
            </Button>
            <p className="text-muted-foreground w-full text-center text-xs leading-relaxed">
              {view.type === "freeProduct"
                ? t("appliesAtRegisterFreeProduct")
                : t("appliesAtRegister")}
            </p>
          </>
        ) : !redeemed ? (
          <Button
            variant="gradient"
            size="lg"
            disabled
            className="h-13 w-full rounded-full text-base sm:w-auto"
          >
            <Lock />
            {locked ? t("lockedGeneric") : t("notReadyCta")}
          </Button>
        ) : null}
        <ResponsiveModalClose className="w-full sm:w-auto">
          {t("close")}
        </ResponsiveModalClose>
      </ResponsiveModalFooter>
    </div>
  );
}

function ProgressRows({ reward }: { reward: RewardListItem }) {
  const t = useTranslations("Rewards");
  return (
    <div className="flex flex-col gap-2">
      {reward.stamps.required != null ? (
        <CurrencyRow
          icon={<Stamp className="size-4" />}
          label={t("balanceStamps", {
            have: reward.stamps.balance,
            cost: reward.stamps.required,
          })}
          progress={reward.stamps.affordable ? 1 : reward.stamps.progress}
        />
      ) : null}
      {reward.points.required != null ? (
        <CurrencyRow
          icon={<Coins className="size-4" />}
          label={t("balancePoints", {
            have: reward.points.balance,
            cost: reward.points.required,
          })}
          progress={reward.points.affordable ? 1 : reward.points.progress}
        />
      ) : null}
    </div>
  );
}

function CurrencyRow({
  icon,
  label,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  progress: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <div className="bg-card/70 h-2 overflow-hidden rounded-full">
        <div
          className="from-primary to-primary/50 h-full rounded-full bg-gradient-to-r"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="bg-card flex flex-col gap-3.5 rounded-3xl p-[1.125rem] shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-14 shrink-0 rounded-[1.125rem]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-8 w-10 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
