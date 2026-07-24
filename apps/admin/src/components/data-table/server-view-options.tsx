"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loyalty/ui";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { tableParsers } from "./parsers";
import type { SortableColumn } from "./server-sort-list";

const SHALLOW = { shallow: false } as const;

/**
 * "View" menu for the server table — toggles column visibility via the `cols`
 * URL param (`shallow:false` → server re-render, so hidden columns aren't even
 * rendered). Driven by a plain hideable-column descriptor list.
 */
export function ServerViewOptions({ columns }: { columns: SortableColumn[] }) {
  const t = useTranslations("DataTable");
  const [hidden, setHidden] = useQueryState("cols", tableParsers.cols.withOptions(SHALLOW));
  const hiddenSet = new Set(hidden);

  const toggle = (id: string, visible: boolean) => {
    const next = visible ? hidden.filter((h) => h !== id) : [...hidden, id];
    void setHidden(next.length ? next : null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">{t("view")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <p className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
          {t("toggleColumns")}
        </p>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={!hiddenSet.has(column.id)}
            onCheckedChange={(v) => toggle(column.id, !!v)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
