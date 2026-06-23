"use client";

import { formatDate } from "@loyalty/date";
import {
  Button,
  DatePicker,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { ArrowLeft, ScrollText, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import {
  type FilterOption,
  FilterMultiSelect,
  FilterSelect,
} from "@/components/filters";
import { useRouter } from "@/i18n/navigation";

import { type LogType, LOG_TYPES, auditLog, employees } from "../data";

const TYPE_DOT: Record<LogType, string> = {
  stamp: "#1f9d68",
  redemption: "#c98a00",
  role: "#7c5cff",
  login: "#9aa1ab",
};

type Quick = "24h" | "7d" | "30d";
const QUICK_DAYS: Record<Quick, number> = { "24h": 1, "7d": 7, "30d": 30 };

const DAY_MS = 86_400_000;

/**
 * Audit log — a dedicated, highly filterable activity view so an owner can find
 * anything suspicious: filter by employee, by type, by quick range or a custom
 * from/to date window, and free-text search across the detail + employee name.
 * Design-first / hardcoded (../data); the seam is an append-only `audit_log`
 * table queried with the same filters.
 */
export function AuditLogView() {
  const t = useTranslations("Audit");
  const router = useRouter();
  const locale = useLocale();

  // Midnight today — entries derive a real Date from `daysAgo` so the range and
  // custom from/to filters can compare against actual calendar dates.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const entryDate = (daysAgo: number) =>
    new Date(today.getTime() - daysAgo * DAY_MS);

  const [rows, setRows] = useState(auditLog);

  const [search, setSearch] = useState("");
  const [employeeIds, setEmployeeIds] = useState<string[]>(() =>
    employees.map((e) => e.id),
  );
  const [types, setTypes] = useState<LogType[]>([...LOG_TYPES]);
  const [quick, setQuick] = useState<Quick | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  const employeeOptions: FilterOption<string>[] = employees.map((e) => ({
    value: e.id,
    label: e.name,
  }));
  const typeOptions: FilterOption<LogType>[] = LOG_TYPES.map((type) => ({
    value: type,
    label: t(`logType.${type}`),
    dot: TYPE_DOT[type],
  }));
  const quickOptions: FilterOption<Quick>[] = [
    { value: "24h", label: t("range24h") },
    { value: "7d", label: t("range7d") },
    { value: "30d", label: t("range30d") },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (!employeeIds.includes(e.employeeId)) return false;
      if (!types.includes(e.type)) return false;
      if (
        q &&
        !e.detail.toLowerCase().includes(q) &&
        !e.employeeName.toLowerCase().includes(q)
      )
        return false;
      if (quick && e.daysAgo > QUICK_DAYS[quick]) return false;
      const when = entryDate(e.daysAgo);
      if (from && when.getTime() < from.getTime()) return false;
      // DatePicker returns midnight — include the whole `to` day.
      if (to && when.getTime() > to.getTime() + DAY_MS - 1) return false;
      return true;
    });
  }, [rows, search, employeeIds, types, quick, from, to, today]);

  const clearFilters = () => {
    setSearch("");
    setEmployeeIds(employees.map((e) => e.id));
    setTypes([...LOG_TYPES]);
    setQuick(null);
    setFrom(null);
    setTo(null);
  };

  const remove = (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success(t("deleted"));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2 mb-3 gap-1.5"
        onClick={() => router.push("/employees")}
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <span className="text-muted-foreground/70 text-sm font-semibold">
          {t("count", { n: filtered.length })}
        </span>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-card placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <FilterMultiSelect
          label={t("employeeFilter")}
          options={employeeOptions}
          selected={employeeIds}
          onChange={setEmployeeIds}
          searchable
        />
        <FilterMultiSelect
          label={t("typeFilter")}
          options={typeOptions}
          selected={types}
          onChange={setTypes}
        />
        <FilterSelect
          allLabel={t("rangeAll")}
          value={quick}
          onValueChange={setQuick}
          options={quickOptions}
        />
        <DatePicker
          value={from ?? undefined}
          onValueChange={(d) => setFrom(d ?? null)}
          placeholder={t("from")}
          formatLabel={(d) => formatDate(d, { locale })}
        />
        <DatePicker
          value={to ?? undefined}
          onValueChange={(d) => setTo(d ?? null)}
          placeholder={t("to")}
          formatLabel={(d) => formatDate(d, { locale })}
        />
      </div>

      {/* Table card */}
      <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ScrollText}
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
                <TableHead>{t("colWhen")}</TableHead>
                <TableHead>{t("colEmployee")}</TableHead>
                <TableHead>{t("colAction")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/40">
                  <TableCell className="text-muted-foreground font-semibold whitespace-nowrap">
                    {`${formatDate(entryDate(e.daysAgo), { locale })} · ${e.time}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-2 flex-none rounded-full"
                        style={{ background: TYPE_DOT[e.type] }}
                      />
                      <span className="font-bold">{e.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{e.detail}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(e.id)}
                        className="text-muted-foreground hover:text-destructive size-8"
                        aria-label={t("delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
