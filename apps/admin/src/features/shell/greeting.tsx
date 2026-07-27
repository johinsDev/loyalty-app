import { getFormatter, getTranslations } from "next-intl/server";

import { getMe } from "@/lib/auth-guard";
import { compactNumber } from "@/lib/money";
import { trpc } from "@/lib/trpc/server";

/**
 * RSC hole for the top-bar greeting + org totals. Name comes from the session
 * (cookie → dynamic, in Suspense); the counts are the manager-only
 * `dashboard.navCounts` (protected → Worker-cached 60s, NOT `use cache`).
 */
export async function Greeting() {
  const me = await getMe();
  const t = await getTranslations("Admin");
  const format = await getFormatter();
  const name = me?.user.name?.trim() || "Equipo";

  let counts: Awaited<
    ReturnType<Awaited<ReturnType<typeof trpc>>["dashboard"]["navCounts"]>
  > | null = null;
  if (me && (me.role === "manager" || me.role === "owner")) {
    counts = await (await trpc()).dashboard.navCounts().catch(() => null);
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="font-display truncate text-lg font-semibold tracking-tight">
        {t("greeting", { name })}
      </div>
      {counts ? (
        <div className="text-muted-foreground/80 truncate text-xs font-semibold">
          {t("storesMembers", {
            stores: counts.stores,
            members: compactNumber(format, counts.customers),
          })}
        </div>
      ) : null}
    </div>
  );
}
