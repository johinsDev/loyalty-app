"use client";

import {
  Badge,
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { type FilterOption, FilterSelect } from "@/components/filters";

import { Bars } from "../../dashboard/components/charts";
import {
  type Employee,
  type EmployeeLog,
  type LogType,
  ROLES,
  type Role,
  getActivitySeries,
  getEmployeeLogs,
} from "../data";

const LOG_TYPES: LogType[] = ["stamp", "redemption", "role", "login"];

const TYPE_DOT: Record<LogType, string> = {
  stamp: "#1f9d68",
  redemption: "#c98a00",
  role: "#7c5cff",
  login: "#6b7280",
};

/**
 * Employee detail — a ResponsiveModal opened from each Empleados row. Header with
 * avatar + role change + status, impersonate/resend actions, stat cards, a 7-day
 * activity chart, and a searchable + type-filterable activity log. Design-first /
 * hardcoded (../data); the seam later is one tRPC `employees.detail` query.
 */
export function EmployeeDetailModal({
  employee,
  open,
  onOpenChange,
  onChangeRole,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChangeRole: (id: string, role: Role) => void;
}) {
  const t = useTranslations("Employees");

  const [logs, setLogs] = useState<EmployeeLog[]>(() =>
    employee ? getEmployeeLogs(employee.id) : [],
  );
  const [logQuery, setLogQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<LogType | null>(null);

  // Reseed the local log copy + reset the toolbar whenever the employee changes,
  // so reopening on another row never shows stale rows or a stale filter.
  useEffect(() => {
    if (!employee) return;
    setLogs(getEmployeeLogs(employee.id));
    setLogQuery("");
    setTypeFilter(null);
  }, [employee]);

  const typeOptions: FilterOption<LogType>[] = LOG_TYPES.map((type) => ({
    value: type,
    label: t(`detail.logType.${type}`),
    dot: TYPE_DOT[type],
  }));

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    return logs.filter((l) => {
      if (typeFilter && l.type !== typeFilter) return false;
      if (q && !l.detail.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, logQuery, typeFilter]);

  if (!employee) return null;

  const removeLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    toast.success(t("detail.logDeleted"));
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-2xl">
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary grid size-12 flex-none place-items-center rounded-full text-sm font-bold">
              {employee.initials}
            </span>
            <div className="min-w-0 flex-1">
              <ResponsiveModalTitle className="font-display truncate text-xl font-semibold tracking-tight">
                {employee.name}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground truncate text-sm">
                {employee.email}
              </ResponsiveModalDescription>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              value={employee.role}
              onValueChange={(v) => onChangeRole(employee.id, v as Role)}
            >
              <SelectTrigger size="lg" className="w-40 text-sm">
                <SelectValue>{(value) => t(`role.${value as Role}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant="secondary"
              className={
                employee.status === "active"
                  ? "text-emerald-600"
                  : "text-amber-600"
              }
            >
              {t(`status.${employee.status}`)}
            </Badge>
          </div>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-10 rounded-xl font-semibold"
              onClick={() =>
                toast.success(t("detail.impersonating", { name: employee.name }))
              }
            >
              {t("detail.impersonate")}
            </Button>
            {employee.status === "invited" ? (
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => toast.success(t("resent"))}
              >
                {t("resend")}
              </Button>
            ) : null}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 border-border rounded-2xl border p-4">
              <div className="text-muted-foreground text-xs font-semibold">
                {t("detail.stampsGiven")}
              </div>
              <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
                {employee.stamps.toLocaleString()}
              </div>
            </div>
            <div className="bg-muted/40 border-border rounded-2xl border p-4">
              <div className="text-muted-foreground text-xs font-semibold">
                {t("detail.redemptions")}
              </div>
              <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
                {employee.redemptions.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Activity chart */}
          <div className="bg-card border-border rounded-2xl border p-4">
            <div className="text-muted-foreground text-xs font-semibold">
              {t("detail.activityChart")}
            </div>
            <div className="mt-3 h-28">
              <Bars series={getActivitySeries(employee.id)} />
            </div>
          </div>

          {/* Activity log */}
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight">
              {t("detail.activity")}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder={t("detail.searchLog")}
                className="border-border bg-muted/40 placeholder:text-muted-foreground h-10 min-w-44 flex-1 rounded-xl border px-3 text-sm outline-none"
              />
              <FilterSelect
                allLabel={t("detail.logFilter")}
                value={typeFilter}
                onValueChange={setTypeFilter}
                options={typeOptions}
              />
            </div>

            {filteredLogs.length === 0 ? (
              <p className="text-muted-foreground mt-4 text-sm font-medium">
                {t("detail.noLogs")}
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {filteredLogs.map((l) => (
                  <li
                    key={l.id}
                    className="hover:bg-muted/50 flex items-center gap-3 rounded-xl px-2 py-2"
                  >
                    <span
                      className="size-2 flex-none rounded-full"
                      style={{ background: TYPE_DOT[l.type] }}
                    />
                    <span className="flex-1 truncate text-sm font-medium">
                      {l.detail}
                    </span>
                    <span className="text-muted-foreground/70 flex-none text-xs">
                      {l.ago}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLog(l.id)}
                      className="text-muted-foreground hover:text-destructive size-8 flex-none"
                      aria-label={t("detail.deleteLog")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
