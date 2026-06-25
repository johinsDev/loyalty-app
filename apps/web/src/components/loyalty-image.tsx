import Image, { type ImageProps } from "next/image";

import { thumbhashToDataUrl } from "@/features/storage/lib/thumbhash";

type LoyaltyImageProps = Omit<ImageProps, "placeholder" | "blurDataURL"> & {
  /**
   * ThumbHash (base64) for the blur-up placeholder, produced at upload by
   * `fileToThumbhash`. When present, the image renders `placeholder="blur"` with
   * a deterministically-decoded `blurDataURL` — no extra network request. Omit
   * it (e.g. external/unprocessed images) to render a plain `<Image>`.
   */
  thumbhash?: string | null;
};

/** Decode a thumbhash, swallowing a malformed/legacy value — a bad base64 must
 *  never crash the consumer; we just fall back to no blur placeholder. */
function safeBlur(thumbhash: string): string | null {
  try {
    return thumbhashToDataUrl(thumbhash);
  } catch {
    return null;
  }
}

/**
 * `next/image` + deterministic blur-up. Loader-agnostic: it just renders
 * `next/image`, so the app's custom loader (R2 → Worker `/img` in prod) still
 * applies. Lives per-app because `@loyalty/ui` is Next-agnostic.
 */
export function LoyaltyImage({ thumbhash, ...props }: LoyaltyImageProps) {
  const blur = thumbhash ? safeBlur(thumbhash) : null;
  if (!blur) return <Image {...props} />;
  return <Image {...props} placeholder="blur" blurDataURL={blur} />;
}
