import "server-only";

import { cache } from "react";

import { trpc } from "@/lib/trpc/server";

type Branding = Awaited<
  ReturnType<Awaited<ReturnType<typeof trpc>>["settings"]["branding"]>
>;

/**
 * Tenant branding (brand color + SEO favicon…), resolved **once** per request
 * via React `cache()`. The root layout (brand theme) and the `[locale]` metadata
 * (favicon) both read it, so they share a single `settings.branding()` Worker
 * hop instead of two. Returns `null` when unset/unreachable → app defaults.
 */
export const getBranding = cache(
  async (): Promise<Branding | null> => (await trpc()).settings.branding().catch(() => null),
);
