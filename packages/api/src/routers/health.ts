import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    ok: true,
    ts: new Date().toISOString(),
  })),

  /**
   * Fails on purpose, so a client can be exercised against a failing query.
   *
   * Until now the only failing procedures were real bugs, and by the time one
   * appeared the question was "why is this screen wrong" instead of "does an
   * error reach the UI at all" — which is how a whole app shipped with error
   * branches nobody could confirm ever run.
   *
   * The two shapes reach the client differently: an uncaught error becomes
   * INTERNAL_SERVER_ERROR (500), a `TRPCError` keeps its own status (400).
   * Touches no data and has no side effects; the worst it can do is make noise
   * in error tracking for whoever calls it.
   */
  boom: publicProcedure
    .input(z.enum(["uncaught", "trpc"]).default("uncaught"))
    .query(({ input }) => {
      if (input === "trpc") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "BOOM_TRPC" });
      }
      throw new Error("BOOM_UNCAUGHT");
    }),
});
