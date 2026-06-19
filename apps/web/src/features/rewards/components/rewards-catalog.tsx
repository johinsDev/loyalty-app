"use client";

import {
  Badge,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Skeleton,
} from "@loyalty/ui";
import { useDebounce } from "ahooks";
import { Check, Layers, Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useEffect, useMemo, useState } from "react";

import {
  type Reward,
  nextTier,
  recentRedemptions,
  rewards,
  stampsBalance,
  tierForReward,
} from "../data";

const FILTER_KEYS = ["all", "ready", "soon", "redeemed"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/** Per-reward derived state shared by the list rows and the detail drawer. */
function useRewardView(reward: Reward) {
  const ready = stampsBalance >= reward.cost;
  return {
    ready,
    have: Math.min(stampsBalance, reward.cost),
    missing: Math.max(0, reward.cost - stampsBalance),
    pct: ready ? 100 : Math.round((stampsBalance / reward.cost) * 100),
  };
}

/**
 * The interactive heart of the rewards screen: a debounced search field, the
 * todas/listas/próximas/canjeadas filter chips, the claimable + coming-up reward
 * cards (or the redemption ledger), loading skeletons, and a bottom Drawer with a
 * reward's detail — its gating tier, benefits and progress. All filter, search
 * and open-drawer state lives in the URL via nuqs, so views are shareable and
 * survive a reload. Client component.
 */
export function RewardsCatalog() {
  const t = useTranslations("Rewards");

  const [q, setQ] = useQueryStates({
    f: parseAsStringLiteral(FILTER_KEYS).withDefault("all"),
    search: parseAsString.withDefault(""),
    reward: parseAsString,
    // Owned by AllLevelsSheet; set here so the detail can open it.
    levels: parseAsBoolean.withDefault(false),
  });

  // The input is local + debounced; the debounced value is what hits the URL.
  const [input, setInput] = useState(q.search);
  const debounced = useDebounce(input, { wait: 350 });
  useEffect(() => {
    if (debounced !== q.search) void setQ({ search: debounced || null });
  }, [debounced, q.search, setQ]);

  const [loading, setLoading] = useState(true);

  // Demo-only: exercise the skeletons on mount. Remove once the catalog is
  // backed by the rewards API and a real loading state.
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(id);
  }, []);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "ready", label: t("filterReady") },
    { key: "soon", label: t("filterSoon") },
    { key: "redeemed", label: t("filterRedeemed") },
  ];

  const query = q.search.trim().toLowerCase();

  const visible = useMemo(() => {
    return rewards.filter((reward) => {
      const ready = stampsBalance >= reward.cost;
      if (q.f === "ready" && !ready) return false;
      if (q.f === "soon" && ready) return false;
      if (
        query &&
        !`${reward.name} ${reward.description}`.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [query, q.f]);

  const visibleRedemptions = useMemo(() => {
    if (!query) return recentRedemptions;
    return recentRedemptions.filter((item) =>
      item.name.toLowerCase().includes(query),
    );
  }, [query]);

  const selected = q.reward
    ? (rewards.find((reward) => reward.id === q.reward) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
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

      {loading ? (
        <CatalogSkeleton />
      ) : q.f === "redeemed" ? (
        visibleRedemptions.length === 0 ? (
          <EmptyState
            text={query ? t("emptySearch", { query: q.search.trim() }) : t("emptyRedeemed")}
          />
        ) : (
          <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
            {visibleRedemptions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary/10 grid size-10 shrink-0 place-items-center rounded-xl text-xl">
                    {item.emoji}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-bold">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.date}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-sm font-bold">
                  {item.amount}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          text={query ? t("emptySearch", { query: q.search.trim() }) : t("emptyFilter")}
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {visible.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onSelect={() => void setQ({ reward: reward.id })}
            />
          ))}
        </div>
      )}

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && void setQ({ reward: null })}
      >
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          {selected ? (
            <RewardDetail
              reward={selected}
              onViewLevels={() => void setQ({ reward: null, levels: true })}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
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

function RewardCard({
  reward,
  onSelect,
}: {
  reward: Reward;
  onSelect: () => void;
}) {
  const t = useTranslations("Rewards");
  const { ready, have, missing, pct } = useRewardView(reward);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`bg-card flex w-full flex-col gap-3.5 rounded-3xl p-[1.125rem] text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10 ${
        ready ? "" : "opacity-65"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="from-primary/15 to-primary/5 grid size-14 shrink-0 place-items-center rounded-[1.125rem] bg-gradient-to-br text-2xl">
          {ready ? reward.emoji : <Lock className="text-muted-foreground size-6" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground text-[1.0625rem] leading-tight font-bold">
            {reward.name}
          </span>
          <span className="text-muted-foreground text-[0.8125rem] leading-snug">
            {reward.description}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {ready ? (
            <Badge className="rounded-full px-2 py-0.5 text-[0.625rem] font-extrabold tracking-wider">
              {t("ready")}
            </Badge>
          ) : null}
          <span className="font-display text-foreground text-3xl leading-none font-semibold tracking-tight">
            {reward.cost}
          </span>
          <span className="text-muted-foreground text-[0.625rem] font-bold tracking-widest">
            {t("costUnit")}
          </span>
        </div>
      </div>

      <div className="bg-muted h-2.5 overflow-hidden rounded-full">
        <div
          className="from-primary to-primary/50 h-full rounded-full bg-gradient-to-r transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[0.8125rem] font-semibold">
        <span className="text-muted-foreground">
          {t("stampsProgress", { have, cost: reward.cost })}
        </span>
        <span className={ready ? "text-primary font-bold" : "text-muted-foreground"}>
          {ready ? t("progressReady") : t("stampsLeft", { count: missing })}
        </span>
      </div>
    </button>
  );
}

function RewardDetail({
  reward,
  onViewLevels,
}: {
  reward: Reward;
  onViewLevels: () => void;
}) {
  const t = useTranslations("Rewards");
  const { ready, missing } = useRewardView(reward);
  const tier = tierForReward(reward);
  const next = nextTier();

  return (
    <div className="flex flex-col items-center px-6 pb-2 text-center">
      <span className="from-primary/15 to-primary/5 shadow-primary/10 mt-2 grid size-24 place-items-center rounded-[1.75rem] bg-gradient-to-br text-5xl shadow-lg">
        {ready ? reward.emoji : <Lock className="text-muted-foreground size-10" />}
      </span>
      <DrawerHeader className="items-center gap-2">
        <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
          {reward.name}
        </DrawerTitle>
        <Badge
          variant="secondary"
          className="text-primary rounded-full px-3 py-1 text-sm font-bold"
        >
          {t("costAmount", { count: reward.cost })}
        </Badge>
        <DrawerDescription className="text-[0.9375rem] leading-relaxed">
          {reward.description}
        </DrawerDescription>
      </DrawerHeader>

      {/* Gating tier — which level unlocks this reward and what it includes. */}
      <div className="bg-muted/60 mt-1 w-full rounded-2xl p-4 text-left">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-foreground text-sm font-bold">
            {t("detailTier", { name: `${tier.emoji} ${tier.name}` })}
          </span>
          {next ? (
            <span className="text-muted-foreground text-xs font-semibold whitespace-nowrap">
              {t("detailToNext", {
                count: Math.max(0, next.at - stampsBalance),
                name: `${next.emoji} ${next.name}`,
              })}
            </span>
          ) : null}
        </div>
        <ul className="flex flex-col gap-1.5">
          {tier.benefits.map((benefit) => (
            <li
              key={benefit}
              className="text-foreground flex items-center gap-2 text-sm"
            >
              <Check className="text-primary size-3.5 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
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

      <DrawerFooter className="w-full gap-2 px-0">
        {ready ? (
          <DrawerClose asChild>
            <Button variant="gradient" size="lg" className="h-13 rounded-full text-base">
              {t("redeemFor", { count: reward.cost })}
            </Button>
          </DrawerClose>
        ) : (
          <Button
            variant="gradient"
            size="lg"
            disabled
            className="h-13 rounded-full text-base"
          >
            <Lock />
            {t("lockedCta", { count: missing })}
          </Button>
        )}
        <DrawerClose asChild>
          <Button
            variant="secondary"
            size="lg"
            className="h-13 rounded-full text-base font-semibold"
          >
            {t("close")}
          </Button>
        </DrawerClose>
      </DrawerFooter>
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
