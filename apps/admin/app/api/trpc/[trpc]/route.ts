import { appRouter, createContext } from "@loyalty/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { realtime } from "@/lib/realtime";
import { storage } from "@/lib/storage";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const ctx = await createContext({ headers: req.headers });
      return { ...ctx, realtime, storage };
    },
  });

export { handler as GET, handler as POST };
