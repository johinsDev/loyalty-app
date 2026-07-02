/**
 * Seed an announcement campaign from a banner. Pure — no DB. Title = banner
 * name, body = short description (or a generic nudge), link = the banner's CTA
 * if present else its detail page. Push-only by default (free, zero friction);
 * the admin adds email/WhatsApp in the composer.
 */
export type BannerSeedInput = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  mainImageUrl?: string | null;
  ctaHref?: string | null;
  ctaKind?: "internal" | "external" | null;
};

export type AnnounceDefaults = {
  push: { title: string; body: string };
  channelPriority: string[];
  linkUrl: string;
  imageUrl?: string;
};

const GENERIC_BODY = "¡No te lo pierdas! Toca para ver más.";

export function bannerAnnounceDefaults(banner: BannerSeedInput): AnnounceDefaults {
  const body = (banner.shortDescription ?? "").trim() || GENERIC_BODY;
  const linkUrl = (banner.ctaHref ?? "").trim() || `/banner/${banner.slug}`;
  return {
    push: { title: banner.name.slice(0, 80), body: body.slice(0, 180) },
    channelPriority: ["push"],
    linkUrl,
    ...(banner.mainImageUrl ? { imageUrl: banner.mainImageUrl } : {}),
  };
}
