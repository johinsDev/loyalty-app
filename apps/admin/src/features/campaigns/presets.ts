import type { MessageContentInput } from "@loyalty/api/features/campaigns/schemas";

/**
 * Starter message presets that seed the wizard's message step client-side. Each
 * one fills a couple of channels with ready-to-tweak, concrete copy (merge
 * tokens like `{{user.name}}` are rendered per-recipient at send time). Grouped
 * by category so staff can browse them in the gallery. Purely a convenience —
 * the admin edits freely afterwards.
 */
export type PresetCategory = "promos" | "fidelizacion" | "ciclo";

export type CampaignPreset = {
  id: string;
  label: string;
  emoji: string;
  category: PresetCategory;
  message: MessageContentInput;
};

export const PRESET_CATEGORIES: { key: PresetCategory; label: string }[] = [
  { key: "promos", label: "Promociones" },
  { key: "fidelizacion", label: "Fidelización" },
  { key: "ciclo", label: "Ciclo de vida" },
];

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  // ── Promociones ────────────────────────────────────────────────────────────
  {
    id: "lunes-2x1",
    label: "2×1 lunes",
    emoji: "🧋",
    category: "promos",
    message: {
      push: {
        title: "🧋 2×1 todos los lunes",
        body: "{{user.name}}, hoy lunes hay 2×1 en todos los smoothies. ¡Trae a alguien!",
      },
      whatsapp: {
        text: "Hola {{user.name}} 👋 *Hoy lunes: 2×1 en todos nuestros smoothies* en {{store.name}}, de 4 pm hasta el cierre. ¡Trae a un amigo y disfruten! 🧋",
      },
    },
  },
  {
    id: "happy-hour",
    label: "Happy hour",
    emoji: "⏰",
    category: "promos",
    message: {
      push: {
        title: "⏰ Happy hour de 4 pm al cierre",
        body: "{{user.name}}, hoy 2×1 en todos los smoothies. ¡Corre a {{store.name}}!",
      },
      whatsapp: {
        text: "⏰ *Happy hour hoy en {{store.name}}* — de 4 pm hasta la hora de cierre: *2×1 en todos nuestros smoothies* 🧋 ¡Aprovéchalo, {{user.name}}!",
      },
    },
  },
  {
    id: "fin-de-semana",
    label: "Fin de semana",
    emoji: "🎉",
    category: "promos",
    message: {
      push: {
        title: "Plan de fin de semana 🎉",
        body: "{{user.name}}, este finde disfruta tu bebida favorita en {{store.name}}.",
      },
      whatsapp: {
        text: "¡Feliz finde, {{user.name}}! 🎉 Este sábado y domingo date un gusto en {{store.name}}. Te esperamos con tu smoothie favorito 🧋",
      },
    },
  },
  {
    id: "nuevo-producto",
    label: "Nuevo producto",
    emoji: "✨",
    category: "promos",
    message: {
      push: {
        title: "¡Nuevo en el menú! ✨",
        body: "{{user.name}}, ya puedes probar nuestra nueva bebida en {{store.name}}.",
      },
      email: {
        subject: "Algo nuevo te espera en T4 ✨",
        body: "Hola {{user.name}}, sumamos una nueva bebida al menú y creemos que te va a encantar. Pásate por {{store.name}} y sé de los primeros en probarla. ¡Cuéntanos qué te pareció!",
      },
    },
  },
  // ── Fidelización ───────────────────────────────────────────────────────────
  {
    id: "cerca-premio",
    label: "Cerca de un premio",
    emoji: "🎁",
    category: "fidelizacion",
    message: {
      push: {
        title: "¡Estás a un paso de tu premio! 🎁",
        body: "{{user.name}}, llevas {{user.stamps}} sellos. Una compra más y reclamas gratis.",
      },
      whatsapp: {
        text: "👀 {{user.name}}, ya tienes *{{user.stamps}} sellos*. ¡Estás a nada de tu próxima bebida gratis en {{store.name}}! Pásate esta semana y complétalos 🎁",
      },
    },
  },
  {
    id: "puntos-disponibles",
    label: "Tus puntos",
    emoji: "⭐",
    category: "fidelizacion",
    message: {
      push: {
        title: "Tienes {{user.points}} puntos ⭐",
        body: "{{user.name}}, úsalos en tu próxima visita a {{store.name}} antes de que se enfríen.",
      },
      sms: {
        text: "{{user.name}}, tienes {{user.points}} puntos en T4. Canjéalos en tu próxima visita a {{store.name}}.",
      },
    },
  },
  {
    id: "sube-de-nivel",
    label: "Sube de nivel",
    emoji: "🏆",
    category: "fidelizacion",
    message: {
      push: {
        title: "Estás por subir de nivel 🏆",
        body: "{{user.name}}, hoy eres nivel {{user.tier}}. Una compra más y desbloqueas más beneficios.",
      },
      whatsapp: {
        text: "🏆 {{user.name}}, tu nivel actual es *{{user.tier}}*. Sigue sumando en {{store.name}} y desbloquea más beneficios. ¡Estás muy cerca!",
      },
    },
  },
  {
    id: "racha-en-riesgo",
    label: "Racha en riesgo",
    emoji: "🔥",
    category: "fidelizacion",
    message: {
      push: {
        title: "¡No pierdas tu racha! 🔥",
        body: "{{user.name}}, pasa hoy por {{store.name}} para mantenerla encendida.",
      },
      whatsapp: {
        text: "🔥 {{user.name}}, tu racha está a punto de cortarse. Pásate hoy por {{store.name}} y mantenla viva. ¡No la dejes ir!",
      },
    },
  },
  // ── Ciclo de vida ──────────────────────────────────────────────────────────
  {
    id: "bienvenida",
    label: "Bienvenida",
    emoji: "🎉",
    category: "ciclo",
    message: {
      push: {
        title: "¡Bienvenido, {{user.name}}! 🎉",
        body: "Gracias por unirte. Junta sellos en cada compra y canjéalos por bebidas gratis.",
      },
      email: {
        subject: "Bienvenido a T4 Lovers 🎉",
        body: "Hola {{user.name}}, ¡nos alegra tenerte! Por cada compra sumas sellos y puntos que canjeas por bebidas gratis. Pásate por {{store.name}} y empieza a acumular. 🧋",
      },
    },
  },
  {
    id: "cumpleanos",
    label: "Cumpleaños",
    emoji: "🎂",
    category: "ciclo",
    message: {
      push: {
        title: "¡Feliz cumple, {{user.name}}! 🎂",
        body: "Celébralo en {{store.name}}: esta semana te tenemos una sorpresa.",
      },
      whatsapp: {
        text: "🎂 ¡Feliz cumpleaños, {{user.name}}! Este mes ven a {{store.name}} y celebremos con una bebida de regalo 🎁 Muéstranos este mensaje.",
      },
    },
  },
  {
    id: "te-extranamos",
    label: "Te extrañamos",
    emoji: "💚",
    category: "ciclo",
    message: {
      push: {
        title: "Te extrañamos, {{user.name}} 💚",
        body: "Hace tiempo no te vemos. Vuelve a {{store.name}} por tu bebida favorita.",
      },
      whatsapp: {
        text: "{{user.name}}, ¡te extrañamos en T4! 💚 Vuelve esta semana a {{store.name}} y date un gusto. Te tenemos algo especial para tu regreso.",
      },
    },
  },
  {
    id: "referido",
    label: "Invita a un amigo",
    emoji: "🤝",
    category: "ciclo",
    message: {
      push: {
        title: "Trae a un amigo 🤝",
        body: "{{user.name}}, invita a alguien a {{store.name}} y disfruten juntos.",
      },
      whatsapp: {
        text: "{{user.name}}, ¿conoces a alguien a quien le encantaría T4? 🤝 Invítalo esta semana a {{store.name}} y vivan juntos la experiencia 🧋",
      },
    },
  },
];
