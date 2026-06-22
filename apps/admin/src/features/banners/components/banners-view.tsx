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
import { Image as ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import {
  type Banner,
  type BannerType,
  banners,
  GRADIENTS,
  gradientCss,
  type Status,
  STATUSES,
} from "../data";

const TYPES: BannerType[] = ["promo", "standalone"];
const STATUS_DOT: Record<Status, string> = {
  active: "#1f9d68",
  scheduled: "#3b73d6",
  expired: "#9aa1ab",
  draft: "#c98a00",
};
const STATUS_TEXT: Record<Status, string> = {
  active: "text-emerald-600",
  scheduled: "text-blue-600",
  expired: "text-muted-foreground",
  draft: "text-amber-600",
};

/**
 * Banners — a card grid (mini gradient preview, type, status, range, clicks)
 * with status/type filters. Add/edit open the banner wizard; delete confirms +
 * offers undo. Design-first / hardcoded (../data).
 */
export function BannersView() {
  const t = useTranslations("Banners");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });

  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [types, setTypes] = useState<BannerType[]>([...TYPES]);
  const [view, setView] = useState<ViewMode>("grid");
  const [toDelete, setToDelete] = useState<Banner | null>(null);

  const statusOptions: FilterOption<Status>[] = STATUSES.map((s) => ({
    value: s,
    label: t(`status.${s}`),
    dot: STATUS_DOT[s],
  }));
  const typeOptions: FilterOption<BannerType>[] = TYPES.map((ty) => ({
    value: ty,
    label: t(`type.${ty}`),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return banners.filter((b) => {
      if (!statuses.includes(b.status)) return false;
      if (!types.includes(b.type)) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, statuses, types]);

  const clearFilters = () => {
    setQuery("");
    setStatuses([...STATUSES]);
    setTypes([...TYPES]);
  };

  const onDelete = () => {
    if (!toDelete) return;
    const name = toDelete.title;
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
          onClick={() => router.push("/banners/new")}
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
        <EmptyState
          icon={ImageIcon}
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
          {filtered.map((b) => {
            const g = GRADIENTS.find((x) => x.key === b.gradient) ?? GRADIENTS[0]!;
            return (
              <div
                key={b.id}
                style={fade(i++)}
                className="bg-card border-border flex flex-col rounded-3xl border p-4 shadow-sm"
              >
                <div
                  className="relative flex h-24 items-center gap-2 overflow-hidden rounded-2xl px-4 text-white"
                  style={{ background: gradientCss(g) }}
                >
                  <span className="text-3xl">{b.emoji}</span>
                  <span className="font-display text-lg font-semibold leading-tight">
                    {b.title}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={`gap-1.5 ${STATUS_TEXT[b.status]}`}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: STATUS_DOT[b.status] }}
                    />
                    {t(`status.${b.status}`)}
                  </Badge>
                  <span className="text-muted-foreground/70 text-xs font-semibold">
                    {t(`type.${b.type}`)} · {b.range}
                  </span>
                </div>
                <div className="text-muted-foreground/70 mt-2 text-xs font-semibold">
                  {t("clicksCount", { n: b.clicks.toLocaleString() })}
                </div>
                <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 gap-1.5 rounded-lg"
                    onClick={() =>
                      router.push({ pathname: "/banners/[id]", params: { id: b.id } })
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
                    onClick={() => setToDelete(b)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.banner")}</TableHead>
                <TableHead>{t("col.type")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead>{t("col.range")}</TableHead>
                <TableHead className="text-right">{t("col.clicks")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const g =
                  GRADIENTS.find((x) => x.key === b.gradient) ?? GRADIENTS[0]!;
                return (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push({
                        pathname: "/banners/[id]",
                        params: { id: b.id },
                      })
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid size-9 flex-none place-items-center rounded-xl text-lg text-white"
                          style={{ background: gradientCss(g) }}
                        >
                          {b.emoji}
                        </span>
                        <span className="font-bold">{b.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-semibold">
                      {t(`type.${b.type}`)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`gap-1.5 ${STATUS_TEXT[b.status]}`}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: STATUS_DOT[b.status] }}
                        />
                        {t(`status.${b.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-semibold">
                      {b.range}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-semibold">
                      {b.clicks.toLocaleString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={t("edit")}
                          className="size-8 rounded-lg"
                          onClick={() =>
                            router.push({
                              pathname: "/banners/[id]",
                              params: { id: b.id },
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={t("delete")}
                          className="text-destructive hover:bg-destructive/10 size-8 rounded-lg"
                          onClick={() => setToDelete(b)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
              {t("deleteDescription", { name: toDelete?.title ?? "" })}
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
