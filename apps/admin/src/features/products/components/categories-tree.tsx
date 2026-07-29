"use client";

import type { CategoryTreeNode } from "@loyalty/api/features/categories/schemas";
import { Button } from "@loyalty/ui";
import { Reorder, useDragControls, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { GripVertical, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

export interface CategoryTreeActions {
  onEdit: (node: CategoryTreeNode) => void;
  onAddChild: (node: CategoryTreeNode) => void;
  onArchive: (node: CategoryTreeNode) => void;
  onRestore: (node: CategoryTreeNode) => void;
  /** Persist one level's order. `parentId` null = the roots. */
  onReorder: (parentId: string | null, ids: string[]) => void;
}

interface Props extends CategoryTreeActions {
  nodes: CategoryTreeNode[];
  /** Metrics are hidden when the caller asked for counts only. */
  showMetrics: boolean;
  /** Dragging is meaningless while a search or archive filter hides rows. */
  draggable: boolean;
}

/**
 * The category tree: roots reorderable among themselves, children reorderable
 * within their parent. Cross-parent dragging is deliberately not supported —
 * `Reorder` has no concept of moving an item between lists, and re-parenting is a
 * rare action that belongs in the edit form's "parent" select.
 *
 * Order persists on drop (optimistic); the caller reverts on failure.
 */
export function CategoriesTree({ nodes, showMetrics, draggable, ...actions }: Props) {
  return (
    <Level
      nodes={nodes}
      parentId={null}
      showMetrics={showMetrics}
      draggable={draggable}
      {...actions}
    />
  );
}

function Level({
  nodes,
  parentId,
  showMetrics,
  draggable,
  ...actions
}: Props & { parentId: string | null }) {
  const reduced = useReducedMotion();

  if (!draggable) {
    return (
      <ul className="divide-border divide-y">
        {nodes.map((node) => (
          <li key={node.id}>
            <Row node={node} showMetrics={showMetrics} draggable={false} {...actions} />
            {node.children.length > 0 ? (
              <div className="border-border bg-muted/20 border-t pl-7">
                <Level
                  nodes={node.children}
                  parentId={node.id}
                  showMetrics={showMetrics}
                  draggable={false}
                  {...actions}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Reorder.Group
      axis="y"
      values={nodes.map((n) => n.id)}
      onReorder={(ids) => actions.onReorder(parentId, ids as string[])}
      className="divide-border divide-y"
      // `layout` animations are what make the swap read as motion rather than a
      // jump; honour the OS setting and let rows snap instead.
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
    >
      {nodes.map((node) => (
        <DraggableRow
          key={node.id}
          node={node}
          showMetrics={showMetrics}
          reduced={Boolean(reduced)}
          {...actions}
        />
      ))}
    </Reorder.Group>
  );
}

function DraggableRow({
  node,
  showMetrics,
  reduced,
  ...actions
}: CategoryTreeActions & {
  node: CategoryTreeNode;
  showMetrics: boolean;
  reduced: boolean;
}) {
  // Drag starts from the handle only, so the row's buttons stay clickable.
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={node.id}
      dragListener={false}
      dragControls={controls}
      className="bg-card"
      whileDrag={{
        scale: reduced ? 1 : 1.01,
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
        zIndex: 10,
        position: "relative",
      }}
    >
      <Row
        node={node}
        showMetrics={showMetrics}
        draggable
        onHandlePointerDown={(e) => controls.start(e)}
        {...actions}
      />
      {node.children.length > 0 ? (
        <div className="border-border bg-muted/20 border-t pl-7">
          <Level
            nodes={node.children}
            parentId={node.id}
            showMetrics={showMetrics}
            draggable
            {...actions}
          />
        </div>
      ) : null}
    </Reorder.Item>
  );
}

function Row({
  node,
  showMetrics,
  draggable,
  onHandlePointerDown,
  onEdit,
  onAddChild,
  onArchive,
  onRestore,
}: CategoryTreeActions & {
  node: CategoryTreeNode;
  showMetrics: boolean;
  draggable: boolean;
  onHandlePointerDown?: (e: React.PointerEvent) => void;
}) {
  const t = useTranslations("Products.cat");
  const archived = node.archivedAt !== null;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      {draggable ? (
        <button
          type="button"
          aria-label={t("dragHandle")}
          onPointerDown={onHandlePointerDown}
          className="text-muted-foreground hover:text-foreground flex-none cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="size-4 flex-none" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate font-bold ${archived ? "text-muted-foreground" : ""}`}>
            {node.name}
          </span>
          {archived ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-bold">
              {t("archivedBadge")}
            </span>
          ) : null}
          {!node.isLeaf ? (
            <span className="text-muted-foreground/70 text-[11px] font-bold">
              {t("groupBadge")}
            </span>
          ) : null}
        </div>
        {node.description ? (
          <p className="text-muted-foreground truncate text-xs font-semibold">
            {node.description}
          </p>
        ) : null}
      </div>

      <div className="text-muted-foreground hidden flex-none items-center gap-4 text-xs font-semibold sm:flex">
        <span>{t("productsN", { n: node.productCount })}</span>
        {showMetrics ? (
          <>
            <span className="text-foreground tabular-nums">{fmtCop(node.revenueCents)}</span>
            <span className="tabular-nums">{node.sharePct}%</span>
            <span className="tabular-nums">{t("unitsN", { n: node.units })}</span>
            <span className="tabular-nums">
              {node.marginPct === null ? "—" : `${node.marginPct}%`}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex flex-none items-center gap-1">
        {/* Only a root can take children — the tree is two levels deep. */}
        {node.parentId === null && !archived ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("addChild")}
            className="size-8 rounded-lg"
            onClick={() => onAddChild(node)}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          aria-label={t("edit")}
          className="size-8 rounded-lg"
          onClick={() => onEdit(node)}
        >
          <Pencil className="size-3.5" />
        </Button>
        {archived ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("restore")}
            className="size-8 rounded-lg"
            onClick={() => onRestore(node)}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("archive")}
            className="text-destructive hover:bg-destructive/10 size-8 rounded-lg"
            onClick={() => onArchive(node)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
