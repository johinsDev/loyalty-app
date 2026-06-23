// Hardcoded campaigns data for the design-first Campañas CRUD. Seam: the Phase D
// notifications engine (@loyalty/notifications fan-out + per-customer opt-outs)
// and Trigger.dev scheduling. Channels mirror the engine's channels.

export type Channel = "push" | "email" | "sms" | "whatsapp";
export const CHANNELS: Channel[] = ["push", "email", "sms", "whatsapp"];

export type CampaignType = "automated" | "manual";
export type Status = "active" | "paused" | "draft";
export type Segment = "all" | "vip" | "atRisk" | "new" | "inactive";
export const SEGMENTS: Segment[] = ["all", "vip", "atRisk", "new", "inactive"];

export type Campaign = {
  id: string;
  name: string;
  trigger: string;
  type: CampaignType;
  channels: Channel[];
  sent: number;
  open: number;
  click: number;
  status: Status;
};

export const campaignKpis = [
  { key: "sent", value: "48.2K", delta: "+9.4%" },
  { key: "avgOpen", value: "62%", delta: "+3.1%" },
  { key: "avgClick", value: "18%", delta: "+1.6%" },
  { key: "active", value: "7", delta: "+2" },
];

export const campaigns: Campaign[] = [
  { id: "ca_001", name: "Bienvenida nuevo socio", trigger: "triggerSignup", type: "automated", channels: ["push", "email"], sent: 1280, open: 71, click: 24, status: "active" },
  { id: "ca_002", name: "Feliz cumpleaños 🎂", trigger: "triggerBirthday", type: "automated", channels: ["push", "whatsapp"], sent: 940, open: 78, click: 33, status: "active" },
  { id: "ca_003", name: "Te extrañamos (win-back)", trigger: "triggerInactivity", type: "automated", channels: ["email", "sms"], sent: 612, open: 41, click: 12, status: "active" },
  { id: "ca_004", name: "Promo 2×1 entre semana", trigger: "triggerManual", type: "manual", channels: ["push", "whatsapp", "email"], sent: 3420, open: 66, click: 21, status: "active" },
  { id: "ca_005", name: "Doble puntos fin de semana", trigger: "triggerManual", type: "manual", channels: ["push"], sent: 2890, open: 59, click: 17, status: "paused" },
  { id: "ca_006", name: "Reseña en Google", trigger: "triggerManual", type: "manual", channels: ["whatsapp"], sent: 0, open: 0, click: 0, status: "draft" },
];

export type CampaignDraft = {
  name: string;
  title: string;
  body: string;
  cta: string;
  channels: Channel[];
  segment: Segment;
  scheduleMode: "event" | "recurring" | "date";
  event: string;
  frequency: string;
  date: Date | null;
  time: string;
};

export const emptyCampaignDraft: CampaignDraft = {
  name: "",
  title: "",
  body: "",
  cta: "",
  channels: ["push"],
  segment: "all",
  scheduleMode: "event",
  event: "signup",
  frequency: "weekly",
  date: null,
  time: "12:00",
};

const SAMPLE: CampaignDraft = {
  name: "Promo 2×1 entre semana",
  title: "🧋 2×1 toda la semana",
  body: "Trae a un amigo: lleva dos bubble teas al precio de uno, de lunes a jueves.",
  cta: "Ver promo",
  channels: ["push", "whatsapp", "email"],
  segment: "all",
  scheduleMode: "recurring",
  event: "signup",
  frequency: "weekly",
  date: null,
  time: "12:00",
};

/** Resolve a campaign into an editable draft. Hardcoded — unknown ids fall back
 * to a representative sample so deep links never 404 in the design build. */
export function getCampaignDraft(id: string): CampaignDraft {
  const c = campaigns.find((x) => x.id === id);
  if (!c) return SAMPLE;
  return {
    ...SAMPLE,
    name: c.name,
    channels: c.channels,
  };
}

export const EVENTS = ["signup", "birthday", "inactivity", "firstPurchase"] as const;
export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
