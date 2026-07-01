import type { MessageStepInput } from "@loyalty/api/features/campaigns/schemas";

/**
 * Starter message presets that seed the wizard's message step client-side. Each
 * one fills a couple of channels with ready-to-tweak copy (merge tokens like
 * `{{nombre}}` are rendered per-recipient at send time). Purely a convenience —
 * the admin edits freely afterwards.
 */
export type CampaignPreset = {
  id: string;
  label: string;
  emoji: string;
  message: MessageStepInput;
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: "lunes-2x1",
    label: "2×1 lunes",
    emoji: "🧋",
    message: {
      push: {
        title: "🧋 2×1 todos los lunes",
        body: "Trae a un amigo: lleva dos bubble teas al precio de uno, {{nombre}}.",
      },
      whatsapp: {
        text: "Hola {{nombre}} 👋 Este lunes tenemos 2×1 en {{sucursal}}. ¡Trae a alguien y disfruten! {{short_link}}",
      },
    },
  },
  {
    id: "bienvenida",
    label: "Bienvenida",
    emoji: "🎉",
    message: {
      push: {
        title: "¡Bienvenido, {{nombre}}!",
        body: "Gracias por unirte a T4 Lovers. Ya sumas {{puntos}} puntos para tu primer premio.",
      },
      email: {
        subject: "Bienvenido a T4 Lovers 🎉",
        body: "Hola {{nombre}}, nos alegra tenerte. Junta sellos en cada compra y canjéalos por bebidas gratis. Nivel actual: {{nivel}}.",
      },
    },
  },
  {
    id: "te-extranamos",
    label: "Te extrañamos",
    emoji: "💚",
    message: {
      push: {
        title: "Te extrañamos, {{nombre}} 💚",
        body: "Hace tiempo no te vemos. Vuelve a {{sucursal}} y disfruta tu bebida favorita.",
      },
      sms: {
        text: "{{nombre}}, te extrañamos en T4. Muéstranos este mensaje y recibe un extra en tu próxima visita. {{short_link}}",
      },
    },
  },
];
