// Hardcoded notifications data for the design-first Notifications screen. Seam:
// the Phase D notifications engine (@loyalty/notifications fan-out + per-customer
// opt-outs) and Trigger.dev scheduling. Channels mirror the engine's channels.

export type Channel = "push" | "email" | "sms" | "whatsapp";
export type Kind = "promo" | "system";
export type St = "sent" | "scheduled" | "failed";

export type Notif = {
  id: string;
  title: string;
  body: string;
  channel: Channel;
  kind: Kind;
  audience: string;
  date: string;
  status: St;
};

export const feed: Notif[] = [
  {
    id: "nt_001",
    title: "🧋 2×1 toda la semana",
    body: "Trae a un amigo: lleva dos bubble teas al precio de uno, de lunes a jueves.",
    channel: "push",
    kind: "promo",
    audience: "Todos",
    date: "Hoy, 09:12",
    status: "sent",
  },
  {
    id: "nt_002",
    title: "Tu recompensa está lista",
    body: "Ya puedes canjear tu bebida gratis en tu próxima visita.",
    channel: "whatsapp",
    kind: "system",
    audience: "Activos",
    date: "Hoy, 08:40",
    status: "sent",
  },
  {
    id: "nt_003",
    title: "Doble puntos fin de semana",
    body: "Sábado y domingo cada compra suma el doble de puntos.",
    channel: "push",
    kind: "promo",
    audience: "Todos",
    date: "Mañana, 10:00",
    status: "scheduled",
  },
  {
    id: "nt_004",
    title: "Te extrañamos 💛",
    body: "Hace un mes que no te vemos. Vuelve y disfruta un 15% de descuento.",
    channel: "email",
    kind: "promo",
    audience: "En riesgo",
    date: "Ayer, 18:25",
    status: "sent",
  },
  {
    id: "nt_005",
    title: "Verificación de cuenta",
    body: "Tu código de acceso es 4821. Caduca en 10 minutos.",
    channel: "sms",
    kind: "system",
    audience: "Individual",
    date: "Ayer, 14:03",
    status: "failed",
  },
  {
    id: "nt_006",
    title: "Feliz cumpleaños 🎂",
    body: "Hoy es tu día: pásate y reclama tu bebida de regalo.",
    channel: "whatsapp",
    kind: "promo",
    audience: "Cumpleañeros",
    date: "Ayer, 09:00",
    status: "sent",
  },
  {
    id: "nt_007",
    title: "Bienvenido a T4 Diver Club",
    body: "Gracias por unirte. Empieza a sumar puntos en tu primera compra.",
    channel: "email",
    kind: "system",
    audience: "Nuevos",
    date: "Lun, 16:48",
    status: "sent",
  },
  {
    id: "nt_008",
    title: "Reseña en Google ⭐",
    body: "¿Disfrutaste tu visita? Cuéntanos con una reseña y gana 50 puntos.",
    channel: "push",
    kind: "promo",
    audience: "Activos",
    date: "Vie, 11:30",
    status: "scheduled",
  },
];

export const engagement = {
  sent: "48.2K",
  open: "62%",
  click: "18%",
} satisfies { sent: string; open: string; click: string };
