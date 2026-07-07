"use client";

import { formatDate } from "@loyalty/date";
import {
  Checkbox,
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { useTRPC } from "@/lib/trpc/client";

import {
  TIERS,
  buildAudienceFilter,
  type AudienceValue,
  type Tier,
} from "../lib/campaign-audience";
import type { Channel } from "../lib/campaign-message";
import { Field } from "./campaign-field";

/**
 * Controlled audience filter: tiers, last-purchase recency, minimum purchases
 * and signup-date bounds. Owns a live reach count (audience − opt-outs) that
 * reflects its own value and the passed channel priority, so it's self-contained
 * and reusable outside the wizard.
 */
export function CampaignAudienceFields({
  value,
  onChange,
  channelPriority,
  showReach = true,
}: {
  value: AudienceValue;
  onChange: (next: AudienceValue) => void;
  /** Reach is audience minus recipients unreachable on any selected channel. */
  channelPriority?: Channel[];
  /** Render + fetch the live reach box (default true). */
  showReach?: boolean;
}) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const trpc = useTRPC();

  const set = <K extends keyof AudienceValue>(key: K, v: AudienceValue[K]) =>
    onChange({ ...value, [key]: v });

  const toggleTier = (tier: Tier) =>
    set(
      "tiers",
      value.tiers.includes(tier) ? value.tiers.filter((x) => x !== tier) : [...value.tiers, tier],
    );

  const audienceFilter = buildAudienceFilter(value);
  const reachInput = useMemo(
    () => ({
      audienceFilter,
      channelPriority: channelPriority && channelPriority.length > 0 ? channelPriority : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(audienceFilter), (channelPriority ?? []).join(",")],
  );
  const debouncedReach = useDebounce(reachInput, { wait: 400 });
  const reach = useQuery({
    ...trpc.campaigns.countReach.queryOptions(debouncedReach),
    enabled: showReach,
  });

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm">{t("audienceHint")}</p>

      <Field label={t("audienceTiers")} hint={t("optional")}>
        <div className="flex flex-wrap gap-3">
          {TIERS.map((tier) => (
            <label
              key={tier}
              className="flex items-center gap-2 text-sm font-semibold capitalize"
            >
              <Checkbox
                checked={value.tiers.includes(tier)}
                onCheckedChange={() => toggleTier(tier)}
              />
              {tier}
            </label>
          ))}
        </div>
      </Field>

      <Field label={t("audienceLastPurchase")} hint={t("optional")}>
        <div className="flex items-center gap-2">
          <Select
            value={value.lastPurchaseOp}
            onValueChange={(v) => set("lastPurchaseOp", (v as "gte" | "lte") ?? "gte")}
          >
            <SelectTrigger size="lg" className="h-10 w-40 text-sm">
              <SelectValue>{(v) => t(`lastPurchaseOp.${v as string}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gte">{t("lastPurchaseOp.gte")}</SelectItem>
              <SelectItem value="lte">{t("lastPurchaseOp.lte")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            value={value.lastPurchaseDays}
            onChange={(e) => set("lastPurchaseDays", e.target.value)}
            placeholder="0"
            className="h-10 w-28"
          />
          <span className="text-muted-foreground text-sm">{t("days")}</span>
        </div>
      </Field>

      <Field label={t("audienceMinPurchases")} hint={t("optional")}>
        <Input
          type="number"
          min={1}
          value={value.minPurchases}
          onChange={(e) => set("minPurchases", e.target.value)}
          placeholder="0"
          className="h-10 w-40"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("audienceSignedUpAfter")} hint={t("optional")}>
          <DatePicker
            value={value.signedUpAfter ?? undefined}
            onValueChange={(d) => set("signedUpAfter", d ?? null)}
            placeholder={t("datePlaceholder")}
            formatLabel={(d) => formatDate(d, { locale })}
          />
        </Field>
        <Field label={t("audienceSignedUpBefore")} hint={t("optional")}>
          <DatePicker
            value={value.signedUpBefore ?? undefined}
            onValueChange={(d) => set("signedUpBefore", d ?? null)}
            placeholder={t("datePlaceholder")}
            formatLabel={(d) => formatDate(d, { locale })}
          />
        </Field>
      </div>

      {showReach ? (
        <ReachBox reachable={reach.data?.reachable} audience={reach.data?.audience} />
      ) : null}
    </div>
  );
}

/** Compact "reaches N of M" pill. Shared with the wizard's schedule step. */
export function ReachBox({ reachable, audience }: { reachable?: number; audience?: number }) {
  const t = useTranslations("Campaigns");
  return (
    <div className="bg-muted/40 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
      <Users className="text-muted-foreground size-4 shrink-0" />
      {reachable !== undefined && audience !== undefined ? (
        <p className="font-semibold">{t("reach", { reachable, audience })}</p>
      ) : (
        <p className="text-muted-foreground">…</p>
      )}
    </div>
  );
}
