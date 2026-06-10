// Image transform endpoint for the Worker. Cloudflare's URL-form transforms
// (`/cdn-cgi/image/`) don't engage on our R2-native custom domain, and the
// Origin-Rule workaround needs a plan tier we don't have — so we resize in the
// Worker with `fetch(src, { cf: { image } })`.
//
// Crucial finding (verified live): the resizing engine CANNOT read our R2
// objects through the public custom domain — its fetch gets a 403 (same-zone),
// even though a plain Worker fetch gets 200 (`cf-resized: err=9408`). It CAN
// read a SIGNED S3 URL on `*.r2.cloudflarestorage.com`. So `signSource` mints a
// signed GET and we resize that. Because the signed URL changes per request, the
// ROUTE (not this fn) caches the result via the Worker Cache API, keyed on the
// stable request URL.
//
// Public images → `public, immutable`. Protected images (seam, not wired yet) →
// session gate + `private, no-store` (and `signSource` would point at a private
// bucket, so the object is never publicly reachable — the src can't bypass auth).
const ONE_YEAR = 31_536_000;

export type CfImageOptions = { width?: number; quality: number; format?: string };

export type ImageFetchInit = { cf: { image: CfImageOptions } };

export type ImageFetch = (url: string, init: ImageFetchInit) => Promise<Response>;

/**
 * Pick the output format from the client's `Accept`. We set it EXPLICITLY rather
 * than `format: "auto"` — auto didn't convert in our Worker `cf.image` setup
 * (kept the original even with Accept forwarded). avif > webp > keep original.
 * The chosen format also keys the edge cache (see the route), so each variant is
 * cached separately.
 */
export function pickFormat(accept: string | null): "avif" | "webp" | undefined {
  if (!accept) return undefined;
  if (accept.includes("image/avif")) return "avif";
  if (accept.includes("image/webp")) return "webp";
  return undefined;
}

export type TransformDeps = {
  /** Mint a SIGNED R2 GET URL (off-zone) the resizing engine can read. */
  signSource: (key: string) => Promise<string>;
  /** Injectable for tests; defaults to the global `fetch` (which honours `cf`). */
  fetchImpl?: ImageFetch;
  /** True → the key requires auth. Default: everything public. */
  isProtected?: (key: string) => boolean;
  /** Resolve the caller's session from the request (cookie). Protected only. */
  resolveSession?: (request: Request) => Promise<{ userId: string } | null>;
};

export async function transformImage(
  request: Request,
  deps: TransformDeps,
): Promise<Response> {
  const url = new URL(request.url);

  const rawKey = url.pathname.replace(/^\/img\/?/, "");
  const key = rawKey ? decodeURIComponent(rawKey) : "";
  if (!key) return new Response("missing image key", { status: 400 });

  const widthParam = url.searchParams.get("w");
  let width: number | undefined;
  if (widthParam !== null) {
    const w = Number(widthParam);
    if (!Number.isInteger(w) || w <= 0) {
      return new Response("invalid width", { status: 400 });
    }
    width = w;
  }

  const qualityParam = url.searchParams.get("q");
  let quality = 75;
  if (qualityParam !== null) {
    const q = Number(qualityParam);
    if (!Number.isInteger(q) || q < 1 || q > 100) {
      return new Response("invalid quality", { status: 400 });
    }
    quality = q;
  }

  const format = pickFormat(request.headers.get("accept"));

  let cacheControl: string;
  if (deps.isProtected?.(key)) {
    const session = (await deps.resolveSession?.(request)) ?? null;
    if (!session) return new Response("unauthorized", { status: 401 });
    cacheControl = "private, no-store";
  } else {
    cacheControl = `public, max-age=${ONE_YEAR}, immutable`;
  }

  const source = await deps.signSource(key);

  const image: CfImageOptions = { quality };
  if (width !== undefined) image.width = width;
  if (format) image.format = format;

  const doFetch: ImageFetch =
    deps.fetchImpl ?? ((u, init) => fetch(u, init as unknown as RequestInit));
  const res = await doFetch(source, { cf: { image } });

  if (!res.ok) return new Response(null, { status: res.status });

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", cacheControl);
  return new Response(res.body, { status: 200, headers });
}
