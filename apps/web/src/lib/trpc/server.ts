import "server-only";

import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import { headers } from "next/headers";

import { analytics } from "../analytics";
import { flags } from "../feature-flags";
import { log } from "../log";
import { rateLimiter } from "../rate-limit";
import { realtime } from "../realtime";
import { storage } from "../storage";

export const trpc = async () => {
  const ctx = await createContext({ headers: await headers() });
  const distinctId = resolveDistinctId(ctx);
  const analyticsBinding = analytics.forRequest({
    distinctId,
    baseProperties: baseProperties(ctx, "web"),
  });
  const flagsBinding = flags.forRequest({ distinctId });
  return appRouter.createCaller({
    ...ctx,
    realtime,
    storage,
    rateLimiter,
    analytics: analyticsBinding,
    flags: flagsBinding,
    log,
  });
};
