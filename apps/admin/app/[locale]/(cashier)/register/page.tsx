import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { setRequestLocale } from "next-intl/server";

import { CajaView } from "@/features/cashier/components/caja-view";
import { requireRole } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

/**
 * Cashier register (POS-lite). Role-gated: staff / manager / owner pass —
 * customers get bounced. Full-screen experience (no dashboard sidebar) since it
 * lives in its own (cashier) route group.
 */
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(STAFF_OR_ABOVE);
  return <CajaView />;
}
