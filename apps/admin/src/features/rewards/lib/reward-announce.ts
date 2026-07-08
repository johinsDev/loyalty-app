import type { AnnounceValue } from "@/features/campaigns/components/announce-composer";
import { EMPTY_AUDIENCE } from "@/features/campaigns/lib/campaign-audience";
import { EMPTY_MESSAGE } from "@/features/campaigns/lib/campaign-message";

type RewardLike = {
  name: string;
  description?: string | null;
  benefitSummary?: string | null;
};

const GENERIC_BODY = "¡Ya puedes canjearla! Toca para ver tus recompensas.";

/** The reward description is rich-text HTML; announcements are plain text. */
const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Rewards have no per-item customer route; the announcement links to the
 *  customer rewards catalog (canonical route, translated by the web proxy). */
export function rewardLinkUrl(): string {
  return "/rewards";
}

/** Seed the announce composer from the reward: ideal channel priority + the
 *  reward's own copy (mirrors promos' `promoAnnounceInitial`). */
export function rewardAnnounceInitial(r: RewardLike): AnnounceValue {
  const title = r.name.slice(0, 80);
  const body = (
    stripHtml(r.description ?? "") ||
    (r.benefitSummary ?? "").trim() ||
    GENERIC_BODY
  ).slice(0, 180);
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
      linkUrl: rewardLinkUrl(),
    },
    audience: EMPTY_AUDIENCE,
  };
}
