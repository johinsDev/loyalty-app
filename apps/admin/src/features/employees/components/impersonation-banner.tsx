"use client";

import { authClient } from "@loyalty/auth/client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

/**
 * Shown while an impersonation session is active (`session.impersonatedBy` set).
 * "Volver a mi cuenta" ends it via the admin client, logs the stop (now back as
 * the owner), and reloads. Mounted once in the dashboard layout.
 */
export function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const t = useTranslations("Employees");
  const trpc = useTRPC();
  const logStop = useMutation(trpc.employees.logImpersonationStop.mutationOptions());
  const [ending, setEnding] = useState(false);

  const impersonatedBy = (data?.session as { impersonatedBy?: string | null } | undefined)
    ?.impersonatedBy;
  if (!impersonatedBy) return null;

  const name = data?.user?.name ?? data?.user?.email ?? "";

  const stop = async () => {
    setEnding(true);
    try {
      await authClient.admin.stopImpersonating();
      // Session is the owner again → log the stop (best-effort).
      await logStop.mutateAsync(undefined).catch(() => {});
    } finally {
      window.location.href = "/employees";
    }
  };

  return (
    <div className="bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2 text-sm font-semibold lg:px-8">
        <span className="truncate">{t("detail.impersonating", { name })}</span>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={ending}
          className="shrink-0 rounded-full bg-amber-950/10 px-3 py-1 font-bold hover:bg-amber-950/20"
        >
          {t("backToMyAccount")}
        </button>
      </div>
    </div>
  );
}
