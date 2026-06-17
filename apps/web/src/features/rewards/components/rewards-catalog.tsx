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
import { Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { type Reward, rewards, stampsBalance } from "../data";

type FilterKey = "all" | "ready" | "soon";

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
 * The interactive heart of the rewards screen: a search field, the
 * todas/listas/próximas filter chips, the claimable + coming-up reward cards,
 * loading skeletons, and a bottom Drawer that opens with a reward's detail when
 * a card is tapped. Client component — everything below the tier card is state.
 */
export function RewardsCatalog() {
  const t = useTranslations("Rewards");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Reward | null>(null);
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
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rewards.filter((reward) => {
      const ready = stampsBalance >= reward.cost;
      if (filter === "ready" && !ready) return false;
      if (filter === "soon" && ready) return false;
      if (q && !`${reward.name} ${reward.description}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <InputGroup className="bg-card h-12 rounded-full border-transparent px-1.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <InputGroupAddon>
          <Search className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
      </InputGroup>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
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
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground rounded-3xl border border-dashed py-10 text-center text-sm">
          {query.trim()
            ? t("emptySearch", { query: query.trim() })
            : t("emptyFilter")}
        </p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {visible.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onSelect={() => setSelected(reward)}
            />
          ))}
        </div>
      )}

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          {selected ? <RewardDetail reward={selected} /> : null}
        </DrawerContent>
      </Drawer>
    </div>
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

function RewardDetail({ reward }: { reward: Reward }) {
  const t = useTranslations("Rewards");
  const { ready, missing } = useRewardView(reward);

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
          <Button variant="ghost" className="text-muted-foreground">
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
