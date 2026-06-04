import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { analytics } from "@/lib/analytics";
import { flags } from "@/lib/feature-flags";
import { log } from "@/lib/log";
import { rateLimiter } from "@/lib/rate-limit";
import { realtime } from "@/lib/realtime";
import { storage } from "@/lib/storage";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const ctx = await createContext({ headers: req.headers });
      const distinctId = resolveDistinctId(ctx);
      const analyticsBinding = analytics.forRequest({
        distinctId,
        baseProperties: baseProperties(ctx, "admin"),
      });
      const flagsBinding = flags.forRequest({ distinctId });
      return {
        ...ctx,
        realtime,
        storage,
        rateLimiter,
        analytics: analyticsBinding,
        flags: flagsBinding,
        log,
      };
    },
  });

export { handler as GET, handler as POST };
