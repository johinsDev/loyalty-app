import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./src/i18n/routing";

const intl = createMiddleware(routing);

// Pathnames that map to /sign-in across locales. Keep in sync with
// `routing.pathnames["/sign-in"]`.
const SIGN_IN_PATHS = ["/iniciar-sesion", "/sign-in"];

function isSignInPath(pathname: string): boolean {
  for (const path of SIGN_IN_PATHS) {
    if (pathname === path || pathname.endsWith(path)) return true;
  }
  return false;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run next-intl first so the request URL is canonicalized.
  const intlResponse = intl(request);

  if (isSignInPath(pathname)) return intlResponse;

  const session = getSessionCookie(request);
  if (session) return intlResponse;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/iniciar-sesion";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  // Match every pathname except: API routes, the Sentry tunnel, Next internals,
  // static files, the service worker, the manifest, and source maps. The Sentry
  // tunnel (`/monitoring`) is locale-agnostic — excluding it stops an error POST
  // from a logged-out user being redirected to sign-in.
  matcher: ["/((?!api|trpc|monitoring|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)"],
};
