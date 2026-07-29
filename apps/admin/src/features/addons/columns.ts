export interface AddonColumn {
  id: string;
  labelKey: string;
  /** BE sort field; omit when not sortable. */
  sortId?: string;
  sortable: boolean;
  hideable: boolean;
}

/**
 * Column metadata for the add-ons list, shared by the server table (rendering +
 * sort headers) and the client toolbar (sort/column menus). Labels are i18n
 * keys under the `Addons` namespace.
 */
export const ADDON_COLUMNS: readonly AddonColumn[] = [
  { id: "name", labelKey: "col.name", sortId: "name", sortable: true, hideable: false },
  { id: "category", labelKey: "col.category", sortable: false, hideable: true },
  {
    id: "price",
    labelKey: "col.price",
    sortId: "priceDeltaCents",
    sortable: true,
    hideable: true,
  },
  {
    id: "cost",
    labelKey: "col.cost",
    sortId: "costCents",
    sortable: true,
    hideable: true,
  },
  { id: "ingredient", labelKey: "col.ingredient", sortable: false, hideable: true },
  { id: "status", labelKey: "col.status", sortId: "active", sortable: true, hideable: true },
];
