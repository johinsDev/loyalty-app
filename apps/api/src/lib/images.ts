// Image transform endpoint for the Worker. Cloudflare Image Transformations via
// the URL form (`/cdn-cgi/image/`) don't engage on our R2-native custom domain,
// and the Origin-Rule workaround needs a plan tier we don't have — so we resize
// in the Worker, where `fetch(url, { cf: { image } })` works regardless of plan
// or the "any origin" setting (it's the Worker's own resizing capability).
//
// Public images: fetched from the public R2 domain + long-immutable cached.
// Protected images (seam, not built yet): gated by session, fetched via a SIGNED
// R2 URL (so the object is NOT publicly reachable — the `src` can't bypass the
// gate), and marked `private, no-store` so no shared cache leaks them.
const ONE_YEAR = 31_536_000;

export type CfImageOptions = { width?: number; quality: number; format: string };

export type ImageFetchInit = {
  cf: { image: CfImageOptions; cacheTtl: number; cacheEverything: boolean };
};

export type ImageFetch = (url: string, init: ImageFetchInit) => Promise<Response>;

export type TransformDeps = {
  /** Public R2 origin, e.g. `https://images.t4diverclub.app` (no trailing slash). */
  publicUrlBase: string;
  /** Injectable for tests; defaults to the global `fetch` (which honours `cf`). */
  fetchImpl?: ImageFetch;
  /** True → the key requires auth + a signed source. Default: everything public. */
  isProtected?: (key: string) => boolean;
  /** Resolve the caller's session from the request (cookie). Protected only. */
  resolveSession?: (request: Request) => Promise<{ userId: string } | null>;
  /** Sign a private-bucket GET so the Worker (and only it) can read the object. */
  signPrivateUrl?: (key: string) => Promise<string>;
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

  const format = url.searchParams.get("f") ?? "auto";

  let source: string;
  let cacheControl: string;
  if (deps.isProtected?.(key)) {
    const session = (await deps.resolveSession?.(request)) ?? null;
    if (!session) return new Response("unauthorized", { status: 401 });
    source = deps.signPrivateUrl
      ? await deps.signPrivateUrl(key)
      : `${deps.publicUrlBase}/${key}`;
    cacheControl = "private, no-store";
  } else {
    source = `${deps.publicUrlBase}/${key}`;
    cacheControl = `public, max-age=${ONE_YEAR}, immutable`;
  }

  const image: CfImageOptions = { quality, format };
  if (width !== undefined) image.width = width;

  const doFetch: ImageFetch =
    deps.fetchImpl ?? ((u, init) => fetch(u, init as unknown as RequestInit));
  const res = await doFetch(source, {
    cf: { image, cacheTtl: ONE_YEAR, cacheEverything: true },
  });

  if (!res.ok) return new Response(null, { status: res.status });

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", cacheControl);
  return new Response(res.body, { status: 200, headers });
}
