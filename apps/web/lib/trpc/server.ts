import "server-only";

import { appRouter, createContext } from "@loyalty/api";
import { headers } from "next/headers";

export const trpc = async () => {
  const ctx = await createContext({ headers: await headers() });
  return appRouter.createCaller(ctx);
};
