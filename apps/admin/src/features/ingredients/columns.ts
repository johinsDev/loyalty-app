export interface IngredientColumn {
  id: string;
  labelKey: string;
  sortId?: string;
  sortable: boolean;
  hideable: boolean;
}

/** Column metadata for the ingredients list, shared by the server table and the
 *  client toolbar. Labels are i18n keys under the `Ingredients` namespace. */
export const INGREDIENT_COLUMNS: readonly IngredientColumn[] = [
  { id: "name", labelKey: "col.name", sortId: "name", sortable: true, hideable: false },
  { id: "category", labelKey: "col.category", sortable: false, hideable: true },
  { id: "unit", labelKey: "col.unit", sortId: "unit", sortable: true, hideable: true },
  {
    id: "cost",
    labelKey: "col.cost",
    sortId: "costPerUnitCents",
    sortable: true,
    hideable: true,
  },
  { id: "usage", labelKey: "col.usage", sortable: false, hideable: true },
];
