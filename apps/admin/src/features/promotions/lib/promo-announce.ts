import type { AnnounceValue } from "@/features/campaigns/components/announce-composer";
import { EMPTY_AUDIENCE } from "@/features/campaigns/lib/campaign-audience";
import { EMPTY_MESSAGE } from "@/features/campaigns/lib/campaign-message";

type PromoLike = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  benefitSummary?: string | null;
  startsAt?: Date | string | null;
};

const GENERIC_BODY = "¡No te lo pierdas! Toca para ver más.";

export function promoLinkUrl(p: PromoLike): string {
  return `/promos/${p.slug}`;
}

/** Seed the announce composer from the promo: ideal channel priority + the
 *  promo's own copy (mirrors banners' `bannerAnnounceInitial`). */
export function promoAnnounceInitial(p: PromoLike): AnnounceValue {
  const title = p.name.slice(0, 80);
  const body = ((p.shortDescription ?? "").trim() || (p.benefitSummary ?? "").trim() || GENERIC_BODY).slice(0, 180);
  const from = p.startsAt ? new Date(p.startsAt) : null;
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
      linkUrl: promoLinkUrl(p),
    },
    audience: EMPTY_AUDIENCE,
    ...(future ? { scheduledAt: from } : {}),
  };
}
