import createMiddleware from "next-intl/middleware";

import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match every pathname except: API routes, Next internals, static files, the
  // service worker, the manifest, and source maps.
  matcher: ["/((?!api|trpc|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)"],
};
