"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loyalty/ui";
import type { Table } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

/** "View" menu — toggle column visibility (persists in the URL `cols`). */
export function DataTableViewOptions<T>({ table }: { table: Table<T> }) {
  const t = useTranslations("DataTable");
  const columns = table.getAllColumns().filter((c) => c.getCanHide());

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
        {columns.map((column) => {
          const label = (column.columnDef.meta as { label?: string } | undefined)?.label ?? column.id;
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(v) => column.toggleVisibility(!!v)}
            >
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
