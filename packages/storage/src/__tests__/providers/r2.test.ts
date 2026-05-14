import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { R2Provider } from "../../providers/r2";

/**
 * `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` are optional
 * peer deps and aren't installed in this monorepo unless an app picks
 * `STORAGE_PROVIDER=r2`. The UT locks in the contract: select R2
 * without installing the SDK and get a clear error instead of a
 * confusing import failure. Integration with real Cloudflare R2 is
 * verified via manual smoke against a personal bucket.
 */
describe("R2Provider", () => {
  it("has a stable `name` of 'r2'", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
    });
    expect(r2.name).toBe("r2");
  });

  it("getPublicUrl returns null when no publicUrl configured", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
    });
    expect(r2.getPublicUrl("a.txt")).toBeNull();
  });

  it("getPublicUrl joins publicUrl + key", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
      publicUrl: "https://cdn.example.com",
    });
    expect(r2.getPublicUrl("avatars/lucia.png")).toBe(
      "https://cdn.example.com/avatars/lucia.png",
    );
  });

  it("strips trailing slash from publicUrl", () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
      publicUrl: "https://cdn.example.com/",
    });
    expect(r2.getPublicUrl("a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("throws MissingDependencyError when @aws-sdk/client-s3 is not installed", async () => {
    const r2 = new R2Provider({
      accountId: "fake",
      accessKeyId: "fake",
      secretAccessKey: "fake",
      bucket: "fake",
    });
    await expect(r2.put("a.txt", "x")).rejects.toBeInstanceOf(
      MissingDependencyError,
    );
  });
});
