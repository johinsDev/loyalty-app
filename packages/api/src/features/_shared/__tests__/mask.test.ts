import { describe, expect, it } from "vitest";

import { maskEmail, maskPhone } from "../mask";

describe("maskPhone", () => {
  it("keeps the last four digits", () => {
    expect(maskPhone("+573001234567")).toBe("••••4567");
    expect(maskPhone("3001234567")).toBe("••••4567");
  });
  it("passes short/blank numbers through", () => {
    expect(maskPhone("123")).toBe("123");
    expect(maskPhone("")).toBe("");
  });
});

describe("maskEmail", () => {
  it("masks the local part, keeps the domain", () => {
    expect(maskEmail("john.doe@x.com")).toBe("jo••••••@x.com");
    expect(maskEmail("ab@y.com")).toBe("ab•@y.com");
  });
  it("returns null for missing or synthetic phone-first emails", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail("+573001234567@phone.local")).toBeNull();
  });
  it("returns null for a malformed address", () => {
    expect(maskEmail("nope")).toBeNull();
    expect(maskEmail("@x.com")).toBeNull();
  });
});
