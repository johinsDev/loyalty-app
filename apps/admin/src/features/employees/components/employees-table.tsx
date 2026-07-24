import type { EmployeeListItem } from "@loyalty/api/features/employees/schemas";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
import { Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  RowCheckbox,
  SelectAllCheckbox,
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { trpc } from "@/lib/trpc/server";

import { displayName, initialsFor } from "../lib";
import { buildEmployeesInput, loadEmployeesSearchParams } from "../list-params";
import { EmployeeGridCard } from "./employee-grid-card";
import { EmployeeNameCell } from "./employee-name-cell";
import { EmployeeRowActions } from "./employee-row-actions";

/**
 * Server-rendered employees table — the dynamic Suspense hole. Reads the URL
 * params, runs the (cookie-scoped) `employees.list` query on the server and
 * streams the rows. Interactive cells (row checkbox, name→`?detalle` quick-view,
 * the ⋯ row menu) are client islands; everything else is plain server JSX.
 * Pagination is a client island fed the server's `pageCount`/`total`.
 */
export async function EmployeesTable({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Employees");
  const locale = await getLocale();

  const loaded = loadEmployeesSearchParams(searchParams);
  const input = buildEmployeesInput(loaded);
  const data = await (await trpc()).employees.list(input);
  const rowIds = data.rows.map((e) => e.id);

  const columns: ServerColumn<EmployeeListItem>[] = [
    {
      id: "select",
      hideable: false,
      width: 44,
      header: <SelectAllCheckbox ids={rowIds} label={t("selectAll")} />,
      cell: (e) => <RowCheckbox id={e.id} label={t("selectRow")} />,
    },
    {
      id: "name",
      label: t("col.employee"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("col.employee")} />,
      cell: (e) => (
        <EmployeeNameCell
          id={e.id}
          kind={e.kind}
          name={displayName(e)}
          initials={initialsFor(e)}
        />
      ),
    },
    {
      id: "email",
      label: t("col.email"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.email")}</span>,
      cell: (e) => <span className="text-muted-foreground text-sm">{e.email ?? "—"}</span>,
    },
    {
      id: "role",
      label: t("col.role"),
      header: <ServerSortHeader columnId="role" title={t("col.role")} />,
      cell: (e) => <Badge variant="secondary">{t(`role.${e.role}`)}</Badge>,
    },
    {
      id: "stores",
      label: t("col.stores"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.stores")}</span>,
      cell: (e) => (
        <span className="text-muted-foreground text-sm">
          {e.stores.length === 0 ? "—" : e.stores.map((s) => s.name).join(", ")}
        </span>
      ),
    },
    {
      id: "rating",
      label: t("col.rating"),
      header: <ServerSortHeader columnId="rating" title={t("col.rating")} />,
      cell: (e) =>
        e.rating ? (
          <span className="inline-flex items-center gap-1 text-sm font-bold">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {e.rating}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      label: t("col.status"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
      cell: (e) => (
        <Badge
          variant="secondary"
          className={
            e.status === "active"
              ? "text-emerald-600"
              : e.status === "invited"
                ? "text-amber-600"
                : "text-muted-foreground"
          }
        >
          {t(`status.${e.status}`)}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      label: t("col.created"),
      header: <ServerSortHeader columnId="createdAt" title={t("col.created")} />,
      cell: (e) => (
        <span className="text-muted-foreground text-sm">{formatDate(e.createdAt, { locale })}</span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (e) => <EmployeeRowActions row={e} />,
    },
  ];

  const empty = (
    <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
      <div>
        <p className="text-foreground font-semibold">{t("empty")}</p>
        <p className="mt-1 text-sm">{t("emptyHint")}</p>
      </div>
    </div>
  );

  return (
    <>
      {loaded.view === "grid" ? (
        data.rows.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((e) => (
              <EmployeeGridCard key={e.id} employee={e} />
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={loaded.cols}
          getRowId={(e) => e.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
