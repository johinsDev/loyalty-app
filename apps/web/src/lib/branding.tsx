"use client";

import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, type ReactNode, useContext } from "react";

export type Branding = inferRouterOutputs<AppRouter>["settings"]["branding"];

const BrandingContext = createContext<Branding | null>(null);

/**
 * Org branding (name/logo/color/social/SEO) read once on the server (the locale
 * layout) and shared with client components via context — so the sidebar brand,
 * etc. render with the real values immediately (no client fetch, no flash). The
 * theme color is applied separately at the root layout (SSR `<style>`).
 */
export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding | null;
  children: ReactNode;
}) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding | null {
  return useContext(BrandingContext);
}
