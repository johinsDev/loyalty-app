import type { BannerDisplayState } from "@loyalty/api/features/banners/schemas";

/**
 * Column metadata for the banners list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). `id`s are the BE
 * sort field ids; labels are i18n keys under the `Banners` namespace. The
 * `stores` column is only rendered for multi-store orgs (the toolbar filters it
 * out otherwise).
 */
export const BANNER_COLUMNS = [
  { id: "name", labelKey: "colName", sortable: true, hideable: true },
  { id: "slug", labelKey: "colSlug", sortable: false, hideable: true },
  { id: "displayState", labelKey: "colState", sortable: false, hideable: true },
  { id: "stores", labelKey: "colStores", sortable: false, hideable: true },
  { id: "displayFrom", labelKey: "colSchedule", sortable: false, hideable: true },
  { id: "createdAt", labelKey: "colCreated", sortable: true, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;

/** State → badge class, shared by the table state cell and the grid card. */
export const STATE_STYLE: Record<BannerDisplayState, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};
