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
import { Plus, Search, Tag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useRouter } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";

import { type Promo, type PromoType, PROMO_TYPES, promos, type Status } from "../data";

const STATUSES: Status[] = ["active", "scheduled", "ended", "draft"];

const STATUS_DOT: Record<Status, string> = {
  active: "#1f9d68",
  scheduled: "#3b73d6",
  ended: "#9aa1ab",
  draft: "#c98a00",
};

const STATUS_TEXT: Record<Status, string> = {
  active: "text-emerald-600",
  scheduled: "text-blue-600",
  ended: "text-muted-foreground",
  draft: "text-amber-600",
};

/**
 * Promociones — searchable list (grid cards + data table) with status/type
 * filters, a view toggle, and a delete-with-undo flow. Rows open the promo
 * wizard. Design-first / hardcoded (../data); the seam is the Phase D promo
 * engine + notifications fan-out on publish.
 */
export function PromotionsView() {
  const t = useTranslations("Promotions");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 35 });

  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [types, setTypes] = useState<PromoType[]>([...PROMO_TYPES]);
  const [view, setView] = useState<ViewMode>("list");
  const [toDelete, setToDelete] = useState<Promo | null>(null);

  const statusOptions: FilterOption<Status>[] = STATUSES.map((s) => ({
    value: s,
    label: t(`status.${s}`),
    dot: STATUS_DOT[s],
  }));
  const typeOptions: FilterOption<PromoType>[] = PROMO_TYPES.map((ty) => ({
    value: ty,
    label: t(`type.${ty}`),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return promos.filter((p) => {
      if (!statuses.includes(p.status)) return false;
      if (!types.includes(p.type)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, statuses, types]);

  const clearFilters = () => {
    setQuery("");
    setStatuses([...STATUSES]);
    setTypes([...PROMO_TYPES]);
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

  const open = (id: string) =>
    router.push({ pathname: "/promotions/[id]", params: { id } });

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
          onClick={() => router.push("/promotions/new")}
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
        <FilterMultiSelect
          label={t("statusFilter")}
          options={statusOptions}
          selected={statuses}
          onChange={setStatuses}
        />
        <FilterMultiSelect
          label={t("typeFilter")}
          options={typeOptions}
          selected={types}
          onChange={setTypes}
        />
        <ViewToggle
          value={view}
          onValueChange={setView}
          ariaLabel={tCommon("viewToggle")}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
          <EmptyState
            icon={Tag}
            title={t("empty")}
            hint={t("emptyHint")}
            action={
              <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              style={fade(i++)}
              onClick={() => open(p.id)}
              className="bg-card border-border cursor-pointer rounded-3xl border p-5 text-left shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="text-muted-foreground/70 mt-0.5 text-xs font-semibold">
                    {t(`type.${p.type}`)}
                  </div>
                </div>
                <Badge variant="secondary" className={STATUS_TEXT[p.status]}>
                  {t(`status.${p.status}`)}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="font-display text-2xl font-semibold tracking-tight">
                  {p.reach.toLocaleString()}
                </div>
                <div className="text-muted-foreground/70 text-xs font-semibold">
                  {t("col.reach")}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.promo")}</TableHead>
                <TableHead>{t("col.type")}</TableHead>
                <TableHead className="text-right">{t("col.reach")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => open(p.id)}
                >
                  <TableCell className="font-bold">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {t(`type.${p.type}`)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {p.reach.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_TEXT[p.status]}>
                      {t(`status.${p.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(p);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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
            <AlertDialogCancel className="h-10 px-4">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction className="h-10 px-4" onClick={onDelete}>
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
