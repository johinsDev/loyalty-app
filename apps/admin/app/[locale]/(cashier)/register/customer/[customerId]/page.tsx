import { setRequestLocale } from "next-intl/server";

import { RegisterView } from "@/features/cashier/components/register-view";
import type { PreselectReward } from "@/features/cashier/components/register-board";

type Props = {
  params: Promise<{ locale: string; customerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `/caja/cliente/[customerId]` — the register for one socio. A reward scanned at
 *  identify time arrives via query params (rewardId/currency/rewardName/note). */
export default async function RegisterCustomerPage({ params, searchParams }: Props) {
  const { locale, customerId } = await params;
  setRequestLocale(locale);
  const q = await searchParams;

  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const rewardId = one(q.rewardId);
  const currency = one(q.currency);
  const preselect: PreselectReward | undefined =
    rewardId && (currency === "stamps" || currency === "points" || currency === "both")
      ? {
          rewardId,
          currency,
          name: one(q.rewardName) ?? "",
          note: one(q.note) ?? null,
        }
      : undefined;

  return <RegisterView customerId={customerId} preselect={preselect} />;
}
