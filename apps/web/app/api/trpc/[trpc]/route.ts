import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { analytics } from "@/lib/analytics";
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
      const analyticsBinding = analytics.forRequest({
        distinctId: resolveDistinctId(ctx),
        baseProperties: baseProperties(ctx, "web"),
      });
      return {
        ...ctx,
        realtime,
        storage,
        rateLimiter,
        analytics: analyticsBinding,
      };
    },
  });

export { handler as GET, handler as POST };
