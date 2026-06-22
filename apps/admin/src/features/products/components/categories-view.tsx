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
  Button,
  Input,
} from "@loyalty/ui";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";

import { type Category, categories as seed, type Subcategory } from "../data";

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return list;
  copy.splice(to, 0, item);
  return copy;
}

const freshId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

type Editing = { id: string | null; name: string; subs: Subcategory[] } | null;

/**
 * Categories manager — a reorderable category → subcategory tree with inline
 * create/edit (no nested modal, so it works both on its page and inside a modal)
 * and delete confirmation. Design-first: mutations are local. Used by the page
 * {@link CategoriesView} and by a modal in the product editor (so editing
 * categories never navigates away and loses the product draft).
 */
export function CategoriesManager() {
  const t = useTranslations("Products");
  const [cats, setCats] = useState<Category[]>(() =>
    seed.map((c) => ({ ...c, subcategories: [...c.subcategories] })),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startCreate = () => setEditing({ id: null, name: "", subs: [] });
  const startEdit = (c: Category) =>
    setEditing({
      id: c.id,
      name: c.name,
      subs: c.subcategories.map((s) => ({ ...s })),
    });

  const saveEditing = () => {
    if (!editing || !editing.name.trim()) return;
    const subs = editing.subs.filter((s) => s.name.trim());
    if (editing.id) {
      setCats((prev) =>
        prev.map((c) =>
          c.id === editing.id
            ? { ...c, name: editing.name.trim(), subcategories: subs }
            : c,
        ),
      );
    } else {
      setCats((prev) => [
        ...prev,
        { id: freshId("c"), name: editing.name.trim(), subcategories: subs },
      ]);
    }
    setEditing(null);
  };

  const onDelete = () => {
    if (!toDelete) return;
    setCats((prev) => prev.filter((c) => c.id !== toDelete.id));
    toast.success(t("cat.deleted", { name: toDelete.name }));
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm font-semibold">
          {t("cat.reorderHint")}
        </p>
        <Button
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={startCreate}
        >
          <Plus className="size-4" />
          {t("cat.create")}
        </Button>
      </div>

      {/* Inline create/edit form */}
      {editing ? (
        <div className="border-border bg-muted/30 space-y-3 rounded-2xl border p-4">
          <div className="font-display font-semibold tracking-tight">
            {editing.id ? t("cat.editCategory") : t("cat.newCategory")}
          </div>
          <Input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder={t("cat.namePlaceholder")}
            className="h-10"
            autoFocus
          />
          <div className="space-y-2">
            {editing.subs.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => {
                    const subs = [...editing.subs];
                    subs[i] = { ...s, name: e.target.value };
                    setEditing({ ...editing, subs });
                  }}
                  placeholder={t("cat.subPlaceholder")}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("cat.delete")}
                  className="text-destructive hover:bg-destructive/10 size-10 flex-none rounded-xl"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      subs: editing.subs.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-xl"
              onClick={() =>
                setEditing({
                  ...editing,
                  subs: [...editing.subs, { id: freshId("s"), name: "" }],
                })
              }
            >
              <Plus className="size-4" />
              {t("cat.addSub")}
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => setEditing(null)}
            >
              {t("cat.cancel")}
            </Button>
            <Button
              className="h-10 rounded-xl font-semibold"
              onClick={saveEditing}
            >
              {t("cat.save")}
            </Button>
          </div>
        </div>
      ) : null}

      {cats.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t("cat.empty")}
        </p>
      ) : (
        <div className="border-border divide-border bg-card divide-y overflow-hidden rounded-2xl border">
          {cats.map((c, idx) => (
            <div key={c.id}>
              <div
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    setCats((prev) => move(prev, dragIndex, idx));
                  }
                  setDragIndex(null);
                }}
                className="flex items-center gap-2 px-3 py-2.5"
              >
                <GripVertical className="text-muted-foreground size-4 flex-none cursor-grab" />
                {c.subcategories.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {expanded.has(c.id) ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                ) : (
                  <span className="size-4" />
                )}
                <span className="flex-1 font-bold">{c.name}</span>
                {c.subcategories.length > 0 ? (
                  <span className="text-muted-foreground/70 text-xs font-semibold">
                    {c.subcategories.length}
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("cat.edit")}
                  className="size-8 rounded-lg"
                  onClick={() => startEdit(c)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("cat.delete")}
                  className="text-destructive hover:bg-destructive/10 size-8 rounded-lg"
                  onClick={() => setToDelete(c)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {expanded.has(c.id) ? (
                <div className="bg-muted/20 divide-border divide-y border-t">
                  {c.subcategories.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 py-2 pr-3 pl-12 text-sm"
                    >
                      <span className="flex-1 font-semibold">{s.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
            <AlertDialogTitle>{t("cat.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cat.deleteDescription", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 px-4">
              {t("cat.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive h-10 px-4 text-white hover:bg-destructive/90"
            >
              {t("cat.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Full-page categories screen (linked from the products list). The editor uses
 * the manager inside a modal instead, to preserve the in-progress draft. */
export function CategoriesView() {
  const t = useTranslations("Products");
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8">
      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        {t("cat.back")}
      </Link>
      <div className="mt-4 mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("cat.title")}
        </h1>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
          {t("cat.subtitle")}
        </p>
      </div>
      <CategoriesManager />
    </div>
  );
}
