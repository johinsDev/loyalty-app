"use client";

import { Button } from "@loyalty/ui";
import { BellIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";

/**
 * Fires the `send-test-push` Trigger.dev task against the logged-in
 * owner's own tokens. Lets us verify the round-trip (VAPID → SW →
 * UI) end to end without wiring a real "stamp earned" flow yet.
 *
 * On success: shows a sonner toast + refreshes the outbox list so the
 * new push row appears at the top once Trigger.dev finishes its run.
 */
export function SendTestPushButton() {
  const t = useTranslations("PushOutbox");
  const trpc = useTRPC();
  const sendTest = useMutation(trpc.pushTokens.sendTest.mutationOptions());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startTransition] = useTransition();

  const onClick = async () => {
    try {
      const result = await sendTest.mutateAsync({});
      toast.success(t("testSent", { count: result.tokens }));
      // Bump `_r` so the list re-suspenses and shows the new row.
      const next = new URLSearchParams(searchParams);
      next.set("_r", Date.now().toString());
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`);
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("testFailedGeneric");
      toast.error(message);
    }
  };

  const isPending = sendTest.isPending || isRefreshing;

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={onClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      <BellIcon className="size-4" aria-hidden />
      {isPending ? t("testSending") : t("testButton")}
    </Button>
  );
}
