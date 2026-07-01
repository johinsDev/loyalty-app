"use client";

import { Bell, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Channel = "push" | "email" | "sms" | "whatsapp";

/** Message copy per channel — all four present with possibly-empty strings (the
 *  wizard's working state). Content presence is decided here. */
export type PreviewMessage = {
  push: { title: string; body: string };
  email: { subject: string; body: string };
  sms: { text: string };
  whatsapp: { text: string };
};

const CHANNEL_ICON: Record<Channel, typeof Bell> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

const DEFAULT_ORDER: Channel[] = ["push", "email", "sms", "whatsapp"];

function hasContent(message: PreviewMessage, c: Channel): boolean {
  if (c === "push") return !!(message.push.title || message.push.body);
  if (c === "email") return !!(message.email.subject || message.email.body);
  if (c === "sms") return !!message.sms.text;
  return !!message.whatsapp.text;
}

/** Highlight `{{merge}}` tokens so the admin can spot them in the preview. */
function renderCopy(text: string, placeholder?: string): ReactNode {
  if (!text) return placeholder ? <span className="opacity-60">{placeholder}</span> : null;
  return text.split(/(\{\{\s*[a-z_]+\s*\}\})/gi).map((part, i) =>
    /^\{\{\s*[a-z_]+\s*\}\}$/i.test(part) ? (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i} className="bg-primary/15 text-primary rounded px-1 font-semibold">
        {part}
      </span>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Live per-channel render of a campaign message — a push card, an email, an SMS
 * bubble and a WhatsApp bubble, stacked in the campaign's channel priority order
 * (only channels that have copy). Wrapped in `.preview-customer` so the customer
 * theme applies inside the admin re-skin.
 */
export function CampaignMessagePreview({
  message,
  channelPriority,
}: {
  message: PreviewMessage;
  channelPriority: Channel[];
}) {
  const t = useTranslations("Campaigns");

  const order = (channelPriority.length > 0 ? channelPriority : DEFAULT_ORDER).filter(
    (c, i, arr) => arr.indexOf(c) === i,
  );
  const active = order.filter((c) => hasContent(message, c));

  if (active.length === 0) {
    return (
      <div className="border-border text-muted-foreground grid h-40 place-items-center rounded-3xl border border-dashed px-6 text-center text-sm">
        {t("previewEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.map((c) => (
        <Card key={c} channel={c} message={message} />
      ))}
    </div>
  );
}

function Card({ channel, message }: { channel: Channel; message: PreviewMessage }) {
  const t = useTranslations("Campaigns");
  const Icon = CHANNEL_ICON[channel];

  const body = (() => {
    if (channel === "push") {
      return (
        <div className="bg-card border-border rounded-2xl border p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground font-display grid size-6 flex-none place-items-center rounded-md text-[0.625rem] font-bold">
              T4
            </span>
            <span className="text-muted-foreground text-xs font-bold">T4 Lovers</span>
            <span className="text-muted-foreground/60 ml-auto text-xs">{t("previewNow")}</span>
          </div>
          <div className="mt-1.5 text-sm font-bold">
            {renderCopy(message.push.title, t("previewTitlePlaceholder"))}
          </div>
          <p className="text-muted-foreground line-clamp-3 text-sm">
            {renderCopy(message.push.body, t("previewBodyPlaceholder"))}
          </p>
        </div>
      );
    }
    if (channel === "email") {
      return (
        <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-sm">
          <div className="border-border border-b px-3 py-2">
            <div className="text-xs font-bold">
              {renderCopy(message.email.subject, t("previewTitlePlaceholder"))}
            </div>
            <div className="text-muted-foreground/70 text-[0.625rem] font-semibold">
              T4 Lovers · hola@t4lovers.com
            </div>
          </div>
          <div className="space-y-2 p-3">
            {message.email.body ? (
              <div
                className="prose prose-sm text-muted-foreground max-w-none text-sm leading-snug [&_a]:text-primary [&_a]:underline"
                // TipTap-authored HTML (admin-only preview).
                dangerouslySetInnerHTML={{ __html: message.email.body }}
              />
            ) : (
              <p className="text-muted-foreground text-sm leading-snug">
                {t("previewBodyPlaceholder")}
              </p>
            )}
          </div>
        </div>
      );
    }
    if (channel === "whatsapp") {
      return (
        <div className="rounded-2xl bg-emerald-950/40 p-3">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3 py-2 text-white">
            <p className="text-sm leading-snug text-white/95">
              {renderCopy(message.whatsapp.text, t("previewBodyPlaceholder"))}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-muted/40 rounded-2xl p-3">
        <div className="bg-muted max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2">
          <p className="text-sm leading-snug">
            {renderCopy(message.sms.text, t("previewBodyPlaceholder"))}
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className="preview-customer">
      <div className="text-muted-foreground/70 mb-1.5 flex items-center gap-1.5 text-xs font-bold">
        <Icon className="size-3.5" />
        {t(`channel.${channel}`)}
      </div>
      {body}
    </div>
  );
}
