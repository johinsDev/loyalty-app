"use client";

import type {
  CategoryStatusFilter,
  CategoryTreeNode,
} from "@loyalty/api/features/categories/schemas";
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderTree, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FilterSelect } from "@/components/filters";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { CategoriesTree } from "./categories-tree";

const STATUSES: CategoryStatusFilter[] = ["active", "archived", "all"];

type Editing = {
  id: string | null;
  name: string;
  description: string;
  parentId: string | null;
};

/** Replace one level's order in a cached tree, leaving every other level alone. */
function reorderLevel(
  nodes: CategoryTreeNode[],
  parentId: string | null,
  ids: string[],
): CategoryTreeNode[] {
  if (parentId === null) return sortByIds(nodes, ids);
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, children: sortByIds(n.children, ids) }
      : { ...n, children: reorderLevel(n.children, parentId, ids) },
  );
}

function sortByIds(nodes: CategoryTreeNode[], ids: string[]): CategoryTreeNode[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...nodes]
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map((n, i) => ({ ...n, sortOrder: i }));
}

/** Flatten to the roots that can still accept a child (depth is 2). */
const rootsOf = (nodes: CategoryTreeNode[]) => nodes.filter((n) => n.parentId === null);

/**
 * Category management: a reorderable two-level tree with per-row business
 * figures, search, and an active/archived filter.
 *
 * Deliberately **not** the server-driven data-table pattern the other admin lists
 * use: the order *is* the content here (it drives the customer menu), and drag
 * reordering cannot coexist with pagination or an arbitrary sort column. The list
 * is dozens of rows, so it is fetched whole.
 */
export function CategoriesView({ storeId }: { storeId: string | null }) {
  const t = useTranslations("Products.cat");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CategoryStatusFilter>("active");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [archiving, setArchiving] = useState<CategoryTreeNode | null>(null);

  const input = { search: search.trim() || undefined, status, period: "30d" as const, storeId };
  const treeOptions = trpc.categories.tree.queryOptions(input);
  const treeQuery = useQuery(treeOptions);
  const nodes = treeQuery.data ?? [];

  const usageQuery = useQuery({
    ...trpc.categories.usage.queryOptions({ id: archiving?.id ?? "" }),
    enabled: archiving !== null,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.categories.tree.queryKey() });

  const create = useMutation(trpc.categories.create.mutationOptions());
  const update = useMutation(trpc.categories.update.mutationOptions());
  const archive = useMutation(trpc.categories.archive.mutationOptions());
  const restore = useMutation(trpc.categories.restore.mutationOptions());
  const reorder = useMutation(trpc.categories.reorder.mutationOptions());

  // Dragging is only meaningful when every sibling is on screen: a search or the
  // archived filter hides rows, so the dropped position wouldn't mean anything.
  const draggable = search.trim() === "" && status === "active";

  const roots = useMemo(() => rootsOf(nodes), [nodes]);
  const parentOptions = useMemo(
    () => roots.filter((r) => r.id !== editing?.id).map((r) => ({ id: r.id, name: r.name })),
    [roots, editing?.id],
  );

  const onReorder = (parentId: string | null, ids: string[]) => {
    // Optimistic: the row already moved under the pointer, so write the new order
    // into the cache and only touch the server in the background.
    queryClient.setQueryData(treeOptions.queryKey, (old: CategoryTreeNode[] | undefined) =>
      old ? reorderLevel(old, parentId, ids) : old,
    );
    reorder.mutate(
      { parentId, ids },
      {
        onError: () => {
          toast.error(t("reorderFailed"));
          void invalidate();
        },
      },
    );
  };

  const submitEditing = () => {
    if (!editing || !editing.name.trim()) return;
    const payload = {
      name: editing.name.trim(),
      description: editing.description.trim() || undefined,
      parentId: editing.parentId,
    };
    const onDone = (result: { movedCount: number; generalLeafName: string | null }) => {
      setEditing(null);
      void invalidate();
      // Creating the first child of a populated category moves its products to an
      // auto-created leaf — never let that happen silently.
      if (result.movedCount > 0 && result.generalLeafName) {
        toast.info(
          t("movedToGeneral", { n: result.movedCount, leaf: result.generalLeafName }),
          { duration: 8000 },
        );
      } else {
        toast.success(editing.id ? t("saved") : t("created"));
      }
    };
    const onError = (err: unknown) => toast.error(errorMessage(err, t));

    if (editing.id) {
      update.mutate({ ...payload, id: editing.id }, { onSuccess: onDone, onError });
    } else {
      create.mutate(payload, { onSuccess: onDone, onError });
    }
  };

  const confirmArchive = () => {
    if (!archiving) return;
    const node = archiving;
    setArchiving(null);
    archive.mutate(
      { id: node.id },
      {
        onSuccess: () => {
          void invalidate();
          toast.success(t("archived", { name: node.name }), {
            action: {
              label: t("undo"),
              onClick: () =>
                restore.mutate({ id: node.id }, { onSuccess: () => void invalidate() }),
            },
          });
        },
        onError: (err) => toast.error(errorMessage(err, t)),
      },
    );
  };

  const filtered = search.trim() !== "" || status !== "active";

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-6 lg:px-8">
      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <div className="mt-4 mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">{t("subtitle")}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 pl-9"
          />
        </div>
        <FilterSelect
          allLabel={t("status.all")}
          label={t("status.label")}
          value={status === "all" ? null : status}
          onValueChange={(v) => setStatus(v ?? "all")}
          options={STATUSES.filter((s) => s !== "all").map((s) => ({
            value: s,
            label: t(`status.${s}`),
          }))}
        />
        <Button
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={() => setEditing({ id: null, name: "", description: "", parentId: null })}
        >
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </div>

      {!draggable && nodes.length > 0 ? (
        <p className="text-muted-foreground mb-3 text-xs font-semibold">{t("dragDisabled")}</p>
      ) : (
        <p className="text-muted-foreground mb-3 text-xs font-semibold">{t("reorderHint")}</p>
      )}

      {editing ? (
        <EditingPanel
          editing={editing}
          parents={parentOptions}
          pending={create.isPending || update.isPending}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSubmit={submitEditing}
        />
      ) : null}

      {treeQuery.isPending ? (
        <div className="border-border bg-card divide-border divide-y rounded-2xl border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3.5">
              <span className="bg-muted size-4 animate-pulse rounded" />
              <span className="bg-muted h-4 w-40 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={filtered ? t("noResults") : t("empty")}
          hint={filtered ? t("noResultsHint") : t("emptyHint")}
          action={
            filtered ? (
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setSearch("");
                  setStatus("active");
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          <CategoriesTree
            nodes={nodes}
            showMetrics
            draggable={draggable}
            onEdit={(n) =>
              setEditing({
                id: n.id,
                name: n.name,
                description: n.description ?? "",
                parentId: n.parentId,
              })
            }
            onAddChild={(n) =>
              setEditing({ id: null, name: "", description: "", parentId: n.id })
            }
            onArchive={setArchiving}
            onRestore={(n) =>
              restore.mutate(
                { id: n.id },
                {
                  onSuccess: () => {
                    void invalidate();
                    toast.success(t("restored", { name: n.name }));
                  },
                },
              )
            }
            onReorder={onReorder}
          />
        </div>
      )}

      <AlertDialog open={archiving !== null} onOpenChange={(o) => !o && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("archiveTitle", { name: archiving?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("archiveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>

          {/* What the archive touches. Promos/rewards/stamp rules reference
              categories from inside JSON with no FK, so they keep resolving —
              but the owner should know they exist before hiding the category. */}
          <ul className="text-muted-foreground space-y-1 text-sm font-semibold">
            {(archiving?.children.length ?? 0) > 0 ? (
              <li>· {t("usageChildren", { n: archiving?.children.length ?? 0 })}</li>
            ) : null}
            {usageQuery.data ? (
              <>
                {usageQuery.data.products > 0 ? (
                  <li>· {t("usageProducts", { n: usageQuery.data.products })}</li>
                ) : null}
                {usageQuery.data.promotions > 0 ? (
                  <li>· {t("usagePromotions", { n: usageQuery.data.promotions })}</li>
                ) : null}
                {usageQuery.data.rewards > 0 ? (
                  <li>· {t("usageRewards", { n: usageQuery.data.rewards })}</li>
                ) : null}
                {usageQuery.data.stampRules > 0 ? (
                  <li>· {t("usageStampRules")}</li>
                ) : null}
              </>
            ) : (
              <li className="bg-muted h-4 w-48 animate-pulse rounded" />
            )}
          </ul>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 px-4">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-destructive hover:bg-destructive/90 h-10 px-4 text-white"
            >
              {t("archiveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Inline create/edit panel — no nested modal, so it also works inside one. */
function EditingPanel({
  editing,
  parents,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  editing: Editing;
  parents: { id: string; name: string }[];
  pending: boolean;
  onChange: (e: Editing) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("Products.cat");
  const NONE = "__none__";

  return (
    <form
      className="border-border bg-muted/30 mb-4 space-y-3 rounded-2xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="font-display font-semibold tracking-tight">
        {editing.id ? t("editCategory") : t("newCategory")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">{t("nameLabel")}</Label>
          <Input
            id="cat-name"
            value={editing.name}
            onChange={(e) => onChange({ ...editing, name: e.target.value })}
            placeholder={t("namePlaceholder")}
            className="h-10"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">{t("descriptionLabel")}</Label>
          <Input
            id="cat-desc"
            value={editing.description}
            onChange={(e) => onChange({ ...editing, description: e.target.value })}
            placeholder={t("descriptionPlaceholder")}
            className="h-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("parentLabel")}</Label>
        <Select
          value={editing.parentId ?? NONE}
          onValueChange={(v) => onChange({ ...editing, parentId: v === NONE ? null : v })}
        >
          <SelectTrigger size="lg" className="w-full text-sm sm:max-w-xs">
            <SelectValue>
              {(v) => (v === NONE ? t("parentNone") : parents.find((p) => p.id === v)?.name)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("parentNone")}</SelectItem>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs font-semibold">{t("parentHint")}</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          className="h-10 rounded-xl font-semibold"
          disabled={pending || !editing.name.trim()}
        >
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Surface the repository's typed failures instead of a generic error toast. */
function errorMessage(err: unknown, t: (k: string) => string): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("category-too-deep")) return t("errTooDeep");
  if (message.includes("category-self-parent")) return t("errSelfParent");
  if (message.includes("category-not-assignable")) return t("errNotAssignable");
  return t("errGeneric");
}
