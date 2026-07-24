import type { CustomerListItem } from "@loyalty/api/features/customers/schemas";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  RowCheckbox,
  SelectAllCheckbox,
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";
import { trpc } from "@/lib/trpc/server";

import { customerInitials } from "../lib/initials";
import { buildCustomersInput, loadCustomersSearchParams } from "../list-params";

const THIRTY_DAYS = 30 * 86_400_000;

function statusOf(c: CustomerListItem): "banned" | "active" | "inactive" {
  if (c.banned) return "banned";
  if (c.lastVisitAt && Date.now() - new Date(c.lastVisitAt).getTime() <= THIRTY_DAYS) return "active";
  return "inactive";
}

/**
 * Server-rendered customers table — the dynamic Suspense hole. Reads the URL
 * search params, runs the (cookie-scoped) `customers.adminList` query on the
 * server, and streams the rows. Interactive cells (row checkbox, name→detail
 * link) are client islands; everything else is plain server JSX. Pagination is a
 * client island fed the server's `pageCount`/`total`.
 */
export async function CustomersTable({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Customers");
  const format = await getFormatter();
  const locale = await getLocale();

  const values = loadCustomersSearchParams(searchParams);
  const input = buildCustomersInput(values);
  const data = await (await trpc()).customers.adminList(input);
  const rowIds = data.rows.map((c) => c.id);

  const columns: ServerColumn<CustomerListItem>[] = [
    {
      id: "select",
      hideable: false,
      width: 44,
      header: <SelectAllCheckbox ids={rowIds} label={t("selectAll")} />,
      cell: (c) => <RowCheckbox id={c.id} label={t("selectRow")} />,
    },
    {
      id: "name",
      label: t("col.customer"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("col.customer")} />,
      cell: (c) => (
        <Link
          href={{ pathname: "/customers/[id]", params: { id: c.id } }}
          className="hover:text-primary flex items-center gap-2.5 hover:underline"
        >
          <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
            {customerInitials(c.name, c.phone)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{c.name || c.phone}</span>
            <span className="text-muted-foreground block truncate text-xs">{c.phone}</span>
          </span>
        </Link>
      ),
    },
    {
      id: "tierKey",
      label: t("col.tier"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.tier")}</span>,
      cell: (c) => <Badge variant="outline">{t(`tier.${c.tierKey ?? "hoja"}`)}</Badge>,
    },
    {
      id: "visits",
      align: "right",
      label: t("col.visits"),
      header: <ServerSortHeader columnId="visits" title={t("col.visits")} align="right" />,
      cell: (c) => <span className="text-sm">{c.visits}</span>,
    },
    {
      id: "ltv",
      align: "right",
      label: t("col.spent"),
      header: <ServerSortHeader columnId="ltv" title={t("col.spent")} align="right" />,
      cell: (c) => <span className="font-bold whitespace-nowrap">{money(format, c.ltvCents)}</span>,
    },
    {
      id: "lastVisit",
      label: t("col.lastVisit"),
      header: <ServerSortHeader columnId="lastVisit" title={t("col.lastVisit")} />,
      cell: (c) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {c.lastVisitAt ? formatDate(c.lastVisitAt, { locale }) : "—"}
        </span>
      ),
    },
    {
      id: "status",
      label: t("col.status"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
      cell: (c) => {
        const s = statusOf(c);
        return (
          <Badge variant={s === "banned" ? "destructive" : s === "active" ? "default" : "secondary"}>
            {t(`status.${s}`)}
          </Badge>
        );
      },
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
      {values.view === "grid" ? (
        data.rows.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((c) => (
              <Link
                key={c.id}
                href={{ pathname: "/customers/[id]", params: { id: c.id } }}
                className="bg-card border-border hover:border-primary/40 block rounded-3xl border p-4 shadow-sm transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                    {customerInitials(c.name, c.phone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{c.name || c.phone}</div>
                    <div className="text-muted-foreground truncate text-xs">{c.phone}</div>
                  </div>
                  <Badge variant="outline">{t(`tier.${c.tierKey ?? "hoja"}`)}</Badge>
                </div>
                <div className="border-border mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                  <div>
                    <div className="font-bold">{money(format, c.ltvCents)}</div>
                    <div className="text-muted-foreground text-xs">{t("col.spent")}</div>
                  </div>
                  <div>
                    <div className="font-bold">{c.visits}</div>
                    <div className="text-muted-foreground text-xs">{t("col.visits")}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={values.cols}
          getRowId={(c) => c.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
