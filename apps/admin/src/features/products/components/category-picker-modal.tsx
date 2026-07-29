"use client";

import type { CategoryTreeNode } from "@loyalty/api/features/categories/schemas";
import { Button, Input, Label } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntityPickerModal, type PickerItem } from "@/components/entity-picker-modal";
import { useTRPC } from "@/lib/trpc/client";

/** How a row spells out its product count — supplied by the caller so the copy
 *  stays in the message catalogue. */
type CountLabel = (n: number) => string;

/** Tree → flat picker rows: parents become group headers, leaves become items. */
function toItems(nodes: CategoryTreeNode[], countLabel: CountLabel): PickerItem[] {
  const items: PickerItem[] = [];
  for (const node of nodes) {
    if (node.children.length === 0) {
      // A root with no children is a plain, selectable row.
      items.push({
        id: node.id,
        label: node.name,
        meta: metaOf(node, countLabel),
      });
      continue;
    }
    // Grouping categories can't hold products, so they only frame their leaves.
    for (const child of node.children) {
      items.push({
        id: child.id,
        label: child.name,
        meta: metaOf(child, countLabel),
        groupId: node.id,
        groupLabel: node.name,
        groupMeta: countLabel(node.productCount),
      });
    }
  }
  return items;
}

const metaOf = (node: CategoryTreeNode, countLabel: CountLabel) =>
  [node.description, countLabel(node.productCount)].filter(Boolean).join(" · ");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  primaryId: string | null;
  onApply: (ids: string[], primaryId: string | null) => void;
}

/**
 * Pick the categories a product belongs to — and create, rename or archive them
 * inline, so organizing the catalog never costs you an unsaved product draft.
 *
 * Selection is applied on "Aplicar"; the create/rename/archive mutations land
 * immediately (they're org-level resources). Metrics are skipped here: the picker
 * only needs product counts, so the server can avoid the sales scan.
 */
export function CategoryPickerModal({
  open,
  onOpenChange,
  selectedIds,
  primaryId,
  onApply,
}: Props) {
  const t = useTranslations("Products.cat");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const treeInput = { status: "active" as const, period: "30d" as const, metrics: false };
  const treeQuery = useQuery({
    ...trpc.categories.tree.queryOptions(treeInput),
    enabled: open,
  });
  const nodes = treeQuery.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.categories.tree.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.menu.categories.queryKey() });
  };

  const create = useMutation(trpc.categories.create.mutationOptions());
  const update = useMutation(trpc.categories.update.mutationOptions());
  const archive = useMutation(trpc.categories.archive.mutationOptions());
  const restore = useMutation(trpc.categories.restore.mutationOptions());

  const countLabel = useCallback((n: number) => t("productsN", { n }), [t]);
  const items = useMemo(() => toItems(nodes, countLabel), [nodes, countLabel]);
  const byId = useMemo(() => {
    const map = new Map<string, CategoryTreeNode>();
    const walk = (list: CategoryTreeNode[]) => {
      for (const n of list) {
        map.set(n.id, n);
        walk(n.children);
      }
    };
    walk(nodes);
    return map;
  }, [nodes]);

  return (
    <EntityPickerModal
      open={open}
      onOpenChange={onOpenChange}
      entity={{ singular: t("entitySingular"), plural: t("entityPlural") }}
      items={items}
      loading={treeQuery.isPending}
      selectedIds={selectedIds}
      primary={{ id: primaryId, label: t("primaryBadge") }}
      onApply={onApply}
      renderCreateForm={(close) => (
        <CategoryForm
          roots={nodes.filter((n) => n.parentId === null)}
          pending={create.isPending}
          onCancel={close}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (result) => {
                close();
                invalidate();
                if (result.movedCount > 0 && result.generalLeafName) {
                  toast.info(
                    t("movedToGeneral", {
                      n: result.movedCount,
                      leaf: result.generalLeafName,
                    }),
                    { duration: 8000 },
                  );
                } else {
                  toast.success(t("created"));
                }
              },
              onError: () => toast.error(t("errGeneric")),
            })
          }
        />
      )}
      renderEditForm={(item, close) => {
        const node = byId.get(item.id);
        return (
          <CategoryForm
            roots={nodes.filter((n) => n.parentId === null && n.id !== item.id)}
            pending={update.isPending}
            initial={{
              name: node?.name ?? item.label,
              description: node?.description ?? "",
              parentId: node?.parentId ?? null,
            }}
            // Renaming touches every product on it — say how many up front.
            notice={
              node && node.productCount > 0
                ? t("editAffects", { n: node.productCount })
                : undefined
            }
            onCancel={close}
            onSubmit={(values) =>
              update.mutate(
                { ...values, id: item.id },
                {
                  onSuccess: () => {
                    close();
                    invalidate();
                    toast.success(t("saved"));
                  },
                  onError: () => toast.error(t("errGeneric")),
                },
              )
            }
          />
        );
      }}
      onArchive={(item) =>
        archive.mutate(
          { id: item.id },
          {
            onSuccess: () => {
              invalidate();
              toast.success(t("archived", { name: item.label }), {
                action: {
                  label: t("undo"),
                  onClick: () =>
                    restore.mutate({ id: item.id }, { onSuccess: () => invalidate() }),
                },
              });
            },
            onError: () => toast.error(t("errGeneric")),
          },
        )
      }
      archiveWarning={(item) => {
        const node = byId.get(item.id);
        if (!node || node.productCount === 0) return t("archiveDescription");
        return t("archiveAffects", { n: node.productCount });
      }}
    />
  );
}

interface FormValues {
  name: string;
  description?: string;
  parentId: string | null;
}

/** Two fields plus an optional parent — small enough to live inline. */
function CategoryForm({
  roots,
  initial,
  notice,
  pending,
  onCancel,
  onSubmit,
}: {
  roots: CategoryTreeNode[];
  initial?: FormValues;
  notice?: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const t = useTranslations("Products.cat");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          parentId,
        });
      }}
    >
      {notice ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-3 py-2 text-xs font-semibold">
          {notice}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="picker-cat-name">{t("nameLabel")}</Label>
        <Input
          id="picker-cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="h-10"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="picker-cat-desc">{t("descriptionLabel")}</Label>
        <Input
          id="picker-cat-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          className="h-10"
        />
      </div>
      {roots.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="picker-cat-parent">{t("parentLabel")}</Label>
          {/* A native select keeps the inline form free of a nested popover. */}
          <select
            id="picker-cat-parent"
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value || null)}
            className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm font-semibold"
          >
            <option value="">{t("parentNone")}</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          className="h-10 flex-1 rounded-xl font-semibold"
          disabled={pending || !name.trim()}
        >
          {initial ? t("save") : t("createAndSelect")}
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
