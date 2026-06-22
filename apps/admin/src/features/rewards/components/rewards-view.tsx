"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { Coins, Gift, Pencil, Plus, Search, Stamp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import {
  type FilterOption,
  FilterMultiSelect,
  FilterSelect,
} from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import { type CostType, type Reward, rewards } from "../data";

type StatusKey = "active" | "inactive";
const STATUSES: StatusKey[] = ["active", "inactive"];

/**
 * Recompensas — searchable card grid filtered by cost type (single-select) and
 * status (multi-select). Add/edit open the reward wizard; delete confirms via an
 * AlertDialog then offers undo. Design-first / hardcoded (../data).
 */
export function RewardsView() {
  const t = useTranslations("Rewards");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });

  const [query, setQuery] = useState("");
  const [costType, setCostType] = useState<CostType | null>(null);
  const [statuses, setStatuses] = useState<StatusKey[]>([...STATUSES]);
  const [view, setView] = useState<ViewMode>("grid");
  const [toDelete, setToDelete] = useState<Reward | null>(null);

  const costOptions: FilterOption<CostType>[] = [
    { value: "stamps", label: t("cost.stampsLabel") },
    { value: "points", label: t("cost.pointsLabel") },
  ];
  const statusOptions: FilterOption<StatusKey>[] = [
    { value: "active", label: t("active"), dot: "#1f9d68" },
    { value: "inactive", label: t("inactive"), dot: "#9aa1ab" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rewards.filter((r) => {
      if (costType && r.costType !== costType) return false;
      if (!statuses.includes(r.active ? "active" : "inactive")) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, costType, statuses]);

  const clearFilters = () => {
    setQuery("");
    setCostType(null);
    setStatuses([...STATUSES]);
  };

  const onDelete = () => {
    if (!toDelete) return;
    const name = toDelete.name;
    setToDelete(null);
    toast.success(t("deleted", { name }), {
      action: {
        label: t("undo"),
        onClick: () => toast(t("restored", { name })),
      },
    });
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <Button
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={() => router.push("/rewards/new")}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-card placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <FilterSelect
          allLabel={t("allCostTypes")}
          value={costType}
          onValueChange={setCostType}
          options={costOptions}
        />
        <FilterMultiSelect
          label={t("statusFilter")}
          options={statusOptions}
          selected={statuses}
          onChange={setStatuses}
        />
        <ViewToggle
          value={view}
          onValueChange={setView}
          ariaLabel={tCommon("viewToggle")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              style={fade(i++)}
              className="bg-card border-border flex flex-col rounded-3xl border p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 grid size-12 flex-none place-items-center rounded-2xl text-2xl">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.name}</div>
                  <span className="text-primary mt-0.5 inline-flex items-center gap-1 text-sm font-extrabold">
                    {r.costType === "stamps" ? (
                      <Stamp className="size-3.5" />
                    ) : (
                      <Coins className="size-3.5" />
                    )}
                    {r.cost === 0
                      ? t("free")
                      : t(`cost.${r.costType}`, { n: r.cost })}
                  </span>
                </div>
                {!r.active ? (
                  <Badge variant="secondary" className="text-muted-foreground">
                    {t("inactive")}
                  </Badge>
                ) : null}
              </div>

              <p className="text-muted-foreground/70 mt-3 text-xs font-semibold">
                {t("redeemedCount", { n: r.redeemed })}
              </p>

              <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 gap-1.5 rounded-lg"
                  onClick={() =>
                    router.push({
                      pathname: "/rewards/[id]",
                      params: { id: r.id },
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                  {t("edit")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("delete")}
                  className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                  onClick={() => setToDelete(r)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.reward")}</TableHead>
                <TableHead>{t("col.cost")}</TableHead>
                <TableHead className="text-right">{t("col.redeemed")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push({ pathname: "/rewards/[id]", params: { id: r.id } })
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/10 grid size-9 flex-none place-items-center rounded-xl text-lg">
                        {r.emoji}
                      </span>
                      <span className="font-bold">{r.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-primary font-extrabold">
                    {r.cost === 0 ? t("free") : t(`cost.${r.costType}`, { n: r.cost })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-semibold">
                    {r.redeemed}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={r.active ? "text-emerald-600" : "text-muted-foreground"}
                    >
                      {t(r.active ? "active" : "inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("edit")}
                        className="size-8 rounded-lg"
                        onClick={() =>
                          router.push({ pathname: "/rewards/[id]", params: { id: r.id } })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("delete")}
                        className="text-destructive hover:bg-destructive/10 size-8 rounded-lg"
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
