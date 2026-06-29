"use client";

import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@loyalty/ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type FilterOption<T extends string> = {
  value: T;
  label: string;
  /** Optional colored dot (a CSS color) shown before the label. */
  dot?: string;
};

function useFiltered<T extends string>(
  options: FilterOption<T>[],
  searchable: boolean,
) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);
  return { query, setQuery, filtered };
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border-border relative flex items-center border-b px-2.5">
      <Search className="text-muted-foreground pointer-events-none size-4" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="placeholder:text-muted-foreground h-9 flex-1 bg-transparent px-2 text-sm outline-none"
      />
    </div>
  );
}

/**
 * Single-select filter dropdown (Vercel-style): a trigger showing the current
 * value (or `allLabel`) and a menu with a check on the active option. `null`
 * value = "all". Pass `searchable` for long option lists. The reusable filter
 * pattern for any resource list — see `.claude/skills/admin-filters/SKILL.md`.
 */
export function FilterSelect<T extends string>({
  allLabel,
  label,
  value,
  onValueChange,
  options,
  searchable = false,
  searchPlaceholder = "Buscar…",
}: {
  allLabel: string;
  /** Filter name shown on the trigger when nothing is selected (so two
   *  unset filters don't both read "Todas"). Defaults to `allLabel`. */
  label?: string;
  value: T | null;
  onValueChange: (value: T | null) => void;
  options: FilterOption<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const { query, setQuery, filtered } = useFiltered(options, searchable);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 gap-2 rounded-xl">
            {selected?.dot ? (
              <span
                className="size-2 rounded-full"
                style={{ background: selected.dot }}
              />
            ) : null}
            <span className="max-w-40 truncate">{selected?.label ?? label ?? allLabel}</span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 rounded-xl p-0">
        {searchable ? (
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
          />
        ) : null}
        <div className="max-h-64 overflow-y-auto p-1.5">
          <Row
            label={allLabel}
            checked={value === null}
            onClick={() => onValueChange(null)}
          />
          {filtered.map((o) => (
            <Row
              key={o.value}
              label={o.label}
              dot={o.dot}
              checked={value === o.value}
              onClick={() => onValueChange(o.value)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  dot,
  checked,
  onClick,
}: {
  label: string;
  dot?: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
    >
      {dot ? (
        <span className="size-2 flex-none rounded-full" style={{ background: dot }} />
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {checked ? <Check className="text-primary size-4 flex-none" /> : null}
    </button>
  );
}

/**
 * Multi-select filter (Vercel "Status 6/7" style): a trigger with a stack of the
 * selected dots, a label, and a `selected/total` badge, opening a checkbox list
 * with optional colored dots. Pass `searchable` for long option lists. See
 * `.claude/skills/admin-filters/SKILL.md`.
 */
export function FilterMultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = "Buscar…",
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const { query, setQuery, filtered } = useFiltered(options, searchable);
  const toggle = (v: T) =>
    onChange(
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v],
    );

  // Show every option's dot always (dim the unselected) so the trigger width
  // stays constant — selecting/clearing must not make the button jump.
  const dotted = options.filter((o) => o.dot);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 gap-2 rounded-xl">
            {dotted.length ? (
              <span className="flex -space-x-1">
                {dotted.slice(0, 3).map((o) => (
                  <span
                    key={o.value}
                    className="border-card size-2.5 rounded-full border transition-opacity"
                    style={{
                      background: o.dot,
                      opacity: selected.includes(o.value) ? 1 : 0.3,
                    }}
                  />
                ))}
              </span>
            ) : null}
            <span>{label}</span>
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs font-bold">
              {selected.length}/{options.length}
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 rounded-xl p-0">
        {searchable ? (
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
          />
        ) : null}
        <div className="max-h-64 overflow-y-auto p-1.5">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
            >
              <Checkbox
                checked={selected.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
                tabIndex={-1}
              />
              {o.dot ? (
                <span
                  className="size-2.5 flex-none rounded-full"
                  style={{ background: o.dot }}
                />
              ) : null}
              <span className="flex-1 truncate">{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

