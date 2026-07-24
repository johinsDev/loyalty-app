/**
 * Column metadata for the promotions list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). Labels are i18n keys
 * under the `Promotions` namespace, resolved by each consumer's translator
 * (`getTranslations` server-side, `useTranslations` client-side). The `id`s of
 * sortable columns are the BE sort field ids consumed by `buildPromotionsInput`.
 */
export const PROMO_COLUMNS = [
  { id: "name", labelKey: "list.colName", sortable: true, hideable: false },
  { id: "type", labelKey: "list.colType", sortable: false, hideable: true },
  { id: "status", labelKey: "list.colStatus", sortable: false, hideable: true },
  { id: "availability", labelKey: "list.colAvailability", sortable: false, hideable: true },
  { id: "vigency", labelKey: "list.colVigency", sortable: false, hideable: true },
  { id: "startsAt", labelKey: "list.colWindow", sortable: true, hideable: true },
  { id: "uses", labelKey: "list.colUses", sortable: true, hideable: true },
  { id: "createdAt", labelKey: "list.colCreated", sortable: true, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;
