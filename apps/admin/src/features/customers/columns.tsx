import type { CustomerListItem } from "@loyalty/api/features/customers/schemas";
import { formatDate } from "@loyalty/date";
import { Badge, Checkbox } from "@loyalty/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { useFormatter, useTranslations } from "next-intl";

import { DataTableColumnHeader } from "@/components/data-table";
import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";

import { customerInitials } from "./lib/initials";

type Translator = ReturnType<typeof useTranslations<"Customers">>;
type Formatter = ReturnType<typeof useFormatter>;

const THIRTY_DAYS = 30 * 86_400_000;

function statusOf(c: CustomerListItem): "banned" | "active" | "inactive" {
  if (c.banned) return "banned";
  if (c.lastVisitAt && Date.now() - new Date(c.lastVisitAt).getTime() <= THIRTY_DAYS) return "active";
  return "inactive";
}

/**
 * Tanstack column defs for the customers list — the shape the client `DataTable`
 * consumes. Built as a factory (rather than inline in the view) so the meta stays
 * a single named artifact the other list rollouts can mirror. Cells stay
 * interactive: the name cell routes to the customer 360 (`/customers/[id]`, a
 * store-scoped `<Link>`), and `select` renders the row/all checkboxes tanstack
 * drives. Labels come from the caller's `Customers` translator.
 */
export function getCustomerColumns({
  t,
  format,
  locale,
}: {
  t: Translator;
  format: Formatter;
  locale: string;
}): ColumnDef<CustomerListItem, unknown>[] {
  return [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={t("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label={t("selectRow")}
        />
      ),
    },
    {
      accessorKey: "name",
      enableHiding: false,
      meta: { label: t("col.customer") },
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.customer")} />,
      cell: ({ row }) => {
        const c = row.original;
        return (
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
        );
      },
    },
    {
      accessorKey: "tierKey",
      enableSorting: false,
      meta: { label: t("col.tier") },
      header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.tier")}</span>,
      cell: ({ row }) => <Badge variant="outline">{t(`tier.${row.original.tierKey ?? "hoja"}`)}</Badge>,
    },
    {
      accessorKey: "visits",
      meta: { label: t("col.visits") },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title={t("col.visits")} />
        </div>
      ),
      cell: ({ row }) => <span className="block text-right text-sm">{row.original.visits}</span>,
    },
    {
      accessorKey: "ltv",
      meta: { label: t("col.spent") },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title={t("col.spent")} />
        </div>
      ),
      cell: ({ row }) => (
        <span className="block text-right font-bold whitespace-nowrap">
          {money(format, row.original.ltvCents)}
        </span>
      ),
    },
    {
      accessorKey: "lastVisit",
      meta: { label: t("col.lastVisit") },
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.lastVisit")} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {row.original.lastVisitAt ? formatDate(row.original.lastVisitAt, { locale }) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      enableSorting: false,
      meta: { label: t("col.status") },
      header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
      cell: ({ row }) => {
        const s = statusOf(row.original);
        return (
          <Badge variant={s === "banned" ? "destructive" : s === "active" ? "default" : "secondary"}>
            {t(`status.${s}`)}
          </Badge>
        );
      },
    },
  ];
}
