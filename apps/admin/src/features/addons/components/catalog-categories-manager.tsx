"use client";

import {
  Button,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Inline manager for the supply-catalog taxonomy — no dedicated route, it opens
 * from the list it serves.
 *
 * For `addon` categories this is a live surface: a product's add-on group can
 * resolve its membership through a category, so adding or removing an entry
 * changes what those products offer at the register. That's the point of the
 * feature, but it must never be a surprise — hence the "affects N products"
 * warning on every row that has dependents.
 */
export function CatalogCategoriesManager({
  kind,
  open,
  onClose,
}: {
  kind: "addon" | "ingredient";
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Addons");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.catalogCategories.list.queryOptions({ kind }));
  const create = useMutation(trpc.catalogCategories.create.mutationOptions());
  const update = useMutation(trpc.catalogCategories.update.mutationOptions());
  const remove = useMutation(trpc.catalogCategories.remove.mutationOptions());

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const categories = listQuery.data ?? [];
  const refresh = async () => {
    await queryClient.invalidateQueries();
    router.refresh();
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ kind, name, sortOrder: categories.length });
      setNewName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  const onRename = async (id: string, sortOrder: number) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await update.mutateAsync({ id, name, sortOrder });
      setEditingId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  const onRemove = async (id: string) => {
    try {
      await remove.mutateAsync({ id });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {t("categories.title")}
          </ResponsiveModalTitle>
          <p className="text-muted-foreground mt-1 text-sm font-semibold">
            {t("categories.hint")}
          </p>

          <div className="mt-4 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("categories.placeholder")}
              className="h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreate();
              }}
            />
            <Button onClick={() => void onCreate()} disabled={!newName.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-1.5">
            {categories.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm font-semibold">
                {t("categories.empty")}
              </p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="border-border flex items-center gap-2 rounded-xl border px-3 py-2"
                >
                  {editingId === c.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-9"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void onRename(c.id, c.sortOrder);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button size="sm" onClick={() => void onRename(c.id, c.sortOrder)}>
                        {t("save")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="text-muted-foreground/70 text-xs font-semibold">
                          {t("categories.members", { n: c.memberCount })}
                          {c.productCount > 0 ? (
                            <span className="text-amber-600">
                              {" · "}
                              <TriangleAlert className="inline size-3" />{" "}
                              {t("categories.affects", { n: c.productCount })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t("edit")}
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        aria-label={t("delete")}
                        onClick={() => void onRemove(c.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
