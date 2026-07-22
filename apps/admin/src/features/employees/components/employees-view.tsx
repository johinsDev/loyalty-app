"use client";

import { authClient } from "@loyalty/auth/client";
import { formatDate } from "@loyalty/date";
import type {
  EmployeeListItem,
  EmployeesListInput,
} from "@loyalty/api/features/employees/schemas";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Download, Plus, ScrollText, Star, Trash2, Trophy, UserCheck } from "lucide-react";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableBulkBar,
  DataTableColumnHeader,
  DataTableFilters,
  DataTablePagination,
  DataTableSortList,
  DataTableViewOptions,
  FilterSection,
  tableParsers,
} from "@/components/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { ViewToggle } from "@/components/view-toggle";
import { useRouter } from "@/i18n/nav";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useTRPC } from "@/lib/trpc/client";

import { ROW_ROLES, STATUSES, displayName, initialsFor } from "../lib";
import { buildEmployeesInput } from "../list-params";
import { EmployeeDetailModal } from "./employee-detail-modal";
import { EmployeeRowActions } from "./employee-row-actions";

type EmployeesResult = { rows: EmployeeListItem[]; total: number; pageCount: number };

export function EmployeesView({ initialData }: { initialData?: EmployeesResult }) {
  const t = useTranslations("Employees");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const isOwner = (session?.user as { role?: string } | undefined)?.role === "admin";

  // ── URL state (facets + q). page/perPage/sort/view/cols live in useDataTable.
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [role, setRole] = useQueryState("role", parseAsArrayOf(parseAsString).withDefault([]));
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [storeId, setStoreId] = useQueryState("storeId", parseAsArrayOf(parseAsString).withDefault([]));
  const [detailId, setDetailId] = useQueryState("detalle", parseAsString);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [view, setView] = useQueryState("view", tableParsers.view);

  const resetPage = () => void setPage(1);

  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void setQ(value || null);
      resetPage();
    }, 350);
  };

  const activeFacets =
    (role.length > 0 && role.length < ROW_ROLES.length ? 1 : 0) +
    (status.length > 0 && status.length < STATUSES.length ? 1 : 0) +
    (storeId.length > 0 ? 1 : 0);
  const clearFilters = () => {
    void setRole([]);
    void setStatus([]);
    void setStoreId([]);
    resetPage();
  };
  const toggle = (
    values: string[],
    set: (v: string[]) => void,
    v: string,
  ) => {
    set(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    resetPage();
  };

  // Store options for the "Tienda" facet.
  const { data: storesData } = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = storesData?.rows ?? [];

  const input: EmployeesListInput = useMemo(
    () => buildEmployeesInput({ q, page, perPage, sort, role, status, storeId }),
    [q, page, perPage, sort, role, status, storeId],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.employees.list.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<EmployeeListItem, unknown>[]>(
    () => [
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
        meta: { label: t("col.employee") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.employee")} />,
        cell: ({ row }) => {
          const r = row.original;
          const inner = (
            <span className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
                {initialsFor(r)}
              </span>
              <span className="truncate font-semibold">{displayName(r)}</span>
            </span>
          );
          return r.kind === "member" ? (
            <button
              type="button"
              className="hover:text-primary cursor-pointer text-left hover:underline"
              onClick={() => void setDetailId(r.id)}
            >
              {inner}
            </button>
          ) : (
            inner
          );
        },
      },
      {
        accessorKey: "email",
        enableSorting: false,
        meta: { label: t("col.email") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.email")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.original.email ?? "—"}</span>
        ),
      },
      {
        accessorKey: "role",
        meta: { label: t("col.role") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.role")} />,
        cell: ({ row }) => <Badge variant="secondary">{t(`role.${row.original.role}`)}</Badge>,
      },
      {
        accessorKey: "stores",
        enableSorting: false,
        meta: { label: t("col.stores") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.stores")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.stores.length === 0
              ? "—"
              : row.original.stores.map((s) => s.name).join(", ")}
          </span>
        ),
      },
      {
        accessorKey: "rating",
        meta: { label: t("col.rating") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.rating")} />,
        cell: ({ row }) =>
          row.original.rating ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {row.original.rating}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        enableSorting: false,
        meta: { label: t("col.status") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={
              row.original.status === "active"
                ? "text-emerald-600"
                : row.original.status === "invited"
                  ? "text-amber-600"
                  : "text-muted-foreground"
            }
          >
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: t("col.created") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.created")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.original.createdAt, { locale })}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <EmployeeRowActions row={row.original} isOwner={isOwner} currentUserId={currentUserId} />
        ),
      },
    ],
    [t, locale, router, isOwner, currentUserId],
  );

  const { table, selectedIds, resetSelection } = useDataTable<EmployeeListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries(trpc.employees.list.queryFilter());
  const bulkSetDisabled = useMutation(trpc.employees.bulkSetDisabled.mutationOptions());
  const bulkRemove = useMutation(trpc.employees.bulkRemove.mutationOptions());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onExport = async () => {
    const data = await queryClient.fetchQuery(trpc.employees.listByIds.queryOptions({ ids: selectedIds }));
    downloadCsv(
      rowsToCsv(data, [
        { header: t("col.employee"), value: (e) => e.name ?? "" },
        { header: t("col.email"), value: (e) => e.email ?? "" },
        { header: t("col.role"), value: (e) => e.role },
        { header: t("col.stores"), value: (e) => e.stores.map((s) => s.name).join(" | ") },
        { header: t("col.rating"), value: (e) => (e.rating ? String(e.rating) : "") },
        { header: t("col.status"), value: (e) => e.status },
      ]),
      `empleados-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  const onSetDisabled = (disabled: boolean) =>
    bulkSetDisabled.mutate(
      { ids: selectedIds, disabled },
      {
        onSuccess: async () => {
          await invalidate();
          resetSelection();
          toast.success(disabled ? t("disabled") : t("enabled"));
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const onBulkDelete = () =>
    bulkRemove.mutate(
      { ids: selectedIds },
      {
        onSuccess: async () => {
          await invalidate();
          resetSelection();
          setConfirmDelete(false);
          toast.success(t("bulkDeleteOk", { n: selectedIds.length }));
        },
        onError: () => toast.error(t("removeError")),
      },
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-xl"
            onClick={() => router.push("/employees/performance")}
          >
            <Trophy className="size-4" />
            {t("leaderboard.link")}
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-xl"
            onClick={() => router.push("/employees/audit")}
          >
            <ScrollText className="size-4" />
            {t("auditLink")}
          </Button>
          {isOwner ? (
            <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/employees/new")}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Toolbar — search + Filtros drawer; Sort/View/toggle inline. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("roleFilter")}>
            {ROW_ROLES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={role.includes(v)} onCheckedChange={() => toggle(role, setRole, v)} />
                {t(`role.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("statusFilter")}>
            {STATUSES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={status.includes(v)}
                  onCheckedChange={() => toggle(status, setStatus, v)}
                />
                {t(`status.${v}`)}
              </label>
            ))}
          </FilterSection>

          {storeOptions.length > 0 ? (
            <FilterSection label={t("col.stores")}>
              {storeOptions.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={storeId.includes(s.id)}
                    onCheckedChange={() => toggle(storeId, setStoreId, s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </FilterSection>
          ) : null}
        </DataTableFilters>
        <div className="ml-auto flex items-center gap-2">
          <DataTableSortList table={table} />
          <DataTableViewOptions table={table} />
          <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          table={table}
          view={view}
          isFetching={query.isFetching}
          emptyState={
            <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
              <div>
                <p className="text-foreground font-semibold">{t("empty")}</p>
                <p className="mt-1 text-sm">{t("emptyHint")}</p>
              </div>
            </div>
          }
          renderGrid={(items) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((e) => (
                <div
                  key={e.id}
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
                    <Checkbox
                      checked={table.getRow(e.id)?.getIsSelected() ?? false}
                      onCheckedChange={(v) => table.getRow(e.id)?.toggleSelected(!!v)}
                      aria-label={t("selectRow")}
                    />
                    <EmployeeRowActions row={e} isOwner={isOwner} currentUserId={currentUserId} />
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
              ))}
            </div>
          )}
        />
        <DataTablePagination table={table} total={total} selectedCount={selectedIds.length} />
      </div>

      {isOwner ? (
        <DataTableBulkBar count={selectedIds.length} onClear={resetSelection}>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full" onClick={onExport}>
            <Download className="size-4" />
            {t("bulkExport")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            onClick={() => onSetDisabled(true)}
            disabled={bulkSetDisabled.isPending}
          >
            <Ban className="size-4" />
            {t("disable")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            onClick={() => onSetDisabled(false)}
            disabled={bulkSetDisabled.isPending}
          >
            <UserCheck className="size-4" />
            {t("enable")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive h-9 gap-1.5 rounded-full"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            {t("bulkDelete")}
          </Button>
        </DataTableBulkBar>
      ) : null}

      <ResponsiveModal open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("bulkDeleteTitle", { n: selectedIds.length })}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("bulkDeleteHint")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmDelete(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={onBulkDelete}
              disabled={bulkRemove.isPending}
            >
              {t("removeConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <EmployeeDetailModal id={detailId} onClose={() => void setDetailId(null)} />
    </div>
  );
}
