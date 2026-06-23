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
import { MapPin, Pencil, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useRouter } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";

import { type Status, STATUSES, type Store, stores } from "../data";

const STATUS_DOT: Record<Status, string> = {
  active: "#1f9d68",
  inactive: "#9aa1ab",
};
const STATUS_TEXT: Record<Status, string> = {
  active: "text-emerald-600",
  inactive: "text-muted-foreground",
};

/**
 * Tiendas — locations list with search + status filter + grid/list toggle.
 * Add/edit navigate to a dedicated page; delete confirms + offers undo.
 * Design-first / hardcoded (../data); the seam is the tRPC `stores.list` query.
 */
export function StoresView() {
  const t = useTranslations("Stores");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 40 });

  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [view, setView] = useState<ViewMode>("grid");
  const [toDelete, setToDelete] = useState<Store | null>(null);

  const statusOptions: FilterOption<Status>[] = STATUSES.map((s) => ({
    value: s,
    label: t(`status.${s}`),
    dot: STATUS_DOT[s],
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (!statuses.includes(s.status)) return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.address.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [query, statuses]);

  const clearFilters = () => {
    setQuery("");
    setStatuses([...STATUSES]);
  };

  const onDelete = () => {
    if (!toDelete) return;
    const name = toDelete.name;
    setToDelete(null);
    toast.success(t("deleted", { name }), {
      action: { label: t("undo"), onClick: () => toast(t("restored", { name })) },
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
          onClick={() => router.push("/stores/new")}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

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
        <ViewToggle
          value={view}
          onValueChange={setView}
          ariaLabel={tCommon("viewToggle")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
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
          {filtered.map((s) => (
            <div
              key={s.id}
              style={fade(i++)}
              className="bg-card border-border flex flex-col rounded-3xl border p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display truncate text-lg font-semibold tracking-tight">
                    {s.name}
                  </div>
                  <div className="text-muted-foreground/80 mt-1 flex items-start gap-1.5 text-sm font-medium">
                    <MapPin className="mt-0.5 size-3.5 flex-none" />
                    <span className="min-w-0">{s.address}</span>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`gap-1.5 ${STATUS_TEXT[s.status]}`}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: STATUS_DOT[s.status] }}
                  />
                  {t(`status.${s.status}`)}
                </Badge>
              </div>

              <div className="text-muted-foreground/70 mt-3 text-xs font-semibold">
                {t("membersCount", { n: s.members })}
              </div>

              <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 gap-1.5 rounded-lg"
                  onClick={() => router.push({ pathname: "/stores/[id]", params: { id: s.id } })}
                >
                  <Pencil className="size-3.5" />
                  {t("edit")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("delete")}
                  className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                  onClick={() => setToDelete(s)}
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
                <TableHead>{t("col.store")}</TableHead>
                <TableHead>{t("col.address")}</TableHead>
                <TableHead className="text-right">{t("col.members")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push({ pathname: "/stores/[id]", params: { id: s.id } })}
                >
                  <TableCell className="font-bold">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {s.address}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-semibold">
                    {s.members}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`gap-1.5 ${STATUS_TEXT[s.status]}`}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: STATUS_DOT[s.status] }}
                      />
                      {t(`status.${s.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("edit")}
                        className="size-8 rounded-lg"
                        onClick={() => router.push({ pathname: "/stores/[id]", params: { id: s.id } })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("delete")}
                        className="text-destructive hover:bg-destructive/10 size-8 rounded-lg"
                        onClick={() => setToDelete(s)}
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
            <AlertDialogCancel className="h-10 px-4">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive h-10 px-4 text-white hover:bg-destructive/90"
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
