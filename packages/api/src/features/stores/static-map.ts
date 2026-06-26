/**
 * Google Static Maps screenshot generation. Called once when a store's location
 * is set/changed: fetch a static PNG centered on the branch and store it in R2,
 * so the customer app renders a lightweight image (served via the image-loader)
 * instead of a live iframe. Server-side key only — never exposed to the client.
 */

/** Minimal disk surface we need (from `ctx.storage.disk(...)`). */
interface MapDisk {
  put(
    key: string,
    body: Uint8Array,
    options: { contentType: string },
  ): Promise<{ key: string }>;
  getPublicUrl(key: string): string | null;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

const BRAND_MARKER = "0x1BAD9D";

export function staticMapUrl(lat: number, lng: number, key: string): string {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "16",
    size: "640x320",
    scale: "2",
    markers: `color:${BRAND_MARKER}|${lat},${lng}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Generate + upload the store's static map. Best-effort: returns null (and the
 *  app falls back to a "ver en mapa" link) when the key/disk is missing or the
 *  fetch fails. */
export async function generateStoreMap(opts: {
  disk: MapDisk | undefined;
  key: string | undefined;
  storeId: string;
  lat: number;
  lng: number;
}): Promise<string | null> {
  const { disk, key, storeId, lat, lng } = opts;
  if (!disk || !key) return null;
  try {
    const res = await fetch(staticMapUrl(lat, lng, key));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const file = await disk.put(`stores/${storeId}/map.png`, bytes, {
      contentType: "image/png",
    });
    return disk.getPublicUrl(file.key) ?? (await disk.getSignedUrl(file.key));
  } catch {
    return null;
  }
}

/** Keyless "cómo llegar" deep link (opens Google Maps / the maps app). */
export function directionsUrl(
  store: { lat: number | null; lng: number | null; address: string | null; placeId: string | null },
): string | null {
  if (store.lat != null && store.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
  }
  if (store.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`;
  }
  return null;
}
