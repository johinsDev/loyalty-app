"use client";

import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterMultiSelect } from "@/components/filters";

import {
  type Employee,
  ROLES,
  type Role,
  type Status,
  audit,
  employees as seed,
} from "../data";
import { EmployeeDetailModal } from "./employee-detail-modal";

const STATUSES: Status[] = ["active", "invited"];

/**
 * Empleados — invite row + a polished team table (search, role/status filters,
 * per-row role change, resend invite, remove) plus an audit log card.
 * Design-first / hardcoded (../data); the seam is the Better Auth organization
 * member + invitation model later.
 */
export function EmployeesView() {
  const t = useTranslations("Employees");

  const [rows, setRows] = useState<Employee[]>(seed);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("staff");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role[]>([...ROLES]);
  const [statusFilter, setStatusFilter] = useState<Status[]>([...STATUSES]);
  const [detail, setDetail] = useState<Employee | null>(null);

  const roleOptions: FilterOption<Role>[] = ROLES.map((r) => ({
    value: r,
    label: t(`role.${r}`),
  }));
  const statusOptions: FilterOption<Status>[] = [
    { value: "active", label: t("status.active"), dot: "#1f9d68" },
    { value: "invited", label: t("status.invited"), dot: "#c98a00" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (!roleFilter.includes(e.role)) return false;
      if (!statusFilter.includes(e.status)) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.email.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, query, roleFilter, statusFilter]);

  const invite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setRows((prev) => [
      ...prev,
      {
        id: `e${Date.now()}`,
        name: email.split("@")[0] ?? email,
        initials: (email.slice(0, 2) || "??").toUpperCase(),
        email,
        role: inviteRole,
        stamps: 0,
        redemptions: 0,
        status: "invited",
      },
    ]);
    toast.success(t("inviteSent"));
    setInviteEmail("");
    setInviteRole("staff");
  };

  const changeRole = (id: string, role: Role) => {
    setRows((prev) => prev.map((e) => (e.id === id ? { ...e, role } : e)));
    setDetail((d) => (d && d.id === id ? { ...d, role } : d));
  };

  const remove = (employee: Employee) => {
    setRows((prev) => prev.filter((e) => e.id !== employee.id));
    toast.success(t("removed", { name: employee.name }));
  };

  const clearFilters = () => {
    setQuery("");
    setRoleFilter([...ROLES]);
    setStatusFilter([...STATUSES]);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
          {t("subtitle")}
        </p>
      </div>

      {/* Invite row */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder={t("invitePlaceholder")}
          className="h-10 flex-1"
        />
        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
          <SelectTrigger size="lg" className="text-sm sm:w-44">
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
        <Button onClick={invite} className="h-10 font-semibold">
          {t("invite")}
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
        {/* Toolbar */}
        <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-52 flex-1">
            <Users className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-muted/40 placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterMultiSelect
              label={t("roleFilter")}
              options={roleOptions}
              selected={roleFilter}
              onChange={setRoleFilter}
            />
            <FilterMultiSelect
              label={t("statusFilter")}
              options={statusOptions}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
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
                <TableHead>{t("col.employee")}</TableHead>
                <TableHead>{t("col.email")}</TableHead>
                <TableHead>{t("col.role")}</TableHead>
                <TableHead className="text-right">{t("col.stamps")}</TableHead>
                <TableHead className="text-right">
                  {t("col.redemptions")}
                </TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => setDetail(e)}
                  className="cursor-pointer"
                  aria-label={t("detail.viewDetail")}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
                        {e.initials}
                      </span>
                      <span className="truncate font-bold">{e.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {e.email}
                  </TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <Select
                      value={e.role}
                      onValueChange={(v) => changeRole(e.id, v as Role)}
                    >
                      <SelectTrigger size="lg" className="w-36 text-sm">
                        <SelectValue>
                          {(value) => t(`role.${value as Role}`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`role.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {e.stamps.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {e.redemptions.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        e.status === "active"
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }
                    >
                      {t(`status.${e.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {e.status === "invited" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => toast.success(t("resent"))}
                        >
                          {t("resend")}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(e)}
                        className="text-muted-foreground hover:text-destructive size-8"
                        aria-label={t("remove")}
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

      {/* Audit log */}
      <div className="bg-card border-border mt-5 rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Audit log
        </h2>
        <ul className="mt-4 space-y-3">
          {audit.map((a) => (
            <li
              key={a.id}
              className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium"
            >
              <span className="text-foreground font-bold">{a.who}</span>
              <span>{a.action}</span>
              <span className="text-foreground font-semibold">{a.detail}</span>
              <span className="text-muted-foreground/70">· {a.ago}</span>
            </li>
          ))}
        </ul>
      </div>

      <EmployeeDetailModal
        employee={detail}
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        onChangeRole={changeRole}
      />
    </div>
  );
}
