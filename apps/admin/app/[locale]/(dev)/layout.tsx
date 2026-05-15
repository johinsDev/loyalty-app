import { OWNER_ONLY } from "@loyalty/auth/server";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { DevToolsNav } from "@/features/dev/components/dev-tools-nav";
import { requireRole } from "@/lib/auth-guard";
import { isDevOnlyEnabled } from "@/lib/dev-only";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Shared shell for dev-only tools (the four message outboxes, plus the
 * storage + realtime smoke pages). Three gates, in order:
 *
 *   1. `isDevOnlyEnabled()` — 404 in production. Preview + local dev
 *      fall through.
 *   2. `requireRole(OWNER_ONLY)` — only the owner role can see this
 *      tree; staff / managers get bounced to /sign-in?error=forbidden.
 *      Seed the first owner with `bun run db:seed:owner --email=...`.
 *   3. The page itself can add its own checks (`protectedProcedure`,
 *      etc.) but the layout's role check covers the broad case.
 */
export default async function DevLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDevOnlyEnabled()) notFound();
  await requireRole(OWNER_ONLY);

  return (
    <>
      <DevToolsNav />
      {children}
    </>
  );
}
