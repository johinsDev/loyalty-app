"use client";

import { Button, Input, Label, Switch, Textarea } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { CAMPAIGN_VARS } from "../lib/campaign-vars";
import { CampaignVariablesHelp } from "./campaign-variables-help";

export type AnnounceChannel = "push" | "email" | "whatsapp";
export type Tier = "hoja" | "flor" | "oro";

const TIERS: readonly Tier[] = ["hoja", "flor", "oro"];
const TITLE_MAX = 80;
const BODY_MAX = 180;

export type AnnounceValue = {
  enabled: boolean;
  title: string;
  body: string;
  channels: AnnounceChannel[]; // ordered priority; push default-on
  audience: "all" | "tier"; // Phase 1 presets
  tiers: Tier[]; // when audience === "tier"; empty = everyone
  when: "now" | "schedule";
  scheduledAt?: Date;
};

const CHANNELS: readonly AnnounceChannel[] = ["push", "email", "whatsapp"];

export function announceInitial(seed: { title: string; body: string }): AnnounceValue {
  return {
    enabled: false,
    title: seed.title,
    body: seed.body,
    channels: ["push"],
    audience: "all",
    tiers: [],
    when: "now",
  };
}

/** Phase 1 tier presets → audience filter. An empty tier selection (or "all")
 *  targets everyone, so the tier filter is omitted (matches the wizard's
 *  buildAudienceFilter). */
export function announceAudienceFilter(v: AnnounceValue): { tiers: Tier[] } | undefined {
  if (v.audience === "all" || v.tiers.length === 0) return undefined;
  return { tiers: v.tiers };
}

export function AnnounceComposer({
  value,
  onChange,
  disabled,
  disabledReason,
  priorCampaigns,
}: {
  value: AnnounceValue;
  onChange: (v: AnnounceValue) => void;
  disabled?: boolean;
  disabledReason?: string;
  priorCampaigns?: number;
}) {
  const t = useTranslations("Campaigns.announce");
  const tc = useTranslations("Campaigns");
  const trpc = useTRPC();
  const [helpOpen, setHelpOpen] = useState(false);
  // Which field the variable pills insert into (defaults to the message).
  const [activeField, setActiveField] = useState<"title" | "body">("body");
  const set = (patch: Partial<AnnounceValue>) => onChange({ ...value, ...patch });

  const reach = useQuery({
    ...trpc.campaigns.countReach.queryOptions({
      audienceFilter: announceAudienceFilter(value),
      channelPriority: value.channels,
    }),
    enabled: value.enabled && !disabled,
  });

  const insert = (token: string) => {
    const max = activeField === "title" ? TITLE_MAX : BODY_MAX;
    const current = value[activeField];
    const sep = current && !current.endsWith(" ") ? " " : "";
    const next = `${current}${sep}${token}`;
    if (next.length > max) return; // don't split a token mid-way
    if (activeField === "title") set({ title: next });
    else set({ body: next });
  };

  const priorNote =
    priorCampaigns && priorCampaigns > 0 ? (
      <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2 text-xs">
        {t("prior", { n: priorCampaigns })}
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

  const titleInvalid = value.enabled && !value.title.trim();
  const bodyInvalid = value.enabled && !value.body.trim();

  return (
    <div className="space-y-4">
      {priorNote}

      <label className="flex items-center gap-3">
        <Switch checked={value.enabled} onCheckedChange={(c) => set({ enabled: c })} />
        <span className="text-sm font-medium">{t("toggle")}</span>
      </label>

      {value.enabled && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("title")}</Label>
            <Input
              className="h-10"
              maxLength={TITLE_MAX}
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
              onFocus={() => setActiveField("title")}
              aria-invalid={titleInvalid ? true : undefined}
            />
            {titleInvalid ? <ErrorText>{t("required")}</ErrorText> : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("body")}</Label>
            <Textarea
              className="min-h-20"
              maxLength={BODY_MAX}
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
              onFocus={() => setActiveField("body")}
              aria-invalid={bodyInvalid ? true : undefined}
            />
            {bodyInvalid ? <ErrorText>{t("required")}</ErrorText> : null}
            <p className="text-muted-foreground text-xs">{t("linkHint")}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">{tc("tokensLabel")}</Label>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-semibold"
              >
                <HelpCircle className="size-3.5" />
                {tc("variablesHelp")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_VARS.map((v) => (
                <Button
                  key={v.token}
                  type="button"
                  variant="secondary"
                  size="sm"
                  title={`${v.hint} · ${v.token}`}
                  className="h-8 rounded-full text-xs font-semibold"
                  onClick={() => insert(v.token)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("channels")}</Label>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => {
                const on = value.channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() =>
                      set({
                        channels: on
                          ? value.channels.filter((c) => c !== ch)
                          : [...value.channels, ch],
                      })
                    }
                    className={`h-10 rounded-full border px-4 text-sm font-medium ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {t(`channel.${ch}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("audience")}</Label>
            <div className="flex gap-2">
              {(["all", "tier"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ audience: a })}
                  className={`h-10 rounded-full border px-4 text-sm ${
                    value.audience === a
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  {t(`aud.${a}`)}
                </button>
              ))}
            </div>

            {value.audience === "tier" ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-2">
                  {TIERS.map((tier) => {
                    const on = value.tiers.includes(tier);
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() =>
                          set({
                            tiers: on
                              ? value.tiers.filter((x) => x !== tier)
                              : [...value.tiers, tier],
                          })
                        }
                        className={`h-10 rounded-full border px-4 text-sm font-medium capitalize ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
                {value.tiers.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("tierHint")}</p>
                ) : null}
              </div>
            ) : null}

            {reach.data ? (
              <p className="text-muted-foreground text-xs">
                {t("reach", { n: reach.data.audience })}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <CampaignVariablesHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs font-semibold">{children}</p>;
}
