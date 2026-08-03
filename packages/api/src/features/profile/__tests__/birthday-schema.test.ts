import { describe, expect, it } from "vitest";

import { updateBirthdayInputSchema } from "../schemas";

const parse = (birthday: unknown) =>
  updateBirthdayInputSchema.safeParse({ birthday });

const DAY = 24 * 60 * 60 * 1000;

describe("updateBirthdayInputSchema", () => {
  it("accepts a plausible date of birth", () => {
    const born = new Date(Date.UTC(1998, 6, 9));
    const result = parse(born);
    expect(result.success).toBe(true);
    expect(result.data?.birthday).toEqual(born);
  });

  it("accepts null to clear the field", () => {
    const result = parse(null);
    expect(result.success).toBe(true);
    expect(result.data?.birthday).toBeNull();
  });

  it("coerces an ISO string (what superjson-free clients send)", () => {
    const result = parse("1998-07-09T00:00:00.000Z");
    expect(result.success).toBe(true);
    expect(result.data?.birthday).toEqual(new Date("1998-07-09T00:00:00.000Z"));
  });

  it("rejects a date well in the future", () => {
    expect(parse(new Date(Date.now() + 30 * DAY)).success).toBe(false);
  });

  it("tolerates today in a timezone ahead of UTC", () => {
    // The client sends UTC midnight of its local day, which can sit up to a
    // day ahead of the server's clock.
    expect(parse(new Date(Date.now() + DAY / 2)).success).toBe(true);
  });

  it("rejects a date before 1900", () => {
    expect(parse(new Date(Date.UTC(1899, 11, 31))).success).toBe(false);
  });

  it("accepts the 1900 boundary itself", () => {
    expect(parse(new Date(Date.UTC(1900, 0, 1))).success).toBe(true);
  });

  it("rejects garbage", () => {
    expect(parse("not a date").success).toBe(false);
    expect(updateBirthdayInputSchema.safeParse({}).success).toBe(false);
  });
});
