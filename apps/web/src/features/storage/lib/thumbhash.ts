import { rgbaToThumbHash, thumbHashToDataURL } from "thumbhash";

/**
 * Encode a tiny blur placeholder for an image File, in the BROWSER, at upload
 * time. Downscales to ≤100px via canvas, reads RGBA, and runs ThumbHash → a
 * ~25-byte base64 string. Store it next to the image URL; pass it to
 * `<LoyaltyImage thumbhash>` for a deterministic blur-up with zero extra fetch.
 *
 * Returns null on any failure (non-image, decode error, no canvas) — callers
 * just fall back to no placeholder.
 */
export async function fileToThumbhash(file: File): Promise<string | null> {
  try {
    if (!file.type.startsWith("image/")) return null;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(100 / bitmap.width, 100 / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, w, h);
    const hash = rgbaToThumbHash(w, h, data);
    return btoa(String.fromCharCode(...hash));
  } catch {
    return null;
  }
}

/** Decode a thumbhash (base64) to a data URL for `<Image blurDataURL>`. Pure. */
export function thumbhashToDataUrl(thumbhash: string): string {
  const bytes = Uint8Array.from(atob(thumbhash), (c) => c.charCodeAt(0));
  return thumbHashToDataURL(bytes);
}
