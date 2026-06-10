import { describe, expect, it, vi } from "vitest";

import { type ImageFetch, transformImage } from "../images";

const PUBLIC_BASE = "https://images.t4diverclub.app";

const okFetch = (init?: { contentType?: string; status?: number }) =>
  vi.fn<ImageFetch>((_url, _cfInit) =>
    Promise.resolve(
      new Response("imgbytes", {
        status: init?.status ?? 200,
        headers: init?.contentType ? { "content-type": init.contentType } : {},
      }),
    ),
  );

const req = (path: string) => new Request(`https://api.t4diverclub.app${path}`);

describe("transformImage — public", () => {
  it("transforms a public image: fetches the public source with cf.image + immutable cache", async () => {
    const fetchImpl = okFetch({ contentType: "image/webp" });
    const res = await transformImage(req("/img/logo.png?w=80&q=75"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );

    const [url, cfInit] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://images.t4diverclub.app/logo.png");
    expect(cfInit.cf.image).toMatchObject({ width: 80, quality: 75, format: "auto" });
    expect(cfInit.cf.cacheEverything).toBe(true);
  });

  it("defaults quality to 75 and format to auto when absent", async () => {
    const fetchImpl = okFetch();
    await transformImage(req("/img/a.png?w=200"), { publicUrlBase: PUBLIC_BASE, fetchImpl });
    const [, cfInit] = fetchImpl.mock.calls[0]!;
    expect(cfInit.cf.image.quality).toBe(75);
    expect(cfInit.cf.image.format).toBe("auto");
  });

  it("decodes nested key paths", async () => {
    const fetchImpl = okFetch();
    await transformImage(req("/img/avatars/u1/photo.png?w=64"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://images.t4diverclub.app/avatars/u1/photo.png",
    );
  });

  it("400 on empty key — never fetches", async () => {
    const fetchImpl = okFetch();
    const res = await transformImage(req("/img/"), { publicUrlBase: PUBLIC_BASE, fetchImpl });
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("400 on non-numeric width", async () => {
    const fetchImpl = okFetch();
    const res = await transformImage(req("/img/a.png?w=abc"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
    });
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("propagates a 404 when the source object is missing", async () => {
    const fetchImpl = okFetch({ status: 404 });
    const res = await transformImage(req("/img/missing.png?w=80"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
    });
    expect(res.status).toBe(404);
  });
});

describe("transformImage — protected", () => {
  const isProtected = (k: string) => k.startsWith("private/");

  it("401 for a protected key with no session — never fetches", async () => {
    const fetchImpl = okFetch();
    const res = await transformImage(req("/img/private/u1/card.png?w=80"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
      isProtected,
      resolveSession: async () => null,
    });
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves a protected key via the SIGNED source + private cache when authed", async () => {
    const fetchImpl = okFetch({ contentType: "image/avif" });
    const signPrivateUrl = vi.fn(async (k: string) => `https://signed.example/${k}?sig=abc`);
    const res = await transformImage(req("/img/private/u1/card.png?w=80"), {
      publicUrlBase: PUBLIC_BASE,
      fetchImpl,
      isProtected,
      resolveSession: async () => ({ userId: "u1" }),
      signPrivateUrl,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(signPrivateUrl).toHaveBeenCalledWith("private/u1/card.png");
    const [url, cfInit] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://signed.example/private/u1/card.png?sig=abc");
    expect(cfInit.cf.image.width).toBe(80);
  });
});
