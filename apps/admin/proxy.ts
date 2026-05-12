import createMiddleware from "next-intl/middleware";

import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match every pathname except API routes, Next internals, and static files.
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
