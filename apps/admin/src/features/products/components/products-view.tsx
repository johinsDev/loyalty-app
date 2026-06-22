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
import { FolderTree, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

import {
  categoryLabel,
  categoryRefs,
  type Product,
  products,
  type Status,
} from "../data";

const STATUSES: Status[] = ["active", "draft"];

/**
 * Productos — searchable catalog filtered by category (single-select) and status
 * (multi-select), with a grid / list view toggle. Add/edit open the product
 * wizard; "edit categories" jumps to the category manager; delete confirms via
 * an AlertDialog then offers undo. Design-first / hardcoded (../data).
 */
export function ProductsView() {
  const t = useTranslations("Products");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [view, setView] = useState<ViewMode>("grid");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const categoryOptions: FilterOption<string>[] = categoryRefs().map((r) => ({
    value: r.id,
    label: r.label,
  }));
  const statusOptions: FilterOption<Status>[] = [
    { value: "active", label: t("status.active"), dot: "#1f9d68" },
    { value: "draft", label: t("status.draft"), dot: "#9aa1ab" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== null && !p.categoryIds.includes(category)) return false;
      if (!statuses.includes(p.status)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category, statuses]);

  const clearFilters = () => {
    setQuery("");
    setCategory(null);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-xl font-semibold"
            onClick={() => router.push("/products/categories")}
          >
            <FolderTree className="size-4" />
            {t("editCategories")}
          </Button>
          <Button
            className="h-10 gap-2 rounded-xl font-semibold"
            onClick={() => router.push("/products/new")}
          >
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
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
          allLabel={t("categoryFilter")}
          value={category}
          onValueChange={setCategory}
          options={categoryOptions}
          searchable
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
          icon={Package}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              style={fade(i++)}
              onClick={() =>
                router.push({ pathname: "/products/[id]", params: { id: p.id } })
              }
              className="bg-card border-border flex cursor-pointer flex-col rounded-3xl border p-4 shadow-sm"
            >
              <div className="bg-muted/50 relative grid aspect-square place-items-center rounded-2xl text-6xl">
                {p.emoji}
                {p.status === "draft" ? (
                  <Badge
                    variant="secondary"
                    className="text-muted-foreground absolute top-2 left-2"
                  >
                    {t("status.draft")}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {categoryLabel(p.categoryIds[0] ?? "")}
                  </div>
                </div>
                <span className="font-bold">${p.price.toFixed(2)}</span>
              </div>
              <p className="text-muted-foreground/70 mt-2 text-xs font-semibold">
                {t("variantsCount", { n: p.variantCount })}
              </p>
              <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 gap-1.5 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push({
                      pathname: "/products/[id]",
                      params: { id: p.id },
                    });
                  }}
                >
                  <Pencil className="size-3.5" />
                  {t("edit")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("delete")}
                  className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToDelete(p);
                  }}
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
                <TableHead>{t("col.product")}</TableHead>
                <TableHead>{t("col.category")}</TableHead>
                <TableHead className="text-right">{t("col.variants")}</TableHead>
                <TableHead className="text-right">{t("col.price")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push({ pathname: "/products/[id]", params: { id: p.id } })
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-muted/50 grid size-9 flex-none place-items-center rounded-xl text-lg">
                        {p.emoji}
                      </span>
                      <span className="font-bold">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {categoryLabel(p.categoryIds[0] ?? "")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-semibold">
                    {p.variantCount}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ${p.price.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        p.status === "active"
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {t(`status.${p.status}`)}
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
                          router.push({
                            pathname: "/products/[id]",
                            params: { id: p.id },
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
                        onClick={() => setToDelete(p)}
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
              className="bg-destructive text-white hover:bg-destructive/90 h-10 px-4"
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
