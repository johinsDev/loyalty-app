"use client";

import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

/**
 * Completed wallets — its own island. Secondary content, so it reads the
 * prefetched query with a plain `useQuery` (renders nothing until it has rows,
 * no skeleton flash for the common empty case) and hydrates from the streamed
 * state.
 */
export function CompletedWallets() {
  const t = useTranslations("Card");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.sellos.myCompletedWallets.queryOptions());

  if (!data || data.length === 0) return null;

  return (
    <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <h2 className="font-display text-base font-semibold tracking-tight">
        {t("completedTitle")}
      </h2>
      <ul className="mt-3 space-y-2">
        {data.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <Check className="size-4 text-emerald-600" />
              {t("walletLabel", { n: c.sequence })}
            </span>
            <span className="text-muted-foreground font-medium">
              {c.status === "claimed" ? t("claimed") : t("pending")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
