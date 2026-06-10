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

/**
 * `next/image` + deterministic blur-up. Loader-agnostic: it just renders
 * `next/image`, so the app's custom loader (R2 → Worker `/img` in prod) still
 * applies. Lives per-app because `@loyalty/ui` is Next-agnostic.
 */
export function LoyaltyImage({ thumbhash, ...props }: LoyaltyImageProps) {
  if (!thumbhash) return <Image {...props} />;
  return (
    <Image {...props} placeholder="blur" blurDataURL={thumbhashToDataUrl(thumbhash)} />
  );
}
