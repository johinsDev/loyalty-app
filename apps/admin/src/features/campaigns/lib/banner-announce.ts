import { announceInitial, type AnnounceValue } from "../components/announce-composer";

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

/** Seed the composer's initial value from a banner. */
export function bannerAnnounceInitial(b: BannerLike): AnnounceValue {
  const base = announceInitial({
    title: b.name.slice(0, 80),
    body: ((b.shortDescription ?? "").trim() || GENERIC_BODY).slice(0, 180),
  });
  const from = b.displayFrom ? new Date(b.displayFrom) : null;
  const future = from != null && from.getTime() > Date.now();
  return future ? { ...base, when: "schedule", scheduledAt: from } : base;
}
