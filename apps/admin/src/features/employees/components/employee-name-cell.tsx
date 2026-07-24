"use client";

import type { EmployeeListItem } from "@loyalty/api/features/employees/schemas";
import { parseAsString, useQueryState } from "nuqs";

/**
 * Interactive name cell for the server employees table — a client island that
 * opens the `?detalle=<memberId>` quick-view modal for member rows. Invitation
 * rows render the same avatar + name but aren't clickable. Markup mirrors the
 * old table cell exactly.
 */
export function EmployeeNameCell({
  id,
  kind,
  name,
  initials,
}: {
  id: string;
  kind: EmployeeListItem["kind"];
  name: string;
  initials: string;
}) {
  const [, setDetailId] = useQueryState("detalle", parseAsString);

  const inner = (
    <span className="flex items-center gap-3">
      <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
        {initials}
      </span>
      <span className="truncate font-semibold">{name}</span>
    </span>
  );

  if (kind !== "member") return inner;

  return (
    <button
      type="button"
      className="hover:text-primary cursor-pointer text-left hover:underline"
      onClick={() => void setDetailId(id)}
    >
      {inner}
    </button>
  );
}
