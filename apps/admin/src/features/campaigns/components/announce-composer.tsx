"use client";

import { Input, Label, Switch, Textarea } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

export type AnnounceChannel = "push" | "email" | "whatsapp";

export type AnnounceValue = {
  enabled: boolean;
  title: string;
  body: string;
  channels: AnnounceChannel[]; // ordered priority; push default-on
  audience: "all" | "tier"; // Phase 1 presets
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
    when: "now",
  };
}

export function AnnounceComposer({
  value,
  onChange,
  disabled,
  disabledReason,
}: {
  value: AnnounceValue;
  onChange: (v: AnnounceValue) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const t = useTranslations("Campaigns.announce");
  const trpc = useTRPC();
  const set = (patch: Partial<AnnounceValue>) => onChange({ ...value, ...patch });

  const reach = useQuery({
    ...trpc.campaigns.countReach.queryOptions({
      audienceFilter: value.audience === "all" ? undefined : { tiers: ["oro" as const] },
      channelPriority: value.channels,
    }),
    enabled: value.enabled && !disabled,
  });

  if (disabled) {
    return <p className="text-muted-foreground text-sm">{disabledReason}</p>;
  }

  return (
    <div className="space-y-4">
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
              maxLength={80}
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("body")}</Label>
            <Textarea
              className="min-h-20"
              maxLength={180}
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">{t("linkHint")}</p>
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
            {reach.data ? (
              <p className="text-muted-foreground text-xs">
                {t("reach", { n: reach.data.audience })}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
