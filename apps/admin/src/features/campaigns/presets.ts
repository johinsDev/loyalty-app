import type { MessageContentInput } from "@loyalty/api/features/campaigns/schemas";

/**
 * Starter message presets that seed the wizard's message step client-side. Each
 * one fills a couple of channels with ready-to-tweak copy (merge tokens like
 * `{{user.name}}` are rendered per-recipient at send time). Purely a convenience
 * — the admin edits freely afterwards. Kept broad so staff see how variables +
 * channels are meant to be used across many campaign ideas.
 */
export type CampaignPreset = {
  id: string;
  label: string;
  emoji: string;
  message: MessageContentInput;
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: "lunes-2x1",
    label: "2×1 lunes",
    emoji: "🧋",
    message: {
      push: {
        title: "🧋 2×1 todos los lunes",
        body: "Trae a un amigo, {{user.name}}: dos bubble teas al precio de uno.",
      },
      whatsapp: {
        text: "Hola {{user.name}} 👋 Este lunes hay *2×1* en {{store.name}}. ¡Trae a alguien y disfruten!",
      },
    },
  },
  {
    id: "bienvenida",
    label: "Bienvenida",
    emoji: "🎉",
    message: {
      push: {
        title: "¡Bienvenido, {{user.name}}!",
        body: "Gracias por unirte. Junta sellos en cada compra y canjéalos por bebidas gratis.",
      },
      email: {
        subject: "Bienvenido a T4 Lovers 🎉",
        body: "Hola {{user.name}}, nos alegra tenerte. Por cada compra sumas sellos y puntos. ¡Nos vemos en {{store.name}}!",
      },
    },
  },
  {
    id: "te-extranamos",
    label: "Te extrañamos",
    emoji: "💚",
    message: {
      push: {
        title: "Te extrañamos, {{user.name}} 💚",
        body: "Hace tiempo no te vemos. Vuelve a {{store.name}} por tu bebida favorita.",
      },
      whatsapp: {
        text: "{{user.name}}, te extrañamos en T4 💚 Pasa por {{store.name}} y consiéntete esta semana.",
      },
    },
  },
  {
    id: "cumpleanos",
    label: "Cumpleaños",
    emoji: "🎂",
    message: {
      push: {
        title: "¡Feliz cumple, {{user.name}}! 🎂",
        body: "Celébralo con nosotros: pásate por {{store.name}} y te tenemos una sorpresa.",
      },
      whatsapp: {
        text: "🎂 ¡Feliz cumpleaños, {{user.name}}! Ven a {{store.name}} esta semana y celebremos juntos con algo especial 🎁",
      },
    },
  },
  {
    id: "cerca-premio",
    label: "Cerca de un premio",
    emoji: "🎁",
    message: {
      push: {
        title: "¡Estás cerca de tu premio! 🎁",
        body: "{{user.name}}, ya llevas {{user.stamps}} sellos. Una compra más y reclamas gratis.",
      },
      whatsapp: {
        text: "Hola {{user.name}} 👀 Llevas *{{user.stamps}} sellos*. ¡Estás a nada de tu próxima bebida gratis en {{store.name}}!",
      },
    },
  },
  {
    id: "puntos-disponibles",
    label: "Tus puntos",
    emoji: "⭐",
    message: {
      push: {
        title: "Tienes {{user.points}} puntos ⭐",
        body: "{{user.name}}, úsalos en tu próxima visita a {{store.name}} antes de que se acumulen más.",
      },
      sms: {
        text: "{{user.name}}, tienes {{user.points}} puntos en T4. Canjéalos en tu próxima visita a {{store.name}}.",
      },
    },
  },
  {
    id: "nuevo-producto",
    label: "Nuevo producto",
    emoji: "✨",
    message: {
      push: {
        title: "¡Algo nuevo en el menú! ✨",
        body: "{{user.name}}, ven a {{store.name}} y sé de los primeros en probarlo.",
      },
      email: {
        subject: "Nuevo en T4 ✨",
        body: "Hola {{user.name}}, acabamos de sumar una novedad al menú. Pásate por {{store.name}} y cuéntanos qué te parece.",
      },
    },
  },
  {
    id: "fin-de-semana",
    label: "Fin de semana",
    emoji: "🎉",
    message: {
      push: {
        title: "Plan de fin de semana 🎉",
        body: "{{user.name}}, arranca el finde con tu bebida favorita en {{store.name}}.",
      },
      whatsapp: {
        text: "¡Feliz finde, {{user.name}}! 🎉 Pásate por {{store.name}} y date un gusto este fin de semana.",
      },
    },
  },
  {
    id: "racha-en-riesgo",
    label: "Racha en riesgo",
    emoji: "🔥",
    message: {
      push: {
        title: "¡No pierdas tu racha! 🔥",
        body: "{{user.name}}, pasa hoy por {{store.name}} para mantenerla viva.",
      },
      whatsapp: {
        text: "🔥 {{user.name}}, tu racha está a punto de cortarse. Pásate hoy por {{store.name}} y mantenla encendida.",
      },
    },
  },
  {
    id: "sube-de-nivel",
    label: "Sube de nivel",
    emoji: "🏆",
    message: {
      push: {
        title: "Estás a poco de subir de nivel 🏆",
        body: "{{user.name}}, hoy eres nivel {{user.tier}}. Una compra más y subes con más beneficios.",
      },
      whatsapp: {
        text: "🏆 {{user.name}}, tu nivel actual es *{{user.tier}}*. ¡Sigue sumando y desbloquea más beneficios en T4!",
      },
    },
  },
  {
    id: "referido",
    label: "Invita a un amigo",
    emoji: "🤝",
    message: {
      push: {
        title: "Trae a un amigo 🤝",
        body: "{{user.name}}, invita a alguien a {{store.name}} y disfruten juntos.",
      },
      whatsapp: {
        text: "{{user.name}}, ¿conoces a alguien a quien le encantaría T4? 🤝 Invítalo a {{store.name}} esta semana.",
      },
    },
  },
  {
    id: "happy-hour",
    label: "Happy hour",
    emoji: "⏰",
    message: {
      push: {
        title: "Happy hour hoy ⏰",
        body: "{{user.name}}, pásate por {{store.name}} en las próximas horas y aprovecha.",
      },
      sms: {
        text: "{{user.name}}, happy hour hoy en {{store.name}}. ¡Aprovecha antes de que termine!",
      },
    },
  },
];
