import "server-only";

import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import { headers } from "next/headers";

import { analytics } from "../analytics";
import { rateLimiter } from "../rate-limit";
import { realtime } from "../realtime";
import { storage } from "../storage";

export const trpc = async () => {
  const ctx = await createContext({ headers: await headers() });
  const analyticsBinding = analytics.forRequest({
    distinctId: resolveDistinctId(ctx),
    baseProperties: baseProperties(ctx, "admin"),
  });
  return appRouter.createCaller({
    ...ctx,
    realtime,
    storage,
    rateLimiter,
    analytics: analyticsBinding,
  });
};
