"use client";

import { Bell, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Channel, CampaignDraft } from "../data";

/**
 * Live per-channel render of the campaign message — a push notification card, an
 * email, an SMS bubble, and a WhatsApp bubble. The wizard stacks one of these
 * per selected channel so the owner sees exactly what each audience receives.
 */
export function ChannelPreview({
  channel,
  draft,
}: {
  channel: Channel;
  draft: CampaignDraft;
}) {
  const t = useTranslations("Campaigns");
  const title = draft.title || t("previewTitlePlaceholder");
  const body = draft.body || t("previewBodyPlaceholder");

  if (channel === "push") {
    return (
      <Frame icon={Bell} label={t("channel.push")}>
        <div className="bg-card border-border rounded-2xl border p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground font-display grid size-6 flex-none place-items-center rounded-md text-[0.625rem] font-bold">
              T4
            </span>
            <span className="text-muted-foreground text-xs font-bold">
              T4 Lovers
            </span>
            <span className="text-muted-foreground/60 ml-auto text-xs">ahora</span>
          </div>
          <div className="mt-1.5 text-sm font-bold">{title}</div>
          <p className="text-muted-foreground line-clamp-3 text-sm">{body}</p>
        </div>
      </Frame>
    );
  }

  if (channel === "email") {
    return (
      <Frame icon={Mail} label={t("channel.email")}>
        <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-sm">
          <div className="border-border border-b px-3 py-2">
            <div className="text-xs font-bold">{title}</div>
            <div className="text-muted-foreground/70 text-[0.625rem] font-semibold">
              T4 Lovers · hola@t4lovers.com
            </div>
          </div>
          <div className="space-y-2 p-3">
            <p className="text-muted-foreground text-sm leading-snug">{body}</p>
            {draft.cta ? (
              <span className="bg-primary text-primary-foreground inline-flex rounded-lg px-3 py-1.5 text-xs font-bold">
                {draft.cta}
              </span>
            ) : null}
          </div>
        </div>
      </Frame>
    );
  }

  if (channel === "whatsapp") {
    return (
      <Frame icon={MessageCircle} label={t("channel.whatsapp")}>
        <div className="rounded-2xl bg-emerald-950/40 p-3">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3 py-2 text-white">
            <div className="text-sm font-bold">{title}</div>
            <p className="text-sm leading-snug text-white/95">{body}</p>
            {draft.cta ? (
              <div className="mt-1.5 border-t border-white/20 pt-1.5 text-center text-xs font-bold">
                {draft.cta}
              </div>
            ) : null}
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame icon={MessageSquare} label={t("channel.sms")}>
      <div className="bg-muted/40 rounded-2xl p-3">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
          <p className="text-sm leading-snug">
            {body}
            {draft.cta ? ` ${draft.cta}` : ""}
          </p>
        </div>
      </div>
    </Frame>
  );
}

function Frame({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Bell;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="preview-customer">
      <div className="text-muted-foreground/70 mb-1.5 flex items-center gap-1.5 text-xs font-bold">
        <Icon className="size-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}
