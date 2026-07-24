/**
 * Column metadata for the customers list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). Labels are i18n
 * keys under the `Customers` namespace, resolved by each consumer's translator
 * (`getTranslations` server-side, `useTranslations` client-side). The `id`s are
 * the BE sort field ids consumed by `buildCustomersInput`.
 */
export const CUSTOMER_COLUMNS = [
  { id: "name", labelKey: "col.customer", sortable: true, hideable: false },
  { id: "tierKey", labelKey: "col.tier", sortable: false, hideable: true },
  { id: "visits", labelKey: "col.visits", sortable: true, hideable: true, align: "right" },
  { id: "ltv", labelKey: "col.spent", sortable: true, hideable: true, align: "right" },
  { id: "lastVisit", labelKey: "col.lastVisit", sortable: true, hideable: true },
  { id: "status", labelKey: "col.status", sortable: false, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;
