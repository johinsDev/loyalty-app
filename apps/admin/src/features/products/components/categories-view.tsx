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
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
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

import { type Category, categories, type Subcategory } from "../data";

/** Move an item from one index to another in a fresh copy of the array. */
function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

let idSeq = 0;
function freshId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`;
}

type Editing = { id: string; name: string; subs: Subcategory[] } | null;

/**
 * Categorías — a reorderable tree of categories → subcategories with
 * create/edit/delete. Design-first: state is seeded from a clone of the
 * hardcoded catalog (../data) and all mutations stay local.
 */
export function CategoriesView() {
  const t = useTranslations("Products");

  const [list, setList] = useState<Category[]>(() =>
    categories.map((c) => ({ ...c, subcategories: [...c.subcategories] })),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Category-level drag
  const [dragCat, setDragCat] = useState<number | null>(null);

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSubs, setDraftSubs] = useState<Subcategory[]>([]);

  // Delete confirmation
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setDraftName("");
    setDraftSubs([]);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing({ id: cat.id, name: cat.name, subs: [...cat.subcategories] });
    setDraftName(cat.name);
    setDraftSubs(cat.subcategories.map((s) => ({ ...s })));
    setModalOpen(true);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    const subcategories = draftSubs
      .map((s) => ({ ...s, name: s.name.trim() }))
      .filter((s) => s.name);

    if (editing) {
      setList((prev) =>
        prev.map((c) =>
          c.id === editing.id ? { ...c, name, subcategories } : c,
        ),
      );
    } else {
      setList((prev) => [...prev, { id: freshId("c"), name, subcategories }]);
    }
    setModalOpen(false);
    toast.success(t("cat.save"));
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    const name = toDelete.name;
    setList((prev) => prev.filter((c) => c.id !== toDelete.id));
    setToDelete(null);
    toast.success(t("cat.deleted", { name }));
  };

  const deleteSubcategory = (catId: string, subId: string) => {
    setList((prev) =>
      prev.map((c) =>
        c.id === catId
          ? {
              ...c,
              subcategories: c.subcategories.filter((s) => s.id !== subId),
            }
          : c,
      ),
    );
  };

  const reorderSub = (catId: string, from: number, to: number) => {
    setList((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: move(c.subcategories, from, to) }
          : c,
      ),
    );
  };

  // Draft-modal subcategory helpers
  const addDraftSub = () =>
    setDraftSubs((prev) => [...prev, { id: freshId("s"), name: "" }]);
  const removeDraftSub = (id: string) =>
    setDraftSubs((prev) => prev.filter((s) => s.id !== id));
  const updateDraftSub = (id: string, name: string) =>
    setDraftSubs((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8">
      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("cat.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("cat.title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("cat.subtitle")}
          </p>
        </div>
        <Button className="h-10 gap-2 rounded-xl font-semibold" onClick={openCreate}>
          <Plus className="size-4" />
          {t("cat.create")}
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground mt-10 text-center text-sm font-semibold">
          {t("cat.empty")}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground/70 mt-5 text-xs font-semibold">
            {t("cat.reorderHint")}
          </p>
          <div className="bg-card border-border divide-y divide-border mt-2 rounded-3xl border">
            {list.map((cat, index) => {
              const isOpen = expanded.has(cat.id);
              const subCount = cat.subcategories.length;
              return (
                <div key={cat.id}>
                  <div
                    draggable
                    onDragStart={() => setDragCat(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragCat !== null) setList((prev) => move(prev, dragCat, index));
                      setDragCat(null);
                    }}
                    onDragEnd={() => setDragCat(null)}
                    className="flex items-center gap-2 p-3"
                  >
                    <GripVertical className="text-muted-foreground size-4 cursor-grab" />
                    <button
                      type="button"
                      aria-label={cat.name}
                      onClick={() => toggleExpanded(cat.id)}
                      className="hover:bg-muted/60 grid size-7 place-items-center rounded-lg"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold">{cat.name}</span>
                      {subCount > 0 ? (
                        <span className="text-muted-foreground/70 ml-2 text-xs font-semibold">
                          {subCount} subcategorías
                        </span>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t("cat.edit")}
                      className="size-9 rounded-lg"
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t("cat.delete")}
                      className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                      onClick={() => setToDelete(cat)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {isOpen && subCount > 0 ? (
                    <div className="border-border divide-y divide-border border-t pl-12">
                      {cat.subcategories.map((sub, subIndex) => (
                        <div
                          key={sub.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData("text/sub", String(subIndex));
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = Number(e.dataTransfer.getData("text/sub"));
                            if (!Number.isNaN(from)) reorderSub(cat.id, from, subIndex);
                          }}
                          className="flex items-center gap-2 py-2 pr-3"
                        >
                          <GripVertical className="text-muted-foreground size-4 cursor-grab" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {sub.name}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={t("cat.delete")}
                            className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                            onClick={() => deleteSubcategory(cat.id, sub.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create / edit category */}
      <ResponsiveModal open={modalOpen} onOpenChange={setModalOpen}>
        <ResponsiveModalContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-1 p-4 text-center sm:text-left">
              <ResponsiveModalTitle>
                {t(editing ? "cat.editCategory" : "cat.newCategory")}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {t("cat.subtitle")}
              </ResponsiveModalDescription>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-2">
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={t("cat.namePlaceholder")}
                className="h-10"
              />

              <div className="flex flex-col gap-2">
                {draftSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    <Input
                      value={sub.name}
                      onChange={(e) => updateDraftSub(sub.id, e.target.value)}
                      placeholder={t("cat.subPlaceholder")}
                      className="h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("cat.delete")}
                      className="text-destructive hover:bg-destructive/10 size-9 shrink-0 rounded-lg"
                      onClick={() => removeDraftSub(sub.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-1.5 rounded-lg"
                  onClick={addDraftSub}
                >
                  <Plus className="size-4" />
                  {t("cat.addSub")}
                </Button>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2 p-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setModalOpen(false)}
              >
                {t("cat.cancel")}
              </Button>
              <Button type="submit" className="h-10">
                {t("cat.save")}
              </Button>
            </div>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Delete confirmation */}
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
              onClick={onConfirmDelete}
              className="h-10 px-4 bg-destructive text-white hover:bg-destructive/90"
            >
              {t("cat.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
