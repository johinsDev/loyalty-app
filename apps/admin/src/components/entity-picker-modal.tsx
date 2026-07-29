"use client";

import {
  Button,
  Checkbox,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

/** One selectable row. `groupLabel` renders a non-selectable header above it. */
export interface PickerItem {
  id: string;
  label: string;
  /** Secondary line — e.g. "Teas, boba and sodas · 24 products". */
  meta?: string;
  /** Items sharing a `groupId` render under one header. */
  groupId?: string;
  groupLabel?: string;
  groupMeta?: string;
  /** Rows that exist for context only (a grouping category, an archived row). */
  selectable?: boolean;
  editable?: boolean;
  archivable?: boolean;
}

export interface EntityPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drives every string: "3 categorías disponibles", "Crear categoría", … */
  entity: { singular: string; plural: string };
  items: PickerItem[];
  loading?: boolean;

  /** Selection is DEFERRED: local until `onApply`. */
  selectedIds: string[];
  onApply: (ids: string[], primaryId: string | null) => void;
  /** Optional single-select emphasis (which pick owns revenue attribution). */
  primary?: { id: string | null; label: string };

  /**
   * Management is IMMEDIATE — these write to the server and the list refetches.
   * Cancelling the modal never undoes them, which is why the footer only ever
   * promises to discard the *selection*.
   */
  renderCreateForm?: (close: () => void) => ReactNode;
  renderEditForm?: (item: PickerItem, close: () => void) => ReactNode;
  onArchive?: (item: PickerItem) => void;
  /** Extra warning inside the inline archive confirmation. */
  archiveWarning?: (item: PickerItem) => ReactNode;
}

/**
 * One overlay for picking from — and managing — a shared catalog (categories,
 * add-ons, ingredients, …) without leaving the form you're in.
 *
 * Two kinds of change coexist and are deliberately NOT symmetric:
 * - **selection** (what this entity gets) is local, applied by "Aplicar";
 * - **management** (create / rename / archive) writes immediately, because those
 *   are org-level resources — a category you created should still exist after you
 *   cancel out of a product you never saved.
 *
 * Create/edit/archive render *inline* rather than in a nested overlay: stacked
 * modals trap focus badly and this component is itself often opened from a form.
 */
export function EntityPickerModal({
  open,
  onOpenChange,
  entity,
  items,
  loading = false,
  selectedIds,
  onApply,
  primary,
  renderCreateForm,
  renderEditForm,
  onArchive,
  archiveWarning,
}: EntityPickerModalProps) {
  const t = useTranslations("EntityPicker");
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [draftPrimary, setDraftPrimary] = useState<string | null>(primary?.id ?? null);
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  // Re-seed the local draft each time the modal opens, so a cancelled edit
  // doesn't leak into the next one.
  const [seed, setSeed] = useState(open);
  if (open !== seed) {
    setSeed(open);
    if (open) {
      setDraft(selectedIds);
      setDraftPrimary(primary?.id ?? null);
      setQuery("");
      setOnlySelected(false);
      setCreating(false);
      setEditingId(null);
      setArchivingId(null);
    }
  }

  const selectableCount = items.filter((i) => i.selectable !== false).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (onlySelected && !draft.includes(item.id)) return false;
      if (!needle) return true;
      return (
        item.label.toLowerCase().includes(needle) ||
        (item.meta ?? "").toLowerCase().includes(needle) ||
        (item.groupLabel ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, query, onlySelected, draft]);

  const toggle = (item: PickerItem) => {
    setDraft((prev) => {
      const on = prev.includes(item.id);
      const next = on ? prev.filter((id) => id !== item.id) : [...prev, item.id];
      // The first pick owns attribution; unpicking the primary hands it over.
      if (on && draftPrimary === item.id) setDraftPrimary(next[0] ?? null);
      if (!on && draftPrimary === null) setDraftPrimary(item.id);
      return next;
    });
  };

  // Group headers are derived from the item list, so callers just tag their rows.
  const rows: ({ kind: "group"; id: string; label: string; meta?: string } | {
    kind: "item";
    item: PickerItem;
  })[] = [];
  let lastGroup: string | undefined;
  for (const item of visible) {
    if (item.groupId && item.groupId !== lastGroup) {
      rows.push({
        kind: "group",
        id: item.groupId,
        label: item.groupLabel ?? "",
        ...(item.groupMeta ? { meta: item.groupMeta } : {}),
      });
    }
    lastGroup = item.groupId;
    rows.push({ kind: "item", item });
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        showCloseButton
        mobileClassName="mx-auto w-full max-w-2xl"
        desktopClassName="sm:max-w-xl"
      >
        <div className="flex min-h-0 flex-col">
          <div className="px-6 pt-6 pb-3">
            <ResponsiveModalTitle>{t("title", { plural: entity.plural })}</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {t("summary", { available: selectableCount, applied: draft.length })}
            </ResponsiveModalDescription>

            <div className="relative mt-4">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder", { plural: entity.plural })}
                className="h-10 pl-9"
                autoFocus
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Tab active={!onlySelected} onClick={() => setOnlySelected(false)}>
                {t("tabAll")}
              </Tab>
              <Tab active={onlySelected} onClick={() => setOnlySelected(true)}>
                {t("tabSelected", { n: draft.length })}
              </Tab>
              {draft.length > 0 ? (
                <button
                  type="button"
                  className="text-primary ml-auto text-sm font-bold"
                  onClick={() => {
                    setDraft([]);
                    setDraftPrimary(null);
                  }}
                >
                  {t("clear")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 pb-4">
            {renderCreateForm ? (
              creating ? (
                <div className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
                  <p className="text-primary mb-3 text-xs font-bold uppercase">
                    {t("newEntity", { singular: entity.singular })}
                  </p>
                  {renderCreateForm(() => setCreating(false))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="border-primary/40 text-primary hover:bg-primary/5 flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 font-bold"
                >
                  <span className="bg-primary/10 grid size-7 place-items-center rounded-lg">
                    <Plus className="size-4" />
                  </span>
                  {t("createEntity", { singular: entity.singular })}
                </button>
              )
            ) : null}

            {loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="border-border h-16 animate-pulse rounded-2xl border" />
              ))
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm font-semibold">
                {t("noResults")}
              </p>
            ) : (
              rows.map((row) =>
                row.kind === "group" ? (
                  <div
                    key={`g-${row.id}`}
                    className="text-muted-foreground flex items-baseline gap-2 px-1 pt-3 text-xs font-bold uppercase"
                  >
                    <span>{row.label}</span>
                    {row.meta ? <span className="normal-case">{row.meta}</span> : null}
                  </div>
                ) : (
                  <ItemRow
                    key={row.item.id}
                    item={row.item}
                    indented={Boolean(row.item.groupId)}
                    checked={draft.includes(row.item.id)}
                    isPrimary={draftPrimary === row.item.id}
                    primaryLabel={primary?.label}
                    onToggle={() => toggle(row.item)}
                    onSetPrimary={() => setDraftPrimary(row.item.id)}
                    editing={editingId === row.item.id}
                    onEdit={renderEditForm ? () => setEditingId(row.item.id) : undefined}
                    renderEditForm={renderEditForm}
                    onCloseEdit={() => setEditingId(null)}
                    archiving={archivingId === row.item.id}
                    onStartArchive={onArchive ? () => setArchivingId(row.item.id) : undefined}
                    onCancelArchive={() => setArchivingId(null)}
                    onConfirmArchive={() => {
                      setArchivingId(null);
                      setDraft((prev) => prev.filter((id) => id !== row.item.id));
                      onArchive?.(row.item);
                    }}
                    archiveWarning={archiveWarning}
                  />
                ),
              )
            )}
          </div>

          <div className="border-border flex items-center gap-3 border-t px-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {t("selectedCount", { n: draft.length })}
              </p>
              {/* Only the SELECTION is pending — creates/edits already landed. */}
              <p className="text-muted-foreground truncate text-xs font-semibold">
                {t("selectionPending")}
              </p>
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className="h-10 rounded-xl font-semibold"
              onClick={() => {
                onApply(draft, draftPrimary);
                onOpenChange(false);
              }}
            >
              {t("apply")}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-3.5 text-sm font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ItemRow({
  item,
  indented,
  checked,
  isPrimary,
  primaryLabel,
  onToggle,
  onSetPrimary,
  editing,
  onEdit,
  renderEditForm,
  onCloseEdit,
  archiving,
  onStartArchive,
  onCancelArchive,
  onConfirmArchive,
  archiveWarning,
}: {
  item: PickerItem;
  indented: boolean;
  checked: boolean;
  isPrimary: boolean;
  primaryLabel?: string;
  onToggle: () => void;
  onSetPrimary: () => void;
  editing: boolean;
  onEdit?: () => void;
  renderEditForm?: (item: PickerItem, close: () => void) => ReactNode;
  onCloseEdit: () => void;
  archiving: boolean;
  onStartArchive?: () => void;
  onCancelArchive: () => void;
  onConfirmArchive: () => void;
  archiveWarning?: (item: PickerItem) => ReactNode;
}) {
  const t = useTranslations("EntityPicker");
  const selectable = item.selectable !== false;

  if (archiving) {
    return (
      <div className="border-destructive/40 bg-destructive/5 space-y-3 rounded-2xl border p-4">
        <p className="text-destructive text-sm font-bold">
          {t("archiveTitle", { name: item.label })}
        </p>
        {archiveWarning ? (
          <div className="text-muted-foreground text-sm font-semibold">
            {archiveWarning(item)}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button
            className="bg-destructive hover:bg-destructive/90 h-10 flex-1 rounded-xl text-white"
            onClick={onConfirmArchive}
          >
            {t("archiveConfirm")}
          </Button>
          <Button variant="outline" className="h-10 rounded-xl" onClick={onCancelArchive}>
            {t("keep")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={indented ? "pl-4" : undefined}>
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
          checked ? "border-primary/50 bg-primary/5" : "border-border"
        }`}
      >
        {selectable ? (
          <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={item.label} />
        ) : (
          <span className="size-4" />
        )}
        <button
          type="button"
          disabled={!selectable}
          onClick={onToggle}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{item.label}</span>
            {isPrimary && primaryLabel ? (
              <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                <Star className="size-2.5" />
                {primaryLabel}
              </span>
            ) : null}
          </span>
          {item.meta ? (
            <span className="text-muted-foreground block truncate text-xs font-semibold">
              {item.meta}
            </span>
          ) : null}
        </button>

        {/* Promote to primary — only offered on a checked, non-primary row. */}
        {primaryLabel && checked && !isPrimary ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("makePrimary", { label: primaryLabel })}
            className="size-8 flex-none rounded-lg"
            onClick={onSetPrimary}
          >
            <Star className="size-3.5" />
          </Button>
        ) : null}
        {onEdit && item.editable !== false ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("edit")}
            className="size-8 flex-none rounded-lg"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
        {onStartArchive && item.archivable !== false ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t("archive")}
            className="text-destructive hover:bg-destructive/10 size-8 flex-none rounded-lg"
            onClick={onStartArchive}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {editing && renderEditForm ? (
        <div className="border-border mt-2 rounded-2xl border p-4">
          <p className="text-primary mb-3 text-xs font-bold uppercase">{t("editing")}</p>
          {renderEditForm(item, onCloseEdit)}
        </div>
      ) : null}
    </div>
  );
}
