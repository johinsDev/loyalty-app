"use client";

import { authClient } from "@loyalty/auth/client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

/** Web app base URL for customer-impersonation redirects. */
const WEB_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/**
 * Owner-only impersonation. tRPC validates the target + writes the audit; the
 * browser mints the session via the admin client. Employees stay in admin;
 * customers are redirected into the web PWA (shared parent-domain cookie).
 */
export function useImpersonate() {
  const trpc = useTRPC();
  const t = useTranslations("Employees");
  const mutation = useMutation(trpc.employees.impersonate.mutationOptions());

  const impersonate = async (userId: string): Promise<void> => {
    try {
      const res = await mutation.mutateAsync({ userId });
      await authClient.admin.impersonateUser({ userId });
      if (res.isCustomer && WEB_URL) {
        window.location.href = `${WEB_URL}/`;
      } else {
        window.location.href = "/";
      }
    } catch {
      toast.error(t("impersonateError"));
    }
  };

  return { impersonate, isPending: mutation.isPending };
}
