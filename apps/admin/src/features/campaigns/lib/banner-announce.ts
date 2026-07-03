import type { AnnounceValue } from "../components/announce-composer";
import { EMPTY_AUDIENCE } from "./campaign-audience";
import { EMPTY_MESSAGE } from "./campaign-message";

type BannerLike = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  ctaHref?: string | null;
  displayFrom?: Date | string | null;
};

const GENERIC_BODY = "¡No te lo pierdas! Toca para ver más.";

/** Compute the link the announcement's short link points at. */
export function bannerLinkUrl(b: BannerLike): string {
  return (b.ctaHref ?? "").trim() || `/banner/${b.slug}`;
}

/**
 * Seed the composer from a banner. Ideal channels + copy prefilled so it's ready
 * to send: priority push → email → whatsapp (cheapest reachable channel wins per
 * recipient — free push/email first, paid whatsapp only as the last resort), with
 * the banner's own name/description as each channel's message.
 */
export function bannerAnnounceInitial(b: BannerLike): AnnounceValue {
  const title = b.name.slice(0, 80);
  const body = ((b.shortDescription ?? "").trim() || GENERIC_BODY).slice(0, 180);
  const from = b.displayFrom ? new Date(b.displayFrom) : null;
  const future = from != null && from.getTime() > Date.now();
  return {
    enabled: false,
    message: {
      message: {
        ...EMPTY_MESSAGE,
        push: { title, body },
        email: { subject: title, body },
        whatsapp: { text: `${title}\n\n${body}` },
      },
      channelPriority: ["push", "email", "whatsapp"],
      linkUrl: bannerLinkUrl(b),
    },
    audience: EMPTY_AUDIENCE,
    ...(future ? { scheduledAt: from } : {}),
  };
}
