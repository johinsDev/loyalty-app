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

// Top-level dashboard slugs (both locales) that used to sit at the route root
// and now live under `/[storeId]/...`. A legacy bookmark for any of these is
// rewritten to the aggregate view (`/all/...`) so it keeps working. Non-store
// areas (register/caja, dev tools, auth) are deliberately absent.
const LEGACY_DASHBOARD_SLUGS = new Set([
  "dashboard",
  "customers", "clientes",
  "purchases", "compras",
  "products", "productos",
  "rewards", "premios",
  "promotions", "promociones",
  "loyalty", "lealtad",
  "campaigns", "campanas",
  "banners",
  "analytics", "analitica",
  "stores", "tiendas",
  "employees", "empleados",
  "settings", "ajustes",
  "shortlinks", "enlaces",
]);

/** Redirect a pre-`[storeId]` dashboard URL (`/clientes`) to `/all/clientes`. */
function legacyStoreRedirect(request: NextRequest): NextResponse | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const hasLocale = segments[0] === "en";
  const first = hasLocale ? segments[1] : segments[0];
  if (!first || !LEGACY_DASHBOARD_SLUGS.has(first)) return null;

  const rest = hasLocale ? segments.slice(1) : segments;
  const url = request.nextUrl.clone();
  url.pathname = `${hasLocale ? "/en" : ""}/all/${rest.join("/")}`;
  return NextResponse.redirect(url);
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacy = legacyStoreRedirect(request);
  if (legacy) return legacy;

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
