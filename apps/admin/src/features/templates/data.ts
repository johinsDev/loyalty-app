// Hardcoded campaign-template gallery for the design-first Plantillas screen.
// Seam: Phase B campaigns. A template seeds a new campaign draft (channels +
// copy); "Usar plantilla" jumps into the campaign wizard. Descriptions are
// user-facing copy, so they live in Spanish here (not in messages).

export type Channel = "push" | "email" | "sms" | "whatsapp";

export type Category = "welcome" | "winback" | "birthday" | "promo" | "seasonal";

export type Template = {
  id: string;
  name: string;
  category: Category;
  channels: Channel[];
  emoji: string;
  description: string;
};

export const CATEGORIES: Category[] = [
  "welcome",
  "winback",
  "birthday",
  "promo",
  "seasonal",
];

export const templates: Template[] = [
  {
    id: "t_welcome",
    name: "Bienvenida nuevo socio",
    category: "welcome",
    channels: ["push", "email"],
    emoji: "👋",
    description: "Da la bienvenida a quien acaba de unirse al club y regálale su primer sello.",
  },
  {
    id: "t_first_visit",
    name: "Primera compra",
    category: "welcome",
    channels: ["push", "whatsapp"],
    emoji: "🎉",
    description: "Agradece la primera visita e invita a volver con un beneficio de estreno.",
  },
  {
    id: "t_winback",
    name: "Te extrañamos",
    category: "winback",
    channels: ["email", "sms"],
    emoji: "🥺",
    description: "Reactiva a socios que llevan semanas sin pasar con un incentivo de regreso.",
  },
  {
    id: "t_winback_points",
    name: "Tus puntos por vencer",
    category: "winback",
    channels: ["push", "email"],
    emoji: "⏳",
    description: "Avisa a quienes están por perder puntos para que vuelvan a canjearlos.",
  },
  {
    id: "t_birthday",
    name: "Feliz cumpleaños",
    category: "birthday",
    channels: ["push", "email", "whatsapp"],
    emoji: "🎂",
    description: "Felicita en el día especial y regala una bebida de cumpleaños.",
  },
  {
    id: "t_promo_2x1",
    name: "Promo 2×1",
    category: "promo",
    channels: ["push", "sms"],
    emoji: "🧋",
    description: "Anuncia un 2×1 por tiempo limitado para llenar las horas valle.",
  },
  {
    id: "t_black_friday",
    name: "Black Friday",
    category: "seasonal",
    channels: ["push", "email", "sms", "whatsapp"],
    emoji: "🛍️",
    description: "Lanza tu oferta estrella del año por todos los canales a la vez.",
  },
  {
    id: "t_summer",
    name: "Especial de verano",
    category: "seasonal",
    channels: ["push", "whatsapp"],
    emoji: "☀️",
    description: "Promociona tus bebidas de temporada cuando aprieta el calor.",
  },
];
