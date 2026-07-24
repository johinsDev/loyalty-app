import type { CampaignDisplayState } from "@loyalty/api/features/campaigns/schemas";

/**
 * Column metadata for the campaigns list, shared by the server table (rendering
 * + sort headers) and the client toolbar (sort/view menus). `id`s are the BE
 * sort field ids; labels are i18n keys under the `Campaigns` namespace.
 */
export const CAMPAIGN_COLUMNS = [
  { id: "name", labelKey: "colName", sortable: true, hideable: true },
  { id: "type", labelKey: "colType", sortable: false, hideable: true },
  { id: "displayState", labelKey: "colState", sortable: false, hideable: true },
  { id: "channelPriority", labelKey: "colChannels", sortable: false, hideable: true },
  { id: "sent", labelKey: "colSent", sortable: true, hideable: true },
  { id: "createdAt", labelKey: "colCreated", sortable: true, hideable: true },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: string;
  sortable: boolean;
  hideable: boolean;
  align?: "left" | "right";
}>;

/** State → badge class, shared by the table state cell and the grid card. */
export const STATE_STYLE: Record<CampaignDisplayState, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  sending: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  paused: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  active: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  ended: "bg-muted text-muted-foreground",
};
