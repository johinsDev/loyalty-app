"use client";

import { Checkbox } from "@loyalty/ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

/**
 * Row selection for the server-rendered table. The rows are server-rendered, so
 * selection can't live in a `@tanstack/react-table` instance — it's a client
 * `Set<id>` in this provider, wrapping the toolbar + table + bulk bar. Selection
 * persists across pages/filters (the provider doesn't unmount on a server
 * re-render), matching the old data-table behaviour.
 */
type SelectionValue = {
  ids: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionValue | null>(null);

export function useSelection(): SelectionValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a <SelectionProvider>");
  return ctx;
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const toggle = useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const setMany = useCallback(
    (list: string[], on: boolean) =>
      setIds((prev) => {
        const next = new Set(prev);
        for (const id of list) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setIds(new Set()), []);
  const value = useMemo(() => ({ ids, toggle, setMany, clear }), [ids, toggle, setMany, clear]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** Per-row checkbox island embedded in a server-rendered cell. */
export function RowCheckbox({ id, label }: { id: string; label?: string }) {
  const { ids, toggle } = useSelection();
  return (
    <Checkbox checked={ids.has(id)} onCheckedChange={() => toggle(id)} aria-label={label} />
  );
}

/** Header select-all island — fed the current page's row ids by the server table. */
export function SelectAllCheckbox({ ids: pageIds, label }: { ids: string[]; label?: string }) {
  const { ids, setMany } = useSelection();
  const all = pageIds.length > 0 && pageIds.every((id) => ids.has(id));
  const some = !all && pageIds.some((id) => ids.has(id));
  return (
    <Checkbox
      checked={all}
      indeterminate={some}
      onCheckedChange={(v) => setMany(pageIds, !!v)}
      aria-label={label}
    />
  );
}
