// Hardcoded banners data for the design-first Banners CRUD. Banners feed the
// customer PWA home carousel (apps/web promos-carousel). Seam: a banners table +
// the storage channel for images. Gradients are brand-safe presets.

export type BannerType = "promo" | "standalone";
export type Status = "active" | "scheduled" | "expired" | "draft";
export const STATUSES: Status[] = ["active", "scheduled", "expired", "draft"];

export type Gradient = {
  key: string;
  from: string;
  to: string;
};

export const GRADIENTS: Gradient[] = [
  { key: "mint", from: "#1BAD9D", to: "#0e6f64" },
  { key: "grape", from: "#7c5cff", to: "#4527a0" },
  { key: "sunset", from: "#f0a868", to: "#e0467c" },
  { key: "ocean", from: "#3b73d6", to: "#1f3a8a" },
  { key: "berry", from: "#e0467c", to: "#7c1d3f" },
  { key: "ink", from: "#1f2937", to: "#000323" },
];

export function gradientCss(g: Gradient) {
  return `linear-gradient(135deg, ${g.from}, ${g.to})`;
}

export type Banner = {
  id: string;
  title: string;
  type: BannerType;
  gradient: string;
  emoji: string;
  status: Status;
  range: string;
  clicks: number;
};

export const banners: Banner[] = [
  { id: "b_001", title: "2×1 entre semana", type: "promo", gradient: "mint", emoji: "🧋", status: "active", range: "1–30 jun", clicks: 1240 },
  { id: "b_002", title: "Doble puntos finde", type: "promo", gradient: "grape", emoji: "⭐", status: "active", range: "todo jun", clicks: 980 },
  { id: "b_003", title: "Nuevo: Taro especial", type: "standalone", gradient: "sunset", emoji: "🍠", status: "scheduled", range: "15–31 jul", clicks: 0 },
  { id: "b_004", title: "Topping gratis", type: "promo", gradient: "ocean", emoji: "🍮", status: "expired", range: "1–31 may", clicks: 2100 },
  { id: "b_005", title: "Síguenos en redes", type: "standalone", gradient: "berry", emoji: "📸", status: "draft", range: "—", clicks: 0 },
];

export type BannerDraft = {
  title: string;
  subtitle: string;
  cta: string;
  type: BannerType;
  promo: string;
  gradient: string;
  emoji: string;
  start: Date | null;
  end: Date | null;
};

export const emptyBannerDraft: BannerDraft = {
  title: "",
  subtitle: "",
  cta: "",
  type: "promo",
  promo: "promo2x1",
  gradient: "mint",
  emoji: "🧋",
  start: null,
  end: null,
};

const SAMPLE: BannerDraft = {
  title: "2×1 entre semana",
  subtitle: "Trae a un amigo, de lunes a jueves.",
  cta: "Ver promo",
  type: "promo",
  promo: "promo2x1",
  gradient: "mint",
  emoji: "🧋",
  start: null,
  end: null,
};

/** Resolve a banner into an editable draft. Hardcoded — unknown ids fall back to
 * a representative sample so deep links never 404 in the design build. */
export function getBannerDraft(id: string): BannerDraft {
  const b = banners.find((x) => x.id === id);
  if (!b) return SAMPLE;
  return {
    ...SAMPLE,
    title: b.title,
    type: b.type,
    gradient: b.gradient,
    emoji: b.emoji,
  };
}

// Promos a banner can point to (design-first; the real list comes from the
// promotions feature).
export const PROMOS = ["promo2x1", "doublePoints", "freeTopping"] as const;
export const BANNER_EMOJIS = ["🧋", "⭐", "🍠", "🍮", "📸", "🎉", "🎁", "🔥"];
