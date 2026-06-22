"use client";

import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@loyalty/ui";
import { Check, ChevronDown } from "lucide-react";

export type FilterOption<T extends string> = {
  value: T;
  label: string;
  /** Optional colored dot (a CSS color) shown before the label. */
  dot?: string;
};

/**
 * Single-select filter dropdown (Vercel-style): a trigger showing the current
 * value (or `allLabel`) and a menu with a check on the active option. `null`
 * value = "all". Reusable across any resource list.
 */
export function FilterSelect<T extends string>({
  allLabel,
  value,
  onValueChange,
  options,
}: {
  allLabel: string;
  value: T | null;
  onValueChange: (value: T | null) => void;
  options: FilterOption<T>[];
}) {
  const selected = options.find((o) => o.value === value);

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
            <span className="max-w-40 truncate">
              {selected?.label ?? allLabel}
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-52 rounded-xl p-1.5">
        <Row
          label={allLabel}
          checked={value === null}
          onClick={() => onValueChange(null)}
        />
        {options.map((o) => (
          <Row
            key={o.value}
            label={o.label}
            dot={o.dot}
            checked={value === o.value}
            onClick={() => onValueChange(o.value)}
          />
        ))}
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
 * with optional colored dots. `selected` is the list of active values.
 */
export function FilterMultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v],
    );

  const dots = options.filter((o) => selected.includes(o.value) && o.dot);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 gap-2 rounded-xl">
            {dots.length ? (
              <span className="flex -space-x-1">
                {dots.slice(0, 3).map((o) => (
                  <span
                    key={o.value}
                    className="border-card size-2.5 rounded-full border"
                    style={{ background: o.dot }}
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
      <PopoverContent align="start" className="w-56 rounded-xl p-1.5">
        {options.map((o) => (
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
      </PopoverContent>
    </Popover>
  );
}
