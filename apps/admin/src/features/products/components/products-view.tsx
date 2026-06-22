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
} from "@loyalty/ui";
import { Pencil, Plus, Search, Stamp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import { type Category, categories, type Product, products } from "../data";

/**
 * Productos — searchable, category-filtered card grid. Add/edit open the
 * product wizard (/products/new, /products/[id]); delete confirms via an
 * AlertDialog. Design-first / hardcoded (../data).
 */
export function ProductsView() {
  const t = useTranslations("Products");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category]);

  const onDelete = () => {
    if (!toDelete) return;
    toast.success(t("deleted", { name: toDelete.name }));
    setToDelete(null);
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
          onClick={() => router.push("/products/new")}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-card placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            {t("allCategories")}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {t(`category.${c}`)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              style={fade(i++)}
              className="bg-card border-border group flex flex-col rounded-3xl border p-4 shadow-sm"
            >
              <div className="bg-muted/50 relative grid aspect-square place-items-center rounded-2xl text-6xl">
                {p.emoji}
                {!p.active ? (
                  <Badge
                    variant="secondary"
                    className="text-muted-foreground absolute top-2 left-2"
                  >
                    {t("inactive")}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="text-muted-foreground/70 text-xs font-semibold">
                    {t(`category.${p.category}`)}
                  </div>
                </div>
                <span className="font-bold">{p.price}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {p.earnsStamp ? (
                  <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
                    <Stamp className="size-3" />
                    {t("earnsStamp")}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 text-xs font-semibold">
                    {t("noStamp")}
                  </span>
                )}
                {p.points > 0 ? (
                  <span className="text-muted-foreground/70 text-xs font-bold">
                    +{p.points} pts
                  </span>
                ) : null}
              </div>
              <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 gap-1.5 rounded-lg"
                  onClick={() =>
                    router.push({
                      pathname: "/products/[id]",
                      params: { id: p.id },
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
                  onClick={() => setToDelete(p)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
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
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
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
      className={`h-8 rounded-full px-3 text-xs font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground border-border border"
      }`}
    >
      {children}
    </button>
  );
}
