import type { MessageContentInput } from "@loyalty/api/features/campaigns/schemas";

import type { PreviewMessage } from "../components/campaign-message-preview";

export type { PreviewMessage };

export const CHANNELS = ["push", "email", "sms", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

/** The controlled value the message editor round-trips: per-channel copy, the
 *  ordered channel priority, and the (persisted-only) link URL. */
export type CampaignMessageValue = {
  message: PreviewMessage;
  channelPriority: Channel[];
  linkUrl: string;
};

export const EMPTY_MESSAGE: PreviewMessage = {
  push: { title: "", body: "" },
  email: { subject: "", body: "" },
  sms: { text: "" },
  whatsapp: { text: "" },
};

export function toFormMessage(m: MessageContentInput | null): PreviewMessage {
  return {
    push: { title: m?.push?.title ?? "", body: m?.push?.body ?? "" },
    email: { subject: m?.email?.subject ?? "", body: m?.email?.body ?? "" },
    sms: { text: m?.sms?.text ?? "" },
    whatsapp: { text: m?.whatsapp?.text ?? "" },
  };
}

export function isChannelComplete(m: PreviewMessage, c: Channel): boolean {
  if (c === "push") return !!(m.push.title && m.push.body);
  if (c === "email") return !!(m.email.subject && m.email.body);
  if (c === "sms") return !!m.sms.text;
  return !!m.whatsapp.text;
}

/** Only the channels that have complete content (schema-compatible). */
export function buildMessageInput(m: PreviewMessage): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.push.title && m.push.body) out.push = { title: m.push.title, body: m.push.body };
  if (m.email.subject && m.email.body) out.email = { subject: m.email.subject, body: m.email.body };
  if (m.sms.text) out.sms = { text: m.sms.text };
  if (m.whatsapp.text) out.whatsapp = { text: m.whatsapp.text };
  return out;
}

/** A message is publishable when at least one channel has complete copy and the
 *  priority order is non-empty. */
export function isMessageComplete(value: CampaignMessageValue): boolean {
  return (
    CHANNELS.some((c) => isChannelComplete(value.message, c)) &&
    value.channelPriority.length > 0
  );
}
