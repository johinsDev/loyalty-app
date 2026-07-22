"use client";

import { type ComponentProps, useContext, useMemo } from "react";

import { StoreScopeContext } from "@/lib/store-scope";

import {
  Link as IntlLink,
  usePathname as useIntlPathname,
  useRouter as useIntlRouter,
} from "./navigation";

/**
 * Store-scoped navigation for the admin CRM. Every dashboard route lives under a
 * `/[storeId]` segment now, so components would otherwise have to thread the
 * active store into every `<Link>` / `router.push`. Instead these wrappers take
 * the bare route (`/customers`, `{ pathname: "/customers/[id]", params }`) and
 * inject the current `storeId` segment — read from {@link StoreScopeContext},
 * falling back to `"all"` outside a scoped layout. `usePathname` strips the
 * segment back off so existing active-state checks against bare keys keep
 * working. Non-store routes (register, sign-in, dev tools) pass through.
 */

const STORE_SCOPED = new Set([
  "dashboard",
  "customers",
  "purchases",
  "products",
  "rewards",
  "promotions",
  "loyalty",
  "campaigns",
  "banners",
  "analytics",
  "stores",
  "employees",
  "settings",
  "shortlinks",
]);

type HrefObject = {
  pathname: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
};
export type StoreHref = string | HrefObject;

function firstSegment(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[0];
}

/** Prefix a bare dashboard href with `/[storeId]` + inject the active segment. */
function scopeHref(href: StoreHref, segment: string): StoreHref {
  if (typeof href === "string") {
    if (!STORE_SCOPED.has(firstSegment(href) ?? "")) return href;
    return { pathname: `/[storeId]${href}`, params: { storeId: segment } };
  }
  if (!STORE_SCOPED.has(firstSegment(href.pathname) ?? "")) return href;
  return {
    ...href,
    pathname: `/[storeId]${href.pathname}`,
    // Current segment by default; an explicit `storeId` param wins (cross-store
    // navigation like quick-create or the switcher).
    params: { storeId: segment, ...href.params },
  };
}

function useSegment(): string {
  return useContext(StoreScopeContext)?.segment ?? "all";
}

type IntlLinkProps = ComponentProps<typeof IntlLink>;

export function Link({ href, ...props }: Omit<IntlLinkProps, "href"> & { href: StoreHref }) {
  const segment = useSegment();
  const scoped = scopeHref(href, segment);
  return <IntlLink href={scoped as IntlLinkProps["href"]} {...props} />;
}

export function useRouter() {
  const router = useIntlRouter();
  const segment = useSegment();
  return useMemo(
    () => ({
      ...router,
      push: (href: StoreHref, opts?: Parameters<typeof router.push>[1]) =>
        router.push(scopeHref(href, segment) as Parameters<typeof router.push>[0], opts),
      replace: (href: StoreHref, opts?: Parameters<typeof router.replace>[1]) =>
        router.replace(scopeHref(href, segment) as Parameters<typeof router.replace>[0], opts),
    }),
    [router, segment],
  );
}

/** The current pathname with the `/[storeId]` segment stripped, so active-state
 *  checks compare against bare route keys (`/customers`) as before. */
export function usePathname(): string {
  const raw = useIntlPathname();
  const stripped = raw.replace(/^\/[^/]+/, "");
  return stripped === "" ? "/" : stripped;
}
