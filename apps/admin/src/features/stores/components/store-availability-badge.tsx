"use client";

import { Badge } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { useStoreScope } from "@/lib/store-scope";

/**
 * Compact "where is this available" badge for catalog lists/detail: "Todas las
 * tiendas", the store name (when restricted to one), or "N tiendas". Hidden for
 * single-store orgs (availability is moot).
 */
export function StoreAvailabilityBadge({ storeIds }: { storeIds: string[] | null }) {
  const t = useTranslations("StoreAvailability");
  const { stores } = useStoreScope();
  if (stores.length < 2) return null;

  if (!storeIds || storeIds.length === 0) {
    return <Badge variant="outline">{t("badgeAll")}</Badge>;
  }
  if (storeIds.length === 1) {
    const name = stores.find((s) => s.id === storeIds[0])?.name;
    return <Badge variant="outline">{name || t("badgeOne")}</Badge>;
  }
  return <Badge variant="outline">{t("badgeCount", { n: storeIds.length })}</Badge>;
}
