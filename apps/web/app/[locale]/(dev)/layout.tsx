import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { DevToolsNav } from "@/features/dev/components/dev-tools-nav";
import { isDevOnlyEnabled } from "@/lib/dev-only";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Shared shell for dev-only tools (`/whatsapp-outbox`, `/sms-outbox`,
 * future debug pages). Runs the env gate once for every child route
 * and renders a small nav strip so links between tools live in one
 * place.
 *
 * Returns 404 in production; preview + local dev fall through.
 */
export default async function DevLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDevOnlyEnabled()) notFound();

  return (
    <>
      <DevToolsNav />
      {children}
    </>
  );
}
