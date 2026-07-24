"use client";

import type { EmployeeListItem } from "@loyalty/api/features/employees/schemas";
import { Badge } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { RowCheckbox } from "@/components/data-table";

import { displayName, initialsFor } from "../lib";
import { EmployeeRowActions } from "./employee-row-actions";

/**
 * Grid card for the server employees table — a client island so a member card
 * can open the `?detalle=<id>` quick-view, while the checkbox and ⋯ menu stop
 * propagation. Invitation rows aren't clickable. Markup mirrors the old grid
 * renderer exactly.
 */
export function EmployeeGridCard({ employee: e }: { employee: EmployeeListItem }) {
  const t = useTranslations("Employees");
  const [, setDetailId] = useQueryState("detalle", parseAsString);

  return (
    <div
      role={e.kind === "member" ? "button" : undefined}
      tabIndex={e.kind === "member" ? 0 : undefined}
      className="bg-card border-border hover:border-primary/40 rounded-3xl border p-4 shadow-sm transition-colors"
      onClick={() => e.kind === "member" && void setDetailId(e.id)}
      onKeyDown={(ev) => {
        if (e.kind === "member" && (ev.key === "Enter" || ev.key === " ")) {
          ev.preventDefault();
          void setDetailId(e.id);
        }
      }}
    >
      <div
        className="flex items-start justify-between gap-2"
        onClick={(ev) => ev.stopPropagation()}
        onKeyDown={(ev) => ev.stopPropagation()}
      >
        <RowCheckbox id={e.id} label={t("selectRow")} />
        <EmployeeRowActions row={e} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
          {initialsFor(e)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{displayName(e)}</p>
          <p className="text-muted-foreground truncate text-sm">{e.email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary">{t(`role.${e.role}`)}</Badge>
        <Badge variant="outline">{t(`status.${e.status}`)}</Badge>
      </div>
    </div>
  );
}
