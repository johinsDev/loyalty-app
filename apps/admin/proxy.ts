import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./src/i18n/routing";

const intl = createMiddleware(routing);

const SIGN_IN_PATHS = ["/iniciar-sesion", "/sign-in"];

function isSignInPath(pathname: string): boolean {
  for (const path of SIGN_IN_PATHS) {
    if (pathname === path || pathname.endsWith(path)) return true;
  }
  return false;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
