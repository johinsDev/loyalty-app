import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./src/i18n/routing";

const intl = createMiddleware(routing);

const SIGN_IN_PATHS = ["/iniciar-sesion", "/sign-in"];

const PUBLIC_DEV_PATHS = [
  "/whatsapp-outbox",
  "/sms-outbox",
  "/email-outbox",
  "/push-outbox",
];

function endsWithAny(pathname: string, paths: readonly string[]): boolean {
  for (const path of paths) {
    if (pathname === path || pathname.endsWith(path)) return true;
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
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
