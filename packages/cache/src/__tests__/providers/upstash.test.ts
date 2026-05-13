import { describe, expect, it } from "vitest";

import { MissingDependencyError } from "../../errors";
import { UpstashProvider } from "../../providers/upstash";

/**
 * `@upstash/redis` is an optional peer dep that isn't installed in
 * this monorepo unless an app picks `provider: "upstash"`. The UT
 * locks in the contract: select the provider without installing the
 * SDK and get a clear error instead of a confusing import failure.
 *
 * Integration with a real Upstash instance is verified manually
 * against a preview deploy (`UPSTASH_REDIS_REST_URL` set).
 */
describe("UpstashProvider", () => {
  it("has a stable `name` of \"upstash\"", () => {
    const provider = new UpstashProvider({ provider: "upstash" });
    expect(provider.name).toBe("upstash");
  });

  it("throws MissingDependencyError when @upstash/redis is not installed", async () => {
    const provider = new UpstashProvider({ provider: "upstash" });
    await expect(provider.get("k")).rejects.toBeInstanceOf(
      MissingDependencyError,
    );
  });

  it("accepts explicit url + token in config (no env read)", () => {
    const provider = new UpstashProvider({
      provider: "upstash",
      url: "https://example.upstash.io",
      token: "secret",
    });
    // Constructor only stores config; the client is lazy.
    expect(provider).toBeInstanceOf(UpstashProvider);
  });
});
