"use client";

import type { ActivityType } from "@loyalty/api/features/employees/schemas";
import { formatDate, localeFromCode } from "@loyalty/date";
import {
  Badge,
  Button,
  Calendar,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DataTableFilters, FilterSection } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

const AUTH_TYPES: ActivityType[] = [
  "login",
  "logout",
  "role_change",
  "invite_sent",
  "invite_accepted",
  "disable",
  "enable",
  "delete",
  "restore",
  "email_change",
  "rating_change",
  "stores_change",
  "impersonation_start",
  "impersonation_stop",
  "session_revoke",
];
const LOYALTY_TYPES: ActivityType[] = ["sale", "stamp", "redemption"];
const ALL_TYPES = [...LOYALTY_TYPES, ...AUTH_TYPES];

const TYPE_DOT: Partial<Record<ActivityType, string>> = {
  sale: "#1f9d68",
  redemption: "#c98a00",
  stamp: "#7c5cff",
  login: "#9aa1ab",
  logout: "#9aa1ab",
  role_change: "#7c5cff",
  email_change: "#c98a00",
  impersonation_start: "#e5484d",
  impersonation_stop: "#e5484d",
  disable: "#e5484d",
  delete: "#e5484d",
};

const PER_PAGE = 50;

type Meta = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));

/** Per-employee activity — a dense, scannable timeline (auth/admin events +
 *  loyalty events) with a readable detail per row and a Filtros drawer
 *  (type + store + date range). */
export function EmployeeActivityView({
  memberId,
  name,
}: {
  memberId: string;
  name: string;
}) {
  const t = useTranslations("Employees");
  const locale = useLocale();
  const trpc = useTRPC();

  const [types, setTypes] = useState<ActivityType[]>([...ALL_TYPES]);
  const [stores, setStores] = useState<string[]>([]);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [page, setPage] = useState(1);

  const { data: storesData } = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = storesData?.rows ?? [];

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const input = useMemo(
    () => ({
      memberId,
      page,
      perPage: PER_PAGE,
      sort: [],
      types: types.length < ALL_TYPES.length ? types : undefined,
      storeId: stores.length > 0 ? stores : undefined,
      from: range.from,
      to: range.to,
    }),
    [memberId, page, types, stores, range],
  );

  const { data } = useQuery(
    trpc.employees.activity.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const rows = data?.rows ?? [];
  const pageCount = data?.pageCount ?? 1;
  const total = data?.total ?? 0;

  const activeFacets =
    (types.length < ALL_TYPES.length ? 1 : 0) +
    (stores.length > 0 ? 1 : 0) +
    (range.from || range.to ? 1 : 0);

  const clearFilters = () => {
    setTypes([...ALL_TYPES]);
    setStores([]);
    setRange({});
    setPage(1);
  };
  const toggleType = (ty: ActivityType) => {
    setTypes(types.includes(ty) ? types.filter((x) => x !== ty) : [...types, ty]);
    setPage(1);
  };
  const toggleStore = (id: string) => {
    setStores(stores.includes(id) ? stores.filter((x) => x !== id) : [...stores, id]);
    setPage(1);
  };

  const detailFor = (type: ActivityType, meta: Meta | null): string => {
    const m = meta ?? {};
    switch (type) {
      case "sale": {
        const amount = m.amountCents ? money.format(Number(m.amountCents) / 100) : "";
        return [t("activityDetail.sale", { amount }), str(m.customerName)]
          .filter(Boolean)
          .join(" · ");
      }
      case "redemption":
        return [t("activityDetail.redemption", { reward: str(m.rewardName) || "—" }), str(m.customerName)]
          .filter(Boolean)
          .join(" · ");
      case "role_change":
        return `${t("field.role")}: ${str(m.from)} → ${str(m.to)}`;
      case "email_change":
        return `${t("field.email")}: ${str(m.from)} → ${str(m.to)}`;
      case "rating_change":
        return `${t("field.rating")}: ${str(m.rating) || "—"}`;
      case "invite_sent":
        return t("activityDetail.inviteSent", { email: str(m.email) });
      default:
        return t(`activityType.${type}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href={{ pathname: "/employees/[id]", params: { id: memberId } }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {name}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("detail.activity")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("detail.activityCount", { n: total })}</p>
        </div>
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("detail.logFilter")}>
            {ALL_TYPES.map((ty) => (
              <label key={ty} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={types.includes(ty)} onCheckedChange={() => toggleType(ty)} />
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: TYPE_DOT[ty] ?? "#9aa1ab" }}
                  />
                  {t(`activityType.${ty}`)}
                </span>
              </label>
            ))}
          </FilterSection>

          {storeOptions.length > 0 ? (
            <FilterSection label={t("col.stores")}>
              {storeOptions.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox checked={stores.includes(s.id)} onCheckedChange={() => toggleStore(s.id)} />
                  {s.name}
                </label>
              ))}
            </FilterSection>
          ) : null}

          <FilterSection label={t("detail.dateRange")}>
            <div className="border-border flex justify-center rounded-2xl border p-1.5">
              <Calendar
                mode="range"
                className="[--cell-size:--spacing(9)]"
                locale={localeFromCode(locale)}
                selected={{ from: range.from ?? undefined, to: range.to ?? undefined }}
                onSelect={(r: { from?: Date; to?: Date } | undefined) => {
                  setRange(r ?? {});
                  setPage(1);
                }}
                disabled={{ after: new Date() }}
              />
            </div>
            {range.from || range.to ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => {
                  setRange({});
                  setPage(1);
                }}
              >
                {t("clearDate")}
              </Button>
            ) : null}
          </FilterSection>
        </DataTableFilters>
      </div>

      <div className="bg-card border-border mt-4 overflow-hidden rounded-3xl border shadow-sm">
        {rows.length === 0 ? (
          <EmptyState icon={ActivityIcon} title={t("detail.noLogs")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-40">{t("detail.logFilter")}</TableHead>
                <TableHead>{t("detail.detailCol")}</TableHead>
                <TableHead className="w-40">{t("col.stores")}</TableHead>
                <TableHead className="w-40 text-right">{t("col.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.id} className="text-sm">
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2 flex-none rounded-full"
                        style={{ backgroundColor: TYPE_DOT[entry.type] ?? "#9aa1ab" }}
                      />
                      <Badge variant="secondary" className="text-xs">
                        {t(`activityType.${entry.type}`)}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {detailFor(entry.type, entry.metadata)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {str((entry.metadata as Meta | null)?.storeName) || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatDate(entry.createdAt, { locale })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pageCount > 1 ? (
          <div className="border-border flex items-center justify-between border-t p-3 text-sm">
            <span className="text-muted-foreground">{t("pageOf", { page, total: pageCount })}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
