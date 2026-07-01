"use client";

import type { OfferInput } from "@loyalty/api/features/campaigns/schemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

type Kind = "none" | "promo" | "reward";

/**
 * Optional linked offer for a campaign — a Promo or a Reward. Drives the
 * "Canjeados" funnel stage (redemptions of the offer are attributed to the
 * campaign within the attribution window). Two selects: the kind, then the
 * entity (loaded lazily for the chosen kind).
 */
export function CampaignOfferPicker({
  value,
  onChange,
}: {
  value: OfferInput | null;
  onChange: (offer: OfferInput | null) => void;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const kind: Kind = value?.kind ?? "none";

  const promos = useQuery({
    ...trpc.promociones.list.queryOptions({ page: 1, pageSize: 20 }),
    enabled: kind === "promo",
  });
  const rewards = useQuery({
    ...trpc.rewards.catalog.queryOptions({}),
    enabled: kind === "reward",
  });

  const options =
    kind === "promo"
      ? (promos.data?.rows ?? []).map((p) => ({ id: p.id, name: p.name }))
      : kind === "reward"
        ? (rewards.data ?? [])
        : [];

  return (
    <div className="space-y-2">
      <Select
        value={kind}
        onValueChange={(k) =>
          onChange(k === "none" ? null : { kind: k as "promo" | "reward", id: "" })
        }
      >
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("offerNone")}</SelectItem>
          <SelectItem value="promo">{t("offerPromo")}</SelectItem>
          <SelectItem value="reward">{t("offerReward")}</SelectItem>
        </SelectContent>
      </Select>

      {kind !== "none" ? (
        <Select
          value={value?.id || ""}
          onValueChange={(id) => onChange({ kind, id: id ?? "" })}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder={t("offerSelectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
