import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./src/i18n/routing";

const intl = createMiddleware(routing);

// Pathnames that map to /sign-in across locales. Keep in sync with
// `routing.pathnames["/sign-in"]`.
const SIGN_IN_PATHS = ["/iniciar-sesion", "/sign-in"];

// Dev-only outboxes need to be reachable without a session so PMs in
// preview can grab the OTP they need to log in (chicken-and-egg if we
// gated them). The `(dev)` layout already 404s in production, so this
// only opens the door in dev + preview.
const PUBLIC_DEV_PATHS = [
  "/whatsapp-outbox",
  "/sms-outbox",
  "/email-outbox",
  "/push-outbox",
];

function endsWithAny(pathname: string, paths: readonly string[]): boolean {
  for (const path of paths) {
    if (pathname === path || pathname.endsWith(path)) return true;
    // `/whatsapp-outbox/<id>` style detail routes
    if (pathname.includes(`${path}/`)) return true;
  }
  return false;
}

function isPublicPath(pathname: string): boolean {
  return (
    endsWithAny(pathname, SIGN_IN_PATHS) ||
    endsWithAny(pathname, PUBLIC_DEV_PATHS)
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run next-intl first so the request URL is canonicalized.
  const intlResponse = intl(request);

  if (isPublicPath(pathname)) return intlResponse;

  const session = getSessionCookie(request);
  if (session) return intlResponse;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/iniciar-sesion";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  // Match every pathname except: API routes, Next internals, static files, the
  // service worker, the manifest, and source maps.
  matcher: ["/((?!api|trpc|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)"],
};
