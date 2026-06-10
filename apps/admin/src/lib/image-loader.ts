/**
 * Next.js custom image loader — mirror of `apps/web/src/lib/image-loader.ts`.
 * Rewrites `<Image>` src through the API Worker's `/img` transform endpoint
 * (which resizes + serves webp/avif via `cf.image`) when both the Worker URL and
 * the public image host are set (prod). Otherwise returns src untouched (dev +
 * previews → Next's default optimizer).
 *
 * Why the Worker and not `/cdn-cgi/image/`: the URL-form transform doesn't
 * engage on our R2-native custom domain, and the Origin-Rule workaround needs a
 * higher Cloudflare plan. See `.claude/skills/image-loader/SKILL.md`.
 *
 * Final URL shape (prod): https://<API_URL>/img/<key>?w=<w>&q=<q>
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const CDN_HOST = process.env.NEXT_PUBLIC_IMAGE_CDN_HOST;

export default function loyaltyImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // dev / preview (no Worker URL or no CDN host) → Next's default optimizer.
  if (!API_URL || !CDN_HOST) return src;

  // Only our R2-hosted images go through the Worker; external/relative pass through.
  const prefix = `https://${CDN_HOST}/`;
  if (!src.startsWith(prefix)) return src;

  const key = src.slice(prefix.length);
  const params = new URLSearchParams({
    w: String(width),
    q: String(quality ?? 75),
  });
  return `${API_URL}/img/${key}?${params.toString()}`;
}
