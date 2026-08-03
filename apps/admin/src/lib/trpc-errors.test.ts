import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { isSignedOut, trpcErrorData } from "./trpc-errors";

/** A tRPC client error as the RSC caller surfaces it (shape from the server). */
function trpcError(code: string, httpStatus: number): TRPCClientError<never> {
  return TRPCClientError.from({
    error: {
      message: code,
      code: -32001,
      data: { code, httpStatus, path: "auth.me" },
    },
  } as never);
}

describe("isSignedOut", () => {
  it("is true only for the Worker saying UNAUTHORIZED", () => {
    expect(isSignedOut(trpcError("UNAUTHORIZED", 401))).toBe(true);
  });

  it("is true for a bare 401 even if the code is missing", () => {
    expect(isSignedOut(trpcError("", 401))).toBe(true);
  });

  // The whole point of the helper: these used to be swallowed into `null`,
  // which the guards turned into redirect("/sign-in") — a silent logout on
  // what is actually a server fault.
  it.each([
    ["TOO_MANY_REQUESTS", 429],
    ["INTERNAL_SERVER_ERROR", 500],
    ["BAD_REQUEST", 400],
    ["TIMEOUT", 408],
    ["FORBIDDEN", 403],
    ["PAYLOAD_TOO_LARGE", 413],
  ])("is false for %s (%i) — an outage, not a logout", (code, status) => {
    expect(isSignedOut(trpcError(code, status))).toBe(false);
  });

  it("is false for a plain network error with no tRPC shape", () => {
    expect(isSignedOut(new TypeError("fetch failed"))).toBe(false);
  });

  it("is false for non-errors", () => {
    expect(isSignedOut(null)).toBe(false);
    expect(isSignedOut(undefined)).toBe(false);
    expect(isSignedOut("UNAUTHORIZED")).toBe(false);
    expect(isSignedOut({ data: { code: "UNAUTHORIZED" } })).toBe(false);
  });
});

describe("trpcErrorData", () => {
  it("surfaces the code + status the log line needs", () => {
    expect(trpcErrorData(trpcError("TOO_MANY_REQUESTS", 429))).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
  });

  it("is undefined for anything that isn't a tRPC client error", () => {
    expect(trpcErrorData(new Error("boom"))).toBeUndefined();
    expect(trpcErrorData(null)).toBeUndefined();
  });
});
