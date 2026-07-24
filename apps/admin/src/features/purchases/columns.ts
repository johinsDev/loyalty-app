/**
 * Column metadata for the purchases list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). `id`s are the BE
 * sort field ids; labels are i18n keys under the `Purchases` namespace.
 */
export const PURCHASE_COLUMNS = [
  { id: "createdAt", labelKey: "col.date", sortable: true, hideable: true },
  { id: "customerName", labelKey: "col.customer", sortable: false, hideable: false },
  { id: "flags", labelKey: "col.flags", sortable: false, hideable: true },
  { id: "itemSummary", labelKey: "col.detail", sortable: false, hideable: true },
  { id: "storeName", labelKey: "col.store", sortable: false, hideable: true },
  { id: "cashierName", labelKey: "col.cashier", sortable: false, hideable: true },
  { id: "discountCents", labelKey: "col.discount", sortable: true, hideable: true, align: "right" },
  { id: "totalCents", labelKey: "col.amount", sortable: true, hideable: true, align: "right" },
  { id: "stampsEarned", labelKey: "col.stamps", sortable: false, hideable: true, align: "right" },
  { id: "pointsEarned", labelKey: "col.points", sortable: false, hideable: true, align: "right" },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;
