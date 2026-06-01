---
name: image-loader
description: Optimize images in production via a custom Next.js loader that rewrites `<Image>` src through Cloudflare Image Transformations (`/cdn-cgi/image/...`). Use when adding a new `<Image>`, picking the right `sizes` + `placeholder`, debugging "image not optimized in preview", or setting up a fresh R2 custom domain.
---

# image-loader — Cloudflare Image Transformations + `<Image>` patterns

## TL;DR

- `apps/{web,admin}/src/lib/image-loader.ts` is the Next.js custom loader. It rewrites every `<Image>` src to `https://<CDN_HOST>/cdn-cgi/image/width=W,quality=Q,format=auto/<src>` **only when `NEXT_PUBLIC_IMAGE_CDN_HOST` is set**. Unset = no-op (raw src). This is how "only in prod" is enforced — the env var is set in Infisical `/shared` for prod only.
- Use `next/image` for any raster asset bigger than ~32px in either dimension. Skip it for inline icons (use SVG components).
- Pass **explicit `sizes`** so Next generates a meaningful `srcset`. Pass **`placeholder="blur"` + `blurDataURL`** for above-the-fold imagery.
- Cost: $0.50 per 1k transformations on Cloudflare Workers Paid, with 5k free in Pro / 100k in Business. The same transformed URL is cached at the CF edge, so repeat views are free.

## Architecture

```
apps/{web,admin}/                              packages/storage/
├── next.config.ts                             ├── R2 bucket
│   └── images: {                              │   ├── pub-<hash>.r2.dev   ← default
│        loader: "custom",                     │   └── images.t4diverclub.app  ← Custom Domain (CF zone)
│        loaderFile: "./src/lib/image-loader.ts",
│        remotePatterns: [...]                          ▲
│      }                                                │  same-origin in prod
├── src/lib/image-loader.ts                             │
│   └── (src, width, quality) => https://images.t4diverclub.app/cdn-cgi/image/
│                                  width=W,quality=Q,format=auto/<src>
│
└── src/env.ts
    └── NEXT_PUBLIC_IMAGE_CDN_HOST: z.string().optional()
       (Infisical /shared: unset in dev/preview, "images.t4diverclub.app" in prod)
```

The loader file is duplicated in each app (~15 lines). Next.js requires `loaderFile` to be a per-app relative path, so a shared package would still need a per-app re-export.

## API — the loader contract

```ts
// apps/{web,admin}/src/lib/image-loader.ts
const CDN_HOST = process.env.NEXT_PUBLIC_IMAGE_CDN_HOST;

export default function loyaltyImageLoader({
  src,
  width,
  quality,
}: { src: string; width: number; quality?: number }): string {
  if (!CDN_HOST) return src;                                // no-op
  const sameOrigin = src.startsWith(`https://${CDN_HOST}/`);
  const source = sameOrigin ? src.slice(`https://${CDN_HOST}`.length) : src;
  const opts = `width=${width},quality=${quality ?? 75},format=auto`;
  return `https://${CDN_HOST}/cdn-cgi/image/${opts}${source.startsWith("/") ? "" : "/"}${source}`;
}
```

- **`format=auto`** lets CF serve `image/webp` (or `avif` if the request `Accept` allows). Don't hardcode.
- **`quality` default = 75** — same as Next's default, matches CF's recommended sweet spot.
- **Same-origin shortcut**: when the src already lives on the CDN zone, we use a relative path. Pure cosmetics — CF accepts both shapes — but keeps URLs shorter.

## Usage — `<Image>` patterns

### Pattern 1 — Remote URL (R2-backed, the common case)

```tsx
import Image from "next/image";

<Image
  src="https://images.t4diverclub.app/brand/logo.png"
  alt="T4"
  width={240}
  height={80}
  sizes="(max-width: 640px) 50vw, 240px"
  priority                                          // above the fold → don't lazy-load
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,…"         // see "Blur placeholder" below
/>
```

### Pattern 2 — Static import (assets bundled with the app)

For logos and branding shipped in the repo (`public/` or `src/assets/`):

```tsx
import logoSrc from "@/assets/brand/logo.png";
import Image from "next/image";

<Image
  src={logoSrc}                       // includes auto-generated width/height/blurDataURL
  alt="T4"
  sizes="(max-width: 640px) 50vw, 240px"
  placeholder="blur"                  // free — Next analyzes the static import
  priority
/>
```

Next analyzes static-import images at build time and supplies `blurDataURL` for free. Use this for fixed brand assets.

### Pattern 3 — Below the fold, no blur

```tsx
<Image
  src="https://images.t4diverclub.app/cards/<id>.jpg"
  alt={card.title}
  width={400}
  height={300}
  sizes="(max-width: 640px) 90vw, 400px"
  loading="lazy"                       // default — explicit for clarity
/>
```

For lists/grids where blur on every item would be noisy, drop the placeholder. A Tailwind `bg-muted` on the wrapper handles the "before image loaded" state.

## Responsive sizes — the `sizes` prop

Next builds the `srcset` from `deviceSizes` (default `640, 750, 828, 1080, 1200, 1920, 2048, 3840`) and the `sizes` prop tells the browser which `srcset` candidate to pick. **Always pass `sizes`** — without it, Next falls back to `100vw`, which forces the browser to download the largest candidate.

Recipes:

| Case | `sizes` |
| --- | --- |
| Logo, fixed dimensions | `"240px"` |
| Mobile-first, scales down on small screens | `"(max-width: 640px) 50vw, 240px"` |
| Grid card, 1 col mobile → 2 col tablet → 3 col desktop | `"(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"` |
| Full-bleed hero | `"100vw"` |

Reading order matters: the browser uses the **first matching** media query.

## Blur placeholder

Two paths:

### Static imports → automatic

Next reads the image at build time, computes a tiny LQIP, and supplies `blurDataURL` for you. Just pass `placeholder="blur"`. Recommended for brand assets.

### Remote URLs → manual

You must supply `blurDataURL` yourself. Options (in increasing fidelity):

1. **Solid colour fallback** — a 4×4 grey SVG, base64-encoded inline. Used today in the demo `<Image>` on `apps/web/src/features/home/components/home.tsx`. Zero per-asset work; the blur looks generic.
2. **Per-asset LQIP** — generate a tiny (16–32px wide) JPEG of the original at upload time, base64-encode it, store alongside the asset metadata. Adds work in the upload pipeline.
3. **Skip blur, use `bg-muted`** — for grids of avatars/thumbnails where blur is overkill.

The follow-up — a `placeholderFromR2(key)` helper in `@loyalty/storage` that runs `sharp` on upload to compute the LQIP — should land when the first user-image upload feature ships. Today it's premature.

## Production setup runbook (one-time, do this once per CF zone)

> Currently NOT executed — `images.t4diverclub.app` doesn't exist yet. Until the runbook is complete, prod behaves like preview (no-op loader). Steps 1–3 are user-facing, step 4 is the env wire-up.

### 1. Add R2 Custom Domain on the CF zone

- Cloudflare Dashboard → R2 → bucket → **Settings** → **Custom Domains** → add `images.t4diverclub.app`.
- DNS records auto-create because the zone (`t4diverclub.app`) is in the same account.
- Wait ~30 s, then `curl -I https://images.t4diverclub.app/<known-key>` should 200.

### 2. Enable Image Transformations on the zone

- Dashboard → **t4diverclub.app** → **Images** → **Transformations** → toggle on.
- If you ever need to transform images from external origins (e.g. picsum.photos demos), also flip **"Resize images from any origin"**. For R2-only flow, leave it off.
- Plan check: Workers Paid covers up to 5k transformations/month free; beyond that it's $0.50/1k. Confirm in **Billing → Subscriptions**.

### 3. Set the envs in Infisical

In `/shared` for **prod only**:

- `R2_PUBLIC_URL=https://images.t4diverclub.app`
- `NEXT_PUBLIC_IMAGE_CDN_HOST=images.t4diverclub.app` *(Plain Text — host is public)*

Do **not** set in dev or preview — the loader is meant to be a no-op there.

### 4. Verify after first prod deploy

- Open a page with an `<Image>` → DevTools → Network → confirm the `<img>` `src` shape matches `https://images.t4diverclub.app/cdn-cgi/image/width=…,quality=75,format=auto/…`.
- Response headers: `Content-Type: image/webp` (or `avif` if the browser sent `Accept: image/avif`).
- Second request: `CF-Cache-Status: HIT`.

## Adding a new image to R2 (for `<Image>` use)

1. Use `@loyalty/storage` to upload — see `.claude/skills/storage/SKILL.md`. Default disk is configured per env.
2. The R2 provider exposes `disk.getPublicUrl(key)` → returns `https://images.t4diverclub.app/<key>` once `R2_PUBLIC_URL` is set.
3. Pass that URL to `<Image src={...} />`.

The loader doesn't care whether the upload happened via `@loyalty/storage` or any other channel — it only cares about the final URL.

## Adding a new image CDN provider

This stack picked CF Image Transformations because the zone already exists. If you ever need to switch (e.g. to imgix, or to Cloudflare Images managed):

1. Edit `apps/{web,admin}/src/lib/image-loader.ts` — return the provider's transform URL shape instead. The loader contract (`{ src, width, quality }`) is fixed by Next.js.
2. Update `NEXT_PUBLIC_IMAGE_CDN_HOST` semantics (or rename to `NEXT_PUBLIC_IMAGE_CDN_BASE`) and the `remotePatterns` list.
3. Update `.env.example` (section 12d) and Infisical entries.
4. Update this skill's "Production setup" section.
5. Both apps' loaders should stay in sync — copy the new version into both.

No package-level changes needed. The loader is the entire abstraction.

## Costs

CF Image Transformations (in 2026):

- **Workers Paid plan ($5/mo)**: 5 000 transformations/month free, then $0.50 per 1k.
- **Pro plan ($20/mo)**: 100 000/month free.
- **Business plan ($200/mo)**: 1 000 000/month free.

A "transformation" is one **unique** `width × quality × format` combo. Once cached at the edge (`CF-Cache-Status: HIT`), repeat requests are free.

Practical guard: if your `sizes` selects across 8 breakpoints and each page renders 6 images, the first uncached visit triggers 48 transformations. Cache TTL is 1 year by default. For T4's traffic, the 5k free tier covers many months.

## Gotchas

### "Image returns 404 in prod, fine in preview"

- The loader rewrites the URL to `https://images.t4diverclub.app/cdn-cgi/image/.../<src>`. If `<src>` is on a host that isn't `images.t4diverclub.app`, CF tries to fetch it from outside the zone.
- Fix: either (a) move the asset to R2 + use the CDN host, or (b) enable "Resize from any origin" on the CF zone (Pro+ feature) and add the source host to `remotePatterns`.

### "`width` param is ignored / image looks wrong size"

- Check that the parent container has a deterministic width — `<Image>` without `fill` needs both `width` and `height` props.
- Verify the `sizes` prop matches the actual rendered width. If you pass `sizes="100vw"` but the image is in a 240px container, you're downloading 4× more than needed.

### "`format=auto` doesn't deliver WebP"

- CF reads the `Accept` request header. Some proxies / extensions strip it. Test in a fresh browser tab with no extensions.
- Confirm Transformations is enabled on the zone (Dashboard → Images → Transformations).

### "Loader runs in preview, but I didn't want it to"

- Check Infisical → preview env → ensure `NEXT_PUBLIC_IMAGE_CDN_HOST` is **not** set.
- The cascade is enforced by env presence, not by code. If you ever want preview transformations, set it per-PR via Vercel branch-scoped env.

### "Static imports don't go through the CF loader"

- Yes they do — the loader receives the path Next generates (`/_next/static/media/<hash>.png`). In prod, the loader builds `https://images.t4diverclub.app/cdn-cgi/image/.../_next/static/media/<hash>.png`. For CF to fetch that, the source host (Vercel) must be reachable from CF — which it is. Just make sure "Resize from any origin" is enabled on the zone for this path to work.

### "Don't optimize this image"

For SVG, GIF (animated), or content you specifically want pixel-exact, pass the `unoptimized` prop:

```tsx
<Image src="..." alt="..." width={200} height={50} unoptimized />
```

The loader is bypassed for that `<Image>` instance.

## See also

- `.claude/skills/storage/SKILL.md` — uploading + serving the bytes the loader transforms.
- `.claude/skills/vercel/SKILL.md` — how `NEXT_PUBLIC_*` flows from Infisical → Vercel → the bundled client.
- `.claude/skills/env-deploy/SKILL.md` — the Infisical folder + env cascade rules.
- Next.js docs: <https://nextjs.org/docs/app/api-reference/components/image>
- Cloudflare Image Transformations docs: <https://developers.cloudflare.com/images/transform-images/>
