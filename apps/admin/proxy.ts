import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./src/i18n/routing";

const intl = createMiddleware(routing);

// Paths reachable while signed out: the sign-in screen and the invitation-accept
// page (the invitee lands here before they have a session — it sends them a
// magic-link, then they return authenticated to accept).
const PUBLIC_PATHS = [
  "/iniciar-sesion",
  "/sign-in",
  "/aceptar-invitacion",
  "/accept-invitation",
];

function isPublicPath(pathname: string): boolean {
  for (const path of PUBLIC_PATHS) {
    if (pathname === path || pathname.endsWith(path)) return true;
  }
  return false;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // `monitoring` = the Sentry tunnel route (locale-agnostic); excluding it stops
  // an error POST from a logged-out user being redirected to sign-in.
  matcher: ["/((?!api|trpc|monitoring|_next|_vercel|.*\\..*).*)"],
};
