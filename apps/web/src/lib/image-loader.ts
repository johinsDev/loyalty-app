/**
 * Next.js custom image loader — rewrites `<Image>` src through Cloudflare
 * Image Transformations when `NEXT_PUBLIC_IMAGE_CDN_HOST` is set, otherwise
 * returns the src untouched (dev + previews).
 *
 * Final URL shape (prod):
 *   https://<CDN_HOST>/cdn-cgi/image/width=<w>,quality=<q>,format=auto/<src>
 *
 * See `.claude/skills/image-loader/SKILL.md` for the CF runbook and the
 * cost model. Mirror file lives at `apps/admin/src/lib/image-loader.ts`.
 */
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
  if (!CDN_HOST) return src;

  const sameOrigin = src.startsWith(`https://${CDN_HOST}/`);
  const source = sameOrigin ? src.slice(`https://${CDN_HOST}`.length) : src;

  const opts = [`width=${width}`, `quality=${quality ?? 75}`, "format=auto"].join(
    ",",
  );
  return `https://${CDN_HOST}/cdn-cgi/image/${opts}${source.startsWith("/") ? "" : "/"}${source}`;
}
