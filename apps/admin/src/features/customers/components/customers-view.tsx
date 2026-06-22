"use client";

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";
import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import {
  type Customer,
  customerKpis,
  customers,
  type Status,
  type Tier,
  tierColor,
} from "../data";

const PAGE_SIZE = 8;
const STATUSES: Status[] = ["active", "inactive"];
const TIERS: Tier[] = ["bronze", "silver", "gold", "diamond"];

/**
 * Clientes — KPI row + a polished data table (search, status/tier select
 * filters, export, add, pagination). Rows open the customer detail; add/edit go
 * to the customer wizard. Design-first / hardcoded (../data); the seam is the
 * tRPC `clientes.list` query later.
 */
export function CustomersView() {
  const t = useTranslations("Customers");
  const router = useRouter();
  const fade = useFadeUp({ step: 40 });

  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [tiers, setTiers] = useState<Tier[]>([...TIERS]);
  const [page, setPage] = useState(0);

  const statusOptions: FilterOption<Status>[] = [
    { value: "active", label: t("status.active"), dot: "#1f9d68" },
    { value: "inactive", label: t("status.inactive"), dot: "#9aa1ab" },
  ];
  const tierOptions: FilterOption<Tier>[] = TIERS.map((tr) => ({
    value: tr,
    label: t(`tier.${tr}`),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (!statuses.includes(c.status)) return false;
      if (!tiers.includes(c.tier)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q))
        return false;
      return true;
    });
  }, [query, statuses, tiers]);

  const clearFilters = () => {
    reset(() => {
      setQuery("");
      setStatuses([...STATUSES]);
      setTiers([...TIERS]);
    });
  };

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 gap-2 rounded-xl">
            <Download className="size-4" />
            {t("export")}
          </Button>
          <Button
            className="h-10 gap-2 rounded-xl font-semibold"
            onClick={() => router.push("/customers/new")}
          >
            <Plus className="size-4" />
            {t("addCustomer")}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {customerKpis.map((k) => (
          <div
            key={k.key}
            style={fade(i++)}
            className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm"
          >
            <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
              {t(`kpi.${k.key}`)}
            </span>
            <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
              {k.value}
            </div>
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="size-3.5" />
              {k.delta}
            </span>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div
        style={fade(i++)}
        className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm"
      >
        {/* Toolbar */}
        <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => reset(() => setQuery(e.target.value))}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-muted/40 placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterMultiSelect
              label={t("statusFilter")}
              options={statusOptions}
              selected={statuses}
              onChange={(v) => reset(() => setStatuses(v))}
            />
            <FilterMultiSelect
              label={t("tierFilter")}
              options={tierOptions}
              selected={tiers}
              onChange={(v) => reset(() => setTiers(v))}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("empty")}
            hint={t("emptyHint")}
            action={
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={clearFilters}
              >
                {t("clearFilters")}
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.customer")}</TableHead>
                <TableHead>{t("col.tier")}</TableHead>
                <TableHead className="text-right">{t("col.points")}</TableHead>
                <TableHead className="text-right">{t("col.visits")}</TableHead>
                <TableHead className="text-right">{t("col.spent")}</TableHead>
                <TableHead>{t("col.lastVisit")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <Row key={c.id} customer={c} router={router} t={t} />
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="border-border flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground font-semibold">
            {t("showing", {
              from: filtered.length === 0 ? 0 : current * PAGE_SIZE + 1,
              to: current * PAGE_SIZE + rows.length,
              total: filtered.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              aria-label={t("prev")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-muted-foreground px-2 font-semibold">
              {t("pageOf", { page: current + 1, pages })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              aria-label={t("next")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  customer: c,
  router,
  t,
}: {
  customer: Customer;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        router.push({ pathname: "/customers/[id]", params: { id: c.id } })
      }
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
            {c.initials}
          </span>
          <div className="min-w-0">
            <div className="truncate font-bold">{c.name}</div>
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              {c.phone}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tierColor[c.tier]}`}
        >
          {t(`tier.${c.tier}`)}
        </span>
      </TableCell>
      <TableCell className="text-right font-bold">
        {c.points.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground text-right font-semibold">
        {c.visits}
      </TableCell>
      <TableCell className="text-right font-bold">{c.spent}</TableCell>
      <TableCell className="text-muted-foreground font-semibold">
        {c.lastVisit}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            c.status === "active" ? "text-emerald-600" : "text-muted-foreground"
          }
        >
          {t(`status.${c.status}`)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
