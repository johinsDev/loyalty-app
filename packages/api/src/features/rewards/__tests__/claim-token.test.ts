import { describe, expect, it } from "vitest";

import {
  signRewardClaimToken,
  verifyRewardClaimToken,
} from "../claim-token";

const SECRET = "test-secret-min-32-chars-pad-pad-pad-pad";

describe("reward claim token", () => {
  it("round-trips rid + currency + subject", async () => {
    const { token } = await signRewardClaimToken({
      customerId: "cust_1",
      rewardId: "rw_1",
      currency: "points",
      secret: SECRET,
    });
    await expect(verifyRewardClaimToken(token, SECRET)).resolves.toEqual({
      customerId: "cust_1",
      rewardId: "rw_1",
      currency: "points",
    });
  });

  it("rejects a forged / wrong-secret token", async () => {
    const { token } = await signRewardClaimToken({
      customerId: "cust_1",
      rewardId: "rw_1",
      currency: "stamps",
      secret: SECRET,
    });
    await expect(
      verifyRewardClaimToken(token, "another-secret-min-32-chars-pad-pad"),
    ).rejects.toThrow();
  });

  it("rejects a non-reward-claim token shape", async () => {
    await expect(verifyRewardClaimToken("not-a-token", SECRET)).rejects.toThrow();
  });
});
