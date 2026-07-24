/**
 * Column metadata for the employees list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). `id`s are the BE
 * sort field ids consumed by `buildEmployeesInput`; labels are i18n keys under
 * the `Employees` namespace, resolved by each consumer's translator
 * (`getTranslations` server-side, `useTranslations` client-side).
 */
export const EMPLOYEE_COLUMNS = [
  { id: "name", labelKey: "col.employee", sortable: true, hideable: false },
  { id: "email", labelKey: "col.email", sortable: false, hideable: true },
  { id: "role", labelKey: "col.role", sortable: true, hideable: true },
  { id: "stores", labelKey: "col.stores", sortable: false, hideable: true },
  { id: "rating", labelKey: "col.rating", sortable: true, hideable: true },
  { id: "status", labelKey: "col.status", sortable: false, hideable: true },
  { id: "createdAt", labelKey: "col.created", sortable: true, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;
