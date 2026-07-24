/**
 * Column metadata for the rewards list, shared by the server table (rendering +
 * sort headers) and the client toolbar (sort/view menus). `id`s are the BE sort
 * field ids consumed by `buildRewardsInput` (name / redemptions / createdAt);
 * labels are i18n keys under the `Rewards` namespace.
 */
export const REWARD_COLUMNS = [
  { id: "name", labelKey: "list.colName", sortable: true, hideable: false },
  { id: "type", labelKey: "list.colType", sortable: false, hideable: true },
  { id: "status", labelKey: "list.colStatus", sortable: false, hideable: true },
  { id: "cost", labelKey: "list.colCost", sortable: false, hideable: true },
  { id: "redemptions", labelKey: "list.colRedemptions", sortable: true, hideable: true },
  { id: "createdAt", labelKey: "list.colCreated", sortable: true, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;
