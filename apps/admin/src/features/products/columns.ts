export interface ProductColumn {
  id: string;
  labelKey: string;
  /** BE sort field (`buildProductsInput` reads name / price); omit when not sortable. */
  sortId?: string;
  sortable: boolean;
  hideable: boolean;
}

/**
 * Column metadata for the products list, shared by the server table (rendering +
 * sort headers) and the client toolbar (sort/view menus). Labels are i18n keys
 * under the `Products` namespace.
 */
export const PRODUCT_COLUMNS: readonly ProductColumn[] = [
  { id: "product", labelKey: "col.product", sortId: "name", sortable: true, hideable: false },
  { id: "category", labelKey: "col.category", sortable: false, hideable: true },
  { id: "variants", labelKey: "col.variants", sortable: false, hideable: true },
  { id: "price", labelKey: "col.price", sortId: "price", sortable: true, hideable: true },
  { id: "status", labelKey: "col.status", sortable: false, hideable: true },
];
