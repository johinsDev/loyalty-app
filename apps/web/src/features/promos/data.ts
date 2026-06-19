import {
  Cake,
  CupSoda,
  Gem,
  GlassWater,
  GraduationCap,
  Leaf,
  type LucideIcon,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

/**
 * Hardcoded demo data for the customer promos hub — a faithful build of the
 * "T4 · Promos" Claude Design template. Everything here is sample content until
 * the customer promos API lands (today the promotions router is manager-only).
 * Chrome copy (header, section + chip labels, detail CTAs, terms) is translated
 * via the `Promos` messages namespace; the values below are content (campaign
 * names, descriptions, validity, codes) and stay inline in Spanish, like
 * `home/data.ts`. The home carousel reads its featured subset from here too, so
 * a card tapped on the home resolves to a real detail on `/promos`.
 */

export type PromoTheme =
  | "teal"
  | "purple"
  | "green"
  | "amber"
  | "pink"
  | "blue"
  | "yellow";

export type PromoCategory = "descuentos" | "combos" | "puntos" | "especiales";

export type Promo = {
  id: string;
  icon: LucideIcon;
  /** Short campaign name. */
  name: string;
  description: string;
  /** Effect chip, e.g. "2×1", "-40%", "x2 pts", "Gratis". */
  badge: string;
  /** When it applies, e.g. "Lunes", "Lun a Vie", "Hasta 30 jun". */
  validity: string;
  category: PromoCategory;
  /** Code the customer shows at the register. */
  code: string;
  theme: PromoTheme;
  /** Shown in the "Destacadas" hero carousel (and on the home). */
  featured?: boolean;
};

/** [from, to] stops for each theme's hero-card gradient and list-icon tint. */
export const PROMO_THEME: Record<
  PromoTheme,
  { card: readonly [string, string]; tint: readonly [string, string] }
> = {
  teal: { card: ["#1BAD9D", "#0a6f64"], tint: ["#f1fffb", "#d6f6ed"] },
  purple: { card: ["#7b5cff", "#4a2fae"], tint: ["#f3eefe", "#e4d8ff"] },
  green: { card: ["#5bbf3a", "#2f7d1c"], tint: ["#eafbe6", "#d2f3c4"] },
  amber: { card: ["#f5a524", "#b5710a"], tint: ["#fff7e6", "#ffe9bf"] },
  pink: { card: ["#ff5fa2", "#c61f6b"], tint: ["#fdeef6", "#ffd9ec"] },
  blue: { card: ["#3b82f6", "#1e4fb0"], tint: ["#eaf3ff", "#d2e6ff"] },
  yellow: { card: ["#f4c430", "#c69307"], tint: ["#fff0c2", "#ffe08f"] },
};

export const promos: readonly Promo[] = [
  {
    id: "2x1-lunes",
    icon: CupSoda,
    name: "2×1 en Milk Tea",
    description: "Todos los lunes llevá dos Milk Tea y pagá solo una.",
    badge: "2×1",
    validity: "Lunes",
    category: "combos",
    code: "T4LUNES",
    theme: "teal",
    featured: true,
  },
  {
    id: "happy-hour",
    icon: Timer,
    name: "Happy Hour Boba",
    description: "De 4 a 6 pm, toda bebida con 40% de descuento.",
    badge: "-40%",
    validity: "Lun a Vie",
    category: "descuentos",
    code: "HAPPY40",
    theme: "purple",
    featured: true,
  },
  {
    id: "matcha-power",
    icon: Leaf,
    name: "Combo Matcha Power",
    description: "Matcha grande + pancito relleno a precio especial.",
    badge: "-30%",
    validity: "Hasta 30 jun",
    category: "combos",
    code: "MATCHA30",
    theme: "green",
    featured: true,
  },
  {
    id: "miercoles-x2",
    icon: Gem,
    name: "Miércoles puntos x2",
    description: "Cada miércoles ganás el doble de puntos en toda tu compra.",
    badge: "x2 pts",
    validity: "Miércoles",
    category: "puntos",
    code: "DOBLE2X",
    theme: "teal",
  },
  {
    id: "taro-martes",
    icon: GlassWater,
    name: "Martes de Taro -25%",
    description: "Toda bebida de la línea Taro con 25% off los martes.",
    badge: "-25%",
    validity: "Martes",
    category: "descuentos",
    code: "TARO25",
    theme: "purple",
  },
  {
    id: "estudiante",
    icon: GraduationCap,
    name: "Combo estudiante",
    description:
      "Bebida mediana + snack a precio fijo presentando tu credencial.",
    badge: "Combo",
    validity: "Lun a Vie",
    category: "combos",
    code: "ESTUDIA",
    theme: "amber",
  },
  {
    id: "topping-finde",
    icon: Sparkles,
    name: "Topping gratis de finde",
    description:
      "Sumá un topping sin costo en cualquier bebida sábados y domingos.",
    badge: "Gratis",
    validity: "Sáb y Dom",
    category: "especiales",
    code: "FINDETOP",
    theme: "pink",
  },
  {
    id: "trae-amigo",
    icon: Users,
    name: "Traé un amigo -15%",
    description: "Vení con un amigo y los dos llevan 15% off en su bebida.",
    badge: "-15%",
    validity: "Siempre",
    category: "descuentos",
    code: "AMIGO15",
    theme: "blue",
  },
  {
    id: "cumple",
    icon: Cake,
    name: "Cumpleaños: bebida gratis",
    description:
      "Durante el mes de tu cumple, una bebida del menú clásico va por la casa.",
    badge: "Gratis",
    validity: "Tu mes",
    category: "especiales",
    code: "FELIZT4",
    theme: "yellow",
  },
];

export const featuredPromos: readonly Promo[] = promos.filter((p) => p.featured);

export function promoById(id: string): Promo | null {
  return promos.find((p) => p.id === id) ?? null;
}

/** `linear-gradient(...)` from a theme's `[from, to]` stops. */
export function promoGradient(stops: readonly [string, string]): string {
  return `linear-gradient(140deg, ${stops[0]}, ${stops[1]})`;
}
