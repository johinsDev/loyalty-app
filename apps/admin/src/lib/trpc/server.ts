import "server-only";

import { appRouter, createContext } from "@loyalty/api";
import { headers } from "next/headers";

import { rateLimiter } from "../rate-limit";
import { realtime } from "../realtime";
import { storage } from "../storage";

export const trpc = async () => {
  const ctx = await createContext({ headers: await headers() });
  return appRouter.createCaller({ ...ctx, realtime, storage, rateLimiter });
};
