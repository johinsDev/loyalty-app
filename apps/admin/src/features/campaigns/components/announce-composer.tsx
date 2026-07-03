"use client";

import { Switch } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import type { AudienceValue } from "../lib/campaign-audience";
import type { CampaignMessageValue } from "../lib/campaign-message";
import { CampaignAudienceFields } from "./campaign-audience-fields";
import { CampaignMessageFields } from "./campaign-message-fields";
import { CampaignMessagePreview } from "./campaign-message-preview";

export type AnnounceValue = {
  enabled: boolean;
  /** Full message editor state (per-channel copy + priority + link). */
  message: CampaignMessageValue;
  /** Full audience filter state. */
  audience: AudienceValue;
  /** Derived from the banner (no UI control in Phase 1). */
  scheduledAt?: Date;
};

export function AnnounceComposer({
  value,
  onChange,
  disabled,
  disabledReason,
  priorCampaigns,
  showError,
}: {
  value: AnnounceValue;
  onChange: (v: AnnounceValue) => void;
  disabled?: boolean;
  disabledReason?: string;
  priorCampaigns?: { id: string; name: string | null }[];
  /** Surface the "at least one channel required" error (wizard's attempted state). */
  showError?: boolean;
}) {
  const t = useTranslations("Campaigns.announce");

  const priorNote =
    priorCampaigns && priorCampaigns.length > 0 ? (
      <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2 text-xs">
        {t("prior", { n: priorCampaigns.length })}{" "}
        {priorCampaigns.map((c, i) => (
          <span key={c.id}>
            {i > 0 ? ", " : null}
            <Link
              href={{ pathname: "/campaigns/[id]", params: { id: c.id } }}
              className="text-primary font-medium hover:underline"
            >
              {c.name || t("untitled")}
            </Link>
          </span>
        ))}
      </p>
    ) : null;

  if (disabled) {
    return (
      <div className="space-y-4">
        {priorNote}
        <p className="text-muted-foreground text-sm">{disabledReason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {priorNote}

      <label className="flex items-center gap-3">
        <Switch checked={value.enabled} onCheckedChange={(c) => onChange({ ...value, enabled: c })} />
        <span className="text-sm font-medium">{t("toggle")}</span>
      </label>

      {value.enabled && (
        <div className="space-y-5">
          <CampaignMessageFields
            value={value.message}
            onChange={(m) => onChange({ ...value, message: m })}
            showError={showError}
            showPresets={false}
            showTemplates={false}
          />
          <CampaignMessagePreview
            message={value.message.message}
            channelPriority={value.message.channelPriority}
          />
          <p className="text-muted-foreground text-xs">{t("linkHint")}</p>
          <CampaignAudienceFields
            value={value.audience}
            onChange={(a) => onChange({ ...value, audience: a })}
            channelPriority={value.message.channelPriority}
          />
        </div>
      )}
    </div>
  );
}
