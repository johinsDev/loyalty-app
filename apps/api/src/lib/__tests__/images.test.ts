import { describe, expect, it, vi } from "vitest";

import { type ImageFetch, pickFormat, transformImage } from "../images";

// `signSource` stands in for the R2 GET signer — returns a stable fake so we can
// assert the resizing fetch targets the SIGNED url, not the public domain.
const signSource = (key: string) => Promise.resolve(`https://r2.example/signed/${key}?sig=x`);

const okFetch = (init?: { contentType?: string; status?: number }) =>
  vi.fn<ImageFetch>((_url, _cfInit) =>
    Promise.resolve(
      new Response("imgbytes", {
        status: init?.status ?? 200,
        headers: init?.contentType ? { "content-type": init.contentType } : {},
      }),
    ),
  );

const req = (path: string, accept?: string) =>
  new Request(`https://api.t4diverclub.app${path}`, {
    headers: accept ? { accept } : {},
  });

describe("pickFormat", () => {
  it("prefers avif, then webp, else undefined", () => {
    expect(pickFormat("image/avif,image/webp,*/*")).toBe("avif");
    expect(pickFormat("image/webp,*/*")).toBe("webp");
    expect(pickFormat("*/*")).toBeUndefined();
    expect(pickFormat(null)).toBeUndefined();
  });
});

describe("transformImage — public", () => {
  it("resizes the SIGNED source with cf.image + immutable cache (avif via Accept)", async () => {
    const fetchImpl = okFetch({ contentType: "image/avif" });
    const res = await transformImage(
      req("/img/logo.png?w=80&q=75", "image/avif,image/webp,*/*"),
      { signSource, fetchImpl },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/avif");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );

    const [url, cfInit] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://r2.example/signed/logo.png?sig=x");
    expect(cfInit.cf.image).toMatchObject({
      width: 80,
      quality: 75,
      format: "avif",
      fit: "scale-down",
    });
  });

  it("always passes fit=scale-down so it never upscales past the original", async () => {
    const fetchImpl = okFetch();
    await transformImage(req("/img/a.png?w=4000"), { signSource, fetchImpl });
    expect(fetchImpl.mock.calls[0]![1].cf.image.fit).toBe("scale-down");
  });

  it("defaults quality to 75 and omits format when the client sends no Accept", async () => {
    const fetchImpl = okFetch();
    await transformImage(req("/img/a.png?w=200"), { signSource, fetchImpl });
    const [, cfInit] = fetchImpl.mock.calls[0]!;
    expect(cfInit.cf.image.quality).toBe(75);
    expect(cfInit.cf.image.format).toBeUndefined();
  });

  it("signs the decoded nested key", async () => {
    const fetchImpl = okFetch();
    const sign = vi.fn(signSource);
    await transformImage(req("/img/avatars/u1/photo.png?w=64"), {
      signSource: sign,
      fetchImpl,
    });
    expect(sign).toHaveBeenCalledWith("avatars/u1/photo.png");
  });

  it("400 on empty key — never signs or fetches", async () => {
    const fetchImpl = okFetch();
    const sign = vi.fn(signSource);
    const res = await transformImage(req("/img/"), { signSource: sign, fetchImpl });
    expect(res.status).toBe(400);
    expect(sign).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("400 on non-numeric width", async () => {
    const fetchImpl = okFetch();
    const res = await transformImage(req("/img/a.png?w=abc"), { signSource, fetchImpl });
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("picks webp when the client accepts webp but not avif", async () => {
    const fetchImpl = okFetch();
    await transformImage(req("/img/a.png?w=80", "image/webp,*/*"), {
      signSource,
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0]![1].cf.image.format).toBe("webp");
  });

  it("propagates a 404 when the source object is missing", async () => {
    const fetchImpl = okFetch({ status: 404 });
    const res = await transformImage(req("/img/missing.png?w=80"), {
      signSource,
      fetchImpl,
    });
    expect(res.status).toBe(404);
  });
});

describe("transformImage — protected", () => {
  const isProtected = (k: string) => k.startsWith("private/");

  it("401 for a protected key with no session — never signs or fetches", async () => {
    const fetchImpl = okFetch();
    const sign = vi.fn(signSource);
    const res = await transformImage(req("/img/private/u1/card.png?w=80"), {
      signSource: sign,
      fetchImpl,
      isProtected,
      resolveSession: async () => null,
    });
    expect(res.status).toBe(401);
    expect(sign).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves a protected key via the signed source + private cache when authed", async () => {
    const fetchImpl = okFetch({ contentType: "image/avif" });
    const res = await transformImage(req("/img/private/u1/card.png?w=80"), {
      signSource,
      fetchImpl,
      isProtected,
      resolveSession: async () => ({ userId: "u1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const [url, cfInit] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://r2.example/signed/private/u1/card.png?sig=x");
    expect(cfInit.cf.image.width).toBe(80);
  });
});
